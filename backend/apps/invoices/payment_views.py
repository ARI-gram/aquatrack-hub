"""
apps/invoices/payment_views.py

Payment recording endpoints:

  POST /api/invoices/{id}/record-payment/
       Record a (partial or full) payment against a single invoice.

  POST /api/invoices/bulk-payment/
       Record one payment amount against a customer — system allocates
       to oldest invoices first automatically.

  POST /api/invoices/mark-overdue/
       Scan all ISSUED invoices past due_date and flip to OVERDUE.
       Called by a scheduled task or manually by the accountant.

  GET  /api/invoices/customer/{customer_id}/statement/
       Full account statement for one customer — balance, credit info,
       all invoices with status.
"""

from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.invoices.models import Invoice
from apps.invoices.serializers import InvoiceSerializer, InvoiceListSerializer
from apps.customers.models import Customer


# ── Permission ────────────────────────────────────────────────────────────────

class IsAccountsStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'accountant')
            and request.user.client_id is not None
        )


# ── Single invoice payment ────────────────────────────────────────────────────

class RecordPaymentView(APIView):
    """
    POST /api/invoices/{id}/record-payment/

    Body:
    {
        "amount_paid":        2000.00,
        "payment_method":     "MPESA",       // MPESA | CASH | BANK_TRANSFER
        "payment_reference":  "QHJ7K9X1P2"  // M-Pesa code, cheque no, etc.
    }

    Handles partial payments — if invoice is KES 5,000 and they pay
    KES 2,000 now, amount_due becomes KES 3,000 and status stays ISSUED.
    Only flips to PAID when amount_due reaches zero.

    Also updates customer.payment_profile.outstanding_balance.
    """

    permission_classes = [IsAccountsStaff]

    @transaction.atomic
    def post(self, request, pk):
        try:
            invoice = Invoice.objects.select_related(
                'customer__payment_profile'
            ).get(pk=pk, client=request.user.client)
        except Invoice.DoesNotExist:
            return Response(
                {'error': 'Invoice not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invoice.status in ('PAID', 'CANCELLED'):
            return Response(
                {'error': f'Invoice is already {invoice.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate payment amount
        try:
            amount = Decimal(str(request.data.get('amount_paid', 0)))
        except Exception:
            return Response(
                {'error': 'Invalid amount_paid value.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if amount <= 0:
            return Response(
                {'error': 'Payment amount must be greater than zero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        remaining_due = invoice.total_amount - invoice.amount_paid
        if amount > remaining_due:
            return Response(
                {
                    'error': f'Payment of KES {amount} exceeds the remaining balance of KES {remaining_due}.',
                    'balance_due': float(remaining_due),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        payment_method = request.data.get('payment_method', 'CASH')
        payment_reference = request.data.get('payment_reference', '')

        # Apply payment to invoice
        invoice.amount_paid += amount
        invoice.amount_due = max(
            Decimal('0.00'), invoice.total_amount - invoice.amount_paid)
        invoice.payment_method = payment_method
        invoice.payment_reference = payment_reference if hasattr(
            invoice, 'payment_reference') else ''

        if invoice.amount_due == Decimal('0.00'):
            invoice.status = 'PAID'
            invoice.paid_at = timezone.now()

        invoice.save(update_fields=[
            'amount_paid', 'amount_due', 'status',
            'payment_method', 'paid_at', 'updated_at',
        ])

        # Update customer outstanding balance (both models)
        try:
            profile = invoice.customer.payment_profile
            profile.outstanding_balance = max(
                Decimal('0.00'),
                profile.outstanding_balance - amount,
            )
            profile.save(update_fields=['outstanding_balance', 'updated_at'])
        except Exception:
            pass

        # Also update CreditTerms.outstanding_balance if it exists
        try:
            from apps.customers.invoice_models import CreditTerms
            credit_terms = invoice.customer.credit_terms
            credit_terms.outstanding_balance = max(
                Decimal('0.00'),
                credit_terms.outstanding_balance - amount,
            )
            credit_terms.save(update_fields=['outstanding_balance'])
        except Exception:
            pass

        return Response({
            'message':     f'Payment of KES {amount} recorded successfully.',
            'invoice':     InvoiceSerializer(invoice).data,
            'amount_paid': float(amount),
            'balance_due': float(invoice.amount_due),
            'fully_paid':  invoice.status == 'PAID',
        })


# ── Bulk payment allocation ───────────────────────────────────────────────────

class BulkPaymentView(APIView):
    """
    POST /api/invoices/bulk-payment/

    Customer pays one lump sum — system allocates oldest invoices first.

    Body:
    {
        "customer_id":       "uuid",
        "amount_paid":       10000.00,
        "payment_method":    "MPESA",
        "payment_reference": "QHJ7K9X1P2"
    }

    Example: Customer owes 3 invoices:
      INV-001: KES 2,000  (oldest)
      INV-002: KES 3,000
      INV-003: KES 5,000

    Customer pays KES 7,000:
      INV-001 → PAID  (KES 2,000 used)
      INV-002 → PAID  (KES 3,000 used)
      INV-003 → KES 2,000 applied, KES 3,000 still due

    Returns a summary of exactly what was allocated where.
    """

    permission_classes = [IsAccountsStaff]

    @transaction.atomic
    def post(self, request):
        customer_id = request.data.get('customer_id')
        payment_method = request.data.get('payment_method', 'CASH')
        payment_reference = request.data.get('payment_reference', '')

        try:
            amount = Decimal(str(request.data.get('amount_paid', 0)))
        except Exception:
            return Response(
                {'error': 'Invalid amount_paid value.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if amount <= 0:
            return Response(
                {'error': 'Payment amount must be greater than zero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify customer belongs to this client
        try:
            customer = Customer.objects.select_related(
                'payment_profile'
            ).get(id=customer_id, client=request.user.client)
        except Customer.DoesNotExist:
            return Response(
                {'error': 'Customer not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get all unpaid invoices oldest first
        unpaid = Invoice.objects.filter(
            customer=customer,
            client=request.user.client,
            status__in=['ISSUED', 'OVERDUE'],
        ).order_by('created_at')  # oldest first

        if not unpaid.exists():
            return Response(
                {'error': 'This customer has no outstanding invoices.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total_outstanding = sum(
            inv.total_amount - inv.amount_paid for inv in unpaid
        )

        if amount > total_outstanding:
            return Response(
                {
                    'error': f'Payment of KES {amount} exceeds total outstanding balance of KES {total_outstanding}.',
                    'total_outstanding': float(total_outstanding),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Allocate payment oldest first ─────────────────────────────────────
        remaining = amount
        allocations = []
        now = timezone.now()

        for invoice in unpaid:
            if remaining <= Decimal('0.00'):
                break

            invoice_due = invoice.total_amount - invoice.amount_paid
            applied = min(remaining, invoice_due)
            remaining -= applied

            invoice.amount_paid += applied
            invoice.amount_due = max(
                Decimal('0.00'), invoice.total_amount - invoice.amount_paid)
            invoice.payment_method = payment_method

            if invoice.amount_due == Decimal('0.00'):
                invoice.status = 'PAID'
                invoice.paid_at = now

            invoice.save(update_fields=[
                'amount_paid', 'amount_due', 'status', 'payment_method', 'paid_at', 'updated_at',
            ])

            allocations.append({
                'invoiceNumber': invoice.invoice_number,
                'invoiceId':     str(invoice.id),
                'applied':       float(applied),
                'balanceDue':    float(invoice.amount_due),
                'status':        invoice.status,
            })

        # ── Update customer outstanding balance (both models) ───────────────
        try:
            profile = customer.payment_profile
            profile.outstanding_balance = max(
                Decimal('0.00'),
                profile.outstanding_balance - amount,
            )
            profile.save(update_fields=['outstanding_balance', 'updated_at'])
        except Exception:
            pass

        # Also update CreditTerms.outstanding_balance if it exists
        try:
            from apps.customers.invoice_models import CreditTerms
            credit_terms = customer.credit_terms
            credit_terms.outstanding_balance = max(
                Decimal('0.00'),
                credit_terms.outstanding_balance - amount,
            )
            credit_terms.save(update_fields=['outstanding_balance'])
        except Exception:
            pass

        invoices_paid = sum(1 for a in allocations if a['status'] == 'PAID')
        invoices_partial = sum(1 for a in allocations if a['status'] != 'PAID')

        return Response({
            'message':        f'KES {amount} allocated across {len(allocations)} invoice(s).',
            'totalPaid':      float(amount),
            'invoicesPaid':   invoices_paid,
            'invoicesPartial': invoices_partial,
            'allocations':    allocations,
            'remainingBalance': float(
                sum(inv.total_amount - inv.amount_paid
                    for inv in Invoice.objects.filter(
                        customer=customer,
                        client=request.user.client,
                        status__in=['ISSUED', 'OVERDUE'],
                    ))
            ),
        })


# ── Auto overdue flagging ─────────────────────────────────────────────────────

class MarkOverdueView(APIView):
    """
    POST /api/invoices/mark-overdue/

    Scans all ISSUED invoices whose due_date has passed and flips
    them to OVERDUE. Safe to call repeatedly — only affects invoices
    that haven't been flagged yet.

    Call this:
    - Manually from the accountant dashboard
    - Via a scheduled task (celery beat / cron) every night at midnight
    """

    permission_classes = [IsAccountsStaff]

    @transaction.atomic
    def post(self, request):
        today = timezone.now().date()

        overdue_invoices = Invoice.objects.filter(
            client=request.user.client,
            status='ISSUED',
            due_date__lt=today,
        )

        count = overdue_invoices.count()
        overdue_invoices.update(status='OVERDUE', updated_at=timezone.now())

        return Response({
            'message': f'{count} invoice(s) marked as overdue.',
            'count':   count,
            'asOf':    today.isoformat(),
        })


# ── Customer account statement ────────────────────────────────────────────────

class CustomerStatementView(APIView):
    """
    GET /api/invoices/customer/{customer_id}/statement/

    Returns the full account picture for one customer:
    - Credit limit and available credit
    - Outstanding balance
    - All invoices with status, amounts, due dates
    - Aging breakdown (current / 1-30 days / 31-60 / 61-90 / 90+)

    Used by:
    - AccountantLayout → Customer detail page
    - Client admin → Customer detail page
    - Driver → before delivery (credit check)
    """

    permission_classes = [IsAccountsStaff]

    def get(self, request, customer_id):
        try:
            customer = Customer.objects.select_related(
                'payment_profile'
            ).get(id=customer_id, client=request.user.client)
        except Customer.DoesNotExist:
            return Response(
                {'error': 'Customer not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        today = timezone.now().date()
        invoices = Invoice.objects.filter(
            customer=customer,
            client=request.user.client,
        ).order_by('-created_at')

        # ── Credit info ───────────────────────────────────────────────────────
        try:
            profile = customer.payment_profile
            credit_enabled = profile.credit_account_enabled
            credit_limit = float(profile.credit_limit)
            outstanding = float(profile.outstanding_balance)
            available_credit = float(profile.available_credit)
            preferred_method = profile.preferred_method
        except Exception:
            credit_enabled = False
            credit_limit = 0.0
            outstanding = 0.0
            available_credit = 0.0
            preferred_method = 'CASH'

        # ── Aging analysis ────────────────────────────────────────────────────
        aging = {
            'current':   0.0,  # not yet due
            'days_1_30': 0.0,  # 1-30 days overdue
            'days_31_60': 0.0,  # 31-60 days overdue
            'days_61_90': 0.0,  # 61-90 days overdue
            'days_90_plus': 0.0,  # 90+ days overdue
        }

        unpaid = invoices.filter(status__in=['ISSUED', 'OVERDUE'])
        for inv in unpaid:
            balance = float(inv.total_amount - inv.amount_paid)
            if not inv.due_date:
                aging['current'] += balance
                continue

            days_overdue = (today - inv.due_date).days
            if days_overdue <= 0:
                aging['current'] += balance
            elif days_overdue <= 30:
                aging['days_1_30'] += balance
            elif days_overdue <= 60:
                aging['days_31_60'] += balance
            elif days_overdue <= 90:
                aging['days_61_90'] += balance
            else:
                aging['days_90_plus'] += balance

        # Round aging values
        aging = {k: round(v, 2) for k, v in aging.items()}

        # ── Invoice summary ───────────────────────────────────────────────────
        total_invoiced = float(sum(inv.total_amount for inv in invoices))
        total_paid = float(sum(inv.amount_paid for inv in invoices))
        total_due = float(sum(
            inv.total_amount - inv.amount_paid
            for inv in invoices
            if inv.status not in ('PAID', 'CANCELLED')
        ))

        return Response({
            'customer': {
                'id':             str(customer.id),
                'fullName':       customer.full_name,
                'phoneNumber':    customer.phone_number,
                'email':          customer.email,
                'status':         customer.status,
            },
            'creditInfo': {
                'creditEnabled':   credit_enabled,
                'creditLimit':     credit_limit,
                'outstandingBalance': outstanding,
                'availableCredit': available_credit,
                'preferredMethod': preferred_method,
            },
            'summary': {
                'totalInvoiced': round(total_invoiced, 2),
                'totalPaid':     round(total_paid, 2),
                'totalDue':      round(total_due, 2),
                'invoiceCount':  invoices.count(),
            },
            'aging': aging,
            'invoices': InvoiceListSerializer(invoices, many=True).data,
        })

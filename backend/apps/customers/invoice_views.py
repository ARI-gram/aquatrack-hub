"""
Customer Invoice Views
apps/customers/invoice_views.py

All endpoints require IsClientAdmin.

Per-customer:
  GET  /api/customers/{id}/credit-terms/           retrieve credit terms
  POST /api/customers/{id}/credit-terms/           create or update credit terms
  GET  /api/customers/{id}/invoices/               list invoices
  POST /api/customers/{id}/invoices/generate/      generate invoice from unbilled orders

Across all customers for this client:
  GET  /api/customers/invoices/                    list all invoices (filterable)
  GET  /api/customers/invoices/{inv_id}/           invoice detail
  POST /api/customers/invoices/{inv_id}/issue/     DRAFT → ISSUED (emails customer)
  POST /api/customers/invoices/{inv_id}/mark-paid/ record cheque/cash/bank payment
"""

import logging
from decimal import Decimal
from datetime import date, timedelta

from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction as db_transaction
from django.utils import timezone

from rest_framework import serializers, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.customers.models import Customer
from apps.customers.invoice_models import (
    CreditTerms,
    CustomerInvoice,
    CustomerInvoiceItem,
    CustomerBillingCycle,
    CustomerInvoiceStatus,
    CustomerInvoicePaymentMethod,
)
from apps.orders.models import Order

logger = logging.getLogger(__name__)


# ── Permission ────────────────────────────────────────────────────────────────

class IsClientAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'site_manager')
            and request.user.client_id is not None
        )


# ── Serializers ───────────────────────────────────────────────────────────────

class CreditTermsSerializer(serializers.ModelSerializer):
    outstanding_balance = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True)
    available_credit = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True)
    billing_cycle_display = serializers.CharField(
        source='get_billing_cycle_display', read_only=True)

    class Meta:
        model = CreditTerms
        fields = [
            'id', 'billing_cycle', 'billing_cycle_display',
            'credit_limit', 'payment_due_days', 'notes',
            'outstanding_balance', 'available_credit',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'outstanding_balance', 'available_credit',
                            'created_at', 'updated_at']


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerInvoiceItem
        fields = ['id', 'order_number', 'order_date',
                  'subtotal', 'delivery_fee', 'total', 'description']


class CustomerInvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(
        source='get_status_display',        read_only=True)
    billing_cycle_display = serializers.CharField(
        source='get_billing_cycle_display', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    customer_name = serializers.CharField(
        source='customer.full_name',   read_only=True)
    customer_phone = serializers.CharField(
        source='customer.phone_number', read_only=True)

    class Meta:
        model = CustomerInvoice
        fields = [
            'id', 'invoice_number', 'status', 'status_display',
            'billing_cycle', 'billing_cycle_display',
            'period_start', 'period_end',
            'subtotal', 'delivery_fees', 'total_amount',
            'due_date', 'is_overdue',
            'paid_at', 'payment_method', 'payment_reference',
            'notes', 'items',
            'customer_name', 'customer_phone',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields


class MarkPaidSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(
        choices=[(m.value, m.label) for m in CustomerInvoicePaymentMethod])
    payment_reference = serializers.CharField(
        required=False, allow_blank=True, default='')


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_customer(request, pk) -> Customer | None:
    try:
        return Customer.objects.get(pk=pk, client=request.user.client)
    except Customer.DoesNotExist:
        return None


def _next_invoice_number(client_id: str) -> str:
    year = timezone.now().year
    count = CustomerInvoice.objects.filter(
        customer__client_id=client_id,
        created_at__year=year,
    ).count()
    return f"CINV-{year}-{count + 1:06d}"


def _period_for_cycle(cycle: str) -> tuple[date, date]:
    today = timezone.now().date()
    if cycle == CustomerBillingCycle.WEEKLY:
        start = today - timedelta(days=today.weekday())   # Monday
        end = start + timedelta(days=6)                 # Sunday
    elif cycle == CustomerBillingCycle.BIWEEKLY:
        if today.day <= 15:
            start = today.replace(day=1)
            end = today.replace(day=15)
        else:
            start = today.replace(day=16)
            nm = today.replace(day=28) + timedelta(days=4)
            end = nm - timedelta(days=nm.day)
    elif cycle == CustomerBillingCycle.MONTHLY:
        start = today.replace(day=1)
        nm = today.replace(day=28) + timedelta(days=4)
        end = nm - timedelta(days=nm.day)
    else:  # IMMEDIATE
        start = end = today
    return start, end


def _build_invoice(customer, orders, terms, client_id) -> CustomerInvoice:
    today = timezone.now().date()
    period_start, period_end = _period_for_cycle(terms.billing_cycle)

    with db_transaction.atomic():
        invoice = CustomerInvoice.objects.create(
            customer=customer,
            invoice_number=_next_invoice_number(client_id),
            status=CustomerInvoiceStatus.DRAFT,
            billing_cycle=terms.billing_cycle,
            period_start=period_start,
            period_end=period_end,
            due_date=today + timedelta(days=terms.payment_due_days),
        )
        for order in orders:
            CustomerInvoiceItem.objects.create(
                invoice=invoice,
                order=order,
                order_number=order.order_number,
                order_date=order.created_at.date(),
                subtotal=order.subtotal,
                delivery_fee=order.delivery_fee,
                total=order.total_amount,
                description=f"Order {order.order_number}",
            )
        invoice.recalculate_totals()
    return invoice


def _send_invoice_email(invoice: CustomerInvoice) -> None:
    if not invoice.customer.email:
        return
    try:
        items_text = '\n'.join(
            f"  {item.order_number}  KES {item.total}"
            for item in invoice.items.all()
        )
        send_mail(
            subject=f"Invoice {invoice.invoice_number} — KES {invoice.total_amount}",
            message=(
                f"Dear {invoice.customer.full_name},\n\n"
                f"Please find invoice {invoice.invoice_number} "
                f"for the period {invoice.period_start} to {invoice.period_end}.\n\n"
                f"Orders:\n{items_text}\n\n"
                f"Total due: KES {invoice.total_amount}\n"
                f"Due date:  {invoice.due_date}\n\n"
                f"Please settle by cheque or bank transfer.\n\n"
                f"Thank you."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invoice.customer.email],
            fail_silently=True,
        )
    except Exception as exc:
        logger.error("Invoice email failed for %s: %s",
                     invoice.invoice_number, exc)


# ── Views ─────────────────────────────────────────────────────────────────────

class CreditTermsView(APIView):
    """GET / POST  /api/customers/{id}/credit-terms/"""
    permission_classes = [IsClientAdmin]

    def get(self, request, pk):
        customer = _get_customer(request, pk)
        if not customer:
            return Response({'error': 'Customer not found.'}, status=404)
        try:
            return Response(CreditTermsSerializer(customer.credit_terms).data)
        except CreditTerms.DoesNotExist:
            return Response({'error': 'No credit terms set for this customer.'}, status=404)

    def post(self, request, pk):
        customer = _get_customer(request, pk)
        if not customer:
            return Response({'error': 'Customer not found.'}, status=404)

        try:
            existing = customer.credit_terms
            s = CreditTermsSerializer(
                existing, data=request.data, partial=True)
        except CreditTerms.DoesNotExist:
            existing = None
            s = CreditTermsSerializer(data=request.data)

        s.is_valid(raise_exception=True)
        terms = s.save() if existing else s.save(customer=customer)

        # Keep CustomerPaymentProfile in sync
        from apps.customers.models import CustomerPaymentProfile
        CustomerPaymentProfile.objects.update_or_create(
            customer=customer,
            defaults={
                'credit_account_enabled': True,
                'credit_limit':           terms.credit_limit,
                'preferred_method':       'CREDIT',
                'setup_completed':        True,
            },
        )

        return Response(CreditTermsSerializer(terms).data)


class CustomerInvoiceListView(APIView):
    """GET  /api/customers/{id}/invoices/"""
    permission_classes = [IsClientAdmin]

    def get(self, request, pk):
        customer = _get_customer(request, pk)
        if not customer:
            return Response({'error': 'Customer not found.'}, status=404)
        invoices = customer.customer_invoices.prefetch_related(
            'items').order_by('-created_at')
        return Response(CustomerInvoiceSerializer(invoices, many=True).data)


class GenerateInvoiceView(APIView):
    """
    POST /api/customers/{id}/invoices/generate/

    Collects unbilled completed CREDIT orders and wraps them into a new
    DRAFT invoice.

    Optional body:
        { "order_ids": ["uuid1", "uuid2"] }   ← specific orders only
    """
    permission_classes = [IsClientAdmin]

    def post(self, request, pk):
        customer = _get_customer(request, pk)
        if not customer:
            return Response({'error': 'Customer not found.'}, status=404)

        try:
            terms = customer.credit_terms
        except CreditTerms.DoesNotExist:
            return Response(
                {'error': 'Customer has no credit terms. Configure credit first.'},
                status=400,
            )

        # Unbilled = completed, payment_method CASH (credit maps to CASH in Order model),
        #            not yet linked to an invoice item
        qs = Order.objects.filter(
            customer=customer,
            payment_method='CASH',
            invoice_item__isnull=True,
            status__in=['DELIVERED', 'COMPLETED'],
        )

        specific_ids = request.data.get('order_ids')
        if specific_ids:
            qs = qs.filter(id__in=specific_ids)

        orders = list(qs)
        if not orders:
            return Response(
                {'error': 'No unbilled completed orders found for this customer.'},
                status=400,
            )

        invoice = _build_invoice(
            customer=customer,
            orders=orders,
            terms=terms,
            client_id=str(request.user.client_id),
        )
        return Response(CustomerInvoiceSerializer(invoice).data, status=201)


class AllInvoicesView(APIView):
    """
    GET /api/customers/invoices/

    All customer invoices for this distributor.
    Query params: status, customer_id, page, limit
    """
    permission_classes = [IsClientAdmin]

    def get(self, request):
        qs = (
            CustomerInvoice.objects
            .filter(customer__client=request.user.client)
            .select_related('customer')
            .prefetch_related('items')
        )

        if s := request.query_params.get('status'):
            qs = qs.filter(status=s.upper())
        if cid := request.query_params.get('customer_id'):
            qs = qs.filter(customer_id=cid)

        qs = qs.order_by('-created_at')

        try:
            page = max(1, int(request.query_params.get('page', 1)))
            limit = min(
                100, max(1, int(request.query_params.get('limit', 20))))
        except (ValueError, TypeError):
            page, limit = 1, 20

        total = qs.count()
        offset = (page - 1) * limit

        return Response({
            'data':       CustomerInvoiceSerializer(qs[offset:offset + limit], many=True).data,
            'total':      total,
            'page':       page,
            'limit':      limit,
            'totalPages': max(1, (total + limit - 1) // limit),
        })


class InvoiceDetailView(APIView):
    """GET /api/customers/invoices/{inv_id}/"""
    permission_classes = [IsClientAdmin]

    def get(self, request, inv_id):
        try:
            inv = CustomerInvoice.objects.prefetch_related('items').get(
                id=inv_id, customer__client=request.user.client)
        except CustomerInvoice.DoesNotExist:
            return Response({'error': 'Invoice not found.'}, status=404)
        return Response(CustomerInvoiceSerializer(inv).data)


class IssueInvoiceView(APIView):
    """POST /api/customers/invoices/{inv_id}/issue/  → DRAFT → ISSUED + email"""
    permission_classes = [IsClientAdmin]

    def post(self, request, inv_id):
        try:
            inv = CustomerInvoice.objects.get(
                id=inv_id, customer__client=request.user.client)
        except CustomerInvoice.DoesNotExist:
            return Response({'error': 'Invoice not found.'}, status=404)

        if inv.status != CustomerInvoiceStatus.DRAFT:
            return Response(
                {'error': f'Cannot issue invoice with status {inv.status}.'},
                status=400,
            )

        inv.mark_issued()
        _send_invoice_email(inv)

        return Response({
            'message': f'Invoice {inv.invoice_number} issued.',
            'invoice': CustomerInvoiceSerializer(inv).data,
        })


class MarkInvoicePaidView(APIView):
    """
    POST /api/customers/invoices/{inv_id}/mark-paid/
    Body: { payment_method, payment_reference? }
    """
    permission_classes = [IsClientAdmin]

    def post(self, request, inv_id):
        try:
            inv = CustomerInvoice.objects.get(
                id=inv_id, customer__client=request.user.client)
        except CustomerInvoice.DoesNotExist:
            return Response({'error': 'Invoice not found.'}, status=404)

        if inv.status == CustomerInvoiceStatus.PAID:
            return Response({'error': 'Invoice is already paid.'}, status=400)

        s = MarkPaidSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        inv.mark_paid(
            payment_method=s.validated_data['payment_method'],
            payment_reference=s.validated_data.get('payment_reference', ''),
        )

        return Response({
            'message': f'Invoice {inv.invoice_number} marked as paid.',
            'invoice': CustomerInvoiceSerializer(inv).data,
        })

"""
apps/invoices/views.py
"""

from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.invoices.models import Invoice, InvoiceItem
from apps.invoices.serializers import InvoiceSerializer, InvoiceListSerializer


class IsClientAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'site_manager', 'accountant')
            and request.user.client_id is not None
        )


class InvoiceListView(APIView):
    """GET /api/invoices/"""
    permission_classes = [IsClientAdmin]

    def get(self, request):
        qs = Invoice.objects.filter(
            client=request.user.client
        ).select_related('order', 'customer').order_by('-created_at')

        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        customer_id = request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(invoice_number__icontains=search)

        try:
            page = max(1, int(request.query_params.get('page',  1)))
            limit = min(
                100, max(1, int(request.query_params.get('limit', 20))))
        except (ValueError, TypeError):
            page, limit = 1, 20

        total = qs.count()
        total_pages = max(1, (total + limit - 1) // limit)
        page = min(page, total_pages)
        offset = (page - 1) * limit

        return Response({
            'data':       InvoiceListSerializer(qs[offset: offset + limit], many=True).data,
            'total':      total,
            'page':       page,
            'limit':      limit,
            'totalPages': total_pages,
        })


class InvoiceDetailView(APIView):
    """GET /api/invoices/{id}/"""
    permission_classes = [IsClientAdmin]

    def get(self, request, pk):
        try:
            invoice = Invoice.objects.select_related(
                'order', 'customer'
            ).prefetch_related('items').get(pk=pk, client=request.user.client)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(InvoiceSerializer(invoice).data)


class InvoiceIssueView(APIView):
    """POST /api/invoices/{id}/issue/ — issue or re-issue"""
    permission_classes = [IsClientAdmin]
    ISSUABLE = {'DRAFT', 'ISSUED', 'OVERDUE'}

    def post(self, request, pk):
        try:
            invoice = Invoice.objects.select_related('customer', 'order').get(
                pk=pk, client=request.user.client)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        if invoice.status not in self.ISSUABLE:
            return Response(
                {'error': f'Cannot issue an invoice with status {invoice.status}.'},
                status=status.HTTP_400_BAD_REQUEST)

        is_first_issue = invoice.status == 'DRAFT'
        if is_first_issue:
            invoice.status = 'ISSUED'
            invoice.issued_at = timezone.now()
            invoice.save(update_fields=['status', 'issued_at'])

        try:
            from apps.notifications.notify import notify_invoice_issued
            notify_invoice_issued(invoice)
        except Exception:
            pass

        return Response({
            'reissued': not is_first_issue,
            'invoice':  InvoiceSerializer(invoice).data,
        })


class InvoiceMarkPaidView(APIView):
    """POST /api/invoices/{id}/mark-paid/"""
    permission_classes = [IsClientAdmin]

    def post(self, request, pk):
        try:
            invoice = Invoice.objects.get(pk=pk, client=request.user.client)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        if invoice.status in ('PAID', 'CANCELLED'):
            return Response(
                {'error': f'Invoice is already {invoice.status}.'},
                status=status.HTTP_400_BAD_REQUEST)

        payment_method = request.data.get('payment_method', 'CASH')
        payment_reference = request.data.get('payment_reference', '')

        invoice.status = 'PAID'
        invoice.amount_paid = invoice.total_amount
        invoice.amount_due = 0
        invoice.paid_at = timezone.now()
        invoice.payment_method = payment_method

        # Build update_fields dynamically — only include payment_reference
        # if the model actually has that field
        update_fields = ['status', 'amount_paid',
                         'amount_due', 'paid_at', 'payment_method']

        has_payment_reference = hasattr(invoice, 'payment_reference') and \
            'payment_reference' in [f.name for f in invoice._meta.get_fields()]

        if has_payment_reference and payment_reference:
            invoice.payment_reference = payment_reference
            update_fields.append('payment_reference')

        invoice.save(update_fields=update_fields)

        # Reduce outstanding_balance on credit orders
        try:
            from decimal import Decimal
            amount = Decimal(str(invoice.total_amount))
            profile = invoice.customer.payment_profile
            profile.outstanding_balance = max(
                0, profile.outstanding_balance - amount)
            profile.save(update_fields=['outstanding_balance', 'updated_at'])
        except Exception:
            pass

        try:
            from decimal import Decimal
            credit_terms = invoice.customer.credit_terms
            credit_terms.outstanding_balance = max(
                0, credit_terms.outstanding_balance - Decimal(str(invoice.total_amount)))
            credit_terms.save(update_fields=['outstanding_balance'])
        except Exception:
            pass

        return Response({
            'message': f'Invoice {invoice.invoice_number} marked as paid.',
            'invoice': InvoiceSerializer(invoice).data,
        })


class CustomerRequestInvoiceView(APIView):
    """POST /api/customer/orders/{order_id}/request-invoice/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, order_id):
        from apps.orders.models import Order

        try:
            order = Order.objects.get(
                pk=order_id, customer=request.user.customer_profile)
        except (Order.DoesNotExist, Exception):
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        invoice = Invoice.objects.filter(order=order).first()
        if not invoice:
            return Response({'error': 'No invoice found for this order.'}, status=status.HTTP_404_NOT_FOUND)

        if invoice.status == 'PAID':
            return Response(
                {'error': 'Invoice is already paid — no re-send needed.'},
                status=status.HTTP_400_BAD_REQUEST)

        try:
            from apps.notifications.notify import notify_invoice_issued
            notify_invoice_issued(invoice)
        except Exception:
            pass

        return Response({
            'message': 'Invoice has been re-sent to your contact details.',
            'invoice_number': invoice.invoice_number,
        })

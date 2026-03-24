"""
Billing Views
apps/billing/views.py
"""

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.models import Subscription, Invoice, InvoiceStatus
from apps.billing.serializers import (
    SubscriptionSerializer,
    InvoiceSerializer,
    BillingStatsSerializer,
    MarkInvoicePaidSerializer,
)
from apps.clients.models import Client, SubscriptionStatus


class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'super_admin'
        )


# ─── Subscriptions ────────────────────────────────────────────────────────────

class SubscriptionListView(generics.ListAPIView):
    """
    GET /api/billing/subscriptions/

    Returns all client subscriptions with payment-due data.
    Sorted by days_until_due ascending so most urgent appear first.
    """

    permission_classes = [IsSuperAdmin]
    serializer_class = SubscriptionSerializer

    def get_queryset(self):
        return (
            Subscription.objects.select_related('client')
            .order_by('current_period_end')
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)

        # Enrich with overdue detection based on client subscription_status
        data = serializer.data
        now = timezone.now().date()
        for item in data:
            # If client is past period_end but still showing 'active' → overdue
            if item.get('nextPaymentDate'):
                from datetime import date
                end_date = item['nextPaymentDate']
                if isinstance(end_date, str):
                    end_date = end_date[:10]  # take date portion
                if end_date < str(now) and item['status'] == 'active':
                    item['status'] = 'overdue'

        return Response(data)


class BillingStatsView(APIView):
    """
    GET /api/billing/subscriptions/stats/
    """

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        now = timezone.now()

        active_qs = Client.objects.filter(
            subscription_status=SubscriptionStatus.ACTIVE)
        trial_qs = Client.objects.filter(
            subscription_status=SubscriptionStatus.TRIAL)
        overdue_qs = Client.objects.filter(
            Q(subscription_status__in=[
                SubscriptionStatus.INACTIVE,
                SubscriptionStatus.EXPIRED,
            ])
            | Q(
                subscription_status=SubscriptionStatus.ACTIVE,
                subscription_expires_at__lt=now,
            )
        )

        active_count = active_qs.count()
        trial_count = trial_qs.count()
        ever_trialled = active_count + trial_count

        # Sum monthly amounts from Subscription records
        active_subs = Subscription.objects.filter(
            client__subscription_status=SubscriptionStatus.ACTIVE
        ).select_related('client')
        monthly_revenue = sum(s.monthly_equivalent for s in active_subs)

        stats = {
            'totalSubscriptions': Client.objects.count(),
            'activeSubscriptions': active_count,
            'trialSubscriptions': trial_count,
            'overdueSubscriptions': overdue_qs.count(),
            'monthlyRevenue': monthly_revenue,
            'annualRevenue': monthly_revenue * 12,
            'trialConversionRate': round(
                (active_count / ever_trialled * 100) if ever_trialled else 0, 1
            ),
        }
        return Response(BillingStatsSerializer(stats).data)


# ─── Invoices ─────────────────────────────────────────────────────────────────

class InvoiceListView(generics.ListAPIView):
    """
    GET /api/billing/invoices/

    Query params:
        client  – filter by client id
        status  – filter by status (pending, paid, overdue, cancelled)
        page    – page number
        limit   – page size (default 20)
    """

    permission_classes = [IsSuperAdmin]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        qs = Invoice.objects.select_related('client', 'subscription')

        client_id = self.request.query_params.get('client')
        if client_id:
            qs = qs.filter(client_id=client_id)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs.order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        try:
            page = max(1, int(request.query_params.get('page', 1)))
            limit = min(
                100, max(1, int(request.query_params.get('limit', 20))))
        except (ValueError, TypeError):
            page, limit = 1, 20

        total = queryset.count()
        total_pages = max(1, (total + limit - 1) // limit)
        offset = (page - 1) * limit

        serializer = self.get_serializer(
            queryset[offset:offset + limit], many=True)
        return Response({
            'data': serializer.data,
            'total': total,
            'page': page,
            'limit': limit,
            'totalPages': total_pages,
        })


class InvoiceDetailView(generics.RetrieveAPIView):
    """
    GET /api/billing/invoices/{id}/
    """

    permission_classes = [IsSuperAdmin]
    queryset = Invoice.objects.select_related('client', 'subscription')
    serializer_class = InvoiceSerializer


class MarkInvoicePaidView(APIView):
    """
    POST /api/billing/invoices/{id}/mark-paid/

    Body: { payment_method: 'mpesa'|'bank'|'cash', payment_reference?: string }
    """

    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        try:
            invoice = Invoice.objects.get(pk=pk)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        if invoice.status == InvoiceStatus.PAID:
            return Response({'error': 'Invoice is already paid.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = MarkInvoicePaidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invoice.mark_paid(
            method=serializer.validated_data['payment_method'],
            reference=serializer.validated_data.get('payment_reference'),
        )

        return Response({
            'message': f'Invoice {invoice.invoice_number} marked as paid.',
            'invoice': InvoiceSerializer(invoice).data,
        })

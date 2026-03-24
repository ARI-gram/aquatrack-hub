# apps/customers/grace_views.py
import logging
from django.db import models
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import serializers, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.customers.authentication import CustomerJWTAuthentication
from apps.customers.invoice_models import (
    CreditTerms,
    GracePeriodRequest,
    GraceRequestStatus,
    CustomerInvoiceStatus,
)
from apps.notifications.models import Notification

logger = logging.getLogger(__name__)


# ── Permissions ───────────────────────────────────────────────────────────────

class IsCustomer(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, 'customer')
        )


class IsClientAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'client_admin'
            and request.user.client_id is not None
        )


# ── Serializers ───────────────────────────────────────────────────────────────

class CreditStatusSerializer(serializers.Serializer):
    credit_enabled = serializers.BooleanField()
    account_frozen = serializers.BooleanField()
    credit_limit = serializers.DecimalField(max_digits=10, decimal_places=2)
    outstanding_balance = serializers.DecimalField(
        max_digits=10, decimal_places=2)
    available_credit = serializers.DecimalField(
        max_digits=10, decimal_places=2)
    billing_cycle = serializers.CharField()
    billing_cycle_display = serializers.CharField()
    is_in_grace_period = serializers.BooleanField()
    grace_days_remaining = serializers.IntegerField(allow_null=True)
    grace_until = serializers.DateField(allow_null=True)
    overdue_since = serializers.DateField(allow_null=True)
    pending_grace_request = serializers.DictField(allow_null=True)


class GraceRequestCreateSerializer(serializers.Serializer):
    requested_days = serializers.IntegerField(min_value=1, max_value=60)
    reason = serializers.CharField(min_length=10, max_length=1000)


class GraceRequestSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(
        source='credit_terms.customer.full_name', read_only=True)
    customer_phone = serializers.CharField(
        source='credit_terms.customer.phone_number', read_only=True)
    status_display = serializers.CharField(
        source='get_status_display', read_only=True)
    grace_until_current = serializers.DateField(
        source='credit_terms.grace_until', read_only=True)
    account_frozen = serializers.BooleanField(
        source='credit_terms.account_frozen', read_only=True)

    class Meta:
        model = GracePeriodRequest
        fields = [
            'id', 'customer_name', 'customer_phone',
            'requested_days', 'reason',
            'status', 'status_display',
            'admin_note', 'days_granted',
            'grace_until_current', 'account_frozen',
            'reviewed_by_id', 'reviewed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields


class ReviewGraceRequestSerializer(serializers.Serializer):
    days_granted = serializers.IntegerField(
        min_value=1, max_value=90, required=False)
    admin_note = serializers.CharField(
        required=False, allow_blank=True, default='')


# ── Helpers ───────────────────────────────────────────────────────────────────

def _notify_customer(customer, title: str, message: str, notification_type: str = 'ACCOUNT_UPDATE') -> None:
    try:
        Notification.objects.create(
            customer=customer,
            notification_type=notification_type,
            title=title,
            message=message,
            priority='HIGH',
            send_push=True,
        )
    except Exception as exc:
        logger.error("Failed to create customer notification: %s", exc)


def _notify_super_admin(subject: str, message: str) -> None:
    try:
        from apps.authentication.models import User
        super_admins = User.objects.filter(role='super_admin', is_active=True)
        emails = list(super_admins.values_list(
            'email', flat=True).exclude(email=''))
        if emails:
            send_mail(subject=subject, message=message,
                      from_email=settings.DEFAULT_FROM_EMAIL,
                      recipient_list=emails, fail_silently=True)
    except Exception as exc:
        logger.error("Failed to notify super admin: %s", exc)


def _notify_admin_of_request(request_obj: GracePeriodRequest) -> None:
    try:
        from apps.authentication.models import User
        client = request_obj.credit_terms.customer.client
        admins = User.objects.filter(
            role='client_admin', client=client, is_active=True
        ).exclude(email='')
        emails = list(admins.values_list('email', flat=True))
        if emails:
            customer = request_obj.credit_terms.customer
            send_mail(
                subject=f"Grace period request from {customer.full_name}",
                message=(
                    f"{customer.full_name} ({customer.phone_number}) has requested "
                    f"a {request_obj.requested_days}-day grace period extension.\n\n"
                    f"Reason: {request_obj.reason}\n\n"
                    f"Please log in to review and approve or deny this request."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=emails,
                fail_silently=True,
            )
    except Exception as exc:
        logger.error("Failed to notify admin of grace request: %s", exc)


# ── Customer: Credit Status ───────────────────────────────────────────────────

class CustomerCreditStatusView(APIView):
    """GET /api/customer/credit/status/"""
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsCustomer]

    def get(self, request):
        customer = request.user.customer

        try:
            profile = customer.payment_profile
        except Exception:
            return Response({'credit_enabled': False})

        if not profile.credit_account_enabled:
            return Response({'credit_enabled': False})

        try:
            terms = customer.credit_terms
        except CreditTerms.DoesNotExist:
            return Response({'credit_enabled': False})

        pending_req = terms.grace_requests.filter(
            status=GraceRequestStatus.PENDING
        ).order_by('-created_at').first()

        pending_data = None
        if pending_req:
            pending_data = {
                'id':             str(pending_req.id),
                'requested_days': pending_req.requested_days,
                'reason':         pending_req.reason,
                'created_at':     pending_req.created_at.isoformat(),
            }

        data = {
            'credit_enabled':        True,
            'account_frozen':        terms.account_frozen,
            'credit_limit':          terms.credit_limit,
            'outstanding_balance':   terms.outstanding_balance,
            'available_credit':      terms.available_credit,
            'billing_cycle':         terms.billing_cycle,
            'billing_cycle_display': terms.get_billing_cycle_display(),
            'is_in_grace_period':    terms.is_in_grace_period,
            'grace_days_remaining':  terms.grace_days_remaining,
            'grace_until':           terms.grace_until,
            'overdue_since':         terms.overdue_since,
            'pending_grace_request': pending_data,
        }

        return Response(CreditStatusSerializer(data).data)


# ── Customer: Submit Grace Request ────────────────────────────────────────────

class CustomerGraceRequestView(APIView):
    """
    GET  /api/customer/credit/grace-request/
    POST /api/customer/credit/grace-request/
    """
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsCustomer]

    def get(self, request):
        customer = request.user.customer
        try:
            terms = customer.credit_terms
        except CreditTerms.DoesNotExist:
            return Response({'error': 'No credit account found.'}, status=404)

        latest = terms.grace_requests.order_by('-created_at').first()
        if not latest:
            return Response({'message': 'No grace requests found.'}, status=404)

        return Response(GraceRequestSerializer(latest).data)

    def post(self, request):
        customer = request.user.customer

        try:
            profile = customer.payment_profile
            if not profile.credit_account_enabled:
                return Response({'error': 'You do not have a credit account.'}, status=400)
        except Exception:
            return Response({'error': 'No payment profile found.'}, status=400)

        try:
            terms = customer.credit_terms
        except CreditTerms.DoesNotExist:
            return Response({'error': 'No credit terms found.'}, status=400)

        has_overdue = customer.customer_invoices.filter(
            status__in=[CustomerInvoiceStatus.ISSUED,
                        CustomerInvoiceStatus.OVERDUE]
        ).exists()
        if not has_overdue:
            return Response(
                {'error': 'No outstanding invoices. Grace period is not needed.'},
                status=400,
            )

        already_pending = terms.grace_requests.filter(
            status=GraceRequestStatus.PENDING).exists()
        if already_pending:
            return Response(
                {'error': 'You already have a pending grace period request.'},
                status=400,
            )

        s = GraceRequestCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        grace_req = GracePeriodRequest.objects.create(
            credit_terms=terms,
            requested_days=s.validated_data['requested_days'],
            reason=s.validated_data['reason'],
        )
        _notify_admin_of_request(grace_req)

        return Response(
            {
                'message': 'Your request has been submitted. The office will review it shortly.',
                'request': GraceRequestSerializer(grace_req).data,
            },
            status=201,
        )


# ── Admin: List / Approve / Deny Grace Requests ───────────────────────────────
# These use the standard staff JWT — no authentication_classes override needed.

class AdminGraceRequestListView(APIView):
    """GET /api/customers/grace-requests/"""
    permission_classes = [IsClientAdmin]

    def get(self, request):
        qs = GracePeriodRequest.objects.filter(
            credit_terms__customer__client=request.user.client
        ).select_related('credit_terms__customer')

        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        else:
            qs = qs.order_by(
                models.Case(
                    models.When(status='PENDING', then=0),
                    default=1,
                    output_field=models.IntegerField(),
                ),
                '-created_at',
            )

        return Response(GraceRequestSerializer(qs, many=True).data)


class ApproveGraceRequestView(APIView):
    """POST /api/customers/grace-requests/{id}/approve/"""
    permission_classes = [IsClientAdmin]

    def post(self, request, pk):
        try:
            grace_req = GracePeriodRequest.objects.select_related(
                'credit_terms__customer'
            ).get(pk=pk, credit_terms__customer__client=request.user.client)
        except GracePeriodRequest.DoesNotExist:
            return Response({'error': 'Request not found.'}, status=404)

        if grace_req.status != GraceRequestStatus.PENDING:
            return Response(
                {'error': f'Request has already been {grace_req.status.lower()}.'},
                status=400,
            )

        s = ReviewGraceRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        days = s.validated_data.get('days_granted') or grace_req.requested_days
        note = s.validated_data.get('admin_note', '')

        grace_req.status = GraceRequestStatus.APPROVED
        grace_req.days_granted = days
        grace_req.admin_note = note
        grace_req.reviewed_by = request.user
        grace_req.reviewed_at = timezone.now()
        grace_req.save()

        grace_req.credit_terms.extend_grace_period(days)
        customer = grace_req.credit_terms.customer

        _notify_customer(
            customer,
            title='Grace Period Approved',
            message=(
                f"You have been granted {days} additional days "
                f"(until {grace_req.credit_terms.grace_until})."
                + (f"\n\nNote: {note}" if note else '')
            ),
        )

        grace_req.credit_terms.extend_grace_period(days)

        _notify_super_admin(
            subject=f"Grace period approved — {customer.full_name}",
            message=(
                f"Admin {request.user.get_full_name() or request.user.email} "
                f"approved a {days}-day grace period for {customer.full_name}.\n"
                f"Outstanding: KES {grace_req.credit_terms.outstanding_balance:,.2f}\n"
                f"New deadline: {grace_req.credit_terms.grace_until}"
                + (f"\nNote: {note}" if note else '')
            ),
        )

        return Response({
            'message': f'Grace period extended by {days} days.',
            'request': GraceRequestSerializer(grace_req).data,
        })


class DenyGraceRequestView(APIView):
    """POST /api/customers/grace-requests/{id}/deny/"""
    permission_classes = [IsClientAdmin]

    def post(self, request, pk):
        try:
            grace_req = GracePeriodRequest.objects.select_related(
                'credit_terms__customer'
            ).get(pk=pk, credit_terms__customer__client=request.user.client)
        except GracePeriodRequest.DoesNotExist:
            return Response({'error': 'Request not found.'}, status=404)

        if grace_req.status != GraceRequestStatus.PENDING:
            return Response(
                {'error': f'Request has already been {grace_req.status.lower()}.'},
                status=400,
            )

        note = request.data.get('admin_note', '')
        grace_req.status = GraceRequestStatus.DENIED
        grace_req.admin_note = note
        grace_req.reviewed_by = request.user
        grace_req.reviewed_at = timezone.now()
        grace_req.save()

        customer = grace_req.credit_terms.customer

        _notify_customer(
            customer,
            title='Grace Period Request Declined',
            message=(
                "Your request was not approved. Please contact your distributor."
                + (f"\n\nNote: {note}" if note else '')
            ),
        )
        _notify_super_admin(
            subject=f"Grace period denied — {customer.full_name}",
            message=(
                f"Admin {request.user.get_full_name() or request.user.email} "
                f"denied the grace request from {customer.full_name}.\n"
                f"Outstanding: KES {grace_req.credit_terms.outstanding_balance:,.2f}"
                + (f"\nNote: {note}" if note else '')
            ),
        )

        return Response({
            'message': 'Grace period request denied.',
            'request': GraceRequestSerializer(grace_req).data,
        })

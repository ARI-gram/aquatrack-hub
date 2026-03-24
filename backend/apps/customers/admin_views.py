"""
Customer Admin Views
apps/customers/admin_views.py

Endpoints for Client Admins to create and manage their customers.
Customers belong to a specific client — a client admin can only manage
their own company's customers.

Routes mounted under /api/customers/ in the main urls.py:
  GET    /api/customers/                  list this client's customers
  POST   /api/customers/                  create customer + send invite email
  GET    /api/customers/{id}/             retrieve customer
  PUT    /api/customers/{id}/             update customer info
  PATCH  /api/customers/{id}/             partial update
  POST   /api/customers/{id}/resend-invite/  resend (or regenerate) invite email
  POST   /api/customers/{id}/block/       block customer
  POST   /api/customers/{id}/unblock/     unblock customer

Invite resolution (used by the frontend join page — no auth required):
  GET    /api/customers/invite/{token}/   resolve invite token → customer info
  POST   /api/customers/invite/{token}/complete/  mark invite as used after registration

Permission notes:
  IsClientAdmin                      → client_admin + site_manager (full access)
  IsClientAdminOrAccountantReadOnly  → above + accountant (GET only)
    Used on CustomerListCreateView so accountants can browse customers
    for payment recording but cannot create new ones.
"""

import logging
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.customers.models import Customer, CustomerInvite
from apps.customers.admin_serializers import (
    CustomerAdminCreateSerializer,
    CustomerAdminSerializer,
    CustomerAdminUpdateSerializer,
)

logger = logging.getLogger(__name__)

INVITE_EXPIRY_DAYS = 7


# ─── Permissions ──────────────────────────────────────────────────────────────

class IsClientAdmin(permissions.BasePermission):
    """Full access: client_admin and site_manager only."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'site_manager')
            and request.user.client_id is not None
        )


class IsClientAdminOrAccountantReadOnly(permissions.BasePermission):
    """
    client_admin / site_manager  → full access (GET + POST + PATCH etc.)
    accountant                   → read-only (GET, HEAD, OPTIONS only)

    Used on CustomerListCreateView so accountants can see the customer
    list for payment recording but cannot create new customers.
    """

    def has_permission(self, request, view):
        if not (
            request.user
            and request.user.is_authenticated
            and request.user.client_id is not None
        ):
            return False

        role = request.user.role

        if role in ('client_admin', 'site_manager'):
            return True

        if role == 'accountant':
            return request.method in ('GET', 'HEAD', 'OPTIONS')

        return False


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _send_invite_email(customer, invite, company_name, frontend_url):
    """Send the customer invite email (fire-and-forget)."""
    from django.core.mail import EmailMultiAlternatives
    from django.conf import settings
    from apps.customers.email_templates import get_customer_invite_email

    invite_url = f"{frontend_url}/join/{invite.token}"

    subject, html = get_customer_invite_email(
        full_name=customer.full_name,
        company_name=company_name,
        invite_url=invite_url,
        phone_number=customer.phone_number,
    )

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=(
                f"Hi {customer.full_name},\n\n"
                f"{company_name} has set up a water delivery account for you.\n"
                f"Complete your account here: {invite_url}\n\n"
                f"Your login phone: {customer.phone_number}\n"
                f"This link expires in {INVITE_EXPIRY_DAYS} days."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[customer.email],
        )
        msg.attach_alternative(html, "text/html")
        msg.send()
        logger.info("Invite email sent to %s", customer.email)
    except Exception as exc:
        logger.error("Failed to send invite email to %s: %s",
                     customer.email, exc)


# ─── List + Create ────────────────────────────────────────────────────────────

class CustomerListCreateView(APIView):
    """
    GET  /api/customers/  – paginated list of the client's customers
    POST /api/customers/  – create customer and send invite email

    GET query params:
        search      – filter by name / phone / email
        status      – ACTIVE | SUSPENDED | BLOCKED
        type        – REFILL | ONETIME | HYBRID
        registered  – true | false  (filter by registration state)
        page        – page number (default 1)
        limit       – page size (default 20, max 100)

    POST response (201):
    {
        "customer": { ...CustomerAdminSerializer... },
        "invite_url": "https://app.aquatrack.co.ke/join/<token>"
    }

    Permission: accountants can GET but not POST.
    """

    permission_classes = [IsClientAdminOrAccountantReadOnly]

    def get(self, request):
        client = request.user.client
        qs = Customer.objects.filter(client=client)

        # Search
        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(full_name__icontains=search)
                | Q(phone_number__icontains=search)
                | Q(email__icontains=search)
            )

        # Filters
        cust_status = request.query_params.get('status')
        if cust_status:
            qs = qs.filter(status=cust_status.upper())

        cust_type = request.query_params.get('type')
        if cust_type:
            qs = qs.filter(customer_type=cust_type.upper())

        registered = request.query_params.get('registered')
        if registered == 'true':
            qs = qs.filter(is_registered=True)
        elif registered == 'false':
            qs = qs.filter(is_registered=False)

        qs = qs.order_by('-created_at')

        # Pagination
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

        serializer = CustomerAdminSerializer(
            qs[offset: offset + limit], many=True)

        return Response({
            'data':       serializer.data,
            'total':      total,
            'page':       page,
            'limit':      limit,
            'totalPages': total_pages,
        })

    def post(self, request):
        from django.conf import settings

        client = request.user.client
        serializer = CustomerAdminCreateSerializer(
            data=request.data,
            context={'client': client},
        )
        serializer.is_valid(raise_exception=True)
        customer = serializer.save()
        invite = serializer._invite

        frontend_url = getattr(settings, 'FRONTEND_URL',
                               'http://localhost:5173')
        invite_url = f"{frontend_url}/join/{invite.token}"

        _send_invite_email(customer, invite, client.name, frontend_url)

        return Response(
            {
                'customer':   CustomerAdminSerializer(customer).data,
                'invite_url': invite_url,
            },
            status=status.HTTP_201_CREATED,
        )


# ─── Retrieve / Update ────────────────────────────────────────────────────────

class CustomerDetailView(APIView):
    """
    GET   /api/customers/{id}/   retrieve
    PUT   /api/customers/{id}/   full update
    PATCH /api/customers/{id}/   partial update
    """

    permission_classes = [IsClientAdmin]

    def _get_customer(self, request, pk):
        try:
            return Customer.objects.get(pk=pk, client=request.user.client)
        except Customer.DoesNotExist:
            return None

    def get(self, request, pk):
        customer = self._get_customer(request, pk)
        if customer is None:
            return Response(
                {'error': 'Customer not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(CustomerAdminSerializer(customer).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial):
        customer = self._get_customer(request, pk)
        if customer is None:
            return Response(
                {'error': 'Customer not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CustomerAdminUpdateSerializer(
            customer, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CustomerAdminSerializer(customer).data)


# ─── Block / Unblock ──────────────────────────────────────────────────────────

class CustomerBlockView(APIView):
    """POST /api/customers/{id}/block/"""
    permission_classes = [IsClientAdmin]

    def post(self, request, pk):
        try:
            customer = Customer.objects.get(pk=pk, client=request.user.client)
        except Customer.DoesNotExist:
            return Response(
                {'error': 'Customer not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        customer.status = 'BLOCKED'
        customer.save(update_fields=['status'])
        return Response({
            'message':  f'{customer.full_name} has been blocked.',
            'customer': CustomerAdminSerializer(customer).data,
        })


class CustomerUnblockView(APIView):
    """POST /api/customers/{id}/unblock/"""
    permission_classes = [IsClientAdmin]

    def post(self, request, pk):
        try:
            customer = Customer.objects.get(pk=pk, client=request.user.client)
        except Customer.DoesNotExist:
            return Response(
                {'error': 'Customer not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        customer.status = 'ACTIVE'
        customer.save(update_fields=['status'])
        return Response({
            'message':  f'{customer.full_name} has been unblocked.',
            'customer': CustomerAdminSerializer(customer).data,
        })


# ─── Resend Invite ────────────────────────────────────────────────────────────

class CustomerResendInviteView(APIView):
    """
    POST /api/customers/{id}/resend-invite/

    Invalidates any existing pending invites, generates a fresh one,
    and re-sends the invite email to the customer.
    """

    permission_classes = [IsClientAdmin]

    def post(self, request, pk):
        from django.conf import settings

        try:
            customer = Customer.objects.get(pk=pk, client=request.user.client)
        except Customer.DoesNotExist:
            return Response(
                {'error': 'Customer not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not customer.email:
            return Response(
                {'error': 'This customer has no email address to send an invite to.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if customer.is_registered:
            return Response(
                {'error': 'This customer has already completed registration.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Expire existing pending invites
        CustomerInvite.objects.filter(
            customer=customer, is_used=False
        ).update(expires_at=timezone.now())

        # Create new invite
        invite = CustomerInvite.objects.create(
            customer=customer,
            expires_at=timezone.now() + timedelta(days=INVITE_EXPIRY_DAYS),
        )

        frontend_url = getattr(settings, 'FRONTEND_URL',
                               'http://localhost:5173')
        invite_url = f"{frontend_url}/join/{invite.token}"

        _send_invite_email(
            customer, invite, request.user.client.name, frontend_url)

        return Response({
            'message':    f'Invite resent to {customer.email}.',
            'invite_url': invite_url,
        })


# ─── Invite Resolution (public — no auth) ────────────────────────────────────

class InviteResolveView(APIView):
    """
    GET /api/customers/invite/{token}/

    Called by the frontend join page to resolve an invite token and
    get the customer info needed to pre-fill the registration form.

    No authentication required — the token is the credential.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            invite = CustomerInvite.objects.select_related(
                'customer__client'
            ).get(token=token)
        except CustomerInvite.DoesNotExist:
            return Response(
                {'error': 'Invalid invite link.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invite.is_used:
            return Response(
                {'error': 'This invite has already been used.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if invite.is_expired:
            return Response(
                {'error': 'This invite link has expired. Please contact your distributor.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        customer = invite.customer
        return Response({
            'customer_id':  str(customer.id),
            'full_name':    customer.full_name,
            'phone_number': customer.phone_number,
            'email':        customer.email,
            'company_name': customer.client.name,
            'company_id':   str(customer.client.id),
            'invite_token': token,
        })


class InviteCompleteView(APIView):
    """
    POST /api/customers/invite/{token}/complete/

    Called after the customer successfully verifies their phone via OTP.
    Marks the invite as used and sets is_registered=True on the customer.

    No authentication required — the token + OTP verification is the credential.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request, token):
        from apps.customers.models import CustomerOTP

        try:
            invite = CustomerInvite.objects.select_related(
                'customer').get(token=token)
        except CustomerInvite.DoesNotExist:
            return Response(
                {'error': 'Invalid invite link.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if invite.is_used or invite.is_expired:
            return Response(
                {'error': 'This invite is no longer valid.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        phone_number = request.data.get('phone_number')
        otp_code = request.data.get('otp_code')

        if not phone_number or not otp_code:
            return Response(
                {'error': 'phone_number and otp_code are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        customer = invite.customer
        if customer.phone_number != phone_number:
            return Response(
                {'error': 'Phone number does not match this invite.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify OTP
        try:
            otp = CustomerOTP.objects.filter(
                phone_number=phone_number,
                is_verified=False,
                expires_at__gt=timezone.now(),
            ).latest('created_at')
        except CustomerOTP.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired OTP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp.otp_code != otp_code:
            return Response(
                {'error': 'Incorrect OTP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp.is_verified = True
        otp.save(update_fields=['is_verified'])

        invite.mark_used()
        customer.is_registered = True
        customer.is_phone_verified = True
        customer.phone_verified_at = timezone.now()
        customer.save(update_fields=[
            'is_registered', 'is_phone_verified', 'phone_verified_at', 'status',
        ])

        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken()
        refresh['customer_id'] = str(customer.id)
        refresh['phone'] = customer.phone_number

        return Response({
            'message':  'Registration complete.',
            'customer': CustomerAdminSerializer(customer).data,
            'tokens': {
                'access':  str(refresh.access_token),
                'refresh': str(refresh),
            },
        })


# ─── Soft Delete (Recycle Bin) ────────────────────────────────────────────────

class CustomerSoftDeleteView(APIView):
    """POST /api/customers/{id}/soft-delete/"""

    permission_classes = [IsClientAdmin]

    def post(self, request, pk):
        try:
            customer = Customer.objects.get(pk=pk, client=request.user.client)
        except Customer.DoesNotExist:
            return Response(
                {'error': 'Customer not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        reason = (request.data.get('reason') or '').strip()
        if len(reason) < 5:
            return Response(
                {'error': 'A reason of at least 5 characters is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        customer.status = 'SUSPENDED'
        customer.save(update_fields=['status', 'updated_at'])

        CustomerInvite.objects.filter(
            customer=customer, is_used=False
        ).update(expires_at=timezone.now())

        logger.info(
            "Customer %s soft-deleted by %s. Reason: %s",
            customer.id, request.user.id, reason,
        )

        return Response({
            'message':     f'{customer.full_name} has been moved to the recycle bin.',
            'customer_id': str(customer.id),
        })


# ─── Permanent Delete ─────────────────────────────────────────────────────────

class CustomerPermanentDeleteView(APIView):
    """DELETE /api/customers/{id}/ — irreversible, audit-logged."""

    permission_classes = [IsClientAdmin]

    def delete(self, request, pk):
        try:
            customer = Customer.objects.get(pk=pk, client=request.user.client)
        except Customer.DoesNotExist:
            return Response(
                {'error': 'Customer not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        reason = (request.data.get('reason') or '').strip()
        if len(reason) < 5:
            return Response(
                {'error': 'A reason of at least 5 characters is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        customer_name = customer.full_name
        customer_id = str(customer.id)

        logger.warning(
            "PERMANENT DELETE: Customer %s (%s) deleted by admin %s (client %s). Reason: %s",
            customer_id, customer_name,
            request.user.id, request.user.client_id,
            reason,
        )

        customer.delete()

        return Response({
            'message':     f'{customer_name} has been permanently deleted.',
            'customer_id': customer_id,
        })

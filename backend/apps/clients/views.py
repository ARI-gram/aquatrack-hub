"""
Client Views
apps/clients/views.py

All list endpoints return paginated JSON matching the TypeScript
PaginatedClientsResponse interface:
  { data: Client[], total, page, limit, totalPages }

Key change: ClientListCreateView.create() now returns:
  {
    "client": { ...camelCase client fields... },
    "user":   { "id", "email", "firstName", "role" },
    "temporary_password": "Xk9mP2qR7"
  }
so the frontend CredentialsDialog can display and copy the credentials.
"""

from django.db.models import Q
from django.utils import timezone
from rest_framework import status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.clients.models import Client, SubscriptionStatus
from apps.clients.serializers import (
    ClientSerializer,
    ClientCreateSerializer,
    ClientUpdateSerializer,
    ClientListSerializer,
    ClientStatsSerializer,
)
from apps.authentication.models import User


# ─── Permissions ──────────────────────────────────────────────────────────────

class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'super_admin'
        )


# ─── List / Create ────────────────────────────────────────────────────────────

class ClientListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/clients/  – paginated list of all clients
    POST /api/clients/  – create a new client

    POST response shape (201):
    {
        "client": { ...ClientSerializer fields... },
        "user": {
            "id":        "uuid",
            "email":     "admin@company.co.ke",
            "firstName": "Admin",
            "lastName":  "Pure Water",
            "role":      "client_admin"
        },
        "temporary_password": "Xk9mP2qR7abc"
    }

    Query params for GET:
        search   – filter by name / email / phone
        status   – filter by subscription_status
        page     – page number (default 1)
        limit    – page size (default 20, max 100)
    """

    permission_classes = [IsSuperAdmin]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ClientCreateSerializer
        return ClientListSerializer

    def get_queryset(self):
        qs = Client.objects.all()

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
            )

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(subscription_status=status_filter)

        return qs.order_by('-created_at')

    def list(self, request, *args, **kwargs):
        """Return paginated response in the shape the frontend expects."""
        queryset = self.get_queryset()

        try:
            page = max(1, int(request.query_params.get('page', 1)))
            limit = min(
                100, max(1, int(request.query_params.get('limit', 20))))
        except (ValueError, TypeError):
            page, limit = 1, 20

        total = queryset.count()
        total_pages = max(1, (total + limit - 1) // limit)
        page = min(page, total_pages)
        offset = (page - 1) * limit

        page_qs = queryset[offset: offset + limit]
        serializer = self.get_serializer(page_qs, many=True)

        return Response({
            'data':       serializer.data,
            'total':      total,
            'page':       page,
            'limit':      limit,
            'totalPages': total_pages,
        })

    def create(self, request, *args, **kwargs):
        """
        Create a client, auto-create its admin user, and return credentials.

        The serializer stores the generated password on self._temp_password
        and the created user on self._admin_user after save(), so we can
        include them here without a second DB query.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # save() triggers ClientCreateSerializer.create() which:
        #   1. Creates the Client row
        #   2. Creates the admin User row with a temp password
        #   3. Sends the welcome email
        #   4. Stores self._temp_password and self._admin_user
        client = serializer.save()

        # Pull the generated credentials from the serializer instance
        admin_user = serializer._admin_user
        temp_password = serializer._temp_password

        return Response(
            {
                # Full client data in camelCase
                'client': ClientSerializer(client).data,

                # Minimal user info the frontend needs for the dialog
                'user': {
                    'id':        str(admin_user.id),
                    'email':     admin_user.email,
                    'firstName': admin_user.first_name,
                    'lastName':  admin_user.last_name,
                    'role':      admin_user.role,
                },

                # The generated temp password — only returned once, never stored
                'temporary_password': temp_password,
            },
            status=status.HTTP_201_CREATED,
        )


# ─── Detail / Update / Delete ─────────────────────────────────────────────────

# apps/clients/views.py

class IsClientAdminOrSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('super_admin', 'client_admin')
        )

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'super_admin':
            return True
        # Client admin can only access their own client
        return str(obj.id) == str(request.user.client_id)


class ClientDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsClientAdminOrSuperAdmin]  # ← updated
    queryset = Client.objects.all()

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return ClientUpdateSerializer
        return ClientSerializer

    def destroy(self, request, *args, **kwargs):
        # Only super admins can delete
        if request.user.role != 'super_admin':
            return Response(
                {'error': 'Permission denied.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance = self.get_object()
        instance.subscription_status = SubscriptionStatus.CANCELLED
        instance.save(update_fields=['subscription_status', 'updated_at'])
        return Response(
            {'message': 'Client account cancelled successfully.'},
            status=status.HTTP_200_OK,
        )

# ─── Suspend ──────────────────────────────────────────────────────────────────


class ClientSuspendView(APIView):
    """
    POST /api/clients/{pk}/suspend/
    Sets subscription_status → inactive immediately.
    """

    permission_classes = [IsSuperAdmin]

    def post(self, request, pk, *args, **kwargs):
        try:
            client = Client.objects.get(pk=pk)
        except Client.DoesNotExist:
            return Response(
                {'error': 'Client not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        client.subscription_status = SubscriptionStatus.INACTIVE
        client.save(update_fields=['subscription_status', 'updated_at'])

        return Response(
            {
                'message': f'Client "{client.name}" has been suspended.',
                'client':  ClientSerializer(client).data,
            },
            status=status.HTTP_200_OK,
        )


# ─── Stats ────────────────────────────────────────────────────────────────────

class ClientStatsView(generics.RetrieveAPIView):
    """
    GET /api/clients/{id}/stats/
    """

    permission_classes = [IsSuperAdmin]
    queryset = Client.objects.all()

    def retrieve(self, request, *args, **kwargs):
        client = self.get_object()

        try:
            total_orders = client.orders.count()
        except Exception:
            total_orders = 0

        try:
            total_deliveries = client.deliveries.filter(
                status='completed').count()
        except Exception:
            total_deliveries = 0

        try:
            total_customers = client.customers.count()
        except Exception:
            total_customers = 0

        total_employees = client.users.filter(is_active=True).count()

        try:
            from django.db.models import Sum
            monthly_revenue = (
                client.orders.filter(
                    created_at__month=timezone.now().month,
                    created_at__year=timezone.now().year,
                    status='completed',
                ).aggregate(total=Sum('total_amount'))['total'] or 0
            )
        except Exception:
            monthly_revenue = 0

        try:
            from django.db.models import Sum
            outstanding_payments = (
                client.invoices.filter(status='unpaid')
                .aggregate(total=Sum('amount'))['total'] or 0
            )
        except Exception:
            outstanding_payments = 0

        stats = {
            'totalOrders':         total_orders,
            'totalDeliveries':     total_deliveries,
            'totalCustomers':      total_customers,
            'totalEmployees':      total_employees,
            'monthlyRevenue':      float(monthly_revenue),
            'outstandingPayments': float(outstanding_payments),
        }

        return Response(ClientStatsSerializer(stats).data)


# ─── Employees ────────────────────────────────────────────────────────────────

class ClientEmployeesView(generics.ListAPIView):
    """GET /api/clients/{id}/employees/"""

    permission_classes = [IsSuperAdmin]

    def list(self, request, *args, **kwargs):
        from apps.authentication.serializers import UserSerializer

        client_id = self.kwargs.get('pk')
        try:
            client = Client.objects.get(pk=client_id)
        except Client.DoesNotExist:
            return Response(
                {'error': 'Client not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        employees = client.users.filter(is_active=True)
        serializer = UserSerializer(employees, many=True)
        return Response(serializer.data)


class ClientResetCredentialsView(APIView):
    """
    POST /api/clients/{pk}/reset-credentials/
    Generates a new temporary password for the client's admin user,
    emails it to them, and returns the credentials for the UI dialog.
    """
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk, *args, **kwargs):
        try:
            client = Client.objects.get(pk=pk)
        except Client.DoesNotExist:
            return Response(
                {'error': 'Client not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get the client's admin user
        try:
            admin_user = client.users.get(role='client_admin', is_active=True)
        except User.DoesNotExist:
            return Response(
                {'error': 'No active admin user found for this client.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Generate a new temporary password
        from django.utils.crypto import get_random_string
        temp_password = get_random_string(
            length=12,
            allowed_chars='abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
        )

        # Update the user's password
        admin_user.set_password(temp_password)
        admin_user.save(update_fields=['password'])

        # Send the email
        self._send_reset_email(client, admin_user, temp_password)

        return Response(
            {
                'user': {
                    'id':        str(admin_user.id),
                    'email':     admin_user.email,
                    'firstName': admin_user.first_name,
                    'lastName':  admin_user.last_name,
                    'role':      admin_user.role,
                },
                'temporary_password': temp_password,
            },
            status=status.HTTP_200_OK,
        )

    def _send_reset_email(self, client, admin_user, temp_password):
        from django.core.mail import EmailMultiAlternatives
        from django.conf import settings
        from apps.clients.email_templates import get_password_reset_email
        import logging

        frontend_url = getattr(settings, 'FRONTEND_URL',
                               'http://localhost:5173')
        subject, html = get_password_reset_email(
            first_name=admin_user.first_name,
            email=admin_user.email,
            temp_password=temp_password,
            frontend_url=frontend_url,
        )

        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=f"Your password has been reset.\n\nEmail: {admin_user.email}\nPassword: {temp_password}\n\nLogin: {frontend_url}/login",
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[admin_user.email],
            )
            msg.attach_alternative(html, "text/html")
            msg.send()
        except Exception as exc:
            logging.getLogger(__name__).error(
                "Failed to send reset email to %s: %s", admin_user.email, exc)

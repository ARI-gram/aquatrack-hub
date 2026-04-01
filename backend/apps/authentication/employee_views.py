"""
apps/authentication/employee_views.py

Endpoints for Client Admins to manage their employees.
Roles: site_manager, driver, accountant

All endpoints are scoped to the requesting user's client.

Routes (mounted under /api/auth/employees/):
  GET    /api/auth/employees/                    list
  POST   /api/auth/employees/                    create + send credentials
  GET    /api/auth/employees/{id}/               retrieve
  PUT    /api/auth/employees/{id}/               full update
  PATCH  /api/auth/employees/{id}/               partial update
  POST   /api/auth/employees/{id}/deactivate/    soft-deactivate
  POST   /api/auth/employees/{id}/reactivate/    reactivate
  POST   /api/auth/employees/{id}/reset-password/ reset + email credentials
"""

import logging
from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import User
from apps.authentication.employee_serializers import (
    EmployeeSerializer,
    EmployeeCreateSerializer,
    EmployeeUpdateSerializer,
    EMPLOYEE_ROLES,
)

logger = logging.getLogger(__name__)


# ─── Permissions ──────────────────────────────────────────────────────────────

class IsClientAdmin(permissions.BasePermission):
    """client_admin has full access; site_manager gets read-only."""

    ADMIN_ROLES = ('client_admin',)
    READONLY_ROLES = ('site_manager',)

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.client_id):
            return False

        role = request.user.role

        if role in self.ADMIN_ROLES:
            return True

        # site_manager may read but not write
        if role in self.READONLY_ROLES:
            return request.method in permissions.SAFE_METHODS  # GET, HEAD, OPTIONS

        return False

# ─── Helpers ──────────────────────────────────────────────────────────────────


def _get_employee_queryset(client):
    """Return all employee roles belonging to the given client."""
    return User.objects.filter(
        client=client,
        role__in=EMPLOYEE_ROLES,
    )


def _send_employee_welcome(employee, temp_password, client, frontend_url):
    """Fire-and-forget welcome email to a new employee."""
    from django.core.mail import EmailMultiAlternatives
    from django.conf import settings
    from apps.authentication.employee_email_templates import get_employee_welcome_email

    role_display = employee.get_role_display()
    subject, html = get_employee_welcome_email(
        first_name=employee.first_name,
        email=employee.email,
        temp_password=temp_password,
        company_name=client.name,
        role_display=role_display,
        frontend_url=frontend_url,
    )

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=(
                f"Welcome to {client.name} on AquaTrack!\n\n"
                f"Email: {employee.email}\n"
                f"Password: {temp_password}\n\n"
                f"Login: {frontend_url}/login"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[employee.email],
        )
        msg.attach_alternative(html, "text/html")
        msg.send()
    except Exception as exc:
        logger.error(
            "Failed to send welcome email to %s: %s", employee.email, exc
        )


def _send_employee_password_reset(employee, temp_password, client, frontend_url):
    """Send a password-reset email to an existing employee."""
    from django.core.mail import EmailMultiAlternatives
    from django.conf import settings
    from apps.clients.email_templates import get_password_reset_email

    subject, html = get_password_reset_email(
        first_name=employee.first_name,
        email=employee.email,
        temp_password=temp_password,
        frontend_url=frontend_url,
    )

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=(
                f"Your AquaTrack password has been reset.\n\n"
                f"Email: {employee.email}\n"
                f"Password: {temp_password}\n\n"
                f"Login: {frontend_url}/login"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[employee.email],
        )
        msg.attach_alternative(html, "text/html")
        msg.send()
    except Exception as exc:
        logger.error(
            "Failed to send password reset email to %s: %s", employee.email, exc
        )


# ─── List + Create ────────────────────────────────────────────────────────────

class EmployeeListCreateView(generics.GenericAPIView):
    """
    GET  /api/auth/employees/  – paginated list of the client's employees
    POST /api/auth/employees/  – create employee and return credentials

    GET query params:
        search  – filter by name / email
        role    – filter by 'site_manager' | 'driver' | 'accountant'
        status  – 'active' | 'inactive'
        page    – page number (default 1)
        limit   – page size (default 20, max 100)

    POST response (201):
    {
        "employee": { ...EmployeeSerializer... },
        "temporary_password": "Xk9mP2qR7abc"
    }
    """

    permission_classes = [IsClientAdmin]

    def get(self, request, *args, **kwargs):
        client = request.user.client
        qs = _get_employee_queryset(client)

        # Filters
        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
            )

        role = request.query_params.get('role')
        if role in EMPLOYEE_ROLES:
            qs = qs.filter(role=role)

        active_filter = request.query_params.get('status')
        if active_filter == 'active':
            qs = qs.filter(is_active=True)
        elif active_filter == 'inactive':
            qs = qs.filter(is_active=False)

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

        serializer = EmployeeSerializer(qs[offset: offset + limit], many=True)

        return Response({
            'data':       serializer.data,
            'total':      total,
            'page':       page,
            'limit':      limit,
            'totalPages': total_pages,
        })

    def post(self, request, *args, **kwargs):
        from django.conf import settings

        client = request.user.client
        serializer = EmployeeCreateSerializer(
            data=request.data,
            context={'client': client},
        )
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()

        temp_password = serializer._temp_password
        frontend_url = getattr(settings, 'FRONTEND_URL',
                               'http://localhost:5173')

        _send_employee_welcome(employee, temp_password, client, frontend_url)

        return Response(
            {
                'employee':          EmployeeSerializer(employee).data,
                'temporary_password': temp_password,
            },
            status=status.HTTP_201_CREATED,
        )


# ─── Detail / Update ──────────────────────────────────────────────────────────

class EmployeeDetailView(generics.GenericAPIView):
    """
    GET   /api/auth/employees/{id}/   retrieve
    PUT   /api/auth/employees/{id}/   full update
    PATCH /api/auth/employees/{id}/   partial update
    """

    permission_classes = [IsClientAdmin]

    def _get_employee(self, request, pk):
        client = request.user.client
        try:
            return _get_employee_queryset(client).get(pk=pk)
        except User.DoesNotExist:
            return None

    def get(self, request, pk, *args, **kwargs):
        employee = self._get_employee(request, pk)
        if employee is None:
            return Response(
                {'error': 'Employee not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(EmployeeSerializer(employee).data)

    def put(self, request, pk, *args, **kwargs):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk, *args, **kwargs):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial):
        employee = self._get_employee(request, pk)
        if employee is None:
            return Response(
                {'error': 'Employee not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = EmployeeUpdateSerializer(
            employee, data=request.data, partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(EmployeeSerializer(employee).data)


# ─── Deactivate / Reactivate ──────────────────────────────────────────────────

class EmployeeDeactivateView(APIView):
    """POST /api/auth/employees/{pk}/deactivate/"""

    permission_classes = [IsClientAdmin]

    def post(self, request, pk, *args, **kwargs):
        client = request.user.client
        try:
            employee = _get_employee_queryset(client).get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {'error': 'Employee not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        employee.is_active = False
        employee.save(update_fields=['is_active'])

        return Response({
            'message':  f'{employee.first_name} {employee.last_name} has been deactivated.',
            'employee': EmployeeSerializer(employee).data,
        })


class EmployeeReactivateView(APIView):
    """POST /api/auth/employees/{pk}/reactivate/"""

    permission_classes = [IsClientAdmin]

    def post(self, request, pk, *args, **kwargs):
        client = request.user.client
        # Allow reactivating inactive employees — no is_active filter
        try:
            employee = User.objects.get(
                pk=pk, client=client, role__in=EMPLOYEE_ROLES,
            )
        except User.DoesNotExist:
            return Response(
                {'error': 'Employee not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        employee.is_active = True
        employee.save(update_fields=['is_active'])

        return Response({
            'message':  f'{employee.first_name} {employee.last_name} has been reactivated.',
            'employee': EmployeeSerializer(employee).data,
        })


# ─── Reset Password ───────────────────────────────────────────────────────────

class EmployeeResetPasswordView(APIView):
    """
    POST /api/auth/employees/{pk}/reset-password/

    Generates a new temporary password, saves it, emails the employee,
    and returns the credentials for the UI dialog.
    """

    permission_classes = [IsClientAdmin]

    def post(self, request, pk, *args, **kwargs):
        from django.conf import settings
        from django.utils.crypto import get_random_string

        client = request.user.client
        try:
            employee = _get_employee_queryset(client).get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {'error': 'Employee not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        temp_password = get_random_string(
            length=12,
            allowed_chars='abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789',
        )
        employee.set_password(temp_password)
        employee.must_change_password = True
        employee.password_changed_at = None
        employee.save(
            update_fields=['password', 'must_change_password', 'password_changed_at'])

        frontend_url = getattr(settings, 'FRONTEND_URL',
                               'http://localhost:5173')
        _send_employee_password_reset(
            employee, temp_password, client, frontend_url)

        return Response({
            'employee':          EmployeeSerializer(employee).data,
            'temporary_password': temp_password,
        })

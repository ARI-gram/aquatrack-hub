"""
apps/deliveries/manager_views.py
Site-manager-scoped endpoints — mounted at /api/manager/
"""

from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import permissions

from apps.deliveries.models import Delivery
from apps.authentication.models import User


class IsSiteManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('site_manager', 'client_admin', 'super_admin')
            and request.user.client_id is not None
        )


def _driver_name(driver):
    name = f"{driver.first_name or ''} {driver.last_name or ''}".strip()
    return name or driver.email


def _driver_status(driver, today_qs):
    """
    Derive a simple status string from today's deliveries.
      on_route  — has at least one active in-progress delivery
      available — has assigned/accepted deliveries but not yet en-route
      off_duty  — no deliveries today
    """
    active = today_qs.exclude(status__in=('COMPLETED', 'FAILED', 'REJECTED'))
    if active.filter(status__in=('PICKED_UP', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS')).exists():
        return 'on_route'
    if active.filter(status__in=('ASSIGNED', 'ACCEPTED')).exists():
        return 'available'
    return 'off_duty'


class ManagerDriverListView(APIView):
    """GET /api/manager/drivers/"""
    permission_classes = [IsSiteManager]

    def get(self, request):
        today = timezone.now().date()
        client = request.user.client

        drivers = User.objects.filter(
            role='driver',
            client=client,
            is_active=True,
        ).order_by('first_name', 'last_name')

        # Optional filters
        search = request.query_params.get('search', '').strip().lower()
        status_filter = request.query_params.get('status', '').strip()

        result = []
        for driver in drivers:
            today_qs = Delivery.objects.filter(
                driver=driver,
                order__delivery__scheduled_date=today,
            )
            drv_status = _driver_status(driver, today_qs)

            if status_filter and drv_status != status_filter:
                continue
            if search and not any([
                search in (driver.first_name or '').lower(),
                search in (driver.last_name or '').lower(),
                search in (driver.email or '').lower(),
                search in (getattr(driver, 'phone', '') or '').lower(),
                search in (getattr(driver, 'vehicle_number', '')
                           or '').lower(),
            ]):
                continue

            result.append({
                'id':             str(driver.id),
                'name':           _driver_name(driver),
                'email':          driver.email,
                'phone':          getattr(driver, 'phone', '') or getattr(driver, 'phone_number', '') or '',
                'vehicle_number': getattr(driver, 'vehicle_number', '') or '',
                'status':         drv_status,
                'today_assigned': today_qs.count(),
                'today_completed': today_qs.filter(status='COMPLETED').count(),
                'today_failed':   today_qs.filter(status='FAILED').count(),
            })

        return Response(result)


class ManagerDriverStatsView(APIView):
    """GET /api/manager/drivers/stats/"""
    permission_classes = [IsSiteManager]

    def get(self, request):
        today = timezone.now().date()
        client = request.user.client

        drivers = User.objects.filter(
            role='driver', client=client, is_active=True)

        available = on_route = off_duty = 0
        for driver in drivers:
            today_qs = Delivery.objects.filter(
                driver=driver,
                order__delivery__scheduled_date=today,
            )
            s = _driver_status(driver, today_qs)
            if s == 'available':
                available += 1
            elif s == 'on_route':
                on_route += 1
            else:
                off_duty += 1

        return Response({
            'total':     drivers.count(),
            'available': available,
            'on_route':  on_route,
            'off_duty':  off_duty,
        })

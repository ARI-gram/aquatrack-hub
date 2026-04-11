"""
apps/deliveries/views_audit.py

GET /api/drivers/bottle-audit/
    ?period=week|month|year
    &driver_id=<uuid>   (optional — omit to get all drivers)

Permission: client_admin, accountant, super_admin
"""

from datetime import timedelta
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

from apps.authentication.models import User
from apps.deliveries.models import Delivery


# ── Permission ────────────────────────────────────────────────────────────────

class IsClientAdminOrAccountant(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'accountant', 'super_admin')
        )


# ── View ──────────────────────────────────────────────────────────────────────

class DriverBottleAuditView(APIView):
    """
    Returns a per-driver bottle audit summary for a given period.

    Response shape:
    {
        "period":    "month",
        "date_from": "2026-03-12",
        "date_to":   "2026-04-11",
        "drivers": [
            {
                "driver_id":          "uuid",
                "driver_name":        "John Kamau",
                "vehicle_number":     "KBZ 123A",
                "total_deliveries":   42,
                "pending_deliveries": 3,
                "bottles_delivered":  120,
                "bottles_to_collect": 115,
                "bottles_collected":  108,
                "shortfall":          7,
                "damages":            2
            },
            ...
        ],
        "totals": {
            "total_deliveries":   ...,
            "bottles_delivered":  ...,
            "bottles_to_collect": ...,
            "bottles_collected":  ...,
            "shortfall":          ...,
            "damages":            ...
        }
    }
    """

    permission_classes = [IsClientAdminOrAccountant]

    def get(self, request):
        # ── Date range ────────────────────────────────────────────────────────
        period = request.query_params.get('period', 'month')
        now = timezone.now()

        if period == 'week':
            date_from = now - timedelta(days=7)
        elif period == 'year':
            date_from = now - timedelta(days=365)
        else:
            date_from = now - timedelta(days=30)

        # ── Scope to this client ──────────────────────────────────────────────
        client = request.user.client
        driver_id = request.query_params.get('driver_id')

        drivers_qs = User.objects.filter(
            role='driver',
            client=client,
            is_active=True,
        ).order_by('first_name', 'last_name')

        if driver_id:
            drivers_qs = drivers_qs.filter(id=driver_id)

        results = []

        for driver in drivers_qs:
            # All deliveries for this driver in the period
            all_deliveries = Delivery.objects.filter(
                driver=driver,
                assigned_at__gte=date_from,
            ).select_related('order')

            completed = all_deliveries.filter(status='COMPLETED')
            pending = all_deliveries.exclude(
                status__in=['COMPLETED', 'FAILED', 'REJECTED']
            )

            bottles_delivered = 0
            bottles_to_collect = 0
            bottles_collected = 0
            damages = 0

            for delivery in completed.prefetch_related('order__items'):
                try:
                    order = delivery.order

                    # Count every product unit delivered
                    for item in order.items.all():
                        bottles_delivered += item.quantity

                    # Bottle exchange data (OneToOne, may not exist)
                    be = getattr(order, 'bottle_exchange', None)
                    if be:
                        bottles_to_collect += int(be.bottles_to_collect or 0)
                        bottles_collected += int(be.bottles_collected or 0)

                except Exception:
                    pass

                # Deliveries flagged with issues → count as damage incidents
                if delivery.has_issues:
                    damages += 1

            shortfall = max(0, bottles_to_collect - bottles_collected)

            results.append({
                'driver_id':          str(driver.id),
                'driver_name':        driver.full_name,
                'vehicle_number':     driver.vehicle_number or '—',
                'total_deliveries':   completed.count(),
                'pending_deliveries': pending.count(),
                'bottles_delivered':  bottles_delivered,
                'bottles_to_collect': bottles_to_collect,
                'bottles_collected':  bottles_collected,
                'shortfall':          shortfall,
                'damages':            damages,
            })

        totals = {
            'total_deliveries':   sum(r['total_deliveries'] for r in results),
            'bottles_delivered':  sum(r['bottles_delivered'] for r in results),
            'bottles_to_collect': sum(r['bottles_to_collect'] for r in results),
            'bottles_collected':  sum(r['bottles_collected'] for r in results),
            'shortfall':          sum(r['shortfall'] for r in results),
            'damages':            sum(r['damages'] for r in results),
        }

        return Response({
            'period':    period,
            'date_from': date_from.date().isoformat(),
            'date_to':   now.date().isoformat(),
            'drivers':   results,
            'totals':    totals,
        })

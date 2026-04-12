"""
apps/deliveries/views_audit.py

GET /api/drivers/bottle-audit/
    ?date_from=YYYY-MM-DD   (optional — defaults to 30 days ago)
    &date_to=YYYY-MM-DD     (optional — defaults to today)
    &driver_id=<uuid>       (optional — omit to get all drivers)

Permission: client_admin, accountant, super_admin
"""

from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

from apps.authentication.models import User
from apps.deliveries.models import Delivery
from apps.products.models import BottleMovement  # moved to top-level import


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
        "date_from": "2026-04-01",
        "date_to":   "2026-04-30",
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
        now = timezone.now()
        date_from_str = request.query_params.get('date_from')
        date_to_str = request.query_params.get('date_to')

        try:
            date_from = timezone.make_aware(
                timezone.datetime.strptime(date_from_str, '%Y-%m-%d')
            ) if date_from_str else now - timedelta(days=30)
        except ValueError:
            date_from = now - timedelta(days=30)

        try:
            date_to = timezone.make_aware(
                timezone.datetime.strptime(date_to_str, '%Y-%m-%d').replace(
                    hour=23, minute=59, second=59
                )
            ) if date_to_str else now
        except ValueError:
            date_to = now

        # ── Compute a human-readable period label ─────────────────────────────
        delta = (date_to.date() - date_from.date()).days
        if delta == 0:
            period_label = 'day'
        elif delta <= 7:
            period_label = 'week'
        elif delta <= 31:
            period_label = 'month'
        elif delta <= 366:
            period_label = 'year'
        else:
            period_label = 'custom'

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
            all_deliveries = Delivery.objects.filter(
                driver=driver,
                assigned_at__gte=date_from,
                assigned_at__lte=date_to,
            ).select_related('order')

            completed = all_deliveries.filter(status='COMPLETED')
            pending = all_deliveries.exclude(
                status__in=['COMPLETED', 'FAILED', 'REJECTED']
            )

            bottles_delivered = 0
            bottles_to_collect = 0
            damages = 0

            for delivery in completed.prefetch_related('order__items'):
                try:
                    order = delivery.order
                    for item in order.items.all():
                        bottles_delivered += item.quantity

                    be = getattr(order, 'bottle_exchange', None)
                    if be:
                        bottles_to_collect += int(be.bottles_to_collect or 0)
                except Exception:
                    pass

                # Count flagged delivery incidents as damages
                if delivery.has_issues:
                    damages += 1

            # ── Pull RECEIVE_EMPTY movements for this driver in the audit period ──
            #
            # FIX: bottles_collected is the SUM of qty_good across all
            # RECEIVE_EMPTY movements in the period — regardless of who
            # recorded them (road self-record vs office handover).
            #
            # The old code calculated  road_collected - office_good - office_damaged
            # which is the driver's *current balance*, not what was collected.
            #
            # NOTE: filter by created_at (or whichever timestamp field your
            # BottleMovement model uses — adjust the field name if needed).

            agg = BottleMovement.objects.filter(
                driver=driver,
                movement_type='RECEIVE_EMPTY',
                created_at__gte=date_from,   # ← scope to audit period
                created_at__lte=date_to,  # change to recorded_at / date if needed
            ).aggregate(
                good=Sum('qty_good'),
                damaged=Sum('qty_damaged'),
            )

            bottles_collected = agg['good'] or 0
            # Optionally surface bottle-level damage count separately:
            # bottle_damages = agg['damaged'] or 0

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
            'period':    period_label,
            'date_from': date_from.date().isoformat(),
            'date_to':   date_to.date().isoformat(),
            'drivers':   results,
            'totals':    totals,
        })

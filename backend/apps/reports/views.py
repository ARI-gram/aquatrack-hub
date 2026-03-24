"""
apps/reports/views.py

Three endpoints for the frontend ReportsPage:

  GET /api/reports/revenue/?from=2026-01-01&to=2026-01-31
  GET /api/reports/vat/?from=2026-01-01&to=2026-01-31
  GET /api/reports/outstanding/

All require IsClientAdmin.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum, Count, Q, Avg
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.products.models import BottleMovement, ConsumableMovement
from apps.customers.invoice_models import (
    CustomerInvoice,
    CustomerInvoiceStatus,
)
from apps.clients.models import Client


# ── Permission ────────────────────────────────────────────────────────────────

class IsClientAdmin(permissions.BasePermission):
    """
    Allows client_admin, site_manager, and accountant.
    All must belong to a client (client_id is not None).
    """

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'site_manager', 'accountant')
            and request.user.client_id is not None
        )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_date(s: str | None, fallback: date) -> date:
    if not s:
        return fallback
    try:
        return date.fromisoformat(s)
    except (ValueError, TypeError):
        return fallback


def _date_range_params(request):
    today = timezone.now().date()
    date_from = _parse_date(
        request.query_params.get('from'),
        today - timedelta(days=30),
    )
    date_to = _parse_date(
        request.query_params.get('to'),
        today,
    )
    return date_from, date_to


# ── Revenue Report ────────────────────────────────────────────────────────────

class RevenueReportView(APIView):
    """
    GET /api/reports/revenue/?from=YYYY-MM-DD&to=YYYY-MM-DD

    Response:
    {
        totalRevenue:      12500.00,
        totalOrders:       45,
        totalDirectSales:  12,
        averageOrderValue: 277.78,
        periodStart:       "2026-01-01",
        periodEnd:         "2026-01-31",
        byDay: [
            { date: "2026-01-01", revenue: 500.00, orders: 2, directSales: 1 },
            ...
        ],
        byProduct: [
            { productId, productName, unit, quantity, revenue },
            ...
        ]
    }
    """
    permission_classes = [IsClientAdmin]

    def get(self, request):
        client = request.user.client
        date_from, date_to = _date_range_params(request)

        # ── Completed orders ──────────────────────────────────────────────────
        orders = Order.objects.filter(
            client=client,
            status__in=['DELIVERED', 'COMPLETED'],
            created_at__date__gte=date_from,
            created_at__date__lte=date_to,
        )

        total_order_revenue = orders.aggregate(
            total=Sum('total_amount')
        )['total'] or Decimal('0.00')

        total_orders = orders.count()

        # ── Direct sales (bottle movements) ───────────────────────────────────
        bottle_sales = BottleMovement.objects.filter(
            product__client=client,
            movement_type='DIRECT_SALE',
            movement_date__date__gte=date_from,
            movement_date__date__lte=date_to,
        )
        consumable_sales = ConsumableMovement.objects.filter(
            product__client=client,
            movement_type='DIRECT_SALE',
            movement_date__date__gte=date_from,
            movement_date__date__lte=date_to,
        )

        total_direct_sales = bottle_sales.count() + consumable_sales.count()

        # Revenue from direct sales (unit_price × qty)
        bottle_direct_rev = sum(
            (m.qty_good or 0) * float(m.product.selling_price or 0)
            for m in bottle_sales.select_related('product')
        )
        consumable_direct_rev = sum(
            (m.quantity or 0) * float(m.unit_price or m.product.selling_price or 0)
            for m in consumable_sales.select_related('product')
        )

        total_revenue = float(total_order_revenue) + \
            bottle_direct_rev + consumable_direct_rev

        avg_order = (
            float(total_order_revenue) / total_orders
            if total_orders > 0 else 0
        )

        # ── By day ────────────────────────────────────────────────────────────
        by_day = []
        delta = (date_to - date_from).days + 1

        for i in range(delta):
            d = date_from + timedelta(days=i)

            day_orders = orders.filter(created_at__date=d)
            day_order_rev = float(
                day_orders.aggregate(t=Sum('total_amount'))['t'] or 0
            )
            day_order_count = day_orders.count()

            day_bottle = bottle_sales.filter(movement_date__date=d)
            day_consumable = consumable_sales.filter(movement_date__date=d)
            day_direct_count = day_bottle.count() + day_consumable.count()
            day_direct_rev = sum(
                (m.qty_good or 0) * float(m.product.selling_price or 0)
                for m in day_bottle.select_related('product')
            ) + sum(
                (m.quantity or 0) *
                float(m.unit_price or m.product.selling_price or 0)
                for m in day_consumable.select_related('product')
            )

            by_day.append({
                'date':        d.isoformat(),
                'revenue':     round(day_order_rev + day_direct_rev, 2),
                'orders':      day_order_count,
                'directSales': day_direct_count,
            })

        # ── By product ────────────────────────────────────────────────────────
        from apps.orders.models import OrderItem
        from collections import defaultdict

        product_map: dict = defaultdict(lambda: {
            'productId': '', 'productName': '', 'unit': '',
            'quantity': 0, 'revenue': 0.0,
        })

        # From order items
        order_items = OrderItem.objects.filter(
            order__in=orders
        ).select_related('product')

        for item in order_items:
            pid = str(item.product_id or item.product_name)
            product_map[pid]['productId'] = pid
            product_map[pid]['productName'] = item.product_name
            product_map[pid]['unit'] = item.product_unit
            product_map[pid]['quantity'] += item.quantity
            product_map[pid]['revenue'] += float(item.subtotal)

        # From direct bottle sales
        for m in bottle_sales.select_related('product'):
            pid = str(m.product_id)
            qty = m.qty_good or 0
            rev = qty * float(m.product.selling_price or 0)
            product_map[pid]['productId'] = pid
            product_map[pid]['productName'] = m.product.name
            product_map[pid]['unit'] = m.product.unit
            product_map[pid]['quantity'] += qty
            product_map[pid]['revenue'] += rev

        # From direct consumable sales
        for m in consumable_sales.select_related('product'):
            pid = str(m.product_id)
            qty = m.quantity or 0
            rev = qty * float(m.unit_price or m.product.selling_price or 0)
            product_map[pid]['productId'] = pid
            product_map[pid]['productName'] = m.product.name
            product_map[pid]['unit'] = m.product.unit
            product_map[pid]['quantity'] += qty
            product_map[pid]['revenue'] += rev

        by_product = sorted(
            [dict(v) for v in product_map.values()],
            key=lambda x: x['revenue'],
            reverse=True,
        )

        return Response({
            'totalRevenue':      round(total_revenue, 2),
            'totalOrders':       total_orders,
            'totalDirectSales':  total_direct_sales,
            'averageOrderValue': round(avg_order, 2),
            'periodStart':       date_from.isoformat(),
            'periodEnd':         date_to.isoformat(),
            'byDay':             by_day,
            'byProduct':         by_product,
        })


# ── VAT Report ────────────────────────────────────────────────────────────────

class VatReportView(APIView):
    """
    GET /api/reports/vat/?from=YYYY-MM-DD&to=YYYY-MM-DD

    Returns VAT breakdown for all issued/paid invoices in the period.
    If client is not VAT registered, returns { vatRegistered: false }.
    """
    permission_classes = [IsClientAdmin]

    def get(self, request):
        client = request.user.client
        date_from, date_to = _date_range_params(request)

        # Check VAT registration via AccountingSettings if available
        vat_registered = False
        vat_rate = Decimal('16.00')

        try:
            from apps.accounts.models import AccountingSettings
            cfg = AccountingSettings.objects.get(client=client)
            vat_registered = cfg.vat_registered
            vat_rate = cfg.vat_rate
        except Exception:
            # If AccountingSettings model not created yet — default to False
            vat_registered = False

        if not vat_registered:
            return Response({'vatRegistered': False})

        invoices = CustomerInvoice.objects.filter(
            customer__client=client,
            status__in=[
                CustomerInvoiceStatus.ISSUED,
                CustomerInvoiceStatus.PAID,
                CustomerInvoiceStatus.OVERDUE,
            ],
            created_at__date__gte=date_from,
            created_at__date__lte=date_to,
        ).select_related('customer').order_by('created_at')

        totals = invoices.aggregate(
            subtotal=Sum('subtotal'),
            gross=Sum('total_amount'),
        )

        total_subtotal = float(totals['subtotal'] or 0)
        total_gross = float(totals['gross'] or 0)
        total_vat = round(total_gross - total_subtotal, 2)

        lines = []
        for inv in invoices:
            sub = float(inv.subtotal)
            gross = float(inv.total_amount)
            vat = round(gross - sub, 2)
            lines.append({
                'invoiceNumber': inv.invoice_number,
                'customerName':  inv.customer.full_name,
                'date':          inv.created_at.date().isoformat(),
                'subtotal':      round(sub,   2),
                'vatAmount':     vat,
                'totalAmount':   round(gross, 2),
                'status':        inv.status,
            })

        return Response({
            'vatRegistered': True,
            'vatRate':        float(vat_rate),
            'totalSubtotal':  round(total_subtotal, 2),
            'totalVat':       total_vat,
            'totalGross':     round(total_gross,    2),
            'invoiceCount':   invoices.count(),
            'lines':          lines,
            'periodStart':    date_from.isoformat(),
            'periodEnd':      date_to.isoformat(),
        })


# ── Outstanding Report ────────────────────────────────────────────────────────

class OutstandingReportView(APIView):
    """
    GET /api/reports/outstanding/

    Lists all customers with unpaid/overdue invoices,
    sorted by outstanding amount descending.
    """
    permission_classes = [IsClientAdmin]

    def get(self, request):
        client = request.user.client
        today = timezone.now().date()

        unpaid_invoices = CustomerInvoice.objects.filter(
            customer__client=client,
            status__in=[
                CustomerInvoiceStatus.ISSUED,
                CustomerInvoiceStatus.OVERDUE,
            ],
        ).select_related('customer').order_by('due_date')

        # Group by customer
        from collections import defaultdict
        cust_map: dict = defaultdict(lambda: {
            'customerId':        '',
            'customerName':      '',
            'customerPhone':     '',
            'outstandingAmount': 0.0,
            'overdueAmount':     0.0,
            'invoiceCount':      0,
            'oldestDueDate':     None,
            'isOverdue':         False,
        })

        for inv in unpaid_invoices:
            cid = str(inv.customer_id)
            amt = float(inv.total_amount)
            over = inv.due_date < today if inv.due_date else False

            cust_map[cid]['customerId'] = cid
            cust_map[cid]['customerName'] = inv.customer.full_name
            cust_map[cid]['customerPhone'] = inv.customer.phone_number
            cust_map[cid]['outstandingAmount'] += amt
            cust_map[cid]['invoiceCount'] += 1

            if over:
                cust_map[cid]['overdueAmount'] += amt
                cust_map[cid]['isOverdue'] = True

            if (
                cust_map[cid]['oldestDueDate'] is None
                or (inv.due_date and inv.due_date < cust_map[cid]['oldestDueDate'])
            ):
                cust_map[cid]['oldestDueDate'] = inv.due_date

        customers = sorted(
            [
                {
                    **v,
                    'outstandingAmount': round(v['outstandingAmount'], 2),
                    'overdueAmount':     round(v['overdueAmount'],     2),
                    'oldestDueDate': (
                        v['oldestDueDate'].isoformat()
                        if v['oldestDueDate'] else None
                    ),
                }
                for v in cust_map.values()
            ],
            key=lambda x: x['outstandingAmount'],
            reverse=True,
        )

        total_outstanding = round(
            sum(c['outstandingAmount'] for c in customers), 2)
        total_overdue = round(sum(c['overdueAmount'] for c in customers), 2)
        overdue_count = sum(1 for c in customers if c['isOverdue'])

        return Response({
            'totalOutstanding': total_outstanding,
            'totalOverdue':     total_overdue,
            'customerCount':    len(customers),
            'overdueCount':     overdue_count,
            'customers':        customers,
        })

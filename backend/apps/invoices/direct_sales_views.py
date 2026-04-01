"""
apps/invoices/direct_sales_views.py

Direct Sales Accountability Report

GET  /api/client/accounts/direct-sales/
     Returns all DIRECT_SALE movements (bottles + consumables) for the client.
     Supports filters: date_from, date_to, source (store|driver|all), product_id

     Response shape:
     {
       "summary": {
         "totalRevenue":       12500.00,
         "totalTransactions":  47,
         "storeRevenue":       8000.00,
         "driverRevenue":      4500.00,
         "paymentBreakdown":   { "CASH": 7000.00, "MPESA": 5500.00 },
         "productBreakdown":   [{ productName, quantity, revenue }],
         "dailyTotals":        [{ date, revenue, count }],
       },
       "transactions": [
         {
           "id":            "uuid",
           "date":          "2025-03-01T10:32:00Z",
           "productName":   "18.9L Dispenser",
           "productType":   "bottle" | "consumable",
           "quantity":      2,
           "unitPrice":     800.00,
           "totalAmount":   1600.00,
           "source":        "store" | "driver",
           "servedBy":      "Jane Mwangi" | "Driver: Tom Otieno",
           "customerName":  "John Doe" | "Walk-in",
           "customerPhone": "+254712...",
           "paymentMethod": "CASH",
           "notes":         "",
         }
       ],
       "pagination": { "total": 200, "page": 1, "limit": 50, "totalPages": 4 }
     }
"""

import re
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.products.models import BottleMovement, ConsumableMovement, Product


class IsAccountsStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'accountant', 'site_manager', 'super_admin')
            and request.user.client_id is not None
        )


def _staff_name(user):
    if not user:
        return None
    name = f'{user.first_name} {user.last_name}'.strip()
    return name or user.email


def _parse_customer_from_notes(notes: str):
    """
    Extract customer name and phone from notes like:
      'Customer: ARITechnologies (+254126875878)'
      'Customer: ARI -gram Technologies (+254104770467) · Customer: ARI ...'
      'Customer: Ester Ndeti (+254789542589) · Customer: ... · Payment: CREDIT'

    Strategy: split on '·' first to isolate the FIRST Customer segment,
    then parse name and optional phone from that segment.
    Returns (customer_name, customer_phone) — both strings, possibly empty.
    """
    if not notes:
        return '', ''

    # Take only the first segment (before any '·') to avoid duplicate noise
    first_segment = notes.split('·')[0].strip()

    # Match 'Customer: <name> (<phone>)' or 'Customer: <name>'
    m = re.search(
        r'Customer:\s*(.+?)(?:\s*\(([^)]+)\))?\s*$',
        first_segment,
    )
    if m:
        name = m.group(1).strip()
        phone = (m.group(2) or '').strip()
        return name, phone

    return '', ''


class DirectSalesView(APIView):
    """
    GET /api/client/accounts/direct-sales/

    Query params:
        date_from    — 'yyyy-MM-dd'
        date_to      — 'yyyy-MM-dd'
        source       — 'store' | 'driver' | 'all'  (default: all)
        product_id   — UUID, filter to one product
        page         — int (default 1)
        limit        — int (default 50, max 200)
    """
    permission_classes = [IsAccountsStaff]

    def get(self, request):
        client = request.user.client
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        source = request.query_params.get(
            'source', 'all')   # store | driver | all
        product_id = request.query_params.get('product_id')

        try:
            page = max(1, int(request.query_params.get('page',  1)))
            limit = min(
                200, max(1, int(request.query_params.get('limit', 50))))
        except (ValueError, TypeError):
            page, limit = 1, 50

        # ── Build querysets ───────────────────────────────────────────────────

        def _apply_date_filter(qs, date_field='movement_date'):
            if date_from:
                qs = qs.filter(**{f'{date_field}__date__gte': date_from})
            if date_to:
                qs = qs.filter(**{f'{date_field}__date__lte': date_to})
            return qs

        def _is_store_sale_filter():
            return Q(driver__isnull=True)

        def _is_driver_sale_filter():
            return Q(driver__isnull=False)

        # ── Bottle DIRECT_SALE movements ─────────────────────────────────────
        bottle_qs = BottleMovement.objects.filter(
            product__client=client,
            movement_type='DIRECT_SALE',
        ).select_related('product', 'driver', 'recorded_by', 'customer')

        if product_id:
            bottle_qs = bottle_qs.filter(product_id=product_id)
        bottle_qs = _apply_date_filter(bottle_qs)

        if source == 'store':
            bottle_qs = bottle_qs.filter(_is_store_sale_filter())
        elif source == 'driver':
            bottle_qs = bottle_qs.filter(_is_driver_sale_filter())

        # ── Consumable DIRECT_SALE movements ──────────────────────────────────
        consumable_qs = ConsumableMovement.objects.filter(
            product__client=client,
            movement_type='DIRECT_SALE',
        ).select_related('product', 'driver', 'recorded_by', 'customer')

        if product_id:
            consumable_qs = consumable_qs.filter(product_id=product_id)
        consumable_qs = _apply_date_filter(consumable_qs)

        if source == 'store':
            consumable_qs = consumable_qs.filter(_is_store_sale_filter())
        elif source == 'driver':
            consumable_qs = consumable_qs.filter(_is_driver_sale_filter())

        # ── Materialise into unified rows ─────────────────────────────────────
        rows = []

        # ── Bottle loop ───────────────────────────────────────────────────────
        for mv in bottle_qs.order_by('-movement_date'):
            product = mv.product
            unit_price = (
                Decimal(str(product.selling_price))
                if product and product.selling_price
                else Decimal('0')
            )
            qty = mv.qty_good
            total = unit_price * qty

            is_driver_sale = mv.driver is not None
            if is_driver_sale:
                served_by = f'Driver: {_staff_name(mv.driver)}' if mv.driver else 'Driver'
                payment_method = mv.payment_method or 'CASH'
            else:
                served_by = _staff_name(mv.recorded_by) or 'Store'
                payment_method = _extract_payment_method(mv.notes)

            # Customer block — outside if/else, runs for ALL sales
            customer_name = ''
            customer_phone = ''
            if mv.customer:
                customer_name = mv.customer.full_name or ''
                customer_phone = mv.customer.phone_number or ''
            elif mv.customer_name:
                customer_name = mv.customer_name
            else:
                customer_name, customer_phone = _parse_customer_from_notes(
                    mv.notes)

            rows.append({
                'id':            str(mv.id),
                'date':          mv.movement_date.isoformat(),
                'productName':   product.name if product else '',
                'productId':     str(product.id) if product else '',
                'productType':   'bottle',
                'quantity':      qty,
                'unitPrice':     float(unit_price),
                'totalAmount':   float(total),
                'source':        'driver' if is_driver_sale else 'store',
                'servedBy':      served_by,
                'customerName':  customer_name or 'Walk-in',
                'customerPhone': customer_phone,
                'paymentMethod': payment_method,
                'notes':         mv.notes or '',
                '_sort':         mv.movement_date,
            })

        # ── Consumable loop ───────────────────────────────────────────────────
        for mv in consumable_qs.order_by('-movement_date'):
            product = mv.product
            unit_price = (
                Decimal(str(mv.unit_price))
                if mv.unit_price
                else (Decimal(str(product.selling_price)) if product and product.selling_price else Decimal('0'))
            )
            qty = mv.quantity
            total = unit_price * qty

            is_driver_sale = mv.driver is not None
            if is_driver_sale:
                served_by = f'Driver: {_staff_name(mv.driver)}' if mv.driver else 'Driver'
                payment_method = mv.payment_method or 'CASH'
            else:
                served_by = _staff_name(mv.recorded_by) or 'Store'
                payment_method = _extract_payment_method(mv.notes)

            # Customer block — outside if/else, runs for ALL sales (fix: was incorrectly nested in else)
            customer_name = ''
            customer_phone = ''
            if mv.customer:
                customer_name = mv.customer.full_name or ''
                customer_phone = mv.customer.phone_number or ''
            elif mv.customer_name:
                customer_name = mv.customer_name
            else:
                customer_name, customer_phone = _parse_customer_from_notes(
                    mv.notes)

            rows.append({
                'id':            str(mv.id),
                'date':          mv.movement_date.isoformat(),
                'productName':   product.name if product else '',
                'productId':     str(product.id) if product else '',
                'productType':   'consumable',
                'quantity':      qty,
                'unitPrice':     float(unit_price),
                'totalAmount':   float(total),
                'source':        'driver' if is_driver_sale else 'store',
                'servedBy':      served_by,
                'customerName':  customer_name or 'Walk-in',
                'customerPhone': customer_phone,
                'paymentMethod': payment_method,
                'notes':         mv.notes or '',
                '_sort':         mv.movement_date,
            })

        # Sort all rows newest first
        rows.sort(key=lambda r: r['_sort'], reverse=True)
        for r in rows:
            del r['_sort']

        # ── Summary calculations (on full unfiltered rows) ────────────────────
        total_revenue = sum(r['totalAmount'] for r in rows)
        total_transactions = len(rows)
        store_revenue = sum(r['totalAmount']
                            for r in rows if r['source'] == 'store')
        driver_revenue = sum(r['totalAmount']
                             for r in rows if r['source'] == 'driver')

        payment_breakdown: dict[str, float] = {}
        for r in rows:
            pm = r['paymentMethod'] or 'UNKNOWN'
            payment_breakdown[pm] = round(
                payment_breakdown.get(pm, 0) + r['totalAmount'], 2)

        product_map: dict[str, dict] = {}
        for r in rows:
            pid = r['productId']
            if pid not in product_map:
                product_map[pid] = {
                    'productId':   pid,
                    'productName': r['productName'],
                    'productType': r['productType'],
                    'quantity':    0,
                    'revenue':     0.0,
                }
            product_map[pid]['quantity'] += r['quantity']
            product_map[pid]['revenue'] = round(
                product_map[pid]['revenue'] + r['totalAmount'], 2)

        product_breakdown = sorted(
            product_map.values(), key=lambda x: x['revenue'], reverse=True
        )

        daily_map: dict[str, dict] = {}
        for r in rows:
            day = r['date'][:10]
            if day not in daily_map:
                daily_map[day] = {'date': day, 'revenue': 0.0, 'count': 0}
            daily_map[day]['revenue'] = round(
                daily_map[day]['revenue'] + r['totalAmount'], 2)
            daily_map[day]['count'] += 1

        daily_totals = sorted(daily_map.values(), key=lambda x: x['date'])

        served_map: dict[str, dict] = {}
        for r in rows:
            key = r['servedBy'] or 'Unknown'
            if key not in served_map:
                served_map[key] = {
                    'servedBy': key,
                    'source':   r['source'],
                    'count':    0,
                    'revenue':  0.0,
                }
            served_map[key]['count'] += 1
            served_map[key]['revenue'] = round(
                served_map[key]['revenue'] + r['totalAmount'], 2)

        served_breakdown = sorted(
            served_map.values(), key=lambda x: x['revenue'], reverse=True
        )

        # ── Paginate ──────────────────────────────────────────────────────────
        total_count = len(rows)
        total_pages = max(1, (total_count + limit - 1) // limit)
        page = min(page, total_pages)
        offset = (page - 1) * limit
        page_rows = rows[offset: offset + limit]

        return Response({
            'summary': {
                'totalRevenue':      round(total_revenue,      2),
                'totalTransactions': total_transactions,
                'storeRevenue':      round(store_revenue,      2),
                'driverRevenue':     round(driver_revenue,     2),
                'paymentBreakdown':  payment_breakdown,
                'productBreakdown':  product_breakdown,
                'dailyTotals':       daily_totals,
                'servedBreakdown':   served_breakdown,
            },
            'transactions': page_rows,
            'pagination': {
                'total':      total_count,
                'page':       page,
                'limit':      limit,
                'totalPages': total_pages,
            },
        })


def _extract_payment_method(notes: str) -> str:
    """
    Try to detect payment method from notes field.
    Store staff don't record payment method in the current schema —
    this is a best-effort parse. Returns 'CASH' as default.
    """
    if not notes:
        return 'CASH'
    notes_upper = notes.upper()
    if 'MPESA' in notes_upper or 'M-PESA' in notes_upper:
        return 'MPESA'
    if 'BANK' in notes_upper:
        return 'BANK_TRANSFER'
    if 'CREDIT' in notes_upper:
        return 'CREDIT'
    return 'CASH'

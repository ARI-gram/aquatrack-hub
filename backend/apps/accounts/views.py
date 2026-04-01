# apps/accounts/views.py

from django.utils.dateparse import parse_date
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AccountingSettings
from apps.products.models import BottleMovement, ConsumableMovement


# ── Permission ────────────────────────────────────────────────────────────────

class IsAccountsStaff(permissions.BasePermission):
    """client_admin and accountant can read/write. Drivers can read (for receipts)."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        role = request.user.role

        # Drivers may only GET (they need business details for receipt printing)
        if role == 'driver':
            return request.method == 'GET' and request.user.client_id is not None

        return (
            role in ('client_admin', 'accountant', 'super_admin')
            and request.user.client_id is not None
        )


# ── Serializer helper (no DRF serializer needed — simple dict) ───────────────

def _settings_to_dict(s: AccountingSettings) -> dict:
    return {
        'legalName':          s.legal_name,
        'kraPin':             s.kra_pin,
        'vatRegistered':      s.vat_registered,
        'vatNumber':          s.vat_number,
        'vatRate':            float(s.vat_rate),
        'address':            s.address,
        'city':               s.city,
        'phone':              s.phone,
        'email':              s.email,
        'invoicePrefix':      s.invoice_prefix or 'INV',
        'invoiceFooterNote':  s.invoice_footer_note,
        'bankName':           s.bank_name,
        'bankAccountNumber':  s.bank_account_number,
        'bankAccountName':    s.bank_account_name,
        'bankBranch':         s.bank_branch,
        'mpesaPaybill':       s.mpesa_paybill,
        'mpesaAccountName':   s.mpesa_account_name,
        'mpesaTill':          s.mpesa_till,
    }


# ── View ─────────────────────────────────────────────────────────────────────

class AccountingSettingsView(APIView):
    """
    GET  /api/client/accounting-settings/   → fetch current settings
    POST /api/client/accounting-settings/   → create or update settings

    Uses get_or_create so the first POST creates the record,
    subsequent POSTs update it. Frontend always calls POST to save.
    """

    permission_classes = [IsAccountsStaff]

    def get(self, request):
        client = request.user.client
        try:
            settings = AccountingSettings.objects.get(client=client)
            return Response(_settings_to_dict(settings))
        except AccountingSettings.DoesNotExist:
            # Return blank defaults — frontend handles the empty state
            return Response({
                'legalName':         '',
                'kraPin':            '',
                'vatRegistered':     False,
                'vatNumber':         '',
                'vatRate':           16.0,
                'address':           '',
                'city':              '',
                'phone':             '',
                'email':             '',
                'invoicePrefix':     'INV',
                'invoiceFooterNote': '',
                'bankName':          '',
                'bankAccountNumber': '',
                'bankAccountName':   '',
                'bankBranch':        '',
                'mpesaPaybill':      '',
                'mpesaAccountName':  '',
                'mpesaTill':         '',
            })

    def post(self, request):
        client = request.user.client
        data = request.data

        settings, _ = AccountingSettings.objects.get_or_create(client=client)

        # Map camelCase frontend → snake_case model fields
        field_map = {
            'legalName':         'legal_name',
            'kraPin':            'kra_pin',
            'vatRegistered':     'vat_registered',
            'vatNumber':         'vat_number',
            'vatRate':           'vat_rate',
            'address':           'address',
            'city':              'city',
            'phone':             'phone',
            'email':             'email',
            'invoicePrefix':     'invoice_prefix',
            'invoiceFooterNote': 'invoice_footer_note',
            'bankName':          'bank_name',
            'bankAccountNumber': 'bank_account_number',
            'bankAccountName':   'bank_account_name',
            'bankBranch':        'bank_branch',
            'mpesaPaybill':      'mpesa_paybill',
            'mpesaAccountName':  'mpesa_account_name',
            'mpesaTill':         'mpesa_till',
        }

        updated_fields = []
        for camel, snake in field_map.items():
            if camel in data:
                setattr(settings, snake, data[camel])
                updated_fields.append(snake)

        if updated_fields:
            settings.save(update_fields=updated_fields + ['updated_at'])

        return Response(
            _settings_to_dict(settings),
            status=status.HTTP_200_OK,
        )


class DirectSalesView(APIView):
    permission_classes = [IsAccountsStaff]

    def get(self, request):
        client = request.user.client

        page = int(request.GET.get('page',  1))
        limit = int(request.GET.get('limit', 50))
        source = request.GET.get('source')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        # ── Querysets ─────────────────────────────────────────────────────
        bottle_qs = BottleMovement.objects.filter(
            movement_type='DIRECT_SALE',
            product__client=client,
            # ← ADD driver
        ).select_related('product', 'recorded_by', 'driver', 'customer')

        cons_qs = ConsumableMovement.objects.filter(
            movement_type='DIRECT_SALE',
            product__client=client,
            # ← ADD driver
        ).select_related('product', 'recorded_by', 'driver', 'customer')

        # ── Date filters ──────────────────────────────────────────────────
        if date_from:
            d = parse_date(date_from)
            if d:
                bottle_qs = bottle_qs.filter(movement_date__date__gte=d)
                cons_qs = cons_qs.filter(movement_date__date__gte=d)
        if date_to:
            d = parse_date(date_to)
            if d:
                bottle_qs = bottle_qs.filter(movement_date__date__lte=d)
                cons_qs = cons_qs.filter(movement_date__date__lte=d)

        # ── Source filter ─────────────────────────────────────────────────
        # REPLACE the old source filter block with this:
        if source == 'store':
            bottle_qs = bottle_qs.filter(driver__isnull=True)
            cons_qs = cons_qs.filter(driver__isnull=True)
        elif source == 'driver':
            bottle_qs = bottle_qs.filter(driver__isnull=False)
            cons_qs = cons_qs.filter(driver__isnull=False)

        # ── Row builders ──────────────────────────────────────────────────
        # REPLACE the old src() function with this:
        def src(m):
            if m.recorded_by_id is not None:
                return 'driver' if getattr(m.recorded_by, 'role', '') == 'driver' else 'store'
            if getattr(m, 'driver_id', None) is not None:
                return 'driver'
            return 'store'

        # REPLACE servedBy in both row builders with this helper:
        def served_by(m):
            if m.recorded_by:
                return m.recorded_by.full_name or m.recorded_by.email
            if getattr(m, 'driver', None):
                return (
                    f'{m.driver.first_name} {m.driver.last_name}'.strip()
                    or m.driver.email
                )
            return ''

        def row_from_bottle(m):
            unit_price = float(m.unit_price or m.product.selling_price or 0)
            quantity = m.qty_good
            total_amount = float(m.total_amount or (unit_price * quantity))
            return {
                'id':            str(m.id),
                'date':          m.movement_date.isoformat(),
                'productName':   m.product.name,
                'productId':     str(m.product.id),
                'productType':   'bottle',
                'quantity':      quantity,
                'unitPrice':     unit_price,
                'totalAmount':   total_amount,
                'source':        src(m),
                'servedBy':      served_by(m),  # ← CHANGED
                'customerName':  m.customer.full_name if m.customer else (m.customer_name or 'Walk-in'),
                'customerPhone': m.customer.phone_number if m.customer else '',
                'paymentMethod': m.payment_method or 'CASH',
                'notes':         m.notes or '',
            }

        def row_from_consumable(m):
            unit_price = float(m.unit_price or m.product.selling_price or 0)
            quantity = m.quantity
            total_amount = unit_price * quantity
            return {
                'id':            f'c-{m.id}',
                'date':          m.movement_date.isoformat(),
                'productName':   m.product.name,
                'productId':     str(m.product.id),
                'productType':   'consumable',
                'quantity':      quantity,
                'unitPrice':     unit_price,
                'totalAmount':   total_amount,
                'source':        src(m),
                'servedBy':      served_by(m),  # ← CHANGED
                'customerName':  m.customer.full_name if m.customer else (m.customer_name or 'Walk-in'),
                'customerPhone': m.customer.phone_number if m.customer else '',
                'paymentMethod': m.payment_method or 'CASH',
                'notes':         m.notes or '',
            }

        # ── Everything below this line is UNCHANGED ───────────────────────
        all_rows = (
            [row_from_bottle(m) for m in bottle_qs] +
            [row_from_consumable(m) for m in cons_qs]
        )

        # ── Pagination ────────────────────────────────────────────────────
        total = len(all_rows)
        total_pages = max(1, (total + limit - 1) // limit)
        page = min(page, total_pages)
        offset = (page - 1) * limit
        page_rows = all_rows[offset: offset + limit]

        # ── Aggregates ────────────────────────────────────────────────────
        total_revenue = sum(r['totalAmount'] for r in all_rows)
        store_revenue = sum(r['totalAmount']
                            for r in all_rows if r['source'] == 'store')
        driver_revenue = sum(r['totalAmount']
                             for r in all_rows if r['source'] == 'driver')

        payment_breakdown: dict = {}
        for r in all_rows:
            pm = r['paymentMethod']
            payment_breakdown[pm] = payment_breakdown.get(
                pm, 0) + r['totalAmount']

        prod_map: dict = {}
        for r in all_rows:
            pid = r['productId']
            if pid not in prod_map:
                prod_map[pid] = {
                    'productId':   pid,
                    'productName': r['productName'],
                    'productType': r['productType'],
                    'quantity':    0,
                    'revenue':     0.0,
                }
            prod_map[pid]['quantity'] += r['quantity']
            prod_map[pid]['revenue'] += r['totalAmount']
        product_breakdown = sorted(
            prod_map.values(), key=lambda x: x['revenue'], reverse=True)

        daily_map: dict = {}
        for r in all_rows:
            day = r['date'][:10]
            if day not in daily_map:
                daily_map[day] = {'date': day, 'revenue': 0.0, 'count': 0}
            daily_map[day]['revenue'] += r['totalAmount']
            daily_map[day]['count'] += 1
        daily_totals = sorted(daily_map.values(), key=lambda x: x['date'])

        staff_map: dict = {}
        for r in all_rows:
            key = (r['servedBy'], r['source'])
            if key not in staff_map:
                staff_map[key] = {
                    'servedBy': r['servedBy'],
                    'source':   r['source'],
                    'count':    0,
                    'revenue':  0.0,
                }
            staff_map[key]['count'] += 1
            staff_map[key]['revenue'] += r['totalAmount']
        served_breakdown = sorted(
            staff_map.values(), key=lambda x: x['revenue'], reverse=True)

        return Response({
            'summary': {
                'totalRevenue':      total_revenue,
                'totalTransactions': total,
                'storeRevenue':      store_revenue,
                'driverRevenue':     driver_revenue,
                'paymentBreakdown':  payment_breakdown,
                'productBreakdown':  product_breakdown,
                'dailyTotals':       daily_totals,
                'servedBreakdown':   served_breakdown,
            },
            'transactions': page_rows,
            'pagination': {
                'total':      total,
                'page':       page,
                'limit':      limit,
                'totalPages': total_pages,
            },
        })

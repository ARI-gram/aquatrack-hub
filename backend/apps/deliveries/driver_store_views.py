"""
apps/deliveries/driver_store_views.py

✅ selling_price added to DriverBottleStockView and DriverConsumableStockView GET responses
"""

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.deliveries.models import Delivery
from apps.deliveries.views import IsDriver
from apps.products.models import (
    Product,
    BottleMovement,
    ConsumableMovement,
    StockDistribution,
)


# ─── BALANCE HELPERS ──────────────────────────────────────────────────────────

def _compute_bottle_balance(driver, product) -> dict:
    qs = BottleMovement.objects.filter(driver=driver, product=product)

    distributed = qs.filter(movement_type='DISTRIBUTE').aggregate(
        good=Sum('qty_good'), damaged=Sum('qty_damaged'), missing=Sum('qty_missing'),
    )
    sold = qs.filter(movement_type='DIRECT_SALE').aggregate(
        good=Sum('qty_good'))
    used = qs.filter(movement_type='DELIVERY_USE').aggregate(
        good=Sum('qty_good'))

    # Empties collected from customers (on the road)
    collected = qs.filter(
        movement_type='RECEIVE_EMPTY',
        recorded_by__isnull=True,   # driver-side collection, not office
    ).aggregate(good=Sum('qty_good'))

    # Empties handed back to office
    returned_to_office = qs.filter(
        movement_type='RECEIVE_EMPTY',
        recorded_by__isnull=False,  # office staff recorded this
    ).aggregate(good=Sum('qty_good'), damaged=Sum('qty_damaged'))

    full = (
        (distributed['good'] or 0)
        - (sold['good'] or 0)
        - (used['good'] or 0)
    )

    # Driver's empty count = what they collected on road - what they already handed to office
    empty = (
        (collected['good'] or 0)
        - (returned_to_office['good'] or 0)
        - (returned_to_office['damaged'] or 0)
    )

    return {
        'full':    max(0, full),
        # ← now tracks real empties the driver is holding
        'empty':   max(0, empty),
        'damaged': distributed['damaged'] or 0,
        'missing': distributed['missing'] or 0,
    }


def _compute_consumable_balance(driver, product) -> dict:
    qs = ConsumableMovement.objects.filter(driver=driver, product=product)

    agg = qs.aggregate(
        distributed=Sum('quantity', filter=Q(movement_type='DISTRIBUTE')),
        sold=Sum('quantity',        filter=Q(movement_type='DIRECT_SALE')),
        used=Sum('quantity',        filter=Q(movement_type='DELIVERY_USE')),
    )

    in_stock = (
        (agg['distributed'] or 0)
        - (agg['sold'] or 0)
        - (agg['used'] or 0)
    )
    return {'in_stock': max(0, in_stock)}


def _last_loaded_bottle(driver, product):
    mv = (
        BottleMovement.objects
        .filter(driver=driver, product=product, movement_type='DISTRIBUTE')
        .order_by('-movement_date')
        .first()
    )
    return mv.movement_date.isoformat() if mv else None


def _last_loaded_consumable(driver, product):
    mv = (
        ConsumableMovement.objects
        .filter(driver=driver, product=product, movement_type='DISTRIBUTE')
        .order_by('-movement_date')
        .first()
    )
    return mv.movement_date.isoformat() if mv else None


def _product_image(product):
    url = getattr(product, 'image_url', None)
    if url:
        return url
    img = getattr(product, 'image', None)
    if img and hasattr(img, 'url'):
        try:
            return img.url
        except Exception:
            return None
    return None


# ─── STOCK DEDUCTION ──────────────────────────────────────────────────────────

def _deduct_delivery_stock(driver, order):
    import logging
    logger = logging.getLogger(__name__)

    try:
        items = order.items.select_related('product').all()
    except Exception:
        logger.warning(
            '_deduct_delivery_stock: could not fetch items for order %s', order.order_number)
        return

    for item in items:
        product = getattr(item, 'product', None)
        if product is None:
            continue

        qty = getattr(item, 'quantity', 0) or 0
        if qty < 1:
            continue

        try:
            if getattr(product, 'is_returnable', False):
                balance = _compute_bottle_balance(driver, product)
                deduct = min(qty, balance['full'])
                if deduct > 0:
                    BottleMovement.objects.create(
                        product=product,
                        driver=driver,
                        movement_type='DELIVERY_USE',
                        qty_good=deduct,
                        qty_damaged=0,
                        qty_missing=0,
                        notes=f'Auto-deducted on delivery completion (order {order.order_number})',
                    )
                    balance_after = _compute_bottle_balance(driver, product)
                    if balance_after['full'] < 10:
                        try:
                            from apps.notifications import notify
                            notify.driver_stock_low(
                                driver=driver,
                                product_name=product.name,
                                quantity_remaining=balance_after['full'],
                                client=driver.client,
                            )
                        except Exception:
                            pass
            else:
                balance = _compute_consumable_balance(driver, product)
                deduct = min(qty, balance['in_stock'])
                if deduct > 0:
                    ConsumableMovement.objects.create(
                        product=product,
                        driver=driver,
                        movement_type='DELIVERY_USE',
                        quantity=deduct,
                        notes=f'Auto-deducted on delivery completion (order {order.order_number})',
                    )
        except Exception as exc:
            logger.warning(
                '_deduct_delivery_stock: failed for product %s on order %s — %s',
                getattr(product, 'id', '?'), order.order_number, exc,
            )


# ─── VIEW: bottles ────────────────────────────────────────────────────────────

class DriverBottleStockView(APIView):
    """
    GET /api/driver/store/bottles/

    Returns van balance for every returnable product that has at least one
    BottleMovement for this driver.
    """
    permission_classes = [IsDriver]

    def get(self, request):
        driver = request.user

        product_ids = (
            BottleMovement.objects
            .filter(driver=driver, product__is_returnable=True)
            .values_list('product_id', flat=True)
            .distinct()
        )

        products = Product.objects.filter(
            id__in=product_ids,
            client=driver.client,
            status='ACTIVE',
        )

        result = []
        for product in products:
            result.append({
                'product_id':    str(product.id),
                'product_name':  product.name,
                'product_image': _product_image(product),
                # ✅ ADDED
                'selling_price': str(product.selling_price) if product.selling_price else None,
                'last_loaded':   _last_loaded_bottle(driver, product),
                'balance':       _compute_bottle_balance(driver, product),
            })

        return Response(result)


# ─── VIEW: consumables ────────────────────────────────────────────────────────

class DriverConsumableStockView(APIView):
    """
    GET /api/driver/store/consumables/

    Returns van balance for every non-returnable product distributed to this driver.
    """
    permission_classes = [IsDriver]

    def get(self, request):
        driver = request.user

        product_ids = (
            ConsumableMovement.objects
            .filter(driver=driver, product__is_returnable=False)
            .values_list('product_id', flat=True)
            .distinct()
        )

        products = Product.objects.filter(
            id__in=product_ids,
            client=driver.client,
            status='ACTIVE',
        )

        result = []
        for product in products:
            result.append({
                'product_id':    str(product.id),
                'product_name':  product.name,
                'product_image': _product_image(product),
                'unit':          product.unit or '',
                # ✅ ADDED
                'selling_price': str(product.selling_price) if product.selling_price else None,
                'last_loaded':   _last_loaded_consumable(driver, product),
                'balance':       _compute_consumable_balance(driver, product),
            })

        return Response(result)


# ─── VIEW: requirements ───────────────────────────────────────────────────────

class DriverStockRequirementsView(APIView):
    """
    GET /api/driver/store/requirements/
    """
    permission_classes = [IsDriver]

    def get(self, request):
        driver = request.user
        today = timezone.now().date()

        active_deliveries = (
            Delivery.objects
            .filter(
                driver=driver,
                status__in=[
                    'ASSIGNED', 'ACCEPTED', 'PICKED_UP',
                    'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS',
                ],
            )
            .filter(
                Q(scheduled_date=today) |
                Q(scheduled_date__isnull=True,
                  order__delivery__scheduled_date=today)
            )
            .select_related('order', 'order__bottle_exchange')
            .prefetch_related('order__items', 'order__items__product')
        )

        aggregated: dict = {}

        for delivery in active_deliveries:
            order = delivery.order
            try:
                items = order.items.select_related('product').all()
            except Exception:
                continue

            for item in items:
                product = getattr(item, 'product', None)
                if product is None:
                    continue

                pid = str(product.id)
                is_returnable = getattr(product, 'is_returnable', False)
                qty = getattr(item, 'quantity', 0) or 0

                if pid not in aggregated:
                    aggregated[pid] = {
                        'product_id':      pid,
                        'product_name':    product.name,
                        'product_type':    'bottle' if is_returnable else 'consumable',
                        'delivery_count':  0,
                        'bottles_needed':  0,
                        'bottles_collect': 0,
                        'units_needed':    0,
                    }

                aggregated[pid]['delivery_count'] += 1

                if is_returnable:
                    aggregated[pid]['bottles_needed'] += qty
                    try:
                        exchange = order.bottle_exchange
                        aggregated[pid]['bottles_collect'] += (
                            getattr(exchange, 'bottles_to_collect', 0) or 0
                        )
                    except Exception:
                        pass
                else:
                    aggregated[pid]['units_needed'] += qty

        return Response(list(aggregated.values()))


# ─── VIEW: history ────────────────────────────────────────────────────────────

class DriverStockHistoryView(APIView):
    """
    GET /api/driver/store/history/
    """
    permission_classes = [IsDriver]

    def get(self, request):
        driver = request.user

        bottle_mvs = (
            BottleMovement.objects
            .filter(driver=driver)
            .select_related('product')
            .order_by('-movement_date')[:50]
        )

        consumable_mvs = (
            ConsumableMovement.objects
            .filter(driver=driver)
            .select_related('product')
            .order_by('-movement_date')[:50]
        )

        rows = []

        for mv in bottle_mvs:
            product = getattr(mv, 'product', None)
            rows.append({
                'id':            str(mv.id),
                'movement_type': mv.movement_type,
                'movement_date': mv.movement_date.isoformat(),
                'product_name':  product.name if product else '',
                'quantity':      mv.qty_good + mv.qty_damaged + mv.qty_missing,
                'notes':         mv.notes or None,
                'payment_method': mv.payment_method or 'CASH',
                'unit_price':    str(product.selling_price) if product and product.selling_price else None,
                '_sort':         mv.movement_date,
            })

        for mv in consumable_mvs:
            product = getattr(mv, 'product', None)
            rows.append({
                'id':            str(mv.id),
                'movement_type': mv.movement_type,
                'movement_date': mv.movement_date.isoformat(),
                'product_name':  product.name if product else '',
                'quantity':      mv.quantity,
                'notes':         mv.notes or None,
                'unit_price':    str(product.selling_price) if product and product.selling_price else None,
                'payment_method': mv.payment_method or 'CASH',
                '_sort':         mv.movement_date,
            })

        rows.sort(key=lambda r: r['_sort'], reverse=True)
        for r in rows:
            del r['_sort']

        return Response(rows[:50])


# ─── VIEW: record use ─────────────────────────────────────────────────────────

class DriverRecordStockUseView(APIView):
    """
    POST /api/driver/store/use/
    """
    permission_classes = [IsDriver]

    ALLOWED_TYPES = {'DIRECT_SALE', 'DELIVERY_USE'}

    def post(self, request):
        product_id = request.data.get('product_id')
        product_type = request.data.get('product_type', 'consumable')
        notes = request.data.get('notes', '')
        movement_type = request.data.get('movement_type', 'DIRECT_SALE')
        customer_id = request.data.get('customer_id')

        if movement_type not in self.ALLOWED_TYPES:
            movement_type = 'DIRECT_SALE'

        if customer_id:
            try:
                from apps.customers.models import Customer
                customer = Customer.objects.get(
                    id=customer_id, client=request.user.client)
                prefix = f'Customer: {customer.full_name} ({customer.phone_number or customer.email})'
                # Only prepend if frontend hasn't already included it
                if prefix not in (notes or ''):
                    notes = f'{prefix} · {notes}'.strip(
                        ' ·') if notes else prefix
            except Exception:
                pass

        try:
            quantity = int(request.data.get('quantity', 0))
        except (TypeError, ValueError):
            return Response(
                {'error': 'quantity must be an integer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not product_id:
            return Response({'error': 'product_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if quantity < 1:
            return Response({'error': 'quantity must be at least 1.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.get(
                id=product_id, client=request.user.client, status='ACTIVE')
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        driver = request.user

        if product.is_returnable:
            balance = _compute_bottle_balance(driver, product)
            available = balance['full']
        else:
            balance = _compute_consumable_balance(driver, product)
            available = balance['in_stock']

        if quantity > available:
            return Response(
                {'error': f'Only {available} unit(s) available on your van.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if product.is_returnable:
            qty_collected = 0
            try:
                qty_collected = int(request.data.get('qty_collected', 0))
            except (TypeError, ValueError):
                qty_collected = 0
            # can't collect more than sold
            qty_collected = max(0, min(qty_collected, quantity))

            movement = BottleMovement.objects.create(
                product=product, driver=driver,
                movement_type=movement_type,
                qty_good=quantity, qty_damaged=0, qty_missing=0,
                unit_price=product.selling_price,
                total_amount=product.selling_price * quantity,
                payment_method=request.data.get('payment_method', 'CASH'),
                notes=notes,
                recorded_by=driver,
                customer_id=customer_id or None,
                customer_name=request.data.get('customer_name', ''),
            )

            # Record the empty collection as a RECEIVE_EMPTY movement back to driver's stock
            if qty_collected > 0:
                BottleMovement.objects.create(
                    product=product,
                    driver=driver,
                    movement_type='RECEIVE_EMPTY',
                    qty_expected=quantity,
                    qty_good=qty_collected,
                    qty_damaged=0,
                    qty_missing=max(0, quantity - qty_collected),
                    notes=f'Empties collected at point of sale (order ref: direct sale ×{quantity})',
                )
        else:
            movement = ConsumableMovement.objects.create(
                product=product, driver=driver,
                movement_type=movement_type,
                quantity=quantity,
                unit_price=product.selling_price,
                total_amount=product.selling_price * quantity,
                payment_method=request.data.get('payment_method', 'CASH'),
                notes=notes,
                recorded_by=driver,
                customer_id=customer_id or None,
                customer_name=request.data.get('customer_name', ''),

            )

        if customer_id:
            try:
                from apps.customers.models import Customer as _Customer
                _linked = _Customer.objects.get(
                    id=customer_id, client=request.user.client)
                from apps.notifications import notify as _notify
                _notify.driver_direct_sale_to_customer(
                    customer=_linked,
                    driver=request.user,
                    product_name=product.name,
                    quantity=quantity,
                )
            except Exception:
                pass

        return Response({
            'message':  f'Recorded {movement_type.replace("_", " ").lower()} of {quantity} × {product.name}.',
            'movement': {
                'id':            str(movement.id),
                'movement_type': movement_type,
                'movement_date': movement.movement_date.isoformat(),
                'product_name':  product.name,
                'quantity':      quantity,
                'qty_collected': qty_collected if product.is_returnable else None,
                'notes':         notes or None,
            },
        }, status=status.HTTP_201_CREATED)


# ── Client admin — all direct sales across all drivers ───────────────────────

class IsClientStaffInline(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'site_manager')
            and request.user.client_id is not None
        )


class ClientDirectSalesView(APIView):
    """GET /api/client/store/direct-sales/"""

    permission_classes = [IsClientStaffInline]

    def get(self, request):
        from apps.authentication.models import User as AuthUser
        driver_ids = AuthUser.objects.filter(
            role='driver', client=request.user.client, is_active=True,
        ).values_list('id', flat=True)

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        driver_id = request.query_params.get('driver_id')

        def _apply_filters(qs):
            if date_from:
                qs = qs.filter(movement_date__date__gte=date_from)
            if date_to:
                qs = qs.filter(movement_date__date__lte=date_to)
            if driver_id:
                qs = qs.filter(driver_id=driver_id)
            return qs

        bottle_qs = _apply_filters(
            BottleMovement.objects.filter(
                driver_id__in=driver_ids, movement_type='DIRECT_SALE',
            ).select_related('product', 'driver').order_by('-movement_date')[:300]
        )
        consumable_qs = _apply_filters(
            ConsumableMovement.objects.filter(
                driver_id__in=driver_ids, movement_type='DIRECT_SALE',
            ).select_related('product', 'driver').order_by('-movement_date')[:300]
        )

        def _driver_name(driver):
            return (getattr(driver, 'full_name', None) or '').strip() or driver.email

        rows = []
        for mv in bottle_qs:
            rows.append({
                'id':            str(mv.id),
                'movement_date': mv.movement_date.isoformat(),
                'product_name':  mv.product.name if mv.product else '',
                'product_type':  'bottle',
                'quantity':      mv.qty_good,
                'driver_name':   _driver_name(mv.driver),
                'driver_id':     str(mv.driver_id),
                'notes':         mv.notes or '',
            })
        for mv in consumable_qs:
            rows.append({
                'id':            str(mv.id),
                'movement_date': mv.movement_date.isoformat(),
                'product_name':  mv.product.name if mv.product else '',
                'product_type':  'consumable',
                'quantity':      mv.quantity,
                'driver_name':   _driver_name(mv.driver),
                'driver_id':     str(mv.driver_id),
                'notes':         mv.notes or '',
            })

        rows.sort(key=lambda r: r['movement_date'], reverse=True)
        return Response(rows[:300])

# ── Client admin — van stock for ALL drivers ──────────────────────────────────


class ClientDriverVanStockView(APIView):
    """
    GET /api/store/driver-stock/

    Returns the current van inventory for every active driver in the client.
    Only drivers who have at least one product on their van are included.

    Response shape:
      [
        {
          driver_id:      str,
          driver_name:    str,
          vehicle_number: str,
          total_items:    int,   # sum of full bottles + in-stock consumables
          bottles: [
            { product_id, product_name, selling_price, balance: {full, empty, damaged, missing} }
          ],
          consumables: [
            { product_id, product_name, unit, selling_price, balance: {in_stock} }
          ]
        },
        ...
      ]
    """
    permission_classes = [IsClientStaffInline]

    def get(self, request):
        from apps.authentication.models import User as AuthUser

        client = request.user.client

        drivers = AuthUser.objects.filter(
            client=client,
            role='driver',
            is_active=True,
        ).order_by('first_name', 'last_name')

        result = []

        for driver in drivers:
            # ── Bottles ────────────────────────────────────────────────────
            bottle_product_ids = (
                BottleMovement.objects
                .filter(driver=driver, product__is_returnable=True)
                .values_list('product_id', flat=True)
                .distinct()
            )
            bottle_products = Product.objects.filter(
                id__in=bottle_product_ids,
                client=client,
                status='ACTIVE',
            )

            bottles = []
            for product in bottle_products:
                balance = _compute_bottle_balance(driver, product)
                # Only include if there is anything on the van
                if any([balance['full'], balance['empty'], balance['damaged'], balance['missing']]):
                    bottles.append({
                        'product_id':    str(product.id),
                        'product_name':  product.name,
                        'selling_price': str(product.selling_price) if product.selling_price else None,
                        'balance':       balance,
                    })

            # ── Consumables ────────────────────────────────────────────────
            consumable_product_ids = (
                ConsumableMovement.objects
                .filter(driver=driver, product__is_returnable=False)
                .values_list('product_id', flat=True)
                .distinct()
            )
            consumable_products = Product.objects.filter(
                id__in=consumable_product_ids,
                client=client,
                status='ACTIVE',
            )

            consumables = []
            for product in consumable_products:
                balance = _compute_consumable_balance(driver, product)
                if balance['in_stock'] > 0:
                    consumables.append({
                        'product_id':    str(product.id),
                        'product_name':  product.name,
                        'unit':          product.unit or '',
                        'selling_price': str(product.selling_price) if product.selling_price else None,
                        'balance':       balance,
                    })

            # Skip entirely idle drivers
            if not bottles and not consumables:
                continue

            total_items = (
                sum(b['balance']['full'] for b in bottles) +
                sum(c['balance']['in_stock'] for c in consumables)
            )

            result.append({
                'driver_id':      str(driver.id),
                'driver_name':    f'{driver.first_name} {driver.last_name}'.strip() or driver.email,
                'vehicle_number': getattr(driver, 'vehicle_number', '') or '',
                'total_items':    total_items,
                'bottles':        bottles,
                'consumables':    consumables,
            })

        # Sort: most stock first
        result.sort(key=lambda r: r['total_items'], reverse=True)
        return Response(result)

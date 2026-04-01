"""
apps/products/store_views.py  — PATCHED

Notification wiring added:
  ReceiveEmptyView      → notify client admin (empties returned)
                          with issue severity if damaged/missing
  DistributeBottlesView → notify driver (stock loaded onto van)
                          + notify client admin if stock goes low  [already existed]
  DirectSaleBottleView  → notify customer (if linked account)
                          + notify client admin if stock goes low  [already existed]
  DistributeConsumableView  → notify driver (stock loaded)
                              + notify client admin if stock low   [already existed]
  DirectSaleConsumableView  → notify customer (if linked account)
                              + notify client admin if stock low   [already existed]

✅ selling_price added to BottleStoreView and ConsumableStoreView GET responses
"""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers as drf_serializers
from django.db.models import Sum, Q
from django.utils import timezone

from apps.products.models import Product, BottleMovement, ConsumableMovement
from apps.authentication.models import User

from apps.notifications import notify

BOTTLES_LOW_THRESHOLD = 10


# ── Permission ────────────────────────────────────────────────────────────────

class IsClientStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'site_manager')
            and request.user.client_id is not None
        )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _name(user):
    if not user:
        return None
    return f'{user.first_name} {user.last_name}'.strip() or user.email


def _bottle_balance(product_id):
    mvs = BottleMovement.objects.filter(product_id=product_id)

    # Only count store-level receives (recorded_by is set = store staff action)
    # Driver-side RECEIVE_EMPTY (collected at point of sale) have recorded_by=None
    store_receives = mvs.filter(
        movement_type='RECEIVE_EMPTY',
        recorded_by__isnull=False,
    )
    received_good = store_receives.aggregate(t=Sum('qty_good'))['t'] or 0
    received_damaged = store_receives.aggregate(t=Sum('qty_damaged'))['t'] or 0
    received_missing = store_receives.aggregate(t=Sum('qty_missing'))['t'] or 0

    refilled = mvs.filter(movement_type='REFILL').aggregate(
        t=Sum('qty_good'))['t'] or 0
    distributed = mvs.filter(movement_type='DISTRIBUTE').aggregate(
        t=Sum('qty_good'))['t'] or 0
    sold_direct = mvs.filter(movement_type='DIRECT_SALE').aggregate(
        t=Sum('qty_good'))['t'] or 0

    return {
        'full':    max(0, refilled - distributed - sold_direct),
        'empty':   max(0, received_good - refilled),
        'damaged': received_damaged,
        'missing': received_missing,
    }


def _expected_empties_from_driver(driver, product) -> int:
    """
    How many EMPTY bottles the store is still owed from this driver for this product.

    Formula:
      empties_collected_by_driver_on_road
      - empties_already_returned_to_office
    = outstanding empties that should come back

    This matches what the driver sees in their van stock screen.
    """
    from django.db.models import Sum
    from apps.products.models import BottleMovement

    qs = BottleMovement.objects.filter(driver=driver, product=product)

    # Empties collected by driver on the road (recorded_by = None means driver recorded it)
    collected = qs.filter(
        movement_type='RECEIVE_EMPTY',
        recorded_by__isnull=True,
    ).aggregate(t=Sum('qty_good'))['t'] or 0

    # Empties already handed back to the office (recorded_by = store staff)
    returned = qs.filter(
        movement_type='RECEIVE_EMPTY',
        recorded_by__isnull=False,
    ).aggregate(
        good=Sum('qty_good'),
        damaged=Sum('qty_damaged'),
    )
    returned_total = (returned['good'] or 0) + (returned['damaged'] or 0)

    outstanding = collected - returned_total
    return max(0, outstanding)


def _consumable_balance(product_id):
    mvs = ConsumableMovement.objects.filter(product_id=product_id)
    received = mvs.filter(movement_type='RECEIVE').aggregate(
        t=Sum('quantity'))['t'] or 0
    distributed = mvs.filter(movement_type='DISTRIBUTE').aggregate(
        t=Sum('quantity'))['t'] or 0
    sold_direct = mvs.filter(movement_type='DIRECT_SALE').aggregate(
        t=Sum('quantity'))['t'] or 0
    return {'in_stock': max(0, received - distributed - sold_direct)}


class DriverExpectedEmptiesView(APIView):
    """
    GET /api/store/bottles/expected-empties/

    Returns the outstanding empties balance for every (driver, product) pair
    where the store is still owed empties.

    Optional query params:
      driver_id  – filter to one driver
      product_id – filter to one product
    """
    permission_classes = [IsClientStaff]

    def get(self, request):
        from apps.authentication.models import User as AuthUser
        from apps.products.models import Product, BottleMovement
        from django.db.models import Sum

        client = request.user.client

        # Find every (driver_id, product_id) pair that has had at least one
        # DISTRIBUTE movement — these are the only pairs that could owe empties.
        driver_id_filter = request.query_params.get('driver_id')
        product_id_filter = request.query_params.get('product_id')

        distribute_qs = BottleMovement.objects.filter(
            driver__client=client,
            driver__role='driver',
            movement_type='DISTRIBUTE',
        ).values('driver_id', 'product_id').distinct()

        if driver_id_filter:
            distribute_qs = distribute_qs.filter(driver_id=driver_id_filter)
        if product_id_filter:
            distribute_qs = distribute_qs.filter(product_id=product_id_filter)

        rows = []
        for pair in distribute_qs:
            driver_id = pair['driver_id']
            product_id = pair['product_id']

            try:
                driver = AuthUser.objects.get(
                    pk=driver_id, client=client, role='driver')
                product = Product.objects.get(
                    pk=product_id, client=client, is_returnable=True)
            except (AuthUser.DoesNotExist, Product.DoesNotExist):
                continue

            expected = _expected_empties_from_driver(driver, product)
            if expected <= 0:
                continue   # already cleared — nothing outstanding

            # Last delivery date for this driver+product
            last_mv = (
                BottleMovement.objects
                .filter(driver=driver, product=product, movement_type='DISTRIBUTE')
                .order_by('-movement_date')
                .first()
            )

            rows.append({
                'driver_id':        str(driver.id),
                'driver_name':      f'{driver.first_name} {driver.last_name}'.strip() or driver.email,
                'vehicle_number':   getattr(driver, 'vehicle_number', '') or '',
                'product_id':       str(product.id),
                'product_name':     product.name,
                'expected_qty':     expected,
                'last_deliver_date': last_mv.movement_date.isoformat() if last_mv else None,
            })

        # Sort: most outstanding first
        rows.sort(key=lambda r: r['expected_qty'], reverse=True)
        return Response(rows)

# ── Serializers ───────────────────────────────────────────────────────────────


class BottleMovementSerializer(drf_serializers.ModelSerializer):
    driver_name = drf_serializers.SerializerMethodField()
    recorded_by_name = drf_serializers.SerializerMethodField()
    product_name = drf_serializers.CharField(
        source='product.name', read_only=True)
    qty_total = drf_serializers.IntegerField(read_only=True)
    movement_type_display = drf_serializers.CharField(
        source='get_movement_type_display', read_only=True)

    class Meta:
        model = BottleMovement
        fields = [
            'id', 'product', 'product_name',
            'movement_type', 'movement_type_display',
            'qty_good', 'qty_damaged', 'qty_missing', 'qty_expected', 'qty_total',
            'driver', 'driver_name', 'vehicle_number',
            'customer', 'customer_name',
            'notes', 'recorded_by', 'recorded_by_name', 'movement_date',
        ]

    def get_driver_name(self, obj): return _name(obj.driver)
    def get_recorded_by_name(self, obj): return _name(obj.recorded_by)


class ConsumableMovementSerializer(drf_serializers.ModelSerializer):
    driver_name = drf_serializers.SerializerMethodField()
    recorded_by_name = drf_serializers.SerializerMethodField()
    product_name = drf_serializers.CharField(
        source='product.name', read_only=True)
    movement_type_display = drf_serializers.CharField(
        source='get_movement_type_display', read_only=True)

    class Meta:
        model = ConsumableMovement
        fields = [
            'id', 'product', 'product_name',
            'movement_type', 'movement_type_display',
            'quantity', 'driver', 'driver_name', 'vehicle_number',
            'customer', 'customer_name', 'supplier_name', 'unit_price',
            'notes', 'recorded_by', 'recorded_by_name', 'movement_date',
        ]

    def get_driver_name(self, obj): return _name(obj.driver)
    def get_recorded_by_name(self, obj): return _name(obj.recorded_by)


# ── Bottle Views ──────────────────────────────────────────────────────────────

class BottleStoreView(APIView):
    """GET /api/store/bottles/"""
    permission_classes = [IsClientStaff]

    def get(self, request):
        client = request.user.client
        products = Product.objects.filter(
            client=client, is_returnable=True, status='ACTIVE')

        data = []
        for p in products:
            balance = _bottle_balance(p.id)
            history = BottleMovement.objects.filter(product=p).select_related(
                'driver', 'recorded_by', 'customer').order_by('-movement_date')[:20]
            data.append({
                'product_id':    str(p.id),
                'product_name':  p.name,
                'product_image': getattr(p, 'image_url', None),
                # ✅ ADDED
                'selling_price': str(p.selling_price) if p.selling_price else None,
                'balance':       balance,
                'history':       BottleMovementSerializer(history, many=True).data,
            })
        return Response(data)


class ReceiveEmptyView(APIView):
    """
    POST /api/store/bottles/receive-empty/

    Request body (new fields):
      short_reason  str   – required when qty_received < expected_qty
      over_reason   str   – required when qty_received > expected_qty
      (both are optional when the count matches exactly)

    Response (new fields):
      expected_before   int   – outstanding before this receive
      outstanding_after int   – outstanding after this receive
      cleared           bool  – True if the driver's balance is now 0
    """
    permission_classes = [IsClientStaff]

    def post(self, request):
        data = request.data
        client = request.user.client

        try:
            product = Product.objects.get(
                pk=data.get('product'), client=client, is_returnable=True)
        except Product.DoesNotExist:
            return Response(
                {'error': 'Returnable product not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        qty_expected = int(data.get('qty_expected', 0))
        qty_good = int(data.get('qty_good',     0))
        qty_damaged = int(data.get('qty_damaged',  0))
        qty_missing = max(0, qty_expected - qty_good - qty_damaged)
        qty_received = qty_good + qty_damaged     # total physically returned

        driver = vehicle_number = None
        driver_id = data.get('driver_id')
        if driver_id:
            driver = User.objects.filter(
                pk=driver_id, client=client, role='driver').first()
            if driver:
                vehicle_number = getattr(driver, 'vehicle_number', '') or ''

# ── Guard: driver must have been distributed stock first ──────────
        if driver:
            ever_distributed = BottleMovement.objects.filter(
                driver=driver,
                product=product,
                movement_type='DISTRIBUTE',
            ).exists()

            if not ever_distributed:
                return Response(
                    {
                        'error': (
                            f'{driver.first_name or driver.email} has never been '
                            f'distributed any {product.name}. '
                            'Cannot receive empties for stock that was never issued.'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # ── Outstanding before this receive ───────────────────────────────
        expected_before = (
            _expected_empties_from_driver(
                driver, product) if driver else qty_expected
        )

        # ── Guard: cannot receive more than driver actually owes ──────────
        if driver and qty_received > expected_before and not data.get('over_reason'):
            return Response(
                {
                    'error': (
                        f'You are trying to receive {qty_received} empties but '
                        f'{driver.first_name or driver.email} only owes '
                        f'{expected_before}. '
                        'Provide an over_reason if this is intentional.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Reason handling ───────────────────────────────────────────────
        short_reason = (data.get('short_reason') or '').strip()
        over_reason = (data.get('over_reason') or '').strip()
        base_notes = (data.get('notes') or '').strip()

        notes_parts = []
        if driver and expected_before > 0 and qty_received < expected_before and not short_reason:
            return Response(
                {'error': 'Please provide a reason for the shortage.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if driver and expected_before > 0 and qty_received > expected_before and not over_reason:
            return Response(
                {'error': 'Please provide a reason for the excess return.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if short_reason:
            notes_parts.append(f'Short reason: {short_reason}')
        if over_reason:
            notes_parts.append(f'Over reason: {over_reason}')

        notes = ' | '.join(notes_parts)

        # ── Create movement ───────────────────────────────────────────────
        mv = BottleMovement.objects.create(
            product=product,
            movement_type='RECEIVE_EMPTY',
            qty_expected=qty_expected,
            qty_good=qty_good,
            qty_damaged=qty_damaged,
            qty_missing=qty_missing,
            driver=driver,
            vehicle_number=vehicle_number or '',
            notes=notes,
            recorded_by=request.user,
        )

        # ── Outstanding after ─────────────────────────────────────────────
        outstanding_after = (
            _expected_empties_from_driver(driver, product) if driver else 0
        )
        cleared = driver is not None and outstanding_after == 0

        # ── Notifications ─────────────────────────────────────────────────
        if driver:
            notify.empties_received_from_driver(
                driver=driver,
                product_name=product.name,
                qty_good=qty_good,
                qty_damaged=qty_damaged,
                qty_missing=qty_missing,
                client=client,
            )
            if qty_missing > 0 or qty_damaged > 0:
                notify.driver_empties_shortage(
                    driver=driver,
                    product_name=product.name,
                    qty_expected=qty_expected,
                    qty_good=qty_good,
                    qty_damaged=qty_damaged,
                    qty_missing=qty_missing,
                )

        EMPTIES_LOW_THRESHOLD = 20
        balance_after = _bottle_balance(product.id)
        if balance_after['empty'] < EMPTIES_LOW_THRESHOLD:
            notify.store_empties_low(
                client, product.name, balance_after['empty'])

        return Response({
            'movement':          BottleMovementSerializer(mv).data,
            'balance':           balance_after,
            # ── new fields ──
            'expected_before':   expected_before,
            'outstanding_after': outstanding_after,
            'cleared':           cleared,
        }, status=status.HTTP_201_CREATED)


class RefillBottlesView(APIView):
    """
    POST /api/store/bottles/refill/
    Internal warehouse operation — no outbound notifications needed.
    """
    permission_classes = [IsClientStaff]

    def post(self, request):
        data = request.data
        client = request.user.client

        try:
            product = Product.objects.get(pk=data.get(
                'product'), client=client, is_returnable=True)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=404)

        quantity = int(data.get('quantity', 0))
        if quantity < 1:
            return Response({'error': 'Quantity must be at least 1.'}, status=status.HTTP_400_BAD_REQUEST)

        balance = _bottle_balance(product.id)
        if quantity > balance['empty']:
            return Response(
                {'error': f'Only {balance["empty"]} empties available to refill.',
                    'empty_available': balance['empty']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mv = BottleMovement.objects.create(
            product=product,
            movement_type='REFILL',
            qty_good=quantity,
            notes=data.get('notes', ''),
            recorded_by=request.user,
        )

        return Response({'movement': BottleMovementSerializer(mv).data, 'balance': _bottle_balance(product.id)},
                        status=status.HTTP_201_CREATED)


class DistributeBottlesView(APIView):
    """
    POST /api/store/bottles/distribute/

    Notifies:
      → Driver (STOCK_PICKUP)  — bottles loaded onto their van
      → Client admin (BOTTLES_LOW) — if warehouse stock drops below threshold
    """
    permission_classes = [IsClientStaff]

    def post(self, request):
        data = request.data
        client = request.user.client

        try:
            product = Product.objects.get(pk=data.get(
                'product'), client=client, is_returnable=True)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=404)

        quantity = int(data.get('quantity', 0))
        if quantity < 1:
            return Response({'error': 'Quantity must be at least 1.'}, status=400)

        balance = _bottle_balance(product.id)
        if quantity > balance['full']:
            return Response(
                {'error': f'Only {balance["full"]} full bottles available.',
                    'full_available': balance['full']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        driver = vehicle_number = None
        driver_id = data.get('driver_id')
        if driver_id:
            driver = User.objects.filter(
                pk=driver_id, client=client, role='driver').first()
            if driver:
                vehicle_number = getattr(driver, 'vehicle_number', '') or ''

        mv = BottleMovement.objects.create(
            product=product,
            movement_type='DISTRIBUTE',
            qty_good=quantity,
            driver=driver,
            vehicle_number=vehicle_number or '',
            notes=data.get('notes', ''),
            recorded_by=request.user,
        )

        balance_after = _bottle_balance(product.id)

        if driver:
            notify.bottles_distributed_to_driver(
                driver=driver,
                product_name=product.name,
                quantity=quantity,
                client=client,
            )

        if balance_after['full'] < BOTTLES_LOW_THRESHOLD:
            notify.bottles_low(client, product.name, balance_after['full'])

        return Response({'movement': BottleMovementSerializer(mv).data, 'balance': balance_after},
                        status=status.HTTP_201_CREATED)


class DirectSaleBottleView(APIView):
    permission_classes = [IsClientStaff]

    def post(self, request):
        data = request.data
        client = request.user.client

        try:
            product = Product.objects.get(
                pk=data.get('product'), client=client, is_returnable=True)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=404)

        quantity = int(data.get('quantity', 0))
        if quantity < 1:
            return Response({'error': 'Quantity must be at least 1.'}, status=400)

        balance = _bottle_balance(product.id)
        if quantity > balance['full']:
            return Response(
                {'error': f'Only {balance["full"]} full bottles in stock.'},
                status=400,
            )

        # ── NEW: empties collected from customer during this sale ─────────────
        try:
            qty_collected = int(data.get('qty_collected', 0))
        except (TypeError, ValueError):
            qty_collected = 0
        qty_collected = max(0, min(qty_collected, quantity))

        linked_customer = None
        customer_id = data.get('customer_id') or None
        if customer_id:
            try:
                from apps.customers.models import Customer
                linked_customer = Customer.objects.get(
                    pk=customer_id, client=client)
            except Exception:
                pass

        mv = BottleMovement.objects.create(
            product=product,
            movement_type='DIRECT_SALE',
            qty_good=quantity,
            customer_id=customer_id,
            customer_name=data.get('customer_name', ''),
            unit_price=product.selling_price,
            total_amount=product.selling_price * quantity,
            payment_method=data.get('payment_method', 'CASH'),
            notes=data.get('notes', ''),
            recorded_by=request.user,
        )

        # ── NEW: record returned empties into store stock ─────────────────────
        if qty_collected > 0:
            BottleMovement.objects.create(
                product=product,
                movement_type='RECEIVE_EMPTY',
                qty_expected=quantity,
                qty_good=qty_collected,
                qty_damaged=0,
                qty_missing=max(0, quantity - qty_collected),
                customer_name=data.get('customer_name', ''),
                notes=(
                    f'Empties collected at store direct sale '
                    f'(×{quantity} sold, ×{qty_collected} returned)'
                ),
                recorded_by=request.user,
            )

        balance_after = _bottle_balance(product.id)

        if linked_customer:
            notify.direct_sale_recorded(
                customer=linked_customer,
                product_name=product.name,
                quantity=quantity,
            )

        if balance_after['full'] < BOTTLES_LOW_THRESHOLD:
            notify.bottles_low(client, product.name, balance_after['full'])

        return Response(
            {
                'movement': BottleMovementSerializer(mv).data,
                'balance': balance_after,
                'qty_collected': qty_collected,            # ← new
                'outstanding': max(0, quantity - qty_collected),  # ← new
            },
            status=status.HTTP_201_CREATED,
        )

# ── Consumable Views ──────────────────────────────────────────────────────────


class ConsumableStoreView(APIView):
    """GET /api/store/consumables/"""
    permission_classes = [IsClientStaff]

    def get(self, request):
        client = request.user.client
        products = Product.objects.filter(
            client=client, is_returnable=False, status='ACTIVE')

        data = []
        for p in products:
            balance = _consumable_balance(p.id)
            history = ConsumableMovement.objects.filter(product=p).select_related(
                'driver', 'recorded_by', 'customer').order_by('-movement_date')[:20]
            data.append({
                'product_id':    str(p.id),
                'product_name':  p.name,
                'product_image': getattr(p, 'image_url', None),
                'unit':          p.unit,
                # ✅ ADDED
                'selling_price': str(p.selling_price) if p.selling_price else None,
                'balance':       balance,
                'history':       ConsumableMovementSerializer(history, many=True).data,
            })
        return Response(data)


class ReceiveConsumableView(APIView):
    """
    POST /api/store/consumables/receive/
    Supplier delivery — internal warehouse operation, no outbound notifications.
    """
    permission_classes = [IsClientStaff]

    def post(self, request):
        data = request.data
        client = request.user.client

        try:
            product = Product.objects.get(pk=data.get(
                'product'), client=client, is_returnable=False)
        except Product.DoesNotExist:
            return Response({'error': 'Consumable product not found.'}, status=404)

        quantity = int(data.get('quantity', 0))
        if quantity < 1:
            return Response({'error': 'Quantity must be at least 1.'}, status=400)

        mv = ConsumableMovement.objects.create(
            product=product,
            movement_type='RECEIVE',
            quantity=quantity,
            supplier_name=data.get('supplier_name', ''),
            notes=data.get('notes', ''),
            recorded_by=request.user,
        )

        return Response({'movement': ConsumableMovementSerializer(mv).data, 'balance': _consumable_balance(product.id)},
                        status=status.HTTP_201_CREATED)


class DistributeConsumableView(APIView):
    """
    POST /api/store/consumables/distribute/

    Notifies:
      → Driver (STOCK_PICKUP)  — consumables loaded onto their van
      → Client admin (BOTTLES_LOW) — if stock drops below threshold
    """
    permission_classes = [IsClientStaff]

    def post(self, request):
        data = request.data
        client = request.user.client

        try:
            product = Product.objects.get(pk=data.get(
                'product'), client=client, is_returnable=False)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=404)

        quantity = int(data.get('quantity', 0))
        if quantity < 1:
            return Response({'error': 'Quantity must be at least 1.'}, status=400)

        balance = _consumable_balance(product.id)
        if quantity > balance['in_stock']:
            return Response({'error': f'Only {balance["in_stock"]} units in stock.'}, status=400)

        driver = vehicle_number = None
        driver_id = data.get('driver_id')
        if driver_id:
            driver = User.objects.filter(
                pk=driver_id, client=client, role='driver').first()
            if driver:
                vehicle_number = getattr(driver, 'vehicle_number', '') or ''

        mv = ConsumableMovement.objects.create(
            product=product,
            movement_type='DISTRIBUTE',
            quantity=quantity,
            driver=driver,
            vehicle_number=vehicle_number or '',
            notes=data.get('notes', ''),
            recorded_by=request.user,
        )

        balance_after = _consumable_balance(product.id)

        if driver:
            notify.bottles_distributed_to_driver(
                driver=driver,
                product_name=product.name,
                quantity=quantity,
                client=client,
            )

        if balance_after['in_stock'] < BOTTLES_LOW_THRESHOLD:
            notify.bottles_low(client, product.name, balance_after['in_stock'])

        return Response({'movement': ConsumableMovementSerializer(mv).data, 'balance': balance_after},
                        status=status.HTTP_201_CREATED)


class DirectSaleConsumableView(APIView):
    """
    POST /api/store/consumables/direct-sale/

    Notifies:
      → Customer (PAYMENT_SUCCESS) — if the sale is linked to a known account
      → Client admin (BOTTLES_LOW) — if stock drops below threshold
    """
    permission_classes = [IsClientStaff]

    def post(self, request):
        data = request.data
        client = request.user.client

        try:
            product = Product.objects.get(pk=data.get(
                'product'), client=client, is_returnable=False)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=404)

        quantity = int(data.get('quantity', 0))
        if quantity < 1:
            return Response({'error': 'Quantity must be at least 1.'}, status=400)

        balance = _consumable_balance(product.id)
        if quantity > balance['in_stock']:
            return Response({'error': f'Only {balance["in_stock"]} units in stock.'}, status=400)

        linked_customer = None
        customer_id = data.get('customer_id') or None
        if customer_id:
            try:
                from apps.customers.models import Customer
                linked_customer = Customer.objects.get(
                    pk=customer_id, client=client)
            except Exception:
                pass

        mv = ConsumableMovement.objects.create(
            product=product,
            movement_type='DIRECT_SALE',
            quantity=quantity,
            customer_id=customer_id,
            customer_name=data.get('customer_name', ''),
            unit_price=data.get('unit_price') or product.selling_price,
            total_amount=(data.get('unit_price')
                          or product.selling_price) * quantity,
            payment_method=data.get('payment_method', 'CASH'),
            notes=data.get('notes', ''),
            recorded_by=request.user,
        )

        balance_after = _consumable_balance(product.id)

        if linked_customer:
            notify.direct_sale_recorded(
                customer=linked_customer,
                product_name=product.name,
                quantity=quantity,
            )

        if balance_after['in_stock'] < BOTTLES_LOW_THRESHOLD:
            notify.bottles_low(client, product.name, balance_after['in_stock'])

        return Response({'movement': ConsumableMovementSerializer(mv).data, 'balance': balance_after},
                        status=status.HTTP_201_CREATED)

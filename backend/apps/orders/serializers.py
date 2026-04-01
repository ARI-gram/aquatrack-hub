"""
Order Serializers for AquaTrack
apps/orders/serializers.py
"""
from rest_framework import serializers
from decimal import Decimal
from django.utils import timezone

from apps.orders.models import Order, OrderItem, OrderDelivery, OrderTimeline, BottleExchange
from apps.customers.models import CustomerAddress
from apps.products.models import Product


# ── Nested read serializers ───────────────────────────────────────────────────

class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'product_name', 'product_unit',
            'quantity', 'unit_price', 'subtotal',
        ]
        read_only_fields = fields


class OrderDeliverySerializer(serializers.ModelSerializer):
    address_label = serializers.CharField(
        source='delivery_address.label',  read_only=True)
    full_address = serializers.CharField(
        source='delivery_address.address', read_only=True)
    driver_name = serializers.SerializerMethodField()
    driver_phone = serializers.SerializerMethodField()

    class Meta:
        model = OrderDelivery
        fields = [
            'scheduled_date', 'scheduled_time_slot',
            'address_label', 'full_address',
            'driver_name', 'driver_phone',
            'actual_delivery_time', 'delivery_notes',
        ]

    def get_driver_name(self, obj):
        if obj.assigned_driver:
            return f"{obj.assigned_driver.first_name} {obj.assigned_driver.last_name}".strip()
        return None

    def get_driver_phone(self, obj):
        return getattr(obj.assigned_driver, 'phone_number', None) if obj.assigned_driver else None


class OrderTimelineSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderTimeline
        fields = ['status', 'timestamp', 'notes']


class BottleExchangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BottleExchange
        fields = [
            'bottles_to_deliver', 'bottles_to_collect',
            'bottles_delivered',  'bottles_collected',
            'exchange_confirmed', 'confirmed_at',
        ]


# ── Main read serializer ──────────────────────────────────────────────────────

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    delivery = OrderDeliverySerializer(read_only=True)
    timeline = OrderTimelineSerializer(many=True, read_only=True)
    bottle_exchange = BottleExchangeSerializer(read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()

    def get_customer_name(self, obj):
        return getattr(obj.customer, 'full_name', None) or '—'

    def get_customer_phone(self, obj):
        return getattr(obj.customer, 'phone_number', None)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'order_type', 'status',
            'subtotal', 'delivery_fee', 'discount_amount', 'total_amount',
            'payment_status', 'payment_method', 'paid_at',
            'special_instructions',
            'is_manual_order', 'require_otp',   # ← ADD THESE TWO
            'items', 'delivery', 'timeline', 'bottle_exchange',
            'created_at', 'updated_at', 'customer_name', 'customer_phone',
        ]
        read_only_fields = fields


# ── Write serializers ─────────────────────────────────────────────────────────

class OrderItemCreateSerializer(serializers.Serializer):
    """One line item in the order request."""
    product_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, max_value=50)


class OrderCreateSerializer(serializers.Serializer):
    """
    Validates and creates a new customer order.
    Prices are pulled live from the Product catalogue.
    order_type is auto-derived from the products in the cart.

    Address can be supplied in one of two ways:
      - delivery_address_id   (int)  — use a saved address by ID
      - delivery_address_text (str)  — free-text / Google Maps result;
                                       automatically saved to the customer's
                                       address book for future orders.

    Exactly one of the two must be provided.

    Expected payload:
    {
        "delivery_address_id":    1,                    // OR
        "delivery_address_text":  "Westlands, Nairobi",
        "delivery_address_label": "Home",               // optional, used with text
        "scheduled_date":         "YYYY-MM-DD",
        "scheduled_time_slot":    "7:00 AM - 10:00 AM",
        "items": [
            { "product_id": "<uuid>", "quantity": 2 }
        ],
        "payment_method":         "MPESA" | "CASH" | "WALLET" | "CREDIT",
        "special_instructions":   "optional string"
    }
    """

    # Address — one of two forms
    delivery_address_id = serializers.UUIDField(required=False)
    delivery_address_text = serializers.CharField(
        required=False, allow_blank=False, max_length=500)
    delivery_address_label = serializers.CharField(
        required=False, allow_blank=True, max_length=100, default='Delivery address')

    scheduled_date = serializers.DateField()
    scheduled_time_slot = serializers.CharField(max_length=50)
    items = OrderItemCreateSerializer(many=True, min_length=1)
    payment_method = serializers.ChoiceField(
        choices=['MPESA', 'CASH', 'WALLET', 'CREDIT'],
    )
    special_instructions = serializers.CharField(
        required=False, allow_blank=True, default='',
    )

    # ── Field-level validation ────────────────────────────────────────────────

    def validate_delivery_address_id(self, value):
        customer = self.context['request'].user.customer
        try:
            CustomerAddress.objects.get(
                id=value, customer=customer, is_active=True)
        except CustomerAddress.DoesNotExist:
            raise serializers.ValidationError(
                'Address not found or does not belong to your account.')
        return value

    def validate_scheduled_date(self, value):
        if value < timezone.now().date():
            raise serializers.ValidationError(
                'Scheduled date cannot be in the past.')
        return value

    def validate_items(self, items_data):
        customer = self.context['request'].user.customer
        errors = []

        for i, item in enumerate(items_data):
            try:
                product = Product.objects.get(
                    id=item['product_id'],
                    client=customer.client,
                    status='ACTIVE',
                    is_available=True,
                )
                item['_product'] = product
            except Product.DoesNotExist:
                errors.append(
                    f"Item {i + 1}: product not found or not available.")

        if errors:
            raise serializers.ValidationError(errors)

        return items_data

    def validate(self, data):
        has_id = bool(data.get('delivery_address_id'))
        has_text = bool(data.get('delivery_address_text', '').strip())

        if not has_id and not has_text:
            raise serializers.ValidationError(
                {'delivery_address': 'Please provide a delivery address.'})

        if has_id and has_text:
            data.pop('delivery_address_text', None)
            data.pop('delivery_address_label', None)

        return data

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _derive_order_type(items_data) -> str:
        units = {item['_product'].unit for item in items_data}
        if units == {'LITRES'}:
            return 'REFILL'
        if units == {'BOTTLES'}:
            return 'NEW_BOTTLE'
        return 'MIXED'

    def _resolve_address(self, validated_data, customer) -> CustomerAddress:
        """
        Returns a CustomerAddress.
        For free-text addresses, creates and saves a new record automatically
        so it appears in the customer's saved addresses next time.
        """
        address_id = validated_data.get('delivery_address_id')
        if address_id:
            return CustomerAddress.objects.get(
                id=address_id, customer=customer, is_active=True)

        address_text = validated_data['delivery_address_text'].strip()
        address_label = (validated_data.get(
            'delivery_address_label') or 'Delivery address').strip()

        address = CustomerAddress.objects.create(
            customer=customer,
            label=address_label,
            address=address_text,
            is_active=True,
            is_default=False,
        )
        return address

    # ── Create ────────────────────────────────────────────────────────────────

    def create(self, validated_data):
        from django.db import transaction

        request = self.context['request']
        customer = request.user.customer
        client = customer.client
        items_data = validated_data['items']

        subtotal = Decimal('0.00')
        delivery_fee = Decimal('0.00')

        for item in items_data:
            subtotal += item['_product'].selling_price * item['quantity']
            product_fee = item['_product'].delivery_fee or Decimal('0.00')
            if product_fee > delivery_fee:
                delivery_fee = product_fee

        total_amount = subtotal + delivery_fee

        order_type = self._derive_order_type(items_data)
        year = timezone.now().year
        last_order = Order.objects.order_by('-id').first()
        seq = (last_order.pk if last_order else 0) + 1
        order_number = f"ORD-{year}-{seq:06d}"

        with transaction.atomic():
            address = self._resolve_address(validated_data, customer)

            order = Order.objects.create(
                order_number=order_number,
                customer=customer,
                client=client,
                order_type=order_type,
                status='PENDING',
                subtotal=subtotal,
                delivery_fee=delivery_fee,
                total_amount=total_amount,
                payment_status='PENDING',
                payment_method=validated_data['payment_method'],
                special_instructions=validated_data.get(
                    'special_instructions', ''),
            )

            bottles_to_deliver = 0
            bottles_to_collect = 0

            for item_data in items_data:
                product = item_data['_product']
                qty = item_data['quantity']

                OrderItem.objects.create(
                    order=order,
                    product=product,
                    product_name=product.name,
                    product_unit=product.unit,
                    quantity=qty,
                    unit_price=product.selling_price,
                    subtotal=product.selling_price * qty,
                )

                bottles_to_deliver += qty
                if product.unit == 'BOTTLES':
                    bottles_to_collect += qty

            OrderDelivery.objects.create(
                order=order,
                delivery_address=address,
                scheduled_date=validated_data['scheduled_date'],
                scheduled_time_slot=validated_data['scheduled_time_slot'],
            )

            BottleExchange.objects.create(
                order=order,
                bottles_to_deliver=bottles_to_deliver,
                bottles_to_collect=bottles_to_collect,
            )

            if validated_data['payment_method'] == 'WALLET':
                self._charge_wallet(order, customer, total_amount)

            customer.last_order_date = timezone.now()
            customer.save(update_fields=['last_order_date'])

        return order

    def _charge_wallet(self, order: Order, customer, amount: Decimal) -> None:
        if not hasattr(customer, 'wallet'):
            raise serializers.ValidationError(
                'Wallet not found. Please top up your wallet first.')

        wallet = customer.wallet
        if wallet.current_balance < amount:
            raise serializers.ValidationError(
                f'Insufficient wallet balance. '
                f'Available: KES {wallet.current_balance}, '
                f'Required: KES {amount}')

        from apps.wallet.models import WalletTransaction
        WalletTransaction.objects.create(
            wallet=wallet,
            transaction_type='PAYMENT',
            amount=amount,
            balance_before=wallet.current_balance,
            balance_after=wallet.current_balance - amount,
            order=order,
            description=f'Payment for order {order.order_number}',
            status='COMPLETED',
            completed_at=timezone.now(),
        )

        wallet.current_balance -= amount
        wallet.total_spent = getattr(
            wallet, 'total_spent', Decimal('0.00')) + amount
        wallet.save(update_fields=['current_balance', 'total_spent'])

        order.payment_status = 'PAID'
        order.paid_at = timezone.now()
        order.status = 'CONFIRMED'
        order.save(update_fields=['payment_status', 'paid_at', 'status'])


class AdminOrderCreateSerializer(serializers.Serializer):
    """
    Allows a client_admin or site_manager to create an order on behalf
    of any customer in their client. Used for phone/WhatsApp orders.

    POST /api/orders/admin-create/
    {
        "customer_id":         "<uuid>",
        "delivery_address_id": "<uuid>",          // OR
        "delivery_address_text": "Westlands...",
        "delivery_address_label": "Home",
        "scheduled_date":      "YYYY-MM-DD",
        "scheduled_time_slot": "9:00 AM - 12:00 PM",
        "items": [{ "product_id": "<uuid>", "quantity": 2 }],
        "payment_method":      "CASH",
        "require_otp":         false,
        "special_instructions": ""
    }
    """
    customer_id = serializers.UUIDField()
    delivery_address_id = serializers.UUIDField(required=False)
    delivery_address_text = serializers.CharField(
        required=False, allow_blank=False, max_length=500)
    delivery_address_label = serializers.CharField(
        required=False, allow_blank=True, max_length=100, default='Delivery address')
    scheduled_date = serializers.DateField()
    scheduled_time_slot = serializers.CharField(max_length=50)
    items = OrderItemCreateSerializer(many=True, min_length=1)
    payment_method = serializers.ChoiceField(
        choices=['MPESA', 'CASH', 'WALLET', 'CREDIT'])
    require_otp = serializers.BooleanField(default=True)
    special_instructions = serializers.CharField(
        required=False, allow_blank=True, default='')

    def validate_customer_id(self, value):
        from apps.customers.models import Customer
        admin = self.context['request'].user
        try:
            customer = Customer.objects.get(id=value, client=admin.client)
        except Customer.DoesNotExist:
            raise serializers.ValidationError(
                'Customer not found in your account.')
        if customer.status == 'BLOCKED':
            raise serializers.ValidationError(
                'This customer account is blocked.')
        self._customer = customer
        return value

    def validate_scheduled_date(self, value):
        if value < timezone.now().date():
            raise serializers.ValidationError(
                'Scheduled date cannot be in the past.')
        return value

    def validate_items(self, items_data):
        admin = self.context['request'].user
        errors = []
        for i, item in enumerate(items_data):
            try:
                product = Product.objects.get(
                    id=item['product_id'],
                    client=admin.client,
                    status='ACTIVE',
                    is_available=True,
                )
                item['_product'] = product
            except Product.DoesNotExist:
                errors.append(
                    f"Item {i + 1}: product not found or not available.")
        if errors:
            raise serializers.ValidationError(errors)
        return items_data

    def validate(self, data):
        has_id = bool(data.get('delivery_address_id'))
        has_text = bool(data.get('delivery_address_text', '').strip())
        if not has_id and not has_text:
            raise serializers.ValidationError(
                {'delivery_address': 'Please provide a delivery address.'})
        if has_id and has_text:
            data.pop('delivery_address_text', None)
            data.pop('delivery_address_label', None)
        return data

    @staticmethod
    def _derive_order_type(items_data) -> str:
        units = {item['_product'].unit for item in items_data}
        if units == {'LITRES'}:
            return 'REFILL'
        if units == {'BOTTLES'}:
            return 'NEW_BOTTLE'
        return 'MIXED'

    def _resolve_address(self, validated_data, customer):
        from apps.customers.models import CustomerAddress
        address_id = validated_data.get('delivery_address_id')
        if address_id:
            try:
                return CustomerAddress.objects.get(id=address_id, customer=customer, is_active=True)
            except CustomerAddress.DoesNotExist:
                # Admin may be using a customer's address — try without customer filter
                return CustomerAddress.objects.get(id=address_id, is_active=True)
        address_text = validated_data['delivery_address_text'].strip()
        address_label = (validated_data.get(
            'delivery_address_label') or 'Delivery address').strip()
        from apps.customers.models import CustomerAddress
        return CustomerAddress.objects.create(
            customer=customer,
            label=address_label,
            address=address_text,
            is_active=True,
            is_default=False,
        )

    def create(self, validated_data):
        from django.db import transaction
        request = self.context['request']
        admin = request.user
        customer = self._customer
        client = customer.client
        items_data = validated_data['items']

        subtotal = Decimal('0.00')
        delivery_fee = Decimal('0.00')
        for item in items_data:
            subtotal += item['_product'].selling_price * item['quantity']
            fee = item['_product'].delivery_fee or Decimal('0.00')
            if fee > delivery_fee:
                delivery_fee = fee
        total_amount = subtotal + delivery_fee

        order_type = self._derive_order_type(items_data)
        year = timezone.now().year
        last_order = Order.objects.order_by('-id').first()
        seq = (last_order.pk if last_order else 0) + 1
        order_number = f"ORD-{year}-{seq:06d}"

        with transaction.atomic():
            address = self._resolve_address(validated_data, customer)

            order = Order.objects.create(
                order_number=order_number,
                customer=customer,
                client=client,
                order_type=order_type,
                status='CONFIRMED',        # auto-confirm manual orders
                subtotal=subtotal,
                delivery_fee=delivery_fee,
                total_amount=total_amount,
                payment_status='PENDING',
                payment_method=validated_data['payment_method'],
                special_instructions=validated_data.get(
                    'special_instructions', ''),
                is_manual_order=True,
                require_otp=validated_data['require_otp'],
                created_by_admin=admin,
            )

            bottles_to_deliver = 0
            bottles_to_collect = 0
            for item_data in items_data:
                product = item_data['_product']
                qty = item_data['quantity']
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    product_name=product.name,
                    product_unit=product.unit,
                    quantity=qty,
                    unit_price=product.selling_price,
                    subtotal=product.selling_price * qty,
                )
                bottles_to_deliver += qty
                if product.unit == 'BOTTLES':
                    bottles_to_collect += qty

            OrderDelivery.objects.create(
                order=order,
                delivery_address=address,
                scheduled_date=validated_data['scheduled_date'],
                scheduled_time_slot=validated_data['scheduled_time_slot'],
            )
            BottleExchange.objects.create(
                order=order,
                bottles_to_deliver=bottles_to_deliver,
                bottles_to_collect=bottles_to_collect,
            )

            if validated_data['payment_method'] == 'WALLET':
                # Reuse wallet charge logic from OrderCreateSerializer
                self._charge_wallet(order, customer, total_amount)

            customer.last_order_date = timezone.now()
            customer.save(update_fields=['last_order_date'])

        return order

    def _charge_wallet(self, order, customer, amount):
        """Same wallet deduction logic as OrderCreateSerializer."""
        if not hasattr(customer, 'wallet'):
            raise serializers.ValidationError('Customer has no wallet.')
        wallet = customer.wallet
        if wallet.current_balance < amount:
            raise serializers.ValidationError(
                f'Insufficient wallet balance. Available: KES {wallet.current_balance}')
        from apps.wallet.models import WalletTransaction
        WalletTransaction.objects.create(
            wallet=wallet, transaction_type='PAYMENT', amount=amount,
            balance_before=wallet.current_balance,
            balance_after=wallet.current_balance - amount,
            order=order,
            description=f'Payment for manual order {order.order_number}',
            status='COMPLETED', completed_at=timezone.now(),
        )
        wallet.current_balance -= amount
        wallet.total_spent = getattr(
            wallet, 'total_spent', Decimal('0.00')) + amount
        wallet.save(update_fields=['current_balance', 'total_spent'])
        order.payment_status = 'PAID'
        order.paid_at = timezone.now()
        order.save(update_fields=['payment_status', 'paid_at'])

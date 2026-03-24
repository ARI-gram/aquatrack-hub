"""
apps/deliveries/serializers.py
Serializers for delivery management with driver and client views.

Changes in this revision
─────────────────────────
• Added OrderItemSerializer — exposes per-item detail to the driver
• DriverDeliveryListSerializer now includes order_items[]
  Each item carries: id, product_id, product_name, product_unit,
  is_returnable, quantity.
  The frontend uses these to render per-item delivery steppers with the
  correct unit label (BOTTLES, LITRES, DOZENS) instead of treating
  everything as a bottle.
"""

from decimal import Decimal

from rest_framework import serializers
from django.utils import timezone
from apps.deliveries.models import Delivery
from apps.orders.models import Order
from apps.authentication.serializers import UserSerializer


class DriverMinimalSerializer(serializers.Serializer):
    """Minimal driver info for delivery lists"""
    id = serializers.UUIDField(source='driver.id')
    name = serializers.SerializerMethodField()
    phone = serializers.CharField(
        source='driver.phone_number', allow_null=True)
    vehicle_number = serializers.CharField()

    def get_name(self, obj):
        d = obj.driver
        name = getattr(
            d, 'full_name', None) or f"{getattr(d, 'first_name', '')} {getattr(d, 'last_name', '')}".strip()
        return name or d.email


class CustomerInfoSerializer(serializers.Serializer):
    """Customer information for delivery views"""
    name = serializers.CharField(source='order.customer.full_name')
    phone = serializers.CharField(source='order.customer.phone_number')
    email = serializers.EmailField(
        source='order.customer.email', allow_null=True)


class AddressSerializer(serializers.Serializer):
    """
    Delivery address details.

    OrderDelivery has no address_label / full_address fields.
    The address is a FK: OrderDelivery.delivery_address -> CustomerAddress.
    We read whatever fields CustomerAddress exposes.
    """
    label = serializers.SerializerMethodField()
    full_address = serializers.SerializerMethodField()
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    instructions = serializers.CharField(
        source='order.special_instructions', default='')

    def _addr(self, obj):
        """Safely return the CustomerAddress object or None."""
        try:
            return obj.order.delivery.delivery_address
        except Exception:
            return None

    def get_label(self, obj):
        addr = self._addr(obj)
        if addr is None:
            return ''
        return (
            getattr(addr, 'label', None)
            or getattr(addr, 'address_label', None)
            or getattr(addr, 'name', None)
            or ''
        )

    def get_full_address(self, obj):
        addr = self._addr(obj)
        if addr is None:
            return ''
        return (
            getattr(addr, 'full_address', None)
            or getattr(addr, 'address', None)
            or getattr(addr, 'street_address', None)
            or str(addr)
        )

    def get_latitude(self, obj):
        addr = self._addr(obj)
        if addr is None:
            return None
        val = getattr(addr, 'latitude', None)
        return float(val) if val is not None else None

    def get_longitude(self, obj):
        addr = self._addr(obj)
        if addr is None:
            return None
        val = getattr(addr, 'longitude', None)
        return float(val) if val is not None else None


class OrderSummarySerializer(serializers.Serializer):
    """Minimal order info for delivery context"""
    id = serializers.UUIDField(source='order.id')
    order_number = serializers.CharField(source='order.order_number')
    order_type = serializers.CharField(source='order.order_type')
    total_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, source='order.total_amount')
    items_count = serializers.IntegerField(source='order.items.count')

    # These DO exist on OrderDelivery
    scheduled_date = serializers.DateField(
        source='order.delivery.scheduled_date',      allow_null=True)
    scheduled_time_slot = serializers.CharField(
        source='order.delivery.scheduled_time_slot', allow_null=True)

    # Bottle exchange info if applicable
    bottles_to_deliver = serializers.IntegerField(
        source='order.bottle_exchange.bottles_to_deliver', allow_null=True)
    bottles_to_collect = serializers.IntegerField(
        source='order.bottle_exchange.bottles_to_collect', allow_null=True)


# ── NEW: per-item serializer ──────────────────────────────────────────────────

class OrderItemSerializer(serializers.Serializer):
    """
    Serializes a single OrderItem for the driver completion dialog.

    Exposes:
      id             — OrderItem PK (UUID)
      product_id     — Product PK (UUID)
      product_name   — human-readable name
      product_unit   — BOTTLES | LITRES | DOZENS (raw choice value)
      is_returnable  — bool; true means the driver collects empties back
      quantity       — how many the customer ordered
    """
    id = serializers.UUIDField()
    product_id = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()
    product_unit = serializers.SerializerMethodField()
    is_returnable = serializers.SerializerMethodField()
    quantity = serializers.IntegerField()

    def get_product_id(self, item):
        product = getattr(item, 'product', None)
        return str(product.id) if product else None

    def get_product_name(self, item):
        product = getattr(item, 'product', None)
        return getattr(product, 'name', '') if product else ''

    def get_product_unit(self, item):
        product = getattr(item, 'product', None)
        return getattr(product, 'unit', 'BOTTLES') if product else 'BOTTLES'

    def get_is_returnable(self, item):
        product = getattr(item, 'product', None)
        return bool(getattr(product, 'is_returnable', False)) if product else False


# ── DRIVER-FACING SERIALIZERS ─────────────────────────────────────────────────

class DriverDeliveryListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for driver's delivery list.
    Shows what a driver needs for their daily route.

    order_items[]  ← NEW: per-item breakdown so the completion dialog can
                    render unit-correct steppers (bottles vs litres vs dozens)
                    instead of treating every product as a bottle.
    """
    order_number = serializers.CharField(source='order.order_number')
    customer_name = serializers.CharField(source='order.customer.full_name')
    customer_phone = serializers.CharField(
        source='order.customer.phone_number')

    # FIX: address comes from OrderDelivery.delivery_address (CustomerAddress FK)
    address_label = serializers.SerializerMethodField()
    full_address = serializers.SerializerMethodField()

    scheduled_date = serializers.DateField(
        source='order.delivery.scheduled_date')
    scheduled_time_slot = serializers.CharField(
        source='order.delivery.scheduled_time_slot')

    items_count = serializers.IntegerField(source='order.items.count')

    # Legacy bottle-exchange totals — kept for backward compatibility with
    # older versions of the mobile app that don't yet consume order_items.
    bottles_to_deliver = serializers.IntegerField(
        source='order.bottle_exchange.bottles_to_deliver', allow_null=True)
    bottles_to_collect = serializers.IntegerField(
        source='order.bottle_exchange.bottles_to_collect', allow_null=True)

    # NEW — full per-item breakdown with correct unit metadata
    order_items = serializers.SerializerMethodField()

    status_display = serializers.CharField(source='get_status_display')
    order_payment_method = serializers.CharField(
        source='order.payment_method', allow_null=True, default='')

    order_total_amount = serializers.DecimalField(
        source='order.total_amount', max_digits=10, decimal_places=2)
    status_color = serializers.SerializerMethodField()

    class Meta:
        model = Delivery
        fields = [
            'id', 'order_number', 'customer_name', 'customer_phone',
            'address_label', 'full_address',
            'scheduled_date', 'scheduled_time_slot',
            'items_count',
            'bottles_to_deliver', 'bottles_to_collect',
            'order_items',
            'order_payment_method',
            'order_total_amount',
            'status', 'status_display', 'status_color',
            'estimated_arrival', 'estimated_duration',
            'driver_notes',
        ]

    def _get_customer_address(self, obj):
        try:
            return obj.order.delivery.delivery_address
        except Exception:
            return None

    def get_address_label(self, obj):
        addr = self._get_customer_address(obj)
        if addr is None:
            return ''
        return (
            getattr(addr, 'label', None)
            or getattr(addr, 'address_label', None)
            or getattr(addr, 'name', None)
            or ''
        )

    def get_full_address(self, obj):
        addr = self._get_customer_address(obj)
        if addr is None:
            return ''
        return (
            getattr(addr, 'full_address', None)
            or getattr(addr, 'address', None)
            or getattr(addr, 'street_address', None)
            or str(addr)
        )

    def get_order_items(self, obj):
        try:
            items = obj.order.items.select_related('product').all()
            return OrderItemSerializer(items, many=True).data
        except Exception:
            return []

    def get_status_color(self, obj):
        colors = {
            'ASSIGNED':    'bg-blue-50 text-blue-700 border-blue-200',
            'ACCEPTED':    'bg-indigo-50 text-indigo-700 border-indigo-200',
            'PICKED_UP':   'bg-cyan-50 text-cyan-700 border-cyan-200',
            'EN_ROUTE':    'bg-violet-50 text-violet-700 border-violet-200',
            'ARRIVED':     'bg-teal-50 text-teal-700 border-teal-200',
            'IN_PROGRESS': 'bg-amber-50 text-amber-700 border-amber-200',
            'COMPLETED':   'bg-emerald-50 text-emerald-700 border-emerald-200',
            'FAILED':      'bg-red-50 text-red-700 border-red-200',
        }
        return colors.get(obj.status, 'bg-gray-50 text-gray-700 border-gray-200')


class DriverDeliveryDetailSerializer(serializers.ModelSerializer):
    """Detailed delivery view for driver when they open a specific delivery."""
    order = OrderSummarySerializer(source='*')
    customer = CustomerInfoSerializer(source='*')
    address = AddressSerializer(source='*')

    driver_name = serializers.SerializerMethodField()
    driver_phone = serializers.CharField(
        source='driver.phone_number', allow_null=True)

    timeline = serializers.SerializerMethodField()

    class Meta:
        model = Delivery
        fields = [
            'id', 'order', 'customer', 'address',
            'status', 'vehicle_number',
            'driver_name', 'driver_phone',
            'estimated_arrival', 'estimated_duration',
            'current_latitude', 'current_longitude',
            'distance_to_customer', 'total_distance_travelled',
            'timeline',
            'has_issues', 'issue_description', 'driver_notes',
        ]

    def get_driver_name(self, obj):
        d = obj.driver
        name = getattr(
            d, 'full_name', None) or f"{getattr(d, 'first_name', '')} {getattr(d, 'last_name', '')}".strip()
        return name or d.email

    def get_timeline(self, obj):
        return {
            'assigned':  obj.assigned_at,
            'accepted':  obj.accepted_at,
            'picked_up': obj.picked_up_at,
            'started':   obj.started_at,
            'arrived':   obj.arrived_at,
            'completed': obj.completed_at,
        }


class DriverLocationUpdateSerializer(serializers.Serializer):
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)

    def validate(self, data):
        lat, lng = float(data['latitude']), float(data['longitude'])
        if not (-5.0 <= lat <= 5.0):
            raise serializers.ValidationError(
                "Latitude out of bounds for Kenya")
        if not (33.0 <= lng <= 42.0):
            raise serializers.ValidationError(
                "Longitude out of bounds for Kenya")
        return data


class DriverStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        'ACCEPTED', 'REJECTED', 'PICKED_UP', 'EN_ROUTE',
        'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    ])
    failure_reason = serializers.ChoiceField(
        choices=[c[0] for c in Delivery.FAILURE_REASONS],
        required=False, allow_null=True)
    failure_notes = serializers.CharField(required=False, allow_blank=True)
    driver_notes = serializers.CharField(required=False, allow_blank=True)
    customer_name_confirmed = serializers.CharField(
        required=False, allow_blank=True)

    def validate(self, data):
        if data.get('status') == 'FAILED' and not data.get('failure_reason'):
            raise serializers.ValidationError(
                {"failure_reason": "Required when marking delivery as failed"})
        return data


class DriverCompleteDeliverySerializer(serializers.Serializer):
    customer_name_confirmed = serializers.CharField(
        required=False, allow_blank=True)
    signature_image = serializers.ImageField(required=False)
    photo_proof = serializers.ImageField(required=False)
    driver_notes = serializers.CharField(required=False, allow_blank=True)
    bottles_delivered = serializers.IntegerField(min_value=0, required=False)
    bottles_collected = serializers.IntegerField(min_value=0, required=False)
    customer_rating = serializers.IntegerField(
        min_value=1, max_value=5, required=False)
    customer_feedback = serializers.CharField(required=False, allow_blank=True)

    amount_collected = serializers.DecimalField(
        max_digits=10, decimal_places=2,
        required=False, allow_null=True, min_value=Decimal('0.00'),
    )
    payment_method_collected = serializers.ChoiceField(
        choices=['CASH', 'MPESA'],
        required=False,
        default='CASH',
    )

    def validate(self, data):
        return data


# ── CLIENT-FACING SERIALIZERS ─────────────────────────────────────────────────

class ClientDeliveryListSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number')
    customer_name = serializers.CharField(source='order.customer.full_name')
    customer_phone = serializers.CharField(
        source='order.customer.phone_number')

    driver_info = serializers.SerializerMethodField()

    scheduled_date = serializers.DateField(
        source='order.delivery.scheduled_date')
    scheduled_time_slot = serializers.CharField(
        source='order.delivery.scheduled_time_slot')

    status_display = serializers.CharField(source='get_status_display')
    status_color = serializers.SerializerMethodField()
    estimated_arrival = serializers.DateTimeField()
    completed_at = serializers.DateTimeField()

    class Meta:
        model = Delivery
        fields = [
            'id', 'order_number', 'customer_name', 'customer_phone',
            'driver_info', 'scheduled_date', 'scheduled_time_slot',
            'status', 'status_display', 'status_color',
            'estimated_arrival', 'completed_at',
            'has_issues',
        ]

    def get_driver_info(self, obj):
        if not obj.driver:
            return None
        return {
            'id':             obj.driver.id,
            'name':           getattr(obj.driver, 'full_name', None) or obj.driver.email,
            'phone':          getattr(obj.driver, 'phone_number', '')
            or getattr(obj.driver, 'phone', ''),
            'vehicle_number': obj.vehicle_number,
        }

    def get_status_color(self, obj):
        colors = {
            'ASSIGNED':    'bg-blue-50 text-blue-700 border-blue-200',
            'ACCEPTED':    'bg-indigo-50 text-indigo-700 border-indigo-200',
            'PICKED_UP':   'bg-cyan-50 text-cyan-700 border-cyan-200',
            'EN_ROUTE':    'bg-violet-50 text-violet-700 border-violet-200',
            'ARRIVED':     'bg-teal-50 text-teal-700 border-teal-200',
            'IN_PROGRESS': 'bg-amber-50 text-amber-700 border-amber-200',
            'COMPLETED':   'bg-emerald-50 text-emerald-700 border-emerald-200',
            'FAILED':      'bg-red-50 text-red-700 border-red-200',
        }
        return colors.get(obj.status, 'bg-gray-50 text-gray-700 border-gray-200')


class ClientDeliveryDetailSerializer(serializers.ModelSerializer):
    order = OrderSummarySerializer(source='*')
    customer = CustomerInfoSerializer(source='*')
    address = AddressSerializer(source='*')
    driver_info = serializers.SerializerMethodField()
    timeline = serializers.SerializerMethodField()
    proof = serializers.SerializerMethodField()

    on_time = serializers.BooleanField()
    customer_rating = serializers.IntegerField()
    customer_feedback = serializers.CharField()

    class Meta:
        model = Delivery
        fields = [
            'id', 'order', 'customer', 'address',
            'driver_info', 'vehicle_number',
            'status', 'timeline',
            'estimated_arrival', 'estimated_duration',
            'current_latitude', 'current_longitude',
            'last_location_update',
            'distance_to_customer', 'total_distance_travelled',
            'proof', 'on_time', 'customer_rating', 'customer_feedback',
            'has_issues', 'issue_description', 'driver_notes',
            'failure_reason', 'failure_notes',
        ]

    def get_driver_info(self, obj):
        if not obj.driver:
            return None
        return {
            'id':    obj.driver.id,
            'name':  getattr(obj.driver, 'full_name', None) or f"{getattr(obj.driver, 'first_name', '')} {getattr(obj.driver, 'last_name', '')}".strip() or obj.driver.email,
            'phone': getattr(obj.driver, 'phone_number', '')
            or getattr(obj.driver, 'phone', ''),
            'email': obj.driver.email,
        }

    def get_timeline(self, obj):
        return {
            'assigned':  obj.assigned_at,
            'accepted':  obj.accepted_at,
            'picked_up': obj.picked_up_at,
            'started':   obj.started_at,
            'arrived':   obj.arrived_at,
            'completed': obj.completed_at,
        }

    def get_proof(self, obj):
        if obj.status != 'COMPLETED':
            return None
        return {
            'signature':     obj.signature_image.url if obj.signature_image else None,
            'photo':         obj.photo_proof.url if obj.photo_proof else None,
            'customer_name': obj.customer_name_confirmed,
        }


class ClientDeliveryStatsSerializer(serializers.Serializer):
    total_today = serializers.IntegerField()
    completed_today = serializers.IntegerField()
    in_progress = serializers.IntegerField()
    failed_today = serializers.IntegerField()
    active_drivers = serializers.IntegerField()
    avg_delivery_time = serializers.FloatField()
    revenue_today = serializers.DecimalField(max_digits=10, decimal_places=2)
    status_breakdown = serializers.DictField(child=serializers.IntegerField())


class DriverAssignmentSerializer(serializers.Serializer):
    delivery_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False)
    driver_id = serializers.UUIDField()

    def validate_driver_id(self, value):
        from apps.authentication.models import User
        try:
            User.objects.get(id=value, role='driver', is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError("Driver not found or inactive")
        return value


# ── INVENTORY INTEGRATION ─────────────────────────────────────────────────────

class InventoryDeductionSerializer(serializers.Serializer):
    order_id = serializers.UUIDField()
    items = serializers.ListField(child=serializers.DictField())

    def create_inventory_transactions(self):
        pass

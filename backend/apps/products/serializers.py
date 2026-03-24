"""
apps/products/serializers.py
"""

from rest_framework import serializers
from django.utils import timezone
from apps.products.models import Product, StockEntry
from apps.products.inventory import InventoryManager


# ── Product serializers ───────────────────────────────────────────────────────

class ProductSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source='get_status_display', read_only=True)
    unit_display = serializers.CharField(
        source='get_unit_display',   read_only=True)
    margin = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True)
    margin_pct = serializers.FloatField(read_only=True)
    stock_available = serializers.SerializerMethodField()
    dozen_description = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'unit', 'unit_display',
            'dozen_size', 'dozen_description',
            'selling_price', 'buying_price', 'delivery_fee',
            'margin', 'margin_pct',
            'image_url',
            'status', 'status_display', 'is_available', 'is_returnable',
            'stock_available',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_stock_available(self, obj) -> int:
        stock_map: dict = self.context.get('stock_map', {})
        if stock_map:
            return stock_map.get(str(obj.id), 0)
        return InventoryManager.get_available_stock(obj.id)

    def get_dozen_description(self, obj) -> str:
        if obj.unit == 'DOZENS' and obj.dozen_size:
            return f'1 dozen = {obj.dozen_size} units'
        return ''


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            'name', 'unit', 'dozen_size',
            'selling_price', 'buying_price', 'delivery_fee',
            'image_url', 'status', 'is_available', 'is_returnable',
        ]
        extra_kwargs = {
            'dozen_size': {'required': False, 'allow_null': True},
        }

    def validate_selling_price(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                'Selling price must be greater than 0.')
        return value

    def validate_buying_price(self, value):
        if value < 0:
            raise serializers.ValidationError(
                'Buying price cannot be negative.')
        return value

    def validate_delivery_fee(self, value):
        if value < 0:
            raise serializers.ValidationError(
                'Delivery fee cannot be negative.')
        return value

    def validate(self, attrs):
        unit = attrs.get('unit') or (
            self.instance.unit if self.instance else None)
        dozen_size = attrs.get('dozen_size')

        if unit == 'DOZENS':
            if not dozen_size or dozen_size < 1:
                raise serializers.ValidationError(
                    {'dozen_size': 'dozen_size is required and must be >= 1 when unit is DOZENS.'})
        else:
            attrs['dozen_size'] = None

        selling = attrs.get('selling_price')
        buying = attrs.get('buying_price', 0)
        if selling and buying and buying > selling:
            raise serializers.ValidationError(
                {'buying_price': 'Buying price cannot exceed selling price.'})
        return attrs


class CustomerProductSerializer(serializers.ModelSerializer):
    unit_display = serializers.CharField(
        source='get_unit_display', read_only=True)
    dozen_description = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name',
            'unit', 'unit_display',
            'dozen_size', 'dozen_description',
            'selling_price', 'delivery_fee',
            'image_url',
        ]

    def get_dozen_description(self, obj) -> str:
        if obj.unit == 'DOZENS' and obj.dozen_size:
            return f'1 dozen = {obj.dozen_size} units'
        return ''


# ── Stock serializers ─────────────────────────────────────────────────────────

class StockEntrySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_unit = serializers.CharField(source='product.unit', read_only=True)
    received_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StockEntry
        fields = [
            'id',
            'product', 'product_name', 'product_unit',
            'serial_number', 'quantity', 'batch_ref',
            'received_by', 'received_by_name', 'received_at',
            'notes', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_received_by_name(self, obj):
        if obj.received_by:
            return f'{obj.received_by.first_name} {obj.received_by.last_name}'.strip()
        return '—'


class StockEntryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockEntry
        fields = [
            'product', 'serial_number', 'quantity',
            'batch_ref', 'received_by', 'received_at', 'notes',
        ]

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError('Quantity must be at least 1.')
        return value

    def validate_product(self, product):
        request = self.context.get('request')
        if request and product.client != request.user.client:
            raise serializers.ValidationError('Product not found.')
        return product


class StockBatchCreateSerializer(serializers.Serializer):
    product = serializers.UUIDField()
    batch_ref = serializers.CharField(max_length=50)
    received_at = serializers.DateTimeField(default=timezone.now)
    notes = serializers.CharField(allow_blank=True, default='')
    serials = serializers.ListField(
        child=serializers.CharField(max_length=100),
        min_length=1,
        max_length=500,
    )

    def validate_product(self, value):
        request = self.context.get('request')
        try:
            product = Product.objects.get(id=value, client=request.user.client)
        except Product.DoesNotExist:
            raise serializers.ValidationError('Product not found.')
        return product

    def validate_serials(self, value):
        cleaned = [s.strip() for s in value if s.strip()]
        if not cleaned:
            raise serializers.ValidationError(
                'At least one serial number is required.')
        if len(cleaned) != len(set(cleaned)):
            dupes = [s for s in cleaned if cleaned.count(s) > 1]
            raise serializers.ValidationError(
                f'Duplicate serials in this batch: {", ".join(set(dupes))}')
        return cleaned

    def create(self, validated_data):
        from django.db import transaction as db_transaction

        product = validated_data['product']
        batch_ref = validated_data['batch_ref']
        received_at = validated_data['received_at']
        notes = validated_data['notes']
        serials = validated_data['serials']
        user = self.context['request'].user

        with db_transaction.atomic():
            entries = StockEntry.objects.bulk_create([
                StockEntry(
                    product=product,
                    serial_number=serial,
                    quantity=1,
                    batch_ref=batch_ref,
                    received_by=user,
                    received_at=received_at,
                    notes=notes,
                )
                for serial in serials
            ])
        return entries

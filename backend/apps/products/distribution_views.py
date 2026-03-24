"""
apps/products/distribution_views.py

POST /api/products/distribute/
    Distribute stock from main warehouse to a vehicle.

GET  /api/products/distribute/?vehicle_number=KCA123A
    See what's currently on a van.
"""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers

from apps.products.models import Product, StockDistribution
from apps.products.inventory import InventoryManager
from apps.authentication.models import User


# ── Permission ────────────────────────────────────────────────────────────────

class IsClientAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'site_manager')
            and request.user.client_id is not None
        )


# ── Serializers ───────────────────────────────────────────────────────────────

class DistributeSerializer(serializers.Serializer):
    product = serializers.UUIDField()
    vehicle_number = serializers.CharField(max_length=20)
    quantity = serializers.IntegerField(min_value=1)
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_vehicle_number(self, value):
        return value.strip().upper()


class StockDistributionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source='product.name',  read_only=True)
    product_unit = serializers.CharField(
        source='product.unit',  read_only=True)
    driver_name = serializers.SerializerMethodField()
    distributed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StockDistribution
        fields = [
            'id',
            'product', 'product_name', 'product_unit',
            'vehicle_number',
            'driver', 'driver_name',
            'quantity',
            'distributed_by', 'distributed_by_name',
            'distributed_at',
            'notes',
        ]

    def get_driver_name(self, obj):
        if not obj.driver:
            return None
        u = obj.driver
        return f'{u.first_name} {u.last_name}'.strip() or u.email

    def get_distributed_by_name(self, obj):
        if not obj.distributed_by:
            return None
        u = obj.distributed_by
        return f'{u.first_name} {u.last_name}'.strip() or u.email


# ── Views ─────────────────────────────────────────────────────────────────────

class DistributeStockView(APIView):
    """
    POST /api/products/distribute/
    Distribute stock from main warehouse to a vehicle.

    Request body:
    {
        "product":        "<uuid>",
        "vehicle_number": "KCA 123A",
        "quantity":       50,
        "notes":          "Morning load"   // optional
    }

    Response (201):
    {
        "distribution": { ...StockDistributionSerializer... },
        "warehouse_remaining": 150   // updated main stock
    }
    """

    permission_classes = [IsClientAdmin]

    def post(self, request):
        serializer = DistributeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        client = request.user.client

        # Verify product belongs to this client
        try:
            product = Product.objects.get(pk=data['product'], client=client)
        except Product.DoesNotExist:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if product.status != 'ACTIVE':
            return Response(
                {'error': 'Only ACTIVE products can be distributed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check we have enough stock in the warehouse
        can_distribute, available = InventoryManager.can_distribute(
            product.id, data['quantity']
        )
        if not can_distribute:
            return Response(
                {
                    'error': f'Not enough stock. Warehouse has {available} '
                    f'{product.unit.lower()} available.',
                    'available': available,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Find driver assigned to this vehicle (if any)
        driver = User.objects.filter(
            client=client,
            role='driver',
            vehicle_number=data['vehicle_number'],
            is_active=True,
        ).first()

        distribution = StockDistribution.objects.create(
            product=product,
            vehicle_number=data['vehicle_number'],
            driver=driver,
            quantity=data['quantity'],
            distributed_by=request.user,
            notes=data.get('notes', ''),
        )

        warehouse_remaining = InventoryManager.get_available_stock(product.id)

        return Response(
            {
                'distribution':       StockDistributionSerializer(distribution).data,
                'warehouse_remaining': warehouse_remaining,
            },
            status=status.HTTP_201_CREATED,
        )

    def get(self, request):
        """
        GET /api/products/distribute/?vehicle_number=KCA123A
        Returns current van stock for a specific vehicle.
        """
        vehicle_number = request.query_params.get(
            'vehicle_number', '').strip().upper()
        if not vehicle_number:
            return Response(
                {'error': 'vehicle_number query param is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        van_stock = InventoryManager.get_van_stock(vehicle_number)
        return Response({
            'vehicle_number': vehicle_number,
            'stock': van_stock,
        })


class DistributionHistoryView(APIView):
    """
    GET /api/products/distribute/history/
    Paginated list of all distributions for this client.

    Query params: product_id, vehicle_number, page, limit
    """

    permission_classes = [IsClientAdmin]

    def get(self, request):
        qs = StockDistribution.objects.filter(
            product__client=request.user.client
        ).select_related('product', 'driver', 'distributed_by')

        vehicle = request.query_params.get('vehicle_number')
        if vehicle:
            qs = qs.filter(vehicle_number=vehicle.strip().upper())

        product_id = request.query_params.get('product_id')
        if product_id:
            qs = qs.filter(product_id=product_id)

        try:
            limit = min(
                100, max(1, int(request.query_params.get('limit', 20))))
            page = max(1, int(request.query_params.get('page', 1)))
        except (ValueError, TypeError):
            limit, page = 20, 1

        total = qs.count()
        total_pages = max(1, (total + limit - 1) // limit)
        page = min(page, total_pages)
        offset = (page - 1) * limit

        return Response({
            'data':        StockDistributionSerializer(qs[offset: offset + limit], many=True).data,
            'total':       total,
            'page':        page,
            'limit':       limit,
            'total_pages': total_pages,
        })

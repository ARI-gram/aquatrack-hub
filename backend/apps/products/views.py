"""
apps/products/views.py
"""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db import models
from apps.products.models import Product, StockEntry
from apps.products.serializers import (
    ProductSerializer,
    ProductCreateUpdateSerializer,
    CustomerProductSerializer,
    StockEntrySerializer,
    StockEntryCreateSerializer,
    StockBatchCreateSerializer,
)
from apps.products.inventory import InventoryManager
from apps.customers.authentication import CustomerJWTAuthentication


class IsClientAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'site_manager')
            and request.user.client_id is not None
        )


class IsCustomer(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, 'customer')
        )


# ── Products: List + Create ───────────────────────────────────────────────────

class ProductListCreateView(APIView):
    permission_classes = [IsClientAdmin]

    def get(self, request):
        client = request.user.client
        qs = Product.objects.filter(client=client)

        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        else:
            qs = qs.exclude(status='ARCHIVED')

        if search := request.query_params.get('search'):
            qs = qs.filter(name__icontains=search)
        if unit := request.query_params.get('unit'):
            qs = qs.filter(unit=unit.upper())

        products = list(qs)
        stock_map = InventoryManager.get_stock_for_products(
            [p.id for p in products])
        return Response(ProductSerializer(products, many=True, context={'stock_map': stock_map}).data)

    def post(self, request):
        serializer = ProductCreateUpdateSerializer(
            data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        product = serializer.save(client=request.user.client)
        stock_map = InventoryManager.get_stock_for_products([product.id])
        return Response(
            ProductSerializer(product, context={'stock_map': stock_map}).data,
            status=status.HTTP_201_CREATED,
        )


# ── Products: Retrieve + Update + Archive ─────────────────────────────────────

class ProductDetailView(APIView):
    permission_classes = [IsClientAdmin]

    def _get_product(self, request, pk):
        try:
            return Product.objects.get(pk=pk, client=request.user.client)
        except Product.DoesNotExist:
            return None

    def _stock_context(self, product):
        return {'stock_map': InventoryManager.get_stock_for_products([product.id])}

    def get(self, request, pk):
        product = self._get_product(request, pk)
        if not product:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProductSerializer(product, context=self._stock_context(product)).data)

    def patch(self, request, pk):
        product = self._get_product(request, pk)
        if not product:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProductCreateUpdateSerializer(
            product, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ProductSerializer(product, context=self._stock_context(product)).data)

    def delete(self, request, pk):
        product = self._get_product(request, pk)
        if not product:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        product.status = 'ARCHIVED'
        product.is_available = False
        product.save(update_fields=['status', 'is_available'])
        return Response({'message': f'"{product.name}" has been archived.'})


# ── Products: Toggle availability ─────────────────────────────────────────────

class ProductToggleView(APIView):
    permission_classes = [IsClientAdmin]

    def post(self, request, pk):
        try:
            product = Product.objects.get(pk=pk, client=request.user.client)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        if product.status != 'ACTIVE':
            return Response(
                {'error': 'Only ACTIVE products can be toggled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        product.is_available = not product.is_available
        product.save(update_fields=['is_available'])
        label = 'visible' if product.is_available else 'hidden'
        stock_map = InventoryManager.get_stock_for_products([product.id])
        return Response({
            'message': f'"{product.name}" is now {label}.',
            'product': ProductSerializer(product, context={'stock_map': stock_map}).data,
        })


# ── Stock: List + Create (single) ─────────────────────────────────────────────

class StockEntryListCreateView(APIView):
    permission_classes = [IsClientAdmin]

    def get(self, request):
        qs = StockEntry.objects.filter(
            product__client=request.user.client
        ).select_related('product', 'received_by')

        if product_id := request.query_params.get('product_id'):
            qs = qs.filter(product_id=product_id)
        if search := request.query_params.get('search'):
            qs = qs.filter(
                models.Q(serial_number__icontains=search) |
                models.Q(batch_ref__icontains=search)
            )
        if from_date := request.query_params.get('from_date'):
            qs = qs.filter(received_at__date__gte=from_date)
        if to_date := request.query_params.get('to_date'):
            qs = qs.filter(received_at__date__lte=to_date)

        return Response(StockEntrySerializer(qs, many=True).data)

    def post(self, request):
        serializer = StockEntryCreateSerializer(
            data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        entry = serializer.save(received_by=request.user)
        return Response(StockEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


# ── Stock: Batch Create ───────────────────────────────────────────────────────

class StockBatchCreateView(APIView):
    """
    POST /api/stock/batch/

    Creates one StockEntry per serial in a single transaction.
    Each serial = one physical unit (quantity always 1).

    Request:
    {
        "product":      "<uuid>",
        "batch_ref":    "BATCH-20250309-A4X9",
        "received_at":  "2025-03-09T14:30:00Z",   // optional, defaults to now
        "notes":        "from supplier X",          // optional
        "serials": [
            "SN-20250309-00001",
            "SN-20250309-00002",
            "ABC-BARCODE-123"
        ]
    }

    Response (201):
    {
        "count":   3,
        "batch_ref": "BATCH-20250309-A4X9",
        "entries": [ ...StockEntrySerializer... ]
    }
    """
    permission_classes = [IsClientAdmin]

    def post(self, request):
        serializer = StockBatchCreateSerializer(
            data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        entries = serializer.create(serializer.validated_data)

        return Response(
            {
                'count':     len(entries),
                'batch_ref': serializer.validated_data['batch_ref'],
                'entries':   StockEntrySerializer(entries, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


# ── Stock: Retrieve ───────────────────────────────────────────────────────────

class StockEntryDetailView(APIView):
    permission_classes = [IsClientAdmin]

    def get(self, request, pk):
        try:
            entry = StockEntry.objects.select_related(
                'product', 'received_by'
            ).get(pk=pk, product__client=request.user.client)
        except StockEntry.DoesNotExist:
            return Response({'error': 'Stock entry not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(StockEntrySerializer(entry).data)


# ── Customer: Active products ─────────────────────────────────────────────────

class CustomerProductListView(APIView):
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsCustomer]

    def get(self, request):
        customer = request.user.customer
        products = Product.objects.filter(
            client=customer.client,
            status='ACTIVE',
            is_available=True,
        ).order_by('name')
        return Response(CustomerProductSerializer(products, many=True).data)

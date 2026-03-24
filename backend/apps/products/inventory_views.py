"""
apps/products/inventory_views.py
Inventory views for client dashboard
"""

from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Sum, Q
from django.utils import timezone
from datetime import timedelta

from apps.products.models import Product, StockEntry
from apps.products.inventory import InventoryManager
from apps.orders.models import Order, OrderItem


class IsClientStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'site_manager')
            and request.user.client_id is not None
        )


class InventorySummaryView(APIView):
    """
    GET /api/inventory/summary/
    Returns inventory summary for client dashboard
    """
    permission_classes = [IsClientStaff]

    def get(self, request):
        client = request.user.client
        products = Product.objects.filter(client=client, status='ACTIVE')

        summary = []
        total_value = 0

        for product in products:
            available = InventoryManager.get_available_stock(product.id)
            value = available * product.buying_price
            total_value += value

            summary.append({
                'product_id': product.id,
                'product_name': product.name,
                'unit': product.unit,
                'available': available,
                'selling_price': product.selling_price,
                'buying_price': product.buying_price,
                'stock_value': value,
                'is_low_stock': available <= 10,  # Threshold
            })

        # Get recent stock movements
        recent_stock = StockEntry.objects.filter(
            product__client=client
        ).select_related('product', 'received_by').order_by('-received_at')[:10]

        recent_movements = [
            {
                'id': entry.id,
                'product_name': entry.product.name,
                'quantity': entry.quantity,
                'received_at': entry.received_at,
                'received_by': entry.received_by.get_full_name() if entry.received_by else None,
                'batch_ref': entry.batch_ref,
            }
            for entry in recent_stock
        ]

        return Response({
            'total_products': products.count(),
            'total_inventory_value': total_value,
            'low_stock_count': sum(1 for p in summary if p['is_low_stock']),
            'summary': summary,
            'recent_movements': recent_movements,
        })


class StockMovementView(APIView):
    """
    GET /api/inventory/movements/
    List stock movements with filters
    """
    permission_classes = [IsClientStaff]

    def get(self, request):
        client = request.user.client

        # Get stock entries (incoming)
        entries = StockEntry.objects.filter(
            product__client=client
        ).select_related('product', 'received_by')

        # Get completed orders (outgoing)
        completed_orders = Order.objects.filter(
            client=client,
            status__in=['DELIVERED', 'COMPLETED']
        ).prefetch_related('items')

        # Filters
        days = request.query_params.get('days', 30)
        if days:
            cutoff = timezone.now() - timedelta(days=int(days))
            entries = entries.filter(received_at__gte=cutoff)
            completed_orders = completed_orders.filter(updated_at__gte=cutoff)

        # Combine movements
        movements = []

        # Incoming movements
        for entry in entries:
            movements.append({
                'id': str(entry.id),
                'type': 'IN',
                'product_name': entry.product.name,
                'quantity': entry.quantity,
                'date': entry.received_at,
                'reference': entry.batch_ref,
                'user': entry.received_by.get_full_name() if entry.received_by else None,
                'notes': entry.notes,
            })

        # Outgoing movements (from completed orders)
        for order in completed_orders:
            for item in order.items.all():
                movements.append({
                    'id': f"order-{order.id}-{item.id}",
                    'type': 'OUT',
                    'product_name': item.product_name,
                    'quantity': item.quantity,
                    'date': order.updated_at,
                    'reference': order.order_number,
                    'user': 'System (Order Delivery)',
                    'notes': f"Order #{order.order_number}",
                })

        # Sort by date descending
        movements.sort(key=lambda x: x['date'], reverse=True)

        # Pagination
        page = int(request.query_params.get('page', 1))
        limit = min(int(request.query_params.get('limit', 50)), 100)
        offset = (page - 1) * limit

        total = len(movements)
        page_movements = movements[offset:offset + limit]

        return Response({
            'data': page_movements,
            'total': total,
            'page': page,
            'limit': limit,
            'total_pages': (total + limit - 1) // limit
        })


class LowStockAlertView(APIView):
    """
    GET /api/inventory/low-stock/
    Get products with low stock
    """
    permission_classes = [IsClientStaff]

    def get(self, request):
        client = request.user.client
        threshold = int(request.query_params.get('threshold', 10))

        products = Product.objects.filter(client=client, status='ACTIVE')

        low_stock = []
        for product in products:
            available = InventoryManager.get_available_stock(product.id)
            if available <= threshold:
                low_stock.append({
                    'product_id': product.id,
                    'product_name': product.name,
                    'unit': product.unit,
                    'available': available,
                    'threshold': threshold,
                    'selling_price': product.selling_price,
                })

        return Response({
            'count': len(low_stock),
            'threshold': threshold,
            'products': low_stock
        })

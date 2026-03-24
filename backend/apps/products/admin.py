"""
apps/products/admin.py
"""

from django.contrib import admin
from apps.products.models import Product, StockEntry


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'unit', 'selling_price',
                    'buying_price', 'status', 'is_available', 'client']
    list_filter = ['status', 'unit', 'is_available']
    search_fields = ['name', 'client__name']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(StockEntry)
class StockEntryAdmin(admin.ModelAdmin):
    list_display = ['product', 'serial_number', 'quantity',
                    'batch_ref', 'received_by', 'received_at']
    list_filter = ['product__client', 'received_at']
    search_fields = ['serial_number', 'batch_ref', 'product__name']
    readonly_fields = ['id', 'created_at']

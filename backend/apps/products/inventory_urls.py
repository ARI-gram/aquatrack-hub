"""
apps/products/inventory_urls.py
Inventory management endpoints
"""

from django.urls import path
from apps.products import inventory_views

app_name = 'inventory'

urlpatterns = [
    path('summary/',
         inventory_views.InventorySummaryView.as_view(),
         name='summary'),

    path('movements/',
         inventory_views.StockMovementView.as_view(),
         name='movements'),

    path('low-stock/',
         inventory_views.LowStockAlertView.as_view(),
         name='low-stock'),
]

"""
apps/products/stock_urls.py
Mounted at /api/stock/ in aquatrack/urls.py

  path('stock/', include('apps.products.stock_urls')),
"""

from django.urls import path
from apps.products.views import (
    StockEntryListCreateView,
    StockEntryDetailView,
    StockBatchCreateView,
)

app_name = 'stock'

urlpatterns = [
    # GET  /api/stock/          → list all stock entries
    # POST /api/stock/          → create single stock entry (legacy)
    path('', StockEntryListCreateView.as_view(), name='list-create'),

    # POST /api/stock/batch/    → batch create (one entry per serial)
    path('batch/', StockBatchCreateView.as_view(), name='batch-create'),

    # GET  /api/stock/<uuid>/   → retrieve single entry
    path('<uuid:pk>/', StockEntryDetailView.as_view(), name='detail'),
]

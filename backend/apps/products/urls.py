"""
apps/products/urls.py
Mounted at /api/products/ in aquatrack/urls.py
"""

from django.urls import path
from apps.products.views import (
    ProductListCreateView,
    ProductDetailView,
    ProductToggleView,
)
from apps.products.distribution_views import (
    DistributeStockView,
    DistributionHistoryView,
)

app_name = 'products'

urlpatterns = [
    # ── Products ──────────────────────────────────────────────────────────────
    path('',                   ProductListCreateView.as_view(), name='list-create'),
    path('<uuid:pk>/',         ProductDetailView.as_view(),     name='detail'),
    path('<uuid:pk>/toggle/',  ProductToggleView.as_view(),     name='toggle'),

    # ── Distribution ──────────────────────────────────────────────────────────
    # POST /api/products/distribute/               → distribute stock to van
    # GET  /api/products/distribute/?vehicle_number=KCA123A → van stock
    path('distribute/',         DistributeStockView.as_view(),     name='distribute'),
    path('distribute/history/', DistributionHistoryView.as_view(),
         name='distribute-history'),
]

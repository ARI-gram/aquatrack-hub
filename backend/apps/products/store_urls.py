"""
apps/products/store_urls.py
Mounted at /api/store/ in aquatrack/urls.py:

    path('store/', include('apps.products.store_urls')),
"""

from django.urls import path
from apps.products.store_views import (
    BottleStoreView,
    DriverExpectedEmptiesView,
    ReceiveEmptyView,
    RefillBottlesView,
    DistributeBottlesView,
    DirectSaleBottleView,
    ConsumableStoreView,
    ReceiveConsumableView,
    DistributeConsumableView,
    DirectSaleConsumableView,
)

from apps.deliveries.driver_store_views import ClientDriverVanStockView

app_name = 'store'

urlpatterns = [

    # ── Bottles (returnable) ──────────────────────────────────────────────────
    path('bottles/',                  BottleStoreView.as_view(),       name='bottles'),
    path('bottles/receive-empty/',    ReceiveEmptyView.as_view(),
         name='bottles-receive-empty'),
    path('bottles/refill/',           RefillBottlesView.as_view(),
         name='bottles-refill'),
    path('bottles/distribute/',       DistributeBottlesView.as_view(),
         name='bottles-distribute'),
    path('bottles/direct-sale/',      DirectSaleBottleView.as_view(),
         name='bottles-direct-sale'),

    # ── Consumables (non-returnable) ──────────────────────────────────────────
    path('consumables/',              ConsumableStoreView.as_view(),
         name='consumables'),
    path('consumables/receive/',      ReceiveConsumableView.as_view(),
         name='consumables-receive'),
    path('consumables/distribute/',   DistributeConsumableView.as_view(),
         name='consumables-distribute'),
    path('consumables/direct-sale/',  DirectSaleConsumableView.as_view(),
         name='consumables-direct-sale'),
    path('bottles/expected-empties/',
         DriverExpectedEmptiesView.as_view(),
         name='bottles-expected-empties'),

    # ── Driver Van Stock (both bottles and consumables) ───────────────────────
    path('driver-stock/', ClientDriverVanStockView.as_view(),
         name='driver-van-stock'),
]

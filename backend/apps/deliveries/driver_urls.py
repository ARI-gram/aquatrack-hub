"""
apps/deliveries/driver_urls.py
Driver mobile app endpoints — mounted at /api/driver/
"""

from django.urls import path
from apps.deliveries import views
from apps.deliveries import driver_store_views

app_name = 'driver-deliveries'

urlpatterns = [

    # ── Deliveries ────────────────────────────────────────────────────────────

    # GET  /api/driver/deliveries/
    path('deliveries/',
         views.DriverDeliveryListView.as_view(),
         name='delivery-list'),

    # GET  /api/driver/deliveries/{id}/
    path('deliveries/<str:delivery_id>/',
         views.DriverDeliveryDetailView.as_view(),
         name='delivery-detail'),

    # POST /api/driver/deliveries/{id}/accept/
    path('deliveries/<str:delivery_id>/accept/',
         views.DriverAcceptDeliveryView.as_view(),
         name='delivery-accept'),

    # POST /api/driver/deliveries/{id}/location/
    path('deliveries/<str:delivery_id>/location/',
         views.DriverUpdateLocationView.as_view(),
         name='update-location'),

    # PATCH /api/driver/deliveries/{id}/status/
    path('deliveries/<str:delivery_id>/status/',
         views.DriverUpdateStatusView.as_view(),
         name='update-status'),

    # POST /api/driver/deliveries/{id}/verify-otp/
    path('deliveries/<str:delivery_id>/verify-otp/',
         views.DriverVerifyOTPView.as_view(),
         name='verify-otp'),

    # POST /api/driver/deliveries/{id}/resend-otp/
    path('deliveries/<str:delivery_id>/resend-otp/',
         views.DriverResendOTPView.as_view(),
         name='resend-otp'),

    # POST /api/driver/deliveries/{id}/
    path('customers/',
         views.DriverCustomerListView.as_view(),
         name='customer-list'),

    # GET  /api/driver/customers/search/?q=...
    path('customers/search/',
         views.DriverCustomerSearchView.as_view(),
         name='customer-search'),

    # POST /api/driver/store/direct-sales/
    path('store/direct-sales/',
         driver_store_views.ClientDirectSalesView.as_view(),
         name='store-direct-sales'),
    # POST /api/driver/deliveries/{id}/complete/
    path('deliveries/<str:delivery_id>/complete/',
         views.DriverCompleteDeliveryView.as_view(),
         name='complete-delivery'),

    # ── Driver profile ────────────────────────────────────────────────────────

    # GET /api/driver/profile/
    path('profile/',
         views.DriverProfileView.as_view(),
         name='profile'),

    # ── Van stock ─────────────────────────────────────────────────────────────

    # GET  /api/driver/store/bottles/
    path('store/bottles/',
         driver_store_views.DriverBottleStockView.as_view(),
         name='store-bottles'),

    # GET  /api/driver/store/consumables/
    path('store/consumables/',
         driver_store_views.DriverConsumableStockView.as_view(),
         name='store-consumables'),

    # GET  /api/driver/store/requirements/
    path('store/requirements/',
         driver_store_views.DriverStockRequirementsView.as_view(),
         name='store-requirements'),

    # GET  /api/driver/store/history/
    path('store/history/',
         driver_store_views.DriverStockHistoryView.as_view(),
         name='store-history'),

    # POST /api/driver/store/use/
    path('store/use/',
         driver_store_views.DriverRecordStockUseView.as_view(),
         name='store-use'),
]

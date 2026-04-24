# /apps/customers/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.customers.views import (
    CustomerRegistrationView,
    SendOTPView,
    VerifyOTPView,
    CustomerProfileView,
    CustomerAddressViewSet,
    CustomerPreferencesView,
)
from apps.customers.payment_views import CustomerPaymentProfileView
from apps.customers.grace_views import (
    CustomerCreditStatusView,
    CustomerGraceRequestView,
)
from apps.orders.views import (
    OrderListView,
    OrderCreateView,
    OrderDetailView,
    OrderCancelView,
)
from apps.products.views import CustomerProductListView
from apps.deliveries.views import CustomerOrderTrackingView

app_name = 'customers'

# Router for customer self-service address ViewSet
router = DefaultRouter()
router.register(r'addresses', CustomerAddressViewSet, basename='address')

# ─── Customer self-service (OTP-authenticated) ────────────────────────────────
# Mounted at /api/customer/
urlpatterns = [
    # Auth
    path('auth/register/', CustomerRegistrationView.as_view(), name='register'),
    path('auth/send-otp/', SendOTPView.as_view(), name='send-otp'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),

    # Profile
    path('profile/', CustomerProfileView.as_view(), name='profile'),
    path('preferences/', CustomerPreferencesView.as_view(), name='preferences'),

    # Payment profile
    path('payment-profile/', CustomerPaymentProfileView.as_view(),
         name='payment-profile'),

    # Credit account status + grace requests (credit/cheque customers only)
    path('credit/status/', CustomerCreditStatusView.as_view(), name='credit-status'),
    path('credit/grace-request/',
         CustomerGraceRequestView.as_view(), name='grace-request'),

    # Orders ← customer-facing order endpoints
    path('orders/', OrderListView.as_view(), name='order-list'),
    path('orders/create/', OrderCreateView.as_view(), name='order-create'),
    path('orders/<int:pk>/', OrderDetailView.as_view(), name='order-detail'),
    path('orders/<int:pk>/cancel/', OrderCancelView.as_view(), name='order-cancel'),
    path('orders/<int:order_id>/track/',
         CustomerOrderTrackingView.as_view(), name='order-track'),

    # Products ← customer-facing product list (active products only)
    path('products/', CustomerProductListView.as_view(), name='customer-products'),

    # Addresses (ViewSet)
    path('', include(router.urls)),

    # Wallet
    path('wallet/', include('apps.wallet.urls')),

    # Bottles
    path('bottles/', include('apps.bottles.urls')),
]

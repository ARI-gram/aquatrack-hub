"""
aquatrack/urls.py
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from apps.notifications.urls import (
    customer_notification_urls,
    driver_notification_urls,
    client_notification_urls,
)

from apps.deliveries.views_audit import DriverBottleAuditView

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/auth/',      include('apps.authentication.urls')),
    path('api/billing/',   include('apps.billing.urls')),
    path('api/clients/',   include('apps.clients.urls')),

    # ── Notifications (must come BEFORE the broad api/customer/, api/driver/, api/client/ prefixes) ──
    path('api/customer/notifications/', include(customer_notification_urls)),
    path('api/driver/notifications/',   include(driver_notification_urls)),
    path('api/client/notifications/',   include(client_notification_urls)),

    # Customer self-service (OTP login, profile, addresses, products)
    path('api/customer/',  include('apps.customers.urls')),

    # Client-admin customer management
    path('api/customers/', include('apps.customers.admin_urls')),

    # Product catalogue (admin CRUD)
    path('api/products/',  include('apps.products.urls')),

    # Stock entries (receive / top-up inventory)
    path('api/stock/',     include('apps.products.stock_urls')),

    path('api/customer/bottles/', include('apps.bottles.urls')),
    path('api/orders/',    include('apps.orders.urls')),
    path('api/customer/wallet/',  include('apps.wallet.urls')),

    # Invoices (auto-generated on order completion)
    path('api/invoices/',  include('apps.invoices.urls')),

    # Driver app        →  /api/driver/deliveries/  /api/driver/profile/
    path('api/driver/',    include('apps.deliveries.driver_urls')),

    # Client dashboard  →  /api/client/deliveries/  /api/client/orders/assign/
    path('api/client/',    include('apps.deliveries.client_urls')),

    # Public tracking   →  /api/track/<order_number>/
    path('api/track/',     include('apps.deliveries.tracking_urls')),

    # Misc utilities    →  /api/deliveries/health/
    path('api/deliveries/', include('apps.deliveries.urls')),

    # Store management  →  /api/store/products/  /api/store/movements/
    path('api/store/',     include('apps.products.store_urls')),

    # Client account management (profile, addresses, payment methods)
    path('api/client/', include('apps.accounts.urls')),

    # Reports  →  /api/reports/revenue/  /api/reports/vat/  /api/reports/outstanding/
    path('api/reports/', include('apps.reports.urls')),

    # Site manager      →  /api/manager/drivers/
    path('api/manager/',    include('apps.deliveries.manager_urls')),

    # Misc utilities    →  /api/deliveries/health/
    path('api/deliveries/', include('apps.deliveries.urls')),

    # Bottle audit      →  /api/drivers/bottle-audit/
    path('api/drivers/bottle-audit/',
         DriverBottleAuditView.as_view(), name='driver-bottle-audit'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL,
                          document_root=settings.STATIC_ROOT)

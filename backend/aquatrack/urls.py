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

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),

    # ── API Schema & Docs ──
    path('api/schema/',          SpectacularAPIView.as_view(),        name='schema'),
    path('api/schema/swagger/',
         SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/',
         SpectacularRedocView.as_view(url_name='schema'),   name='redoc'),

    path('api/auth/',      include('apps.authentication.urls')),
    path('api/billing/',   include('apps.billing.urls')),
    path('api/clients/',   include('apps.clients.urls')),

    # ── Notifications (must come BEFORE the broad api/customer/, api/driver/, api/client/ prefixes) ──
    path('api/customer/notifications/', include(customer_notification_urls)),
    path('api/driver/notifications/',   include(driver_notification_urls)),
    path('api/drivers/', include('apps.deliveries.audit_urls')),
    path('api/client/notifications/',   include(client_notification_urls)),

    path('api/customer/',  include('apps.customers.urls')),
    path('api/customers/', include('apps.customers.admin_urls')),
    path('api/products/',  include('apps.products.urls')),
    path('api/stock/',     include('apps.products.stock_urls')),
    path('api/bottles/',   include('apps.bottles.urls')),
    path('api/orders/',    include('apps.orders.urls')),
    path('api/wallet/',    include('apps.wallet.urls')),
    path('api/invoices/',  include('apps.invoices.urls')),
    path('api/driver/',    include('apps.deliveries.driver_urls')),
    path('api/client/',    include('apps.deliveries.client_urls')),
    path('api/track/',     include('apps.deliveries.tracking_urls')),
    path('api/deliveries/', include('apps.deliveries.urls')),
    path('api/store/',     include('apps.products.store_urls')),
    path('api/client/', include('apps.accounts.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/manager/',    include('apps.deliveries.manager_urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL,
                          document_root=settings.STATIC_ROOT)

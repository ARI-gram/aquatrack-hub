"""
apps/notifications/urls.py

Mount this file three times in your main urls.py:

    # main urls.py
    path('api/customer/notifications/', include('apps.notifications.urls', namespace='customer_notifs')),
    path('api/driver/notifications/',   include('apps.notifications.urls', namespace='driver_notifs')),
    path('api/client/notifications/',   include('apps.notifications.urls', namespace='client_notifs')),

Or — more cleanly — use the three separate pattern lists below
and include them individually (recommended, shown at the bottom).
"""

from django.urls import path

from apps.notifications.views import (
    # Customer
    CustomerNotificationListView,
    CustomerNotificationUnreadCountView,
    CustomerMarkNotificationsReadView,
    # Driver
    DriverNotificationListView,
    # Client admin / site manager
    ClientAdminNotificationListView,
    ClientAdminUnreadCountView,
    ClientAdminMarkReadView,
)

# ── Customer patterns ─────────────────────────────────────────────────────────
# Include at:  path('api/customer/notifications/', include(customer_notification_urls))

customer_notification_urls = [
    path('',              CustomerNotificationListView.as_view(),
         name='customer-notif-list'),
    path('unread-count/', CustomerNotificationUnreadCountView.as_view(),
         name='customer-notif-unread'),
    path('mark-read/',    CustomerMarkNotificationsReadView.as_view(),
         name='customer-notif-mark-read'),
]

# ── Driver patterns ───────────────────────────────────────────────────────────
# Include at:  path('api/driver/notifications/', include(driver_notification_urls))

driver_notification_urls = [
    path('', DriverNotificationListView.as_view(), name='driver-notif-list'),
]

# ── Client admin / site manager patterns ──────────────────────────────────────
# Include at:  path('api/client/notifications/', include(client_notification_urls))

client_notification_urls = [
    path('',              ClientAdminNotificationListView.as_view(),
         name='client-notif-list'),
    path('unread-count/', ClientAdminUnreadCountView.as_view(),
         name='client-notif-unread'),
    path('mark-read/',    ClientAdminMarkReadView.as_view(),
         name='client-notif-mark-read'),
]

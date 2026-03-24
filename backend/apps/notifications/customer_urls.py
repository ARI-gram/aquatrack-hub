# apps/notifications/client_urls.py

from django.urls import path
from apps.notifications import views

urlpatterns = [
    path('notifications/',
         views.ClientAdminNotificationListView.as_view(),
         name='client-notification-list'),

    path('notifications/unread-count/',
         views.ClientAdminUnreadCountView.as_view(),
         name='client-notification-unread'),

    path('notifications/mark-read/',
         views.ClientAdminMarkReadView.as_view(),
         name='client-notifications-mark-read'),
]

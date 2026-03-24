# apps/notifications/driver_urls.py

from django.urls import path
from apps.notifications import views

urlpatterns = [
    # GET  /api/driver/notifications/
    path('notifications/',
         views.DriverNotificationListView.as_view(),
         name='driver-notification-list'),
]

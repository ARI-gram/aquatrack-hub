"""
apps/deliveries/manager_urls.py
Site manager endpoints — mounted at /api/manager/
"""

from django.urls import path
from apps.deliveries import manager_views

app_name = 'manager'

urlpatterns = [
    # GET /api/manager/drivers/
    path('drivers/',
         manager_views.ManagerDriverListView.as_view(),
         name='driver-list'),

    # GET /api/manager/drivers/stats/
    path('drivers/stats/',
         manager_views.ManagerDriverStatsView.as_view(),
         name='driver-stats'),
]

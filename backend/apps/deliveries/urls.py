"""
apps/deliveries/urls.py
Miscellaneous delivery endpoints — mounted at /api/deliveries/

NOTE: Driver endpoints live in driver_urls.py (/api/driver/)
      Client endpoints live in client_urls.py (/api/client/)
      Public tracking lives in tracking_urls.py (/api/track/)
      This file only handles the health check.
"""

from django.urls import path
from apps.deliveries import views

app_name = 'deliveries'

urlpatterns = [

    # GET /api/deliveries/health/
    path('health/',
         views.DeliveryHealthCheckView.as_view(),
         name='health-check'),
]

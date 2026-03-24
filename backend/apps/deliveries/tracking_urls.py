"""
apps/deliveries/tracking_urls.py
Public order tracking — mounted at /api/track/
No authentication required.
"""

from django.urls import path
from apps.deliveries import views

app_name = 'public-tracking'

urlpatterns = [

    # GET /api/track/{order_number}/
    path('<str:order_number>/',
         views.PublicTrackingView.as_view(),
         name='track-order'),
]

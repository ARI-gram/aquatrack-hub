"""
apps/deliveries/client_urls.py
Client dashboard endpoints — mounted at /api/client/

IMPORTANT: Literal paths (stats, assign, available) MUST come
before the <int:delivery_id> wildcard — Django matches top-to-bottom.
"""

from django.urls import path
from apps.deliveries import views

app_name = 'client-deliveries'

urlpatterns = [

    # GET  /api/client/deliveries/stats/
    path('deliveries/stats/',
         views.ClientDeliveryStatsView.as_view(),
         name='delivery-stats'),

    # POST /api/client/deliveries/assign/
    path('deliveries/assign/',
         views.ClientAssignDriverView.as_view(),
         name='assign-deliveries'),

    # POST /api/client/orders/assign/
    path('orders/assign/',
         views.ClientAssignOrderView.as_view(),
         name='assign-orders'),

    # GET  /api/client/drivers/available/
    path('drivers/available/',
         views.ClientAvailableDriversView.as_view(),
         name='available-drivers'),

    # GET  /api/client/deliveries/
    path('deliveries/',
         views.ClientDeliveryListView.as_view(),
         name='delivery-list'),

    # GET  /api/client/deliveries/{id}/  ← wildcard LAST
    path('deliveries/<int:delivery_id>/',
         views.ClientDeliveryDetailView.as_view(),
         name='delivery-detail'),
]

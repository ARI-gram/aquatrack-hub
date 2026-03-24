"""
apps/orders/urls.py
Mounted at: api/orders/
"""
from django.urls import path
from apps.orders.views import (
    AdminOrderListView,
    AdminOrderDetailView,
)

urlpatterns = [
    path('all/',             AdminOrderListView.as_view(),  name='admin-order-list'),
    path('manage/<int:pk>/', AdminOrderDetailView.as_view(),
         name='admin-order-detail'),
]

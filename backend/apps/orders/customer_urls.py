"""
apps/orders/customer_urls.py
Mounted at: api/customer/orders/
"""
from django.urls import path
from apps.orders.views import (
    OrderListView,
    OrderCreateView,
    OrderDetailView,
    OrderCancelView,
)

urlpatterns = [
    path('',                 OrderListView.as_view(),
         name='customer-order-list'),
    path('create/',          OrderCreateView.as_view(),
         name='customer-order-create'),
    path('<int:pk>/',        OrderDetailView.as_view(),
         name='customer-order-detail'),
    path('<int:pk>/cancel/', OrderCancelView.as_view(),
         name='customer-order-cancel'),
]

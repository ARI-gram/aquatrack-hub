# apps/orders/urls.py

from django.urls import path
from apps.orders.views import (
    AdminCreateOrderView,
    AdminOrderListView,
    AdminOrderDetailView,
)

urlpatterns = [
    path('all/',              AdminOrderListView.as_view(),
         name='admin-order-list'),
    path('manage/<int:pk>/',  AdminOrderDetailView.as_view(),
         name='admin-order-detail'),
    path('admin-create/',     AdminCreateOrderView.as_view(),
         name='admin-create-order'),  # ← removed extra "orders/"
]

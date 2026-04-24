from django.urls import path
from apps.bottles.views import (
    BottleInventoryView,
    BottleTransactionListView,
)

app_name = 'bottles'

urlpatterns = [
    path('inventory/', BottleInventoryView.as_view(), name='inventory'),
    path('transactions/', BottleTransactionListView.as_view(), name='transactions'),
]

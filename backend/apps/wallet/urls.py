from django.urls import path
from apps.wallet.views import (
    WalletView,
    WalletTopUpView,
    WalletTransactionListView,
)

app_name = 'wallet'

urlpatterns = [
    path('', WalletView.as_view(), name='wallet'),
    path('topup/', WalletTopUpView.as_view(), name='topup'),
    path('transactions/', WalletTransactionListView.as_view(), name='transactions'),
]

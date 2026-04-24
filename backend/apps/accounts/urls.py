# apps/accounts/urls.py

from django.urls import path
from apps.accounts.views import AccountingSettingsView, CustomerAccountingSettingsView, DirectSalesView

urlpatterns = [
    path(
        'accounting-settings/',
        AccountingSettingsView.as_view(),
        name='accounting-settings',
    ),
    path(
        'accounts/direct-sales',
        DirectSalesView.as_view(),
        name='direct-sales',
    ),
    path('accounting-settings/', CustomerAccountingSettingsView.as_view(),
         name='customer-accounting-settings'),
]

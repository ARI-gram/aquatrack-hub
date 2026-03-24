# apps/accounts/urls.py

from django.urls import path
from apps.accounts.views import AccountingSettingsView

urlpatterns = [
    path(
        'accounting-settings/',
        AccountingSettingsView.as_view(),
        name='accounting-settings',
    ),
]

"""
Client URL Configuration
apps/clients/urls.py
"""

from django.urls import path
from apps.clients.views import (
    ClientListCreateView,
    ClientDetailView,
    ClientSuspendView,
    ClientStatsView,
    ClientEmployeesView,
    ClientResetCredentialsView,
)

app_name = 'clients'

urlpatterns = [
    # List + Create
    path('', ClientListCreateView.as_view(), name='client-list-create'),

    # Detail + Update + Soft-delete
    path('<uuid:pk>/', ClientDetailView.as_view(), name='client-detail'),

    # Dedicated suspend action
    path('<uuid:pk>/suspend/', ClientSuspendView.as_view(), name='client-suspend'),

    # Stats and employees
    path('<uuid:pk>/stats/', ClientStatsView.as_view(), name='client-stats'),
    path('<uuid:pk>/employees/', ClientEmployeesView.as_view(),
         name='client-employees'),
    path('<uuid:pk>/reset-credentials/',
         ClientResetCredentialsView.as_view(), name='client-reset-credentials'),
]

"""
Billing URL Configuration
apps/billing/urls.py
"""

from django.urls import path
from apps.billing.views import (
    SubscriptionListView,
    BillingStatsView,
    InvoiceListView,
    InvoiceDetailView,
    MarkInvoicePaidView,
)

app_name = 'billing'

urlpatterns = [
    # Subscriptions
    path('subscriptions/', SubscriptionListView.as_view(),
         name='subscription-list'),
    path('subscriptions/stats/', BillingStatsView.as_view(),
         name='subscription-stats'),

    # Invoices
    path('invoices/', InvoiceListView.as_view(), name='invoice-list'),
    path('invoices/<uuid:pk>/', InvoiceDetailView.as_view(), name='invoice-detail'),
    path('invoices/<uuid:pk>/mark-paid/',
         MarkInvoicePaidView.as_view(), name='invoice-mark-paid'),
]

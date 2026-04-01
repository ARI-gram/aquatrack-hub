# apps/invoices/urls.py

from django.urls import path
from apps.invoices.views import (
    InvoiceListView,
    InvoiceDetailView,
    InvoiceIssueView,
    InvoiceMarkPaidView,
)
from apps.invoices.payment_views import (
    PaymentReportView,
    RecordPaymentView,
    BulkPaymentView,
    MarkOverdueView,
    CustomerStatementView,
)
from apps.invoices.direct_sales_views import DirectSalesView

urlpatterns = [
    # Direct sales endpoint (for recording one-off sales without a customer account)
    path('client/accounts/direct-sales/', DirectSalesView.as_view()),

    # ── Invoice list & detail ─────────────────────────────────────────────────
    path('',
         InvoiceListView.as_view(),
         name='invoice-list'),

    path('<uuid:pk>/',
         InvoiceDetailView.as_view(),
         name='invoice-detail'),

    # ── Status actions ────────────────────────────────────────────────────────
    path('<uuid:pk>/issue/',
         InvoiceIssueView.as_view(),
         name='invoice-issue'),

    path('<uuid:pk>/mark-paid/',
         InvoiceMarkPaidView.as_view(),
         name='invoice-mark-paid'),

    # ── Payment recording ─────────────────────────────────────────────────────
    # Record a payment against a single invoice (partial or full)
    path('<uuid:pk>/record-payment/',
         RecordPaymentView.as_view(),
         name='invoice-record-payment'),

    # Record one lump sum payment — allocates to oldest invoices first
    path('bulk-payment/',
         BulkPaymentView.as_view(),
         name='invoice-bulk-payment'),

    # Flip all ISSUED invoices past due_date to OVERDUE
    path('mark-overdue/',
         MarkOverdueView.as_view(),
         name='invoice-mark-overdue'),

    # ── Customer account statement ────────────────────────────────────────────
    # Full picture: credit info, aging, all invoices
    path('customer/<uuid:customer_id>/statement/',
         CustomerStatementView.as_view(),
         name='customer-statement'),

    # ── Payment reporting ───────────────────────────────────────────────────
    path('payment-report/', PaymentReportView.as_view(), name='payment-report'),
]

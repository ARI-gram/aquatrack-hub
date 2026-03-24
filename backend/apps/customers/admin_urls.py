# apps/customers/admin_urls.py
from django.urls import path

from apps.customers.admin_views import (
    CustomerListCreateView,
    CustomerDetailView,
    CustomerBlockView,
    CustomerUnblockView,
    CustomerResendInviteView,
    InviteResolveView,
    InviteCompleteView,
)
from apps.customers.invoice_views import (
    CreditTermsView,
    CustomerInvoiceListView,
    GenerateInvoiceView,
    AllInvoicesView,
    InvoiceDetailView,
    IssueInvoiceView,
    MarkInvoicePaidView,
)
from apps.customers.grace_views import (
    AdminGraceRequestListView,
    ApproveGraceRequestView,
    DenyGraceRequestView,
)

app_name = 'customers_admin'

urlpatterns = [
    # ── Public (no auth) ─────────────────────────────────────────────────────
    path('invite/<str:token>/',
         InviteResolveView.as_view(), name='invite-resolve'),
    path('invite/<str:token>/complete/',
         InviteCompleteView.as_view(), name='invite-complete'),

    # ── Invoices (before <uuid:pk>/ to avoid UUID-matching "invoices") ───────
    path('invoices/',
         AllInvoicesView.as_view(), name='all-invoices'),
    path('invoices/<uuid:inv_id>/',
         InvoiceDetailView.as_view(), name='invoice-detail'),
    path('invoices/<uuid:inv_id>/issue/',
         IssueInvoiceView.as_view(), name='invoice-issue'),
    path('invoices/<uuid:inv_id>/mark-paid/',
         MarkInvoicePaidView.as_view(), name='invoice-mark-paid'),

    # ── Grace requests (admin side) ───────────────────────────────────────────
    path('grace-requests/',
         AdminGraceRequestListView.as_view(), name='grace-requests'),
    path('grace-requests/<uuid:pk>/approve/',
         ApproveGraceRequestView.as_view(), name='grace-approve'),
    path('grace-requests/<uuid:pk>/deny/',
         DenyGraceRequestView.as_view(), name='grace-deny'),

    # ── Customer list / create ────────────────────────────────────────────────
    path('',
         CustomerListCreateView.as_view(), name='list-create'),

    # ── Per-customer ──────────────────────────────────────────────────────────
    path('<uuid:pk>/',
         CustomerDetailView.as_view(), name='detail'),
    path('<uuid:pk>/block/',
         CustomerBlockView.as_view(), name='block'),
    path('<uuid:pk>/unblock/',
         CustomerUnblockView.as_view(), name='unblock'),
    path('<uuid:pk>/resend-invite/',
         CustomerResendInviteView.as_view(), name='resend-invite'),
    path('<uuid:pk>/credit-terms/',
         CreditTermsView.as_view(), name='credit-terms'),
    path('<uuid:pk>/invoices/',
         CustomerInvoiceListView.as_view(), name='customer-invoices'),
    path('<uuid:pk>/invoices/generate/',
         GenerateInvoiceView.as_view(), name='generate-invoice'),
]

# apps/reports/urls.py

from django.urls import path
from apps.reports.views import (
    RevenueReportView,
    VatReportView,
    OutstandingReportView,
)

urlpatterns = [
    path('revenue/',     RevenueReportView.as_view(),     name='report-revenue'),
    path('vat/',         VatReportView.as_view(),         name='report-vat'),
    path('outstanding/', OutstandingReportView.as_view(),
         name='report-outstanding'),
]

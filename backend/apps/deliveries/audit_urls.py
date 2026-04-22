"""
apps/deliveries/audit_urls.py
Admin/manager audit endpoints — mounted at /api/drivers/
"""

from django.urls import path
from apps.deliveries.views_audit import DriverBottleAuditView

app_name = 'drivers-audit'

urlpatterns = [
    # GET /api/drivers/bottle-audit/
    path('bottle-audit/', DriverBottleAuditView.as_view(), name='bottle-audit'),
]

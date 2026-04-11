"""
Authentication URL Configuration
apps/authentication/urls.py

Updated to include employee management endpoints for Client Admins.
"""

from django.urls import path
from apps.authentication.views import (
    UserRegistrationView,
    LoginView,
    LogoutView,
    UserProfileView,
    ChangePasswordView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    CustomTokenRefreshView,
)
from apps.authentication.employee_views import (
    EmployeeListCreateView,
    EmployeeDetailView,
    EmployeeDeactivateView,
    EmployeeReactivateView,
    EmployeeResetPasswordView,
)
from apps.deliveries.views_audit import DriverBottleAuditView

app_name = 'authentication'

urlpatterns = [
    # ── Auth ──────────────────────────────────────────────────────────────
    path('register/',              UserRegistrationView.as_view(),   name='register'),
    path('login/',                 LoginView.as_view(),               name='login'),
    path('logout/',                LogoutView.as_view(),              name='logout'),
    path('refresh-token/',         CustomTokenRefreshView.as_view(),
         name='token-refresh'),

    # ── Profile & passwords ───────────────────────────────────────────────
    path('profile/',               UserProfileView.as_view(),         name='profile'),
    path('change-password/',       ChangePasswordView.as_view(),
         name='change-password'),
    path('password-reset/',        PasswordResetRequestView.as_view(),
         name='password-reset'),
    path('password-reset-confirm/', PasswordResetConfirmView.as_view(),
         name='password-reset-confirm'),

    # ── Employee management (Client Admin only) ───────────────────────────
    path('employees/',
         EmployeeListCreateView.as_view(),
         name='employee-list-create'),

    path('employees/<uuid:pk>/',
         EmployeeDetailView.as_view(),
         name='employee-detail'),

    path('employees/<uuid:pk>/deactivate/',
         EmployeeDeactivateView.as_view(),
         name='employee-deactivate'),

    path('employees/<uuid:pk>/reactivate/',
         EmployeeReactivateView.as_view(),
         name='employee-reactivate'),

    path('employees/<uuid:pk>/reset-password/',
         EmployeeResetPasswordView.as_view(),
         name='employee-reset-password'),

    path('drivers/bottle-audit/', DriverBottleAuditView.as_view(),
         name='driver-bottle-audit'),
]

"""
Authentication Views for AquaTrack
==================================

This module handles all authentication-related API endpoints.

Endpoints:
- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- POST /api/auth/logout - User logout
- POST /api/auth/refresh-token - Refresh JWT token
- GET /api/auth/profile - Get user profile
- PUT /api/auth/profile - Update user profile
- POST /api/auth/change-password - Change password
- POST /api/auth/password-reset - Request password reset
- POST /api/auth/password-reset-confirm - Confirm password reset
"""

from rest_framework import status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from django.contrib.auth import logout

from apps.authentication.models import User
from apps.authentication.serializers import (
    UserSerializer,
    UserRegistrationSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    UserProfileSerializer
)


class UserRegistrationView(generics.CreateAPIView):
    """
    User registration endpoint.

    POST /api/auth/register

    Registers new users (client_admin, site_manager, driver).
    Note: super_admin and customer accounts use different endpoints.

    Request Body:
        {
            "email": "admin@example.com",
            "password": "securepass123",
            "password_confirm": "securepass123",
            "first_name": "John",
            "last_name": "Doe",
            "phone": "+254712345678",
            "role": "client_admin",
            "client": 1
        }

    Response (201):
        {
            "id": 1,
            "email": "admin@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "full_name": "John Doe",
            "phone": "+254712345678",
            "role": "client_admin",
            "client": 1,
            "is_active": true,
            "is_verified": false,
            "created_at": "2026-02-04T10:30:00Z"
        }
    """

    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Return user data
        user_serializer = UserSerializer(user)
        return Response(
            {
                'user': user_serializer.data,
                'message': 'Registration successful. Please verify your email.'
            },
            status=status.HTTP_201_CREATED
        )


class LoginView(generics.GenericAPIView):
    """
    User login endpoint.

    POST /api/auth/login

    Authenticates user and returns JWT tokens.

    Request Body:
        {
            "email": "admin@example.com",
            "password": "securepass123"
        }

    Response (200):
        {
            "user": {
                "id": 1,
                "email": "admin@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "role": "client_admin",
                ...
            },
            "tokens": {
                "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
                "access": "eyJ0eXAiOiJKV1QiLCJhbGc..."
            }
        }
    """

    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        return Response(result, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    User logout endpoint.

    POST /api/auth/logout

    Blacklists the refresh token to prevent reuse.

    Request Body:
        {
            "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
        }

    Response (200):
        {
            "message": "Logout successful"
        }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")

            if not refresh_token:
                return Response(
                    {"error": "Refresh token is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Blacklist the refresh token
            token = RefreshToken(refresh_token)
            token.blacklist()

            # Django logout
            logout(request)

            return Response(
                {"message": "Logout successful"},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    User profile endpoint.

    GET /api/auth/profile - Get current user profile
    PUT /api/auth/profile - Update current user profile
    PATCH /api/auth/profile - Partial update

    Response (200):
        {
            "id": 1,
            "email": "admin@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "full_name": "John Doe",
            "phone": "+254712345678",
            "role": "client_admin",
            "client": 1,
            "client_name": "ABC Water Distributors",
            ...
        }
    """

    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        """Return the current user."""
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    """
    Change password endpoint.

    POST /api/auth/change-password

    Allows authenticated users to change their password.

    Request Body:
        {
            "old_password": "oldpass123",
            "new_password": "newpass123",
            "new_password_confirm": "newpass123"
        }

    Response (200):
        {
            "message": "Password changed successfully"
        }
    """

    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {"message": "Password changed successfully"},
            status=status.HTTP_200_OK
        )


class PasswordResetRequestView(generics.GenericAPIView):
    """
    Password reset request endpoint.

    POST /api/auth/password-reset

    Sends password reset email to user.

    Request Body:
        {
            "email": "user@example.com"
        }

    Response (200):
        {
            "message": "Password reset email sent if account exists"
        }
    """

    serializer_class = PasswordResetRequestSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Always return success for security (don't reveal if email exists)
        return Response(
            {"message": "Password reset email sent if account exists"},
            status=status.HTTP_200_OK
        )


class PasswordResetConfirmView(generics.GenericAPIView):
    """
    Password reset confirmation endpoint.

    POST /api/auth/password-reset-confirm

    Resets password using token from email.

    Request Body:
        {
            "token": "reset-token-from-email",
            "new_password": "newpass123",
            "new_password_confirm": "newpass123"
        }

    Response (200):
        {
            "message": "Password reset successful"
        }
    """

    serializer_class = PasswordResetConfirmSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {"message": "Password reset successful"},
            status=status.HTTP_200_OK
        )


# Optional: Token refresh view (using built-in SimpleJWT view)
class CustomTokenRefreshView(TokenRefreshView):
    """
    JWT token refresh endpoint.

    POST /api/auth/refresh-token

    Refreshes access token using refresh token.

    Request Body:
        {
            "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
        }

    Response (200):
        {
            "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
            "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."  (if rotation enabled)
        }
    """
    pass

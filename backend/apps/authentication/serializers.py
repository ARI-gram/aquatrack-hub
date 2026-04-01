"""
Authentication Serializers for AquaTrack
========================================

This module handles serialization for user authentication.

Key Features:
- User registration (different roles)
- Login with email/password
- JWT token generation
- Password validation
- User profile serialization

Serializers:
- UserSerializer: Basic user data
- UserRegistrationSerializer: Create new users
- LoginSerializer: User login
- ChangePasswordSerializer: Password updates
- TokenRefreshSerializer: JWT token refresh
"""
import secrets
from django.core.cache import cache
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.tokens import RefreshToken
from apps.authentication.models import User


class UserSerializer(serializers.ModelSerializer):
    """
    Basic user serializer for displaying user information.

    Used for:
    - User profile display
    - User lists in admin
    - Nested serialization in other models
    """

    must_change_password = serializers.BooleanField(read_only=True)
    password_changed_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone',
            'role',
            'client',
            'is_active',
            'is_verified',
            'created_at',
            'last_login',
            'must_change_password',
            'password_changed_at',
        ]
        read_only_fields = ['id', 'created_at', 'last_login']

    def get_full_name(self, obj):
        """Get user's full name."""
        return obj.full_name  # ✅ FIXED: was obj.get_full_name() which doesn't exist


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    User registration serializer.

    Handles registration for different user roles:
    - client_admin: Distributor company admin
    - site_manager: Site/warehouse manager
    - driver: Delivery driver

    Note: super_admin can only be created via Django admin
    Note: customers use separate CustomerRegistrationSerializer
    """

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = [
            'email',
            'password',
            'password_confirm',
            'first_name',
            'last_name',
            'phone',
            'role',
            'client'
        ]

    def validate_role(self, value):
        """
        Validate that role is allowed for registration.
        super_admin and customer cannot be created via this endpoint.
        """
        if value in ['super_admin', 'customer']:
            raise serializers.ValidationError(
                f"Cannot register as {value} through this endpoint."
            )
        return value

    def validate_client(self, value):
        """
        Validate client assignment based on role.
        All roles except super_admin must have a client.
        """
        role = self.initial_data.get('role')
        if role != 'super_admin' and not value:
            raise serializers.ValidationError(
                "Client is required for this role."
            )
        return value

    def validate(self, attrs):
        """
        Validate that passwords match.
        """
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': "Passwords do not match."
            })
        return attrs

    def create(self, validated_data):
        """
        Create new user with hashed password.
        """
        # Remove password_confirm as it's not needed for user creation
        validated_data.pop('password_confirm')

        # Create user with create_user method (handles password hashing)
        user = User.objects.create_user(**validated_data)

        return user


class LoginSerializer(serializers.Serializer):
    """
    User login serializer.

    Authenticates user and returns JWT tokens.

    Request:
        {
            "email": "admin@example.com",
            "password": "password123"
        }

    Response:
        {
            "user": {...},
            "tokens": {
                "access": "...",
                "refresh": "..."
            }
        }
    """

    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )

    def validate(self, attrs):
        """
        Validate credentials and authenticate user.
        """
        email = attrs.get('email')
        password = attrs.get('password')

        # Authenticate user
        user = authenticate(
            request=self.context.get('request'),
            email=email,
            password=password
        )

        if not user:
            raise serializers.ValidationError(
                "Invalid email or password."
            )

        if not user.is_active:
            raise serializers.ValidationError(
                "This account has been deactivated."
            )

        # Store user in validated data
        attrs['user'] = user
        return attrs

    def create(self, validated_data):
        """
        Generate JWT tokens for authenticated user.
        """
        user = validated_data['user']

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)

        return {
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }


class ChangePasswordSerializer(serializers.Serializer):
    """
    Change password serializer.

    Allows authenticated users to change their password.

    Request:
        {
            "old_password": "currentpass123",
            "new_password": "newpass123",
            "new_password_confirm": "newpass123"
        }
    """

    old_password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    new_password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )

    def validate_old_password(self, value):
        """
        Validate that old password is correct.
        """
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError(
                "Old password is incorrect."
            )
        return value

    def validate(self, attrs):
        """
        Validate that new passwords match.
        """
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': "New passwords do not match."
            })
        return attrs

    def save(self, **kwargs):
        from django.utils import timezone
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.must_change_password = False
        user.password_changed_at = timezone.now()
        user.save(update_fields=[
                  'password', 'must_change_password', 'password_changed_at'])
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        # Normalise but don't reveal if it exists
        return value.lower().strip()

    def save(self):
        from django.conf import settings
        from django.core.cache import cache
        from django.core.mail import EmailMultiAlternatives
        email = self.validated_data['email']
        frontend_url = getattr(settings, 'FRONTEND_URL',
                               'http://localhost:5173')

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Security: return silently — don't reveal whether email exists
            return

        # ── Generate a short-lived token ─────────────────────────────────────
        # Store in Django cache (Redis or memcache in prod, DB cache in dev).
        # Key: password_reset_{token} → user pk
        # Expires in 1 hour.
        token = secrets.token_urlsafe(32)
        cache_key = f'password_reset_{token}'
        cache.set(cache_key, str(user.pk), timeout=3600)   # 1 hour

        reset_url = f'{frontend_url}/reset-password?token={token}'

        # ── Build email ───────────────────────────────────────────────────────
        subject, html = _get_password_reset_request_email(
            first_name=user.first_name,
            email=user.email,
            reset_url=reset_url,
        )

        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=(
                    f"Hi {user.first_name},\n\n"
                    f"Reset your AquaTrack password here:\n{reset_url}\n\n"
                    f"This link expires in 1 hour. If you didn't request this, ignore this email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            msg.attach_alternative(html, 'text/html')
            msg.send()
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error(
                'Failed to send password reset email to %s: %s', user.email, exc
            )


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password],
        style={'input_type': 'password'},
    )
    new_password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'},
    )

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': 'Passwords do not match.'
            })

        # Validate token and look up user
        cache_key = f"password_reset_{attrs['token']}"
        user_pk = cache.get(cache_key)

        if not user_pk:
            raise serializers.ValidationError({
                'token': 'This reset link is invalid or has expired.'
            })

        try:
            attrs['user'] = User.objects.get(pk=user_pk)
        except User.DoesNotExist:
            raise serializers.ValidationError({
                'token': 'This reset link is invalid or has expired.'
            })

        attrs['cache_key'] = cache_key
        return attrs

    def save(self):
        from django.utils import timezone
        user = self.validated_data['user']
        cache_key = self.validated_data['cache_key']

        user.set_password(self.validated_data['new_password'])
        user.must_change_password = False
        user.password_changed_at = timezone.now()
        user.save(update_fields=[
                  'password', 'must_change_password', 'password_changed_at'])

        # Invalidate the token immediately after use
        cache.delete(cache_key)

        return {'message': 'Password reset successful'}


class UserProfileSerializer(serializers.ModelSerializer):
    """
    User profile serializer with additional information.

    Used for detailed user profile display.
    Includes client information if applicable.
    """

    full_name = serializers.SerializerMethodField()
    client_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone',
            'role',
            'client',
            'client_name',
            'is_active',
            'is_verified',
            'created_at',
            'updated_at',
            'last_login'
        ]
        read_only_fields = [
            'id',
            'email',
            'role',
            'client',
            'is_verified',
            'created_at',
            'updated_at',
            'last_login'
        ]

    def get_full_name(self, obj):
        """Get user's full name."""
        return obj.full_name  # ✅ FIXED: was obj.get_full_name() which doesn't exist

    def get_client_name(self, obj):
        """Get client company name if user belongs to a client."""
        if obj.client:
            return obj.client.company_name
        return None


class TokenRefreshResponseSerializer(serializers.Serializer):
    """
    Token refresh response serializer.

    Used for documentation purposes.
    """

    access = serializers.CharField()
    refresh = serializers.CharField()

# ─── Password reset request email template ────────────────────────────────────


def _get_password_reset_request_email(
    first_name: str,
    email: str,
    reset_url: str,
) -> tuple:
    subject = "Reset your AquaTrack password"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 20px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0c1e35 0%,#0f3460 60%,#0a4a7c 100%);border-radius:16px 16px 0 0;padding:48px 40px 36px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:14px 20px;">
                  <span style="font-family:'Georgia',serif;font-size:20px;font-weight:700;color:#ffffff;">
                    Aqua<span style="color:#38bdf8;">Track</span>
                  </span>
                </td>
              </tr>
            </table>
            <div style="width:64px;height:64px;background:rgba(56,189,248,0.15);border:1.5px solid rgba(56,189,248,0.35);border-radius:50%;margin:0 auto 20px;text-align:center;line-height:64px;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#38bdf8" stroke-width="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#ffffff;">Password Reset Request</h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.6);">We received a request to reset your password</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:40px 40px 32px;">
            <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
              Hi <strong style="color:#0f3460;">{first_name}</strong>,
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#6b7280;line-height:1.7;">
              Someone requested a password reset for the AquaTrack account associated with
              <strong style="color:#374151;">{email}</strong>.
              If this was you, click the button below to set a new password.
            </p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td align="center">
                  <a href="{reset_url}"
                     style="display:inline-block;background:linear-gradient(135deg,#0f3460,#0a4a7c);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:16px 48px;border-radius:10px;letter-spacing:0.3px;">
                    Reset My Password →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Expiry warning -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:10px;padding:16px 18px;">
                  <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">
                    ⚠️ <strong>This link expires in 1 hour.</strong>
                    If you didn't request a password reset, you can safely ignore this email —
                    your password will not be changed.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Fallback URL -->
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin:0;font-size:11px;color:#6b7280;word-break:break-all;">
              <a href="{reset_url}" style="color:#0f3460;">{reset_url}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">
              This email was sent by <strong style="color:#6b7280;">AquaTrack</strong> · Water Distribution Management
            </p>
            <p style="margin:0;font-size:12px;color:#d1d5db;">© 2026 AquaTrack. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>"""

    return subject, html

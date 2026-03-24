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

    full_name = serializers.SerializerMethodField()

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
            'last_login'
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
        """
        Update user password.
        """
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    """
    Password reset request serializer.

    Sends password reset email to user.

    Request:
        {
            "email": "user@example.com"
        }
    """

    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        """
        Validate that email exists in system.
        """
        try:
            user = User.objects.get(email=value)
        except User.DoesNotExist:
            # For security, don't reveal if email exists or not
            # Return success either way
            pass
        return value

    def save(self):
        """
        Send password reset email.

        Note: Actual email sending logic should be implemented here.
        This is a placeholder for now.
        """
        email = self.validated_data['email']

        try:
            user = User.objects.get(email=email)
            # TODO: Generate reset token
            # TODO: Send email with reset link
            # For now, just return success
            return {'email': email}
        except User.DoesNotExist:
            # For security, return success even if email doesn't exist
            return {'email': email}


class PasswordResetConfirmSerializer(serializers.Serializer):
    """
    Password reset confirmation serializer.

    Resets password using token from email.

    Request:
        {
            "token": "reset-token-from-email",
            "new_password": "newpass123",
            "new_password_confirm": "newpass123"
        }
    """

    token = serializers.CharField(required=True)
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

    def validate(self, attrs):
        """
        Validate that new passwords match.
        """
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': "Passwords do not match."
            })
        return attrs

    def save(self):
        """
        Reset password using token.

        Note: Actual token validation logic should be implemented here.
        This is a placeholder for now.
        """
        # TODO: Validate token
        # TODO: Get user from token
        # TODO: Update password
        # For now, just return success
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

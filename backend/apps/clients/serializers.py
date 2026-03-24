"""
Client Serializers
apps/clients/serializers.py

Returns camelCase fields matching the TypeScript frontend types.

Key change: ClientCreateSerializer.create() now stores the temp_password
on self._temp_password so the view can include it in the response.
"""

from rest_framework import serializers
from django.db import transaction
from django.core.mail import send_mail
from django.conf import settings
from django.utils.crypto import get_random_string
from datetime import timedelta
from django.utils import timezone

from apps.clients.models import Client, SubscriptionPlan, SubscriptionStatus
from apps.authentication.models import User


# ─── Output serializers (camelCase for the frontend) ──────────────────────────

class ClientSerializer(serializers.ModelSerializer):
    """
    Full client serializer — returns camelCase fields matching the
    TypeScript Client interface in client.types.ts
    """

    zipCode = serializers.CharField(source='zip_code', read_only=True)
    subscriptionPlan = serializers.CharField(
        source='subscription_plan', read_only=True)
    subscriptionStatus = serializers.CharField(
        source='subscription_status', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Client
        fields = [
            'id',
            'name',
            'email',
            'phone',
            'address',
            'city',
            'state',
            'zipCode',
            'country',
            'logo',
            'website',
            'subscriptionPlan',
            'subscriptionStatus',
            'createdAt',
            'updatedAt',
        ]


class ClientListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for paginated list views.
    Returns camelCase fields.
    """

    zipCode = serializers.CharField(source='zip_code', read_only=True)
    subscriptionPlan = serializers.CharField(
        source='subscription_plan', read_only=True)
    subscriptionStatus = serializers.CharField(
        source='subscription_status', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Client
        fields = [
            'id',
            'name',
            'email',
            'phone',
            'subscriptionPlan',
            'subscriptionStatus',
            'zipCode',
            'country',
            'city',
            'createdAt',
            'updatedAt',
        ]


# ─── Input serializers ────────────────────────────────────────────────────────

class ClientCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new clients.

    Features:
    - Accepts camelCase field names from the frontend
    - Creates a client admin user automatically
    - Sends login credentials via email
    - Sets up free trial or paid plan period

    After save(), access self._temp_password and self._admin_user for
    inclusion in the view's response payload.
    """

    zipCode = serializers.CharField(
        write_only=True,
        max_length=20,
        help_text="Postal / ZIP code"
    )
    subscriptionPlan = serializers.ChoiceField(
        write_only=True,
        # Accept both the frontend enum values AND the display slugs
        choices=[
            'free_trial',
            # frontend sends these:
            'basic', 'pro', 'enterprise',
            # legacy display slugs (kept for safety):
            'starter', 'professional',
        ],
        default='free_trial',
        help_text="Subscription plan"
    )
    admin_first_name = serializers.CharField(
        write_only=True,
        required=False,
        default='Admin',
        help_text="Admin user first name (optional)"
    )
    admin_last_name = serializers.CharField(
        write_only=True,
        required=False,
        help_text="Admin user last name (defaults to company name)"
    )

    class Meta:
        model = Client
        fields = [
            'name',
            'email',
            'phone',
            'address',
            'city',
            'state',
            'zipCode',
            'country',
            'website',
            'subscriptionPlan',
            'admin_first_name',
            'admin_last_name',
        ]

    def validate_email(self, value):
        if Client.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "A client with this email already exists."
            )
        return value

    def _map_plan(self, value: str) -> str:
        """
        Map frontend plan slug → SubscriptionPlan model choice.

        Handles both the camelCase frontend values ('basic', 'pro') and
        the legacy display slugs ('starter', 'professional').
        """
        mapping = {
            # Frontend enum values (what Createclientdialog.tsx sends)
            'free_trial':   SubscriptionPlan.TRIAL,
            'basic':        SubscriptionPlan.BASIC,
            'pro':          SubscriptionPlan.PRO,
            'enterprise':   SubscriptionPlan.ENTERPRISE,
            # Legacy display slugs (kept for backwards compat)
            'starter':      SubscriptionPlan.BASIC,
            'professional': SubscriptionPlan.PRO,
        }
        return mapping.get(value, SubscriptionPlan.TRIAL)

    @transaction.atomic
    def create(self, validated_data):
        zip_code = validated_data.pop('zipCode')
        plan_slug = validated_data.pop('subscriptionPlan', 'free_trial')
        admin_first_name = validated_data.pop('admin_first_name', 'Admin')
        admin_last_name = validated_data.pop(
            'admin_last_name',
            validated_data.get('name', '').split()[0]
        )

        subscription_plan = self._map_plan(plan_slug)

        if subscription_plan == SubscriptionPlan.TRIAL:
            subscription_status = SubscriptionStatus.TRIAL
            subscription_expires_at = timezone.now() + timedelta(days=14)
        else:
            subscription_status = SubscriptionStatus.ACTIVE
            subscription_expires_at = timezone.now() + timedelta(days=30)

        client = Client.objects.create(
            zip_code=zip_code,
            subscription_plan=subscription_plan,
            subscription_status=subscription_status,
            subscription_expires_at=subscription_expires_at,
            **validated_data,
        )

        admin_user, temp_password = self._create_admin_user(
            client=client,
            first_name=admin_first_name,
            last_name=admin_last_name,
        )

        self._send_credentials_email(client, admin_user, temp_password)

        # Store on the instance so the view can include them in the response
        self._temp_password = temp_password
        self._admin_user = admin_user

        return client

    def _create_admin_user(self, client, first_name, last_name):
        """Generate a temporary password and create the admin user."""
        temp_password = get_random_string(
            length=12,
            # Mix upper, lower, digits for a secure-looking temp password
            allowed_chars='abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
        )
        admin_user = User.objects.create_user(
            email=client.email,
            password=temp_password,
            first_name=first_name,
            last_name=last_name,
            role='client_admin',
            client=client,
            is_verified=False,
            is_active=True,
        )
        return admin_user, temp_password

    def _send_credentials_email(self, client, admin_user, temp_password):
        from django.core.mail import EmailMultiAlternatives
        from django.conf import settings
        from apps.clients.email_templates import get_welcome_email
        import logging

        frontend_url = getattr(settings, 'FRONTEND_URL',
                               'http://localhost:5173')
        plan_name = client.get_subscription_plan_display()
        expires_text = client.subscription_expires_at.strftime('%B %d, %Y')

        subject, html = get_welcome_email(
            first_name=admin_user.first_name,
            email=admin_user.email,
            temp_password=temp_password,
            frontend_url=frontend_url,
            plan_info=plan_name,
            expires_text=expires_text,
        )

        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=f"Welcome to AquaTrack!\n\nEmail: {admin_user.email}\nPassword: {temp_password}\n\nLogin: {frontend_url}/login",
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[admin_user.email],
            )
            msg.attach_alternative(html, "text/html")
            msg.send()
        except Exception as exc:
            logging.getLogger(__name__).error(
                "Failed to send welcome email to %s: %s", admin_user.email, exc)

    def to_representation(self, instance):
        """
        NOT used for the create response — the view builds that manually
        so it can include temporary_password.  Used only if this serializer
        is called in read contexts.
        """
        return ClientSerializer(instance).data


class ClientUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating existing clients.
    Accepts camelCase field names from the frontend.
    """

    zipCode = serializers.CharField(
        source='zip_code', required=False, max_length=20)
    subscriptionPlan = serializers.ChoiceField(
        source='subscription_plan',
        choices=[
            'free_trial', 'basic', 'pro', 'enterprise',
            'trial',                           # model value alias
            'starter', 'professional',         # legacy display slugs
        ],
        required=False,
    )
    subscription_status = serializers.ChoiceField(
        choices=['active', 'inactive', 'trial', 'cancelled'],
        required=False,
    )

    class Meta:
        model = Client
        fields = [
            'name',
            'email',
            'phone',
            'address',
            'city',
            'state',
            'zipCode',
            'country',
            'website',
            'logo',
            'subscriptionPlan',
            'subscription_status',
        ]

    def validate_subscriptionPlan(self, value):
        plan_mapping = {
            'free_trial':   SubscriptionPlan.TRIAL,
            'basic':        SubscriptionPlan.BASIC,
            'pro':          SubscriptionPlan.PRO,
            'enterprise':   SubscriptionPlan.ENTERPRISE,
            'trial':        SubscriptionPlan.TRIAL,
            'starter':      SubscriptionPlan.BASIC,
            'professional': SubscriptionPlan.PRO,
        }
        return plan_mapping.get(value, value)

    def to_representation(self, instance):
        return ClientSerializer(instance).data


# ─── Stats serializer ─────────────────────────────────────────────────────────

class ClientStatsSerializer(serializers.Serializer):
    totalOrders = serializers.IntegerField()
    totalDeliveries = serializers.IntegerField()
    totalCustomers = serializers.IntegerField()
    totalEmployees = serializers.IntegerField()
    monthlyRevenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    outstandingPayments = serializers.DecimalField(
        max_digits=12, decimal_places=2)

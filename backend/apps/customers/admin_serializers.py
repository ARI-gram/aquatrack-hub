"""
Customer Admin Serializers
apps/customers/admin_serializers.py

Changes from previous version:
  + payment_profile field on CustomerAdminSerializer
    → returns credit_account_enabled, credit_limit, outstanding_balance,
      available_credit for the AccountantCustomersPage
  + has_overdue field on CustomerAdminSerializer
    → True if customer has any OVERDUE or past-due ISSUED invoices
"""

from decimal import Decimal
from datetime import timedelta

from rest_framework import serializers
from django.utils import timezone

from apps.customers.models import Customer, CustomerInvite


class CustomerAdminCreateSerializer(serializers.ModelSerializer):
    """
    Backward-compatible. Credit fields are all optional.
    """

    billing_cycle = serializers.ChoiceField(
        choices=['IMMEDIATE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'],
        required=False, allow_null=True, default=None,
    )
    credit_limit = serializers.DecimalField(
        max_digits=10, decimal_places=2,
        required=False, default=Decimal('0.00'),
    )
    payment_due_days = serializers.IntegerField(
        min_value=1, max_value=365, required=False, default=30,
    )
    grace_period_days = serializers.IntegerField(
        min_value=1, max_value=30, required=False, default=7,
    )
    credit_notes = serializers.CharField(
        required=False, allow_blank=True, default='',
    )

    class Meta:
        model = Customer
        fields = [
            'phone_number', 'full_name', 'email', 'customer_type',
            'billing_cycle', 'credit_limit', 'payment_due_days',
            'grace_period_days', 'credit_notes',
        ]

    def validate_phone_number(self, value):
        client = self.context['client']
        if not value.startswith('+'):
            raise serializers.ValidationError(
                "Phone number must include country code (e.g., +254712345678)"
            )
        if len(value.replace(' ', '')) < 10:
            raise serializers.ValidationError("Phone number is too short.")
        if Customer.objects.filter(client=client, phone_number=value).exists():
            raise serializers.ValidationError(
                "A customer with this phone number already exists for your company."
            )
        return value

    def validate_email(self, value):
        if not value:
            raise serializers.ValidationError(
                "Email is required to send the customer their invite link."
            )
        return value

    def validate(self, attrs):
        credit_limit = attrs.get('credit_limit', Decimal('0.00'))
        billing_cycle = attrs.get('billing_cycle')
        if credit_limit and credit_limit > 0 and not billing_cycle:
            raise serializers.ValidationError(
                {'billing_cycle': 'billing_cycle is required when credit_limit is set.'}
            )
        return attrs

    def create(self, validated_data):
        billing_cycle = validated_data.pop('billing_cycle',    None)
        credit_limit = validated_data.pop('credit_limit',     Decimal('0.00'))
        payment_due_days = validated_data.pop('payment_due_days', 30)
        grace_period_days = validated_data.pop('grace_period_days', 7)
        credit_notes = validated_data.pop('credit_notes',     '')

        client = self.context['client']
        customer = Customer.objects.create(
            client=client, status='ACTIVE', is_registered=False,
            **validated_data,
        )

        invite = CustomerInvite.objects.create(
            customer=customer,
            expires_at=timezone.now() + timedelta(days=7),
        )
        self._invite = invite

        has_credit = (
            billing_cycle is not None
            and credit_limit is not None
            and credit_limit > Decimal('0.00')
        )

        if has_credit:
            from apps.customers.invoice_models import CreditTerms
            from apps.customers.models import CustomerPaymentProfile

            CreditTerms.objects.create(
                customer=customer,
                billing_cycle=billing_cycle,
                credit_limit=credit_limit,
                original_credit_limit=credit_limit,
                payment_due_days=payment_due_days,
                grace_period_days=grace_period_days,
                notes=credit_notes,
            )

            CustomerPaymentProfile.objects.update_or_create(
                customer=customer,
                defaults={
                    'credit_account_enabled': True,
                    'credit_limit':           credit_limit,
                    'preferred_method':       'CREDIT',
                    'setup_completed':        True,
                },
            )

        return customer


class CustomerAdminSerializer(serializers.ModelSerializer):
    customer_type_display = serializers.CharField(
        source='get_customer_type_display', read_only=True)
    status_display = serializers.CharField(
        source='get_status_display', read_only=True)
    invite_pending = serializers.SerializerMethodField()
    wallet_balance = serializers.SerializerMethodField()
    total_orders = serializers.SerializerMethodField()
    credit_terms = serializers.SerializerMethodField()

    # ── New fields for AccountantCustomersPage ────────────────────────────────
    payment_profile = serializers.SerializerMethodField()
    has_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id', 'phone_number', 'full_name', 'email',
            'customer_type', 'customer_type_display',
            'status', 'status_display',
            'is_phone_verified', 'is_registered', 'invite_pending',
            'wallet_balance', 'total_orders',
            'credit_terms',
            'payment_profile',
            'has_overdue',
            'last_order_date', 'last_login', 'created_at',
        ]
        read_only_fields = fields

    def get_invite_pending(self, obj):
        return not obj.is_registered

    def get_wallet_balance(self, obj):
        return str(obj.wallet.current_balance) if hasattr(obj, 'wallet') else '0.00'

    def get_total_orders(self, obj):
        return obj.orders.count() if hasattr(obj, 'orders') else 0

    def get_credit_terms(self, obj):
        try:
            t = obj.credit_terms
            return {
                'billing_cycle':          t.billing_cycle,
                'billing_cycle_display':  t.get_billing_cycle_display(),
                'credit_limit':           str(t.credit_limit),
                'original_credit_limit':  str(t.original_credit_limit),
                'outstanding_balance':    str(t.outstanding_balance),
                'available_credit':       str(t.available_credit),
                'payment_due_days':       t.payment_due_days,
                'grace_period_days':      t.grace_period_days,
                'account_frozen':         t.account_frozen,
                'is_in_grace_period':     t.is_in_grace_period,
                'grace_days_remaining':   t.grace_days_remaining,
                'grace_until':            t.grace_until,
                'notes':                  t.notes,
            }
        except Exception:
            return None

    def get_payment_profile(self, obj):
        """
        Returns payment profile data for the AccountantCustomersPage.
        Falls back to credit_terms data if payment_profile doesn't exist,
        so both credit tracking systems are covered.
        """
        # Try CustomerPaymentProfile first
        try:
            p = obj.payment_profile
            return {
                'credit_account_enabled': p.credit_account_enabled,
                'credit_limit':           float(p.credit_limit),
                'outstanding_balance':    float(p.outstanding_balance),
                'available_credit':       float(p.available_credit),
                'preferred_method':       p.preferred_method,
            }
        except Exception:
            pass

        # Fall back to CreditTerms if payment_profile not set
        try:
            t = obj.credit_terms
            return {
                'credit_account_enabled': True,
                'credit_limit':           float(t.credit_limit),
                'outstanding_balance':    float(t.outstanding_balance),
                'available_credit':       float(t.available_credit),
                'preferred_method':       'CREDIT',
            }
        except Exception:
            pass

        # No credit account
        return {
            'credit_account_enabled': False,
            'credit_limit':           0.0,
            'outstanding_balance':    0.0,
            'available_credit':       0.0,
            'preferred_method':       'CASH',
        }

    def get_has_overdue(self, obj):
        """
        True if the customer has OVERDUE invoices OR ISSUED invoices
        past their due_date. Used for the red OVERDUE badge in the UI.
        """
        today = timezone.now().date()
        return (
            obj.invoices.filter(status='OVERDUE').exists()
            or obj.invoices.filter(
                status='ISSUED',
                due_date__lt=today,
            ).exists()
        )


class CustomerAdminUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['full_name', 'email', 'customer_type', 'status']

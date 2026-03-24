"""
Customer Models — apps/customers/models.py
==========================================
CHANGES from previous version:
  + PaymentMethod enum
  + CustomerPaymentProfile model (one-to-one with Customer)

Run after updating:
    python manage.py makemigrations customers
    python manage.py migrate
"""

from django.db import models
from django.utils import timezone
import uuid
import secrets
from decimal import Decimal


class CustomerType(models.TextChoices):
    REFILL = 'REFILL',  'Refill Customer'
    ONETIME = 'ONETIME', 'One-time Purchase'
    HYBRID = 'HYBRID',  'Hybrid'


class CustomerStatus(models.TextChoices):
    ACTIVE = 'ACTIVE',    'Active'
    SUSPENDED = 'SUSPENDED', 'Suspended'
    BLOCKED = 'BLOCKED',   'Blocked'


class PaymentMethod(models.TextChoices):
    """Payment methods available to customers."""
    MPESA = 'MPESA',   'M-Pesa'
    CASH = 'CASH',    'Cash on Delivery'
    WALLET = 'WALLET',  'Wallet'
    CREDIT = 'CREDIT',  'Credit Account (Pay Later)'


class Customer(models.Model):
    """
    Represents an end customer who orders water bottles.
    Belongs to a specific distributor (client).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.CASCADE,
        related_name='customers',
    )

    phone_number = models.CharField(max_length=20, db_index=True)
    full_name = models.CharField(max_length=255)
    email = models.EmailField(null=True, blank=True)

    customer_type = models.CharField(
        max_length=10, choices=CustomerType.choices, default=CustomerType.REFILL,
    )
    status = models.CharField(
        max_length=10, choices=CustomerStatus.choices, default=CustomerStatus.ACTIVE,
    )

    is_phone_verified = models.BooleanField(default=False)
    phone_verified_at = models.DateTimeField(null=True, blank=True)
    is_registered = models.BooleanField(default=False)

    registration_date = models.DateTimeField(auto_now_add=True)
    last_order_date = models.DateTimeField(null=True, blank=True)
    last_login = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customers'
        ordering = ['-created_at']
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'
        indexes = [
            models.Index(fields=['phone_number']),
            models.Index(fields=['client', 'status']),
        ]
        unique_together = [['client', 'phone_number']]

    def __str__(self):
        return f"{self.full_name} ({self.phone_number})"

    @property
    def active_invite(self):
        return self.invites.filter(
            is_used=False, expires_at__gt=timezone.now()
        ).first()


# ─────────────────────────────────────────────────────────────────────────────
# NEW: Payment Profile
# ─────────────────────────────────────────────────────────────────────────────

class CustomerPaymentProfile(models.Model):
    """
    Stores a customer's preferred payment method and M-Pesa details.
    One-to-one with Customer.

    Customer-editable:  mpesa_number, preferred_method, setup_completed
    Distributor-only:   credit_account_enabled, credit_limit
    System-managed:     outstanding_balance
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    customer = models.OneToOneField(
        Customer,
        on_delete=models.CASCADE,
        related_name='payment_profile',
    )

    mpesa_number = models.CharField(
        max_length=20, blank=True,
        help_text="M-Pesa phone (may differ from login phone)",
    )

    preferred_method = models.CharField(
        max_length=10,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH,
    )

    # ── Credit — distributor-controlled ───────────────────────────────────────
    credit_account_enabled = models.BooleanField(
        default=False,
        help_text="Distributor sets this — allows pay-later orders",
    )
    credit_limit = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        help_text="Max outstanding credit (KES)",
    )
    outstanding_balance = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        help_text="Current unpaid credit (KES)",
    )

    # ── First-time setup flag ─────────────────────────────────────────────────
    setup_completed = models.BooleanField(
        default=False,
        help_text="True once the customer completes the payment setup step",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customer_payment_profiles'
        verbose_name = 'Customer Payment Profile'

    def __str__(self):
        return f"Payment profile — {self.customer.full_name}"

    @property
    def available_credit(self) -> Decimal:
        return max(Decimal('0.00'), self.credit_limit - self.outstanding_balance)

    def can_use_credit(self, amount: Decimal) -> bool:
        return self.credit_account_enabled and self.available_credit >= amount


# ─────────────────────────────────────────────────────────────────────────────
# Unchanged models below
# ─────────────────────────────────────────────────────────────────────────────

class CustomerInvite(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name='invites')
    token = models.CharField(max_length=64, unique=True,
                             db_index=True, default=secrets.token_urlsafe)
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customer_invites'
        ordering = ['-created_at']

    def __str__(self):
        return f"Invite for {self.customer.full_name} ({'used' if self.is_used else 'pending'})"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    def mark_used(self):
        self.is_used = True
        self.used_at = timezone.now()
        self.save(update_fields=['is_used', 'used_at'])


class CustomerAddress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name='addresses')
    label = models.CharField(max_length=50)
    address = models.TextField()
    latitude = models.DecimalField(
        max_digits=10, decimal_places=8, null=True, blank=True)
    longitude = models.DecimalField(
        max_digits=11, decimal_places=8, null=True, blank=True)
    is_default = models.BooleanField(default=False)
    delivery_instructions = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customer_addresses'
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f"{self.customer.full_name} — {self.label}"

    def get_full_address(self):
        return self.address

    def save(self, *args, **kwargs):
        if self.is_default:
            CustomerAddress.objects.filter(
                customer=self.customer, is_default=True
            ).exclude(id=self.id).update(is_default=False)
        super().save(*args, **kwargs)


class CustomerPreferences(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.OneToOneField(
        Customer, on_delete=models.CASCADE, related_name='preferences')
    preferred_delivery_time = models.CharField(
        max_length=50, default='10:00 AM - 12:00 PM')
    delivery_instructions = models.TextField(blank=True)
    sms_notifications = models.BooleanField(default=True)
    email_notifications = models.BooleanField(default=True)
    push_notifications = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customer_preferences'

    def __str__(self):
        return f"Preferences — {self.customer.full_name}"


class CustomerOTP(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone_number = models.CharField(max_length=20, db_index=True)
    otp_code = models.CharField(max_length=6)
    is_verified = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customer_otps'
        ordering = ['-created_at']

    def __str__(self):
        return f"OTP for {self.phone_number}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

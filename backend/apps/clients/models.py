"""
Client (Distributor) Models
Manages water distribution companies in the multi-tenant system
"""

from django.db import models
import uuid


class SubscriptionPlan(models.TextChoices):
    """Available subscription plans"""
    TRIAL = 'trial', 'Trial'
    BASIC = 'basic', 'Basic'
    PRO = 'pro', 'Pro'
    ENTERPRISE = 'enterprise', 'Enterprise'


class SubscriptionStatus(models.TextChoices):
    """Subscription status"""
    ACTIVE = 'active', 'Active'
    INACTIVE = 'inactive', 'Inactive'
    TRIAL = 'trial', 'Trial'
    CANCELLED = 'cancelled', 'Cancelled'
    EXPIRED = 'expired', 'Expired'


class Client(models.Model):
    """
    Client Model - Represents a water distribution company
    Each client is a separate distributor in the multi-tenant system
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Company Information
    name = models.CharField(
        max_length=255,
        help_text="Company name"
    )
    email = models.EmailField(
        unique=True,
        help_text="Company email"
    )
    phone = models.CharField(
        max_length=20,
        help_text="Company phone number"
    )

    # Address
    address = models.TextField(help_text="Street address")
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100, default='Kenya')

    # Branding
    logo = models.ImageField(
        upload_to='logos/',
        null=True,
        blank=True,
        help_text="Company logo"
    )
    website = models.URLField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Company website"
    )

    # Subscription
    subscription_plan = models.CharField(
        max_length=20,
        choices=SubscriptionPlan.choices,
        default=SubscriptionPlan.TRIAL
    )
    subscription_status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.TRIAL
    )
    subscription_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When subscription expires"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'clients'
        ordering = ['-created_at']
        verbose_name = 'Client'
        verbose_name_plural = 'Clients'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['subscription_status']),
        ]

    def __str__(self):
        return self.name

    @property
    def is_active(self):
        """Check if client subscription is active"""
        return self.subscription_status == SubscriptionStatus.ACTIVE

    @property
    def company_name(self):
        """Explicit alias for name — clearer when accessed from related models"""
        return self.name

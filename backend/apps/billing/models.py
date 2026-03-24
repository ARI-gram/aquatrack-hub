"""
Billing Models
apps/billing/models.py

Tracks subscriptions, billing cycles, invoices and payment history
for each client distributor.
"""

import uuid
from django.db import models
from django.utils import timezone


class BillingCycle(models.TextChoices):
    MONTHLY = 'monthly', 'Monthly'
    BIANNUAL = 'biannual', '6-Month'
    ANNUAL = 'annual', 'Annual'


class InvoiceStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    PAID = 'paid', 'Paid'
    OVERDUE = 'overdue', 'Overdue'
    CANCELLED = 'cancelled', 'Cancelled'


class PaymentMethod(models.TextChoices):
    MPESA = 'mpesa', 'M-Pesa'
    BANK = 'bank', 'Bank Transfer'
    CASH = 'cash', 'Cash'


# ─── Subscription ─────────────────────────────────────────────────────────────

class Subscription(models.Model):
    """
    Tracks the active billing subscription for each client.

    Pricing (KES):
      Monthly   → KSh 15,000 / month
      6-Month   → KSh 76,500  (15% off — KSh 12,750/mo)
      Annual    → KSh 126,000 (30% off — KSh 10,500/mo)
      Onboarding one-time fee → KSh 20,000
    """

    MONTHLY_PRICE = 15_000
    BIANNUAL_PRICE = 76_500
    ANNUAL_PRICE = 126_000
    ONBOARDING_FEE = 20_000

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    client = models.OneToOneField(
        'clients.Client',
        on_delete=models.CASCADE,
        related_name='subscription',
    )

    billing_cycle = models.CharField(
        max_length=20,
        choices=BillingCycle.choices,
        default=BillingCycle.MONTHLY,
    )

    # Whether the one-time onboarding fee (KSh 20,000) has been paid
    onboarding_paid = models.BooleanField(
        default=False,
        help_text="Has the one-time KSh 20,000 onboarding fee been collected?"
    )

    # Current period
    current_period_start = models.DateTimeField(default=timezone.now)
    current_period_end = models.DateTimeField(null=True, blank=True)

    # Warning sent flags (reset each cycle)
    warning_7_days_sent = models.BooleanField(default=False)
    warning_3_days_sent = models.BooleanField(default=False)
    warning_1_day_sent = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'subscriptions'
        ordering = ['-created_at']
        verbose_name = 'Subscription'
        verbose_name_plural = 'Subscriptions'

    def __str__(self):
        return f"{self.client.name} — {self.get_billing_cycle_display()}"

    @property
    def amount(self):
        """Return the total amount due for the current billing cycle (KES)."""
        return {
            BillingCycle.MONTHLY: self.MONTHLY_PRICE,
            BillingCycle.BIANNUAL: self.BIANNUAL_PRICE,
            BillingCycle.ANNUAL: self.ANNUAL_PRICE,
        }.get(self.billing_cycle, self.MONTHLY_PRICE)

    @property
    def monthly_equivalent(self):
        """Effective monthly cost for display purposes."""
        return {
            BillingCycle.MONTHLY: self.MONTHLY_PRICE,
            BillingCycle.BIANNUAL: round(self.BIANNUAL_PRICE / 6),
            BillingCycle.ANNUAL: round(self.ANNUAL_PRICE / 12),
        }.get(self.billing_cycle, self.MONTHLY_PRICE)

    @property
    def days_until_due(self):
        if not self.current_period_end:
            return 9999
        return (self.current_period_end.date() - timezone.now().date()).days

    @property
    def is_overdue(self):
        return self.days_until_due < 0


# ─── Invoice ──────────────────────────────────────────────────────────────────

class Invoice(models.Model):
    """
    Represents a billing invoice issued to a client.
    Generated automatically at the start of each billing cycle.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.CASCADE,
        related_name='billing_invoices',
    )

    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoices',
    )

    invoice_number = models.CharField(
        max_length=50,
        unique=True,
        help_text="e.g. INV-2026-001"
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Amount in KES"
    )

    description = models.TextField(
        help_text="What this invoice is for"
    )

    status = models.CharField(
        max_length=20,
        choices=InvoiceStatus.choices,
        default=InvoiceStatus.PENDING,
    )

    due_date = models.DateField()

    paid_at = models.DateTimeField(null=True, blank=True)

    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        null=True,
        blank=True,
    )

    payment_reference = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="M-Pesa transaction ID or bank ref"
    )

    # Period this invoice covers
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)

    # Is this the one-time onboarding invoice?
    is_onboarding = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'billing_invoices'
        ordering = ['-created_at']
        verbose_name = 'Invoice'
        verbose_name_plural = 'Invoices'

    def __str__(self):
        return f"{self.invoice_number} — {self.client.name} (KSh {self.amount:,.0f})"

    @property
    def is_overdue(self):
        return (
            self.status == InvoiceStatus.PENDING
            and self.due_date < timezone.now().date()
        )

    def mark_paid(self, method, reference=None):
        """Mark invoice as paid."""
        self.status = InvoiceStatus.PAID
        self.paid_at = timezone.now()
        self.payment_method = method
        self.payment_reference = reference
        self.save(update_fields=[
            'status', 'paid_at', 'payment_method', 'payment_reference', 'updated_at'
        ])

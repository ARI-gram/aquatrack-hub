"""
Customer Invoice Models
apps/customers/invoice_models.py

Credit lifecycle:
  active    → orders allowed up to credit_limit
  overdue   → invoice past due_date → grace period starts (default 7 days)
  frozen    → grace expired unpaid → no new orders
  paid      → auto-unfreezes, credit_limit resets to original_credit_limit (fresh start)

Grace extension:
  Customer requests via POST /api/customer/credit/grace-request/
  client_admin approves/denies → super_admin notified

Migration:
    python manage.py makemigrations customers
    python manage.py migrate
"""

import uuid
from decimal import Decimal
from datetime import timedelta
from django.db import models
from django.utils import timezone


class CustomerBillingCycle(models.TextChoices):
    IMMEDIATE = 'IMMEDIATE', 'Per Order (Immediate)'
    WEEKLY = 'WEEKLY',    'Weekly'
    BIWEEKLY = 'BIWEEKLY',  'Bi-Weekly (1st & 15th)'
    MONTHLY = 'MONTHLY',   'Monthly'


class CustomerInvoiceStatus(models.TextChoices):
    DRAFT = 'DRAFT',     'Draft'
    ISSUED = 'ISSUED',    'Issued'
    PAID = 'PAID',      'Paid'
    OVERDUE = 'OVERDUE',   'Overdue'
    CANCELLED = 'CANCELLED', 'Cancelled'


class CustomerInvoicePaymentMethod(models.TextChoices):
    CHEQUE = 'CHEQUE',        'Cheque'
    BANK_TRANSFER = 'BANK_TRANSFER', 'Bank Transfer'
    CASH = 'CASH',          'Cash'
    MPESA = 'MPESA',         'M-Pesa'


class GraceRequestStatus(models.TextChoices):
    PENDING = 'PENDING',  'Pending Review'
    APPROVED = 'APPROVED', 'Approved'
    DENIED = 'DENIED',   'Denied'


# ─────────────────────────────────────────────────────────────────────────────

class CreditTerms(models.Model):
    """
    Per-customer credit config + account lifecycle state.

    Admin-configured:
        billing_cycle, credit_limit, payment_due_days, grace_period_days, notes

    System-managed (do not edit directly):
        account_frozen, frozen_at, overdue_since, grace_until, original_credit_limit
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    customer = models.OneToOneField(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='credit_terms',
    )

    # ── Admin-configured ──────────────────────────────────────────────────────
    billing_cycle = models.CharField(
        max_length=20,
        choices=CustomerBillingCycle.choices,
        default=CustomerBillingCycle.MONTHLY,
    )

    credit_limit = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=Decimal('0.00'),
        help_text="Active limit (KES). Resets to original_credit_limit after payment.",
    )

    original_credit_limit = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=Decimal('0.00'),
        help_text="Agreed limit preserved for reset after payment.",
    )

    payment_due_days = models.PositiveIntegerField(
        default=30,
        help_text="Days after invoice issue before overdue",
    )

    grace_period_days = models.PositiveIntegerField(
        default=7,
        help_text="Default grace window (days) after due date before account freezes",
    )

    notes = models.TextField(blank=True)

    # ── System-managed lifecycle ──────────────────────────────────────────────
    account_frozen = models.BooleanField(
        default=False,
        help_text="True = account frozen, no new orders allowed",
    )

    frozen_at = models.DateTimeField(null=True, blank=True)

    overdue_since = models.DateField(
        null=True, blank=True,
        help_text="Date the first unpaid invoice went overdue (grace clock start)",
    )

    grace_until = models.DateField(
        null=True, blank=True,
        help_text="Grace deadline — account freezes if unpaid after this date",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customer_credit_terms'
        verbose_name = 'Customer Credit Terms'

    def __str__(self):
        state = 'FROZEN' if self.account_frozen else (
            'grace' if self.is_in_grace_period else 'active')
        return f"Credit — {self.customer.full_name} ({self.get_billing_cycle_display()}) [{state}]"

    # ── Read-only computed ────────────────────────────────────────────────────

    @property
    def outstanding_balance(self) -> Decimal:
        return (
            self.customer.customer_invoices
            .filter(status__in=[CustomerInvoiceStatus.ISSUED, CustomerInvoiceStatus.OVERDUE])
            .aggregate(total=models.Sum('total_amount'))['total']
            or Decimal('0.00')
        )

    @property
    def available_credit(self) -> Decimal:
        return max(Decimal('0.00'), self.credit_limit - self.outstanding_balance)

    @property
    def is_in_grace_period(self) -> bool:
        if not self.overdue_since or self.account_frozen:
            return False
        return self.grace_until is not None and timezone.now().date() <= self.grace_until

    @property
    def grace_days_remaining(self) -> int | None:
        if not self.grace_until:
            return None
        return max(0, (self.grace_until - timezone.now().date()).days)

    # ── Order eligibility ─────────────────────────────────────────────────────

    def can_place_order(self, order_amount: Decimal) -> tuple[bool, str]:
        """
        Central check — called before every credit order.
        Returns (allowed: bool, reason: str).
        """
        if self.account_frozen:
            return False, (
                "Your credit account is frozen due to an overdue invoice. "
                "Please contact your distributor to resolve the outstanding balance."
            )
        if self.credit_limit <= Decimal('0.00'):
            return False, "No credit limit configured."
        if self.available_credit < order_amount:
            return False, (
                f"Order amount KES {order_amount:,.2f} exceeds your "
                f"available credit of KES {self.available_credit:,.2f}."
            )
        return True, "OK"

    # ── Lifecycle transitions (all idempotent) ────────────────────────────────

    def start_grace_period(self) -> None:
        """Start grace clock when an invoice goes overdue. Idempotent."""
        if self.overdue_since:
            return
        today = timezone.now().date()
        self.overdue_since = today
        self.grace_until = today + timedelta(days=self.grace_period_days)
        self.save(update_fields=['overdue_since', 'grace_until', 'updated_at'])

    def extend_grace_period(self, extra_days: int) -> None:
        base = max(
            timezone.now().date(),
            self.grace_until or timezone.now().date(),
        )
        self.grace_until = base + timedelta(days=extra_days)
        was_frozen = self.account_frozen
        if self.account_frozen:
            self.account_frozen = False
            self.frozen_at = None
        self.save(update_fields=['grace_until',
                  'account_frozen', 'frozen_at', 'updated_at'])

        # ── Notify customer if their account was unfrozen by this extension ─
        if was_frozen:
            try:
                from apps.notifications import notify
                notify.account_unfrozen(self.customer)
            except Exception:
                pass  # non-fatal

    def freeze_account(self) -> None:
        if self.account_frozen:
            return
        self.account_frozen = True
        self.frozen_at = timezone.now()
        self.save(update_fields=['account_frozen', 'frozen_at', 'updated_at'])

        # ── Notify customer their account has been frozen ──────────────────
        try:
            from apps.notifications import notify
            notify.account_frozen(self.customer)
        except Exception:
            pass  # non-fatal

    def unfreeze_on_payment(self) -> None:
        self.account_frozen = False
        self.frozen_at = None
        self.overdue_since = None
        self.grace_until = None
        self.credit_limit = self.original_credit_limit
        self.save(update_fields=[
            'account_frozen', 'frozen_at', 'overdue_since',
            'grace_until', 'credit_limit', 'updated_at',
        ])

        # ── Notify customer their account is clear and active again ────────
        try:
            from apps.notifications import notify
            notify.account_unfrozen(self.customer)
        except Exception:
            pass  # non-fatal


# ─────────────────────────────────────────────────────────────────────────────

class GracePeriodRequest(models.Model):
    """
    Customer requests extra time to pay before account freezes.

    Flow:
      1. Customer submits reason + requested_days
      2. client_admin reviews (approve / deny)
      3. On approval → credit_terms.extend_grace_period(days_granted)
      4. Notification sent to customer + super_admin either way
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    credit_terms = models.ForeignKey(
        CreditTerms,
        on_delete=models.CASCADE,
        related_name='grace_requests',
    )

    requested_days = models.PositiveIntegerField(
        help_text="Extra days requested by the customer",
    )

    reason = models.TextField(
        help_text="Customer's explanation for needing more time",
    )

    status = models.CharField(
        max_length=10,
        choices=GraceRequestStatus.choices,
        default=GraceRequestStatus.PENDING,
    )

    reviewed_by = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='grace_request_reviews',
    )

    reviewed_at = models.DateTimeField(null=True, blank=True)

    admin_note = models.TextField(
        blank=True,
        help_text="Admin's note shown to the customer after decision",
    )

    days_granted = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Actual days granted (admin may adjust from requested)",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'grace_period_requests'
        ordering = ['-created_at']
        verbose_name = 'Grace Period Request'

    def __str__(self):
        return (
            f"Grace request — {self.credit_terms.customer.full_name} "
            f"({self.requested_days}d → {self.status})"
        )


# ─────────────────────────────────────────────────────────────────────────────

class CustomerInvoice(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='customer_invoices',
    )

    invoice_number = models.CharField(max_length=60, unique=True)

    status = models.CharField(
        max_length=20,
        choices=CustomerInvoiceStatus.choices,
        default=CustomerInvoiceStatus.DRAFT,
    )

    billing_cycle = models.CharField(
        max_length=20, choices=CustomerBillingCycle.choices)

    period_start = models.DateField()
    period_end = models.DateField()

    subtotal = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'))
    delivery_fees = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'))

    due_date = models.DateField()

    paid_at = models.DateTimeField(null=True, blank=True)
    payment_method = models.CharField(
        max_length=20, choices=CustomerInvoicePaymentMethod.choices,
        null=True, blank=True,
    )
    payment_reference = models.CharField(max_length=100, blank=True)

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customer_invoices'
        ordering = ['-created_at']
        verbose_name = 'Customer Invoice'
        indexes = [
            models.Index(fields=['customer', '-created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['due_date']),
        ]

    def __str__(self):
        return f"{self.invoice_number} — {self.customer.full_name} KES {self.total_amount}"

    @property
    def is_overdue(self) -> bool:
        return (
            self.status == CustomerInvoiceStatus.ISSUED
            and self.due_date < timezone.now().date()
        )

    def recalculate_totals(self) -> None:
        items = self.items.all()
        self.subtotal = sum(i.subtotal for i in items)
        self.delivery_fees = sum(i.delivery_fee for i in items)
        self.total_amount = self.subtotal + self.delivery_fees
        self.save(update_fields=[
                  'subtotal', 'delivery_fees', 'total_amount', 'updated_at'])

    def mark_issued(self) -> None:
        self.status = CustomerInvoiceStatus.ISSUED
        self.save(update_fields=['status', 'updated_at'])

    def mark_overdue(self) -> None:
        """
        Mark invoice overdue AND start grace period clock on CreditTerms.
        Idempotent — safe to call multiple times.
        """
        if self.status == CustomerInvoiceStatus.ISSUED:
            self.status = CustomerInvoiceStatus.OVERDUE
            self.save(update_fields=['status', 'updated_at'])
        try:
            self.customer.credit_terms.start_grace_period()
        except CreditTerms.DoesNotExist:
            pass

    def mark_paid(self, payment_method: str, payment_reference: str = '') -> None:
        """
        Mark paid. If no more outstanding invoices exist, auto-unfreeze
        and reset the credit account to a clean slate.
        """
        self.status = CustomerInvoiceStatus.PAID
        self.paid_at = timezone.now()
        self.payment_method = payment_method
        self.payment_reference = payment_reference
        self.save(update_fields=[
            'status', 'paid_at', 'payment_method', 'payment_reference', 'updated_at',
        ])

        # Auto-unfreeze if no more outstanding invoices remain
        try:
            terms = self.customer.credit_terms
            still_unpaid = self.customer.customer_invoices.filter(
                status__in=[CustomerInvoiceStatus.ISSUED,
                            CustomerInvoiceStatus.OVERDUE]
            ).exists()
            if not still_unpaid:
                terms.unfreeze_on_payment()
        except CreditTerms.DoesNotExist:
            pass


# ─────────────────────────────────────────────────────────────────────────────

class CustomerInvoiceItem(models.Model):
    """
    Links one Order to a CustomerInvoice (amount snapshot).
    OneToOneField prevents double-invoicing at DB level.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    invoice = models.ForeignKey(
        CustomerInvoice,
        on_delete=models.CASCADE,
        related_name='items',
    )

    order = models.OneToOneField(
        'orders.Order',
        on_delete=models.PROTECT,
        related_name='invoice_item',
        null=True, blank=True,
    )

    order_number = models.CharField(max_length=50)
    order_date = models.DateField()
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    delivery_fee = models.DecimalField(max_digits=8,  decimal_places=2)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'customer_invoice_items'
        verbose_name = 'Customer Invoice Item'

    def __str__(self):
        return f"{self.invoice.invoice_number} ← {self.order_number}"

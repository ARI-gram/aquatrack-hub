"""
Wallet Management Models for AquaTrack
======================================

This module handles customer wallet and payment transactions.

Key Features:
- Customer wallet balance management
- Top-up functionality
- Payment processing
- Transaction history
- Auto top-up settings
- Wallet limits and controls

Models:
- Wallet: Customer's wallet account
- WalletTransaction: All wallet movements (top-ups, payments, refunds)
"""

from django.dispatch import receiver
from django.db.models.signals import post_save
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from django.utils import timezone


class Wallet(models.Model):
    """
    Customer's digital wallet for payments.

    Wallet Flow:
    1. Customer tops up wallet with cash/card/M-Pesa
    2. Wallet balance increases
    3. Customer places order → wallet balance decreases
    4. Transaction history maintained

    Features:
    - Auto top-up when balance goes below threshold
    - Daily/monthly spending limits
    - Low balance notifications
    """

    # Link to customer (one wallet per customer)
    customer = models.OneToOneField(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='wallet',
        help_text="Customer who owns this wallet"
    )

    # Balance tracking
    current_balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Current wallet balance"
    )

    total_topped_up = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total amount ever topped up (lifetime)"
    )

    total_spent = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total amount ever spent (lifetime)"
    )

    # Limits and controls
    daily_limit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Maximum spending per day (optional)"
    )

    monthly_limit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Maximum spending per month (optional)"
    )

    # Auto top-up settings
    auto_topup_enabled = models.BooleanField(
        default=False,
        help_text="Enable automatic top-up when balance is low"
    )

    auto_topup_threshold = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('100.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Trigger auto top-up when balance falls below this amount"
    )

    auto_topup_amount = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('500.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Amount to add during auto top-up"
    )

    # Notification settings
    low_balance_alert_enabled = models.BooleanField(
        default=True,
        help_text="Send notification when balance is low"
    )

    low_balance_threshold = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('50.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Send alert when balance falls below this amount"
    )

    # Status
    is_active = models.BooleanField(
        default=True,
        help_text="Whether wallet is active and can be used"
    )

    is_locked = models.BooleanField(
        default=False,
        help_text="Wallet locked (e.g., due to suspicious activity)"
    )

    locked_reason = models.TextField(
        blank=True,
        help_text="Reason for locking the wallet"
    )

    locked_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When wallet was locked"
    )

    # Metadata
    last_transaction_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When last transaction occurred"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallets'
        verbose_name = 'Wallet'
        verbose_name_plural = 'Wallets'
        indexes = [
            models.Index(fields=['customer']),
            models.Index(fields=['is_active']),
            models.Index(fields=['current_balance']),
        ]

    def __str__(self):
        return f"{self.customer.phone} - Balance: KES {self.current_balance}"

    def can_spend(self, amount):
        """
        Check if wallet has sufficient balance and spending limits allow the transaction.

        Args:
            amount: Decimal amount to spend

        Returns:
            tuple: (can_spend: bool, reason: str)
        """
        # Check if wallet is active
        if not self.is_active:
            return False, "Wallet is not active"

        # Check if wallet is locked
        if self.is_locked:
            return False, "Wallet is locked"

        # Check balance
        if self.current_balance < amount:
            return False, f"Insufficient balance. Current: KES {self.current_balance}, Required: KES {amount}"

        # Check daily limit
        if self.daily_limit:
            today_spending = self.get_today_spending()
            if (today_spending + amount) > self.daily_limit:
                return False, f"Daily spending limit exceeded. Limit: KES {self.daily_limit}"

        # Check monthly limit
        if self.monthly_limit:
            month_spending = self.get_month_spending()
            if (month_spending + amount) > self.monthly_limit:
                return False, f"Monthly spending limit exceeded. Limit: KES {self.monthly_limit}"

        return True, "OK"

    def get_today_spending(self):
        """Calculate total spending today."""
        today = timezone.now().date()
        transactions = self.transactions.filter(
            transaction_type='PAYMENT',
            created_at__date=today
        )
        return sum(t.amount for t in transactions)

    def get_month_spending(self):
        """Calculate total spending this month."""
        now = timezone.now()
        transactions = self.transactions.filter(
            transaction_type='PAYMENT',
            created_at__year=now.year,
            created_at__month=now.month
        )
        return sum(t.amount for t in transactions)

    def needs_low_balance_alert(self):
        """Check if low balance alert should be sent."""
        if not self.low_balance_alert_enabled:
            return False
        return self.current_balance < self.low_balance_threshold

    def needs_auto_topup(self):
        """Check if auto top-up should be triggered."""
        if not self.auto_topup_enabled:
            return False
        return self.current_balance < self.auto_topup_threshold


class WalletTransaction(models.Model):
    """
    Records all wallet transactions.

    Transaction Types:
    - TOPUP: Customer adds money to wallet
    - PAYMENT: Money deducted for order
    - REFUND: Money returned to wallet (cancelled order)
    - ADJUSTMENT: Manual correction by admin
    - PENALTY: Deduction for damages/issues
    - BONUS: Promotional credit added

    Each transaction records:
    - Amount
    - Balance before and after
    - Related order (if applicable)
    - Payment method used
    """

    TRANSACTION_TYPES = [
        ('TOPUP', 'Top Up'),
        ('PAYMENT', 'Payment'),
        ('REFUND', 'Refund'),
        ('ADJUSTMENT', 'Manual Adjustment'),
        ('PENALTY', 'Penalty/Deduction'),
        ('BONUS', 'Bonus/Credit'),
    ]

    TRANSACTION_STATUS = [
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('REVERSED', 'Reversed'),
    ]

    PAYMENT_METHODS = [
        ('CASH', 'Cash'),
        ('CARD', 'Card Payment'),
        ('MPESA', 'M-Pesa'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('SYSTEM', 'System Generated'),
    ]

    # Core transaction info
    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.CASCADE,
        related_name='transactions',
        help_text="Wallet this transaction belongs to"
    )

    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPES,
        help_text="Type of transaction"
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Transaction amount (always positive)"
    )

    # Balance snapshots (before and after)
    balance_before = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Wallet balance before this transaction"
    )

    balance_after = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Wallet balance after this transaction"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=TRANSACTION_STATUS,
        default='PENDING',
        help_text="Transaction status"
    )

    # Payment details (for top-ups)
    payment_method = models.CharField(
        max_length=30,
        choices=PAYMENT_METHODS,
        null=True,
        blank=True,
        help_text="Payment method used"
    )

    payment_reference = models.CharField(
        max_length=100,
        blank=True,
        help_text="External payment reference (e.g., M-Pesa transaction ID)"
    )

    # Related records
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='wallet_transactions',
        help_text="Order this payment is for (if applicable)"
    )

    # Description and notes
    description = models.CharField(
        max_length=200,
        help_text="Brief description of transaction"
    )

    notes = models.TextField(
        blank=True,
        help_text="Additional notes"
    )

    # Who initiated
    initiated_by = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='wallet_transactions_initiated',
        help_text="User who initiated this transaction (for manual transactions)"
    )

    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When transaction was created"
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When transaction was completed"
    )

    class Meta:
        db_table = 'wallet_transactions'
        verbose_name = 'Wallet Transaction'
        verbose_name_plural = 'Wallet Transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['wallet', '-created_at']),
            models.Index(fields=['transaction_type']),
            models.Index(fields=['status']),
            models.Index(fields=['order']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"{self.wallet.customer.phone} - {self.transaction_type} - KES {self.amount}"

    def is_credit(self):
        """Check if this transaction adds money to wallet."""
        return self.transaction_type in ['TOPUP', 'REFUND', 'BONUS']

    def is_debit(self):
        """Check if this transaction removes money from wallet."""
        return self.transaction_type in ['PAYMENT', 'PENALTY', 'ADJUSTMENT']

    def get_signed_amount(self):
        """
        Get amount with sign based on transaction type.
        Positive for credits, negative for debits.
        """
        if self.is_credit():
            return self.amount
        else:
            return -self.amount


# Signal to automatically create Wallet when Customer is created


@receiver(post_save, sender='customers.Customer')
def create_wallet(sender, instance, created, **kwargs):
    """
    Automatically create a Wallet when a new Customer is created.
    This ensures every customer has a wallet for payments.
    """
    if created:
        Wallet.objects.create(
            customer=instance,
            current_balance=Decimal('0.00')
        )


# Signal to update wallet balance when transaction is completed
@receiver(post_save, sender=WalletTransaction)
def update_wallet_balance(sender, instance, created, **kwargs):
    """
    Update wallet balance when a transaction is completed.
    Only updates when status changes to COMPLETED.
    """
    if instance.status == 'COMPLETED' and not created:
        # Transaction completed - balance already updated in balance_after
        instance.wallet.current_balance = instance.balance_after
        instance.wallet.last_transaction_date = timezone.now()

        # Update lifetime totals
        if instance.is_credit():
            if instance.transaction_type == 'TOPUP':
                instance.wallet.total_topped_up += instance.amount
        elif instance.is_debit():
            if instance.transaction_type == 'PAYMENT':
                instance.wallet.total_spent += instance.amount

        instance.wallet.save(update_fields=[
                             'current_balance', 'last_transaction_date', 'total_topped_up', 'total_spent'])

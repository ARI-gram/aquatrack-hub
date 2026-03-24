"""
Bottle Management Models for AquaTrack
======================================

This module handles bottle inventory tracking and transactions.

Key Features:
- Track customer bottle ownership (total, full, empty, in-transit)
- Record all bottle movements (purchases, deliveries, returns)
- Maintain deposit tracking
- Audit trail for all bottle transactions

Models:
- BottleInventory: Current bottle status for each customer
- BottleTransaction: History of all bottle movements
"""

from django.dispatch import receiver
from django.db.models.signals import post_save
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class BottleInventory(models.Model):
    """
    Tracks current bottle inventory for each customer.

    This is the "current state" - shows what bottles the customer owns right now.
    Updated whenever bottles are bought, delivered, or returned.

    Example:
    - Customer buys 5 bottles → total_owned = 5, empty_bottles = 5
    - Customer orders refill → in_transit = 5
    - Delivery happens → full_bottles = 5, empty_bottles = 0, in_transit = 0
    """

    # Link to customer (one inventory per customer)
    customer = models.OneToOneField(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='bottle_inventory',
        help_text="The customer who owns these bottles"
    )

    # Bottle counts
    total_owned = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Total number of bottles customer owns (purchased with deposit)"
    )

    full_bottles = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Number of full bottles at customer location"
    )

    empty_bottles = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Number of empty bottles at customer location"
    )

    in_transit = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Bottles currently being delivered or collected"
    )

    # Financial tracking
    total_deposit_paid = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Total deposit amount paid by customer for bottles"
    )

    deposit_per_bottle = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Standard deposit amount per bottle for this customer's client"
    )

    # Metadata
    last_transaction_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the last bottle transaction occurred"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bottle_inventory'
        verbose_name = 'Bottle Inventory'
        verbose_name_plural = 'Bottle Inventories'
        indexes = [
            models.Index(fields=['customer']),
            models.Index(fields=['last_transaction_date']),
        ]

    def __str__(self):
        return f"{self.customer.phone} - {self.total_owned} bottles (Full: {self.full_bottles}, Empty: {self.empty_bottles})"

    def get_available_for_refill(self):
        """Returns number of empty bottles available for refill."""
        return self.empty_bottles

    def has_bottles_to_exchange(self):
        """Check if customer has empty bottles to exchange."""
        return self.empty_bottles > 0

    def calculate_total_value(self):
        """Calculate total deposit value of owned bottles."""
        return self.total_owned * self.deposit_per_bottle


class BottleTransaction(models.Model):
    """
    Records every bottle movement in the system.

    This is the "history" - a complete audit trail of all bottle operations.
    Never deleted, only created to maintain complete transaction history.

    Transaction Types:
    - PURCHASE: Customer buys new bottles (with deposit)
    - DELIVERY: Full bottles delivered to customer
    - COLLECTION: Empty bottles collected from customer
    - RETURN: Customer returns bottles for refund
    - DAMAGE: Bottles marked as damaged/lost
    - ADJUSTMENT: Manual correction by admin
    """

    TRANSACTION_TYPES = [
        ('PURCHASE', 'Bottle Purchase'),
        ('DELIVERY', 'Bottle Delivery'),
        ('COLLECTION', 'Bottle Collection'),
        ('RETURN', 'Bottle Return'),
        ('DAMAGE', 'Bottle Damage/Loss'),
        ('ADJUSTMENT', 'Manual Adjustment'),
    ]

    # Core transaction info
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='bottle_transactions',
        help_text="Customer involved in this transaction"
    )

    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPES,
        help_text="Type of bottle transaction"
    )

    quantity = models.IntegerField(
        validators=[MinValueValidator(1)],
        help_text="Number of bottles in this transaction"
    )

    # Link to related order (if applicable)
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bottle_transactions',
        help_text="Order associated with this transaction (if any)"
    )

    # Balances after this transaction (snapshot)
    balance_total_owned = models.IntegerField(
        default=0,
        help_text="Total owned bottles after this transaction"
    )

    balance_full = models.IntegerField(
        default=0,
        help_text="Full bottles after this transaction"
    )

    balance_empty = models.IntegerField(
        default=0,
        help_text="Empty bottles after this transaction"
    )

    balance_in_transit = models.IntegerField(
        default=0,
        help_text="In-transit bottles after this transaction"
    )

    # Financial info
    deposit_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Deposit amount involved in this transaction"
    )

    # Tracking
    notes = models.TextField(
        blank=True,
        help_text="Additional notes about this transaction"
    )

    created_by = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bottle_transactions_created',
        help_text="User who created this transaction"
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When this transaction was recorded"
    )

    class Meta:
        db_table = 'bottle_transactions'
        verbose_name = 'Bottle Transaction'
        verbose_name_plural = 'Bottle Transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer', '-created_at']),
            models.Index(fields=['transaction_type']),
            models.Index(fields=['order']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"{self.customer.phone} - {self.transaction_type} - {self.quantity} bottles"

    def is_deposit_transaction(self):
        """Check if this transaction involves deposit money."""
        return self.transaction_type in ['PURCHASE', 'RETURN']

    def get_deposit_change(self):
        """
        Calculate deposit change for this transaction.
        Positive = customer paid, Negative = customer refunded
        """
        if self.transaction_type == 'PURCHASE':
            return self.deposit_amount  # Customer paid deposit
        elif self.transaction_type == 'RETURN':
            return -self.deposit_amount  # Customer got refund
        return Decimal('0.00')


# Signal to automatically create BottleInventory when Customer is created


@receiver(post_save, sender='customers.Customer')
def create_bottle_inventory(sender, instance, created, **kwargs):
    """
    Automatically create a BottleInventory when a new Customer is created.
    This ensures every customer has a bottle inventory tracking record.
    """
    if created:
        # Get the deposit amount from the customer's client
        deposit_amount = Decimal('0.00')
        if hasattr(instance, 'client') and instance.client:
            # You can add a bottle_deposit_amount field to Client model later
            # For now, using a default value
            deposit_amount = Decimal('50.00')  # Default deposit per bottle

        BottleInventory.objects.create(
            customer=instance,
            deposit_per_bottle=deposit_amount
        )

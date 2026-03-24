"""
apps/invoices/models.py

Invoices are auto-generated for completed orders.
An invoice is a formal billing document sent to the customer.
"""

import uuid
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


class Invoice(models.Model):

    STATUS_CHOICES = [
        ('DRAFT',     'Draft'),
        ('ISSUED',    'Issued'),
        ('PAID',      'Paid'),
        ('OVERDUE',   'Overdue'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    invoice_number = models.CharField(
        max_length=50, unique=True,
        help_text='Auto-generated e.g. INV-2025-000001',
    )

    order = models.OneToOneField(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='invoice',
        help_text='The order this invoice covers',
    )

    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='invoices',
    )

    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.CASCADE,
        related_name='invoices',
    )

    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default='DRAFT')

    # Amounts — mirrored from the order at issuance time
    subtotal = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'))
    delivery_fee = models.DecimalField(
        max_digits=8,  decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(
        max_digits=8,  decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
    )

    # Payment
    amount_paid = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'))
    amount_due = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'))
    payment_method = models.CharField(max_length=20, blank=True)

    # Dates
    issued_at = models.DateTimeField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'invoices'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer', '-created_at']),
            models.Index(fields=['client',   '-created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'{self.invoice_number} — {self.customer} — KES {self.total_amount}'

    @property
    def is_paid(self):
        return self.status == 'PAID'

    @property
    def balance_due(self):
        return self.total_amount - self.amount_paid


class InvoiceItem(models.Model):
    """
    Line items on an invoice — mirrors the OrderItems at issuance time.
    Stored separately so invoice remains accurate even if order data changes.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='items')

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='invoice_items',
    )

    # Snapshots
    product_name = models.CharField(max_length=200)
    product_unit = models.CharField(max_length=10, blank=True)

    quantity = models.IntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=8, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'invoice_items'

    def __str__(self):
        return f'{self.invoice.invoice_number} — {self.product_name} × {self.quantity}'

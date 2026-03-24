"""
apps/products/models.py
"""

import uuid
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.conf import settings


class Product(models.Model):

    UNIT_CHOICES = [
        ('BOTTLES', 'Bottles'),
        ('LITRES',  'Litres'),
        ('DOZENS',  'Dozens'),
        ('PIECES',  'Pieces'),
        ('CRATES',  'Crates'),
        ('JERRICANS', 'Jerricans'),
        ('SACHETS', 'Sachets'),
        ('GALLONS', 'Gallons'),
        ('PACKS',   'Packs'),
        ('CARTONS', 'Cartons'),
    ]

    STATUS_CHOICES = [
        ('ACTIVE',   'Active'),
        ('INACTIVE', 'Inactive'),
        ('ARCHIVED', 'Archived'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.CASCADE,
        related_name='products',
    )

    name = models.CharField(max_length=200)
    unit = models.CharField(
        max_length=10, choices=UNIT_CHOICES, default='BOTTLES')

    # ── NEW: dozens configuration ─────────────────────────────────────────────
    dozen_size = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text=(
            'How many bottles or litres make one dozen for this product. '
            'Required when unit=DOZENS, null otherwise.'
        ),
    )
    # ─────────────────────────────────────────────────────────────────────────

    selling_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Price shown to customers (KES)',
    )
    buying_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Cost price — visible to business owner only (KES)',
    )
    delivery_fee = models.DecimalField(
        max_digits=8, decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Delivery charge for this product (KES). 0 = free delivery.',
    )

    image_url = models.URLField(blank=True)
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default='ACTIVE')
    is_available = models.BooleanField(default=True)
    is_returnable = models.BooleanField(
        default=False,
        help_text='True for returnable bottles (e.g. 18.9L dispensers). '
        'False for consumables.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products'
        ordering = ['name']
        indexes = [models.Index(fields=['client', 'status'])]

    def __str__(self):
        return f'{self.client.name} — {self.name} ({self.unit})'

    @property
    def is_active(self):
        return self.status == 'ACTIVE' and self.is_available

    @property
    def margin(self):
        return self.selling_price - self.buying_price

    @property
    def margin_pct(self):
        if self.selling_price == 0:
            return 0
        return round((self.margin / self.selling_price) * 100, 1)


class StockEntry(models.Model):
    """Records every time a single unit is received into the main warehouse."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='stock_entries')
    serial_number = models.CharField(max_length=100)
    quantity = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text='Always 1 — each entry represents one physical unit.',
    )
    batch_ref = models.CharField(max_length=50)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='stock_entries_received',
    )
    received_at = models.DateTimeField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stock_entries'
        ordering = ['-received_at']
        indexes = [
            models.Index(fields=['product', 'received_at']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['batch_ref']),
        ]

    def __str__(self):
        return (
            f'{self.product.name} [{self.serial_number}]'
            f' @ {self.received_at:%Y-%m-%d %H:%M}'
        )


class StockDistribution(models.Model):
    """Records stock moved from the main warehouse onto a delivery van."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='distributions',
    )
    vehicle_number = models.CharField(
        max_length=20,
        help_text='Number plate of the van receiving the stock',
        db_index=True,
    )
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='stock_distributions_received',
        limit_choices_to={'role': 'driver'},
    )
    quantity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
    )
    distributed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='stock_distributions_made',
    )
    distributed_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'stock_distributions'
        ordering = ['-distributed_at']
        indexes = [
            models.Index(fields=['product', 'distributed_at']),
            models.Index(fields=['vehicle_number', 'distributed_at']),
        ]

    def __str__(self):
        return (
            f'{self.product.name} × {self.quantity} → {self.vehicle_number}'
            f' @ {self.distributed_at:%Y-%m-%d %H:%M}'
        )


class BottleMovement(models.Model):
    """
    Every bottle-related movement in/out of the warehouse.

    MOVEMENT TYPES:
      RECEIVE_EMPTY   → empties received back from a driver
      REFILL          → empties refilled and moved to full stock
      DISTRIBUTE      → full bottles loaded onto a van
      DIRECT_SALE     → sold directly to a walk-in customer

    For RECEIVE_EMPTY rows we also track expected vs actual
    (based on what the driver was supposed to bring back).
    """

    MOVEMENT_TYPES = [
        ('RECEIVE_EMPTY', 'Receive Empties'),
        ('REFILL',        'Refill Empties'),
        ('DISTRIBUTE',    'Distribute to Van'),
        ('DIRECT_SALE',   'Direct Sale'),
    ]

    CONDITION_CHOICES = [
        ('GOOD',    'Good'),
        ('DAMAGED', 'Damaged'),
        ('MISSING', 'Missing / Not Returned'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    product = models.ForeignKey(
        'Product',
        on_delete=models.CASCADE,
        related_name='bottle_movements',
        limit_choices_to={'is_returnable': True},
    )
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)

    # ── Quantities ────────────────────────────────────────────────────────────
    qty_good = models.PositiveIntegerField(default=0)
    qty_damaged = models.PositiveIntegerField(default=0)
    qty_missing = models.PositiveIntegerField(default=0)

    # For RECEIVE_EMPTY: how many did we expect the driver to bring?
    qty_expected = models.PositiveIntegerField(
        default=0,
        help_text='Only used for RECEIVE_EMPTY. How many empties were expected from this driver.',
    )

    # ── Who / where ───────────────────────────────────────────────────────────
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='bottle_movements',
        limit_choices_to={'role': 'driver'},
        help_text='Driver involved (for RECEIVE_EMPTY or DISTRIBUTE)',
    )
    vehicle_number = models.CharField(
        max_length=20, blank=True,
        help_text='Van plate — auto-filled from driver if available',
    )

    # For DIRECT_SALE — customer (may be a one-time walk-in)
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='bottle_movements',
    )
    customer_name = models.CharField(
        max_length=200, blank=True,
        help_text='Walk-in name if no customer account',
    )

    # ── Meta ──────────────────────────────────────────────────────────────────
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='bottle_movements_recorded',
    )
    movement_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bottle_movements'
        ordering = ['-movement_date']
        indexes = [
            models.Index(fields=['product', 'movement_date']),
            models.Index(fields=['movement_type', 'movement_date']),
            models.Index(fields=['driver', 'movement_date']),
        ]

    def __str__(self):
        return (
            f'{self.get_movement_type_display()} — {self.product.name} '
            f'× {self.qty_good + self.qty_damaged + self.qty_missing} '
            f'@ {self.movement_date:%Y-%m-%d %H:%M}'
        )

    @property
    def qty_total(self):
        return self.qty_good + self.qty_damaged + self.qty_missing


class ConsumableMovement(models.Model):
    """
    Stock movements for consumable (non-returnable) products.

    MOVEMENT TYPES:
      RECEIVE   → stock received from supplier
      DISTRIBUTE → loaded onto a van
      DIRECT_SALE → sold to walk-in customer
    """

    MOVEMENT_TYPES = [
        ('RECEIVE',      'Receive Stock'),
        ('DISTRIBUTE',   'Distribute to Van'),
        ('DIRECT_SALE',  'Direct Sale'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    product = models.ForeignKey(
        'Product',
        on_delete=models.CASCADE,
        related_name='consumable_movements',
    )
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    # Who
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='consumable_movements',
        limit_choices_to={'role': 'driver'},
    )
    vehicle_number = models.CharField(max_length=20, blank=True)
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='consumable_movements',
    )
    customer_name = models.CharField(max_length=200, blank=True)
    supplier_name = models.CharField(
        max_length=200, blank=True,
        help_text='Supplier name for RECEIVE movements',
    )

    unit_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        help_text='Sale price for DIRECT_SALE',
    )
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='consumable_movements_recorded',
    )
    movement_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'consumable_movements'
        ordering = ['-movement_date']
        indexes = [
            models.Index(fields=['product', 'movement_date']),
            models.Index(fields=['movement_type', 'movement_date']),
        ]

    def __str__(self):
        return (
            f'{self.get_movement_type_display()} — {self.product.name} '
            f'× {self.quantity} @ {self.movement_date:%Y-%m-%d %H:%M}'
        )

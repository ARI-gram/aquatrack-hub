"""
Order Management Models for AquaTrack
apps/orders/models.py
"""
from django.dispatch import receiver
from django.db.models.signals import post_save, pre_save
from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.utils import timezone


class Order(models.Model):

    ORDER_TYPES = [
        ('REFILL',     'Bottle Refill'),
        ('NEW_BOTTLE', 'New Bottle Purchase'),
        ('MIXED',      'Refill + New Bottles'),
    ]

    ORDER_STATUS = [
        ('PENDING',    'Pending'),
        ('CONFIRMED',  'Confirmed'),
        ('ASSIGNED',   'Assigned to Driver'),
        ('PICKED_UP',  'Picked Up'),
        ('IN_TRANSIT', 'In Transit'),
        ('ARRIVED',    'Arrived at Location'),
        ('DELIVERED',  'Delivered'),
        ('COMPLETED',  'Completed'),
        ('CANCELLED',  'Cancelled'),
    ]

    PAYMENT_STATUS = [
        ('PENDING',  'Pending'),
        ('PAID',     'Paid'),
        ('FAILED',   'Failed'),
        ('REFUNDED', 'Refunded'),
    ]

    PAYMENT_METHODS = [
        ('WALLET', 'Wallet'),
        ('CASH',   'Cash on Delivery'),
        ('CARD',   'Card Payment'),
        ('MPESA',  'M-Pesa'),
    ]

    order_number = models.CharField(max_length=50, unique=True)
    customer = models.ForeignKey(
        'customers.Customer',   on_delete=models.CASCADE, related_name='orders')
    client = models.ForeignKey(
        'clients.Client',       on_delete=models.CASCADE, related_name='orders')

    order_type = models.CharField(max_length=20, choices=ORDER_TYPES)
    status = models.CharField(
        max_length=20, choices=ORDER_STATUS, default='PENDING')

    subtotal = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'))
    delivery_fee = models.DecimalField(
        max_digits=8,  decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(
        max_digits=8,  decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'))

    payment_status = models.CharField(
        max_length=20, choices=PAYMENT_STATUS, default='PENDING')
    payment_method = models.CharField(
        max_length=20, choices=PAYMENT_METHODS, default='WALLET')
    paid_at = models.DateTimeField(null=True, blank=True)

    special_instructions = models.TextField(blank=True)

    # Manual order support
    is_manual_order = models.BooleanField(
        default=False,
        help_text="True when a client admin places an order on behalf of a customer (phone/WhatsApp order)",
    )
    require_otp = models.BooleanField(
        default=True,
        help_text="If False, driver can complete delivery without customer OTP verification",
    )
    created_by_admin = models.ForeignKey(
        'authentication.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='manually_created_orders',
        help_text="Admin who placed this order on behalf of the customer",
    )

    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)
    cancelled_by = models.ForeignKey(
        'authentication.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='cancelled_orders')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['customer', '-created_at']),
            models.Index(fields=['client',   '-created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['payment_status']),
        ]

    def __str__(self):
        return f"{self.order_number} — {self.status}"

    def can_be_cancelled(self):
        return self.status not in ['DELIVERED', 'COMPLETED', 'CANCELLED']

    def is_active(self):
        return self.status not in ['COMPLETED', 'CANCELLED']

    def calculate_total(self):
        return self.subtotal + self.delivery_fee - self.discount_amount


class OrderItem(models.Model):
    """
    A line item in an order, linked directly to a Product.
    Prices are snapshot at order time so historical records stay accurate
    even if the product price is updated later.
    """

    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name='items')

    # FK to the catalogue product — nullable so old orders without a product still work
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='order_items',
        help_text='Catalogue product this item refers to',
    )

    # Snapshot fields — captured at order time
    product_name = models.CharField(
        max_length=200, blank=True,
        help_text='Product name at time of order (snapshot)',
    )
    product_unit = models.CharField(
        max_length=10, blank=True,
        help_text='Unit (BOTTLES/LITRES) at time of order (snapshot)',
    )

    quantity = models.IntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(
        max_digits=8, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Selling price per unit at time of order',
    )
    subtotal = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'order_items'
        indexes = [models.Index(fields=['order'])]

    def __str__(self):
        return f"{self.order.order_number} — {self.product_name} × {self.quantity}"

    def save(self, *args, **kwargs):
        # Auto-fill snapshot fields from product if not already set
        if self.product and not self.product_name:
            self.product_name = self.product.name
            self.product_unit = self.product.unit
        # Auto-calculate subtotal
        self.subtotal = self.unit_price * self.quantity
        super().save(*args, **kwargs)


class OrderDelivery(models.Model):

    order = models.OneToOneField(
        Order, on_delete=models.CASCADE, related_name='delivery')
    delivery_address = models.ForeignKey(
        'customers.CustomerAddress', on_delete=models.PROTECT, related_name='deliveries')

    scheduled_date = models.DateField()
    scheduled_time_slot = models.CharField(max_length=50)

    assigned_driver = models.ForeignKey(
        'authentication.User', on_delete=models.SET_NULL,
        null=True, blank=True, limit_choices_to={'role': 'driver'},
        related_name='assigned_deliveries',
    )
    assigned_at = models.DateTimeField(null=True, blank=True)

    actual_delivery_time = models.DateTimeField(null=True, blank=True)

    signature_image = models.ImageField(
        upload_to='delivery_signatures/', null=True, blank=True)
    photo_proof = models.ImageField(
        upload_to='delivery_photos/',     null=True, blank=True)
    delivery_notes = models.TextField(blank=True)

    delivery_latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True)
    delivery_longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'order_deliveries'
        indexes = [
            models.Index(fields=['assigned_driver', 'scheduled_date']),
            models.Index(fields=['scheduled_date']),
        ]

    def __str__(self):
        return f"{self.order.order_number} — {self.scheduled_date}"

    def is_delivered(self):
        return self.actual_delivery_time is not None

    def is_overdue(self):
        if self.is_delivered():
            return False
        scheduled_datetime = timezone.make_aware(
            timezone.datetime.combine(self.scheduled_date, timezone.datetime.max.time()))
        return timezone.now() > scheduled_datetime


class OrderTimeline(models.Model):

    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name='timeline')
    status = models.CharField(max_length=20, choices=Order.ORDER_STATUS)
    timestamp = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    changed_by = models.ForeignKey(
        'authentication.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='order_status_changes')

    class Meta:
        db_table = 'order_timeline'
        ordering = ['timestamp']
        indexes = [models.Index(fields=['order', 'timestamp'])]

    def __str__(self):
        return f"{self.order.order_number} — {self.status} @ {self.timestamp}"


class BottleExchange(models.Model):

    order = models.OneToOneField(
        Order, on_delete=models.CASCADE, related_name='bottle_exchange')

    bottles_to_deliver = models.IntegerField(
        default=0, validators=[MinValueValidator(0)])
    bottles_to_collect = models.IntegerField(
        default=0, validators=[MinValueValidator(0)])
    bottles_delivered = models.IntegerField(
        null=True, blank=True, validators=[MinValueValidator(0)])
    bottles_collected = models.IntegerField(
        null=True, blank=True, validators=[MinValueValidator(0)])

    damaged_bottles = models.IntegerField(
        default=0, validators=[MinValueValidator(0)])
    missing_bottles = models.IntegerField(
        default=0, validators=[MinValueValidator(0)])

    exchange_confirmed = models.BooleanField(default=False)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        'authentication.User', on_delete=models.SET_NULL,
        null=True, blank=True, limit_choices_to={'role': 'driver'},
        related_name='confirmed_exchanges',
    )
    exchange_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'bottle_exchanges'
        indexes = [models.Index(fields=['order'])]

    def __str__(self):
        return (f"{self.order.order_number} — "
                f"deliver:{self.bottles_to_deliver} collect:{self.bottles_to_collect}")

    def has_discrepancy(self):
        if self.bottles_delivered is None or self.bottles_collected is None:
            return False
        return (
            self.bottles_delivered != self.bottles_to_deliver or
            self.bottles_collected != self.bottles_to_collect or
            self.damaged_bottles > 0 or self.missing_bottles > 0
        )

    def get_net_bottle_change(self):
        delivered = self.bottles_delivered or self.bottles_to_deliver
        collected = self.bottles_collected or self.bottles_to_collect
        return delivered - collected


# ── Signals ───────────────────────────────────────────────────────────────────

@receiver(pre_save, sender=Order)
def track_order_status_change(sender, instance, **kwargs):
    if instance.pk:
        try:
            old = Order.objects.get(pk=instance.pk)
            if old.status != instance.status:
                instance._status_changed = True
                instance._old_status = old.status
        except Order.DoesNotExist:
            pass


@receiver(post_save, sender=Order)
def create_order_timeline(sender, instance, created, **kwargs):
    if created:
        OrderTimeline.objects.create(
            order=instance, status=instance.status, notes='Order created')
    elif getattr(instance, '_status_changed', False):
        OrderTimeline.objects.create(
            order=instance, status=instance.status,
            notes=f'Status changed from {instance._old_status} to {instance.status}',
        )

"""
apps/deliveries/models.py
"""

import uuid
import random
from django.conf import settings
from datetime import timedelta
from django.dispatch import receiver
from django.db.models.signals import post_save
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from django.utils import timezone


class Delivery(models.Model):

    DELIVERY_STATUS = [
        ('ASSIGNED',    'Assigned'),
        ('ACCEPTED',    'Accepted by Driver'),
        ('REJECTED',    'Rejected by Driver'),
        ('PICKED_UP',   'Picked Up from Warehouse'),
        ('EN_ROUTE',    'En Route to Customer'),
        ('ARRIVED',     'Arrived at Location'),
        ('IN_PROGRESS', 'Delivery In Progress'),
        ('COMPLETED',   'Completed'),
        ('FAILED',      'Failed'),
    ]

    FAILURE_REASONS = [
        ('CUSTOMER_UNAVAILABLE', 'Customer Not Available'),
        ('WRONG_ADDRESS',        'Wrong/Invalid Address'),
        ('CUSTOMER_CANCELLED',   'Customer Cancelled'),
        ('VEHICLE_BREAKDOWN',    'Vehicle Breakdown'),
        ('WEATHER',              'Bad Weather'),
        ('TRAFFIC',              'Heavy Traffic'),
        ('OTHER',                'Other Reason'),
    ]

    # ── Core links ────────────────────────────────────────────────────────────
    order = models.OneToOneField(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='delivery_tracking',
        help_text="Order being delivered"
    )
    driver = models.ForeignKey(
        'authentication.User',
        on_delete=models.PROTECT,
        limit_choices_to={'role': 'driver'},
        related_name='deliveries',
        help_text="Driver handling this delivery"
    )
    vehicle_number = models.CharField(
        max_length=50, blank=True,
        help_text="Vehicle registration number"
    )

    # ── Status ────────────────────────────────────────────────────────────────
    status = models.CharField(
        max_length=20, choices=DELIVERY_STATUS, default='ASSIGNED',
        help_text="Current delivery status"
    )

    # ── Schedule ──────────────────────────────────────────────────────────────
    # Copied from OrderDelivery at assignment time so driver-facing queries
    # don't need a join to OrderDelivery just to filter by date.
    scheduled_date = models.DateField(
        null=True, blank=True,
        help_text="Scheduled delivery date"
    )
    scheduled_time_slot = models.CharField(
        max_length=50, blank=True, default='',
        help_text="Scheduled delivery time slot (e.g. '10:00 AM – 12:00 PM')"
    )

    # ── Timing ────────────────────────────────────────────────────────────────
    assigned_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    picked_up_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    arrived_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # ── Estimates ─────────────────────────────────────────────────────────────
    estimated_arrival = models.DateTimeField(null=True, blank=True)
    estimated_duration = models.IntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(0)],
        help_text="Estimated delivery duration in minutes"
    )

    # ── GPS ───────────────────────────────────────────────────────────────────
    current_latitude = models.DecimalField(
        max_digits=9,  decimal_places=6, null=True, blank=True)
    current_longitude = models.DecimalField(
        max_digits=9,  decimal_places=6, null=True, blank=True)
    last_location_update = models.DateTimeField(null=True, blank=True)

    # ── Distance ──────────────────────────────────────────────────────────────
    distance_to_customer = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal('0.00'))])
    total_distance_travelled = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal('0.00'))])

    # ── Proof of delivery ─────────────────────────────────────────────────────
    signature_image = models.ImageField(
        upload_to='delivery_signatures/%Y/%m/%d/', null=True, blank=True)
    photo_proof = models.ImageField(
        upload_to='delivery_photos/%Y/%m/%d/',     null=True, blank=True)
    customer_name_confirmed = models.CharField(max_length=100, blank=True)

    # ── Issues ────────────────────────────────────────────────────────────────
    has_issues = models.BooleanField(default=False)
    issue_description = models.TextField(blank=True)
    driver_notes = models.TextField(blank=True)

    # ── Failure ───────────────────────────────────────────────────────────────
    failure_reason = models.CharField(
        max_length=30, choices=FAILURE_REASONS, blank=True)
    failure_notes = models.TextField(blank=True)
    retry_scheduled = models.BooleanField(default=False)

    # ── Performance ───────────────────────────────────────────────────────────
    on_time = models.BooleanField(null=True, blank=True)
    customer_rating = models.IntegerField(null=True, blank=True, validators=[
                                          MinValueValidator(1), MaxValueValidator(5)])
    customer_feedback = models.TextField(blank=True)

    # ── Meta ──────────────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'deliveries'
        verbose_name = 'Delivery'
        verbose_name_plural = 'Deliveries'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['driver', '-created_at']),
            models.Index(fields=['driver', 'scheduled_date']),
            models.Index(fields=['status']),
            models.Index(fields=['assigned_at']),
            models.Index(fields=['order']),
            models.Index(fields=['scheduled_date']),
        ]

    def __str__(self):
        driver_name = getattr(self.driver, 'full_name',
                              None) or self.driver.email
        return f"{self.order.order_number} — {driver_name} — {self.status}"

    def is_active(self):
        return self.status not in ['COMPLETED', 'FAILED', 'REJECTED']

    def is_completed(self):
        return self.status == 'COMPLETED'

    def is_failed(self):
        return self.status == 'FAILED'

    def get_duration_minutes(self):
        if self.completed_at and self.assigned_at:
            return int((self.completed_at - self.assigned_at).total_seconds() / 60)
        return None

    def get_travel_time_minutes(self):
        if self.arrived_at and self.picked_up_at:
            return int((self.arrived_at - self.picked_up_at).total_seconds() / 60)
        return None

    def get_delivery_time_minutes(self):
        if self.completed_at and self.arrived_at:
            return int((self.completed_at - self.arrived_at).total_seconds() / 60)
        return None

    def update_location(self, latitude, longitude):
        self.current_latitude = latitude
        self.current_longitude = longitude
        self.last_location_update = timezone.now()
        self.save(update_fields=['current_latitude',
                  'current_longitude', 'last_location_update'])

    def mark_on_time(self):
        if not self.completed_at:
            return
        sched_date = self.scheduled_date
        if not sched_date:
            try:
                sched_date = self.order.delivery.scheduled_date
            except Exception:
                return
        scheduled_end = timezone.make_aware(
            timezone.datetime.combine(sched_date, timezone.datetime.max.time())
        )
        self.on_time = self.completed_at <= scheduled_end
        self.save(update_fields=['on_time'])


# ── Signal: keep Order.status in sync with Delivery.status ───────────────────

@receiver(post_save, sender=Delivery)
def update_order_status_on_delivery(sender, instance, created, **kwargs):
    status_mapping = {
        'ASSIGNED':    'ASSIGNED',
        'ACCEPTED':    'ASSIGNED',
        'PICKED_UP':   'PICKED_UP',
        'EN_ROUTE':    'IN_TRANSIT',
        'ARRIVED':     'ARRIVED',
        'IN_PROGRESS': 'ARRIVED',
        'COMPLETED':   'DELIVERED',
        'FAILED':      'CANCELLED',
    }
    if instance.status in status_mapping:
        new_order_status = status_mapping[instance.status]
        if instance.order.status != new_order_status:
            instance.order.status = new_order_status
            if instance.status == 'COMPLETED':
                instance.order.completed_at = instance.completed_at
                instance.mark_on_time()
            instance.order.save()


# ── DeliveryOTP ───────────────────────────────────────────────────────────────

class DeliveryOTP(models.Model):
    """
    6-digit OTP sent to the customer when a driver is assigned.

    Flow:
      1. Admin assigns driver → generate_delivery_otp() creates this record
         and emails the code to the customer.
      2. Driver asks customer for the code → enters it via
         POST /api/driver/deliveries/{id}/verify-otp/
      3. Backend sets is_verified=True → driver can then complete delivery.
      4. GET /api/customer/orders/{id}/track/ returns otp_code while
         is_verified=False and not expired; returns null afterwards.

    Migration:
        python manage.py makemigrations deliveries
        python manage.py migrate
    """

    delivery = models.OneToOneField(
        Delivery,
        on_delete=models.CASCADE,
        related_name='otp',
        help_text="The delivery this OTP belongs to",
    )
    otp_code = models.CharField(
        max_length=6,
        help_text="6-digit OTP shown to the customer",
    )
    is_verified = models.BooleanField(
        default=False,
        help_text="True once the driver enters the correct code",
    )
    verified_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Timestamp when the driver verified the OTP",
    )
    expires_at = models.DateTimeField(
        help_text="OTP becomes invalid after this time (default 24 h from creation)",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'delivery_otps'
        verbose_name = 'Delivery OTP'
        verbose_name_plural = 'Delivery OTPs'

    def __str__(self):
        if self.is_verified:
            label = 'verified'
        elif self.is_expired:
            label = 'expired'
        else:
            label = 'active'
        return f"OTP {self.otp_code} — {self.delivery.order.order_number} [{label}]"

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @classmethod
    def generate(cls, delivery: 'Delivery') -> 'DeliveryOTP':
        """
        Convenience factory — replaces any existing OTP for this delivery.
        Called by generate_delivery_otp() in views.py.
        """
        cls.objects.filter(delivery=delivery).delete()
        code = ''.join(str(random.randint(0, 9)) for _ in range(6))
        return cls.objects.create(
            delivery=delivery,
            otp_code=code,
            expires_at=timezone.now() + timedelta(hours=24),
        )


class StockRequest(models.Model):
    """
    A driver asks the store to top up their van with one or more products.
    The store admin reviews, adjusts quantities if needed, then approves
    (which triggers stock distribution) or rejects with a reason.
    """

    STATUS_CHOICES = [
        ('PENDING',            'Pending'),
        ('APPROVED',           'Approved'),
        ('PARTIALLY_APPROVED', 'Partially Approved'),
        ('REJECTED',           'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='stock_requests',
        limit_choices_to={'role': 'driver'},
    )

    # Optional link to a specific delivery that prompted this request
    delivery = models.ForeignKey(
        'deliveries.Delivery',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='stock_requests',
    )

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='PENDING', db_index=True)

    notes = models.TextField(blank=True, help_text='Driver notes to the store')
    rejection_reason = models.TextField(blank=True)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='approved_stock_requests',
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'stock_requests'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['driver', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f'StockRequest {self.id} — {self.driver} [{self.status}]'

    @property
    def driver_name(self):
        d = self.driver
        name = f'{getattr(d, "first_name", "")} {getattr(d, "last_name", "")}'.strip(
        )
        return name or d.email

    @property
    def vehicle_number(self):
        return getattr(self.driver, 'vehicle_number', '') or ''

    @property
    def delivery_order_number(self):
        if self.delivery and self.delivery.order:
            return self.delivery.order.order_number
        return None


class StockRequestItem(models.Model):
    """
    One product line inside a StockRequest.
    quantity_approved is set by the store admin when approving — it can be
    less than quantity_requested (partial approval).
    """

    PRODUCT_TYPE_CHOICES = [
        ('bottle',     'Bottle (returnable)'),
        ('consumable', 'Consumable'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    request = models.ForeignKey(
        StockRequest,
        on_delete=models.CASCADE,
        related_name='items',
    )

    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='stock_request_items',
    )

    # Denormalised for display even if product is later archived
    product_name = models.CharField(max_length=200)
    product_type = models.CharField(
        max_length=20, choices=PRODUCT_TYPE_CHOICES)
    unit = models.CharField(max_length=20, blank=True)

    quantity_requested = models.PositiveIntegerField()
    quantity_approved = models.PositiveIntegerField(null=True, blank=True)

    # Snapshot of driver's van balance at the time of the request
    current_qty_at_request = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stock_request_items'
        ordering = ['created_at']

    def __str__(self):
        return (
            f'{self.product_name} ×{self.quantity_requested}'
            f' (approved: {self.quantity_approved})'
        )

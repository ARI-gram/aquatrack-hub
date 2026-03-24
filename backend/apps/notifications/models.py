"""
apps/notifications/models.py
"""

from django.db import models
from django.utils import timezone


class Notification(models.Model):

    NOTIFICATION_TYPES = [
        # Order
        ('ORDER_PLACED',        'Order Placed'),
        ('ORDER_CONFIRMED',     'Order Confirmed'),
        ('ORDER_ASSIGNED',      'Order Assigned to Driver'),
        ('ORDER_PICKED_UP',     'Driver Picked Up Order'),
        ('ORDER_IN_TRANSIT',    'Order In Transit'),
        ('ORDER_ARRIVED',       'Driver Arrived'),
        ('ORDER_DELIVERED',     'Order Delivered'),
        ('ORDER_CANCELLED',     'Order Cancelled'),
        # Payment
        ('PAYMENT_SUCCESS',     'Payment Successful'),
        ('PAYMENT_FAILED',      'Payment Failed'),
        ('WALLET_TOPUP',        'Wallet Top-Up Successful'),
        ('WALLET_LOW_BALANCE',  'Low Wallet Balance'),
        ('REFUND_PROCESSED',    'Refund Processed'),
        # Bottles / stock
        ('BOTTLES_LOW',         'Low Bottle Inventory'),
        ('BOTTLES_EMPTY',       'No Empty Bottles'),
        ('BOTTLE_EXCHANGE',     'Bottle Exchange Completed'),
        ('BOTTLE_DEPOSIT',      'Bottle Deposit Received'),
        # Driver / delivery
        ('DRIVER_ASSIGNED',     'Driver Assigned'),
        ('DRIVER_NEARBY',       'Driver Nearby'),
        ('DRIVER_WAITING',      'Driver Waiting'),
        ('DELIVERY_OTP',        'Delivery OTP'),
        ('DELIVERY_COMPLETED',  'Delivery Completed'),
        ('DELIVERY_FAILED',     'Delivery Failed'),
        # Stock ops (client admin)
        ('STOCK_PICKUP',        'Stock Pickup Scheduled'),
        # Promotional
        ('PROMOTION',           'Special Promotion'),
        ('DISCOUNT',            'Discount Available'),
        ('REFERRAL_REWARD',     'Referral Reward'),
        # System
        ('SYSTEM_ANNOUNCEMENT', 'System Announcement'),
        ('ACCOUNT_UPDATE',      'Account Update'),
        ('MAINTENANCE',         'Scheduled Maintenance'),
    ]

    PRIORITY_LEVELS = [
        ('LOW',    'Low Priority'),
        ('MEDIUM', 'Medium Priority'),
        ('HIGH',   'High Priority'),
        ('URGENT', 'Urgent'),
    ]

    # ── Recipient ─────────────────────────────────────────────────────────────
    # NULL for staff-only / driver notifications scoped by extra_data
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True,
        blank=True,
        help_text="Customer receiving this notification. NULL for staff/driver-only alerts.",
    )

    # ── Content ───────────────────────────────────────────────────────────────
    notification_type = models.CharField(
        max_length=30, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    priority = models.CharField(
        max_length=10, choices=PRIORITY_LEVELS, default='MEDIUM')

    # ── Related entities ──────────────────────────────────────────────────────
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='notifications',
    )
    transaction = models.ForeignKey(
        'wallet.WalletTransaction',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='notifications',
    )

    # ── Channels ──────────────────────────────────────────────────────────────
    send_push = models.BooleanField(default=True)
    send_sms = models.BooleanField(default=False)
    send_email = models.BooleanField(default=False)

    # ── Status ────────────────────────────────────────────────────────────────
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    push_sent = models.BooleanField(default=False)
    push_sent_at = models.DateTimeField(null=True, blank=True)
    sms_sent = models.BooleanField(default=False)
    sms_sent_at = models.DateTimeField(null=True, blank=True)
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)

    # ── Action ────────────────────────────────────────────────────────────────
    action_url = models.CharField(max_length=500, blank=True)
    action_label = models.CharField(max_length=50, blank=True)

    # ── Extra ─────────────────────────────────────────────────────────────────
    extra_data = models.JSONField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'notifications'
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer', '-created_at']),
            models.Index(fields=['customer', 'is_read']),
            models.Index(fields=['notification_type']),
            models.Index(fields=['priority']),
            models.Index(fields=['-created_at']),
            models.Index(fields=['order']),
        ]

    def __str__(self):
        recipient = self.customer.phone if self.customer else 'staff/driver'
        return f"{recipient} — {self.notification_type} — {self.title}"

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])

    def is_expired(self):
        return bool(self.expires_at and timezone.now() > self.expires_at)

    def is_urgent(self):
        return self.priority == 'URGENT'

    def get_channels_used(self):
        channels = []
        if self.push_sent:
            channels.append('push')
        if self.sms_sent:
            channels.append('sms')
        if self.email_sent:
            channels.append('email')
        return channels

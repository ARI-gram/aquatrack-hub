"""
apps/notifications/serializers.py
"""

from rest_framework import serializers
from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """
    Full notification serializer.
    Used for customer and client-admin notification lists.
    """
    notificationType = serializers.CharField(
        source='notification_type', read_only=True)
    isRead = serializers.BooleanField(source='is_read',        read_only=True)
    readAt = serializers.DateTimeField(source='read_at',        read_only=True)
    createdAt = serializers.DateTimeField(
        source='created_at',     read_only=True)
    actionUrl = serializers.CharField(
        source='action_url',         read_only=True)
    actionLabel = serializers.CharField(
        source='action_label',       read_only=True)
    extraData = serializers.JSONField(
        source='extra_data',         read_only=True)
    isExpired = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id',
            'notificationType',
            'title',
            'message',
            'priority',
            'isRead',
            'readAt',
            'createdAt',
            'actionUrl',
            'actionLabel',
            'extraData',
            'isExpired',
        ]

    def get_isExpired(self, obj):
        return obj.is_expired()


class NotificationListSerializer(serializers.Serializer):
    """Wraps a paginated notification list with metadata."""
    notifications = NotificationSerializer(many=True)
    unread_count = serializers.IntegerField()
    total = serializers.IntegerField()
    page = serializers.IntegerField(required=False)
    limit = serializers.IntegerField(required=False)
    total_pages = serializers.IntegerField(required=False)


class MarkReadSerializer(serializers.Serializer):
    """
    Body for POST /notifications/mark-read/
    Pass notification_ids to mark specific ones, or mark_all=true for all.
    """
    notification_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=True,
        default=list,
    )
    mark_all = serializers.BooleanField(default=False)

    def validate(self, data):
        if not data.get('mark_all') and not data.get('notification_ids'):
            raise serializers.ValidationError(
                "Provide notification_ids or set mark_all=true."
            )
        return data


class DriverNotificationSerializer(serializers.Serializer):
    """
    Lightweight notification shape for the driver app.

    Drivers don't have Notification model rows — their notifications are
    synthesised from Delivery records by DriverNotificationListView.
    The shape intentionally mirrors NotificationSerializer so the frontend
    can render both through the same component.
    """
    id = serializers.UUIDField()
    type = serializers.CharField()        # e.g. 'DELIVERY_ASSIGNED'
    title = serializers.CharField()
    message = serializers.CharField()
    order_number = serializers.CharField()
    scheduled_date = serializers.DateField(allow_null=True)
    scheduled_time_slot = serializers.CharField(allow_blank=True)
    status = serializers.CharField()
    assigned_at = serializers.DateTimeField()


class StockPickupNotificationSerializer(serializers.Serializer):
    """
    Shape of the extra_data payload stored on STOCK_PICKUP notifications.
    Used internally to validate / document the structure written by
    NotifyDriverStockPickupView — not exposed as an API endpoint directly.

    Example extra_data:
        {
            "products": [
                {"product_id": "...", "product_name": "20L Bottle", "quantity": 6}
            ],
            "scheduled_date": "2026-03-15",
            "dispatcher":     "John Admin",
            "client_id":      "<uuid>"
        }
    """
    class _ProductEntry(serializers.Serializer):
        product_id = serializers.UUIDField()
        product_name = serializers.CharField()
        quantity = serializers.IntegerField(min_value=1)

    products = _ProductEntry(many=True)
    scheduled_date = serializers.DateField(required=False, allow_null=True)
    dispatcher = serializers.CharField(required=False, allow_blank=True)
    client_id = serializers.UUIDField(required=False)

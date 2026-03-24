from rest_framework import serializers
from decimal import Decimal
from django.utils import timezone
from django.db import transaction as db_transaction

from apps.bottles.models import BottleInventory, BottleTransaction
from apps.orders.models import (
    Order, OrderItem, OrderDelivery, OrderTimeline, BottleExchange
)
from apps.wallet.models import Wallet, WalletTransaction
from apps.customers.models import CustomerAddress


class BottleInventorySerializer(serializers.ModelSerializer):
    """
    Bottle inventory serializer.

    Shows customer's current bottle status.
    """

    available_for_refill = serializers.SerializerMethodField()
    total_value = serializers.SerializerMethodField()

    class Meta:
        model = BottleInventory
        fields = [
            'id',
            'customer',
            'total_owned',
            'full_bottles',
            'empty_bottles',
            'in_transit',
            'total_deposit_paid',
            'deposit_per_bottle',
            'available_for_refill',
            'total_value',
            'last_transaction_date',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'customer', 'created_at', 'updated_at']

    def get_available_for_refill(self, obj):
        """Get number of empty bottles available for refill."""
        return obj.get_available_for_refill()

    def get_total_value(self, obj):
        """Get total deposit value of owned bottles."""
        return str(obj.calculate_total_value())


class BottleTransactionSerializer(serializers.ModelSerializer):
    """
    Bottle transaction serializer.

    Shows bottle movement history.
    """

    transaction_type_display = serializers.CharField(
        source='get_transaction_type_display',
        read_only=True
    )

    class Meta:
        model = BottleTransaction
        fields = [
            'id',
            'customer',
            'transaction_type',
            'transaction_type_display',
            'quantity',
            'order',
            'balance_total_owned',
            'balance_full',
            'balance_empty',
            'balance_in_transit',
            'deposit_amount',
            'notes',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

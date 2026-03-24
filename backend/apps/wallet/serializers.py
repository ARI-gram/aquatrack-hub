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


class WalletSerializer(serializers.ModelSerializer):
    """
    Wallet serializer.

    Shows customer's wallet information.
    """

    needs_low_balance_alert = serializers.SerializerMethodField()
    needs_auto_topup = serializers.SerializerMethodField()

    class Meta:
        model = Wallet
        fields = [
            'id',
            'customer',
            'current_balance',
            'total_topped_up',
            'total_spent',
            'daily_limit',
            'monthly_limit',
            'auto_topup_enabled',
            'auto_topup_threshold',
            'auto_topup_amount',
            'low_balance_alert_enabled',
            'low_balance_threshold',
            'is_active',
            'is_locked',
            'needs_low_balance_alert',
            'needs_auto_topup',
            'last_transaction_date'
        ]
        read_only_fields = [
            'id', 'customer', 'current_balance',
            'total_topped_up', 'total_spent', 'last_transaction_date'
        ]

    def get_needs_low_balance_alert(self, obj):
        """Check if low balance alert needed."""
        return obj.needs_low_balance_alert()

    def get_needs_auto_topup(self, obj):
        """Check if auto top-up needed."""
        return obj.needs_auto_topup()


class WalletTransactionSerializer(serializers.ModelSerializer):
    """
    Wallet transaction serializer.

    Shows wallet transaction history.
    """

    transaction_type_display = serializers.CharField(
        source='get_transaction_type_display',
        read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    signed_amount = serializers.SerializerMethodField()

    class Meta:
        model = WalletTransaction
        fields = [
            'id',
            'transaction_type',
            'transaction_type_display',
            'amount',
            'signed_amount',
            'balance_before',
            'balance_after',
            'status',
            'status_display',
            'payment_method',
            'payment_reference',
            'order',
            'description',
            'created_at',
            'completed_at'
        ]
        read_only_fields = ['id', 'created_at', 'completed_at']

    def get_signed_amount(self, obj):
        """Get amount with sign (+ for credit, - for debit)."""
        return str(obj.get_signed_amount())


class WalletTopUpSerializer(serializers.Serializer):
    """
    Wallet top-up serializer.

    Handles wallet top-up requests.

    Request:
        {
            "amount": "500.00",
            "payment_method": "MPESA",
            "payment_reference": "MPE12345678"
        }
    """

    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('1.00')
    )
    payment_method = serializers.ChoiceField(
        choices=['CASH', 'CARD', 'MPESA', 'BANK_TRANSFER']
    )
    payment_reference = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True
    )

    def validate_amount(self, value):
        """Validate top-up amount."""
        if value < Decimal('10.00'):
            raise serializers.ValidationError(
                "Minimum top-up amount is KES 10.00"
            )

        if value > Decimal('50000.00'):
            raise serializers.ValidationError(
                "Maximum top-up amount is KES 50,000.00"
            )

        return value

    @db_transaction.atomic
    def create(self, validated_data):
        """
        Process wallet top-up.
        """
        customer = self.context['request'].user.customer
        wallet = customer.wallet
        amount = validated_data['amount']

        # Create wallet transaction
        transaction = WalletTransaction.objects.create(
            wallet=wallet,
            transaction_type='TOPUP',
            amount=amount,
            balance_before=wallet.current_balance,
            balance_after=wallet.current_balance + amount,
            payment_method=validated_data['payment_method'],
            payment_reference=validated_data.get('payment_reference', ''),
            description=f"Wallet top-up via {validated_data['payment_method']}",
            status='COMPLETED',
            completed_at=timezone.now()
        )

        # Update wallet balance is handled by signal

        return transaction

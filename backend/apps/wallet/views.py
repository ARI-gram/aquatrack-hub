from rest_framework import status, generics, permissions, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from apps.wallet.models import Wallet, WalletTransaction
from apps.wallet.serializers import (
    WalletSerializer,
    WalletTransactionSerializer,
    WalletTopUpSerializer
)

from apps.notifications import notify

LOW_BALANCE_THRESHOLD = 200  # KES — adjust to your preference


class IsCustomer(permissions.BasePermission):
    """
    Custom permission to check if user is a customer.
    """

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, 'customer')
        )


class WalletView(generics.RetrieveUpdateAPIView):
    """
    Wallet endpoint.

    GET /api/customer/wallet - View wallet
    PUT /api/customer/wallet - Update wallet settings

    Response (200):
        {
            "id": 1,
            "current_balance": "500.00",
            "total_topped_up": "1000.00",
            "total_spent": "500.00",
            "auto_topup_enabled": false,
            "auto_topup_threshold": "100.00",
            "auto_topup_amount": "500.00",
            "is_active": true,
            "needs_low_balance_alert": false
        }
    """

    serializer_class = WalletSerializer
    permission_classes = [IsCustomer]

    def get_object(self):
        """Return wallet for current customer."""
        customer = self.request.user.customer

        # Get or create wallet
        wallet, created = Wallet.objects.get_or_create(
            customer=customer
        )

        return wallet


class WalletTopUpView(generics.CreateAPIView):
    """
    Wallet top-up endpoint.

    POST /api/customer/wallet/topup

    Add money to wallet.

    Request Body:
        {
            "amount": "500.00",
            "payment_method": "MPESA",
            "payment_reference": "MPE12345678"
        }

    Response (201):
        {
            "id": 1,
            "transaction_type": "TOPUP",
            "amount": "500.00",
            "balance_after": "1000.00",
            "payment_method": "MPESA",
            "payment_reference": "MPE12345678",
            "status": "COMPLETED",
            "created_at": "2026-02-04T10:00:00Z"
        }
    """

    serializer_class = WalletTopUpSerializer
    permission_classes = [IsCustomer]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transaction = serializer.save()

        # Notify customer of successful top-up
        notify.wallet_topup(transaction)

        # Return transaction details
        transaction_serializer = WalletTransactionSerializer(transaction)
        return Response(
            transaction_serializer.data,
            status=status.HTTP_201_CREATED
        )


class WalletTransactionListView(generics.ListAPIView):
    """
    Wallet transaction history endpoint.

    GET /api/customer/wallet/transactions

    Lists all wallet transactions for customer.

    Query Parameters:
        - transaction_type: Filter by type (TOPUP, PAYMENT, REFUND)
        - limit: Number of results (default: 50)

    Response (200):
        [
            {
                "id": 1,
                "transaction_type": "TOPUP",
                "amount": "500.00",
                "signed_amount": "+500.00",
                "balance_after": "1000.00",
                "status": "COMPLETED",
                "created_at": "2026-02-04T10:00:00Z"
            },
            ...
        ]
    """

    serializer_class = WalletTransactionSerializer
    permission_classes = [IsCustomer]

    def get_queryset(self):
        """Return transactions for current customer's wallet."""
        customer = self.request.user.customer
        queryset = WalletTransaction.objects.filter(wallet=customer.wallet)

        # Filter by transaction type if provided
        transaction_type = self.request.query_params.get('transaction_type')
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)

        # Limit results
        limit = int(self.request.query_params.get('limit', 50))
        return queryset[:limit]


def deduct_wallet_and_notify(wallet, amount, order=None, description='Payment'):
    """
    Helper: deduct `amount` from `wallet`, create a PAYMENT transaction,
    fire payment_success and (if balance dips low) wallet_low_balance.

    Call this wherever you process a wallet payment.
    """
    from django.utils import timezone

    balance_before = wallet.current_balance
    balance_after = balance_before - amount

    wallet.current_balance = balance_after
    wallet.save(update_fields=['current_balance'])

    transaction = WalletTransaction.objects.create(
        wallet=wallet,
        transaction_type='PAYMENT',
        amount=amount,
        balance_before=balance_before,
        balance_after=balance_after,
        order=order,
        description=description,
        status='COMPLETED',
        completed_at=timezone.now(),
    )

    # Notify payment success
    notify.payment_success(transaction)

    # Notify low balance if applicable
    if wallet.current_balance < LOW_BALANCE_THRESHOLD:
        notify.wallet_low_balance(wallet.customer, wallet.current_balance)

    return transaction

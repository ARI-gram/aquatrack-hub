from rest_framework import status, generics, permissions
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from apps.wallet.models import Wallet, WalletTransaction
from apps.wallet.serializers import (
    WalletSerializer,
    WalletTransactionSerializer,
    WalletTopUpSerializer,
)
from apps.customers.authentication import CustomerJWTAuthentication
from apps.notifications import notify

LOW_BALANCE_THRESHOLD = 200  # KES


class IsCustomer(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, 'customer')
        )


class WalletView(generics.RetrieveUpdateAPIView):
    serializer_class = WalletSerializer
    permission_classes = [IsCustomer]
    authentication_classes = [CustomerJWTAuthentication]

    def get_object(self):
        customer = self.request.user.customer
        wallet, _ = Wallet.objects.get_or_create(customer=customer)
        return wallet


class WalletTopUpView(generics.CreateAPIView):
    serializer_class = WalletTopUpSerializer
    permission_classes = [IsCustomer]
    authentication_classes = [CustomerJWTAuthentication]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transaction = serializer.save()
        notify.wallet_topup(transaction)
        transaction_serializer = WalletTransactionSerializer(transaction)
        return Response(transaction_serializer.data, status=status.HTTP_201_CREATED)


class WalletTransactionListView(generics.ListAPIView):
    serializer_class = WalletTransactionSerializer
    permission_classes = [IsCustomer]
    authentication_classes = [CustomerJWTAuthentication]

    def get_queryset(self):
        customer = self.request.user.customer
        queryset = WalletTransaction.objects.filter(wallet=customer.wallet)
        transaction_type = self.request.query_params.get('transaction_type')
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)
        limit = int(self.request.query_params.get('limit', 50))
        return queryset[:limit]


def deduct_wallet_and_notify(wallet, amount, order=None, description='Payment'):
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

    notify.payment_success(transaction)

    if wallet.current_balance < LOW_BALANCE_THRESHOLD:
        notify.wallet_low_balance(wallet.customer, wallet.current_balance)

    return transaction

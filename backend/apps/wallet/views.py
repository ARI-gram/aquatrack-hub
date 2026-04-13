from rest_framework import status, generics, permissions
from rest_framework.response import Response
from apps.wallet.models import Wallet, WalletTransaction
from apps.wallet.serializers import (
    WalletSerializer,
    WalletTransactionSerializer,
    WalletTopUpSerializer
)
from apps.notifications import notify

LOW_BALANCE_THRESHOLD = 200


def get_customer_from_request(request):
    from apps.customers.models import Customer
    customer_id = request.auth.payload.get('customer_id')
    return Customer.objects.get(id=customer_id)


class IsCustomer(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(getattr(request.auth, 'payload', {}).get('customer_id'))


class WalletView(generics.RetrieveUpdateAPIView):
    serializer_class = WalletSerializer
    permission_classes = [IsCustomer]

    def get_object(self):
        customer = get_customer_from_request(self.request)
        wallet, _ = Wallet.objects.get_or_create(customer=customer)
        return wallet


class WalletTopUpView(generics.CreateAPIView):
    serializer_class = WalletTopUpSerializer
    permission_classes = [IsCustomer]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transaction = serializer.save()
        notify.wallet_topup(transaction)
        return Response(
            WalletTransactionSerializer(transaction).data,
            status=status.HTTP_201_CREATED
        )


class WalletTransactionListView(generics.ListAPIView):
    serializer_class = WalletTransactionSerializer
    permission_classes = [IsCustomer]

    def get_queryset(self):
        customer = get_customer_from_request(self.request)
        queryset = WalletTransaction.objects.filter(wallet__customer=customer)
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

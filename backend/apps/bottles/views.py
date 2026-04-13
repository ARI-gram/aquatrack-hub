from rest_framework import status, generics, permissions
from rest_framework.response import Response
from apps.bottles.models import BottleInventory, BottleTransaction
from apps.bottles.serializers import (
    BottleInventorySerializer,
    BottleTransactionSerializer
)


def get_customer_from_request(request):
    from apps.customers.models import Customer
    customer_id = request.auth.payload.get('customer_id')
    return Customer.objects.get(id=customer_id)


class IsCustomer(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(getattr(request.auth, 'payload', {}).get('customer_id'))


class BottleInventoryView(generics.RetrieveAPIView):
    serializer_class = BottleInventorySerializer
    permission_classes = [IsCustomer]

    def get_object(self):
        customer = get_customer_from_request(self.request)
        inventory, _ = BottleInventory.objects.get_or_create(customer=customer)
        return inventory


class BottleTransactionListView(generics.ListAPIView):
    serializer_class = BottleTransactionSerializer
    permission_classes = [IsCustomer]

    def get_queryset(self):
        customer = get_customer_from_request(self.request)
        queryset = BottleTransaction.objects.filter(customer=customer)
        transaction_type = self.request.query_params.get('transaction_type')
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)
        limit = int(self.request.query_params.get('limit', 50))
        return queryset[:limit]

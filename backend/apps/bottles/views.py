from rest_framework import status, generics, permissions
from rest_framework.response import Response
from apps.bottles.models import BottleInventory, BottleTransaction
from apps.bottles.serializers import (
    BottleInventorySerializer,
    BottleTransactionSerializer,
)
from apps.customers.authentication import CustomerJWTAuthentication


class IsCustomer(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            hasattr(request.user, 'customer')
        )


class BottleInventoryView(generics.RetrieveAPIView):
    serializer_class = BottleInventorySerializer
    permission_classes = [IsCustomer]
    authentication_classes = [CustomerJWTAuthentication]

    def get_object(self):
        customer = self.request.user.customer
        inventory, _ = BottleInventory.objects.get_or_create(customer=customer)
        return inventory


class BottleTransactionListView(generics.ListAPIView):
    serializer_class = BottleTransactionSerializer
    permission_classes = [IsCustomer]
    authentication_classes = [CustomerJWTAuthentication]

    def get_queryset(self):
        customer = self.request.user.customer
        queryset = BottleTransaction.objects.filter(customer=customer)
        transaction_type = self.request.query_params.get('transaction_type')
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)
        limit = int(self.request.query_params.get('limit', 50))
        return queryset[:limit]

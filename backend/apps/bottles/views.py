# bottles/views.py
from rest_framework import status, generics, permissions, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404

from apps.bottles.models import BottleInventory, BottleTransaction
from apps.bottles.serializers import (
    BottleInventorySerializer,
    BottleTransactionSerializer
)


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


class BottleInventoryView(generics.RetrieveAPIView):
    """
    Bottle inventory endpoint.

    GET /api/customer/bottles/inventory

    Shows customer's current bottle inventory.

    Response (200):
        {
            "id": 1,
            "total_owned": 5,
            "full_bottles": 2,
            "empty_bottles": 3,
            "in_transit": 0,
            "total_deposit_paid": "250.00",
            "deposit_per_bottle": "50.00",
            "available_for_refill": 3,
            "total_value": "250.00"
        }
    """

    serializer_class = BottleInventorySerializer
    permission_classes = [IsCustomer]

    def get_object(self):
        """Return bottle inventory for current customer."""
        customer = self.request.user.customer

        # Get or create inventory
        inventory, created = BottleInventory.objects.get_or_create(
            customer=customer
        )

        return inventory


class BottleTransactionListView(generics.ListAPIView):
    """
    Bottle transaction history endpoint.

    GET /api/customer/bottles/transactions

    Lists all bottle transactions for customer.

    Query Parameters:
        - transaction_type: Filter by type (PURCHASE, DELIVERY, etc.)
        - limit: Number of results (default: 50)

    Response (200):
        [
            {
                "id": 1,
                "transaction_type": "PURCHASE",
                "quantity": 5,
                "balance_total_owned": 5,
                "deposit_amount": "250.00",
                "created_at": "2026-02-04T10:00:00Z"
            },
            ...
        ]
    """

    serializer_class = BottleTransactionSerializer
    permission_classes = [IsCustomer]

    def get_queryset(self):
        """Return transactions for current customer."""
        customer = self.request.user.customer
        queryset = BottleTransaction.objects.filter(customer=customer)

        # Filter by transaction type if provided
        transaction_type = self.request.query_params.get('transaction_type')
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)

        # Limit results
        limit = int(self.request.query_params.get('limit', 50))
        return queryset[:limit]

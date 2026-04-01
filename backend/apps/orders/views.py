"""
Order Views for AquaTrack
=========================

Endpoints:
- GET  /api/customer/orders/           List customer orders
- POST /api/customer/orders/create     Create new order
- GET  /api/customer/orders/{id}/      View order details
- POST /api/customer/orders/{id}/cancel Cancel order
- GET  /api/orders/all/                List all orders (admin)
- GET  /api/orders/manage/{id}/        View/update order (admin)
"""
# /apps/orders/views.py
from rest_framework import status, generics, permissions
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from apps.customers.authentication import CustomerJWTAuthentication
from apps.orders.models import Order, OrderItem
from apps.orders.serializers import AdminOrderCreateSerializer, OrderSerializer, OrderCreateSerializer
from apps.wallet.models import WalletTransaction

from apps.notifications import notify

# ── Permissions ───────────────────────────────────────────────────────────────


class IsCustomer(permissions.BasePermission):
    """Allows authenticated users who have a linked Customer object."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, 'customer')
        )


# ── Customer order views ──────────────────────────────────────────────────────

class OrderListView(generics.ListAPIView):
    """
    GET /api/customer/orders/
    Lists all orders for the authenticated customer.

    Query params:
        status  — filter by status (PENDING, CONFIRMED, …)
        limit   — max results (default 20)
    """

    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsCustomer]
    serializer_class = OrderSerializer

    def get_queryset(self):
        customer = self.request.user.customer
        qs = Order.objects.filter(customer=customer)

        order_status = self.request.query_params.get('status')
        if order_status:
            qs = qs.filter(status=order_status)

        limit = int(self.request.query_params.get('limit', 20))
        return qs.order_by('-created_at')[:limit]


class OrderCreateView(generics.CreateAPIView):
    """
    POST /api/customer/orders/create
    Creates a new order for the authenticated customer.

    Request body:
        {
            "delivery_address_id": 1,
            "scheduled_date":      "2026-02-10",
            "scheduled_time_slot": "9:00 AM – 12:00 PM",
            "items": [
                { "product_id": "<uuid>", "quantity": 2 }
            ],
            "payment_method":       "WALLET",
            "special_instructions": "Call before arriving"
        }
    """

    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsCustomer]
    serializer_class = OrderCreateSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()

        # Notify customer their order was placed
        notify.order_placed(order)

        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_201_CREATED,
        )


class OrderDetailView(generics.RetrieveAPIView):
    """
    GET /api/customer/orders/{id}/
    Returns detailed information about a specific order.
    """

    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsCustomer]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return Order.objects.filter(customer=self.request.user.customer)


class OrderCancelView(generics.GenericAPIView):
    """
    POST /api/customer/orders/{id}/cancel
    Cancels a cancellable order and refunds the wallet if applicable.

    Request body (optional):
        { "reason": "Changed my mind" }
    """

    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsCustomer]

    def post(self, request, pk):
        customer = request.user.customer
        order = get_object_or_404(Order, pk=pk, customer=customer)

        if not order.can_be_cancelled():
            return Response(
                {'error': 'This order cannot be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get('reason', 'Cancelled by customer')
        order.status = 'CANCELLED'
        order.cancellation_reason = reason
        order.cancelled_by = request.user
        order.save()

        # Notify customer of cancellation
        notify.order_cancelled(order, reason=reason)

        # Wallet refund if already paid via wallet
        if order.payment_status == 'PAID' and order.payment_method == 'WALLET':
            from django.utils import timezone
            wallet = customer.wallet

            WalletTransaction.objects.create(
                wallet=wallet,
                transaction_type='REFUND',
                amount=order.total_amount,
                balance_before=wallet.current_balance,
                balance_after=wallet.current_balance + order.total_amount,
                order=order,
                description=f'Refund for cancelled order {order.order_number}',
                status='COMPLETED',
                completed_at=timezone.now(),
            )

            order.payment_status = 'REFUNDED'
            order.save()

        return Response(
            {'message': 'Order cancelled successfully.'},
            status=status.HTTP_200_OK,
        )


# ── Admin order views ─────────────────────────────────────────────────────────

class AdminOrderListView(generics.ListAPIView):
    """
    GET /api/orders/all/
    Lists orders scoped by the requesting user's role.
    Accessible by client_admin, site_manager, super_admin, and driver.

    Query params:
        status      — filter by order status
        customer_id — filter by customer UUID
        date_from   — ISO date  e.g. 2026-01-01
        date_to     — ISO date
    """

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if user.role == 'super_admin':
            qs = Order.objects.all()
        elif user.role in ('client_admin', 'site_manager'):
            qs = Order.objects.filter(client=user.client)
        elif user.role == 'driver':
            qs = Order.objects.filter(delivery__assigned_driver=user)
        else:
            qs = Order.objects.none()

        # Support comma-separated statuses e.g. ?status=PENDING,CONFIRMED
        status_filter = self.request.query_params.get('status')
        if status_filter:
            statuses = [s.strip() for s in status_filter.split(',')]
            qs = qs.filter(status__in=statuses)

        customer_id = self.request.query_params.get('customer_id')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs.order_by('-created_at')


class AdminOrderDetailView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/orders/manage/{id}/   view order
    PUT  /api/orders/manage/{id}/   update order (status, etc.)
    Accessible by client_admin and super_admin only.
    """

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'super_admin':
            return Order.objects.all()
        elif user.role in ('client_admin', 'site_manager'):
            return Order.objects.filter(client=user.client)
        return Order.objects.none()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        old_status = instance.status

        serializer = self.get_serializer(
            instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()

        new_status = order.status

        # Fire status-change notifications
        if old_status != new_status:
            if new_status == 'CONFIRMED':
                notify.order_confirmed(order)
            elif new_status == 'CANCELLED':
                reason = request.data.get('reason', '')
                notify.order_cancelled(order, reason=reason)

        return Response(OrderSerializer(order).data)


class AdminCreateOrderView(generics.CreateAPIView):
    """
    POST /api/orders/admin-create/

    Client admin places an order on behalf of a customer
    (phone/WhatsApp order). The order is created as CONFIRMED
    and flagged as a manual order.

    Requires: client_admin or site_manager role.
    """
    serializer_class = AdminOrderCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        return AdminOrderCreateSerializer

    def create(self, request, *args, **kwargs):
        if request.user.role not in ('client_admin', 'site_manager', 'super_admin'):
            return Response(
                {'error': 'Only admins can create orders on behalf of customers.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = AdminOrderCreateSerializer(
            data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()

        # Notify customer their order was placed
        from apps.notifications import notify
        notify.order_placed(order)

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

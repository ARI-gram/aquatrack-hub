"""
apps/deliveries/views.py
"""

from django.db import models
from django.db.models import Q, Count, Sum
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from decimal import Decimal
import random

from apps.deliveries.models import Delivery, DeliveryOTP
from apps.deliveries.serializers import (
    DriverDeliveryListSerializer,
    DriverDeliveryDetailSerializer,
    DriverLocationUpdateSerializer,
    DriverStatusUpdateSerializer,
    DriverCompleteDeliverySerializer,
    ClientDeliveryListSerializer,
    ClientDeliveryDetailSerializer,
    ClientDeliveryStatsSerializer,
    DriverAssignmentSerializer,
)
from apps.deliveries.partial_delivery import apply_partial_delivery_adjustment
from apps.authentication.models import User
from apps.orders.models import Order
from apps.notifications import notify


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def _user_display_name(user):
    name = getattr(user, 'full_name', None)
    if name and name.strip():
        return name.strip()
    if callable(getattr(user, 'get_full_name', None)):
        name = user.get_full_name()
        if name and name.strip():
            return name.strip()
    return user.email


def generate_delivery_otp(delivery: Delivery, order) -> DeliveryOTP:
    """
    Generate (or reuse) a 6-digit OTP for this delivery.

    If the same driver already has an active, unverified OTP for the same
    customer today, we reuse that exact code so the customer only ever
    receives / needs to quote one code per driver visit.
    """
    from apps.deliveries.models import DeliveryOTP
    import logging
    log = logging.getLogger(__name__)

    customer = order.customer
    driver = delivery.driver

    # ── Look for an existing active OTP for this customer+driver combo ───────
    existing_code = None
    sibling_deliveries = Delivery.objects.filter(
        driver=driver,
        order__customer=customer,
        status__in=['ASSIGNED', 'ACCEPTED', 'PICKED_UP',
                    'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'],
    ).exclude(id=delivery.id).prefetch_related('otp')

    for sib in sibling_deliveries:
        try:
            otp = sib.otp
            if not otp.is_verified and not otp.is_expired:
                existing_code = otp.otp_code
                break
        except DeliveryOTP.DoesNotExist:
            pass

    # ── Create / replace OTP for this delivery ────────────────────────────────
    DeliveryOTP.objects.filter(delivery=delivery).delete()
    code = existing_code or ''.join(
        str(random.randint(0, 9)) for _ in range(6))

    from datetime import timedelta
    otp = DeliveryOTP.objects.create(
        delivery=delivery,
        otp_code=code,
        expires_at=timezone.now() + timedelta(hours=24),
    )

    driver_name = _user_display_name(driver)

    # ── Only email the customer if this is a NEW code ─────────────────────────
    if not existing_code:
        try:
            if customer.email:
                _send_delivery_otp_email(
                    email=customer.email,
                    otp_code=otp.otp_code,
                    driver_name=driver_name,
                    order_number=order.order_number,
                )
        except Exception:
            log.warning("Could not email delivery OTP for order %s",
                        order.order_number)
    else:
        # Send a lighter "another order is also coming" nudge instead
        try:
            if customer.email:
                from django.core.mail import send_mail
                from django.conf import settings
                send_mail(
                    subject=f'Additional delivery coming — {order.order_number}',
                    message=(
                        f'Hi,\n\n'
                        f'Your driver {driver_name} is also bringing order {order.order_number}.\n\n'
                        f'Use the SAME delivery code you already received to confirm all deliveries.\n\n'
                        f'— AquaTrack'
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[customer.email],
                    fail_silently=True,
                )
        except Exception:
            pass

    notify.delivery_otp(order, otp.otp_code)
    return otp


def _send_delivery_otp_email(email, otp_code, driver_name, order_number):
    from django.core.mail import send_mail
    from django.conf import settings
    send_mail(
        subject=f'Your delivery code — {order_number}',
        message=(
            f'Hi,\n\n'
            f'Your driver {driver_name} is on the way with order {order_number}.\n\n'
            f'DELIVERY CODE: {otp_code}\n\n'
            f'Give this 6-digit code to your driver when they arrive to confirm receipt.\n'
            f'The code expires in 24 hours.\n\n'
            f'— AquaTrack'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=True,
    )


def notify_driver_assigned(driver, order, delivery, scheduled_date, scheduled_time_slot):
    """
    Called when a client admin assigns a driver to an order.
    Notifies the customer (driver assigned) and the driver (new delivery).
    OTP is NOT sent here — it's sent when the driver accepts the delivery.
    """
    import logging
    logging.getLogger(__name__).info(
        "DRIVER ASSIGNED | driver=%s | order=%s | date=%s | slot=%s",
        getattr(driver, 'email', str(driver)),
        order.order_number,
        scheduled_date,
        scheduled_time_slot,
    )
    notify.driver_assigned(order, driver)           # → customer
    notify.delivery_assigned_driver(delivery)       # → driver


# ─── PERMISSIONS ──────────────────────────────────────────────────────────────

class IsDriver(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == 'driver'
        )


class IsClientStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'site_manager')
            and request.user.client_id is not None
        )


class IsCustomer(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, 'customer')
        )


class DriverCustomerSearchView(APIView):
    """GET /api/driver/customers/search/?q=john"""
    permission_classes = [IsDriver]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response([])

        from apps.customers.models import Customer
        customers = Customer.objects.filter(
            client=request.user.client,
            is_active=True,
        ).filter(
            Q(full_name__icontains=q) |
            Q(phone_number__icontains=q) |
            Q(email__icontains=q)
        ).values(
            'id', 'full_name', 'phone_number', 'email',
        )[:10]

        return Response([
            {
                'id':    str(c['id']),
                'name':  c['full_name'],
                'phone': c['phone_number'] or '',
                'email': c['email'] or '',
            }
            for c in customers
        ])

# ─── CUSTOMER VIEWS ─────────────────────────────────────────────────────────


class DriverCustomerListView(APIView):
    """GET /api/driver/customers/ — list all customers for this driver's client"""
    permission_classes = [IsDriver]

    def get(self, request):
        from apps.customers.models import Customer
        customers = Customer.objects.filter(
            client=request.user.client,
            status='ACTIVE',
        ).values('id', 'full_name', 'phone_number', 'email').order_by('full_name')

        return Response([
            {
                'id':    str(c['id']),
                'name':  c['full_name'],
                'phone': c['phone_number'] or '',
                'email': c['email'] or '',
            }
            for c in customers
        ])


class DriverCustomerDetailView(APIView):
    """GET /api/driver/customers/<uuid:customer_id>/"""
    permission_classes = [IsDriver]

    def get(self, request, customer_id):
        from apps.customers.models import Customer
        from apps.customers.invoice_models import CreditTerms

        try:
            customer = Customer.objects.get(
                id=customer_id,
                client=request.user.client,
                status='ACTIVE',
            )
        except Customer.DoesNotExist:
            return Response({'error': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

        credit_terms = None
        try:
            ct = customer.credit_terms
            credit_terms = {
                'account_frozen':        ct.account_frozen,
                'is_in_grace_period':    ct.is_in_grace_period,
                'grace_days_remaining':  ct.grace_days_remaining,
                'billing_cycle_display': ct.get_billing_cycle_display(),
                'available_credit':      str(ct.available_credit),
            }
        except CreditTerms.DoesNotExist:
            pass  # credit_terms stays None → frontend hides Credit option

        return Response({
            'id':           str(customer.id),
            'name':         customer.full_name,
            'phone':        customer.phone_number or '',
            'email':        customer.email or '',
            'credit_terms': credit_terms,
        })

# ─── DRIVER VIEWS ─────────────────────────────────────────────────────────────


class DriverDeliveryListView(APIView):
    """GET /api/driver/deliveries/"""
    permission_classes = [IsDriver]
    TERMINAL_STATUSES = ('COMPLETED', 'FAILED', 'REJECTED')

    def get(self, request):
        date_str = request.query_params.get('date')
        filter_date = parse_date(
            date_str) if date_str else None

        base_qs = Delivery.objects.filter(
            driver=request.user,
        ).select_related(
            'order', 'order__customer',
            'order__delivery', 'order__delivery__delivery_address',
        ).prefetch_related('order__items')

        active_qs = base_qs.exclude(status__in=self.TERMINAL_STATUSES)
        if filter_date:
            terminal_qs = base_qs.filter(
                status__in=self.TERMINAL_STATUSES
            ).filter(
                models.Q(scheduled_date=filter_date) |
                models.Q(scheduled_date__isnull=True,
                         order__delivery__scheduled_date=filter_date)
            )
        else:
            terminal_qs = base_qs.filter(status__in=self.TERMINAL_STATUSES)

        status_filter = request.query_params.get('status')
        if status_filter:
            active_qs = active_qs.filter(status=status_filter)
            terminal_qs = terminal_qs.filter(status=status_filter)

        deliveries = (
            list(active_qs.order_by('order__delivery__scheduled_time_slot')) +
            list(terminal_qs.order_by('order__delivery__scheduled_time_slot'))
        )

        return Response({
            'date':       filter_date,
            'count':      len(deliveries),
            'deliveries': DriverDeliveryListSerializer(deliveries, many=True).data,
        })


class DriverDeliveryDetailView(APIView):
    """GET /api/driver/deliveries/{id}/"""
    permission_classes = [IsDriver]

    def get(self, request, delivery_id):
        try:
            delivery = Delivery.objects.select_related(
                'order', 'order__customer', 'order__delivery',
                'order__delivery__delivery_address', 'order__bottle_exchange',
            ).prefetch_related('order__items').get(
                id=delivery_id, driver=request.user)
        except Delivery.DoesNotExist:
            return Response({'error': 'Delivery not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response(DriverDeliveryDetailSerializer(delivery).data)


class DriverAcceptDeliveryView(APIView):
    """
    POST /api/driver/deliveries/{id}/accept/

    Accept or decline a delivery. Does NOT complete it.

    Body:
        { "accepted": true,  "reason": "" }   — accept
        { "accepted": false, "reason": "Vehicle breakdown" }  — decline

    ACCEPT  (ASSIGNED → ACCEPTED):
      • Stamps accepted_at
      • Generates 6-digit OTP and sends it to the customer via email
        + in-app notification. This is the correct moment — the driver
        has personally confirmed they're taking the run.

    DECLINE (ASSIGNED → unassigned):
      • Clears driver, vehicle_number, assigned_at from the Delivery record
      • Resets Delivery status to a sentinel so dispatchers know it needs
        reassignment — we delete the Delivery row and reset the Order back
        to CONFIRMED so it reappears in the unassigned queue.
      • Notifies the client admin that the driver declined.
    """
    permission_classes = [IsDriver]

    def post(self, request, delivery_id):
        try:
            delivery = Delivery.objects.select_related(
                'order', 'order__customer',
            ).get(id=delivery_id, driver=request.user)
        except Delivery.DoesNotExist:
            return Response(
                {'error': 'Delivery not found.'},
                status=status.HTTP_404_NOT_FOUND)

        if delivery.status != 'ASSIGNED':
            return Response(
                {'error': f'Only ASSIGNED deliveries can be accepted or declined. Current status: {delivery.status}.'},
                status=status.HTTP_400_BAD_REQUEST)

        accepted = request.data.get('accepted', True)
        reason = str(request.data.get('reason', '')).strip()

        # ── DECLINE ──────────────────────────────────────────────────────────
        if not accepted:
            order = delivery.order
            driver = delivery.driver  # still set at this point
            driver_name = _user_display_name(driver)
            order_number = order.order_number

            # Delete the Delivery tracking row so the order is fully unassigned
            delivery.delete()

            # Reset order status back to CONFIRMED so it shows in the
            # unassigned queue for the client admin to reassign
            if order.status == 'ASSIGNED':
                order.status = 'CONFIRMED'
                order.save(update_fields=['status'])

            # Also clear assigned_driver on OrderDelivery if present
            try:
                od = order.delivery
                if od.assigned_driver == driver:
                    od.assigned_driver = None
                    od.assigned_at = None
                    update_fields = ['assigned_driver', 'assigned_at']
                    if hasattr(od, 'driver_name'):
                        od.driver_name = ''
                        update_fields.append('driver_name')
                    if hasattr(od, 'driver_phone'):
                        od.driver_phone = ''
                        update_fields.append('driver_phone')
                    od.save(update_fields=update_fields)
            except Exception:
                pass

            # Notify client admin the driver declined
            try:
                notify.delivery_failed_by_driver(
                    order=order,
                    driver=driver,
                    reason=reason or 'Driver declined the delivery',
                )
            except Exception:
                pass

            import logging
            logging.getLogger(__name__).info(
                "DELIVERY DECLINED | driver=%s | order=%s | reason=%s",
                getattr(driver, 'email', str(driver)),
                order_number,
                reason or '—',
            )

            return Response({
                'message': (
                    f'Delivery declined. Order {order_number} has been returned '
                    f'to the queue for reassignment.'
                ),
                'order_number': order_number,
                'reason':       reason,
            })

        # ── ACCEPT ───────────────────────────────────────────────────────────
        delivery.status = 'ACCEPTED'
        delivery.accepted_at = timezone.now()
        delivery.save(update_fields=['status', 'accepted_at'])

        # Generate OTP and send to customer — fires here, NOT on assignment
        try:
            generate_delivery_otp(delivery, delivery.order)
        except Exception:
            import logging
            logging.getLogger(__name__).warning(
                "OTP generation failed on accept for delivery %s", delivery_id)

        # ── Check driver has enough van stock for this delivery ──────────────
        try:
            from apps.deliveries.driver_store_views import (
                _compute_bottle_balance, _compute_consumable_balance,
            )
            from apps.notifications import notify as _notify

            missing_items = []
            order = delivery.order
            for item in order.items.select_related('product').all():
                product = getattr(item, 'product', None)
                if not product:
                    continue
                needed = getattr(item, 'quantity', 0) or 0
                if needed < 1:
                    continue

                if getattr(product, 'is_returnable', False):
                    available = _compute_bottle_balance(
                        request.user, product)['full']
                else:
                    available = _compute_consumable_balance(
                        request.user, product)['in_stock']

                if available < needed:
                    missing_items.append({
                        'product_name': product.name,
                        'needed':       needed,
                        'available':    available,
                    })

            if missing_items:
                _notify.driver_insufficient_stock_for_delivery(
                    driver=request.user,
                    order=order,
                    missing_items=missing_items,
                    client=order.client,
                )
        except Exception:
            pass  # non-fatal — acceptance already saved

        return Response({
            'message':     'Delivery accepted. The customer has been sent their verification code.',
            'status':      delivery.status,
            'accepted_at': delivery.accepted_at,
        })


class DriverUpdateLocationView(APIView):
    """POST /api/driver/deliveries/{id}/location/"""
    permission_classes = [IsDriver]

    def post(self, request, delivery_id):
        try:
            delivery = Delivery.objects.get(
                id=delivery_id, driver=request.user)
        except Delivery.DoesNotExist:
            return Response({'error': 'Delivery not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = DriverLocationUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        delivery.update_location(
            serializer.validated_data['latitude'],
            serializer.validated_data['longitude'],
        )
        return Response({'message': 'Location updated', 'timestamp': delivery.last_location_update})


class DriverUpdateStatusView(APIView):
    """
    PATCH /api/driver/deliveries/{id}/status/

    Advances the delivery through the status pipeline:
    ACCEPTED → PICKED_UP → EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED
    """
    permission_classes = [IsDriver]

    TRANSITIONS = {
        'ASSIGNED':    ['ACCEPTED', 'REJECTED'],
        'ACCEPTED':    ['PICKED_UP', 'FAILED'],
        'PICKED_UP':   ['EN_ROUTE', 'FAILED'],
        'EN_ROUTE':    ['ARRIVED', 'FAILED'],
        'ARRIVED':     ['IN_PROGRESS', 'FAILED'],
        'IN_PROGRESS': ['COMPLETED', 'FAILED'],
    }

    TIMESTAMP_MAP = {
        'ACCEPTED':    'accepted_at',
        'PICKED_UP':   'picked_up_at',
        'EN_ROUTE':    'started_at',
        'ARRIVED':     'arrived_at',
        'IN_PROGRESS': 'arrived_at',
        'COMPLETED':   'completed_at',
    }

    def patch(self, request, delivery_id):
        try:
            delivery = Delivery.objects.get(
                id=delivery_id, driver=request.user)
        except Delivery.DoesNotExist:
            return Response({'error': 'Delivery not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = DriverStatusUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        new_status = data['status']
        current = delivery.status
        allowed = self.TRANSITIONS.get(current, [])

        if new_status not in allowed:
            return Response(
                {'error': f'Cannot transition from {current} to {new_status}. Allowed: {allowed}'},
                status=status.HTTP_400_BAD_REQUEST)

        # If driver is accepting via status patch (fallback), also send OTP
        if new_status == 'ACCEPTED' and current == 'ASSIGNED':
            delivery.status = 'ACCEPTED'
            delivery.accepted_at = timezone.now()
            delivery.save(update_fields=['status', 'accepted_at'])
            try:
                generate_delivery_otp(delivery, delivery.order)
            except Exception:
                pass
            return Response({
                'message':   'Status updated to Accepted',
                'status':    delivery.status,
                'timestamp': delivery.accepted_at,
            })

        delivery.status = new_status
        ts_field = self.TIMESTAMP_MAP.get(new_status)
        if ts_field:
            setattr(delivery, ts_field, timezone.now())

        if new_status == 'FAILED':
            delivery.failure_reason = data.get('failure_reason', '')
            delivery.failure_notes = data.get('failure_notes', '')
            delivery.has_issues = True

        if data.get('driver_notes'):
            delivery.driver_notes = data['driver_notes']

        delivery.save()

        if new_status == 'COMPLETED':
            notify.order_delivered(delivery.order)      # → customer
            notify.delivery_completed(delivery)         # → client admin
        elif new_status == 'FAILED':
            notify.delivery_failed(delivery)            # → client admin

        return Response({
            'message':   f'Status updated to {delivery.get_status_display()}',
            'status':    delivery.status,
            'timestamp': getattr(delivery, ts_field) if ts_field else timezone.now(),
        })


class DriverVerifyOTPView(APIView):
    """POST /api/driver/deliveries/{id}/verify-otp/"""
    permission_classes = [IsDriver]

    def post(self, request, delivery_id):
        try:
            delivery = Delivery.objects.select_related(
                'otp', 'order__customer',
            ).get(id=delivery_id, driver=request.user)
        except Delivery.DoesNotExist:
            return Response(
                {'error': 'Delivery not found'},
                status=status.HTTP_404_NOT_FOUND)

        if delivery.status not in ('ACCEPTED', 'PICKED_UP', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'):
            return Response(
                {'error': 'Delivery is not in a verifiable state.'},
                status=status.HTTP_400_BAD_REQUEST)

        otp_input = str(request.data.get('otp_code', '')).strip()
        if not otp_input:
            return Response(
                {'error': 'otp_code is required.'},
                status=status.HTTP_400_BAD_REQUEST)

        try:
            otp = delivery.otp
        except DeliveryOTP.DoesNotExist:
            return Response({'message': 'No OTP required for this delivery.', 'verified': True})

        if otp.is_verified:
            return Response({'message': 'OTP already verified.', 'verified': True})

        if otp.is_expired:
            return Response(
                {'error': 'This OTP has expired. Contact your dispatcher.'},
                status=status.HTTP_400_BAD_REQUEST)

        if otp.otp_code != otp_input:
            return Response(
                {'error': 'Incorrect code. Please ask the customer to check again.'},
                status=status.HTTP_400_BAD_REQUEST)

        # ── Verify this OTP ───────────────────────────────────────────────────
        now = timezone.now()
        otp.is_verified = True
        otp.verified_at = now
        otp.save(update_fields=['is_verified', 'verified_at'])

        # ── Also verify all sibling deliveries for the same customer ──────────
        # (same driver, same customer, same shared code, not yet verified)
        sibling_otps = DeliveryOTP.objects.filter(
            delivery__driver=request.user,
            delivery__order__customer=delivery.order.customer,
            otp_code=otp_input,
            is_verified=False,
        ).exclude(delivery_id=delivery_id)

        verified_siblings = 0
        for sibling_otp in sibling_otps:
            if not sibling_otp.is_expired:
                sibling_otp.is_verified = True
                sibling_otp.verified_at = now
                sibling_otp.save(update_fields=['is_verified', 'verified_at'])
                verified_siblings += 1

        msg = 'Code verified successfully.'
        if verified_siblings:
            msg += f' {verified_siblings} other delivery{"" if verified_siblings == 1 else "ies"} for this customer also verified.'

        return Response({'message': msg, 'verified': True, 'siblings_verified': verified_siblings})


class DriverResendOTPView(APIView):
    """POST /api/driver/deliveries/{id}/resend-otp/"""
    permission_classes = [IsDriver]

    def post(self, request, delivery_id):
        try:
            delivery = Delivery.objects.select_related(
                'order', 'order__customer',
            ).get(id=delivery_id, driver=request.user)
        except Delivery.DoesNotExist:
            return Response(
                {'error': 'Delivery not found'},
                status=status.HTTP_404_NOT_FOUND)

        if delivery.status not in ('ACCEPTED', 'PICKED_UP', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'):
            return Response(
                {'error': 'Delivery is not in an active state.'},
                status=status.HTTP_400_BAD_REQUEST)

        try:
            generate_delivery_otp(delivery, delivery.order)
            return Response({'message': 'A new code has been sent to the customer.'})
        except Exception:
            return Response(
                {'error': 'Could not send code — please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DriverCompleteDeliveryView(APIView):
    """
    POST /api/driver/deliveries/{id}/complete/

    Accepts a delivery in ANY active status and auto-advances it to
    COMPLETED, stamping intermediate timestamps along the way.

    New fields in request body
    --------------------------
    delivered_items : list of { order_item_id, qty_delivered }
        Per-item quantities actually handed to the customer.
        When any item's qty_delivered < ordered quantity the system:
          • Deducts the shortfall × unit_price from the invoice
          • Reduces Order.total_amount to match
          • Writes a structured note on Invoice.notes
          • Creates an OrderTimeline entry explaining each line
          • Includes a `delivery_adjustment` block in the response

    Legacy behaviour (no delivered_items supplied)
    -----------------------------------------------
    Falls back to the old bottles_delivered / bottles_collected totals.
    Backward-compatible with older app versions.
    """

    permission_classes = [IsDriver]

    _ADVANCE = {
        'ASSIGNED':    ('accepted_at',  'ACCEPTED'),
        'ACCEPTED':    ('picked_up_at', 'PICKED_UP'),
        'PICKED_UP':   ('started_at',   'EN_ROUTE'),
        'EN_ROUTE':    ('arrived_at',   'ARRIVED'),
        'ARRIVED':     ('arrived_at',   'IN_PROGRESS'),
        'IN_PROGRESS': None,
    }

    def post(self, request, delivery_id):
        try:
            delivery = Delivery.objects.select_related(
                'order', 'order__bottle_exchange', 'otp',
            ).get(id=delivery_id, driver=request.user)
        except Delivery.DoesNotExist:
            return Response(
                {'error': 'Delivery not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if delivery.status in ('COMPLETED', 'FAILED', 'REJECTED'):
            return Response(
                {'error': f'Delivery is already {delivery.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Auto-advance to IN_PROGRESS ───────────────────────────────────────
        now = timezone.now()
        while delivery.status != 'IN_PROGRESS':
            step = self._ADVANCE.get(delivery.status)
            if step is None:
                break
            ts_field, next_status = step
            if not getattr(delivery, ts_field):
                setattr(delivery, ts_field, now)
            delivery.status = next_status
        delivery.save()

        # ── OTP gate ──────────────────────────────────────────────────────────
        order_requires_otp = getattr(delivery.order, 'require_otp', True)
        if order_requires_otp:
            try:
                if not delivery.otp.is_verified:
                    return Response(
                        {
                            'error': 'Please verify the customer code first.',
                            'requires_otp': True,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except DeliveryOTP.DoesNotExist:
                pass

        # ── Validate completion payload ────────────────────────────────────────
        serializer = DriverCompleteDeliverySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # ── Mark COMPLETED ────────────────────────────────────────────────────
        delivery.status = 'COMPLETED'
        delivery.completed_at = now
        delivery.customer_name_confirmed = data.get(
            'customer_name_confirmed', '')
        if data.get('signature_image'):
            delivery.signature_image = data['signature_image']
        if data.get('photo_proof'):
            delivery.photo_proof = data['photo_proof']
        if data.get('driver_notes'):
            delivery.driver_notes = data['driver_notes']
        if data.get('customer_rating'):
            delivery.customer_rating = data['customer_rating']
        if data.get('customer_feedback'):
            delivery.customer_feedback = data['customer_feedback']
        delivery.save()

        # ── Bottle exchange ───────────────────────────────────────────────────
        if (
            delivery.order.bottle_exchange
            and data.get('bottles_delivered') is not None
        ):
            exchange = delivery.order.bottle_exchange
            exchange.bottles_delivered = data['bottles_delivered']
            exchange.bottles_collected = data.get('bottles_collected', 0)
            exchange.exchange_confirmed = True
            exchange.save()

            bottles_collected = data.get('bottles_collected', 0)
            if bottles_collected and bottles_collected > 0:
                try:
                    from apps.products.models import BottleMovement
                    for item in delivery.order.items.select_related('product').all():
                        product = getattr(item, 'product', None)
                        if product and getattr(product, 'is_returnable', False):
                            bottles_delivered_count = data.get(
                                'bottles_delivered', 0)
                            BottleMovement.objects.create(
                                product=product,
                                driver=request.user,
                                movement_type='RECEIVE_EMPTY',
                                qty_expected=bottles_delivered_count,
                                qty_good=bottles_collected,
                                qty_damaged=0,
                                qty_missing=max(
                                    0, bottles_delivered_count - bottles_collected),
                                notes=(
                                    f'Empties collected on delivery completion '
                                    f'(order {delivery.order.order_number})'
                                ),
                            )
                            break
                except Exception:
                    import logging
                    logging.getLogger(__name__).warning(
                        'RECEIVE_EMPTY movement failed for delivery %s', delivery_id)

        # ── Partial delivery adjustment ───────────────────────────────────────
        #
        # Strategy:
        #   1. If the driver supplied per-item `delivered_items[]`, use those.
        #   2. Else if legacy `bottles_delivered` < `bottles_to_deliver`, infer
        #      the shortfall across the first returnable item (old app compat).
        #   3. Otherwise no adjustment needed.
        #
        adjustment_result = None
        delivered_items = data.get('delivered_items') or []

        if not delivered_items:
            # ── Legacy fallback: infer from bottle totals ──────────────────
            delivered_items = _infer_delivered_items_from_totals(
                delivery.order, data
            )

        if delivered_items:
            adjustment_result = apply_partial_delivery_adjustment(
                delivery=delivery,
                order=delivery.order,
                delivered_items=delivered_items,
            )

        # ── Bottle exchange notification ───────────────────────────────────────
        try:
            exchange = delivery.order.bottle_exchange
            from apps.notifications import notify as _notify
            _notify.bottle_exchange_completed(
                delivery=delivery,
                bottles_delivered=exchange.bottles_delivered,
                bottles_collected=exchange.bottles_collected,
                client=delivery.order.client,
            )
        except Exception:
            pass

        # ── Stock deduction ───────────────────────────────────────────────────
        try:
            from apps.deliveries.driver_store_views import _deduct_delivery_stock
            _deduct_delivery_stock(request.user, delivery.order)
        except Exception:
            import logging
            logging.getLogger(__name__).warning(
                'Stock deduction failed after completing delivery %s', delivery_id)

        # ── Customer / admin notifications ────────────────────────────────────
        notify.order_delivered(delivery.order)
        notify.delivery_completed(delivery)

        # ── Payment collection recording ──────────────────────────────────────
        amount_collected = data.get('amount_collected') or Decimal('0.00')
        if amount_collected > Decimal('0.00'):
            try:
                from decimal import Decimal as _D
                from apps.invoices.models import Invoice
                from apps.invoices.signals import _recompute_outstanding

                invoice = Invoice.objects.filter(
                    order=delivery.order,
                    status__in=['ISSUED', 'OVERDUE'],
                ).first()

                if invoice:
                    collected = _D(str(amount_collected))
                    invoice.amount_paid = min(
                        invoice.total_amount,
                        invoice.amount_paid + collected,
                    )
                    invoice.amount_due = max(
                        _D('0.00'),
                        invoice.total_amount - invoice.amount_paid,
                    )
                    invoice.payment_method = data.get(
                        'payment_method_collected', 'CASH')
                    if invoice.amount_due == _D('0.00'):
                        invoice.status = 'PAID'
                        invoice.paid_at = now
                    invoice.save(update_fields=[
                        'amount_paid', 'amount_due', 'status',
                        'payment_method', 'paid_at', 'updated_at',
                    ])
                    _recompute_outstanding(delivery.order.customer)
            except Exception:
                import logging
                logging.getLogger(__name__).warning(
                    'Payment collection recording failed for delivery %s', delivery_id)

        # ── Build response ────────────────────────────────────────────────────
        response_data: dict = {
            'message':      'Delivery completed successfully.',
            'completed_at': delivery.completed_at,
        }

        if adjustment_result and adjustment_result.had_shortfall:
            response_data['delivery_adjustment'] = {
                'applied':           True,
                'original_amount':   float(adjustment_result.original_amount),
                'total_deducted':    float(adjustment_result.total_deducted),
                'adjusted_amount':   float(adjustment_result.adjusted_amount),
                'invoice_number':    adjustment_result.invoice_number,
                'lines': [
                    {
                        'product_name':  ln.product_name,
                        'ordered_qty':   ln.ordered_qty,
                        'delivered_qty': ln.delivered_qty,
                        'shortfall_qty': ln.shortfall_qty,
                        'unit_price':    float(ln.unit_price),
                        'deducted_amt':  float(ln.deducted_amt),
                        'reason':        ln.reason,
                    }
                    for ln in adjustment_result.lines
                ],
            }
        else:
            response_data['delivery_adjustment'] = {'applied': False}

        return Response(response_data)


# ── Helper: infer delivered_items from legacy bottle totals ───────────────────

def _infer_delivered_items_from_totals(order, data: dict) -> list[dict]:
    """
    Old app versions don't send delivered_items[]. They send a single
    `bottles_delivered` integer for the whole order.

    If bottles_delivered < bottles_to_deliver, we distribute the shortfall
    proportionally across returnable order items so the adjustment logic
    can still run.

    Returns an empty list if there is no shortfall (no adjustment needed).
    """
    try:
        exchange = order.bottle_exchange
        expected = exchange.bottles_to_deliver or 0
        delivered = data.get('bottles_delivered')

        if delivered is None or delivered >= expected:
            return []  # no shortfall

        shortfall = expected - delivered
        items = list(
            order.items.select_related('product')
            .filter(product__is_returnable=True)
            .order_by('id')
        )

        if not items:
            return []

        # Distribute shortfall largest-first
        result = []
        remaining_shortfall = shortfall

        for item in items:
            if remaining_shortfall <= 0:
                result.append({
                    'order_item_id': str(item.id),
                    'qty_delivered':  item.quantity,  # fully delivered
                })
                continue

            item_shortfall = min(remaining_shortfall, item.quantity)
            qty_delivered = item.quantity - item_shortfall
            remaining_shortfall -= item_shortfall

            result.append({
                'order_item_id': str(item.id),
                'qty_delivered':  qty_delivered,
            })

        return result

    except Exception:
        return []


# ─── CLIENT VIEWS ─────────────────────────────────────────────────────────────

class ClientDeliveryListView(APIView):
    """GET /api/client/deliveries/"""
    permission_classes = [IsClientStaff]

    def get(self, request):
        client = request.user.client
        deliveries = Delivery.objects.filter(
            order__client=client,
        ).select_related('order', 'order__customer', 'order__delivery', 'driver')

        status_filter = request.query_params.get('status')
        if status_filter and status_filter != 'all':
            deliveries = deliveries.filter(status=status_filter)

        driver_id = request.query_params.get('driver_id')
        if driver_id:
            deliveries = deliveries.filter(driver_id=driver_id)

        date_from = request.query_params.get('date_from')
        if date_from:
            deliveries = deliveries.filter(
                order__delivery__scheduled_date__gte=date_from)

        date_to = request.query_params.get('date_to')
        if date_to:
            deliveries = deliveries.filter(
                order__delivery__scheduled_date__lte=date_to)

        search = request.query_params.get('search')
        if search:
            deliveries = deliveries.filter(
                Q(order__order_number__icontains=search) |
                Q(order__customer__full_name__icontains=search) |
                Q(order__customer__phone_number__icontains=search)
            )

        page = int(request.query_params.get('page', 1))
        limit = min(int(request.query_params.get('limit', 20)), 100)
        offset = (page - 1) * limit
        total = deliveries.count()
        page_qs = deliveries.order_by(
            '-order__delivery__scheduled_date',
            'order__delivery__scheduled_time_slot',
        )[offset:offset + limit]

        return Response({
            'data':        ClientDeliveryListSerializer(page_qs, many=True).data,
            'total':       total,
            'page':        page,
            'limit':       limit,
            'total_pages': (total + limit - 1) // limit,
        })


class ClientDeliveryDetailView(APIView):
    """GET /api/client/deliveries/{id}/"""
    permission_classes = [IsClientStaff]

    def get(self, request, delivery_id):
        try:
            delivery = Delivery.objects.select_related(
                'order', 'order__customer', 'order__delivery',
                'order__delivery__delivery_address',
                'order__bottle_exchange', 'driver',
            ).prefetch_related('order__items').get(
                id=delivery_id, order__client=request.user.client)
        except Delivery.DoesNotExist:
            return Response({'error': 'Delivery not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response(ClientDeliveryDetailSerializer(delivery).data)


class ClientDeliveryStatsView(APIView):
    """GET /api/client/deliveries/stats/"""
    permission_classes = [IsClientStaff]

    def get(self, request):
        client = request.user.client
        today = timezone.now().date()
        today_qs = Delivery.objects.filter(
            order__client=client,
            order__delivery__scheduled_date=today,
        )

        total_today = today_qs.count()
        completed_today = today_qs.filter(status='COMPLETED').count()
        failed_today = today_qs.filter(status='FAILED').count()
        in_progress = today_qs.filter(
            status__in=['ACCEPTED', 'PICKED_UP',
                        'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS']
        ).count()
        active_drivers = User.objects.filter(
            role='driver', client=client, is_active=True).count()

        completed_timed = today_qs.filter(
            status='COMPLETED', completed_at__isnull=False, assigned_at__isnull=False)
        avg_time = 0
        if completed_timed.exists():
            total_minutes = sum(
                (d.completed_at - d.assigned_at).total_seconds() / 60
                for d in completed_timed)
            avg_time = total_minutes / completed_timed.count()

        revenue_today = today_qs.filter(status='COMPLETED').aggregate(
            total=Sum('order__total_amount'))['total'] or 0
        status_breakdown = dict(today_qs.values_list(
            'status').annotate(count=Count('id')))

        return Response(ClientDeliveryStatsSerializer({
            'total_today':       total_today,
            'completed_today':   completed_today,
            'in_progress':       in_progress,
            'failed_today':      failed_today,
            'active_drivers':    active_drivers,
            'avg_delivery_time': round(avg_time, 1),
            'revenue_today':     revenue_today,
            'status_breakdown':  status_breakdown,
        }).data)


class ClientAssignDriverView(APIView):
    """POST /api/client/deliveries/assign/"""
    permission_classes = [IsClientStaff]

    def post(self, request):
        serializer = DriverAssignmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        delivery_ids = data['delivery_ids']
        driver_id = data['driver_id']

        try:
            driver = User.objects.get(
                id=driver_id, role='driver', client=request.user.client, is_active=True)
        except User.DoesNotExist:
            return Response({'error': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        deliveries = Delivery.objects.filter(
            id__in=delivery_ids,
            order__client=request.user.client,
            status__in=['ASSIGNED', 'REJECTED'],
        )
        if not deliveries.exists():
            return Response({'error': 'No assignable deliveries found'}, status=status.HTTP_400_BAD_REQUEST)

        updated = deliveries.update(
            driver=driver,
            status='ASSIGNED',
            assigned_at=timezone.now(),
            vehicle_number=getattr(driver, 'vehicle_number', '') or '',
        )
        return Response({
            'message':        f'{updated} deliveries assigned to {_user_display_name(driver)}',
            'assigned_count': updated,
        })


class ClientAvailableDriversView(APIView):
    """GET /api/client/drivers/available/"""
    permission_classes = [IsClientStaff]

    def get(self, request):
        drivers = User.objects.filter(
            role='driver', client=request.user.client, is_active=True,
        ).values('id', 'email', 'first_name', 'last_name', 'phone', 'vehicle_number')

        today = timezone.now().date()
        result = []
        for d in drivers:
            today_qs = Delivery.objects.filter(
                driver_id=d['id'], order__delivery__scheduled_date=today)
            result.append({
                'id':              str(d['id']),
                'name':            f"{d.get('first_name', '')} {d.get('last_name', '')}".strip(),
                'email':           d['email'],
                'phone':           d.get('phone', '') or '',
                'vehicle_number':  d.get('vehicle_number', '') or '',
                'today_assigned':  today_qs.count(),
                'today_completed': today_qs.filter(status='COMPLETED').count(),
            })
        result.sort(key=lambda x: x['today_assigned'])
        return Response(result)


class ClientAssignOrderView(APIView):
    """
    POST /api/client/orders/assign/

    Assigns orders to a driver, creates Delivery tracking records.
    Does NOT generate the OTP here — that happens when the driver accepts.
    Sends notifications: customer (driver assigned) + driver (new delivery).
    """
    permission_classes = [IsClientStaff]

    def post(self, request):
        order_ids = request.data.get('order_ids', [])
        driver_id = request.data.get('driver_id')
        req_date = request.data.get('scheduled_date')
        req_timeslot = request.data.get('scheduled_time_slot')

        if not order_ids:
            return Response({'error': 'order_ids is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not driver_id:
            return Response({'error': 'driver_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        parsed_date = None
        if req_date:
            parsed_date = parse_date(str(req_date))
            if not parsed_date:
                return Response(
                    {'error': 'Invalid scheduled_date. Use YYYY-MM-DD.'},
                    status=status.HTTP_400_BAD_REQUEST)

        try:
            driver = User.objects.get(
                id=driver_id, role='driver', client=request.user.client, is_active=True)
        except User.DoesNotExist:
            return Response({'error': 'Driver not found or not active.'}, status=status.HTTP_404_NOT_FOUND)

        orders = Order.objects.filter(
            id__in=order_ids,
            client=request.user.client,
            status__in=['PENDING', 'CONFIRMED', 'ASSIGNED'],
        ).select_related('delivery', 'delivery_tracking')

        if not orders.exists():
            return Response(
                {'error': 'No assignable orders found. Orders must be PENDING, CONFIRMED, or ASSIGNED.'},
                status=status.HTTP_400_BAD_REQUEST)

        vehicle_number = getattr(driver, 'vehicle_number', '') or ''
        driver_name = _user_display_name(driver)
        driver_phone = getattr(driver, 'phone_number',
                               '') or getattr(driver, 'phone', '')
        assigned_ids = []
        response_date = parsed_date
        response_slot = req_timeslot

        for order in orders:
            order_date = None
            order_slot = ''
            try:
                od = order.delivery
                order_date = od.scheduled_date
                order_slot = od.scheduled_time_slot or ''
            except Exception:
                pass

            effective_date = parsed_date or order_date or timezone.now().date()
            effective_slot = req_timeslot or order_slot or ''

            if not response_date:
                response_date = effective_date
            if not response_slot:
                response_slot = effective_slot

            # Create or update Delivery tracking record
            try:
                delivery = order.delivery_tracking
                delivery.driver = driver
                delivery.status = 'ASSIGNED'
                delivery.vehicle_number = vehicle_number
                delivery.scheduled_date = effective_date
                delivery.scheduled_time_slot = effective_slot
                delivery.assigned_at = timezone.now()
                delivery.save(update_fields=[
                    'driver', 'status', 'vehicle_number',
                    'scheduled_date', 'scheduled_time_slot', 'assigned_at',
                ])
            except Delivery.DoesNotExist:
                delivery = Delivery.objects.create(
                    order=order,
                    driver=driver,
                    status='ASSIGNED',
                    vehicle_number=vehicle_number,
                    scheduled_date=effective_date,
                    scheduled_time_slot=effective_slot,
                    assigned_at=timezone.now(),
                )

            # Update OrderDelivery record
            try:
                od = order.delivery
                od.assigned_driver = driver
                od.assigned_at = timezone.now()
                update_fields = ['assigned_driver', 'assigned_at']
                if hasattr(od, 'driver_name'):
                    od.driver_name = driver_name
                    update_fields.append('driver_name')
                if hasattr(od, 'driver_phone'):
                    od.driver_phone = driver_phone
                    update_fields.append('driver_phone')
                if parsed_date:
                    od.scheduled_date = parsed_date
                    update_fields.append('scheduled_date')
                if req_timeslot:
                    od.scheduled_time_slot = req_timeslot
                    update_fields.append('scheduled_time_slot')
                od.save(update_fields=update_fields)
            except Exception:
                pass

            if order.status != 'ASSIGNED':
                order.status = 'ASSIGNED'
                order.save(update_fields=['status'])

            # Notify customer (driver assigned) + driver (new delivery)
            # OTP is NOT sent here — it fires when driver hits /accept/
            try:
                notify_driver_assigned(
                    driver, order, delivery, effective_date, effective_slot)
            except Exception:
                pass

            assigned_ids.append(order.id)

        return Response({
            'message':             f'{len(assigned_ids)} order(s) assigned to {driver_name}.',
            'assigned_count':      len(assigned_ids),
            'scheduled_date':      str(response_date) if response_date else None,
            'scheduled_time_slot': response_slot,
            'driver': {
                'id':             str(driver.id),
                'name':           driver_name,
                'phone':          driver_phone,
                'vehicle_number': vehicle_number,
            },
        }, status=status.HTTP_200_OK)


# ─── CUSTOMER TRACKING ────────────────────────────────────────────────────────

class CustomerOrderTrackingView(APIView):
    """GET /api/customer/orders/{order_id}/track/"""
    from apps.customers.authentication import CustomerJWTAuthentication
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsCustomer]

    def get(self, request, order_id):
        try:
            order = Order.objects.select_related(
                'delivery', 'delivery__delivery_address',
                'delivery_tracking', 'delivery_tracking__driver',
            ).prefetch_related('items').get(
                id=order_id, customer=request.user.customer)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        tracking = getattr(order, 'delivery_tracking', None)

        delivery_address = address_label = scheduled_date = scheduled_slot = None
        try:
            od = order.delivery
            scheduled_date = str(
                od.scheduled_date) if od.scheduled_date else None
            scheduled_slot = od.scheduled_time_slot or None
            addr = od.delivery_address
            delivery_address = (
                getattr(addr, 'address', None) or
                getattr(addr, 'full_address', None) or str(addr)
            )
            address_label = getattr(addr, 'label', '') or ''
        except Exception:
            pass

        driver_data = otp_code = None
        if tracking and tracking.driver:
            d = tracking.driver
            driver_data = {
                'name':           _user_display_name(d),
                'phone':          getattr(d, 'phone_number', '') or getattr(d, 'phone', ''),
                'vehicle_number': tracking.vehicle_number or '',
            }
            try:
                otp = tracking.otp
                if not otp.is_verified and not otp.is_expired:
                    otp_code = otp.otp_code
            except DeliveryOTP.DoesNotExist:
                pass

        return Response({
            'order_id':            str(order.id),
            'order_number':        order.order_number,
            'status':              order.status,
            'status_display':      order.get_status_display(),
            'scheduled_date':      scheduled_date,
            'scheduled_time_slot': scheduled_slot,
            'delivery_address':    delivery_address,
            'address_label':       address_label,
            'estimated_arrival':   tracking.estimated_arrival if tracking else None,
            'driver':              driver_data,
            'otp_code':            otp_code,
            'timeline': {
                'order_placed':    order.created_at,
                'confirmed':       None,
                'driver_assigned': tracking.assigned_at if tracking else None,
                'picked_up':       tracking.picked_up_at if tracking else None,
                'in_transit':      tracking.started_at if tracking else None,
                'arrived':         tracking.arrived_at if tracking else None,
                'delivered':       tracking.completed_at if tracking else None,
            },
            'items_count':  order.items.count(),
            'total_amount': str(order.total_amount),
        })


# ─── DRIVER PROFILE ───────────────────────────────────────────────────────────

class DriverProfileView(APIView):
    """GET /api/driver/profile/"""
    permission_classes = [IsDriver]
    TERMINAL_STATUSES = ('COMPLETED', 'FAILED', 'REJECTED')

    def get(self, request):
        today = timezone.now().date()
        today_qs = Delivery.objects.filter(driver=request.user).filter(
            models.Q(scheduled_date=today) |
            models.Q(scheduled_date__isnull=True,
                     order__delivery__scheduled_date=today)
        )

        total_today = today_qs.count()
        completed_today = today_qs.filter(status='COMPLETED').count()
        failed_today = today_qs.filter(status='FAILED').count()
        in_progress = today_qs.filter(
            status__in=['ACCEPTED', 'PICKED_UP',
                        'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS']
        ).count()

        active = Delivery.objects.filter(
            driver=request.user,
        ).exclude(status__in=self.TERMINAL_STATUSES).select_related(
            'order__delivery__delivery_address', 'order__customer',
        ).order_by('order__delivery__scheduled_time_slot')

        next_delivery = None
        first = active.first()
        if first and first.order:
            order = first.order
            address_str = time_slot = None
            try:
                addr = order.delivery.delivery_address
                address_str = (
                    getattr(addr, 'full_address', None) or
                    getattr(addr, 'address', None) or
                    getattr(addr, 'street_address', None) or str(addr)
                )
            except Exception:
                pass
            try:
                time_slot = order.delivery.scheduled_time_slot
            except Exception:
                pass
            next_delivery = {
                'id':             first.id,
                'order_number':   order.order_number,
                'customer_name':  order.customer.full_name if order.customer else None,
                'address':        address_str,
                'scheduled_time': time_slot,
            }

        return Response({
            'driver': {
                'id':             request.user.id,
                'name':           _user_display_name(request.user),
                'email':          request.user.email,
                'phone':          getattr(request.user, 'phone_number', '') or getattr(request.user, 'phone', ''),
                'vehicle_number': getattr(request.user, 'vehicle_number', ''),
            },
            'today_stats': {
                'total':       total_today,
                'completed':   completed_today,
                'failed':      failed_today,
                'in_progress': in_progress,
                'pending':     total_today - completed_today - failed_today - in_progress,
            },
            'next_delivery': next_delivery,
            'current_time':  timezone.now(),
        })


# ─── PUBLIC TRACKING ──────────────────────────────────────────────────────────

class PublicTrackingView(APIView):
    """GET /api/track/{order_number}/ — no auth required"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, order_number):
        try:
            order = Order.objects.select_related(
                'customer', 'delivery', 'delivery__delivery_address',
            ).prefetch_related('items').get(order_number=order_number)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            delivery = Delivery.objects.select_related(
                'driver').get(order=order)
        except Delivery.DoesNotExist:
            delivery = None

        data = {
            'order_number':   order.order_number,
            'status':         order.status,
            'status_display': order.get_status_display(),
            'customer_name':  order.customer.full_name if order.customer else None,
            'timeline':       {},
            'driver':         None,
        }

        if delivery:
            data.update({
                'estimated_delivery': delivery.estimated_arrival,
                'timeline': {
                    'assigned':   delivery.assigned_at,
                    'accepted':   delivery.accepted_at,
                    'picked_up':  delivery.picked_up_at,
                    'in_transit': delivery.started_at,
                    'arrived':    delivery.arrived_at,
                    'completed':  delivery.completed_at,
                },
                'driver': {
                    'name':           _user_display_name(delivery.driver) if delivery.driver else None,
                    'vehicle_number': delivery.vehicle_number,
                    'current_location': {
                        'lat': float(delivery.current_latitude),
                        'lng': float(delivery.current_longitude),
                    } if delivery.current_latitude and delivery.current_longitude else None,
                } if delivery.driver else None,
            })

        try:
            addr = order.delivery.delivery_address
            data.update({
                'scheduled_date':      order.delivery.scheduled_date,
                'scheduled_time_slot': order.delivery.scheduled_time_slot,
                'delivery_address': (
                    getattr(addr, 'full_address', None) or
                    getattr(addr, 'address', None) or
                    getattr(addr, 'street_address', None) or str(addr)
                ),
            })
        except Exception:
            pass

        return Response(data)


class DeliveryHealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'status':           'healthy',
            'service':          'deliveries',
            'timestamp':        timezone.now(),
            'deliveries_count': Delivery.objects.count(),
        })

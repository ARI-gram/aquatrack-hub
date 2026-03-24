"""
apps/notifications/views.py
============================

Customer notification endpoints:
  GET  /api/customer/notifications/
  POST /api/customer/notifications/mark-read/
  GET  /api/customer/notifications/unread-count/

Driver notification endpoints:
  GET  /api/driver/notifications/

Client admin / site manager endpoints:
  GET  /api/client/notifications/
  GET  /api/client/notifications/unread-count/
  POST /api/client/notifications/mark-read/
"""

from django.db import models
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from apps.customers.authentication import CustomerJWTAuthentication
from apps.notifications.models import Notification
from apps.notifications.serializers import (
    NotificationSerializer,
    MarkReadSerializer,
    DriverNotificationSerializer,
)


# ── Permissions ───────────────────────────────────────────────────────────────

class IsCustomer(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, 'customer')
        )


class IsDriver(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and getattr(request.user, 'role', None) == 'driver'
        )


class IsClientStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('client_admin', 'site_manager')
            and request.user.client_id is not None
        )


# ── Customer ──────────────────────────────────────────────────────────────────

class CustomerNotificationListView(APIView):
    authentication_classes = [CustomerJWTAuthentication]
    """GET /api/customer/notifications/"""
    permission_classes = [IsCustomer]

    def get(self, request):
        customer = request.user.customer
        qs = Notification.objects.filter(customer=customer)

        if request.query_params.get('unread_only', '').lower() in ('1', 'true'):
            qs = qs.filter(is_read=False)

        qs = qs.filter(
            models.Q(expires_at__isnull=True) |
            models.Q(expires_at__gt=timezone.now())
        ).order_by('-created_at')

        unread_count = Notification.objects.filter(
            customer=customer, is_read=False).count()

        total = qs.count()
        page = max(1, int(request.query_params.get('page', 1)))
        limit = min(50, max(1, int(request.query_params.get('limit', 20))))
        offset = (page - 1) * limit

        return Response({
            'notifications': NotificationSerializer(qs[offset:offset + limit], many=True).data,
            'unread_count':  unread_count,
            'total':         total,
            'page':          page,
            'limit':         limit,
            'total_pages':   (total + limit - 1) // limit,
        })


class CustomerNotificationUnreadCountView(APIView):
    authentication_classes = [CustomerJWTAuthentication]
    """GET /api/customer/notifications/unread-count/"""
    permission_classes = [IsCustomer]

    def get(self, request):
        count = Notification.objects.filter(
            customer=request.user.customer, is_read=False).count()
        return Response({'unread_count': count})


class CustomerMarkNotificationsReadView(APIView):
    authentication_classes = [CustomerJWTAuthentication]
    """POST /api/customer/notifications/mark-read/"""
    permission_classes = [IsCustomer]

    def post(self, request):
        serializer = MarkReadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        customer = request.user.customer
        now = timezone.now()

        if serializer.validated_data.get('mark_all'):
            updated = Notification.objects.filter(
                customer=customer, is_read=False,
            ).update(is_read=True, read_at=now)
        else:
            ids = serializer.validated_data['notification_ids']
            updated = Notification.objects.filter(
                customer=customer, id__in=ids, is_read=False,
            ).update(is_read=True, read_at=now)

        return Response({
            'marked_read':  updated,
            'unread_count': Notification.objects.filter(
                customer=customer, is_read=False).count(),
        })


# ── Driver ────────────────────────────────────────────────────────────────────

class DriverNotificationListView(APIView):
    """
    GET /api/driver/notifications/

    Returns a merged, time-sorted feed of:
      A) Synthesised delivery-assignment notifications from Delivery records
         (existing behaviour — status=ASSIGNED means unread)
      B) Stored Notification rows addressed to this driver via
         extra_data.driver_id  (written by notify.delivery_assigned_driver)

    Both sources are merged and sorted newest-first, capped at 30 total.
    The shape matches NotificationSerializer so the frontend renders both
    through the same NotificationRow component.
    """
    permission_classes = [IsDriver]

    def get(self, request):
        from apps.deliveries.models import Delivery

        driver = request.user
        unread_only = request.query_params.get(
            'unread_only', '').lower() in ('1', 'true')

        # ── A: synthesise from Delivery records ───────────────────────────
        delivery_qs = Delivery.objects.filter(
            driver=driver,
        ).select_related('order', 'order__delivery').order_by('-assigned_at')

        if unread_only:
            delivery_qs = delivery_qs.filter(status='ASSIGNED')

        synthesised = []
        for d in delivery_qs[:30]:
            order = d.order
            sched_date = d.scheduled_date
            sched_slot = d.scheduled_time_slot or ''
            if not sched_date:
                try:
                    sched_date = order.delivery.scheduled_date
                    sched_slot = sched_slot or order.delivery.scheduled_time_slot or ''
                except Exception:
                    pass

            synthesised.append({
                'id':                  str(d.id),
                'notificationType':    'DRIVER_ASSIGNED',
                'type':                'DRIVER_ASSIGNED',
                'title':               'New Delivery Assigned 🚛',
                'message': (
                    f"Order {order.order_number} assigned to you"
                    + (f" for {sched_date}" if sched_date else "")
                    + (f" · {sched_slot}" if sched_slot else "")
                    + "."
                ),
                'isRead':              d.status != 'ASSIGNED',
                'createdAt':           d.assigned_at,
                'actionUrl':           f'/driver/deliveries/{d.id}',
                'actionLabel':         'View Delivery',
                'order_number':        order.order_number,
                'scheduled_date':      sched_date,
                'scheduled_time_slot': sched_slot,
                'status':              d.status,
                'assigned_at':         d.assigned_at,
                '_sort':               d.assigned_at,
            })

        # ── B: stored Notification rows for this driver ───────────────────
        stored_qs = Notification.objects.filter(
            customer__isnull=True,
            extra_data__driver_id=str(driver.id),
        ).order_by('-created_at')[:30]

        stored = []
        for n in stored_qs:
            if unread_only and n.is_read:
                continue
            stored.append({
                'id':                  str(n.id),
                'notificationType':    n.notification_type,
                'type':                n.notification_type,
                'title':               n.title,
                'message':             n.message,
                'isRead':              n.is_read,
                'createdAt':           n.created_at,
                'actionUrl':           n.action_url or '',
                'actionLabel':         n.action_label or '',
                'order_number':        n.order.order_number if n.order else '',
                'scheduled_date':      None,
                'scheduled_time_slot': '',
                'status':              '',
                'assigned_at':         n.created_at,
                '_sort':               n.created_at,
            })

        # ── Merge + sort ──────────────────────────────────────────────────
        merged = synthesised + stored
        merged.sort(key=lambda x: x['_sort'], reverse=True)
        for row in merged:
            del row['_sort']

        unread_count = Delivery.objects.filter(
            driver=driver, status='ASSIGNED').count()

        return Response({
            'notifications': merged[:30],
            'unread_count':  unread_count,
            'total':         len(merged),
        })


# ── Client Admin / Site Manager ───────────────────────────────────────────────

class ClientAdminNotificationListView(APIView):
    """GET /api/client/notifications/"""
    permission_classes = [IsClientStaff]

    def _base_qs(self, client):
        return Notification.objects.filter(
            models.Q(customer__client=client) |
            models.Q(customer__isnull=True,
                     extra_data__client_id=str(client.id))
        )

    def get(self, request):
        client = request.user.client
        qs = self._base_qs(client)

        if request.query_params.get('unread_only', '').lower() in ('1', 'true'):
            qs = qs.filter(is_read=False)

        notif_type = request.query_params.get('type')
        if notif_type:
            qs = qs.filter(notification_type=notif_type)

        qs = qs.filter(
            models.Q(expires_at__isnull=True) |
            models.Q(expires_at__gt=timezone.now())
        ).order_by('-created_at')

        unread_count = self._base_qs(client).filter(is_read=False).count()
        total = qs.count()
        page = max(1, int(request.query_params.get('page', 1)))
        limit = min(50, max(1, int(request.query_params.get('limit', 20))))
        offset = (page - 1) * limit

        return Response({
            'notifications': NotificationSerializer(qs[offset:offset + limit], many=True).data,
            'unread_count':  unread_count,
            'total':         total,
            'page':          page,
            'limit':         limit,
            'total_pages':   (total + limit - 1) // limit,
        })


class ClientAdminUnreadCountView(APIView):
    """GET /api/client/notifications/unread-count/"""
    permission_classes = [IsClientStaff]

    def get(self, request):
        client = request.user.client
        count = Notification.objects.filter(
            models.Q(customer__client=client) |
            models.Q(customer__isnull=True,
                     extra_data__client_id=str(client.id)),
            is_read=False,
        ).count()
        return Response({'unread_count': count})


class ClientAdminMarkReadView(APIView):
    """POST /api/client/notifications/mark-read/"""
    permission_classes = [IsClientStaff]

    def post(self, request):
        serializer = MarkReadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        client = request.user.client
        now = timezone.now()
        base_qs = Notification.objects.filter(
            models.Q(customer__client=client) |
            models.Q(customer__isnull=True,
                     extra_data__client_id=str(client.id)),
            is_read=False,
        )

        if serializer.validated_data.get('mark_all'):
            updated = base_qs.update(is_read=True, read_at=now)
        else:
            ids = serializer.validated_data['notification_ids']
            updated = base_qs.filter(id__in=ids).update(
                is_read=True, read_at=now)

        unread_count = Notification.objects.filter(
            models.Q(customer__client=client) |
            models.Q(customer__isnull=True,
                     extra_data__client_id=str(client.id)),
            is_read=False,
        ).count()

        return Response({'marked_read': updated, 'unread_count': unread_count})

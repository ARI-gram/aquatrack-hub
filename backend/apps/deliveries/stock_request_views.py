"""
apps/deliveries/stock_request_views.py

Driver endpoints (mounted at /api/driver/store/):
  POST  request-topup/    — driver submits a stock request
  GET   my-requests/      — driver's own request history

Admin / store-manager endpoints (mounted at /api/store/stock-requests/):
  GET   /                 — list all requests (filterable by status)
  GET   <id>/             — single request detail
  PATCH <id>/approve/     — approve (with per-item qty adjustments)
  PATCH <id>/reject/      — reject with reason
"""

from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.deliveries.views import IsDriver, IsClientStaff
from apps.deliveries.models import StockRequest, StockRequestItem
from apps.products.models import Product


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialise_item(item: StockRequestItem) -> dict:
    return {
        'id':                     str(item.id),
        'product_id':             str(item.product_id),
        'product_name':           item.product_name,
        'product_type':           item.product_type,
        'unit':                   item.unit or None,
        'quantity_requested':     item.quantity_requested,
        'quantity_approved':      item.quantity_approved,
        'current_qty_at_request': item.current_qty_at_request,
    }


def _serialise_request(req: StockRequest) -> dict:
    return {
        'id':                    str(req.id),
        'driver_id':             str(req.driver_id),
        'driver_name':           req.driver_name,
        'vehicle_number':        req.vehicle_number,
        'delivery_id':           str(req.delivery_id) if req.delivery_id else None,
        'delivery_order_number': req.delivery_order_number,
        # Always uppercase so the frontend normaliser never needs to guess
        'status':                req.status.upper(),
        'notes':                 req.notes or None,
        'rejection_reason':      req.rejection_reason or None,
        'items':                 [_serialise_item(i) for i in req.items.select_related('product').all()],
        'created_at':            req.created_at.isoformat(),
        'updated_at':            req.updated_at.isoformat(),
        'approved_at':           req.approved_at.isoformat() if req.approved_at else None,
        'approved_by_name': (
            f'{req.approved_by.first_name} {req.approved_by.last_name}'.strip()
            or req.approved_by.email
        ) if req.approved_by else None,
    }


def _get_driver_balance(driver, product) -> int:
    """Return the driver's current van balance for a product."""
    try:
        from apps.deliveries.driver_store_views import (
            _compute_bottle_balance,
            _compute_consumable_balance,
        )
        if getattr(product, 'is_returnable', False):
            return _compute_bottle_balance(driver, product)['full']
        return _compute_consumable_balance(driver, product)['in_stock']
    except Exception:
        return 0


def _distribute_to_driver(driver, product, quantity, approved_by, request_id):
    """
    Mirror the store distribute logic so approving a stock request
    automatically loads stock onto the driver's van.
    """
    from apps.products.models import BottleMovement, ConsumableMovement
    from apps.products.store_views import _bottle_balance, _consumable_balance, BOTTLES_LOW_THRESHOLD
    from apps.notifications import notify

    if getattr(product, 'is_returnable', False):
        balance = _bottle_balance(product.id)
        available = balance['full']
        if quantity > available:
            quantity = available          # distribute what we have
        if quantity < 1:
            return 0

        vehicle_number = getattr(driver, 'vehicle_number', '') or ''
        BottleMovement.objects.create(
            product=product,
            movement_type='DISTRIBUTE',
            qty_good=quantity,
            driver=driver,
            vehicle_number=vehicle_number,
            notes=f'Auto-distributed via stock request approval (req {request_id})',
            recorded_by=approved_by,
        )
        balance_after = _bottle_balance(product.id)
        if balance_after['full'] < BOTTLES_LOW_THRESHOLD:
            notify.bottles_low(driver.client, product.name,
                               balance_after['full'])
    else:
        balance = _consumable_balance(product.id)
        available = balance['in_stock']
        if quantity > available:
            quantity = available
        if quantity < 1:
            return 0

        vehicle_number = getattr(driver, 'vehicle_number', '') or ''
        ConsumableMovement.objects.create(
            product=product,
            movement_type='DISTRIBUTE',
            quantity=quantity,
            driver=driver,
            vehicle_number=vehicle_number,
            notes=f'Auto-distributed via stock request approval (req {request_id})',
            recorded_by=approved_by,
        )
        balance_after = _consumable_balance(product.id)
        if balance_after['in_stock'] < BOTTLES_LOW_THRESHOLD:
            notify.bottles_low(driver.client, product.name,
                               balance_after['in_stock'])

    # Notify driver their stock is coming
    try:
        notify.bottles_distributed_to_driver(
            driver=driver,
            product_name=product.name,
            quantity=quantity,
            client=driver.client,
        )
    except Exception:
        pass

    return quantity


# ── DRIVER VIEWS ──────────────────────────────────────────────────────────────

class DriverCreateStockRequestView(APIView):
    """
    POST /api/driver/store/request-topup/

    Body:
    {
        "items": [
            {
                "product_id":         "<uuid>",
                "product_type":       "bottle" | "consumable",
                "quantity_requested": 10
            }
        ],
        "delivery_id": "<uuid>",   // optional
        "notes":       "Urgent…"   // optional
    }
    """
    permission_classes = [IsDriver]

    def post(self, request):
        driver = request.user
        data = request.data
        items_data = data.get('items', [])

        if not items_data:
            return Response(
                {'error': 'Provide at least one item.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Optional delivery link
        delivery = None
        delivery_id = data.get('delivery_id')
        if delivery_id:
            from apps.deliveries.models import Delivery
            try:
                delivery = Delivery.objects.get(
                    id=delivery_id, driver=driver)
            except Delivery.DoesNotExist:
                return Response(
                    {'error': 'Delivery not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # Build & validate items
        resolved_items = []
        for idx, item in enumerate(items_data):
            product_id = item.get('product_id')
            qty = item.get('quantity_requested', 0)

            if not product_id:
                return Response(
                    {'error': f'Item {idx + 1}: product_id is required.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                qty = int(qty)
            except (TypeError, ValueError):
                return Response(
                    {'error': f'Item {idx + 1}: quantity_requested must be an integer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if qty < 1:
                return Response(
                    {'error': f'Item {idx + 1}: quantity_requested must be at least 1.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                product = Product.objects.get(
                    id=product_id, client=driver.client, status='ACTIVE')
            except Product.DoesNotExist:
                return Response(
                    {'error': f'Item {idx + 1}: product not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

            product_type = item.get('product_type')
            if not product_type:
                product_type = 'bottle' if product.is_returnable else 'consumable'

            current_qty = _get_driver_balance(driver, product)

            resolved_items.append({
                'product':                product,
                'product_type':           product_type,
                'quantity_requested':     qty,
                'current_qty_at_request': current_qty,
            })

        # Create request + line items atomically
        from django.db import transaction
        with transaction.atomic():
            stock_request = StockRequest.objects.create(
                driver=driver,
                delivery=delivery,
                notes=data.get('notes', '').strip(),
            )
            for item in resolved_items:
                product = item['product']
                StockRequestItem.objects.create(
                    request=stock_request,
                    product=product,
                    product_name=product.name,
                    product_type=item['product_type'],
                    unit=getattr(product, 'unit', '') or '',
                    quantity_requested=item['quantity_requested'],
                    current_qty_at_request=item['current_qty_at_request'],
                )

        # Notify store admin a request is waiting
        try:
            from apps.notifications import notify
            notify.driver_stock_request_created(
                driver=driver,
                request_id=str(stock_request.id),
                item_count=len(resolved_items),
                client=driver.client,
            )
        except Exception:
            pass

        return Response(
            _serialise_request(stock_request),
            status=status.HTTP_201_CREATED,
        )


class DriverMyStockRequestsView(APIView):
    """
    GET /api/driver/store/my-requests/

    Returns the requesting driver's own request history,
    newest first.
    """
    permission_classes = [IsDriver]

    def get(self, request):
        requests = (
            StockRequest.objects
            .filter(driver=request.user)
            .prefetch_related('items__product')
            .order_by('-created_at')[:50]
        )
        return Response([_serialise_request(r) for r in requests])


# ── ADMIN / STORE VIEWS ───────────────────────────────────────────────────────

class StockRequestListView(APIView):
    """
    GET /api/store/stock-requests/

    Query params:
      status    — PENDING | APPROVED | PARTIALLY_APPROVED | REJECTED | all
      driver_id — filter by driver UUID
    """
    permission_classes = [IsClientStaff]

    def get(self, request):
        qs = (
            StockRequest.objects
            .filter(driver__client=request.user.client)
            .select_related('driver', 'delivery', 'delivery__order', 'approved_by')
            .prefetch_related('items__product')
            .order_by('-created_at')
        )

        status_filter = request.query_params.get('status', 'all')
        if status_filter and status_filter != 'all':
            qs = qs.filter(status=status_filter.upper())

        driver_id = request.query_params.get('driver_id')
        if driver_id:
            qs = qs.filter(driver_id=driver_id)

        return Response([_serialise_request(r) for r in qs])


class StockRequestDetailView(APIView):
    """GET /api/store/stock-requests/<id>/"""
    permission_classes = [IsClientStaff]

    def get(self, request, request_id):
        try:
            req = (
                StockRequest.objects
                .select_related('driver', 'delivery', 'delivery__order', 'approved_by')
                .prefetch_related('items__product')
                .get(id=request_id, driver__client=request.user.client)
            )
        except StockRequest.DoesNotExist:
            return Response(
                {'error': 'Stock request not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_serialise_request(req))


class StockRequestApproveView(APIView):
    """
    PATCH /api/store/stock-requests/<id>/approve/

    Body:
    {
        "items": [
            { "line_item_id": "<uuid>", "quantity_approved": 8 }
        ],
        "notes": "optional note"
    }

    Status logic (APPROVE path only — never sets REJECTED):
      - All items fully approved            → APPROVED
      - Some items partially/fully approved → PARTIALLY_APPROVED
      - Store had zero stock for all items  → PARTIALLY_APPROVED (not REJECTED —
        use the reject endpoint to explicitly reject)
    """
    permission_classes = [IsClientStaff]

    def patch(self, request, request_id):
        try:
            stock_request = (
                StockRequest.objects
                .select_related('driver')
                .prefetch_related('items__product')
                .get(id=request_id, driver__client=request.user.client)
            )
        except StockRequest.DoesNotExist:
            return Response(
                {'error': 'Stock request not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if stock_request.status != 'PENDING':
            return Response(
                {'error': f'Only PENDING requests can be approved. Current: {stock_request.status}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        approved_items_data = request.data.get('items', [])
        if not approved_items_data:
            return Response(
                {'error': 'Provide items with quantity_approved for each line.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build lookup: line_item_id → approved_qty
        approval_map = {}
        for entry in approved_items_data:
            lid = str(entry.get('line_item_id', ''))
            try:
                qty = int(entry.get('quantity_approved', 0))
            except (TypeError, ValueError):
                qty = 0
            approval_map[lid] = max(0, qty)

        from django.db import transaction
        with transaction.atomic():
            for item in stock_request.items.select_related('product').all():
                approved_qty = approval_map.get(
                    str(item.id), item.quantity_requested)
                item.quantity_approved = approved_qty
                item.save(update_fields=['quantity_approved'])

                if approved_qty > 0:
                    actually_distributed = _distribute_to_driver(
                        driver=stock_request.driver,
                        product=item.product,
                        quantity=approved_qty,
                        approved_by=request.user,
                        request_id=str(stock_request.id),
                    )
                    # Correct approved qty if store had less stock than requested
                    if actually_distributed != approved_qty:
                        item.quantity_approved = actually_distributed
                        item.save(update_fields=['quantity_approved'])

            # ── Determine final status (APPROVE path never sets REJECTED) ──────
            # Re-read items after potential qty corrections above
            refreshed_items = list(stock_request.items.all())

            all_fully_approved = all(
                (i.quantity_approved or 0) >= i.quantity_requested
                for i in refreshed_items
            )

            # If the admin clicked Approve, the intent is always APPROVED or
            # PARTIALLY_APPROVED — never REJECTED.  Zero distribution happens
            # when the store is empty; that's a stock problem, not a rejection.
            if all_fully_approved:
                new_status = 'APPROVED'
            else:
                new_status = 'PARTIALLY_APPROVED'

            stock_request.status = new_status
            stock_request.approved_by = request.user
            stock_request.approved_at = timezone.now()
            if request.data.get('notes'):
                stock_request.notes = (
                    stock_request.notes + '\n' + request.data['notes']).strip()
            stock_request.save(
                update_fields=['status', 'approved_by', 'approved_at', 'notes', 'updated_at'])

        # Reload with relations for serialisation
        stock_request.refresh_from_db()
        return Response(_serialise_request(stock_request))


class StockRequestRejectView(APIView):
    """
    PATCH /api/store/stock-requests/<id>/reject/

    Body: { "reason": "Insufficient stock available" }

    This is the ONLY path that sets status = REJECTED.
    """
    permission_classes = [IsClientStaff]

    def patch(self, request, request_id):
        try:
            stock_request = (
                StockRequest.objects
                .select_related('driver')
                .prefetch_related('items__product')
                .get(id=request_id, driver__client=request.user.client)
            )
        except StockRequest.DoesNotExist:
            return Response(
                {'error': 'Stock request not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if stock_request.status != 'PENDING':
            return Response(
                {'error': f'Only PENDING requests can be rejected. Current: {stock_request.status}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            return Response(
                {'error': 'A rejection reason is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stock_request.status = 'REJECTED'
        stock_request.rejection_reason = reason
        stock_request.save(
            update_fields=['status', 'rejection_reason', 'updated_at'])

        # Notify driver their request was rejected
        try:
            from apps.notifications import notify
            notify.driver_stock_request_rejected(
                driver=stock_request.driver,
                reason=reason,
                client=stock_request.driver.client,
            )
        except Exception:
            pass

        return Response(_serialise_request(stock_request))

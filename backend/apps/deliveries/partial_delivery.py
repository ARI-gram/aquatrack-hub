"""
apps/deliveries/partial_delivery.py

Handles the case where a driver delivers fewer items than ordered.

Entry point:
    apply_partial_delivery_adjustment(delivery, order, delivered_items)

`delivered_items` is a list of dicts:
    [
        { "order_item_id": "<uuid>", "qty_delivered": 2 },
        ...
    ]

What this does:
  1. Compares qty_delivered vs qty_ordered per OrderItem
  2. Calculates the KES shortfall using the unit_price snapshot on OrderItem
  3. Reduces Invoice.total_amount / amount_due by the shortfall
  4. Reduces Order.total_amount to match
  5. Appends a structured note to Invoice.notes explaining every line
  6. Creates an OrderTimeline entry so admin/reports can see the adjustment
  7. Returns a DeliveryAdjustmentResult for the API response

No new model is needed — the adjustment is expressed through existing
Invoice.notes (structured) and OrderTimeline entries.

Migration needed:
    None — uses existing fields only.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

from django.db import transaction
from django.utils import timezone

log = logging.getLogger(__name__)


# ── Result type ───────────────────────────────────────────────────────────────

@dataclass
class AdjustmentLine:
    order_item_id: str
    product_name:  str
    ordered_qty:   int
    delivered_qty: int
    shortfall_qty: int
    unit_price:    Decimal
    deducted_amt:  Decimal
    reason:        str


@dataclass
class DeliveryAdjustmentResult:
    had_shortfall:     bool
    total_deducted:    Decimal
    original_amount:   Decimal
    adjusted_amount:   Decimal
    lines:             list[AdjustmentLine] = field(default_factory=list)
    invoice_number:    Optional[str] = None
    error:             Optional[str] = None


# ── Core function ─────────────────────────────────────────────────────────────

@transaction.atomic
def apply_partial_delivery_adjustment(
    delivery,
    order,
    delivered_items: list[dict],
) -> DeliveryAdjustmentResult:
    """
    Called from DriverCompleteDeliveryView after the delivery is marked
    COMPLETED but before the response is returned.

    Parameters
    ----------
    delivery      : Delivery instance (already COMPLETED)
    order         : Order instance (related to delivery)
    delivered_items : list of { order_item_id: str, qty_delivered: int }
                     Only items with a shortfall need to be in this list,
                     but including all items is safe — zero-shortfall lines
                     are skipped.

    Returns
    -------
    DeliveryAdjustmentResult  (never raises — errors are captured in .error)
    """

    if not delivered_items:
        return DeliveryAdjustmentResult(
            had_shortfall=False,
            total_deducted=Decimal('0.00'),
            original_amount=order.total_amount,
            adjusted_amount=order.total_amount,
        )

    # ── Build a lookup: order_item_id → delivered qty ─────────────────────────
    delivered_map: dict[str, int] = {
        str(d['order_item_id']): int(d.get('qty_delivered', 0))
        for d in delivered_items
        if d.get('order_item_id') is not None
    }

    if not delivered_map:
        return DeliveryAdjustmentResult(
            had_shortfall=False,
            total_deducted=Decimal('0.00'),
            original_amount=order.total_amount,
            adjusted_amount=order.total_amount,
        )

    # ── Fetch order items ─────────────────────────────────────────────────────
    from apps.orders.models import OrderItem, OrderTimeline
    items = (
        OrderItem.objects
        .filter(order=order, id__in=delivered_map.keys())
        .select_related('product')
    )

    adjustment_lines: list[AdjustmentLine] = []
    total_deducted = Decimal('0.00')

    for item in items:
        item_id = str(item.id)
        ordered_qty = item.quantity
        delivered_qty = delivered_map.get(item_id, ordered_qty)

        # Clamp — can't deliver more than ordered
        delivered_qty = max(0, min(delivered_qty, ordered_qty))
        shortfall = ordered_qty - delivered_qty

        if shortfall <= 0:
            continue  # fully delivered — nothing to adjust

        unit_price = item.unit_price   # snapshot price, always accurate
        deducted_amt = unit_price * shortfall

        reason = (
            f"Partial delivery: {delivered_qty} of {ordered_qty} "
            f"{item.product_unit or 'units'} delivered for '{item.product_name}'. "
            f"{shortfall} unit(s) not delivered — KES {deducted_amt:,.2f} deducted."
        )

        adjustment_lines.append(AdjustmentLine(
            order_item_id=item_id,
            product_name=item.product_name,
            ordered_qty=ordered_qty,
            delivered_qty=delivered_qty,
            shortfall_qty=shortfall,
            unit_price=unit_price,
            deducted_amt=deducted_amt,
            reason=reason,
        ))

        total_deducted += deducted_amt

    if not adjustment_lines:
        return DeliveryAdjustmentResult(
            had_shortfall=False,
            total_deducted=Decimal('0.00'),
            original_amount=order.total_amount,
            adjusted_amount=order.total_amount,
        )

    # ── Apply to Order ────────────────────────────────────────────────────────
    original_order_total = order.total_amount
    new_order_total = max(
        Decimal('0.00'), original_order_total - total_deducted)

    order.total_amount = new_order_total
    order.subtotal = max(Decimal('0.00'), order.subtotal - total_deducted)
    order.save(update_fields=['total_amount', 'subtotal', 'updated_at'])

    # ── Apply to Invoice ──────────────────────────────────────────────────────
    invoice_number: Optional[str] = None
    try:
        from apps.invoices.models import Invoice
        invoice = Invoice.objects.select_for_update().get(order=order)
        invoice_number = invoice.invoice_number

        # Build human-readable note block
        ts = timezone.now().strftime('%Y-%m-%d %H:%M')
        note_lines = [
            f"\n[Partial Delivery Adjustment — {ts}]",
            f"Driver: {getattr(delivery.driver, 'get_full_name', lambda: delivery.driver.email)()}",
            f"Original total: KES {original_order_total:,.2f}",
        ]
        for ln in adjustment_lines:
            note_lines.append(
                f"  • {ln.product_name}: ordered {ln.ordered_qty}, "
                f"delivered {ln.delivered_qty} "
                f"(−{ln.shortfall_qty} × KES {ln.unit_price:,.2f} = −KES {ln.deducted_amt:,.2f})"
            )
        note_lines.append(f"Total deducted: −KES {total_deducted:,.2f}")
        note_lines.append(f"Adjusted total: KES {new_order_total:,.2f}")

        invoice.notes += "\n".join(note_lines)

        # Reduce the invoice amounts — but never below what's already been paid
        original_invoice_total = invoice.total_amount
        new_invoice_total = max(invoice.amount_paid,
                                original_invoice_total - total_deducted)
        actual_reduction = original_invoice_total - new_invoice_total

        invoice.total_amount = new_invoice_total
        invoice.amount_due = max(
            Decimal('0.00'), new_invoice_total - invoice.amount_paid)

        # If the full amount was already paid, mark a refund note but don't
        # change status — a human accountant should handle the KES refund.
        if invoice.amount_paid > new_invoice_total:
            overpaid = invoice.amount_paid - new_invoice_total
            invoice.notes += (
                f"\n[⚠ Overpayment: customer paid KES {invoice.amount_paid:,.2f} "
                f"but adjusted total is KES {new_invoice_total:,.2f}. "
                f"KES {overpaid:,.2f} refund pending accountant review.]"
            )

        invoice.save(update_fields=['total_amount',
                     'amount_due', 'notes', 'updated_at'])

    except Exception as exc:
        # Non-fatal — delivery is already completed; log and continue
        log.warning(
            'apply_partial_delivery_adjustment: invoice update failed '
            'for order %s — %s', order.order_number, exc
        )

    # ── OrderTimeline entry ───────────────────────────────────────────────────
    try:
        from apps.orders.models import OrderTimeline
        timeline_note = (
            f"Partial delivery adjustment applied. "
            f"KES {total_deducted:,.2f} deducted from invoice "
            f"({len(adjustment_lines)} item(s) short). "
            + " | ".join(
                f"{ln.product_name}: {ln.delivered_qty}/{ln.ordered_qty}"
                for ln in adjustment_lines
            )
        )
        OrderTimeline.objects.create(
            order=order,
            status=order.status,  # keep current status — not a status change
            notes=timeline_note,
        )
    except Exception as exc:
        log.warning(
            'apply_partial_delivery_adjustment: timeline entry failed '
            'for order %s — %s', order.order_number, exc
        )

    return DeliveryAdjustmentResult(
        had_shortfall=True,
        total_deducted=total_deducted,
        original_amount=original_order_total,
        adjusted_amount=new_order_total,
        lines=adjustment_lines,
        invoice_number=invoice_number,
    )

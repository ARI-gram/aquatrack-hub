"""
apps/notifications/notify.py
=============================
Central notification helper.

Every function is safe to call — exceptions are swallowed and logged
so a notification failure never breaks the main request.

Who receives what
─────────────────
Customer:
  order_placed, order_confirmed, order_delivered, order_cancelled,
  driver_assigned, delivery_otp,
  wallet_topup, payment_success, wallet_low_balance,
  promotion, promotion_bulk

Driver  (customer=None, extra_data.driver_id):
  delivery_assigned_driver

Client admin  (customer=None, extra_data.client_id):
  bottles_low, stock_pickup, delivery_completed, delivery_failed

action_url reference
────────────────────
  Customer  → /customer/orders/{id}/track   |  /customer/wallet
  Driver    → /driver/deliveries/{delivery_id}
  Staff     → /client/deliveries/{id}  |  /store
  Frontend resolveActionUrl() remaps per role automatically.
"""

import logging
from apps.notifications.models import Notification

logger = logging.getLogger(__name__)


def _create(**kwargs):
    try:
        return Notification.objects.create(**kwargs)
    except Exception as exc:
        logger.exception("Failed to create notification: %s", exc)
        return None


# ── Orders (→ customer) ───────────────────────────────────────────────────────

def order_placed(order):
    _create(
        customer=order.customer,
        order=order,
        notification_type='ORDER_PLACED',
        title='Order Placed Successfully 🛍️',
        message=(
            f"Your order {order.order_number} has been received. "
            f"Total: KES {order.total_amount}. We'll confirm it shortly."
        ),
        priority='MEDIUM',
        action_url=f'/customer/orders/{order.id}/track',
        action_label='Track Order',
    )


def order_confirmed(order):
    _create(
        customer=order.customer,
        order=order,
        notification_type='ORDER_CONFIRMED',
        title='Order Confirmed ✅',
        message=(
            f"Order {order.order_number} has been confirmed "
            f"and is being prepared for delivery."
        ),
        priority='MEDIUM',
        action_url=f'/customer/orders/{order.id}/track',
        action_label='Track Order',
    )


def order_delivered(order):
    _create(
        customer=order.customer,
        order=order,
        notification_type='ORDER_DELIVERED',
        title='Order Delivered! 🎉',
        message=(
            f"Order {order.order_number} has been delivered successfully. "
            f"Thank you for choosing AquaTrack!"
        ),
        priority='HIGH',
        action_url=f'/customer/orders/{order.id}/track',
        action_label='View Delivery',
    )


def order_cancelled(order, reason: str = ''):
    msg = f"Order {order.order_number} has been cancelled."
    if reason:
        msg += f" Reason: {reason}"
    _create(
        customer=order.customer,
        order=order,
        notification_type='ORDER_CANCELLED',
        title='Order Cancelled ❌',
        message=msg,
        priority='HIGH',
        action_url='/customer/orders',
        action_label='View Orders',
    )


# ── Delivery — customer alerts ────────────────────────────────────────────────

def driver_assigned(order, driver):
    """Tell the customer their driver has been assigned."""
    driver_name = f"{driver.first_name} {driver.last_name}".strip(
    ) or "A driver"
    _create(
        customer=order.customer,
        order=order,
        notification_type='DRIVER_ASSIGNED',
        title='Driver Assigned 🚚',
        message=(
            f"{driver_name} has been assigned to deliver "
            f"order {order.order_number}."
        ),
        priority='MEDIUM',
        action_url=f'/customer/orders/{order.id}/track',
        action_label='Track Delivery',
    )


def delivery_otp(order, otp_code: str):
    """Send the OTP code to the customer."""
    _create(
        customer=order.customer,
        order=order,
        notification_type='DELIVERY_OTP',
        title='Your Delivery OTP 🔐',
        message=(
            f"Your OTP for order {order.order_number} is {otp_code}. "
            f"Share this with the driver to confirm delivery."
        ),
        priority='HIGH',
        action_url=f'/customer/orders/{order.id}/track',
        action_label='View OTP',
    )


# ── Delivery — driver alert ───────────────────────────────────────────────────

def delivery_assigned_driver(delivery):
    """
    Tell the driver they have a new delivery assigned to them.

    Stored as Notification(customer=None) with extra_data.driver_id so
    DriverNotificationListView can surface it alongside synthesised
    Delivery-based notifications.

    action_url → /driver/deliveries/{delivery.id}
    """
    order = delivery.order
    driver = delivery.driver
    sched = delivery.scheduled_date or ''
    slot = delivery.scheduled_time_slot or ''

    _create(
        customer=None,
        order=order,
        notification_type='DRIVER_ASSIGNED',
        title='New Delivery Assigned 🚛',
        message=(
            f"Order {order.order_number} has been assigned to you"
            + (f" for {sched}" if sched else "")
            + (f" · {slot}" if slot else "")
            + "."
        ),
        priority='HIGH',
        action_url=f'/driver/deliveries/{delivery.id}',
        action_label='View Delivery',
        extra_data={
            'driver_id':           str(driver.id),
            'delivery_id':         str(delivery.id),
            'scheduled_date':      str(sched) if sched else None,
            'scheduled_time_slot': slot or None,
        },
    )


# ── Delivery — client admin alerts ────────────────────────────────────────────

def delivery_completed(delivery):
    """
    Tell the client admin a delivery completed successfully.
    customer=None, scoped by extra_data.client_id.
    """
    order = delivery.order
    driver = delivery.driver
    driver_name = (
        f"{driver.first_name} {driver.last_name}".strip()
        if driver else "Driver"
    )
    completed_str = (
        f" Completed at {delivery.completed_at.strftime('%H:%M')}"
        if delivery.completed_at else ""
    )

    _create(
        customer=None,
        order=order,
        notification_type='DELIVERY_COMPLETED',
        title='Delivery Completed ✅',
        message=(
            f"Order {order.order_number} was delivered successfully "
            f"by {driver_name}.{completed_str}"
        ),
        priority='MEDIUM',
        action_url=f'/client/deliveries/{delivery.id}',
        action_label='View Delivery',
        extra_data={'client_id': str(order.client_id)},
    )


def delivery_failed(delivery):
    """
    Tell the client admin a delivery failed.
    customer=None, scoped by extra_data.client_id.
    """
    order = delivery.order
    driver = delivery.driver
    driver_name = (
        f"{driver.first_name} {driver.last_name}".strip()
        if driver else "Driver"
    )
    reason = (
        delivery.get_failure_reason_display()
        if delivery.failure_reason else "Unknown reason"
    )

    _create(
        customer=None,
        order=order,
        notification_type='DELIVERY_FAILED',
        title='Delivery Failed ❌',
        message=(
            f"Order {order.order_number} delivery failed. "
            f"Reason: {reason}. Driver: {driver_name}."
        ),
        priority='HIGH',
        action_url=f'/client/deliveries/{delivery.id}',
        action_label='View Delivery',
        extra_data={
            'client_id':      str(order.client_id),
            'failure_reason': delivery.failure_reason or '',
        },
    )


# ── Wallet / payment (→ customer) ─────────────────────────────────────────────

def wallet_topup(transaction):
    customer = transaction.wallet.customer
    _create(
        customer=customer,
        transaction=transaction,
        notification_type='WALLET_TOPUP',
        title='Wallet Top-Up Successful 💰',
        message=(
            f"KES {transaction.amount} has been added to your wallet. "
            f"New balance: KES {transaction.balance_after}."
        ),
        priority='MEDIUM',
        action_url='/customer/wallet',
        action_label='View Wallet',
    )


def payment_success(transaction):
    customer = transaction.wallet.customer
    _create(
        customer=customer,
        transaction=transaction,
        notification_type='PAYMENT_SUCCESS',
        title='Payment Successful 💳',
        message=(
            f"Payment of KES {transaction.amount} completed successfully. "
            f"Remaining balance: KES {transaction.balance_after}."
        ),
        priority='MEDIUM',
        action_url='/customer/wallet',
        action_label='View Wallet',
    )


def wallet_low_balance(customer, balance):
    _create(
        customer=customer,
        notification_type='WALLET_LOW_BALANCE',
        title='Low Wallet Balance ⚠️',
        message=(
            f"Your wallet balance is KES {balance:.2f}. "
            f"Top up to continue placing orders without interruption."
        ),
        priority='HIGH',
        action_url='/customer/wallet',
        action_label='Top Up Now',
    )


# ── Stock / inventory (→ client admin) ───────────────────────────────────────

def bottles_low(client, product_name: str, qty_remaining: int):
    _create(
        customer=None,
        notification_type='BOTTLES_LOW',
        title=f'Low Stock: {product_name} 🪣',
        message=(
            f"Only {qty_remaining} unit(s) of {product_name} remaining. "
            f"Consider restocking soon."
        ),
        priority='HIGH',
        action_url='/store',
        action_label='View Store',
        extra_data={'client_id': str(client.id)},
    )


def stock_pickup(driver, client, products: list, scheduled_date=None):
    product_summary = ', '.join(
        f"{p['quantity']}× {p['product_name']}" for p in products
    )
    driver_name = f"{driver.first_name} {driver.last_name}".strip() or "Driver"
    _create(
        customer=None,
        notification_type='STOCK_PICKUP',
        title='Stock Pickup Scheduled 🏭',
        message=(
            f"{driver_name} is scheduled to pick up: {product_summary}"
            + (f" on {scheduled_date}." if scheduled_date else ".")
        ),
        priority='MEDIUM',
        action_url='/store',
        action_label='View Store',
        extra_data={
            'client_id':      str(client.id),
            'products':       products,
            'scheduled_date': str(scheduled_date) if scheduled_date else None,
            'dispatcher':     driver_name,
        },
    )


# ── Promotions (→ customer) ───────────────────────────────────────────────────

def promotion(customer, title: str, message: str, action_url: str = '/customer/orders/new'):
    _create(
        customer=customer,
        notification_type='PROMOTION',
        title=title,
        message=message,
        priority='LOW',
        action_url=action_url,
        action_label='Shop Now',
    )


def promotion_bulk(customers, title: str, message: str, action_url: str = '/customer/orders/new'):
    rows = [
        Notification(
            customer=c,
            notification_type='PROMOTION',
            title=title,
            message=message,
            priority='LOW',
            action_url=action_url,
            action_label='Shop Now',
        )
        for c in customers
    ]
    try:
        Notification.objects.bulk_create(rows, batch_size=500)
    except Exception as exc:
        logger.exception(
            "Failed to bulk-create promotion notifications: %s", exc)


def delivery_failed_by_driver(order, driver, reason: str = ''):
    """
    Tell the client admin a driver declined / could not take a delivery.
    customer=None, scoped by extra_data.client_id.
    """
    driver_name = f"{driver.first_name} {driver.last_name}".strip(
    ) if driver else "Driver"

    _create(
        customer=None,
        order=order,
        notification_type='DELIVERY_FAILED',
        title='Driver Declined Delivery ⚠️',
        message=(
            f"{driver_name} declined order {order.order_number}. "
            f"Reason: {reason or 'No reason given'}. "
            f"The order has been returned to the queue for reassignment."
        ),
        priority='HIGH',
        action_url=f'/client/orders',
        action_label='Reassign Order',
        extra_data={
            'client_id':      str(order.client_id),
            'failure_reason': reason or '',
            'driver_name':    driver_name,
        },
    )


def bottles_distributed_to_driver(driver, product_name: str, quantity: int, client):
    _create(
        customer=None,
        notification_type='STOCK_PICKUP',
        title='Stock Loaded onto Your Van 🏭',
        message=(
            f"{quantity}× {product_name} have been loaded onto your van. "
            f"Check your stock summary before heading out."
        ),
        priority='MEDIUM',
        action_url='/driver/store',
        action_label='View Van Stock',
        extra_data={
            'driver_id':    str(driver.id),
            'client_id':    str(client.id),
            'product_name': product_name,
            'quantity':     quantity,
        },
    )


def empties_received_from_driver(driver, product_name: str,
                                 qty_good: int, qty_damaged: int,
                                 qty_missing: int, client):
    driver_name = f"{driver.first_name} {driver.last_name}".strip() or "Driver"
    issues = []
    if qty_damaged:
        issues.append(f"{qty_damaged} damaged")
    if qty_missing:
        issues.append(f"{qty_missing} missing")
    issues_str = f" ⚠️ Issues: {', '.join(issues)}." if issues else ""

    _create(
        customer=None,
        notification_type='BOTTLE_EXCHANGE',
        title=f'Empties Returned by {driver_name} 🔄',
        message=(
            f"{driver_name} returned {qty_good} good {product_name} empties.{issues_str}"
        ),
        priority='HIGH' if issues else 'MEDIUM',
        action_url='/client/store',
        action_label='View Store',
        extra_data={
            'client_id':   str(client.id),
            'driver_id':   str(driver.id),
            'driver_name': driver_name,
            'product':     product_name,
            'qty_good':    qty_good,
            'qty_damaged': qty_damaged,
            'qty_missing': qty_missing,
        },
    )


def direct_sale_recorded(customer, product_name: str, quantity: int):
    _create(
        customer=customer,
        notification_type='PAYMENT_SUCCESS',
        title='Purchase Confirmed 🧾',
        message=(
            f"Your purchase of {quantity}× {product_name} has been recorded. "
            f"Thank you!"
        ),
        priority='LOW',
        action_url='/customer/orders',
        action_label='View History',
    )


def account_frozen(customer):
    _create(
        customer=customer,
        notification_type='ACCOUNT_UPDATE',
        title='Account Frozen ❄️',
        message=(
            "Your credit account has been frozen due to an outstanding overdue balance. "
            "New orders are paused until the balance is cleared or a grace period is approved. "
            "Please contact your distributor."
        ),
        priority='URGENT',
        action_url='/customer/wallet',
        action_label='View Balance',
    )


def account_unfrozen(customer):
    _create(
        customer=customer,
        notification_type='ACCOUNT_UPDATE',
        title='Account Reactivated ✅',
        message=(
            "Your credit account has been reactivated. "
            "You can now place orders again."
        ),
        priority='HIGH',
        action_url='/customer/orders/new',
        action_label='Place Order',
    )


def bottle_exchange_completed(delivery, bottles_delivered: int, bottles_collected: int, client):
    order = delivery.order
    driver = delivery.driver
    driver_name = f"{driver.first_name} {driver.last_name}".strip(
    ) if driver else "Driver"
    delta = bottles_delivered - bottles_collected
    delta_str = (
        f"Net: +{delta} bottles on van." if delta > 0
        else f"Net: {delta} bottles on van." if delta < 0
        else "Even exchange."
    )

    _create(
        customer=None,
        order=order,
        notification_type='BOTTLE_EXCHANGE',
        title='Bottle Exchange Recorded 🔄',
        message=(
            f"Order {order.order_number} — {driver_name} delivered {bottles_delivered} "
            f"and collected {bottles_collected} empties. {delta_str}"
        ),
        priority='LOW',
        action_url=f'/client/deliveries/{delivery.id}',
        action_label='View Delivery',
        extra_data={
            'client_id':         str(client.id),
            'bottles_delivered': bottles_delivered,
            'bottles_collected': bottles_collected,
        },
    )


def driver_direct_sale_to_customer(customer, driver, product_name: str, quantity: int):
    driver_name = f"{driver.first_name} {driver.last_name}".strip(
    ) if driver else "Driver"
    _create(
        customer=customer,
        notification_type='PAYMENT_SUCCESS',
        title='Van Sale Recorded 🚚',
        message=(
            f"{driver_name} recorded a sale of {quantity}× {product_name} to your account."
        ),
        priority='LOW',
        action_url='/customer/orders',
        action_label='View History',
    )


def driver_empties_shortage(driver, product_name: str,
                            qty_expected: int, qty_good: int,
                            qty_damaged: int, qty_missing: int):
    _create(
        customer=None,
        notification_type='BOTTLE_EXCHANGE',
        title='Empties Shortage on Return ⚠️',
        message=(
            f"You returned {qty_good} good {product_name} empties but "
            f"{qty_expected} were expected. "
            f"Damaged: {qty_damaged}, Missing: {qty_missing}. "
            f"Please reconcile with your supervisor."
        ),
        priority='HIGH',
        action_url='/driver/store',
        action_label='View Van Stock',
        extra_data={
            'driver_id':    str(driver.id),
            'product_name': product_name,
            'qty_expected': qty_expected,
            'qty_good':     qty_good,
            'qty_damaged':  qty_damaged,
            'qty_missing':  qty_missing,
        },
    )


def driver_stock_low(driver, product_name: str, quantity_remaining: int, client):
    _create(
        customer=None,
        notification_type='BOTTLES_LOW',
        title=f'Low Van Stock: {product_name} 🪣',
        message=(
            f"You only have {quantity_remaining} {product_name} left on your van. "
            f"Consider requesting a resupply before your next deliveries."
        ),
        priority='HIGH',
        action_url='/driver/store',
        action_label='View Van Stock',
        extra_data={
            'driver_id':  str(driver.id),
            'client_id':  str(client.id),
            'product':    product_name,
            'remaining':  quantity_remaining,
        },
    )


def driver_insufficient_stock_for_delivery(driver, order, missing_items: list, client):
    summary = ', '.join(
        f"{i['product_name']} (need {i['needed']}, have {i['available']})"
        for i in missing_items
    )

    _create(
        customer=None,
        notification_type='STOCK_PICKUP',
        title='Insufficient Stock for Delivery ❌',
        message=(
            f"You don't have enough stock for order {order.order_number}: "
            f"{summary}. Contact your supervisor for a resupply."
        ),
        priority='URGENT',
        action_url=f'/driver/store',
        action_label='View Van Stock',
        extra_data={
            'driver_id':     str(driver.id),
            'client_id':     str(client.id),
            'order_number':  order.order_number,
            'missing_items': missing_items,
        },
    )

    driver_name = f"{driver.first_name} {driver.last_name}".strip() or "Driver"
    _create(
        customer=None,
        order=order,
        notification_type='STOCK_PICKUP',
        title=f'Driver Stock Shortage — {order.order_number} ⚠️',
        message=(
            f"{driver_name} lacks stock for order {order.order_number}: "
            f"{summary}. Resupply needed before delivery."
        ),
        priority='URGENT',
        action_url=f'/client/deliveries',
        action_label='View Deliveries',
        extra_data={
            'client_id':     str(client.id),
            'driver_id':     str(driver.id),
            'driver_name':   driver_name,
            'order_number':  order.order_number,
            'missing_items': missing_items,
        },
    )


def store_empties_low(client, product_name: str, empties_available: int):
    _create(
        customer=None,
        notification_type='BOTTLES_LOW',
        title=f'Low Empty Bottles: {product_name} 🪣',
        message=(
            f"Only {empties_available} empty {product_name} available for refill. "
            f"Collect more empties from drivers before the next distribution."
        ),
        priority='HIGH',
        action_url='/client/store',
        action_label='View Store',
        extra_data={'client_id': str(client.id)},
    )


# ── Invoices (→ customer) ─────────────────────────────────────────────────────

def notify_invoice_issued(invoice):
    """
    Called when an invoice is first issued OR re-sent by the accountant.

    Does two things:
      1. Creates an in-app Notification for the customer
      2. Sends an email to the customer with invoice details

    Both are best-effort — failures are logged, never raised.

    Recipient: Customer
    """
    customer = invoice.customer

    # ── 1. In-app notification ────────────────────────────────────────────────
    try:
        is_overdue = invoice.status == 'OVERDUE'
        amount_str = f"KES {invoice.total_amount:,.2f}"
        due_str = f" Due by {invoice.due_date}." if invoice.due_date else ""

        _create(
            customer=customer,
            notification_type='ACCOUNT_UPDATE',
            title=(
                'Invoice Ready 🧾' if invoice.status == 'ISSUED' else
                'Overdue Invoice ⚠️' if is_overdue else
                'Invoice Paid ✅' if invoice.status == 'PAID' else
                'Invoice Updated'
            ),
            message=(
                f"Invoice {invoice.invoice_number} for {amount_str} has been issued.{due_str}"
                if invoice.status in ('ISSUED', 'OVERDUE') else
                f"Invoice {invoice.invoice_number} ({amount_str}) has been marked as paid. Thank you!"
            ),
            priority='HIGH' if is_overdue else 'MEDIUM',
            action_url='/customer/history',
            action_label='View Orders',
            extra_data={
                'invoice_id':     str(invoice.id),
                'invoice_number': invoice.invoice_number,
                'total_amount':   str(invoice.total_amount),
                'status':         invoice.status,
            },
        )
    except Exception as exc:
        logger.exception(
            "notify_invoice_issued: in-app notification failed: %s", exc)

    # ── 2. Email ──────────────────────────────────────────────────────────────
    try:
        customer_email = getattr(customer, 'email', None)
        if not customer_email:
            logger.warning(
                "notify_invoice_issued: customer %s has no email — skipping email",
                customer.id,
            )
            return

        customer_name = getattr(customer, 'full_name',
                                None) or 'Valued Customer'
        amount_str = f"KES {invoice.total_amount:,.2f}"
        due_line = f"\nDue Date:       {invoice.due_date}" if invoice.due_date else ""
        paid_line = f"\nPaid On:        {invoice.paid_at}" if invoice.paid_at else ""
        method_line = f"\nPayment Method: {invoice.payment_method}" if invoice.payment_method else ""

        # Build line items
        items_lines = []
        try:
            for item in invoice.items.all():
                items_lines.append(
                    f"  • {item.product_name}  ×{item.quantity}"
                    f"  @ KES {item.unit_price:,.2f}"
                    f"  =  KES {item.subtotal:,.2f}"
                )
        except Exception:
            pass
        items_block = "\n".join(
            items_lines) if items_lines else "  (see invoice for details)"

        subject = (
            f"Invoice {invoice.invoice_number} — {amount_str}"
            if invoice.status in ('ISSUED', 'OVERDUE') else
            f"Payment Received — {invoice.invoice_number}"
        )

        body = f"""Dear {customer_name},

{"Your invoice is ready. Please review the details below and arrange payment by the due date."
            if invoice.status == 'ISSUED' else
            "This invoice is now overdue. Please settle the outstanding balance as soon as possible."
            if invoice.status == 'OVERDUE' else
            "We have received your payment. Thank you!"}

─────────────────────────────────────────
Invoice Number: {invoice.invoice_number}
Status:         {invoice.status}{due_line}{paid_line}{method_line}
─────────────────────────────────────────
Items:
{items_block}
─────────────────────────────────────────
Subtotal:       KES {invoice.subtotal:,.2f}"""

        if invoice.delivery_fee:
            body += f"\nDelivery Fee:   KES {invoice.delivery_fee:,.2f}"
        if invoice.vat_amount:
            body += f"\nVAT:            KES {invoice.vat_amount:,.2f}"

        body += f"""
Total:          {amount_str}
─────────────────────────────────────────

{"Please make payment using the details provided by your distributor."
            if invoice.status in ('ISSUED', 'OVERDUE') else
            "This is your payment confirmation. No further action needed."}

If you have any questions, please contact your distributor directly.

Thank you for your business.
"""

        from django.core.mail import send_mail
        from django.conf import settings as django_settings

        send_mail(
            subject=subject,
            message=body,
            from_email=django_settings.DEFAULT_FROM_EMAIL,
            recipient_list=[customer_email],
            fail_silently=False,
        )
        logger.info(
            "notify_invoice_issued: email sent to %s for invoice %s",
            customer_email, invoice.invoice_number,
        )

    except Exception as exc:
        logger.exception(
            "notify_invoice_issued: email failed for invoice %s: %s",
            invoice.invoice_number, exc,
        )

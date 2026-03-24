"""
apps/invoices/signals.py

Auto-generates an Invoice when an Order reaches DELIVERED or COMPLETED status.

NOTE: Do NOT use @receiver here. The signal is connected explicitly in
apps/invoices/apps.py → ready() using the actual Order class, which
guarantees the connection is made regardless of app load order.

Payment logic:
  - PAID only when payment_status == 'PAID' (M-Pesa pre-paid, wallet, etc.)
  - CASH / COD orders start as ISSUED — driver marks payment collected on delivery
  - CREDIT orders start as ISSUED with a due date
  - All unpaid invoices (ISSUED) appear on the admin statement for manual payment
"""
from django.utils import timezone


def _recompute_outstanding(customer):
    """
    Recompute a customer's outstanding balance by summing all unpaid invoices.
    Always accurate — never drifts regardless of how many invoices exist.
    Called after any invoice is created or paid.
    """
    from decimal import Decimal
    from apps.invoices.models import Invoice

    true_balance = sum(
        Decimal(str(inv.total_amount)) - Decimal(str(inv.amount_paid or 0))
        for inv in Invoice.objects.filter(
            customer=customer,
            status__in=['ISSUED', 'OVERDUE'],
        )
    )

    # Update payment_profile
    try:
        profile = customer.payment_profile
        profile.outstanding_balance = true_balance
        profile.save(update_fields=['outstanding_balance', 'updated_at'])
    except Exception:
        pass

    # Update credit_terms (secondary model — keep in sync)
    try:
        credit_terms = customer.credit_terms
        credit_terms.outstanding_balance = true_balance
        credit_terms.save(update_fields=['outstanding_balance'])
    except Exception:
        pass


def auto_create_invoice(sender, instance, created, **kwargs):
    """
    Create an invoice automatically when an order reaches DELIVERED or COMPLETED.

    Invoice status rules:
      PAID   — payment_status is already 'PAID' on the order (e.g. M-Pesa STK
                push confirmed, wallet deducted at order time).
      ISSUED — everything else: CASH (COD), CREDIT, or any method where money
                hasn't been confirmed yet. Admin marks it paid after delivery.
    """
    if created:
        return

    # Fire on DELIVERED (driver done) and COMPLETED (admin confirmed)
    if instance.status not in ('DELIVERED', 'COMPLETED'):
        return

    from apps.invoices.models import Invoice, InvoiceItem

    # Skip if invoice already exists for this order
    if Invoice.objects.filter(order=instance).exists():
        return

    # ── Invoice number ────────────────────────────────────────────────────────
    year = timezone.now().year
    invoice_prefix = 'INV'
    try:
        from apps.accounts.models import AccountingSettings
        cfg = AccountingSettings.objects.get(client=instance.client)
        invoice_prefix = cfg.invoice_prefix or 'INV'
    except Exception:
        pass

    prefix_pattern = f'{invoice_prefix}-{year}-'
    last = (
        Invoice.objects
        .filter(invoice_number__startswith=prefix_pattern)
        .order_by('-invoice_number')
        .values_list('invoice_number', flat=True)
        .first()
    )
    if last:
        try:
            last_seq = int(last.split('-')[-1])
        except (ValueError, IndexError):
            last_seq = Invoice.objects.filter(created_at__year=year).count()
    else:
        last_seq = 0

    invoice_number = f'{invoice_prefix}-{year}-{last_seq + 1:06d}'

    # ── Payment state ─────────────────────────────────────────────────────────
    # ONLY mark PAID if the payment was actually confirmed on the order.
    # CASH / COD = money not collected yet → ISSUED.
    # M-Pesa STK confirmed or wallet deducted → payment_status will be 'PAID'.
    payment_status = getattr(instance, 'payment_status', None)
    payment_method = getattr(instance, 'payment_method', '') or ''
    paid_at = getattr(instance, 'paid_at', None)

    is_confirmed_paid = (payment_status == 'PAID')

    inv_status = 'PAID' if is_confirmed_paid else 'ISSUED'

    # ── Due date ──────────────────────────────────────────────────────────────
    due_date = None
    if not is_confirmed_paid:
        from datetime import timedelta

        is_credit = payment_method == 'CREDIT'
        if is_credit:
            # Credit customers get their configured payment window
            payment_days = 30
            try:
                payment_days = instance.customer.credit_terms.payment_due_days
            except Exception:
                pass
        else:
            # COD / CASH — due in 3 days, admin marks paid after driver collects
            payment_days = 3

        due_date = (timezone.now() + timedelta(days=payment_days)).date()

    # ── Create invoice ────────────────────────────────────────────────────────
    Invoice.objects.create(
        invoice_number=invoice_number,
        order=instance,
        customer=instance.customer,
        client=instance.client,
        status=inv_status,
        subtotal=instance.subtotal,
        delivery_fee=getattr(instance, 'delivery_fee', 0) or 0,
        discount_amount=getattr(instance, 'discount_amount', 0) or 0,
        total_amount=instance.total_amount,
        amount_paid=instance.total_amount if is_confirmed_paid else 0,
        amount_due=0 if is_confirmed_paid else instance.total_amount,
        payment_method=payment_method,
        issued_at=timezone.now(),
        due_date=due_date,
        paid_at=paid_at if is_confirmed_paid else None,
    )

    # ── Mirror line items ─────────────────────────────────────────────────────
    invoice = Invoice.objects.get(invoice_number=invoice_number)
    for item in instance.items.all():
        InvoiceItem.objects.create(
            invoice=invoice,
            product=item.product,
            product_name=item.product_name,
            product_unit=item.product_unit,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
        )

    # ── Recompute outstanding balance ─────────────────────────────────────────
    # All unpaid invoices (CASH COD + CREDIT) now count toward the balance.
    if not is_confirmed_paid:
        _recompute_outstanding(instance.customer)

"""
apps/invoices/management/commands/fix_balances.py

Run with:  python manage.py fix_balances
"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.invoices.models import Invoice
from apps.customers.models import Customer


class Command(BaseCommand):
    help = 'Recompute outstanding_balance for all customers from live invoice data'

    def handle(self, *args, **options):
        fixed = 0
        skipped = 0

        for customer in Customer.objects.select_related('payment_profile').all():
            try:
                profile = customer.payment_profile
            except Exception:
                skipped += 1
                continue

            true_balance = sum(
                Decimal(str(i.total_amount)) - Decimal(str(i.amount_paid or 0))
                for i in Invoice.objects.filter(
                    customer=customer,
                    status__in=['ISSUED', 'OVERDUE'],
                )
            )

            if profile.outstanding_balance != true_balance:
                self.stdout.write(
                    f"  Fixed {customer.full_name}: "
                    f"{profile.outstanding_balance} → {true_balance}"
                )
                profile.outstanding_balance = true_balance
                profile.save(update_fields=[
                             'outstanding_balance', 'updated_at'])
                fixed += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Fixed: {fixed}  |  Skipped (no profile): {skipped}"
        ))

from django.core.management.base import BaseCommand
from apps.products.models import BottleMovement
import re


class Command(BaseCommand):
    help = 'Backfill sales data with payment_method, unit_price, total_amount, and clean notes'

    def handle(self, *args, **options):
        sales = BottleMovement.objects.filter(
            movement_type='DIRECT_SALE'
        ).select_related('product')

        updated = 0

        for m in sales:
            changed = False
            notes = m.notes or ''

            # Backfill payment_method from notes
            if 'Payment:' in notes:
                match = re.search(r'Payment:\s*(\w+)', notes)
                if match:
                    m.payment_method = match.group(1).upper()
                    changed = True

            # Backfill unit_price from product
            if m.unit_price is None and m.product and m.product.selling_price:
                m.unit_price = m.product.selling_price
                changed = True

            # Backfill total_amount
            if m.total_amount is None and m.unit_price is not None:
                m.total_amount = m.unit_price * m.qty_good
                changed = True

            # Clean notes — remove auto-generated prefixes
            clean = re.sub(r'Customer:[^·\n]+[·]?\s*', '', notes).strip()
            clean = re.sub(r'Payment:\s*\w+\s*', '', clean).strip(' ·')
            clean = re.sub(r'Walk-in:\s*', '', clean).strip(' ·')
            if clean != notes:
                m.notes = clean
                changed = True

            if changed:
                m.save(update_fields=['payment_method',
                       'unit_price', 'total_amount', 'notes'])
                updated += 1

        self.stdout.write(self.style.SUCCESS(f'Done — updated {updated} rows'))

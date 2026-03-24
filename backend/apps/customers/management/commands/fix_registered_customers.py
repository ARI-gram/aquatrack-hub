"""
One-time fix: marks customers as registered if they have a verified OTP
or have logged in at least once, but is_registered is still False.

Usage:
    python manage.py fix_registered_customers
    python manage.py fix_registered_customers --dry-run
"""
from django.core.management.base import BaseCommand
from django.db.models import Q
from apps.customers.models import Customer


class Command(BaseCommand):
    help = "Mark customers as registered if they have already logged in."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview affected customers without saving.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Customers that have logged in OR have a verified phone
        # but are still showing invite_pending
        qs = Customer.objects.filter(
            is_registered=False,
        ).filter(
            Q(last_login__isnull=False) | Q(is_phone_verified=True)
        )

        count = qs.count()
        self.stdout.write(f"Found {count} customer(s) to fix.")

        for c in qs:
            self.stdout.write(
                f"  {'[DRY RUN] ' if dry_run else ''}Fixing: {c.full_name} "
                f"({c.phone_number}) last_login={c.last_login} "
                f"phone_verified={c.is_phone_verified}"
            )

        if not dry_run and count > 0:
            updated = qs.update(is_registered=True)
            self.stdout.write(
                self.style.SUCCESS(f"✓ Updated {updated} customer(s).")
            )
        elif dry_run:
            self.stdout.write(self.style.WARNING(
                "Dry run — no changes saved."))
        else:
            self.stdout.write("Nothing to fix.")

"""
apps/invoices/apps.py
"""

from django.apps import AppConfig


class InvoicesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.invoices'

    def ready(self):
        # Import the actual Order class here (all models are loaded by now)
        # and wire the signal directly to it — this is more reliable than
        # the string-based @receiver(post_save, sender='orders.Order') approach,
        # which can silently fail to connect depending on app load order.
        from django.db.models.signals import post_save
        from apps.orders.models import Order
        from apps.invoices.signals import auto_create_invoice

        post_save.connect(auto_create_invoice, sender=Order, weak=False)

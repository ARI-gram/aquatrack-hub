# apps/accounts/models.py

from django.db import models
from apps.clients.models import Client


class AccountingSettings(models.Model):
    """
    Per-client accounting configuration.
    Stores KRA PIN, VAT settings, bank details, M-Pesa details.
    One record per client — created on first save, updated thereafter.
    """

    client = models.OneToOneField(
        Client,
        on_delete=models.CASCADE,
        related_name='accounting_settings',
    )

    # ── Business identity ─────────────────────────────────────────────────────
    legal_name = models.CharField(max_length=255, blank=True)
    kra_pin = models.CharField(max_length=20,  blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20,  blank=True)
    email = models.EmailField(blank=True)
    invoice_prefix = models.CharField(max_length=10,  default='INV')
    invoice_footer_note = models.TextField(blank=True)

    # ── VAT ───────────────────────────────────────────────────────────────────
    vat_registered = models.BooleanField(default=False)
    vat_number = models.CharField(max_length=20,  blank=True)
    vat_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=16.00,
        help_text="VAT rate as a percentage e.g. 16.00",
    )

    # ── Bank details ──────────────────────────────────────────────────────────
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account_number = models.CharField(max_length=50,  blank=True)
    bank_account_name = models.CharField(max_length=100, blank=True)
    bank_branch = models.CharField(max_length=100, blank=True)

    # ── M-Pesa ────────────────────────────────────────────────────────────────
    mpesa_paybill = models.CharField(max_length=20, blank=True)
    mpesa_account_name = models.CharField(max_length=100, blank=True)
    mpesa_till = models.CharField(max_length=20,  blank=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'accounting_settings'
        verbose_name = 'Accounting Settings'
        verbose_name_plural = 'Accounting Settings'

    def __str__(self):
        return f"Accounting Settings — {self.client.name}"

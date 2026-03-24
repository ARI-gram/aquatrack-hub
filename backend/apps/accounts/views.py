# apps/accounts/views.py

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AccountingSettings


# ── Permission ────────────────────────────────────────────────────────────────

class IsAccountsStaff(permissions.BasePermission):
    """client_admin and accountant can read/write. Drivers can read (for receipts)."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        role = request.user.role

        # Drivers may only GET (they need business details for receipt printing)
        if role == 'driver':
            return request.method == 'GET' and request.user.client_id is not None

        return (
            role in ('client_admin', 'accountant', 'super_admin')
            and request.user.client_id is not None
        )


# ── Serializer helper (no DRF serializer needed — simple dict) ───────────────

def _settings_to_dict(s: AccountingSettings) -> dict:
    return {
        'legalName':          s.legal_name,
        'kraPin':             s.kra_pin,
        'vatRegistered':      s.vat_registered,
        'vatNumber':          s.vat_number,
        'vatRate':            float(s.vat_rate),
        'address':            s.address,
        'city':               s.city,
        'phone':              s.phone,
        'email':              s.email,
        'invoicePrefix':      s.invoice_prefix or 'INV',
        'invoiceFooterNote':  s.invoice_footer_note,
        'bankName':           s.bank_name,
        'bankAccountNumber':  s.bank_account_number,
        'bankAccountName':    s.bank_account_name,
        'bankBranch':         s.bank_branch,
        'mpesaPaybill':       s.mpesa_paybill,
        'mpesaAccountName':   s.mpesa_account_name,
        'mpesaTill':          s.mpesa_till,
    }


# ── View ─────────────────────────────────────────────────────────────────────

class AccountingSettingsView(APIView):
    """
    GET  /api/client/accounting-settings/   → fetch current settings
    POST /api/client/accounting-settings/   → create or update settings

    Uses get_or_create so the first POST creates the record,
    subsequent POSTs update it. Frontend always calls POST to save.
    """

    permission_classes = [IsAccountsStaff]

    def get(self, request):
        client = request.user.client
        try:
            settings = AccountingSettings.objects.get(client=client)
            return Response(_settings_to_dict(settings))
        except AccountingSettings.DoesNotExist:
            # Return blank defaults — frontend handles the empty state
            return Response({
                'legalName':         '',
                'kraPin':            '',
                'vatRegistered':     False,
                'vatNumber':         '',
                'vatRate':           16.0,
                'address':           '',
                'city':              '',
                'phone':             '',
                'email':             '',
                'invoicePrefix':     'INV',
                'invoiceFooterNote': '',
                'bankName':          '',
                'bankAccountNumber': '',
                'bankAccountName':   '',
                'bankBranch':        '',
                'mpesaPaybill':      '',
                'mpesaAccountName':  '',
                'mpesaTill':         '',
            })

    def post(self, request):
        client = request.user.client
        data = request.data

        settings, _ = AccountingSettings.objects.get_or_create(client=client)

        # Map camelCase frontend → snake_case model fields
        field_map = {
            'legalName':         'legal_name',
            'kraPin':            'kra_pin',
            'vatRegistered':     'vat_registered',
            'vatNumber':         'vat_number',
            'vatRate':           'vat_rate',
            'address':           'address',
            'city':              'city',
            'phone':             'phone',
            'email':             'email',
            'invoicePrefix':     'invoice_prefix',
            'invoiceFooterNote': 'invoice_footer_note',
            'bankName':          'bank_name',
            'bankAccountNumber': 'bank_account_number',
            'bankAccountName':   'bank_account_name',
            'bankBranch':        'bank_branch',
            'mpesaPaybill':      'mpesa_paybill',
            'mpesaAccountName':  'mpesa_account_name',
            'mpesaTill':         'mpesa_till',
        }

        updated_fields = []
        for camel, snake in field_map.items():
            if camel in data:
                setattr(settings, snake, data[camel])
                updated_fields.append(snake)

        if updated_fields:
            settings.save(update_fields=updated_fields + ['updated_at'])

        return Response(
            _settings_to_dict(settings),
            status=status.HTTP_200_OK,
        )

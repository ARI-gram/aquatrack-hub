"""
apps/customers/authentication.py

Customer tokens are issued with a 'customer_id' claim (not 'user_id'),
so Django's standard JWTAuthentication can't resolve them to a Django User.

This module provides:
  CustomerJWTAuthentication  — decodes the token and returns a CustomerTokenUser
  CustomerTokenUser          — a thin wrapper around Customer that satisfies
                               DRF's is_authenticated checks and exposes
                               .customer so that the IsCustomer permission works.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework.exceptions import AuthenticationFailed


class CustomerTokenUser:
    """
    Wraps a Customer instance so it behaves like a Django User
    from DRF's perspective.

    The only things DRF / permission classes need are:
      .is_authenticated  → True
      .is_anonymous      → False
      .customer          → the Customer instance (checked by IsCustomer)
    """

    is_active = True
    is_staff = False
    is_superuser = False

    def __init__(self, customer):
        self._customer = customer
        # Expose .customer so that `hasattr(request.user, 'customer')` is True
        self.customer = customer

    # ── Identity ──────────────────────────────────────────────────────────────

    @property
    def pk(self):
        return self._customer.pk

    @property
    def id(self):
        return self._customer.pk

    # ── Auth flags ────────────────────────────────────────────────────────────

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    # ── Misc helpers expected by some DRF internals ───────────────────────────

    def __str__(self):
        return f"CustomerTokenUser({self._customer.full_name})"

    def has_perm(self, perm, obj=None):
        return False

    def has_module_perms(self, app_label):
        return False


class CustomerJWTAuthentication(JWTAuthentication):
    """
    Drop-in replacement for JWTAuthentication for customer-facing endpoints.

    Reads the 'customer_id' claim from the token instead of 'user_id',
    looks up the Customer, and returns a CustomerTokenUser.

    Usage — add to any customer APIView:
        authentication_classes = [CustomerJWTAuthentication]
    """

    def get_user(self, validated_token):
        customer_id = validated_token.get('customer_id')
        if not customer_id:
            raise InvalidToken(
                'Token does not contain a customer_id claim. '
                'Use the standard JWTAuthentication for staff tokens.'
            )

        from apps.customers.models import Customer  # avoid circular import

        try:
            customer = Customer.objects.get(pk=customer_id)
        except Customer.DoesNotExist:
            raise AuthenticationFailed(
                'Customer not found or has been deleted.',
                code='customer_not_found',
            )

        if customer.status == 'BLOCKED':
            raise AuthenticationFailed(
                'This account has been blocked.',
                code='customer_blocked',
            )

        return CustomerTokenUser(customer)

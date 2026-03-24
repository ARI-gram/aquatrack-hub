"""
apps/customers/customer_auth.py

Custom JWT authentication for customer-issued tokens.

Customer tokens are created with `customer_id` and `phone` claims
(NOT `user_id`) so Django's default JWTAuthentication can't resolve them
to a Django User. This class handles them correctly.

Usage — add to any customer-facing view or set globally:
    authentication_classes = [CustomerJWTAuthentication]
"""

from rest_framework import authentication, exceptions
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError


class CustomerProxy:
    """
    Minimal user-like object wrapping a Customer.

    Satisfies all the checks that DRF and our IsCustomer permission
    make against request.user:
        - bool(request.user)             → True
        - request.user.is_authenticated  → True
        - request.user.is_active         → True if ACTIVE
        - request.user.customer          → the Customer instance itself
    """

    def __init__(self, customer):
        self._customer = customer

    # ── DRF / Django interface ────────────────────────────────────────────────

    @property
    def is_authenticated(self):
        return True

    @property
    def is_active(self):
        return self._customer.status == 'ACTIVE'

    @property
    def is_anonymous(self):
        return False

    def __bool__(self):
        return True

    # ── Attribute passthrough ─────────────────────────────────────────────────
    # Allows `request.user.customer`, `request.user.id`, etc.

    @property
    def customer(self):
        return self._customer

    @property
    def id(self):
        return self._customer.id

    def __repr__(self):
        return f"<CustomerProxy: {self._customer.full_name}>"


class CustomerJWTAuthentication(authentication.BaseAuthentication):
    """
    Authenticates requests bearing a customer-issued JWT.

    The token must contain a `customer_id` claim. On success,
    sets request.user to a CustomerProxy wrapping the Customer.

    Returns None (passes to the next authenticator) if the token
    is a staff token (has `user_id` instead of `customer_id`).
    """

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None

        raw_token = auth_header.split(' ', 1)[1].strip()
        if not raw_token:
            return None

        try:
            token = AccessToken(raw_token)
        except TokenError:
            raise exceptions.AuthenticationFailed('Invalid or expired token.')

        customer_id = token.get('customer_id')
        if not customer_id:
            # Not a customer token — let the next authenticator handle it
            return None

        from apps.customers.models import Customer
        try:
            customer = Customer.objects.get(id=customer_id)
        except Customer.DoesNotExist:
            raise exceptions.AuthenticationFailed(
                'Customer account not found.')

        if customer.status == 'BLOCKED':
            raise exceptions.AuthenticationFailed(
                'This account has been blocked.')

        return (CustomerProxy(customer), token)

    def authenticate_header(self, request):
        return 'Bearer'

"""
Customer Serializers for AquaTrack
"""

from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
import random
from apps.customers.models import (
    Customer, CustomerAddress, CustomerPreferences, CustomerOTP
)
from apps.clients.models import Client


class CustomerSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id', 'client', 'client_name', 'phone_number',
            'full_name', 'email', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_client_name(self, obj):
        return obj.client.company_name if obj.client else None

    def get_is_active(self, obj):
        return obj.status == 'ACTIVE'


class CustomerRegistrationSerializer(serializers.ModelSerializer):
    client_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Customer
        fields = ['client_id', 'phone_number', 'full_name', 'email']

    def validate_phone_number(self, value):
        if not value.startswith('+'):
            raise serializers.ValidationError(
                "Phone number must include country code (e.g., +254712345678)"
            )
        if len(value.replace(' ', '')) < 10:
            raise serializers.ValidationError("Phone number is too short.")
        return value

    def validate_client_id(self, value):
        try:
            client = Client.objects.get(id=value)
            if not client.is_active:
                raise serializers.ValidationError(
                    "This distributor is not currently active."
                )
            return value
        except Client.DoesNotExist:
            raise serializers.ValidationError("Invalid client ID.")

    def create(self, validated_data):
        client_id = validated_data.pop('client_id')
        client = Client.objects.get(id=client_id)
        customer = Customer.objects.create(client=client, **validated_data)

        otp_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        CustomerOTP.objects.create(
            phone_number=customer.phone_number,
            otp_code=otp_code,
            expires_at=timezone.now() + timedelta(minutes=10)
        )

        if customer.email:
            _send_otp(customer.email, otp_code)
        return customer


def _normalize_phone(phone: str) -> list[str]:
    """
    Return a list of phone variants to try when looking up a customer.
    Handles both +254726875878 and 0726875878 formats.
    """
    phone = phone.strip()
    variants = [phone]
    if phone.startswith('0') and len(phone) == 10:
        variants.append('+254' + phone[1:])
    elif not phone.startswith('+'):
        variants.append('+254' + phone.lstrip('0'))
    return variants


class SendOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(required=True)
    email = serializers.EmailField(required=True)

    def validate(self, attrs):
        phone = attrs.get('phone').strip()
        email = attrs.get('email').lower().strip()

        # Try all phone variants
        customer = None
        for phone_variant in _normalize_phone(phone):
            try:
                customer = Customer.objects.get(phone_number=phone_variant)
                break
            except Customer.DoesNotExist:
                continue

        if not customer:
            raise serializers.ValidationError(
                "No account found with this phone number."
            )

        if customer.status == 'BLOCKED':
            raise serializers.ValidationError(
                "This account has been deactivated."
            )

        if not customer.email:
            raise serializers.ValidationError(
                "No email address is registered for this account."
            )

        if customer.email.lower().strip() != email:
            raise serializers.ValidationError(
                "This email does not match the one registered for this account. "
                "Please use the email address your distributor used when creating your account."
            )

        attrs['customer'] = customer
        return attrs

    def save(self):
        customer = self.validated_data['customer']

        # Expire old OTPs for this phone
        CustomerOTP.objects.filter(
            phone_number=customer.phone_number,
            is_verified=False,
            expires_at__gt=timezone.now()
        ).update(expires_at=timezone.now())

        # Generate new OTP
        otp_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        CustomerOTP.objects.create(
            phone_number=customer.phone_number,
            otp_code=otp_code,
            expires_at=timezone.now() + timedelta(minutes=10)
        )

        _send_otp(customer.email, otp_code)

        return {
            'message': f'OTP sent to {customer.email}',
            'email': customer.email,
        }


class VerifyOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(required=True)
    otp_code = serializers.CharField(required=True)

    def validate(self, attrs):
        phone = attrs.get('phone').strip()
        otp_code = attrs.get('otp_code')

        # Try all phone variants
        customer = None
        phone_normalized = phone
        for phone_variant in _normalize_phone(phone):
            try:
                customer = Customer.objects.get(phone_number=phone_variant)
                phone_normalized = phone_variant
                break
            except Customer.DoesNotExist:
                continue

        if not customer:
            raise serializers.ValidationError("Invalid phone number or OTP.")

        try:
            otp = CustomerOTP.objects.filter(
                phone_number=phone_normalized,
                is_verified=False,
                expires_at__gt=timezone.now()
            ).latest('created_at')
        except CustomerOTP.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired OTP.")

        if otp.otp_code != otp_code:
            raise serializers.ValidationError("Invalid OTP code.")

        otp.is_verified = True
        otp.save(update_fields=['is_verified'])

        update_fields = ['last_login']
        customer.last_login = timezone.now()

        if not customer.is_phone_verified:
            customer.is_phone_verified = True
            customer.phone_verified_at = timezone.now()
            update_fields += ['is_phone_verified', 'phone_verified_at']

        # Auto-complete registration if customer exists but never accepted invite
        if not customer.is_registered:
            customer.is_registered = True
            customer.is_phone_verified = True
            customer.phone_verified_at = timezone.now()
            customer.save(
                update_fields=['is_registered', 'is_phone_verified', 'phone_verified_at'])

        customer.save(update_fields=update_fields)
        attrs['customer'] = customer
        return attrs

    def create(self, validated_data):
        from rest_framework_simplejwt.tokens import RefreshToken
        from django.contrib.auth import get_user_model

        User = get_user_model()
        customer = validated_data['customer']

        # Get or create a Django User for this customer
        # Username = phone number (unique per customer)
        user, _ = User.objects.get_or_create(
            username=f"customer_{customer.id}",
        )
        user.email = customer.email or ''
        user.first_name = (customer.full_name or '').split(' ')[0]
        user.last_name = ' '.join((customer.full_name or '').split(' ')[1:])
        user.save(update_fields=['email', 'first_name', 'last_name'])

        # Generate a proper token tied to the Django User
        refresh = RefreshToken.for_user(user)
        # Embed customer info as extra claims
        refresh['customer_id'] = str(customer.id)
        refresh['phone'] = customer.phone_number
        refresh['role'] = 'customer'

        return {
            'customer': CustomerSerializer(customer).data,
            'tokens': {
                'refresh': str(refresh),
                'access':  str(refresh.access_token),
            }
        }


class CustomerAddressSerializer(serializers.ModelSerializer):

    class Meta:
        model = CustomerAddress
        fields = [
            'id', 'customer', 'label', 'address',
            'latitude', 'longitude', 'delivery_instructions',
            'is_default', 'created_at'
        ]
        read_only_fields = ['id', 'customer', 'created_at']

    def create(self, validated_data):
        customer = self.context['request'].user.customer

        if not CustomerAddress.objects.filter(customer=customer).exists():
            validated_data['is_default'] = True

        validated_data['customer'] = customer
        return super().create(validated_data)


class CustomerPreferencesSerializer(serializers.ModelSerializer):

    class Meta:
        model = CustomerPreferences
        fields = [
            'id', 'customer', 'preferred_delivery_time',
            'delivery_instructions',
            'sms_notifications', 'email_notifications', 'push_notifications',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'customer', 'created_at', 'updated_at']


class CustomerProfileSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    addresses = CustomerAddressSerializer(many=True, read_only=True)
    preferences = CustomerPreferencesSerializer(read_only=True)
    wallet_balance = serializers.SerializerMethodField()
    bottle_inventory = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id', 'client', 'client_name', 'phone_number', 'full_name', 'email',
            'customer_type', 'status', 'is_active',
            'is_phone_verified', 'is_registered',
            'addresses', 'preferences',
            'wallet_balance', 'bottle_inventory',
            'registration_date', 'last_login'
        ]
        read_only_fields = ['id', 'is_phone_verified',
                            'registration_date', 'last_login']

    def get_client_name(self, obj):
        return obj.client.company_name if obj.client else None

    def get_is_active(self, obj):
        return obj.status == 'ACTIVE'

    def get_wallet_balance(self, obj):
        if hasattr(obj, 'wallet'):
            return {
                'current_balance': str(obj.wallet.current_balance),
                'total_topped_up': str(obj.wallet.total_topped_up),
                'total_spent': str(obj.wallet.total_spent)
            }
        return None

    def get_bottle_inventory(self, obj):
        if hasattr(obj, 'bottle_inventory'):
            inventory = obj.bottle_inventory
            return {
                'total_owned': inventory.total_owned,
                'full_bottles': inventory.full_bottles,
                'empty_bottles': inventory.empty_bottles,
                'in_transit': inventory.in_transit,
                'total_deposit_paid': str(inventory.total_deposit_paid)
            }
        return None


class CustomerUpdateSerializer(serializers.ModelSerializer):

    class Meta:
        model = Customer
        fields = ['full_name', 'email']

    def validate_email(self, value):
        if value:
            customer = self.instance
            if Customer.objects.filter(email=value).exclude(id=customer.id).exists():
                raise serializers.ValidationError(
                    "This email is already in use.")
        return value


# ============================================================
# 📧 OTP EMAIL SENDER
# ============================================================
def _send_otp(email: str, otp_code: str) -> None:
    from django.core.mail import send_mail
    from django.conf import settings

    send_mail(
        subject='Your AquaTrack Verification Code',
        message=(
            f'Your AquaTrack OTP code is: {otp_code}\n\n'
            f'This code expires in 10 minutes.\n\n'
            f'If you did not request this, please ignore this email.'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )

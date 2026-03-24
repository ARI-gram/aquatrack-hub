# apps/customers/payment_views.py
from rest_framework import serializers, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from decimal import Decimal

from apps.customers.authentication import CustomerJWTAuthentication
from apps.customers.models import CustomerPaymentProfile, PaymentMethod


# ── Permission ───────────────────────────────────────────────────────────────

class IsCustomer(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, 'customer')
        )


# ── Serializers ──────────────────────────────────────────────────────────────

class PaymentProfileSerializer(serializers.ModelSerializer):
    preferred_payment_method = serializers.CharField(source='preferred_method')
    mpesa_phone = serializers.CharField(source='mpesa_number')
    has_credit = serializers.BooleanField(source='credit_account_enabled')
    available_credit = serializers.SerializerMethodField()
    credit_terms_display = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()

    class Meta:
        model = CustomerPaymentProfile
        fields = [
            'preferred_payment_method',
            'mpesa_phone',
            'has_credit',
            'credit_terms_display',
            'available_credit',
            'currency',
        ]

    def get_available_credit(self, obj) -> str:
        return str(obj.available_credit)

    def get_credit_terms_display(self, obj) -> str:
        if not obj.credit_account_enabled:
            return ''
        return f"Limit: KES {obj.credit_limit}"

    def get_currency(self, obj) -> str:
        return 'KES'


class PaymentProfileUpdateSerializer(serializers.ModelSerializer):
    preferred_payment_method = serializers.ChoiceField(
        choices=[(m.value, m.label) for m in PaymentMethod],
        source='preferred_method',
        required=False,
    )
    mpesa_phone = serializers.CharField(
        source='mpesa_number',
        required=False,
        allow_blank=True,
        max_length=20,
    )

    class Meta:
        model = CustomerPaymentProfile
        fields = ['preferred_payment_method', 'mpesa_phone']

    def validate(self, attrs):
        method = attrs.get('preferred_method')
        mpesa_number = attrs.get('mpesa_number', '')
        if method == 'MPESA' and not mpesa_number:
            if self.instance and self.instance.mpesa_number:
                pass
            else:
                raise serializers.ValidationError(
                    "M-Pesa phone number is required when selecting M-Pesa.")
        return attrs

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.setup_completed = True
        instance.save()
        return instance


# ── View ─────────────────────────────────────────────────────────────────────

class CustomerPaymentProfileView(APIView):
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsCustomer]

    def _get_profile(self, customer):
        try:
            return customer.payment_profile
        except CustomerPaymentProfile.DoesNotExist:
            return None

    def get(self, request):
        profile = self._get_profile(request.user.customer)

        if profile is None:
            return Response(
                {'detail': 'Payment profile not set up.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not profile.setup_completed and not profile.credit_account_enabled:
            return Response(
                {'detail': 'Payment profile not set up.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(PaymentProfileSerializer(profile).data)

    def post(self, request):
        customer = request.user.customer
        profile = self._get_profile(customer)

        if profile is None:
            profile = CustomerPaymentProfile.objects.create(customer=customer)

        serializer = PaymentProfileUpdateSerializer(
            profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()

        return Response(PaymentProfileSerializer(profile).data, status=status.HTTP_200_OK)

    def put(self, request):
        customer = request.user.customer
        profile = self._get_profile(customer)

        if profile is None:
            return Response(
                {'detail': 'Payment profile not set up. Use POST to create it first.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PaymentProfileUpdateSerializer(
            profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()

        return Response(PaymentProfileSerializer(profile).data)

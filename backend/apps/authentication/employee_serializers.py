"""
apps/authentication/employee_serializers.py

Roles supported: site_manager, driver, accountant
- driver: number_plate required, stored on User.vehicle_number
- accountant: no vehicle, gets accounts module access only
- site_manager: no vehicle, gets orders/products access
"""

from rest_framework import serializers
from django.utils.crypto import get_random_string
from apps.authentication.models import User


EMPLOYEE_ROLES = ('site_manager', 'driver', 'accountant')


# ─── Read ─────────────────────────────────────────────────────────────────────

class EmployeeSerializer(serializers.ModelSerializer):
    firstName = serializers.CharField(source='first_name',    read_only=True)
    lastName = serializers.CharField(source='last_name',     read_only=True)
    fullName = serializers.SerializerMethodField()
    isActive = serializers.BooleanField(source='is_active',  read_only=True)
    isVerified = serializers.BooleanField(source='is_verified', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    lastLogin = serializers.DateTimeField(source='last_login', read_only=True)
    numberPlate = serializers.CharField(
        source='vehicle_number',
        read_only=True,
        help_text="Vehicle registration number plate (drivers only)",
    )

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'firstName',
            'lastName',
            'fullName',
            'phone',
            'role',
            'numberPlate',
            'isActive',
            'isVerified',
            'createdAt',
            'lastLogin',
        ]

    def get_fullName(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


# ─── Create ───────────────────────────────────────────────────────────────────

class EmployeeCreateSerializer(serializers.Serializer):
    ALLOWED_ROLES = EMPLOYEE_ROLES

    firstName = serializers.CharField(max_length=100)
    lastName = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    phone = serializers.CharField(
        max_length=15, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=ALLOWED_ROLES)
    number_plate = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        help_text="Vehicle number plate — required when role is 'driver'",
    )

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "A user with this email already exists."
            )
        return value

    def validate(self, data):
        if data.get('role') == 'driver':
            plate = data.get('number_plate', '').strip()
            if not plate:
                raise serializers.ValidationError(
                    {'number_plate': 'A number plate is required for drivers.'}
                )
            data['number_plate'] = plate.upper()
        else:
            # site_manager and accountant don't have vehicles
            data['number_plate'] = ''
        return data

    def create(self, validated_data):
        client = self.context['client']

        temp_password = get_random_string(
            length=12,
            allowed_chars=(
                'abcdefghjkmnpqrstuvwxyz'
                'ABCDEFGHJKMNPQRSTUVWXYZ'
                '23456789'
            ),
        )

        user = User.objects.create_user(
            email=validated_data['email'],
            password=temp_password,
            first_name=validated_data['firstName'],
            last_name=validated_data['lastName'],
            phone=validated_data.get('phone') or '',
            role=validated_data['role'],
            client=client,
            is_active=True,
            is_verified=False,
            vehicle_number=validated_data.get('number_plate') or '',
        )

        self._temp_password = temp_password
        return user


# ─── Update ───────────────────────────────────────────────────────────────────

class EmployeeUpdateSerializer(serializers.ModelSerializer):
    firstName = serializers.CharField(
        source='first_name', required=False, max_length=100)
    lastName = serializers.CharField(
        source='last_name',  required=False, max_length=100)
    numberPlate = serializers.CharField(
        source='vehicle_number',
        required=False,
        allow_blank=True,
        max_length=20,
        help_text="Vehicle registration number plate (drivers only)",
    )

    class Meta:
        model = User
        fields = ['firstName', 'lastName', 'phone', 'numberPlate']

    def validate_numberPlate(self, value):
        return value.strip().upper() if value else ''

    def to_representation(self, instance):
        return EmployeeSerializer(instance).data

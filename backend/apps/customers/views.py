# /apps/customers/views.py
from rest_framework import status, generics, permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action

from apps.customers.authentication import CustomerJWTAuthentication
from apps.customers.models import Customer, CustomerAddress, CustomerPreferences
from apps.customers.serializers import (
    CustomerSerializer,
    CustomerRegistrationSerializer,
    SendOTPSerializer,
    VerifyOTPSerializer,
    CustomerAddressSerializer,
    CustomerPreferencesSerializer,
    CustomerProfileSerializer,
    CustomerUpdateSerializer
)


# ==================== AUTHENTICATION VIEWS ====================
# These are public — no authentication_classes needed

class CustomerRegistrationView(generics.CreateAPIView):
    serializer_class = CustomerRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = serializer.save()
        customer_serializer = CustomerSerializer(customer)
        return Response(
            {
                'customer': customer_serializer.data,
                'message': f'Registration successful. OTP sent to {customer.phone_number}'
            },
            status=status.HTTP_201_CREATED
        )


class SendOTPView(generics.GenericAPIView):
    serializer_class = SendOTPSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_200_OK)


class VerifyOTPView(generics.GenericAPIView):
    serializer_class = VerifyOTPSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(result, status=status.HTTP_200_OK)


# ==================== PERMISSION ====================

class IsCustomer(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, 'customer')
        )


# ==================== PROFILE VIEWS ====================

class CustomerProfileView(generics.RetrieveUpdateAPIView):
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsCustomer]

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return CustomerProfileSerializer
        return CustomerUpdateSerializer

    def get_object(self):
        return self.request.user.customer


# ==================== ADDRESS VIEWS ====================

class CustomerAddressViewSet(viewsets.ModelViewSet):
    authentication_classes = [CustomerJWTAuthentication]
    serializer_class = CustomerAddressSerializer
    permission_classes = [IsCustomer]

    def get_queryset(self):
        return CustomerAddress.objects.filter(
            customer=self.request.user.customer,
            is_active=True
        )

    def perform_create(self, serializer):
        serializer.save(customer=self.request.user.customer)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        address = self.get_object()
        customer = request.user.customer
        CustomerAddress.objects.filter(
            customer=customer).update(is_default=False)
        address.is_default = True
        address.save()
        return Response({"message": "Address set as default"}, status=status.HTTP_200_OK)


# ==================== PREFERENCES VIEWS ====================

class CustomerPreferencesView(generics.RetrieveUpdateAPIView):
    authentication_classes = [CustomerJWTAuthentication]
    serializer_class = CustomerPreferencesSerializer
    permission_classes = [IsCustomer]

    def get_object(self):
        customer = self.request.user.customer
        preferences, _ = CustomerPreferences.objects.get_or_create(
            customer=customer)
        return preferences


# ==================== ADMIN-FACING VIEWS (staff JWT) ====================
# These use the default DRF JWTAuthentication (no override needed)

class CustomerListView(generics.ListAPIView):
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'super_admin':
            return Customer.objects.all()
        elif user.role in ['client_admin', 'site_manager']:
            return Customer.objects.filter(client=user.client)
        return Customer.objects.none()


class CustomerDetailView(generics.RetrieveAPIView):
    serializer_class = CustomerProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'super_admin':
            return Customer.objects.all()
        elif user.role in ['client_admin', 'site_manager']:
            return Customer.objects.filter(client=user.client)
        return Customer.objects.none()

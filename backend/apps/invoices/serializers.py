# apps/invoices/serializers.py

from rest_framework import serializers
from apps.invoices.models import Invoice, InvoiceItem


class InvoiceItemSerializer(serializers.ModelSerializer):
    productName = serializers.CharField(source='product_name', read_only=True)
    productUnit = serializers.CharField(source='product_unit', read_only=True)
    unitPrice = serializers.DecimalField(
        source='unit_price', max_digits=8, decimal_places=2, read_only=True)

    class Meta:
        model = InvoiceItem
        fields = [
            'id',
            'productName',
            'productUnit',
            'quantity',
            'unitPrice',
            'subtotal',
        ]


class InvoiceListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for list views.
    Returns camelCase fields matching the TypeScript Invoice interface.
    """
    invoiceNumber = serializers.CharField(
        source='invoice_number',  read_only=True)
    customerName = serializers.CharField(
        source='customer.full_name', read_only=True)
    customerPhone = serializers.SerializerMethodField()
    totalAmount = serializers.DecimalField(
        source='total_amount',   max_digits=10, decimal_places=2, read_only=True)
    amountPaid = serializers.DecimalField(
        source='amount_paid',    max_digits=10, decimal_places=2, read_only=True)
    amountDue = serializers.DecimalField(
        source='amount_due',     max_digits=10, decimal_places=2, read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True)
    deliveryFees = serializers.DecimalField(
        source='delivery_fee',   max_digits=8,  decimal_places=2, read_only=True)
    vatAmount = serializers.DecimalField(
        source='delivery_fee',   max_digits=8,  decimal_places=2, read_only=True)
    dueDate = serializers.DateField(source='due_date',          read_only=True)
    paidAt = serializers.DateTimeField(source='paid_at',       read_only=True)
    paymentMethod = serializers.CharField(
        source='payment_method',    read_only=True)
    isOverdue = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(
        source='created_at',    read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id',
            'invoiceNumber',
            'status',
            'customerName',
            'customerPhone',
            'subtotal',
            'deliveryFees',
            'vatAmount',
            'totalAmount',
            'amountPaid',
            'amountDue',
            'dueDate',
            'isOverdue',
            'paidAt',
            'paymentMethod',
            'createdAt',
        ]

    def get_customerPhone(self, obj):
        try:
            return obj.customer.phone_number
        except Exception:
            return ''

    def get_isOverdue(self, obj):
        from django.utils import timezone
        if obj.status == 'OVERDUE':
            return True
        if obj.status == 'ISSUED' and obj.due_date:
            return obj.due_date < timezone.now().date()
        return False


class InvoiceSerializer(InvoiceListSerializer):
    """
    Full serializer including line items.
    Used for detail view, issue, mark-paid.
    """
    items = InvoiceItemSerializer(many=True, read_only=True)
    billingCycle = serializers.SerializerMethodField()
    periodStart = serializers.SerializerMethodField()
    periodEnd = serializers.SerializerMethodField()
    notes = serializers.CharField(read_only=True)

    class Meta(InvoiceListSerializer.Meta):
        fields = InvoiceListSerializer.Meta.fields + [
            'billingCycle',
            'periodStart',
            'periodEnd',
            'notes',
            'items',
        ]

    def get_billingCycle(self, obj):
        # Derive from order if available
        try:
            return obj.order.billing_cycle or 'monthly'
        except Exception:
            return 'monthly'

    def get_periodStart(self, obj):
        try:
            return obj.order.period_start.isoformat() if obj.order.period_start else obj.created_at.date().isoformat()
        except Exception:
            return obj.created_at.date().isoformat()

    def get_periodEnd(self, obj):
        try:
            return obj.order.period_end.isoformat() if obj.order.period_end else obj.due_date.isoformat() if obj.due_date else obj.created_at.date().isoformat()
        except Exception:
            return obj.created_at.date().isoformat()

"""
Billing Serializers
apps/billing/serializers.py
"""

from rest_framework import serializers
from apps.billing.models import Subscription, Invoice, BillingCycle, InvoiceStatus


class SubscriptionSerializer(serializers.ModelSerializer):
    clientName = serializers.CharField(source='client.name', read_only=True)
    plan = serializers.CharField(
        source='client.get_subscription_plan_display', read_only=True)
    status = serializers.CharField(
        source='client.subscription_status', read_only=True)
    nextPaymentDate = serializers.DateTimeField(
        source='current_period_end', read_only=True)
    daysUntilDue = serializers.IntegerField(
        source='days_until_due', read_only=True)
    billingCycle = serializers.CharField(
        source='billing_cycle', read_only=True)
    monthlyEquivalent = serializers.IntegerField(
        source='monthly_equivalent', read_only=True)

    class Meta:
        model = Subscription
        fields = [
            'id',
            'clientName',
            'plan',
            'billingCycle',
            'status',
            'nextPaymentDate',
            'amount',
            'monthlyEquivalent',
            'daysUntilDue',
            'onboarding_paid',
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    clientName = serializers.CharField(source='client.name', read_only=True)
    invoiceNumber = serializers.CharField(
        source='invoice_number', read_only=True)
    dueDate = serializers.DateField(source='due_date', read_only=True)
    paidAt = serializers.DateTimeField(source='paid_at', read_only=True)
    paymentMethod = serializers.CharField(
        source='payment_method', read_only=True)
    paymentReference = serializers.CharField(
        source='payment_reference', read_only=True)
    periodStart = serializers.DateField(source='period_start', read_only=True)
    periodEnd = serializers.DateField(source='period_end', read_only=True)
    isOnboarding = serializers.BooleanField(
        source='is_onboarding', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id',
            'clientName',
            'invoiceNumber',
            'amount',
            'description',
            'status',
            'dueDate',
            'paidAt',
            'paymentMethod',
            'paymentReference',
            'periodStart',
            'periodEnd',
            'isOnboarding',
            'createdAt',
        ]


class BillingStatsSerializer(serializers.Serializer):
    totalSubscriptions = serializers.IntegerField()
    activeSubscriptions = serializers.IntegerField()
    trialSubscriptions = serializers.IntegerField()
    overdueSubscriptions = serializers.IntegerField()
    monthlyRevenue = serializers.IntegerField()
    annualRevenue = serializers.IntegerField()
    trialConversionRate = serializers.FloatField()


class MarkInvoicePaidSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(choices=['mpesa', 'bank', 'cash'])
    payment_reference = serializers.CharField(required=False, allow_blank=True)

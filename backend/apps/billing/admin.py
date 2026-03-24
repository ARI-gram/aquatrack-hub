"""
Billing Admin
apps/billing/admin.py
"""

from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from apps.billing.models import Subscription, Invoice, InvoiceStatus, BillingCycle


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = [
        'client',
        'billing_cycle',
        'amount_display',
        'current_period_end',
        'days_remaining',
        'onboarding_paid',
        'warning_flags',
    ]
    list_filter = ['billing_cycle', 'onboarding_paid']
    search_fields = ['client__name', 'client__email']
    readonly_fields = ['id', 'created_at', 'updated_at']

    fieldsets = (
        ('Client', {'fields': ('id', 'client')}),
        ('Billing', {
            'fields': (
                'billing_cycle',
                'onboarding_paid',
                'current_period_start',
                'current_period_end',
            )
        }),
        ('Warning Flags', {
            'fields': (
                'warning_7_days_sent',
                'warning_3_days_sent',
                'warning_1_day_sent',
            ),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    def amount_display(self, obj):
        return f"KSh {obj.amount:,}"
    amount_display.short_description = 'Amount'

    def days_remaining(self, obj):
        days = obj.days_until_due
        if days < 0:
            return format_html(
                '<span style="color:#dc2626;font-weight:600">Overdue ({} days)</span>',
                abs(days)
            )
        if days <= 7:
            return format_html(
                '<span style="color:#d97706;font-weight:600">{} days</span>', days
            )
        return format_html('<span style="color:#16a34a">{} days</span>', days)
    days_remaining.short_description = 'Days Until Due'

    def warning_flags(self, obj):
        flags = []
        if obj.warning_7_days_sent:
            flags.append('7d')
        if obj.warning_3_days_sent:
            flags.append('3d')
        if obj.warning_1_day_sent:
            flags.append('1d')
        return ', '.join(flags) if flags else '—'
    warning_flags.short_description = 'Warnings Sent'


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = [
        'invoice_number',
        'client',
        'amount_display',
        'status_badge',
        'due_date',
        'paid_at',
        'payment_method',
        'is_onboarding',
    ]
    list_filter = ['status', 'payment_method', 'is_onboarding', 'due_date']
    search_fields = ['invoice_number', 'client__name', 'payment_reference']
    readonly_fields = ['id', 'created_at', 'updated_at']
    date_hierarchy = 'due_date'

    fieldsets = (
        ('Invoice Details', {
            'fields': (
                'id',
                'invoice_number',
                'client',
                'subscription',
                'description',
                'amount',
                'is_onboarding',
            )
        }),
        ('Period', {
            'fields': ('period_start', 'period_end', 'due_date')
        }),
        ('Payment', {
            'fields': (
                'status',
                'paid_at',
                'payment_method',
                'payment_reference',
            )
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    actions = ['mark_as_paid', 'mark_as_overdue']

    def amount_display(self, obj):
        return f"KSh {obj.amount:,.0f}"
    amount_display.short_description = 'Amount'

    def status_badge(self, obj):
        colours = {
            InvoiceStatus.PAID: '#16a34a',
            InvoiceStatus.PENDING: '#d97706',
            InvoiceStatus.OVERDUE: '#dc2626',
            InvoiceStatus.CANCELLED: '#6b7280',
        }
        colour = colours.get(obj.status, '#6b7280')
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:9999px;font-size:11px;font-weight:600">{}</span>',
            colour, obj.get_status_display()
        )
    status_badge.short_description = 'Status'

    @admin.action(description='Mark selected invoices as Paid (M-Pesa)')
    def mark_as_paid(self, request, queryset):
        for invoice in queryset:
            invoice.mark_paid(method='mpesa')
        self.message_user(
            request, f'{queryset.count()} invoice(s) marked as paid.')

    @admin.action(description='Mark selected invoices as Overdue')
    def mark_as_overdue(self, request, queryset):
        updated = queryset.filter(
            status=InvoiceStatus.PENDING
        ).update(status=InvoiceStatus.OVERDUE)
        self.message_user(request, f'{updated} invoice(s) marked as overdue.')

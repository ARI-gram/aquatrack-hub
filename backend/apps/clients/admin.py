"""
Client Admin Configuration
apps/clients/admin.py
"""

from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from apps.clients.models import Client, SubscriptionStatus


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    """
    Admin configuration for the Client model
    """

    list_display = [
        'name',
        'email',
        'phone',
        'subscription_plan',
        'subscription_status_badge',
        'subscription_expires_at',
        'city',
        'country',
        'created_at',
    ]

    list_filter = [
        'subscription_plan',
        'subscription_status',
        'country',
        'created_at',
    ]

    search_fields = [
        'name',
        'email',
        'phone',
        'city',
    ]

    readonly_fields = [
        'id',
        'created_at',
        'updated_at',
    ]

    fieldsets = (
        ('Company Information', {
            'fields': (
                'id',
                'name',
                'email',
                'phone',
                'website',
                'logo',
            )
        }),
        ('Address', {
            'fields': (
                'address',
                'city',
                'state',
                'zip_code',
                'country',
            )
        }),
        ('Subscription', {
            'fields': (
                'subscription_plan',
                'subscription_status',
                'subscription_expires_at',
            )
        }),
        ('Timestamps', {
            'fields': (
                'created_at',
                'updated_at',
            ),
            'classes': ('collapse',),
        }),
    )

    ordering = ['-created_at']
    date_hierarchy = 'created_at'

    actions = ['activate_clients', 'suspend_clients', 'set_trial']

    def subscription_status_badge(self, obj):
        """Display coloured badge for subscription status"""
        colours = {
            SubscriptionStatus.ACTIVE: '#16a34a',
            SubscriptionStatus.TRIAL: '#d97706',
            SubscriptionStatus.INACTIVE: '#6b7280',
            SubscriptionStatus.CANCELLED: '#dc2626',
            SubscriptionStatus.EXPIRED: '#7c3aed',
        }
        colour = colours.get(obj.subscription_status, '#6b7280')
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:9999px;font-size:11px;font-weight:600">{}</span>',
            colour,
            obj.get_subscription_status_display(),
        )
    subscription_status_badge.short_description = 'Status'

    @admin.action(description='Activate selected clients')
    def activate_clients(self, request, queryset):
        updated = queryset.update(
            subscription_status=SubscriptionStatus.ACTIVE)
        self.message_user(request, f'{updated} client(s) activated.')

    @admin.action(description='Suspend selected clients')
    def suspend_clients(self, request, queryset):
        updated = queryset.update(
            subscription_status=SubscriptionStatus.CANCELLED)
        self.message_user(request, f'{updated} client(s) suspended.')

    @admin.action(description='Set selected clients to Trial (14 days)')
    def set_trial(self, request, queryset):
        from datetime import timedelta
        expires = timezone.now() + timedelta(days=14)
        updated = queryset.update(
            subscription_status=SubscriptionStatus.TRIAL,
            subscription_expires_at=expires,
        )
        self.message_user(request, f'{updated} client(s) set to trial.')

/**
 * src/components/layout/NotificationBell.tsx
 *
 * Shared bell dropdown used by DashboardLayout (Header), DriverLayout,
 * and CustomerLayout. Pulls live data via useNotifications.
 *
 * Usage:
 *   <NotificationBell />
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCheck, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ── Icon map ──────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  ORDER_PLACED:        '🛍️',
  ORDER_CONFIRMED:     '✅',
  ORDER_ASSIGNED:      '🚚',
  ORDER_IN_TRANSIT:    '🛣️',
  ORDER_ARRIVED:       '📍',
  ORDER_DELIVERED:     '🎉',
  ORDER_CANCELLED:     '❌',
  PAYMENT_SUCCESS:     '💳',
  WALLET_TOPUP:        '💰',
  WALLET_LOW_BALANCE:  '⚠️',
  DRIVER_ASSIGNED:     '🚛',
  DRIVER_NEARBY:       '📡',
  DELIVERY_ASSIGNED:   '📦',
  DELIVERY_OTP:        '🔐',
  DELIVERY_COMPLETED:  '✅',
  DELIVERY_FAILED:     '❌',
  STOCK_PICKUP:        '🏭',
  BOTTLES_LOW:         '🪣',
  BOTTLE_EXCHANGE:     '🔄',
  ACCOUNT_UPDATE:      '🔒',
  SYSTEM_ANNOUNCEMENT: '📢',
  PROMOTION:           '🎁',
};

function notifIcon(type: string): string {
  return TYPE_ICON[type] ?? '🔔';
}

// ── Role-aware URL resolution ─────────────────────────────────────────────────

const STAFF_ROLES = new Set([
  'super_admin', 'client_admin', 'site_manager', 'driver',
]);

function resolveActionUrl(
  url: string | undefined,
  role: string | undefined,
): string | null {
  if (!url) return null;

  let u = url;
  if (u.match(/^\/orders(\/|$)/)) u = '/customer/orders' + u.slice('/orders'.length);
  if (u.match(/^\/wallet(\/|$)/)) u = '/customer/wallet' + u.slice('/wallet'.length);
  if (u.match(/^\/store(\/|$)/) || u === '/store') u = '/store';

  if (!role || !STAFF_ROLES.has(role)) return u;

  if (u.startsWith('/client/deliveries'))  return u;
  if (u.startsWith('/driver/deliveries'))  return role === 'driver' ? u : '/client/deliveries';
  if (u.startsWith('/customer/orders'))    return role === 'driver' ? '/driver/deliveries' : '/client/orders';
  if (u.startsWith('/customer/wallet'))    return null;
  if (u === '/store' || u.startsWith('/customer/store'))
    return role === 'driver' ? '/driver/store' : '/client/store';
  if (u.startsWith('/customer/orders/new')) return '/client/orders';
  if (u.startsWith('/driver/'))            return role === 'driver' ? u : '/client/deliveries';
  if (u.startsWith('/customer')) {
    if (role === 'driver')       return '/driver';
    if (role === 'site_manager') return '/manager';
    return '/client';
  }
  return u;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { unreadCount, notifications, loading, markAllRead, markRead } =
    useNotifications({ preview: true });

  const [open, setOpen] = useState(false);

  const notifPath =
    user?.role === 'customer' ? '/customer/notifications' : '/notifications';

  const handleClick = (id: string, actionUrl?: string) => {
    markRead([id]);
    setOpen(false);
    const resolved = resolveActionUrl(actionUrl, user?.role);
    if (resolved) navigate(resolved);
  };

  const handleMarkAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAllRead();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className={cn('h-5 w-5', unreadCount > 0 && 'text-foreground')} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-in zoom-in-50 duration-200">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs h-5 px-1.5">
                {unreadCount} new
              </Badge>
            )}
            {loading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xl">
                🔔
              </div>
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs text-muted-foreground">No notifications yet.</p>
            </div>
          ) : (
            notifications.map((n, idx) => {
              const resolved = resolveActionUrl(n.actionUrl, user?.role);
              return (
                <React.Fragment key={n.id}>
                  <DropdownMenuItem
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 focus:bg-muted/60',
                      resolved ? 'cursor-pointer' : 'cursor-default',
                      !n.isRead && 'bg-primary/[0.03]',
                    )}
                    onClick={() =>
                      resolved
                        ? handleClick(n.id, n.actionUrl)
                        : markRead([n.id])
                    }
                  >
                    {/* Icon */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-base">
                        {notifIcon(n.type)}
                      </div>
                      {!n.isRead && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary border-2 border-background" />
                      )}
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm leading-tight truncate',
                        !n.isRead
                          ? 'font-semibold text-foreground'
                          : 'font-medium text-foreground/80',
                      )}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </DropdownMenuItem>
                  {idx < notifications.length - 1 && (
                    <div className="h-px bg-border/50 mx-4" />
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <div className="border-t" />
            <button
              className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-primary hover:text-primary/80 hover:bg-muted/40 transition-colors rounded-b-md"
              onClick={() => { setOpen(false); navigate(notifPath); }}
            >
              View all notifications
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
/**
 * src/pages/NotificationsPage.tsx
 * Shared notifications page — all roles.
 *
 * Layout is role-aware:
 *   customer     → CustomerLayout
 *   driver       → DriverLayout
 *   client_admin / site_manager / super_admin → DashboardLayout
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCheck, Filter, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { DashboardLayout }  from '@/components/layout/DashboardLayout';
import { DriverLayout }     from '@/components/layout/DriverLayout';
import { CustomerLayout }   from '@/components/layout/CustomerLayout';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth }          from '@/contexts/AuthContext';
import { Button }           from '@/components/ui/button';
import { Badge }            from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuCheckboxItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ── Type maps ─────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  ORDER_PLACED:        '🛍️',
  ORDER_CONFIRMED:     '✅',
  ORDER_DELIVERED:     '🎉',
  ORDER_CANCELLED:     '❌',
  DRIVER_ASSIGNED:     '🚛',
  DELIVERY_OTP:        '🔐',
  DELIVERY_COMPLETED:  '✅',
  DELIVERY_FAILED:     '❌',
  PAYMENT_SUCCESS:     '💳',
  WALLET_TOPUP:        '💰',
  WALLET_LOW_BALANCE:  '⚠️',
  BOTTLES_LOW:         '🪣',
  BOTTLE_EXCHANGE:     '🔄',
  STOCK_PICKUP:        '🏭',
  ACCOUNT_UPDATE:      '🔒',
  PROMOTION:           '🎁',
  SYSTEM_ANNOUNCEMENT: '📢',
};

const TYPE_LABEL: Record<string, string> = {
  ORDER_PLACED:        'Order Placed',
  ORDER_CONFIRMED:     'Order Confirmed',
  ORDER_DELIVERED:     'Delivered',
  ORDER_CANCELLED:     'Cancelled',
  DRIVER_ASSIGNED:     'Driver Assigned',
  DELIVERY_OTP:        'Delivery OTP',
  DELIVERY_COMPLETED:  'Delivery Completed',
  DELIVERY_FAILED:     'Delivery Failed',
  PAYMENT_SUCCESS:     'Payment',
  WALLET_TOPUP:        'Wallet Top-up',
  WALLET_LOW_BALANCE:  'Low Balance',
  BOTTLES_LOW:         'Low Stock',
  BOTTLE_EXCHANGE:     'Bottle Exchange',
  STOCK_PICKUP:        'Stock Pickup',
  ACCOUNT_UPDATE:      'Account Update',
  PROMOTION:           'Promotion',
  SYSTEM_ANNOUNCEMENT: 'Announcement',
};

const TYPE_RING: Record<string, string> = {
  ORDER_PLACED:        'ring-blue-200    bg-blue-50',
  ORDER_CONFIRMED:     'ring-emerald-200 bg-emerald-50',
  ORDER_DELIVERED:     'ring-green-200   bg-green-50',
  ORDER_CANCELLED:     'ring-red-200     bg-red-50',
  DRIVER_ASSIGNED:     'ring-violet-200  bg-violet-50',
  DELIVERY_OTP:        'ring-amber-200   bg-amber-50',
  DELIVERY_COMPLETED:  'ring-emerald-200 bg-emerald-50',
  DELIVERY_FAILED:     'ring-red-200     bg-red-50',
  PAYMENT_SUCCESS:     'ring-teal-200    bg-teal-50',
  WALLET_TOPUP:        'ring-teal-200    bg-teal-50',
  WALLET_LOW_BALANCE:  'ring-orange-200  bg-orange-50',
  BOTTLES_LOW:         'ring-orange-200  bg-orange-50',
  BOTTLE_EXCHANGE:     'ring-sky-200     bg-sky-50',
  STOCK_PICKUP:        'ring-sky-200     bg-sky-50',
  ACCOUNT_UPDATE:      'ring-red-200     bg-red-50',
  PROMOTION:           'ring-pink-200    bg-pink-50',
  SYSTEM_ANNOUNCEMENT: 'ring-muted       bg-muted',
};

function typeRing(type: string) {
  return TYPE_RING[type] ?? 'ring-muted bg-muted';
}

// ── Role-aware URL resolution ─────────────────────────────────────────────────

const STAFF_ROLES = new Set(['super_admin', 'client_admin', 'site_manager', 'driver']);

function resolveActionUrl(url: string | undefined, role: string | undefined): string | null {
  if (!url) return null;

  let u = url;
  if (u.match(/^\/orders(\/|$)/)) u = '/customer/orders' + u.slice('/orders'.length);
  if (u.match(/^\/wallet(\/|$)/)) u = '/customer/wallet' + u.slice('/wallet'.length);
  if (u.match(/^\/store(\/|$)/) || u === '/store') u = '/store';

  if (!role || !STAFF_ROLES.has(role)) return u;

  if (u.startsWith('/client/deliveries'))     return u;
  if (u.startsWith('/driver/deliveries'))     return role === 'driver' ? u : '/client/deliveries';
  if (u.startsWith('/customer/orders'))       return role === 'driver' ? '/driver/deliveries' : '/client/orders';
  if (u.startsWith('/customer/wallet'))       return null;
  if (u === '/store' || u.startsWith('/customer/store'))
    return role === 'driver' ? '/driver/store' : '/client/store';
  if (u.startsWith('/customer/orders/new'))   return '/client/orders';
  if (u.startsWith('/driver/'))               return role === 'driver' ? u : '/client/deliveries';
  if (u.startsWith('/customer')) {
    if (role === 'driver')       return '/driver';
    if (role === 'site_manager') return '/manager';
    return '/client';
  }
  return u;
}

// ── Role-aware layout wrapper ─────────────────────────────────────────────────

function NotifLayout({
  role,
  children,
}: {
  role: string | undefined;
  children: React.ReactNode;
}) {
  const title    = 'Notifications';
  const subtitle = 'Your activity feed';

  if (role === 'driver') {
    return (
      <DriverLayout title={title} subtitle={subtitle}>
        {children}
      </DriverLayout>
    );
  }

  if (role === 'customer') {
    return (
      <CustomerLayout title={title}>
        {children}
      </CustomerLayout>
    );
  }

  // client_admin, site_manager, super_admin
  return (
    <DashboardLayout title={title} subtitle={subtitle}>
      {children}
    </DashboardLayout>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    notifications, unreadCount, loading,
    markRead, markAllRead, refetch,
  } = useNotifications();

  const [tab,           setTab]           = useState<'all' | 'unread'>('all');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [refreshing,    setRefreshing]    = useState(false);

  const availableTypes = Array.from(new Set(notifications.map(n => n.type)));

  const toggleType = (type: string) =>
    setSelectedTypes(p =>
      p.includes(type) ? p.filter(t => t !== type) : [...p, type],
    );

  const filtered = notifications.filter(n => {
    if (tab === 'unread' && n.isRead) return false;
    if (selectedTypes.length > 0 && !selectedTypes.includes(n.type)) return false;
    return true;
  });

  const visibleUnreadIds = filtered.filter(n => !n.isRead).map(n => n.id);
  const activeFilters    = selectedTypes.length;

  const handleRefresh = () => {
    setRefreshing(true);
    refetch();
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleNavigate = (rawUrl: string) => {
    const resolved = resolveActionUrl(rawUrl, user?.role);
    if (resolved) navigate(resolved);
  };

  return (
    <NotifLayout role={user?.role}>
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Tabs value={tab} onValueChange={v => setTab(v as 'all' | 'unread')}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs px-4">
                All
                {notifications.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                    {notifications.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs px-4">
                Unread
                {unreadCount > 0 && (
                  <Badge className="ml-1.5 h-4 px-1.5 text-[10px] bg-destructive text-destructive-foreground">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 sm:ml-auto">
            <Button
              variant="ghost" size="icon" className="h-9 w-9"
              onClick={handleRefresh} disabled={loading || refreshing}
            >
              <RefreshCw className={cn('h-4 w-4', (loading || refreshing) && 'animate-spin')} />
            </Button>

            {availableTypes.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2 text-xs">
                    <Filter className="h-3.5 w-3.5" />
                    Filter
                    {activeFilters > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                        {activeFilters}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {availableTypes.map(type => (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={selectedTypes.includes(type)}
                      onCheckedChange={() => toggleType(type)}
                      className="text-xs"
                    >
                      {TYPE_ICON[type] ?? '🔔'} {TYPE_LABEL[type] ?? type}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {unreadCount > 0 && (
              <Button
                variant="outline" size="sm" className="h-9 gap-2 text-xs"
                onClick={markAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* List card */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">

          {loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading notifications…</p>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                <Inbox className="h-8 w-8" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-base">All caught up</p>
                <p className="text-sm mt-1">
                  {activeFilters > 0
                    ? 'No notifications match your current filters.'
                    : tab === 'unread'
                    ? 'You have no unread notifications.'
                    : 'You have no notifications yet.'}
                </p>
              </div>
              {(activeFilters > 0 || tab === 'unread') && (
                <Button
                  variant="outline" size="sm"
                  onClick={() => { setSelectedTypes([]); setTab('all'); }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {filtered.length > 0 && (
            <>
              {visibleUnreadIds.length > 0 && (
                <div className="flex items-center justify-between px-5 py-2.5 bg-muted/40 border-b border-border">
                  <span className="text-xs text-muted-foreground">
                    {visibleUnreadIds.length} unread
                  </span>
                  <button
                    className="text-xs text-primary hover:underline font-medium"
                    onClick={() => markRead(visibleUnreadIds)}
                  >
                    Mark visible as read
                  </button>
                </div>
              )}
              <ul className="divide-y divide-border">
                {filtered.map(n => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    userRole={user?.role}
                    onMarkRead={() => markRead([n.id])}
                    onNavigate={handleNavigate}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </NotifLayout>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

type N = {
  id:        string;
  title:     string;
  message:   string;
  isRead:    boolean;
  createdAt: string;
  actionUrl?: string;
  type:      string;
};

function NotificationRow({
  notification: n,
  userRole,
  onMarkRead,
  onNavigate,
}: {
  notification: N;
  userRole?:    string;
  onMarkRead:   () => void;
  onNavigate:   (url: string) => void;
}) {
  const resolvedUrl = resolveActionUrl(n.actionUrl, userRole);

  const handleRowClick = () => {
    if (!n.isRead) onMarkRead();
    if (n.actionUrl) onNavigate(n.actionUrl);
  };

  return (
    <li
      className={cn(
        'group relative flex items-start gap-4 px-5 py-4 transition-colors',
        resolvedUrl ? 'cursor-pointer' : 'cursor-default',
        !n.isRead
          ? 'bg-primary/[0.03] hover:bg-primary/[0.06]'
          : 'hover:bg-muted/40',
      )}
      onClick={resolvedUrl ? handleRowClick : undefined}
    >
      {/* Unread indicator bar */}
      {!n.isRead && (
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-primary" />
      )}

      {/* Icon */}
      <div className={cn(
        'mt-0.5 h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center text-lg ring-1',
        typeRing(n.type),
      )}>
        {TYPE_ICON[n.type] ?? '🔔'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cn(
              'text-sm leading-snug',
              !n.isRead
                ? 'font-semibold text-foreground'
                : 'font-medium text-foreground/80',
            )}>
              {n.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
              {n.message}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
            </span>
            {!n.isRead && (
              <button
                title="Mark as read"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                onClick={e => { e.stopPropagation(); onMarkRead(); }}
              >
                <Check className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
            {TYPE_LABEL[n.type] ?? n.type}
          </Badge>
          {resolvedUrl && (
            <span className="text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              View details →
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
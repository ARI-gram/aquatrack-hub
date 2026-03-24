/**
 * src/hooks/useNotifications.ts
 *
 * Role-aware notification hook. Polls the correct endpoint every 30 s.
 *
 *   customer      → /api/customer/notifications/
 *   driver        → /api/driver/notifications/
 *   client_admin  → /api/client/notifications/
 *   site_manager  → /api/client/notifications/
 *   super_admin   → (no dedicated endpoint; unread stays 0)
 *
 * Pass `preview: true` from the navbar bell to cap results at 5.
 * The full NotificationsPage calls it without that flag.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  notificationService,
  type AppNotification,
  type DriverNotification,
} from '@/api/services/notification.service';

const POLL_INTERVAL_MS = 30_000;
const PREVIEW_LIMIT    = 5;

export type PreviewNotification = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  type: string;
};

interface UseNotificationsOptions {
  /** Cap results at 5 — use in the navbar bell dropdown. Default: false (full list). */
  preview?: boolean;
}

interface UseNotificationsReturn {
  unreadCount: number;
  notifications: PreviewNotification[];
  loading: boolean;
  markAllRead: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  refetch: () => void;
}

// ── Adapters ──────────────────────────────────────────────────────────────────

function adaptApp(n: AppNotification): PreviewNotification {
  return {
    id:        n.id,
    title:     n.title,
    message:   n.message,
    isRead:    n.isRead,
    createdAt: n.createdAt,
    actionUrl: n.actionUrl,
    type:      n.notificationType,
  };
}

function adaptDriver(n: DriverNotification): PreviewNotification {
  return {
    id:        String(n.id),
    title:     n.title,
    message:   n.message,
    isRead:    n.status !== 'ASSIGNED',
    createdAt: n.assigned_at,
    actionUrl: '/driver/deliveries',
    type:      n.type,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotifications(
  { preview = false }: UseNotificationsOptions = {},
): UseNotificationsReturn {
  const { user } = useAuth();
  const role = user?.role;

  const [unreadCount, setUnreadCount]     = useState(0);
  const [notifications, setNotifications] = useState<PreviewNotification[]>([]);
  const [loading, setLoading]             = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cap = useCallback(
    (items: PreviewNotification[]) => preview ? items.slice(0, PREVIEW_LIMIT) : items,
    [preview],
  );

  const fetchCustomer = useCallback(async () => {
    const [listRes, countRes] = await Promise.all([
      notificationService.getCustomerNotifications(preview ? { limit: PREVIEW_LIMIT } : {}),
      notificationService.getCustomerUnreadCount(),
    ]);
    setNotifications(cap(listRes.notifications.map(adaptApp)));
    setUnreadCount(countRes);
  }, [preview, cap]);

  const fetchDriver = useCallback(async () => {
    const res = await notificationService.getDriverNotifications();
    setNotifications(cap(res.notifications.map(adaptDriver)));
    setUnreadCount(res.unread_count);
  }, [cap]);

  const fetchClient = useCallback(async () => {
    const [listRes, countRes] = await Promise.all([
      notificationService.getClientNotifications(preview ? { limit: PREVIEW_LIMIT } : {}),
      notificationService.getClientUnreadCount(),
    ]);
    setNotifications(cap(listRes.notifications.map(adaptApp)));
    setUnreadCount(countRes);
  }, [preview, cap]);

  const fetch = useCallback(async () => {
    if (!role) return;

    // Prevent request if token is not yet stored
    const token = localStorage.getItem('aquatrack_token');
    if (!token) return;

    setLoading(true);
    try {
      if (role === 'customer') {
        await fetchCustomer();
      } 
      else if (role === 'driver') {
        await fetchDriver();
      } 
      else if (role === 'client_admin' || role === 'site_manager') {
        await fetchClient();
      }
      // super_admin: no endpoint yet — leave counts at 0
    } catch {
      // Silently fail — never disrupt the UI
    } finally {
      setLoading(false);
    }
  }, [role, fetchCustomer, fetchDriver, fetchClient]);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetch]);

  // ── Mark read ─────────────────────────────────────────────────────────────

  const markAllRead = useCallback(async () => {
    try {
      if (role === 'customer')
        await notificationService.markCustomerRead({ mark_all: true });
      else if (role === 'client_admin' || role === 'site_manager')
        await notificationService.markClientRead({ mark_all: true });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch { /* ignore */ }
  }, [role]);

  const markRead = useCallback(async (ids: string[]) => {
    try {
      let res: { marked_read: number; unread_count: number };
      if (role === 'customer')
        res = await notificationService.markCustomerRead({ notification_ids: ids });
      else if (role === 'client_admin' || role === 'site_manager')
        res = await notificationService.markClientRead({ notification_ids: ids });
      else return;

      setUnreadCount(res.unread_count);
      setNotifications(prev =>
        prev.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n),
      );
    } catch { /* ignore */ }
  }, [role]);

  return { unreadCount, notifications, loading, markAllRead, markRead, refetch: fetch };
}
/**
 * src/api/services/notification.service.ts
 *
 * Covers customer, driver, and client-admin notification endpoints.
 *
 * Customer:
 *   GET  /api/customer/notifications/
 *   GET  /api/customer/notifications/unread-count/
 *   POST /api/customer/notifications/mark-read/
 *
 * Driver:
 *   GET  /api/driver/notifications/
 *
 * Client admin / site manager:
 *   GET  /api/client/notifications/
 *   GET  /api/client/notifications/unread-count/
 *   POST /api/client/notifications/mark-read/
 */

import axiosInstance from '@/api/axios.config';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type NotificationType =
  | 'ORDER_PLACED' | 'ORDER_CONFIRMED' | 'ORDER_ASSIGNED'
  | 'ORDER_PICKED_UP' | 'ORDER_IN_TRANSIT' | 'ORDER_ARRIVED'
  | 'ORDER_DELIVERED' | 'ORDER_CANCELLED'
  | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'WALLET_TOPUP'
  | 'WALLET_LOW_BALANCE' | 'REFUND_PROCESSED'
  | 'BOTTLES_LOW' | 'BOTTLES_EMPTY' | 'BOTTLE_EXCHANGE' | 'BOTTLE_DEPOSIT'
  | 'DRIVER_ASSIGNED' | 'DRIVER_NEARBY' | 'DRIVER_WAITING'
  | 'PROMOTION' | 'DISCOUNT' | 'REFERRAL_REWARD'
  | 'SYSTEM_ANNOUNCEMENT' | 'ACCOUNT_UPDATE' | 'MAINTENANCE'
  | 'DELIVERY_OTP' | 'DELIVERY_ASSIGNED'
  | 'STOCK_PICKUP';

export interface AppNotification {
  id: string;
  notificationType: NotificationType | string;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  actionUrl: string;
  actionLabel: string;
  extraData: Record<string, unknown> | null;
  isExpired: boolean;
}

export interface DriverNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  order_number: string;
  scheduled_date: string | null;
  scheduled_time_slot: string;
  status: string;
  assigned_at: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  unread_count: number;
  total: number;
  page?: number;
  limit?: number;
  total_pages?: number;
}

export interface DriverNotificationListResponse {
  notifications: DriverNotification[];
  unread_count: number;
  total: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const notificationService = {

  // ── Customer ───────────────────────────────────────────────────────────────

  async getCustomerNotifications(params?: {
    page?: number;
    limit?: number;
    unread_only?: boolean;
  }): Promise<NotificationListResponse> {
    const res = await axiosInstance.get<NotificationListResponse>(
      '/customer/notifications/',
      { params },
    );
    return res.data;
  },

  async getCustomerUnreadCount(): Promise<number> {
    const res = await axiosInstance.get<{ unread_count: number }>(
      '/customer/notifications/unread-count/',
    );
    return res.data.unread_count;
  },

  async markCustomerRead(payload: {
    notification_ids?: string[];
    mark_all?: boolean;
  }): Promise<{ marked_read: number; unread_count: number }> {
    const res = await axiosInstance.post('/customer/notifications/mark-read/', payload);
    return res.data;
  },

  // ── Driver ─────────────────────────────────────────────────────────────────

  async getDriverNotifications(params?: {
    unread_only?: boolean;
  }): Promise<DriverNotificationListResponse> {
    const res = await axiosInstance.get<DriverNotificationListResponse>(
      '/driver/notifications/',
      { params },
    );
    return res.data;
  },

  // ── Client admin / site manager ────────────────────────────────────────────

  async getClientNotifications(params?: {
    page?: number;
    limit?: number;
    unread_only?: boolean;
    type?: string;
  }): Promise<NotificationListResponse> {
    const res = await axiosInstance.get<NotificationListResponse>(
      '/client/notifications/',
      { params },
    );
    return res.data;
  },

  async getClientUnreadCount(): Promise<number> {
    const res = await axiosInstance.get<{ unread_count: number }>(
      '/client/notifications/unread-count/',
    );
    return res.data.unread_count;
  },

  async markClientRead(payload: {
    notification_ids?: string[];
    mark_all?: boolean;
  }): Promise<{ marked_read: number; unread_count: number }> {
    const res = await axiosInstance.post('/client/notifications/mark-read/', payload);
    return res.data;
  },
};
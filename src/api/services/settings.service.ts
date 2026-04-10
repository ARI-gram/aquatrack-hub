/**
 * Settings Service
 * Wraps system-level and client-level settings endpoints.
 * src/api/services/settings.service.ts
 */

import axiosInstance from '../axios.config';
import { API_ENDPOINTS } from '../endpoints';

// ─── Error shape ──────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  response?: {
    data?: {
      detail?:           string;
      old_password?:     string[];
      non_field_errors?: string[];
    };
  };
}

// ─── System Settings (Super Admin) ───────────────────────────────────────────

export interface SystemSettings {
  platformName:       string;
  supportEmail:       string;
  timezone:           string;
  currency:           string;
  enableDarkMode:     boolean;
  enableAnalytics:    boolean;
  maintenanceMode:    boolean;
  sessionTimeout:     number;
  maxLoginAttempts:   number;
  require2FA:         boolean;
  ipWhitelisting:     boolean;
  emailNotifications: boolean;
  smsNotifications:   boolean;
  pushNotifications:  boolean;
  smtpHost:           string;
  smtpPort:           string;
  smtpUser:           string;
  smtpPass:           string;
  emailFooter:        string;
}

// ─── Client Notification Settings ────────────────────────────────────────────

export interface ClientNotificationSettings {
  newOrderAlerts:    boolean;
  deliveryUpdates:   boolean;
  paymentReceived:   boolean;
  lowStockAlerts:    boolean;
  weeklyReports:     boolean;
  orderConfirmation: boolean;
  deliverySms:       boolean;
  invoiceEmails:     boolean;
}

// ─── Extended Client type for business settings fields ───────────────────────

export interface ClientBusinessSettings {
  timezone?:      string;
  currency?:      string;
  taxRate?:       string;
  invoicePrefix?: string;
}

export const settingsService = {
  // ── System ──────────────────────────────────────────────────────────────

  async getSystemSettings(): Promise<SystemSettings> {
    const response = await axiosInstance.get<SystemSettings>(
      API_ENDPOINTS.SYSTEM.SETTINGS
    );
    return response.data;
  },

  async updateSystemSettings(data: Partial<SystemSettings>): Promise<SystemSettings> {
    const response = await axiosInstance.patch<SystemSettings>(
      API_ENDPOINTS.SYSTEM.SETTINGS,
      data
    );
    return response.data;
  },

  // ── Client notifications ────────────────────────────────────────────────

  async getClientNotificationSettings(
    clientId: string
  ): Promise<ClientNotificationSettings> {
    const response = await axiosInstance.get<ClientNotificationSettings>(
      `${API_ENDPOINTS.CLIENTS.SETTINGS(clientId)}notifications/`
    );
    return response.data;
  },

  async updateClientNotificationSettings(
    clientId: string,
    data: Partial<ClientNotificationSettings>
  ): Promise<ClientNotificationSettings> {
    const response = await axiosInstance.patch<ClientNotificationSettings>(
      `${API_ENDPOINTS.CLIENTS.SETTINGS(clientId)}notifications/`,
      data
    );
    return response.data;
  },
};

export default settingsService;
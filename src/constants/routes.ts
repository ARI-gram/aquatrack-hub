/**
 * Route Constants
 * src/constants/routes.ts
 */

import { UserRole } from '@/types/auth.types';

export const ROUTES = {
  // Public routes
  LOGIN:           '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD:  '/reset-password', 

  // Super Admin routes
  SUPER_ADMIN: {
    DASHBOARD:  '/admin',
    CLIENTS:    '/admin/clients',
    BILLING:    '/admin/billing',
    SETTINGS:   '/admin/settings',
    AUDIT_LOGS: '/admin/audit-logs',
  },

  // Client Admin routes
  CLIENT_ADMIN: {
    DASHBOARD:  '/client',
    ORDERS:     '/client/orders',
    DELIVERIES: '/client/deliveries',
    CUSTOMERS:  '/client/customers',
    INVOICES:   '/client/invoices',
    STORE:      '/client/store',
    PRODUCTS:   '/client/products',
    REPORTS:    '/client/reports',
    EMPLOYEES:  '/client/employees',
    SETTINGS:   '/client/settings',
  },

  // Accountant routes — scoped to accounts module only
  ACCOUNTANT: {
    DASHBOARD: '/client/accounts/dashboard',   // ← new landing page
    INVOICES:  '/client/accounts/invoices',
    REPORTS:   '/client/accounts/reports',
    SETTINGS:  '/client/accounts/settings',
  },

  // Site Manager routes — manages a physical depot/branch
  SITE_MANAGER: {
    DASHBOARD:    '/manager',
    ORDERS:       '/manager/orders',
    DELIVERIES:   '/manager/deliveries',
    DRIVERS:      '/manager/drivers',
    CUSTOMERS:    '/manager/customers',
    STOCK:        '/manager/stock',
    DIRECT_SALES: '/manager/direct-sales',
    REPORTS:      '/manager/reports',
  },

  // Driver routes
  DRIVER: {
    DASHBOARD:       '/driver',
    DELIVERIES:      '/driver/deliveries',
    DELIVERY_DETAIL: '/driver/deliveries/:id',
    STORE:           '/driver/store',
  },

  // Customer routes
  CUSTOMER: {
    DASHBOARD:     '/customer',
    PLACE_ORDER:   '/customer/order',
    ORDER_HISTORY: '/customer/history',
    WALLET:        '/customer/wallet',
  },
} as const;

/**
 * Where each role lands immediately after login.
 */
export const roleDefaultRoutes: Record<UserRole, string> = {
  super_admin:  ROUTES.SUPER_ADMIN.DASHBOARD,
  client_admin: ROUTES.CLIENT_ADMIN.DASHBOARD,
  site_manager: ROUTES.SITE_MANAGER.DASHBOARD,
  driver:       ROUTES.DRIVER.DASHBOARD,
  accountant:   ROUTES.ACCOUNTANT.DASHBOARD,   // ← now goes to dashboard
  customer:     ROUTES.CUSTOMER.DASHBOARD,
};
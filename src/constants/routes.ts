import { UserRole } from '@/types/auth.types';

export const ROUTES = {
  // Public routes
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  
  // Super Admin routes
  SUPER_ADMIN: {
    DASHBOARD: '/admin',
    CLIENTS: '/admin/clients',
    BILLING: '/admin/billing',
    SETTINGS: '/admin/settings',
    AUDIT_LOGS: '/admin/audit-logs',
  },
  
  // Client Admin routes
  CLIENT_ADMIN: {
    DASHBOARD: '/client',
    ORDERS: '/client/orders',
    DELIVERIES: '/client/deliveries',
    CUSTOMERS: '/client/customers',
    INVOICES: '/client/invoices',
    INVENTORY: '/client/inventory',
    REPORTS: '/client/reports',
    EMPLOYEES: '/client/employees',
    SETTINGS: '/client/settings',
  },
  
  // Site Manager routes
  SITE_MANAGER: {
    DASHBOARD: '/manager',
    CREATE_ORDER: '/manager/create-order',
    ORDERS: '/manager/orders',
    INVENTORY: '/manager/inventory',
  },
  
  // Driver routes
  DRIVER: {
    DASHBOARD: '/driver',
    DELIVERIES: '/driver/deliveries',
    DELIVERY_DETAIL: '/driver/deliveries/:id',
  },
  
  // Customer routes
  CUSTOMER: {
    DASHBOARD: '/customer',
    PLACE_ORDER: '/customer/order',
    ORDER_HISTORY: '/customer/history',
    WALLET: '/customer/wallet',
  },
} as const;

export const roleDefaultRoutes: Record<UserRole, string> = {
  super_admin: ROUTES.SUPER_ADMIN.DASHBOARD,
  client_admin: ROUTES.CLIENT_ADMIN.DASHBOARD,
  site_manager: ROUTES.SITE_MANAGER.DASHBOARD,
  driver: ROUTES.DRIVER.DASHBOARD,
  customer: ROUTES.CUSTOMER.DASHBOARD,
};

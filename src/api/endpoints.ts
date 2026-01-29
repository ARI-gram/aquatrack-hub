/**
 * API Endpoints
 * Centralized endpoint definitions for all API calls
 */

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH_TOKEN: '/auth/refresh-token',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password',
    VERIFY_EMAIL: '/auth/verify-email',
  },

  // Users
  USERS: {
    BASE: '/users',
    BY_ID: (id: string) => `/users/${id}`,
    PROFILE: '/users/profile',
    UPDATE_AVATAR: '/users/avatar',
    BY_ROLE: (role: string) => `/users/role/${role}`,
  },

  // Clients (Distributors)
  CLIENTS: {
    BASE: '/clients',
    BY_ID: (id: string) => `/clients/${id}`,
    STATS: (id: string) => `/clients/${id}/stats`,
    EMPLOYEES: (id: string) => `/clients/${id}/employees`,
    SETTINGS: (id: string) => `/clients/${id}/settings`,
  },

  // Orders
  ORDERS: {
    BASE: '/orders',
    BY_ID: (id: string) => `/orders/${id}`,
    BY_CLIENT: (clientId: string) => `/orders/client/${clientId}`,
    BY_CUSTOMER: (customerId: string) => `/orders/customer/${customerId}`,
    BY_STATUS: (status: string) => `/orders/status/${status}`,
    BULK_IMPORT: '/orders/bulk-import',
    UPDATE_STATUS: (id: string) => `/orders/${id}/status`,
  },

  // Deliveries
  DELIVERIES: {
    BASE: '/deliveries',
    BY_ID: (id: string) => `/deliveries/${id}`,
    BY_DRIVER: (driverId: string) => `/deliveries/driver/${driverId}`,
    BY_ORDER: (orderId: string) => `/deliveries/order/${orderId}`,
    UPDATE_STATUS: (id: string) => `/deliveries/${id}/status`,
    PROOF_OF_DELIVERY: (id: string) => `/deliveries/${id}/proof`,
    ROUTE: (driverId: string) => `/deliveries/driver/${driverId}/route`,
  },

  // Customers
  CUSTOMERS: {
    BASE: '/customers',
    BY_ID: (id: string) => `/customers/${id}`,
    BY_CLIENT: (clientId: string) => `/customers/client/${clientId}`,
    WALLET: (id: string) => `/customers/${id}/wallet`,
    TRANSACTIONS: (id: string) => `/customers/${id}/transactions`,
    ORDERS: (id: string) => `/customers/${id}/orders`,
  },

  // Invoices
  INVOICES: {
    BASE: '/invoices',
    BY_ID: (id: string) => `/invoices/${id}`,
    BY_CLIENT: (clientId: string) => `/invoices/client/${clientId}`,
    BY_CUSTOMER: (customerId: string) => `/invoices/customer/${customerId}`,
    GENERATE: '/invoices/generate',
    DOWNLOAD: (id: string) => `/invoices/${id}/download`,
    SEND: (id: string) => `/invoices/${id}/send`,
  },

  // Inventory
  INVENTORY: {
    BASE: '/inventory',
    BY_ID: (id: string) => `/inventory/${id}`,
    BY_CLIENT: (clientId: string) => `/inventory/client/${clientId}`,
    BY_SITE: (siteId: string) => `/inventory/site/${siteId}`,
    MOVEMENTS: (id: string) => `/inventory/${id}/movements`,
    ADJUST: (id: string) => `/inventory/${id}/adjust`,
    TRANSFER: '/inventory/transfer',
  },

  // Reports
  REPORTS: {
    DAILY: '/reports/daily',
    WEEKLY: '/reports/weekly',
    MONTHLY: '/reports/monthly',
    SALES: '/reports/sales',
    DELIVERIES: '/reports/deliveries',
    FINANCIAL: '/reports/financial',
    CUSTOM: '/reports/custom',
    EXPORT: '/reports/export',
  },

  // Billing & Subscriptions (Super Admin)
  BILLING: {
    PLANS: '/billing/plans',
    PLAN_BY_ID: (id: string) => `/billing/plans/${id}`,
    SUBSCRIPTIONS: '/billing/subscriptions',
    SUBSCRIPTION_BY_ID: (id: string) => `/billing/subscriptions/${id}`,
    INVOICES: '/billing/invoices',
  },

  // System Settings (Super Admin)
  SYSTEM: {
    SETTINGS: '/system/settings',
    AUDIT_LOGS: '/system/audit-logs',
    NOTIFICATIONS: '/system/notifications',
    MAINTENANCE: '/system/maintenance',
  },
} as const;

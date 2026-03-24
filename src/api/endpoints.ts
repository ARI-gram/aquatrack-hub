/**
 * API Endpoints
 * /src/api/endpoints.ts
 */
// /src/api/endpoints.ts
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login/',
    LOGOUT: '/auth/logout/',
    REFRESH_TOKEN: '/auth/refresh-token/',
    FORGOT_PASSWORD: '/auth/forgot-password/',
    RESET_PASSWORD: '/auth/reset-password/',
    CHANGE_PASSWORD: '/auth/change-password/',
    VERIFY_EMAIL: '/auth/verify-email/',
  },

  // Users
  USERS: {
    BASE: '/users/',
    BY_ID: (id: string) => `/users/${id}/`,
    PROFILE: '/users/profile/',
    UPDATE_AVATAR: '/users/avatar/',
    BY_ROLE: (role: string) => `/users/role/${role}/`,
  },

  // Clients (Distributors)
  CLIENTS: {
    BASE: '/clients/',
    BY_ID: (id: string) => `/clients/${id}/`,
    SUSPEND: (id: string) => `/clients/${id}/suspend/`,
    STATS: (id: string) => `/clients/${id}/stats/`,
    EMPLOYEES: (id: string) => `/clients/${id}/employees/`,
    SETTINGS: (id: string) => `/clients/${id}/settings/`,
    RESET_CREDENTIALS: (id: string) => `/clients/${id}/reset-credentials/`,
  },

  // Billing & Subscriptions
  BILLING: {
    SUBSCRIPTIONS: '/billing/subscriptions/',
    STATS: '/billing/subscriptions/stats/',
    INVOICES: '/billing/invoices/',
    INVOICE_BY_ID: (id: string) => `/billing/invoices/${id}/`,
    MARK_PAID: (id: string) => `/billing/invoices/${id}/mark-paid/`,
  },

  // Orders
  ORDERS: {
    BASE: '/orders/',
    BY_ID: (id: string) => `/orders/${id}/`,
    BY_CLIENT: (clientId: string) => `/orders/client/${clientId}/`,
    BY_CUSTOMER: (customerId: string) => `/orders/customer/${customerId}/`,
    BY_STATUS: (status: string) => `/orders/status/${status}/`,
    BULK_IMPORT: '/orders/bulk-import/',
    UPDATE_STATUS: (id: string) => `/orders/${id}/status/`,
  },

  // Deliveries
  DELIVERIES: {
    // Client dashboard
    CLIENT_LIST:     '/client/deliveries/',
    CLIENT_STATS:    '/client/deliveries/stats/',
    CLIENT_BY_ID:    (id: string) => `/client/deliveries/${id}/`,
    ASSIGN_ORDER:    '/client/orders/assign/',
    ASSIGN_DELIVERY: '/client/deliveries/assign/',
    AVAILABLE_DRIVERS: '/client/drivers/available/',

    // Driver app
    DRIVER_LIST:     '/driver/deliveries/',
    DRIVER_BY_ID:    (id: string) => `/driver/deliveries/${id}/`,
    DRIVER_PROFILE:  '/driver/profile/',
    ACCEPT:          (id: string) => `/driver/deliveries/${id}/accept/`,
    UPDATE_STATUS:   (id: string) => `/driver/deliveries/${id}/status/`,
    UPDATE_LOCATION: (id: string) => `/driver/deliveries/${id}/location/`,
    COMPLETE:        (id: string) => `/driver/deliveries/${id}/complete/`,

    // Public
    TRACK:           (orderNumber: string) => `/track/${orderNumber}/`,
  },
  // Customers
  CUSTOMERS: {
    BASE: '/customers/',
    BY_ID: (id: string) => `/customers/${id}/`,
    BY_CLIENT: (clientId: string) => `/customers/client/${clientId}/`,
    WALLET: (id: string) => `/customers/${id}/wallet/`,
    TRANSACTIONS: (id: string) => `/customers/${id}/transactions/`,
    ORDERS: (id: string) => `/customers/${id}/orders/`,
  },

  // Invoices (client-facing, separate from billing)
  INVOICES: {
    BASE: '/invoices/',
    BY_ID: (id: string) => `/invoices/${id}/`,
    BY_CLIENT: (clientId: string) => `/invoices/client/${clientId}/`,
    BY_CUSTOMER: (customerId: string) => `/invoices/customer/${customerId}/`,
    GENERATE: '/invoices/generate/',
    DOWNLOAD: (id: string) => `/invoices/${id}/download/`,
    SEND: (id: string) => `/invoices/${id}/send/`,
  },

  // Inventory
  INVENTORY: {
    BASE: '/inventory/',
    BY_ID: (id: string) => `/inventory/${id}/`,
    BY_CLIENT: (clientId: string) => `/inventory/client/${clientId}/`,
    BY_SITE: (siteId: string) => `/inventory/site/${siteId}/`,
    MOVEMENTS: (id: string) => `/inventory/${id}/movements/`,
    ADJUST: (id: string) => `/inventory/${id}/adjust/`,
    TRANSFER: '/inventory/transfer/',
  },

  // Reports
  REPORTS: {
    DAILY: '/reports/daily/',
    WEEKLY: '/reports/weekly/',
    MONTHLY: '/reports/monthly/',
    SALES: '/reports/sales/',
    DELIVERIES: '/reports/deliveries/',
    FINANCIAL: '/reports/financial/',
    CUSTOM: '/reports/custom/',
    EXPORT: '/reports/export/',
  },

  // System Settings (Super Admin)
  SYSTEM: {
    SETTINGS: '/system/settings/',
    AUDIT_LOGS: '/system/audit-logs/',
    NOTIFICATIONS: '/system/notifications/',
    MAINTENANCE: '/system/maintenance/',
  },
} as const;
/**
 * Customer API Endpoints
 * Extends the main endpoints file with customer-specific endpoints
 */

export const CUSTOMER_API_ENDPOINTS = {
  // Customer Authentication
  AUTH: {
    REGISTER: '/customer/auth/register',
    LOGIN: '/customer/auth/login',
    VERIFY_OTP: '/customer/auth/verify-otp',
    SEND_OTP: '/customer/auth/send-otp',
    LOGOUT: '/customer/auth/logout',
    REFRESH_TOKEN: '/customer/auth/refresh-token',
  },

  // Customer Profile
  PROFILE: {
    GET: '/customer/profile',
    UPDATE: '/customer/profile',
    ADDRESSES: '/customer/addresses',
    ADDRESS_BY_ID: (id: string) => `/customer/addresses/${id}`,
    PREFERENCES: '/customer/preferences',
  },

  // Bottle Management
  BOTTLES: {
    INVENTORY: '/customer/bottles/inventory',
    HISTORY: '/customer/bottles/history',
    PURCHASE: '/customer/bottles/purchase',
    DEPOSIT_INFO: '/customer/bottles/deposit-info',
    CONFIRM_EXCHANGE: (orderId: string) => `/customer/bottles/exchange/${orderId}/confirm`,
  },

  // Customer Orders
  ORDERS: {
    LIST: '/customer/orders',
    CREATE: '/customer/orders',
    BY_ID: (id: string) => `/customer/orders/${id}`,
    CANCEL: (id: string) => `/customer/orders/${id}/cancel`,
    TRACK: (id: string) => `/customer/orders/${id}/track`,
    ACTIVE: '/customer/orders/active',
    CONFIRM_DELIVERY: (id: string) => `/customer/orders/${id}/confirm-delivery`,
  },

  // Wallet
  WALLET: {
    GET: '/customer/wallet',
    TOPUP: '/customer/wallet/topup',
    TRANSACTIONS: '/customer/wallet/transactions',
    AUTO_TOPUP_SETTINGS: '/customer/wallet/auto-topup',
  },

  // Notifications
  NOTIFICATIONS: {
    LIST: '/customer/notifications',
    MARK_READ: (id: string) => `/customer/notifications/${id}/read`,
    MARK_ALL_READ: '/customer/notifications/read-all',
    SETTINGS: '/customer/notifications/settings',
  },

  // Support
  SUPPORT: {
    CREATE_TICKET: '/customer/support/ticket',
    TICKETS: '/customer/support/tickets',
    FAQ: '/customer/support/faq',
  },

  // Pricing (public)
  PRICING: {
    GET: '/pricing',
    TIME_SLOTS: '/pricing/time-slots',
  },
} as const;

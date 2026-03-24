/**
 * Customer API Endpoints
 * Matches /apps/customers/urls.py exactly
 */
// /src/api/customerEndpoints.ts

export const CUSTOMER_API_ENDPOINTS = {
  // Customer Authentication
  AUTH: {
    REGISTER:      '/customer/auth/register/',
    LOGIN:         '/customer/auth/verify-otp/',
    VERIFY_OTP:    '/customer/auth/verify-otp/',
    SEND_OTP:      '/customer/auth/send-otp/',
    LOGOUT:        '/customer/auth/logout/',
    REFRESH_TOKEN: '/auth/refresh-token/',
  },

  // Customer Profile
  PROFILE: {
    GET:             '/customer/profile/',
    UPDATE:          '/customer/profile/',
    ADDRESSES:       '/customer/addresses/',
    ADDRESS_BY_ID:   (id: string) => `/customer/addresses/${id}/`,
    PREFERENCES:     '/customer/preferences/',
    PAYMENT_PROFILE: '/customer/payment-profile/',
  },

  // Bottle Management
  BOTTLES: {
    INVENTORY:        '/customer/bottles/inventory/',
    HISTORY:          '/customer/bottles/history/',
    PURCHASE:         '/customer/bottles/purchase/',
    DEPOSIT_INFO:     '/customer/bottles/deposit-info/',
    CONFIRM_EXCHANGE: (orderId: string) => `/customer/bottles/exchange/${orderId}/confirm/`,
  },

  // Customer Orders
  ORDERS: {
    LIST:             '/customer/orders/',
    CREATE:           '/customer/orders/create/',
    BY_ID:            (id: string) => `/customer/orders/${id}/`,
    CANCEL:           (id: string) => `/customer/orders/${id}/cancel/`,
    TRACK:            (id: string) => `/customer/orders/${id}/track/`,
    ACTIVE:           '/customer/orders/?status=IN_TRANSIT',
    CONFIRM_DELIVERY: (id: string) => `/customer/orders/${id}/confirm-delivery/`,
    // Re-send invoice to the customer for credit orders
    REQUEST_INVOICE:  (id: string) => `/customer/orders/${id}/request-invoice/`,
  },

  // Wallet
  WALLET: {
    GET:                 '/customer/wallet/',
    TOPUP:               '/customer/wallet/topup/',
    TRANSACTIONS:        '/customer/wallet/transactions/',
    AUTO_TOPUP_SETTINGS: '/customer/wallet/auto-topup/',
  },

  // Notifications
  NOTIFICATIONS: {
    LIST:          '/customer/notifications/',
    MARK_READ:     (id: string) => `/customer/notifications/${id}/read/`,
    MARK_ALL_READ: '/customer/notifications/read-all/',
    SETTINGS:      '/customer/notifications/settings/',
    UNREAD_COUNT:  '/customer/notifications/unread-count/',
  },

  // Support
  SUPPORT: {
    CREATE_TICKET: '/customer/support/ticket/',
    TICKETS:       '/customer/support/tickets/',
    FAQ:           '/customer/support/faq/',
  },

  // Pricing (public)
  PRICING: {
    GET:        '/pricing/',
    TIME_SLOTS: '/pricing/time-slots/',
  },

  // Credit account (credit/cheque customers only)
  CREDIT: {
    STATUS:        '/customer/credit/status/',
    GRACE_REQUEST: '/customer/credit/grace-request/',
  },

  // Product catalogue for the order page
  PRODUCTS: {
    LIST: '/customer/products/',
  },

} as const;
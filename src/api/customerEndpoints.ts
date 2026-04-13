/**
 * Customer API Endpoints
 * Matches actual Django urls.py registrations exactly:
 *
 *   api/customer/   → apps/customers/urls.py   (customer self-service)
 *   api/wallet/     → apps/wallet/urls.py
 *   api/bottles/    → apps/bottles/urls.py
 *   api/orders/     → apps/orders/urls.py      (shared, used by customer too)
 */

export const CUSTOMER_API_ENDPOINTS = {
  // ── Authentication ────────────────────────────────────────────────────────
  // Mounted at api/customer/ via apps/customers/urls.py
  AUTH: {
    REGISTER:      '/customer/auth/register/',
    LOGIN:         '/customer/auth/verify-otp/',
    VERIFY_OTP:    '/customer/auth/verify-otp/',
    SEND_OTP:      '/customer/auth/send-otp/',
    LOGOUT:        '/customer/auth/logout/',
    REFRESH_TOKEN: '/auth/refresh-token/',
  },

  // ── Customer Profile ──────────────────────────────────────────────────────
  // Mounted at api/customer/ via apps/customers/urls.py
  PROFILE: {
    GET:             '/customer/profile/',
    UPDATE:          '/customer/profile/',
    ADDRESSES:       '/customer/addresses/',
    ADDRESS_BY_ID:   (id: string) => `/customer/addresses/${id}/`,
    PREFERENCES:     '/customer/preferences/',
    PAYMENT_PROFILE: '/customer/payment-profile/',
  },

  // ── Bottle Management ─────────────────────────────────────────────────────
  // Mounted at api/bottles/ via apps/bottles/urls.py
  // NOTE: was wrongly pointing to /customer/bottles/ — that route does not exist
  BOTTLES: {
    INVENTORY:        '/bottles/inventory',
    HISTORY:          '/bottles/transactions',
    PURCHASE:         '/bottles/purchase',           // not yet implemented on backend
    DEPOSIT_INFO:     '/bottles/deposit-info',       // not yet implemented on backend
    CONFIRM_EXCHANGE: (orderId: string) => `/bottles/${orderId}/confirm-exchange`,
  },

  // ── Customer Orders ───────────────────────────────────────────────────────
  // Mounted at api/customer/ via apps/customers/urls.py
  ORDERS: {
    LIST:             '/customer/orders/',
    CREATE:           '/customer/orders/create/',
    BY_ID:            (id: string) => `/customer/orders/${id}/`,
    CANCEL:           (id: string) => `/customer/orders/${id}/cancel/`,
    TRACK:            (id: string) => `/customer/orders/${id}/track/`,
    ACTIVE:           '/customer/orders/?status=IN_TRANSIT',
    CONFIRM_DELIVERY: (id: string) => `/customer/orders/${id}/confirm-delivery/`,
    REQUEST_INVOICE:  (id: string) => `/customer/orders/${id}/request-invoice/`,
  },

  // ── Wallet ────────────────────────────────────────────────────────────────
  // Mounted at api/wallet/ via apps/wallet/urls.py
  // NOTE: was wrongly pointing to /customer/wallet/ — that route does not exist
  WALLET: {
    GET:                 '/wallet/',
    TOPUP:               '/wallet/topup',
    TRANSACTIONS:        '/wallet/transactions',
    AUTO_TOPUP_SETTINGS: '/wallet/',               // same WalletView, use PUT
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  // Mounted at api/customer/notifications/ via customer_notification_urls
  NOTIFICATIONS: {
    LIST:          '/customer/notifications/',
    MARK_READ:     (id: string) => `/customer/notifications/${id}/read/`,
    MARK_ALL_READ: '/customer/notifications/read-all/',
    SETTINGS:      '/customer/notifications/settings/',
    UNREAD_COUNT:  '/customer/notifications/unread-count/',
  },

  // ── Support ───────────────────────────────────────────────────────────────
  SUPPORT: {
    CREATE_TICKET: '/customer/support/ticket/',
    TICKETS:       '/customer/support/tickets/',
    FAQ:           '/customer/support/faq/',
  },

  // ── Pricing ───────────────────────────────────────────────────────────────
  PRICING: {
    GET:        '/pricing/',
    TIME_SLOTS: '/pricing/time-slots/',
  },

  // ── Credit account ────────────────────────────────────────────────────────
  // Mounted at api/customer/ via apps/customers/urls.py
  CREDIT: {
    STATUS:        '/customer/credit/status/',
    GRACE_REQUEST: '/customer/credit/grace-request/',
  },

  // ── Product catalogue ─────────────────────────────────────────────────────
  // Mounted at api/customer/ via apps/customers/urls.py
  PRODUCTS: {
    LIST: '/customer/products/',
  },

} as const;
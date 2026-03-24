/**
 * Customer Portal Route Constants
 * /src/constants/customerRoutes.ts
 */

export const CUSTOMER_ROUTES = {
  // Auth
  LOGIN:           '/customer/login',
  REGISTER:        '/customer/register',
  JOIN:            '/join/:token',          // public invite link

  // Main portal (all require 'customer' role)
  DASHBOARD:       '/customer',
  PLACE_ORDER:     '/customer/order',
  ORDER_HISTORY:   '/customer/history',
  WALLET:          '/customer/wallet',
  BOTTLES:         '/customer/bottles',
  PROFILE:         '/customer/profile',
  ADDRESSES:       '/customer/addresses',
  NOTIFICATIONS:   '/customer/notifications',
  SUPPORT:         '/customer/support',
  PAYMENT_PROFILE: '/customer/payment-profile',

  // Order tracking
  ORDER_TRACK:     '/customer/orders/:id/track',
} as const;

export type CustomerRoute = (typeof CUSTOMER_ROUTES)[keyof typeof CUSTOMER_ROUTES];
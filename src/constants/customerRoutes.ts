/**
 * Customer Portal Route Constants
 */

export const CUSTOMER_ROUTES = {
  // Auth routes
  LOGIN: '/customer/login',
  REGISTER: '/customer/register',
  VERIFY_OTP: '/customer/verify',
  CHOOSE_PLAN: '/customer/choose-plan',
  
  // Main portal routes
  DASHBOARD: '/customer',
  PLACE_ORDER: '/customer/order',
  ORDER_HISTORY: '/customer/history',
  TRACK_ORDER: '/customer/track/:orderId',
  ACTIVE_ORDERS: '/customer/active-orders',
  
  // Bottle management
  BOTTLES: '/customer/bottles',
  BUY_BOTTLES: '/customer/bottles/buy',
  DEPOSITS: '/customer/bottles/deposits',
  
  // Wallet & payments
  WALLET: '/customer/wallet',
  PAYMENT_METHODS: '/customer/payment-methods',
  
  // Profile & settings
  PROFILE: '/customer/profile',
  ADDRESSES: '/customer/addresses',
  NOTIFICATIONS: '/customer/notifications',
  SUPPORT: '/customer/support',
} as const;

export const CUSTOMER_NAV_ITEMS = [
  {
    label: 'Dashboard',
    path: CUSTOMER_ROUTES.DASHBOARD,
    icon: 'Home',
  },
  {
    label: 'Place Order',
    path: CUSTOMER_ROUTES.PLACE_ORDER,
    icon: 'ShoppingCart',
  },
  {
    label: 'My Bottles',
    path: CUSTOMER_ROUTES.BOTTLES,
    icon: 'Package',
  },
  {
    label: 'Wallet',
    path: CUSTOMER_ROUTES.WALLET,
    icon: 'Wallet',
  },
  {
    label: 'Order History',
    path: CUSTOMER_ROUTES.ORDER_HISTORY,
    icon: 'History',
  },
  {
    label: 'Profile',
    path: CUSTOMER_ROUTES.PROFILE,
    icon: 'User',
  },
];

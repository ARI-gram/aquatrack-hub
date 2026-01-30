/**
 * Customer Pricing Constants
 * Default pricing structure for AquaTrack
 */

export const CUSTOMER_PRICING = {
  // Refill pricing
  REFILL_PRICE: 3.00,
  MIN_REFILL_ORDER: 1,
  
  // New bottle pricing (includes bottle + water)
  NEW_BOTTLE_PRICE: 8.00,
  MIN_NEW_BOTTLE_ORDER: 1,
  
  // Bottle purchase for refill customers
  BOTTLE_PURCHASE_PRICE: 10.00,
  BOTTLE_DEPOSIT: 10.00,
  MIN_BOTTLE_PURCHASE: 3,
  MAX_BOTTLE_PURCHASE: 50,
  
  // Delivery fees
  DELIVERY_FEE: 2.00,
  URGENT_DELIVERY_FEE: 5.00,
  AFTER_HOURS_FEE: 3.00,
  FREE_DELIVERY_THRESHOLD: 20.00,
  
  // Currency
  CURRENCY: 'USD',
  CURRENCY_SYMBOL: '$',
} as const;

export const BULK_DISCOUNTS = [
  { minQuantity: 5, discountPercentage: 5 },
  { minQuantity: 10, discountPercentage: 10 },
  { minQuantity: 20, discountPercentage: 15 },
] as const;

export const DELIVERY_TIME_SLOTS = [
  { id: '1', label: '8:00 AM - 10:00 AM', startTime: '08:00', endTime: '10:00' },
  { id: '2', label: '10:00 AM - 12:00 PM', startTime: '10:00', endTime: '12:00' },
  { id: '3', label: '12:00 PM - 2:00 PM', startTime: '12:00', endTime: '14:00' },
  { id: '4', label: '2:00 PM - 4:00 PM', startTime: '14:00', endTime: '16:00' },
  { id: '5', label: '4:00 PM - 6:00 PM', startTime: '16:00', endTime: '18:00' },
  { id: '6', label: '6:00 PM - 8:00 PM (After Hours)', startTime: '18:00', endTime: '20:00', surcharge: 3.00 },
] as const;

export const ORDER_VALIDATION = {
  MIN_ORDER_QUANTITY: 1,
  MAX_ORDER_QUANTITY: 20,
  MIN_DELIVERY_HOURS_NOTICE: 2,
  MAX_DELIVERY_DAYS_AHEAD: 14,
} as const;

export const WALLET_LIMITS = {
  MIN_TOPUP: 5.00,
  MAX_TOPUP: 500.00,
  MAX_BALANCE: 1000.00,
  QUICK_TOPUP_AMOUNTS: [10, 20, 50, 100],
} as const;

/**
 * Calculate price with bulk discount
 */
export function calculatePriceWithDiscount(
  quantity: number,
  unitPrice: number
): { subtotal: number; discount: number; total: number } {
  const subtotal = quantity * unitPrice;
  
  let discountPercentage = 0;
  for (const tier of BULK_DISCOUNTS) {
    if (quantity >= tier.minQuantity) {
      discountPercentage = tier.discountPercentage;
    }
  }
  
  const discount = subtotal * (discountPercentage / 100);
  const total = subtotal - discount;
  
  return { subtotal, discount, total };
}

/**
 * Calculate delivery fee
 */
export function calculateDeliveryFee(
  orderTotal: number,
  isUrgent: boolean = false,
  isAfterHours: boolean = false
): number {
  if (orderTotal >= CUSTOMER_PRICING.FREE_DELIVERY_THRESHOLD) {
    return isUrgent ? CUSTOMER_PRICING.URGENT_DELIVERY_FEE : 0;
  }
  
  let fee = CUSTOMER_PRICING.DELIVERY_FEE;
  
  if (isUrgent) {
    fee += CUSTOMER_PRICING.URGENT_DELIVERY_FEE;
  }
  
  if (isAfterHours) {
    fee += CUSTOMER_PRICING.AFTER_HOURS_FEE;
  }
  
  return fee;
}

/**
 * Calculate total bottle purchase cost (bottles + deposit)
 */
export function calculateBottlePurchaseCost(quantity: number): {
  bottleCost: number;
  depositCost: number;
  total: number;
} {
  const bottleCost = quantity * CUSTOMER_PRICING.BOTTLE_PURCHASE_PRICE;
  const depositCost = quantity * CUSTOMER_PRICING.BOTTLE_DEPOSIT;
  
  return {
    bottleCost,
    depositCost,
    total: bottleCost + depositCost,
  };
}

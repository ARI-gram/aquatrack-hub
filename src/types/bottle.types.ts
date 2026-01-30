/**
 * Bottle Management Type Definitions
 * Types for bottle inventory, tracking, and exchanges
 */

export enum BottleStatus {
  FULL = 'FULL',
  EMPTY = 'EMPTY',
  IN_TRANSIT = 'IN_TRANSIT',
  AT_DISTRIBUTOR = 'AT_DISTRIBUTOR',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
}

export enum BottleTransactionType {
  PURCHASE = 'PURCHASE',
  REFILL_DELIVERED = 'REFILL_DELIVERED',
  EMPTY_COLLECTED = 'EMPTY_COLLECTED',
  RETURNED = 'RETURNED',
  EXCHANGE = 'EXCHANGE',
  ADJUSTMENT = 'ADJUSTMENT',
  DAMAGED_REPORT = 'DAMAGED_REPORT',
  LOST_REPORT = 'LOST_REPORT',
}

export interface BottleInventory {
  customerId: string;
  totalOwned: number;
  fullBottles: number;
  emptyBottles: number;
  inTransit: number;
  atDistributor: number;
  depositPerBottle: number;
  totalDeposit: number;
  lastUpdated: string;
}

export interface BottleTransaction {
  transactionId: string;
  customerId: string;
  type: BottleTransactionType;
  quantity: number;
  orderId?: string;
  description: string;
  balanceBefore: {
    full: number;
    empty: number;
  };
  balanceAfter: {
    full: number;
    empty: number;
  };
  timestamp: string;
}

export interface BottlePurchaseRequest {
  quantity: number;
  includeDeposit: boolean;
  paymentMethod: 'WALLET' | 'CASH' | 'CARD';
}

export interface BottleExchangeConfirmation {
  orderId: string;
  deliveredFull: number;
  collectedEmpty: number;
  discrepancyNote?: string;
  customerSignature?: string;
  confirmedAt: string;
}

export interface BottleDepositInfo {
  depositPerBottle: number;
  totalBottlesOwned: number;
  totalDepositPaid: number;
  refundableAmount: number;
  refundConditions: string[];
}

export interface BottleActivityItem {
  id: string;
  date: string;
  type: BottleTransactionType;
  orderId?: string;
  orderNumber?: string;
  quantity: number;
  status: 'COMPLETED' | 'IN_TRANSIT' | 'PENDING';
  description: string;
}

/**
 * Bottle Management Service
 * Handles bottle inventory, purchases, and exchanges
 */

import axiosInstance from '../axios.config';
import { CUSTOMER_API_ENDPOINTS } from '../customerEndpoints';
import {
  BottleTransactionType,
  type BottleInventory,
  type BottleTransaction,
  type BottlePurchaseRequest,
  type BottleExchangeConfirmation,
  type BottleDepositInfo,
  type BottleActivityItem,
} from '@/types/bottle.types';

// ─── Raw API response shapes (snake_case from Django) ─────────────────────────

interface RawBottleInventory {
  id: number;
  customer: string | number;
  total_owned: number;
  full_bottles: number;
  empty_bottles: number;
  in_transit: number;
  total_deposit_paid: string;
  deposit_per_bottle: string;
  available_for_refill: number;
  total_value: string;
  last_transaction_date: string | null;
  created_at: string;
  updated_at: string;
}

interface RawBottleTransaction {
  id: number;
  customer: string | number;
  transaction_type: string;
  transaction_type_display: string;
  quantity: number;
  order: string | number | null;
  balance_total_owned: number;
  balance_full: number;
  balance_empty: number;
  balance_in_transit: number;
  deposit_amount: string;
  notes: string;
  created_at: string;
}

// ─── Transaction type mapping (Django → frontend enum) ───────────────────────

const TRANSACTION_TYPE_MAP: Record<string, BottleTransactionType> = {
  PURCHASE:   BottleTransactionType.PURCHASE,
  DELIVERY:   BottleTransactionType.REFILL_DELIVERED,
  COLLECTION: BottleTransactionType.EMPTY_COLLECTED,
  RETURN:     BottleTransactionType.RETURNED,
  DAMAGE:     BottleTransactionType.DAMAGED_REPORT,
  ADJUSTMENT: BottleTransactionType.ADJUSTMENT,
};

// ─── Paginated response shape (DRF optional pagination) ──────────────────────

interface PaginatedResponse {
  results: RawBottleTransaction[];
  count?: number;
}

function transformInventory(raw: RawBottleInventory): BottleInventory {
  return {
    customerId:       String(raw.customer),
    totalOwned:       raw.total_owned,
    fullBottles:      raw.full_bottles,
    emptyBottles:     raw.empty_bottles,
    inTransit:        raw.in_transit,
    atDistributor:    0,                            // not tracked server-side yet
    depositPerBottle: parseFloat(raw.deposit_per_bottle),
    totalDeposit:     parseFloat(raw.total_deposit_paid),
    lastUpdated:      raw.updated_at,
  };
}

function transformTransaction(raw: RawBottleTransaction): BottleActivityItem {
  return {
    id:          String(raw.id),
    date:        raw.created_at.split('T')[0],      // "YYYY-MM-DD"
    type:        TRANSACTION_TYPE_MAP[raw.transaction_type] ?? BottleTransactionType.ADJUSTMENT,
    quantity:    raw.quantity,
    orderNumber: raw.order ? String(raw.order) : undefined,
    status:      'COMPLETED',                       // transactions are immutable records
    description: raw.notes || raw.transaction_type_display,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const bottleService = {
  /**
   * GET /api/customer/bottles/inventory/
   * Returns the customer's current bottle inventory.
   */
  async getInventory(): Promise<BottleInventory> {
    const response = await axiosInstance.get<RawBottleInventory>(
      CUSTOMER_API_ENDPOINTS.BOTTLES.INVENTORY,
    );
    return transformInventory(response.data);
  },

  /**
   * GET /api/customer/bottles/history/
   * Returns paginated bottle activity for the customer.
   */
  async getHistory(params?: {
    page?: number;
    limit?: number;
    transaction_type?: string;
  }): Promise<{ activities: BottleActivityItem[]; total: number }> {
    const response = await axiosInstance.get<RawBottleTransaction[]>(
      CUSTOMER_API_ENDPOINTS.BOTTLES.HISTORY,
      { params },
    );

    // The backend returns a plain array; guard for paginated shape too.
    const raw: RawBottleTransaction[] = Array.isArray(response.data)
      ? response.data
      : (response.data as PaginatedResponse).results ?? [];

    return {
      activities: raw.map(transformTransaction),
      total:      raw.length,
    };
  },

  /**
   * POST /api/customer/bottles/purchase/
   */
  async purchaseBottles(request: BottlePurchaseRequest): Promise<{
    success: boolean;
    transactionId: string;
    newInventory: BottleInventory;
  }> {
    const response = await axiosInstance.post(
      CUSTOMER_API_ENDPOINTS.BOTTLES.PURCHASE,
      request,
    );
    return response.data;
  },

  /**
   * GET /api/customer/bottles/deposit-info/
   */
  async getDepositInfo(): Promise<BottleDepositInfo> {
    const response = await axiosInstance.get<BottleDepositInfo>(
      CUSTOMER_API_ENDPOINTS.BOTTLES.DEPOSIT_INFO,
    );
    return response.data;
  },

  /**
   * POST /api/customer/bottles/exchange/:orderId/confirm/
   */
  async confirmExchange(
    orderId: string,
    confirmation: Omit<BottleExchangeConfirmation, 'orderId' | 'confirmedAt'>,
  ): Promise<BottleExchangeConfirmation> {
    const response = await axiosInstance.post<BottleExchangeConfirmation>(
      CUSTOMER_API_ENDPOINTS.BOTTLES.CONFIRM_EXCHANGE(orderId),
      confirmation,
    );
    return response.data;
  },
};
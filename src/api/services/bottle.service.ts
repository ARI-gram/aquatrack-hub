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
  BottleActivityItem,
} from '@/types/bottle.types';

export const bottleService = {
  /**
   * Get customer's bottle inventory
   */
  async getInventory(): Promise<BottleInventory> {
    const response = await axiosInstance.get<BottleInventory>(
      CUSTOMER_API_ENDPOINTS.BOTTLES.INVENTORY
    );
    return response.data;
  },

  /**
   * Get bottle transaction history
   */
  async getHistory(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ transactions: BottleTransaction[]; total: number }> {
    const response = await axiosInstance.get(
      CUSTOMER_API_ENDPOINTS.BOTTLES.HISTORY,
      { params }
    );
    return response.data;
  },

  /**
   * Purchase additional bottles
   */
  async purchaseBottles(request: BottlePurchaseRequest): Promise<{
    success: boolean;
    transactionId: string;
    newInventory: BottleInventory;
  }> {
    const response = await axiosInstance.post(
      CUSTOMER_API_ENDPOINTS.BOTTLES.PURCHASE,
      request
    );
    return response.data;
  },

  /**
   * Get deposit information
   */
  async getDepositInfo(): Promise<BottleDepositInfo> {
    const response = await axiosInstance.get<BottleDepositInfo>(
      CUSTOMER_API_ENDPOINTS.BOTTLES.DEPOSIT_INFO
    );
    return response.data;
  },

  /**
   * Confirm bottle exchange after delivery
   */
  async confirmExchange(
    orderId: string,
    confirmation: Omit<BottleExchangeConfirmation, 'orderId' | 'confirmedAt'>
  ): Promise<BottleExchangeConfirmation> {
    const response = await axiosInstance.post<BottleExchangeConfirmation>(
      CUSTOMER_API_ENDPOINTS.BOTTLES.CONFIRM_EXCHANGE(orderId),
      confirmation
    );
    return response.data;
  },
};

// Mock data for development
export const mockBottleInventory: BottleInventory = {
  customerId: 'cust-001',
  totalOwned: 10,
  fullBottles: 3,
  emptyBottles: 5,
  inTransit: 2,
  atDistributor: 0,
  depositPerBottle: 10,
  totalDeposit: 100,
  lastUpdated: new Date().toISOString(),
};

export const mockBottleActivity: BottleActivityItem[] = [
  {
    id: '1',
    date: '2024-01-30',
    type: BottleTransactionType.REFILL_DELIVERED,
    orderId: 'ord-123',
    orderNumber: 'ORD-2024-045',
    quantity: 5,
    status: 'IN_TRANSIT',
    description: 'Refilled 5 bottles',
  },
  {
    id: '2',
    date: '2024-01-28',
    type: BottleTransactionType.REFILL_DELIVERED,
    orderId: 'ord-122',
    orderNumber: 'ORD-2024-042',
    quantity: 3,
    status: 'COMPLETED',
    description: 'Refilled 3 bottles',
  },
  {
    id: '3',
    date: '2024-01-25',
    type: BottleTransactionType.PURCHASE,
    orderNumber: 'PUR-2024-010',
    quantity: 5,
    status: 'COMPLETED',
    description: 'Purchased 5 new bottles',
  },
];

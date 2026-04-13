/**
 * Bottle Management Service
 *
 * Backend endpoints (mounted at /api/bottles/):
 *   GET  /api/bottles/inventory     → BottleInventoryView
 *   GET  /api/bottles/transactions  → BottleTransactionListView
 */

import axiosInstance from '../axios.config';
import {
  type BottleInventory,
  type BottleTransaction,
  type BottlePurchaseRequest,
  type BottleExchangeConfirmation,
  type BottleDepositInfo,
} from '@/types/bottle.types';

export const bottleService = {
  /** GET /api/bottles/inventory */
  async getInventory(): Promise<BottleInventory> {
    const { data } = await axiosInstance.get<BottleInventory>('/bottles/inventory');
    return data;
  },

  /** GET /api/bottles/transactions */
  async getHistory(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ transactions: BottleTransaction[]; total: number }> {
    const { data } = await axiosInstance.get('/bottles/transactions', { params });
    return data;
  },

  /**
   * Purchase additional bottles
   * NOTE: No dedicated endpoint exists yet on the backend.
   * Wire this up once the backend route is added.
   */
  async purchaseBottles(request: BottlePurchaseRequest): Promise<{
    success: boolean;
    transactionId: string;
    newInventory: BottleInventory;
  }> {
    const { data } = await axiosInstance.post('/bottles/purchase', request);
    return data;
  },

  /**
   * Get deposit information
   * NOTE: No dedicated endpoint exists yet — deposit info is
   * included in the inventory response. Use getInventory() instead.
   */
  async getDepositInfo(): Promise<BottleDepositInfo> {
    const { data } = await axiosInstance.get<BottleDepositInfo>('/bottles/deposit-info');
    return data;
  },

  /** Confirm bottle exchange after delivery */
  async confirmExchange(
    orderId: string,
    confirmation: Omit<BottleExchangeConfirmation, 'orderId' | 'confirmedAt'>
  ): Promise<BottleExchangeConfirmation> {
    const { data } = await axiosInstance.post<BottleExchangeConfirmation>(
      `/bottles/${orderId}/confirm-exchange`,
      confirmation
    );
    return data;
  },
};
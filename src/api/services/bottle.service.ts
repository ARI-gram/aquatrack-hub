/**
 * Bottle Management Service
 *
 * Backend endpoints (mounted at /api/customer/bottles/):
 *   GET  /api/customer/bottles/inventory/                  → BottleInventoryView
 *   GET  /api/customer/bottles/history/                    → BottleTransactionListView
 *   POST /api/customer/bottles/purchase/                   → BottlePurchaseView
 *   GET  /api/customer/bottles/deposit-info/               → BottleDepositInfoView
 *   POST /api/customer/bottles/exchange/:orderId/confirm/  → BottleExchangeConfirmView
 */

import axiosInstance from '../axios.config';
import { CUSTOMER_API_ENDPOINTS } from '@/api/customerEndpoints';
import {
  type BottleInventory,
  type BottleTransaction,
  type BottlePurchaseRequest,
  type BottleExchangeConfirmation,
  type BottleDepositInfo,
} from '@/types/bottle.types';

const B = CUSTOMER_API_ENDPOINTS.BOTTLES;

export const bottleService = {
  /** GET /api/customer/bottles/inventory/ */
  async getInventory(): Promise<BottleInventory> {
    const { data } = await axiosInstance.get<BottleInventory>(B.INVENTORY);
    return data;
  },

  /** GET /api/customer/bottles/history/ */
  async getHistory(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ transactions: BottleTransaction[]; total: number }> {
    const { data } = await axiosInstance.get(B.HISTORY, { params });
    return data;
  },

  /** POST /api/customer/bottles/purchase/ */
  async purchaseBottles(request: BottlePurchaseRequest): Promise<{
    success: boolean;
    transactionId: string;
    newInventory: BottleInventory;
  }> {
    const { data } = await axiosInstance.post(B.PURCHASE, request);
    return data;
  },

  /** GET /api/customer/bottles/deposit-info/ */
  async getDepositInfo(): Promise<BottleDepositInfo> {
    const { data } = await axiosInstance.get<BottleDepositInfo>(B.DEPOSIT_INFO);
    return data;
  },

  /** POST /api/customer/bottles/exchange/:orderId/confirm/ */
  async confirmExchange(
    orderId: string,
    confirmation: Omit<BottleExchangeConfirmation, 'orderId' | 'confirmedAt'>
  ): Promise<BottleExchangeConfirmation> {
    const { data } = await axiosInstance.post<BottleExchangeConfirmation>(
      B.CONFIRM_EXCHANGE(orderId),
      confirmation
    );
    return data;
  },
};
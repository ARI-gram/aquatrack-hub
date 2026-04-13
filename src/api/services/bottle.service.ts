/**
 * Bottle Management Service
 * Handles bottle inventory, purchases, and exchanges
 */

import axiosInstance from '../axios.config';
import { CUSTOMER_API_ENDPOINTS } from '../customerEndpoints';
import {
  type BottleInventory,
  type BottleTransaction,
  type BottlePurchaseRequest,
  type BottleExchangeConfirmation,
  type BottleDepositInfo,
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
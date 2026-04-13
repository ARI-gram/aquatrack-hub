/**
 * Wallet Service
 * Handles wallet operations, top-ups, and transactions
 */

import axiosInstance from '../axios.config';
import { CUSTOMER_API_ENDPOINTS } from '../customerEndpoints';
import {
  TransactionType,
  PaymentMethod,
  type CustomerWallet,
  type WalletTransaction,
  type TopUpRequest,
  type AutoTopUpSettings,
} from '@/types/wallet.types';

export const walletService = {
  /**
   * Get wallet balance and details
   */
  async getWallet(): Promise<CustomerWallet> {
    const response = await axiosInstance.get<CustomerWallet>(
      CUSTOMER_API_ENDPOINTS.WALLET.GET
    );
    return response.data;
  },

  /**
   * Top up wallet balance
   */
  async topUp(request: TopUpRequest): Promise<{
    success: boolean;
    transactionId: string;
    newBalance: number;
  }> {
    const response = await axiosInstance.post(
      CUSTOMER_API_ENDPOINTS.WALLET.TOPUP,
      request
    );
    return response.data;
  },

  /**
   * Get transaction history
   */
  async getTransactions(params?: {
    page?: number;
    limit?: number;
    type?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ transactions: WalletTransaction[]; total: number }> {
    const response = await axiosInstance.get(
      CUSTOMER_API_ENDPOINTS.WALLET.TRANSACTIONS,
      { params }
    );
    return response.data;
  },

  /**
   * Update auto top-up settings
   */
  async updateAutoTopUp(settings: AutoTopUpSettings): Promise<AutoTopUpSettings> {
    const response = await axiosInstance.put<AutoTopUpSettings>(
      CUSTOMER_API_ENDPOINTS.WALLET.AUTO_TOPUP_SETTINGS,
      settings
    );
    return response.data;
  },

  /**
   * Get auto top-up settings
   */
  async getAutoTopUpSettings(): Promise<AutoTopUpSettings | null> {
    const response = await axiosInstance.get<AutoTopUpSettings | null>(
      CUSTOMER_API_ENDPOINTS.WALLET.AUTO_TOPUP_SETTINGS
    );
    return response.data;
  },
};

// Mock data for development
export const mockWallet: CustomerWallet = {
  walletId: 'wallet-001',
  customerId: 'cust-001',
  balance: 45.00,
  currency: 'USD',
  autoTopUp: {
    enabled: false,
    threshold: 10,
    amount: 50,
    paymentMethod: PaymentMethod.CARD,
  },
  restrictions: {
    minBalance: 0,
    maxBalance: 1000,
    dailySpendLimit: 500,
  },
  lastUpdated: new Date().toISOString(),
};

export const mockTransactions: WalletTransaction[] = [
  {
    transactionId: 'txn-001',
    walletId: 'wallet-001',
    type: TransactionType.PAYMENT,
    amount: -11.00,
    balanceBefore: 56.00,
    balanceAfter: 45.00,
    description: 'Order Payment - ORD-2024-045',
    orderId: 'ord-045',
    timestamp: '2024-01-30T10:30:00Z',
    status: 'COMPLETED',
  },
  {
    transactionId: 'txn-002',
    walletId: 'wallet-001',
    type: TransactionType.TOPUP,
    amount: 50.00,
    balanceBefore: 6.00,
    balanceAfter: 56.00,
    description: 'Wallet Top-up',
    paymentMethod: PaymentMethod.CARD,
    timestamp: '2024-01-28T14:00:00Z',
    status: 'COMPLETED',
  },
  {
    transactionId: 'txn-003',
    walletId: 'wallet-001',
    type: TransactionType.PAYMENT,
    amount: -9.00,
    balanceBefore: 15.00,
    balanceAfter: 6.00,
    description: 'Order Payment - ORD-2024-042',
    orderId: 'ord-042',
    timestamp: '2024-01-27T09:15:00Z',
    status: 'COMPLETED',
  },
];

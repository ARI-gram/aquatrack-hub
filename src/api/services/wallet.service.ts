/**
 * Wallet Service
 * Handles wallet operations, top-ups, and transactions
 *
 * Backend endpoints (mounted at /api/wallet/):
 *   GET    /api/wallet/              → WalletView
 *   POST   /api/wallet/topup         → WalletTopUpView
 *   GET    /api/wallet/transactions  → WalletTransactionListView
 */

import axiosInstance from '../axios.config';

// ── Types aligned to Django serializers ───────────────────────────────────────

export interface CustomerWallet {
  id:                        number;
  current_balance:           string;
  total_topped_up:           string;
  total_spent:               string;
  daily_limit:               string | null;
  monthly_limit:             string | null;
  auto_topup_enabled:        boolean;
  auto_topup_threshold:      string;
  auto_topup_amount:         string;
  low_balance_alert_enabled: boolean;
  low_balance_threshold:     string;
  is_active:                 boolean;
  is_locked:                 boolean;
  needs_low_balance_alert:   boolean;
  needs_auto_topup:          boolean;
  last_transaction_date:     string | null;
}

export interface WalletTransaction {
  id:                       number;
  transaction_type:         'TOPUP' | 'PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'PENALTY' | 'BONUS';
  transaction_type_display: string;
  amount:                   string;
  signed_amount:            string;
  balance_before:           string;
  balance_after:            string;
  status:                   'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  status_display:           string;
  payment_method:           'CASH' | 'CARD' | 'MPESA' | 'BANK_TRANSFER' | 'SYSTEM' | null;
  payment_reference:        string;
  order:                    number | null;
  description:              string;
  created_at:               string;
  completed_at:             string | null;
}

export interface TopUpRequest {
  amount:             string;
  payment_method:     'CASH' | 'CARD' | 'MPESA' | 'BANK_TRANSFER';
  payment_reference?: string;
}

export interface WalletSettingsUpdate {
  auto_topup_enabled?:        boolean;
  auto_topup_threshold?:      string;
  auto_topup_amount?:         string;
  low_balance_alert_enabled?: boolean;
  low_balance_threshold?:     string;
  daily_limit?:               string | null;
  monthly_limit?:             string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const walletService = {
  /** GET /api/wallet/ */
  async getWallet(): Promise<CustomerWallet> {
    const { data } = await axiosInstance.get<CustomerWallet>('/wallet/');
    return data;
  },

  /** POST /api/wallet/topup */
  async topUp(request: TopUpRequest): Promise<WalletTransaction> {
    const { data } = await axiosInstance.post<WalletTransaction>('/wallet/topup', request);
    return data;
  },

  /** GET /api/wallet/transactions */
  async getTransactions(params?: {
    transaction_type?: WalletTransaction['transaction_type'];
    limit?: number;
  }): Promise<WalletTransaction[]> {
    const { data } = await axiosInstance.get<WalletTransaction[]>(
      '/wallet/transactions',
      { params }
    );
    return data;
  },

  /** PUT /api/wallet/ */
  async updateSettings(settings: WalletSettingsUpdate): Promise<CustomerWallet> {
    const { data } = await axiosInstance.put<CustomerWallet>('/wallet/', settings);
    return data;
  },

  isCredit(tx: WalletTransaction): boolean {
    return ['TOPUP', 'REFUND', 'BONUS'].includes(tx.transaction_type);
  },

  parseSignedAmount(tx: WalletTransaction): number {
    return parseFloat(tx.signed_amount);
  },
};
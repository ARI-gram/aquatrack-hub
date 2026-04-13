/**
 * Wallet Service
 * Handles wallet operations, top-ups, and transactions
 *
 * Backend endpoints (all under /api/customer/wallet/):
 *   GET    /              → WalletView        (WalletSerializer)
 *   POST   /topup         → WalletTopUpView   (WalletTopUpSerializer → WalletTransactionSerializer)
 *   GET    /transactions  → WalletTransactionListView (WalletTransactionSerializer)
 */

import axiosInstance from '../axios.config';

// ── Types aligned to Django serializers ───────────────────────────────────────

/** Matches WalletSerializer */
export interface CustomerWallet {
  id:                       number;
  current_balance:          string;   // decimal string e.g. "125.00"
  total_topped_up:          string;
  total_spent:              string;
  daily_limit:              string | null;
  monthly_limit:            string | null;
  auto_topup_enabled:       boolean;
  auto_topup_threshold:     string;
  auto_topup_amount:        string;
  low_balance_alert_enabled: boolean;
  low_balance_threshold:    string;
  is_active:                boolean;
  is_locked:                boolean;
  needs_low_balance_alert:  boolean;
  needs_auto_topup:         boolean;
  last_transaction_date:    string | null;
}

/** Matches WalletTransactionSerializer */
export interface WalletTransaction {
  id:                       number;
  transaction_type:         'TOPUP' | 'PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'PENALTY' | 'BONUS';
  transaction_type_display: string;
  amount:                   string;   // always positive
  signed_amount:            string;   // negative for debits e.g. "-61.00"
  balance_before:           string;
  balance_after:            string;
  status:                   'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  status_display:           string;
  payment_method:           'CASH' | 'CARD' | 'MPESA' | 'BANK_TRANSFER' | 'SYSTEM' | null;
  payment_reference:        string;
  order:                    number | null;   // order FK (id)
  description:              string;
  created_at:               string;
  completed_at:             string | null;
}

/** POST /topup request — matches WalletTopUpSerializer */
export interface TopUpRequest {
  amount:             string;   // decimal string e.g. "500.00" (min 10, max 50000)
  payment_method:     'CASH' | 'CARD' | 'MPESA' | 'BANK_TRANSFER';
  payment_reference?: string;
}

/** PATCH /  — wallet settings fields that are writable */
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
  /**
   * GET /api/customer/wallet/
   * Returns wallet balance, limits, and auto top-up settings.
   */
  async getWallet(): Promise<CustomerWallet> {
    const { data } = await axiosInstance.get<CustomerWallet>(
      '/customer/wallet/'
    );
    return data;
  },

  /**
   * POST /api/customer/wallet/topup
   * Top up wallet. Returns the created WalletTransaction.
   * Min: KES 10, Max: KES 50,000.
   */
  async topUp(request: TopUpRequest): Promise<WalletTransaction> {
    const { data } = await axiosInstance.post<WalletTransaction>(
      '/customer/wallet/topup',
      request
    );
    return data;
  },

  /**
   * GET /api/customer/wallet/transactions
   * Returns transaction history for the authenticated customer.
   *
   * Query params supported by backend:
   *   transaction_type  — 'TOPUP' | 'PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'PENALTY' | 'BONUS'
   *   limit             — number of results (default 50)
   */
  async getTransactions(params?: {
    transaction_type?: WalletTransaction['transaction_type'];
    limit?: number;
  }): Promise<WalletTransaction[]> {
    const { data } = await axiosInstance.get<WalletTransaction[]>(
      '/customer/wallet/transactions',
      { params }
    );
    return data;
  },

  /**
   * PUT /api/customer/wallet/
   * Update wallet settings (auto top-up, low balance alerts, limits).
   * Only writable fields are sent — read-only fields (balance, totals) are ignored by backend.
   */
  async updateSettings(settings: WalletSettingsUpdate): Promise<CustomerWallet> {
    const { data } = await axiosInstance.put<CustomerWallet>(
      '/customer/wallet/',
      settings
    );
    return data;
  },

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Whether a transaction adds money to the wallet.
   * Mirrors the backend's WalletTransaction.is_credit() method.
   */
  isCredit(tx: WalletTransaction): boolean {
    return ['TOPUP', 'REFUND', 'BONUS'].includes(tx.transaction_type);
  },

  /**
   * Parse signed_amount to a JS number.
   * signed_amount is a decimal string e.g. "+500.00" or "-61.00".
   */
  parseSignedAmount(tx: WalletTransaction): number {
    return parseFloat(tx.signed_amount);
  },
};
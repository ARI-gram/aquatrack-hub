/**
 * Wallet & Payment Type Definitions
 * Types for wallet management, transactions, and payments
 */

export enum TransactionType {
  TOPUP = 'TOPUP',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
  DEPOSIT = 'DEPOSIT',
  DEPOSIT_REFUND = 'DEPOSIT_REFUND',
}

export enum PaymentMethod {
  WALLET = 'WALLET',
  CASH = 'CASH',
  CARD = 'CARD',
  CREDIT_ACCOUNT = 'CREDIT_ACCOUNT',
  MPESA = 'MPESA',
}

export interface CustomerWallet {
  walletId: string;
  customerId: string;
  balance: number;
  currency: string;
  autoTopUp?: AutoTopUpSettings;
  restrictions: WalletRestrictions;
  lastUpdated: string;
}

export interface AutoTopUpSettings {
  enabled: boolean;
  threshold: number;
  amount: number;
  paymentMethod: PaymentMethod;
}

export interface WalletRestrictions {
  minBalance: number;
  maxBalance: number;
  dailySpendLimit: number;
}

export interface WalletTransaction {
  transactionId: string;
  walletId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  orderId?: string;
  paymentMethod?: PaymentMethod;
  timestamp: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
}

export interface TopUpRequest {
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
}

export interface PaymentRecord {
  paymentId: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  timestamp: string;
  reference?: string;
}

export interface CreditAccount {
  customerId: string;
  creditLimit: number;
  outstandingBalance: number;
  availableCredit: number;
  dueDate?: string;
  paymentHistory: PaymentRecord[];
}

export interface FinancialSummary {
  walletBalance: number;
  creditLimit: number;
  outstandingBalance: number;
  totalDepositPaid: number;
  pendingPayments: number;
}

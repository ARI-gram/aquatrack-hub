/**
 * Billing Type Definitions
 * /src/types/billing.types.ts
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type BillingCycle = 'monthly' | 'biannual' | 'annual';
export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'mpesa' | 'bank' | 'cash';
export type SubscriptionStatus = 'active' | 'trial' | 'overdue' | 'cancelled';

// ─── Pricing constants (KES) ──────────────────────────────────────────────────

export const BILLING_PRICES: Record<BillingCycle, number> = {
  monthly: 15_000,
  biannual: 76_500,   // 15% discount — KSh 12,750/mo
  annual: 126_000,    // 30% discount — KSh 10,500/mo
};

export const ONBOARDING_FEE = 20_000; // One-time KSh

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Monthly',
  biannual: '6-Month',
  annual: 'Annual',
};

export const BILLING_DISCOUNTS: Record<BillingCycle, number> = {
  monthly: 0,
  biannual: 15,
  annual: 30,
};

// ─── Subscription ─────────────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  clientName: string;
  plan: string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  nextPaymentDate: string | null;
  amount: number;
  monthlyEquivalent: number;
  daysUntilDue: number;
  onboarding_paid: boolean;
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  description: string;
  status: InvoiceStatus;
  dueDate: string;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  isOnboarding: boolean;
  createdAt: string;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface BillingStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  overdueSubscriptions: number;
  monthlyRevenue: number;
  annualRevenue: number;
  trialConversionRate: number;
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export interface MarkInvoicePaidRequest {
  payment_method: PaymentMethod;
  payment_reference?: string;
}

export interface InvoiceFilters {
  client?: string;
  status?: InvoiceStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedInvoicesResponse {
  data: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
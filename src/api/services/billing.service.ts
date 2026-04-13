/**
 * Billing Service
 * /src/api/services/billing.service.ts
 *
 * Handles all billing, subscription and invoice API calls.
 */

import axiosInstance from '../axios.config';
import { API_ENDPOINTS } from '../endpoints';
import type {
  Subscription,
  Invoice,
  BillingStats,
  MarkInvoicePaidRequest,
  InvoiceFilters,
  PaginatedInvoicesResponse,
} from '@/types/billing.types';

export const billingService = {
  // ─── Subscriptions ──────────────────────────────────────────────────────────

  /**
   * GET /api/billing/subscriptions/
   * All client subscriptions sorted by days until due.
   * Used by BillingPlansPage to populate warnings and subscription list.
   */
  async getSubscriptions(): Promise<Subscription[]> {
    const res = await axiosInstance.get<Subscription[]>(
      API_ENDPOINTS.BILLING.SUBSCRIPTIONS
    );
    return res.data;
  },

  /**
   * GET /api/billing/subscriptions/stats/
   * Aggregate revenue and conversion metrics for the Revenue Overview tab.
   */
  async getStats(): Promise<BillingStats> {
    const res = await axiosInstance.get<BillingStats>(
      API_ENDPOINTS.BILLING.STATS
    );
    return res.data;
  },

  // ─── Invoices ───────────────────────────────────────────────────────────────

  /**
   * GET /api/billing/invoices/
   * Paginated invoice list with optional filters.
   */
  async getInvoices(filters?: InvoiceFilters): Promise<PaginatedInvoicesResponse> {
    const res = await axiosInstance.get<PaginatedInvoicesResponse>(
      API_ENDPOINTS.BILLING.INVOICES,
      { params: filters }
    );
    return res.data;
  },

  /**
   * GET /api/billing/invoices/{id}/
   */
  async getInvoiceById(id: string): Promise<Invoice> {
    const res = await axiosInstance.get<Invoice>(
      API_ENDPOINTS.BILLING.INVOICE_BY_ID(id)
    );
    return res.data;
  },

  /**
   * POST /api/billing/invoices/{id}/mark-paid/
   * Mark an invoice as paid with M-Pesa / bank / cash reference.
   */
  async markInvoicePaid(
    id: string,
    data: MarkInvoicePaidRequest
  ): Promise<{ message: string; invoice: Invoice }> {
    const res = await axiosInstance.post<{ message: string; invoice: Invoice }>(
      API_ENDPOINTS.BILLING.MARK_PAID(id),
      data
    );
    return res.data;
  },
};

export default billingService;
/**
 * Customer Admin Service
 * /src/api/services/customerAdmin.service.ts
 */

import axiosInstance from '../axios.config';

// ── Customer ──────────────────────────────────────────────────────────────────

export type BillingCycle = 'IMMEDIATE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface CreditTermsSummary {
  billing_cycle:          BillingCycle;
  billing_cycle_display:  string;
  credit_limit:           string;
  original_credit_limit:  string;
  outstanding_balance:    string;
  available_credit:       string;
  payment_due_days:       number;
  grace_period_days:      number;
  notes:                  string;
  // Lifecycle state
  account_frozen:         boolean;
  is_in_grace_period:     boolean;
  grace_days_remaining:   number | null;
  grace_until:            string | null;   // "YYYY-MM-DD"
}

export interface AdminCustomer {
  id:                   string;
  phone_number:         string;
  full_name:            string;
  email:                string | null;
  customer_type:        'REFILL' | 'ONETIME' | 'HYBRID';
  customer_type_display:string;
  status:               'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
  status_display:       string;
  is_phone_verified:    boolean;
  is_registered:        boolean;
  invite_pending:       boolean;
  wallet_balance:       string;
  total_orders:         number;
  last_order_date:      string | null;
  last_login:           string | null;
  created_at:           string;
  /** null for non-credit customers */
  credit_terms:         CreditTermsSummary | null;
}

export interface CreateCustomerRequest {
  phone_number:      string;
  full_name:         string;
  email:             string;
  customer_type?:    'REFILL' | 'ONETIME' | 'HYBRID';
  send_invite?:     boolean;
  // Optional credit setup
  billing_cycle?:    BillingCycle;
  credit_limit?:     string;
  payment_due_days?: number;
  grace_period_days?: number;
  credit_notes?:     string;
}

export interface CreateCustomerResponse {
  customer:   AdminCustomer;
  invite_url: string;
}

export interface CustomerFilters {
  search?:     string;
  status?:     string;
  type?:       string;
  registered?: 'true' | 'false';
  page?:       number;
  limit?:      number;
}

export interface PaginatedCustomers {
  data:       AdminCustomer[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface InviteInfo {
  customer_id:  string;
  full_name:    string;
  phone_number: string;
  email:        string;
  company_name: string;
  company_id:   string;
  invite_token: string;
}

// ── Credit Terms ──────────────────────────────────────────────────────────────

export interface CreditTerms {
  id:                   string;
  billing_cycle:        BillingCycle;
  billing_cycle_display:string;
  credit_limit:         string;
  original_credit_limit:string;
  outstanding_balance:  string;
  available_credit:     string;
  payment_due_days:     number;
  grace_period_days:    number;
  notes:                string;
  // Lifecycle
  account_frozen:       boolean;
  is_in_grace_period:   boolean;
  grace_days_remaining: number | null;
  grace_until:          string | null;
  created_at:           string;
  updated_at:           string;
}

export interface CreditTermsRequest {
  billing_cycle:      BillingCycle;
  credit_limit:       string;
  payment_due_days?:  number;
  grace_period_days?: number;
  notes?:             string;
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export type InvoiceStatus        = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type InvoicePaymentMethod = 'CHEQUE' | 'BANK_TRANSFER' | 'CASH' | 'MPESA';

export interface InvoiceItem {
  id:           string;
  order_number: string;
  order_date:   string;
  subtotal:     string;
  delivery_fee: string;
  total:        string;
  description:  string;
}

export interface CustomerInvoice {
  id:                    string;
  invoice_number:        string;
  status:                InvoiceStatus;
  status_display:        string;
  billing_cycle:         BillingCycle;
  billing_cycle_display: string;
  period_start:          string;
  period_end:            string;
  subtotal:              string;
  delivery_fees:         string;
  total_amount:          string;
  due_date:              string;
  is_overdue:            boolean;
  paid_at:               string | null;
  payment_method:        InvoicePaymentMethod | null;
  payment_reference:     string;
  notes:                 string;
  items:                 InvoiceItem[];
  customer_name:         string;
  customer_phone:        string;
  created_at:            string;
  updated_at:            string;
}

export interface PaginatedInvoices {
  data:       CustomerInvoice[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface InvoiceFilters {
  status?:      InvoiceStatus;
  customer_id?: string;
  page?:        number;
  limit?:       number;
}

export interface MarkPaidRequest {
  payment_method:     InvoicePaymentMethod;
  payment_reference?: string;
}

// ── Grace Period ──────────────────────────────────────────────────────────────

export type GraceRequestStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export interface GraceRequest {
  id:                  string;
  customer_name:       string;
  customer_phone:      string;
  requested_days:      number;
  reason:              string;
  status:              GraceRequestStatus;
  status_display:      string;
  admin_note:          string;
  days_granted:        number | null;
  grace_until_current: string | null;
  account_frozen:      boolean;
  reviewed_by_id:      string | null;
  reviewed_at:         string | null;
  created_at:          string;
  updated_at:          string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const customerAdminService = {

  // ── Customers ──────────────────────────────────────────────────────────────

  async getCustomers(filters?: CustomerFilters): Promise<PaginatedCustomers> {
    const r = await axiosInstance.get<PaginatedCustomers>('/customers/', { params: filters });
    return r.data;
  },

  async getCustomer(id: string): Promise<AdminCustomer> {
    const r = await axiosInstance.get<AdminCustomer>(`/customers/${id}/`);
    return r.data;
  },

  async createCustomer(data: CreateCustomerRequest): Promise<CreateCustomerResponse> {
    const r = await axiosInstance.post<CreateCustomerResponse>('/customers/', data);
    return r.data;
  },

  async updateCustomer(
    id: string,
    data: Partial<Pick<AdminCustomer, 'full_name' | 'email' | 'customer_type' | 'status'>>
  ): Promise<AdminCustomer> {
    const r = await axiosInstance.patch<AdminCustomer>(`/customers/${id}/`, data);
    return r.data;
  },

  async blockCustomer(id: string): Promise<{ message: string; customer: AdminCustomer }> {
    const r = await axiosInstance.post(`/customers/${id}/block/`);
    return r.data;
  },

  async unblockCustomer(id: string): Promise<{ message: string; customer: AdminCustomer }> {
    const r = await axiosInstance.post(`/customers/${id}/unblock/`);
    return r.data;
  },

  async resendInvite(id: string): Promise<{ message: string; invite_url: string }> {
    const r = await axiosInstance.post(`/customers/${id}/resend-invite/`);
    return r.data;
  },

  async resolveInvite(token: string): Promise<InviteInfo> {
    const r = await axiosInstance.get<InviteInfo>(`/customers/invite/${token}/`);
    return r.data;
  },

  async completeInvite(token: string, phoneNumber: string, otpCode: string) {
    const r = await axiosInstance.post(`/customers/invite/${token}/complete/`, {
      phone_number: phoneNumber,
      otp_code:     otpCode,
    });
    return r.data as {
      message:  string;
      customer: AdminCustomer;
      tokens:   { access: string; refresh: string };
    };
  },

  // ── Credit Terms ───────────────────────────────────────────────────────────

  async getCreditTerms(customerId: string): Promise<CreditTerms> {
    const r = await axiosInstance.get<CreditTerms>(`/customers/${customerId}/credit-terms/`);
    return r.data;
  },

  async setCreditTerms(customerId: string, data: CreditTermsRequest): Promise<CreditTerms> {
    const r = await axiosInstance.post<CreditTerms>(
      `/customers/${customerId}/credit-terms/`, data);
    return r.data;
  },

  // ── Grace Requests (admin) ─────────────────────────────────────────────────

  async getGraceRequests(statusFilter?: GraceRequestStatus): Promise<GraceRequest[]> {
    const r = await axiosInstance.get<GraceRequest[]>(
      '/customers/grace-requests/',
      statusFilter ? { params: { status: statusFilter } } : undefined,
    );
    return r.data;
  },

  async approveGraceRequest(
    id: string,
    data: { days_granted?: number; admin_note?: string },
  ): Promise<{ message: string; request: GraceRequest }> {
    const r = await axiosInstance.post(`/customers/grace-requests/${id}/approve/`, data);
    return r.data;
  },

  async denyGraceRequest(
    id: string,
    data: { admin_note?: string },
  ): Promise<{ message: string; request: GraceRequest }> {
    const r = await axiosInstance.post(`/customers/grace-requests/${id}/deny/`, data);
    return r.data;
  },

  // ── Invoices ───────────────────────────────────────────────────────────────

  async getAllInvoices(filters?: InvoiceFilters): Promise<PaginatedInvoices> {
    const r = await axiosInstance.get<PaginatedInvoices>(
      '/customers/invoices/', { params: filters });
    return r.data;
  },

  async getCustomerInvoices(customerId: string): Promise<CustomerInvoice[]> {
    const r = await axiosInstance.get<CustomerInvoice[]>(
      `/customers/${customerId}/invoices/`);
    return r.data;
  },

  async getInvoice(invoiceId: string): Promise<CustomerInvoice> {
    const r = await axiosInstance.get<CustomerInvoice>(
      `/customers/invoices/${invoiceId}/`);
    return r.data;
  },

  async generateInvoice(customerId: string, orderIds?: string[]): Promise<CustomerInvoice> {
    const r = await axiosInstance.post<CustomerInvoice>(
      `/customers/${customerId}/invoices/generate/`,
      orderIds ? { order_ids: orderIds } : {},
    );
    return r.data;
  },

  async issueInvoice(invoiceId: string): Promise<{ message: string; invoice: CustomerInvoice }> {
    const r = await axiosInstance.post(`/customers/invoices/${invoiceId}/issue/`);
    return r.data;
  },

  async markInvoicePaid(
    invoiceId: string, data: MarkPaidRequest,
  ): Promise<{ message: string; invoice: CustomerInvoice }> {
    const r = await axiosInstance.post(
      `/customers/invoices/${invoiceId}/mark-paid/`, data);
    return r.data;
  },
};

export default customerAdminService;
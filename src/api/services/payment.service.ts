// src/api/services/payment.service.ts

import axiosInstance from '../axios.config';
import type { Invoice } from '@/types/accounting.types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecordPaymentRequest {
  amount_paid:        number;
  payment_method:     'MPESA' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  payment_reference?: string;
}

export interface RecordPaymentResponse {
  message:    string;
  invoice:    Invoice;
  amount_paid: number;
  balance_due: number;
  fully_paid:  boolean;
}

export interface PaymentAllocation {
  invoiceNumber: string;
  invoiceId:     string;
  applied:       number;
  balanceDue:    number;
  status:        string;
}

export interface BulkPaymentRequest {
  customer_id:        string;
  amount_paid:        number;
  payment_method:     'MPESA' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  payment_reference?: string;
}

export interface BulkPaymentResponse {
  message:          string;
  totalPaid:        number;
  invoicesPaid:     number;
  invoicesPartial:  number;
  allocations:      PaymentAllocation[];
  remainingBalance: number;
}

export interface CustomerStatement {
  customer: {
    id:          string;
    fullName:    string;
    phoneNumber: string;
    email:       string | null;
    status:      string;
  };
  creditInfo: {
    creditEnabled:      boolean;
    creditLimit:        number;
    outstandingBalance: number;
    availableCredit:    number;
    preferredMethod:    string;
  };
  summary: {
    totalInvoiced: number;
    totalPaid:     number;
    totalDue:      number;
    invoiceCount:  number;
  };
  aging: {
    current:      number;
    days_1_30:    number;
    days_31_60:   number;
    days_61_90:   number;
    days_90_plus: number;
  };
  invoices: Invoice[];
}

export interface MarkOverdueResponse {
  message: string;
  count:   number;
  asOf:    string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const paymentService = {

  // POST /api/invoices/{id}/record-payment/
  recordPayment: async (
    invoiceId: string,
    data: RecordPaymentRequest,
  ): Promise<RecordPaymentResponse> => {
    const { data: res } = await axiosInstance.post(
      `/invoices/${invoiceId}/record-payment/`,
      data,
    );
    return res;
  },

  // POST /api/invoices/bulk-payment/
  bulkPayment: async (
    data: BulkPaymentRequest,
  ): Promise<BulkPaymentResponse> => {
    const { data: res } = await axiosInstance.post('/invoices/bulk-payment/', data);
    return res;
  },

  // GET /api/invoices/customer/{id}/statement/
  getCustomerStatement: async (
    customerId: string,
  ): Promise<CustomerStatement> => {
    const { data } = await axiosInstance.get(
      `/invoices/customer/${customerId}/statement/`,
    );
    return data;
  },

  // POST /api/invoices/mark-overdue/
  markOverdue: async (): Promise<MarkOverdueResponse> => {
    const { data } = await axiosInstance.post('/invoices/mark-overdue/');
    return data;
  },
};
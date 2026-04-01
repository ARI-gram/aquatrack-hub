// src/api/services/accounting.service.ts
// ⚠️  If you see "Cannot find module" on the import below,
//     replace '@/api/axios' with whatever your other service files use.
//     e.g. check delivery.service.ts and copy its first import line.

import axiosInstance from '../axios.config';
import type {
  AccountingSettings,
  Invoice,
  DirectSaleReceipt,
  PaymentMethod,
  PaymentReport,
} from '@/types/accounting.types';

// ── Accounting Settings ───────────────────────────────────────────────────────

export const accountingService = {

  // GET /api/client/accounting-settings/
  getSettings: async (): Promise<AccountingSettings> => {
    const { data } = await axiosInstance.get('/client/accounting-settings/');
    return data;
  },

  // POST /api/client/accounting-settings/
  saveSettings: async (
    settings: Partial<AccountingSettings>
  ): Promise<AccountingSettings> => {
    const { data } = await axiosInstance.post('/client/accounting-settings/', settings);
    return data;
  },

  // ── Customer Invoices ───────────────────────────────────────────────────────

  // GET /api/invoices/
  listInvoices: async (params?: {
    status?:     string;
    customerId?: string;
    date_from?:  string;   // ✅ added — 'yyyy-MM-dd'
    date_to?:    string;   // ✅ added — 'yyyy-MM-dd'
    page?:       number;
    limit?:      number;
  }) => {
    const { data } = await axiosInstance.get('/invoices/', { params });
    return data as {
      data:       Invoice[];
      total:      number;
      page:       number;
      limit:      number;
      totalPages: number;
    };
  },

  // GET /api/invoices/{id}/
  getInvoice: async (invoiceId: string): Promise<Invoice> => {
    const { data } = await axiosInstance.get(`/invoices/${invoiceId}/`);
    return data;
  },

  // POST /api/invoices/{id}/issue/
  issueInvoice: async (
    invoiceId: string
  ): Promise<{ message: string; invoice: Invoice }> => {
    const { data } = await axiosInstance.post(`/invoices/${invoiceId}/issue/`);
    return data;
  },

  // POST /api/invoices/{id}/mark-paid/
  markPaid: async (
    invoiceId: string,
    payload: { payment_method: string; payment_reference?: string }
  ): Promise<{ message: string; invoice: Invoice }> => {
    const { data } = await axiosInstance.post(
      `/invoices/${invoiceId}/mark-paid/`,
      payload,
    );
    return data;
  },

  // POST /api/customers/{id}/invoices/generate/
  generateInvoice: async (
    customerId: string,
    orderIds?: string[],
  ): Promise<Invoice> => {
    const { data } = await axiosInstance.post(
      `/customers/${customerId}/invoices/generate/`,
      orderIds ? { order_ids: orderIds } : {},
    );
    return data;
  },

  // GET /api/customers/{id}/invoices/
  getCustomerInvoices: async (customerId: string): Promise<Invoice[]> => {
    const { data } = await axiosInstance.get(`/customers/${customerId}/invoices/`);
    return data;
  },

   // GET /api/invoices/payment-report/
  getPaymentReport: async (params?: {
    customer_type?: 'credit' | 'non_credit' | 'all';
    status?:        'paid' | 'unpaid' | 'overdue' | 'all';
    date_from?:     string;   // 'yyyy-MM-dd'
    date_to?:       string;   // 'yyyy-MM-dd'
  }): Promise<PaymentReport> => {
    const { data } = await axiosInstance.get('/invoices/payment-report/', { params });
    return data as PaymentReport;
  },

  // ── Direct Sale Receipt ─────────────────────────────────────────────────────

  buildReceipt: (params: {
    movementId:       string;
    productName:      string;
    quantity:         number;
    unitPrice:        number;
    customerName:     string;
    customerPhone?:   string;
    paymentMethod:    PaymentMethod;
    paymentReference?: string;
    servedBy:         string;
    isWalkIn:         boolean;
    vatRate:          number;
    vatRegistered:    boolean;
  }): DirectSaleReceipt => {
    const subtotal    = params.quantity * params.unitPrice;
    const vatAmount   = params.vatRegistered
      ? parseFloat((subtotal * (params.vatRate / 100)).toFixed(2))
      : 0;
    const totalAmount = subtotal + vatAmount;

    return {
      receiptNumber:    `RCP-${Date.now()}`,
      date:             new Date().toISOString(),
      customerName:     params.customerName,
      customerPhone:    params.customerPhone,
      items: [
        {
          productName: params.productName,
          quantity:    params.quantity,
          unitPrice:   params.unitPrice,
          subtotal,
        },
      ],
      subtotal,
      vatAmount,
      totalAmount,
      paymentMethod:    params.paymentMethod,
      paymentReference: params.paymentReference,
      servedBy:         params.servedBy,
      isWalkIn:         params.isWalkIn,
    };
  },
};
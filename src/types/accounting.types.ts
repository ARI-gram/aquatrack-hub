// src/types/accounting.types.ts

export interface AccountingSettings {
  id?: string;
  legalName: string;
  kraPin: string;
  vatRegistered: boolean;
  vatNumber: string;
  vatRate: number; // default 16
  address: string;
  city: string;
  phone: string;
  email: string;
  invoicePrefix: string; // e.g. "INV"
  invoiceFooterNote: string;
  // Bank details
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  bankBranch: string;
  // M-Pesa
  mpesaPaybill: string;
  mpesaAccountName: string;
  mpesaTill: string;
}

export interface InvoiceItem {
  id: string;
  productName: string;  // serializer field (was: description)
  productUnit?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'MPESA' | 'BANK_TRANSFER' | 'CHEQUE' | 'WALLET' | 'CREDIT';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  billingCycle: string;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  deliveryFees: number;
  vatAmount: number;
  totalAmount: number;
  dueDate: string;
  isOverdue: boolean;
  amountPaid?: number;
  amountDue?: number;
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  notes?: string;
  items: InvoiceItem[];
  customerName: string;
  customerPhone: string;
  createdAt: string;
  updatedAt: string;
}

export interface DirectSaleReceiptItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface DirectSaleReceipt {
  receiptNumber: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  items: DirectSaleReceiptItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  servedBy: string;
  isWalkIn: boolean;
}

export interface POSCartItem {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface RevenueReport {
  period:        string;   // e.g. "March 2026"
  totalRevenue:  number;
  totalInvoiced: number;
  totalPaid:     number;
  totalOutstanding: number;
  totalOverdue:  number;
  invoiceCount:  number;
  paidCount:     number;
  overdueCount:  number;
  dailyBreakdown: {
    date:     string;
    revenue:  number;
    invoices: number;
  }[];
}

export interface VatReport {
  period:       string;
  vatRate:      number;
  taxableAmount: number;
  vatCollected:  number;
  exemptAmount:  number;
  invoices: {
    invoiceNumber: string;
    customerName:  string;
    date:          string;
    subtotal:      number;
    vatAmount:     number;
    total:         number;
    status:        string;
  }[];
}

export interface OutstandingReport {
  totalOutstanding: number;
  totalOverdue:     number;
  customerCount:    number;
  items: {
    customerId:    string;
    customerName:  string;
    customerPhone: string;
    invoiceNumber: string;
    invoiceDate:   string;
    dueDate:       string;
    amount:        number;
    daysOverdue:   number;
    status:        string;
  }[];
}

export interface DirectSalesReport {
  period:       string;
  totalSales:   number;
  totalUnits:   number;
  totalRevenue: number;
  byProduct: {
    productName: string;
    units:       number;
    revenue:     number;
  }[];
  byPaymentMethod: {
    method:  string;
    count:   number;
    revenue: number;
  }[];
}


export interface PaymentReportCustomer {
  customerId:       string;
  fullName:         string;
  phone:            string;
  isCredit:         boolean;
  creditLimit:      number;
  availableCredit:  number;
  totalInvoiced:    number;
  totalPaid:        number;
  totalOutstanding: number;
  invoiceCount:     number;
  unpaidCount:      number;
  overdueCount:     number;
  paymentBreakdown: Record<string, number>; // e.g. { CASH: 1200, MPESA: 800 }
  ordersNoInvoice:  {
    order_number:   string;
    total_amount:   number;
    payment_status: string;
    created_at:     string;
  }[];
}
 
export interface PaymentReportSummary {
  totalCustomers:          number;
  creditCustomers:         number;
  nonCreditCustomers:      number;
  totalInvoiced:           number;
  totalPaid:               number;
  totalOutstanding:        number;
  paymentMethodBreakdown:  Record<string, number>;
  ordersWithNoInvoice:     number;
}
 
export interface PaymentReport {
  generatedAt: string;
  filters: {
    customerType: string;
    status:       string;
    dateFrom:     string | null;
    dateTo:       string | null;
  };
  summary:   PaymentReportSummary;
  customers: PaymentReportCustomer[];
}
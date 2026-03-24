// src/types/reports.types.ts

export interface RevenueByDay {
  date:        string;
  revenue:     number;
  orders:      number;
  directSales: number;
}

export interface RevenueByProduct {
  productId:   string;
  productName: string;
  unit:        string;
  quantity:    number;
  revenue:     number;
}

export interface RevenueSummary {
  totalRevenue:      number;
  totalOrders:       number;
  totalDirectSales:  number;
  averageOrderValue: number;
  byDay:             RevenueByDay[];
  byProduct:         RevenueByProduct[];
  periodStart:       string;
  periodEnd:         string;
}

export interface VatLine {
  invoiceNumber: string;
  customerName:  string;
  date:          string;
  subtotal:      number;
  vatAmount:     number;
  totalAmount:   number;
  status:        string;
}

export interface VatSummary {
  vatRegistered:    boolean;
  vatRate:          number;
  totalSubtotal:    number;
  totalVat:         number;
  totalGross:       number;
  invoiceCount:     number;
  lines:            VatLine[];
  periodStart:      string;
  periodEnd:        string;
}

export interface OutstandingCustomer {
  customerId:        string;
  customerName:      string;
  customerPhone:     string;
  outstandingAmount: number;
  overdueAmount:     number;
  invoiceCount:      number;
  oldestDueDate:     string;
  isOverdue:         boolean;
}

export interface OutstandingSummary {
  totalOutstanding: number;
  totalOverdue:     number;
  customerCount:    number;
  overdueCount:     number;
  customers:        OutstandingCustomer[];
}

export type ReportPeriod = '7d' | '30d' | '90d' | 'mtd' | 'ytd' | 'custom';
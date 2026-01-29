/**
 * Reports Service
 * Handles all reporting and analytics API calls
 */

import axiosInstance from '../axios.config';
import { API_ENDPOINTS } from '../endpoints';

export interface DailyReport {
  date: string;
  totalOrders: number;
  completedDeliveries: number;
  failedDeliveries: number;
  revenue: number;
  newCustomers: number;
  activeDrivers: number;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  deliverySuccessRate: number;
  dailyBreakdown: DailyReport[];
}

export interface MonthlyReport {
  month: string;
  year: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  outstandingPayments: number;
  newCustomers: number;
  customerRetentionRate: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  weeklyBreakdown: WeeklyReport[];
}

export interface SalesReport {
  period: string;
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalOrders: number;
    totalSpent: number;
  }>;
  salesByProduct: Array<{
    productId: string;
    productName: string;
    unitsSold: number;
    revenue: number;
  }>;
  salesByPaymentMethod: Array<{
    method: string;
    count: number;
    total: number;
  }>;
}

export interface DeliveryReport {
  period: string;
  totalDeliveries: number;
  completedOnTime: number;
  completedLate: number;
  failed: number;
  averageDeliveryTime: number;
  driverPerformance: Array<{
    driverId: string;
    driverName: string;
    totalDeliveries: number;
    onTimeRate: number;
    averageRating: number;
  }>;
}

export interface FinancialReport {
  period: string;
  totalRevenue: number;
  collectedPayments: number;
  outstandingPayments: number;
  overduePayments: number;
  revenueByCategory: Array<{
    category: string;
    amount: number;
  }>;
  paymentsByMethod: Array<{
    method: string;
    amount: number;
    count: number;
  }>;
  accountsReceivable: Array<{
    customerId: string;
    customerName: string;
    outstanding: number;
    overdueDays: number;
  }>;
}

export interface CustomReportRequest {
  reportType: 'sales' | 'deliveries' | 'financial' | 'inventory' | 'customers';
  startDate: string;
  endDate: string;
  filters?: Record<string, unknown>;
  groupBy?: 'day' | 'week' | 'month';
  includeCharts?: boolean;
}

export interface ExportRequest {
  reportType: string;
  format: 'pdf' | 'excel' | 'csv';
  data: unknown;
}

/**
 * Reports service methods
 */
export const reportsService = {
  /**
   * Get daily report
   */
  async getDailyReport(date?: string): Promise<DailyReport> {
    const response = await axiosInstance.get<DailyReport>(API_ENDPOINTS.REPORTS.DAILY, {
      params: { date },
    });
    return response.data;
  },

  /**
   * Get weekly report
   */
  async getWeeklyReport(weekStart?: string): Promise<WeeklyReport> {
    const response = await axiosInstance.get<WeeklyReport>(API_ENDPOINTS.REPORTS.WEEKLY, {
      params: { weekStart },
    });
    return response.data;
  },

  /**
   * Get monthly report
   */
  async getMonthlyReport(month?: number, year?: number): Promise<MonthlyReport> {
    const response = await axiosInstance.get<MonthlyReport>(API_ENDPOINTS.REPORTS.MONTHLY, {
      params: { month, year },
    });
    return response.data;
  },

  /**
   * Get sales report
   */
  async getSalesReport(startDate: string, endDate: string): Promise<SalesReport> {
    const response = await axiosInstance.get<SalesReport>(API_ENDPOINTS.REPORTS.SALES, {
      params: { startDate, endDate },
    });
    return response.data;
  },

  /**
   * Get delivery report
   */
  async getDeliveryReport(startDate: string, endDate: string): Promise<DeliveryReport> {
    const response = await axiosInstance.get<DeliveryReport>(API_ENDPOINTS.REPORTS.DELIVERIES, {
      params: { startDate, endDate },
    });
    return response.data;
  },

  /**
   * Get financial report
   */
  async getFinancialReport(startDate: string, endDate: string): Promise<FinancialReport> {
    const response = await axiosInstance.get<FinancialReport>(API_ENDPOINTS.REPORTS.FINANCIAL, {
      params: { startDate, endDate },
    });
    return response.data;
  },

  /**
   * Generate custom report
   */
  async generateCustomReport(request: CustomReportRequest): Promise<unknown> {
    const response = await axiosInstance.post(API_ENDPOINTS.REPORTS.CUSTOM, request);
    return response.data;
  },

  /**
   * Export report to PDF/Excel/CSV
   */
  async exportReport(request: ExportRequest): Promise<Blob> {
    const response = await axiosInstance.post(API_ENDPOINTS.REPORTS.EXPORT, request, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export default reportsService;

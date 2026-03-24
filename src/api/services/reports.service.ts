// src/api/services/reports.service.ts

import axiosInstance from '../axios.config';
import type {
  RevenueSummary,
  VatSummary,
  OutstandingSummary,
  ReportPeriod,
} from '@/types/reports.types';
import { format, startOfMonth, startOfYear, subDays } from 'date-fns';

// ── Date range helpers ────────────────────────────────────────────────────────

export function periodToDates(period: ReportPeriod): { from: string; to: string } {
  const today = new Date();
  const to    = format(today, 'yyyy-MM-dd');

  switch (period) {
    case '7d':
      return { from: format(subDays(today, 7),  'yyyy-MM-dd'), to };
    case '30d':
      return { from: format(subDays(today, 30), 'yyyy-MM-dd'), to };
    case '90d':
      return { from: format(subDays(today, 90), 'yyyy-MM-dd'), to };
    case 'mtd':
      return { from: format(startOfMonth(today), 'yyyy-MM-dd'), to };
    case 'ytd':
      return { from: format(startOfYear(today),  'yyyy-MM-dd'), to };
    default:
      return { from: format(subDays(today, 30), 'yyyy-MM-dd'), to };
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

export const reportsService = {

  // GET /api/reports/revenue/?from=&to=
  getRevenue: async (from: string, to: string): Promise<RevenueSummary> => {
    const { data } = await axiosInstance.get('/reports/revenue/', {
      params: { from, to },
    });
    return data;
  },

  // GET /api/reports/vat/?from=&to=
  getVat: async (from: string, to: string): Promise<VatSummary> => {
    const { data } = await axiosInstance.get('/reports/vat/', {
      params: { from, to },
    });
    return data;
  },

  // GET /api/reports/outstanding/
  getOutstanding: async (): Promise<OutstandingSummary> => {
    const { data } = await axiosInstance.get('/reports/outstanding/');
    return data;
  },
};
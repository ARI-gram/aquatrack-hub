// src/pages/accounts/ReportsPage.tsx
//
// Three tabs: Revenue, VAT Summary, Outstanding Balances.
// Period picker: 7d, 30d, 90d, MTD, YTD.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  TrendingUp, Receipt, AlertCircle, Loader2,
  RefreshCw, Download, Phone, Calendar,
  ArrowUpRight, ArrowDownRight, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { reportsService, periodToDates } from '@/api/services/reports.service';
import type {
  RevenueSummary, VatSummary, OutstandingSummary,
  ReportPeriod, RevenueByProduct,
} from '@/types/reports.types';
import { AccountsLayout } from '@/pages/accounts/AccountsLayout';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  try { return format(new Date(iso), 'd MMM yyyy'); } catch { return iso; }
};

// ── Period selector ───────────────────────────────────────────────────────────

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: '7d',  label: '7 Days'  },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
  { key: 'mtd', label: 'MTD'     },
  { key: 'ytd', label: 'YTD'     },
];

const PeriodPicker: React.FC<{
  value:    ReportPeriod;
  onChange: (p: ReportPeriod) => void;
}> = ({ value, onChange }) => (
  <div className="flex gap-1.5 bg-muted/40 p-1 rounded-2xl overflow-x-auto scrollbar-none">
    {PERIODS.map(p => (
      <button
        key={p.key}
        onClick={() => onChange(p.key)}
        className={cn(
          'flex-1 min-w-fit py-2 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
          value === p.key
            ? 'bg-background text-foreground shadow-sm border border-border/60'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {p.label}
      </button>
    ))}
  </div>
);

// ── Stat card ─────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string;
  sub?:  string;
  cls?:  string;
}> = ({ label, value, sub, cls = 'bg-muted/60 text-foreground border-border/60' }) => (
  <div className={cn('rounded-2xl border px-4 py-4', cls)}>
    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
    <p className="text-2xl font-black leading-none tabular-nums">{value}</p>
    {sub && <p className="text-[11px] opacity-60 mt-1.5">{sub}</p>}
  </div>
);

// ── Revenue tab ───────────────────────────────────────────────────────────────

const RevenueTab: React.FC<{ period: ReportPeriod }> = ({ period }) => {
  const [data,    setData]    = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = periodToDates(period);
      const res = await reportsService.getRevenue(from, to);
      setData(res);
    } catch {
      toast.error('Failed to load revenue report');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
    </div>
  );

  if (!data) return null;

  const topProducts = [...data.byProduct]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const maxRevenue = Math.max(...topProducts.map(p => p.revenue), 1);

  return (
    <div className="space-y-5">

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          label="Total Revenue"
          value={fmtMoney(data.totalRevenue)}
          sub={`${fmtDate(data.periodStart)} – ${fmtDate(data.periodEnd)}`}
          cls="bg-emerald-50 text-emerald-900 border-emerald-200/60 col-span-2"
        />
        <StatCard
          label="Orders"
          value={String(data.totalOrders)}
          sub="Completed orders"
          cls="bg-blue-50 text-blue-900 border-blue-200/60"
        />
        <StatCard
          label="Direct Sales"
          value={String(data.totalDirectSales)}
          sub="Counter & roadside"
          cls="bg-amber-50 text-amber-900 border-amber-200/60"
        />
        <StatCard
          label="Avg Order Value"
          value={fmtMoney(data.averageOrderValue)}
          cls="bg-muted/60 text-foreground border-border/60 col-span-2"
        />
      </div>

      {/* Daily revenue — simple bar chart */}
      {data.byDay.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />Daily Revenue
            </p>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-1 h-28">
              {data.byDay.map((day, i) => {
                const maxDay = Math.max(...data.byDay.map(d => d.revenue), 1);
                const pct    = (day.revenue / maxDay) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1 group relative"
                    title={`${fmtDate(day.date)}: ${fmtMoney(day.revenue)}`}
                  >
                    <div
                      className="w-full rounded-t-lg bg-primary/80 hover:bg-primary transition-all"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-muted-foreground">
                {fmtDate(data.byDay[0]?.date)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {fmtDate(data.byDay[data.byDay.length - 1]?.date)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top products */}
      {topProducts.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Package className="h-3.5 w-3.5" />Top Products by Revenue
            </p>
          </div>
          <div className="divide-y divide-border/30">
            {topProducts.map((p, i) => {
              const pct = (p.revenue / maxRevenue) * 100;
              return (
                <div key={p.productId} className="px-4 py-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-black text-muted-foreground w-4 shrink-0">
                        #{i + 1}
                      </span>
                      <p className="font-semibold text-sm truncate">{p.productName}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {p.unit}
                      </span>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-bold text-sm">{fmtMoney(p.revenue)}</p>
                      <p className="text-[10px] text-muted-foreground">{p.quantity} units</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily breakdown table */}
      {data.byDay.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Daily Breakdown
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/10">
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground">Date</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground">Orders</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground">Direct Sales</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {[...data.byDay].reverse().map((day, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-semibold">{fmtDate(day.date)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{day.orders}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{day.directSales}</td>
                    <td className="px-4 py-3 text-right font-bold">{fmtMoney(day.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── VAT tab ───────────────────────────────────────────────────────────────────

const VatTab: React.FC<{ period: ReportPeriod }> = ({ period }) => {
  const [data,    setData]    = useState<VatSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = periodToDates(period);
      const res = await reportsService.getVat(from, to);
      setData(res);
    } catch {
      toast.error('Failed to load VAT report');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
    </div>
  );

  if (!data) return null;

  if (!data.vatRegistered) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Receipt className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="font-bold text-base mb-1">Not VAT Registered</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Your business is not registered for VAT. Enable VAT registration in
          Accounts → Settings to generate VAT reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* VAT summary stats */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          label="Total VAT Collected"
          value={fmtMoney(data.totalVat)}
          sub={`Rate: ${data.vatRate}%`}
          cls="bg-blue-50 text-blue-900 border-blue-200/60 col-span-2"
        />
        <StatCard
          label="Net Sales (excl. VAT)"
          value={fmtMoney(data.totalSubtotal)}
          cls="bg-muted/60 text-foreground border-border/60"
        />
        <StatCard
          label="Gross (incl. VAT)"
          value={fmtMoney(data.totalGross)}
          cls="bg-muted/60 text-foreground border-border/60"
        />
        <StatCard
          label="Invoices"
          value={String(data.invoiceCount)}
          sub="In this period"
          cls="bg-muted/60 text-foreground border-border/60 col-span-2"
        />
      </div>

      {/* VAT notice */}
      <div className="px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-2xl dark:bg-amber-950/30 dark:border-amber-800">
        <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-0.5">
          KRA Filing Reminder
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          VAT returns are due by the 20th of each month. Ensure all invoices
          are issued before filing. Keep this report for your records.
        </p>
      </div>

      {/* VAT lines table */}
      {data.lines.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Invoice VAT Breakdown ({data.lines.length})
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/10">
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground">Invoice</th>
                  <th className="text-left px-4 py-2.5 font-bold text-muted-foreground">Customer</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground">Net</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground">VAT</th>
                  <th className="text-right px-4 py-2.5 font-bold text-muted-foreground">Gross</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {data.lines.map((line, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[11px]">
                      {line.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]">
                      {line.customerName}
                    </td>
                    <td className="px-4 py-3 text-right">{fmtMoney(line.subtotal)}</td>
                    <td className="px-4 py-3 text-right text-blue-600 font-semibold">
                      {fmtMoney(line.vatAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{fmtMoney(line.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20 font-black">
                  <td className="px-4 py-3" colSpan={2}>TOTALS</td>
                  <td className="px-4 py-3 text-right">{fmtMoney(data.totalSubtotal)}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{fmtMoney(data.totalVat)}</td>
                  <td className="px-4 py-3 text-right">{fmtMoney(data.totalGross)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Outstanding tab ───────────────────────────────────────────────────────────

const OutstandingTab: React.FC = () => {
  const [data,    setData]    = useState<OutstandingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsService.getOutstanding();
      setData(res);
    } catch {
      toast.error('Failed to load outstanding balances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
    </div>
  );

  if (!data) return null;

  return (
    <div className="space-y-5">

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          label="Total Outstanding"
          value={fmtMoney(data.totalOutstanding)}
          sub={`${data.customerCount} customer${data.customerCount !== 1 ? 's' : ''}`}
          cls="bg-amber-50 text-amber-900 border-amber-200/60 col-span-2"
        />
        <StatCard
          label="Overdue"
          value={fmtMoney(data.totalOverdue)}
          sub={`${data.overdueCount} overdue account${data.overdueCount !== 1 ? 's' : ''}`}
          cls="bg-red-50 text-red-900 border-red-200/60"
        />
        <StatCard
          label="Current"
          value={fmtMoney(data.totalOutstanding - data.totalOverdue)}
          sub="Within due date"
          cls="bg-muted/60 text-foreground border-border/60"
        />
      </div>

      {/* No outstanding */}
      {data.customers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="font-bold text-base mb-1">All Clear!</p>
          <p className="text-sm text-muted-foreground">No outstanding balances.</p>
        </div>
      )}

      {/* Customer list */}
      {data.customers.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Outstanding by Customer
            </p>
          </div>
          <div className="divide-y divide-border/30">
            {[...data.customers]
              .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
              .map(c => (
                <div key={c.customerId} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-bold text-sm truncate">{c.customerName}</p>
                        {c.isOverdue && (
                          <span className="text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5 shrink-0">
                            Overdue
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {c.customerPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />{c.customerPhone}
                          </span>
                        )}
                        <span>{c.invoiceCount} invoice{c.invoiceCount !== 1 ? 's' : ''}</span>
                        {c.oldestDueDate && (
                          <span className={cn(c.isOverdue ? 'text-red-600 font-semibold' : '')}>
                            Due: {fmtDate(c.oldestDueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        'font-black text-sm tabular-nums',
                        c.isOverdue ? 'text-red-600' : 'text-foreground',
                      )}>
                        {fmtMoney(c.outstandingAmount)}
                      </p>
                      {c.overdueAmount > 0 && c.overdueAmount !== c.outstandingAmount && (
                        <p className="text-[10px] text-red-500 font-semibold">
                          {fmtMoney(c.overdueAmount)} overdue
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Mini progress bar — overdue portion */}
                  {c.overdueAmount > 0 && (
                    <div className="mt-2.5 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-400 rounded-full"
                        style={{
                          width: `${Math.min(100, (c.overdueAmount / c.outstandingAmount) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

type TabKey = 'revenue' | 'vat' | 'outstanding';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'revenue',     label: 'Revenue',     icon: <TrendingUp  className="h-4 w-4" /> },
  { key: 'vat',         label: 'VAT',         icon: <Receipt     className="h-4 w-4" /> },
  { key: 'outstanding', label: 'Outstanding', icon: <AlertCircle className="h-4 w-4" /> },
];

export const ReportsPage: React.FC = () => {
  const [tab,    setTab]    = useState<TabKey>('revenue');
  const [period, setPeriod] = useState<ReportPeriod>('30d');

  return (
    <AccountsLayout title="Reports" subtitle="Revenue, VAT and outstanding balances">
    <div className="max-w-3xl mx-auto px-4 pt-6 pb-10 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Revenue, VAT, and outstanding balances
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 bg-muted/40 p-1 rounded-2xl">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all',
              tab === t.key
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Period picker — only for revenue and VAT */}
      {tab !== 'outstanding' && (
        <PeriodPicker value={period} onChange={setPeriod} />
      )}

      {/* Tab content */}
      {tab === 'revenue'     && <RevenueTab     period={period} />}
      {tab === 'vat'         && <VatTab         period={period} />}
      {tab === 'outstanding' && <OutstandingTab />}

    </div>
    </AccountsLayout>
  );
};

export default ReportsPage;
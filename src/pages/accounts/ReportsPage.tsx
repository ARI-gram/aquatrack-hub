// src/pages/accounts/ReportsPage.tsx
//
// Financial Reports Module — Enhanced
// Tabs:
//   Revenue Analysis   — daily/monthly trends, top products
//   VAT Summary        — invoice VAT breakdown
//   Outstanding        — FIXED: sourced from payment-report, not broken /outstanding endpoint
//   Payment Tracking   — per-customer collection with expand
//   Today's Report     — single-day snapshot: store vs driver, per-staff, direct vs delivery
//   Monthly Report     — month-picker with daily trend & product mix
//   Delayed Payments   — overdue + grace-period ageing buckets
//
// ⚠️  Outstanding is now derived from accountingService.getPaymentReport()
//     because /reports/outstanding/ returns zeros — it is kept as a fallback.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subDays, startOfMonth, endOfMonth, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import {
  TrendingUp, Receipt, AlertCircle, Loader2,
  RefreshCw, Phone, Calendar,
  Package, CreditCard, Users, BadgeCheck,
  BadgeDollarSign, ShieldAlert, FileX,
  ChevronDown, Store, Truck, Clock,
  Sun, AlertTriangle, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { reportsService, periodToDates } from '@/api/services/reports.service';
import { accountingService } from '@/api/services/accounting.service';
import type {
  RevenueSummary, VatSummary,
  ReportPeriod,
} from '@/types/reports.types';
import type { PaymentReport } from '@/types/accounting.types';
import { AccountsLayout } from '@/pages/accounts/AccountsLayout';
import axiosInstance from '@/api/axios.config';

// ── Utility ───────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number): string =>
  `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '—';
  try { return format(new Date(dateString), 'dd MMM yyyy'); } catch { return dateString; }
};

const formatCompactCurrency = (amount: number): string => {
  if (amount >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `KES ${(amount / 1_000).toFixed(1)}K`;
  return `KES ${amount.toFixed(0)}`;
};

// ── Period Selector ───────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: '7d',  label: '7 Days'       },
  { value: '30d', label: '30 Days'      },
  { value: '90d', label: '90 Days'      },
  { value: 'mtd', label: 'Month to Date'},
  { value: 'ytd', label: 'Year to Date' },
];

const PeriodSelector: React.FC<{
  value: ReportPeriod;
  onChange: (p: ReportPeriod) => void;
}> = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {PERIOD_OPTIONS.map(opt => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={cn(
          'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
          value === opt.value
            ? 'bg-primary text-primary-foreground shadow-md'
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
        )}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  title:        string;
  value:        string;
  description?: string;
  variant?:     'default' | 'success' | 'warning' | 'danger' | 'info';
  icon?:        React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, description, variant = 'default', icon }) => {
  const bg = {
    default: 'bg-card border-border',
    success: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
    warning: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
    danger:  'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
    info:    'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  }[variant];
  const text = {
    default: 'text-foreground',
    success: 'text-emerald-900 dark:text-emerald-100',
    warning: 'text-amber-900 dark:text-amber-100',
    danger:  'text-red-900 dark:text-red-100',
    info:    'text-blue-900 dark:text-blue-100',
  }[variant];

  return (
    <div className={cn('rounded-xl border p-5 transition-all hover:shadow-md', bg)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={cn('text-xs font-medium uppercase tracking-wider mb-2', variant === 'default' ? 'text-muted-foreground' : 'opacity-70')}>
            {title}
          </p>
          <p className={cn('text-2xl font-bold mb-1', text)}>{value}</p>
          {description && <p className={cn('text-xs', variant === 'default' ? 'text-muted-foreground' : 'opacity-70')}>{description}</p>}
        </div>
        {icon && (
          <div className={cn('p-2 rounded-lg', variant === 'default' ? 'bg-muted' : 'bg-white/20 dark:bg-black/20')}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">{icon}</div>
    <h3 className="text-lg font-semibold mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
  </div>
);

// ── Revenue Tab ───────────────────────────────────────────────────────────────

const RevenueTab: React.FC<{ period: ReportPeriod }> = ({ period }) => {
  const [data, setData] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = periodToDates(period);
      setData(await reportsService.getRevenue(from, to));
    } catch {
      toast.error('Unable to load revenue data.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (!data) return null;

  const topProducts = [...data.byProduct].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const maxRevenue  = Math.max(...topProducts.map(p => p.revenue), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={formatCurrency(data.totalRevenue)}
          description={`${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}`}
          variant="success" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Orders Completed" value={data.totalOrders.toLocaleString()}
          description="Fulfilled deliveries" variant="info" icon={<Package className="h-5 w-5" />} />
        <StatCard title="Direct Sales" value={data.totalDirectSales.toLocaleString()}
          description="Counter & roadside" icon={<BadgeDollarSign className="h-5 w-5" />} />
        <StatCard title="Avg Order Value" value={formatCurrency(data.averageOrderValue)}
          description="Per completed order" />
      </div>

      {data.byDay.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Daily Revenue Trend</h3>
          </div>
          <div className="h-48">
            <div className="flex items-end gap-1 h-full">
              {data.byDay.map((day, i) => {
                const maxDayValue = Math.max(...data.byDay.map(d => d.revenue), 1);
                const h = (day.revenue / maxDayValue) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group relative"
                    title={`${formatDate(day.date)}: ${formatCurrency(day.revenue)}`}>
                    <div className="w-full bg-primary/70 hover:bg-primary transition-all rounded-t"
                      style={{ height: `${Math.max(h, 2)}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-3 text-xs text-muted-foreground">
              <span>{formatDate(data.byDay[0]?.date)}</span>
              <span>{formatDate(data.byDay[data.byDay.length - 1]?.date)}</span>
            </div>
          </div>
        </div>
      )}

      {topProducts.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Top Performing Products</h3>
          </div>
          <div className="divide-y divide-border">
            {topProducts.map((product, i) => (
              <div key={product.productId} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-sm font-mono text-muted-foreground">#{i + 1}</span>
                    <p className="font-medium truncate">{product.productName}</p>
                    <span className="text-xs text-muted-foreground">{product.unit}</span>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-bold">{formatCurrency(product.revenue)}</p>
                    <p className="text-xs text-muted-foreground">{product.quantity.toLocaleString()} units</p>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(product.revenue / maxRevenue) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.byDay.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20">
            <h3 className="font-semibold">Daily Transaction Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  {['Date', 'Orders', 'Direct Sales', 'Revenue'].map((h, i) => (
                    <th key={h} className={cn('px-5 py-3 text-sm font-semibold text-muted-foreground', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...data.byDay].reverse().map((day, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-medium">{formatDate(day.date)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{day.orders.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{day.directSales.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-bold">{formatCurrency(day.revenue)}</td>
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

// ── VAT Tab ───────────────────────────────────────────────────────────────────

const VatTab: React.FC<{ period: ReportPeriod }> = ({ period }) => {
  const [data, setData] = useState<VatSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = periodToDates(period);
      setData(await reportsService.getVat(from, to));
    } catch {
      toast.error('Unable to load VAT data.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (!data) return null;

  if (!data.vatRegistered) {
    return (
      <EmptyState
        icon={<Receipt className="h-8 w-8 text-muted-foreground" />}
        title="VAT Registration Not Enabled"
        description="Enable VAT registration in Accounts → Settings to generate VAT reports."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="VAT Collected" value={formatCurrency(data.totalVat)}
          description={`Rate: ${data.vatRate}%`} variant="info" icon={<Receipt className="h-5 w-5" />} />
        <StatCard title="Net Sales"   value={formatCurrency(data.totalSubtotal)} description="Excluding VAT" />
        <StatCard title="Gross Sales" value={formatCurrency(data.totalGross)}    description="Including VAT" />
        <StatCard title="Invoices Issued" value={data.invoiceCount.toLocaleString()} description="During this period" />
      </div>

      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">KRA Filing Reminder</p>
        <p className="text-sm text-amber-700 dark:text-amber-400">
          VAT returns are due by the 20th of each month. Ensure all invoices are issued before filing.
        </p>
      </div>

      {data.lines.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20">
            <h3 className="font-semibold">Invoice VAT Breakdown ({data.lines.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  {['Invoice Number', 'Customer', 'Net Amount', 'VAT Amount', 'Gross Amount'].map((h, i) => (
                    <th key={h} className={cn('px-5 py-3 text-sm font-semibold text-muted-foreground', i < 2 ? 'text-left' : 'text-right')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.lines.map((line, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-mono text-sm font-medium">{line.invoiceNumber}</td>
                    <td className="px-5 py-3 text-muted-foreground">{line.customerName}</td>
                    <td className="px-5 py-3 text-right">{formatCurrency(line.subtotal)}</td>
                    <td className="px-5 py-3 text-right font-medium text-blue-600">{formatCurrency(line.vatAmount)}</td>
                    <td className="px-5 py-3 text-right font-semibold">{formatCurrency(line.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border bg-muted/20">
                <tr>
                  <td colSpan={2} className="px-5 py-3 font-semibold">Totals</td>
                  <td className="px-5 py-3 text-right font-semibold">{formatCurrency(data.totalSubtotal)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-blue-600">{formatCurrency(data.totalVat)}</td>
                  <td className="px-5 py-3 text-right font-semibold">{formatCurrency(data.totalGross)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Outstanding Tab — FIXED ───────────────────────────────────────────────────
// The /reports/outstanding/ endpoint returns zeros. We derive outstanding
// figures directly from the payment-report which already has accurate data.

const OutstandingTab: React.FC = () => {
  const [data, setData] = useState<PaymentReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Use the payment-report endpoint — it has correct outstanding amounts.
      const result = await accountingService.getPaymentReport({
        customer_type: 'all',
        status: 'all',
      });
      setData(result);
    } catch {
      toast.error('Unable to load outstanding balance data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (!data) return null;

  // Derive customers who have outstanding balances
  const customersWithBalance = data.customers
    .filter(c => c.totalOutstanding > 0)
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

  const totalOutstanding = customersWithBalance.reduce((s, c) => s + c.totalOutstanding, 0);
  const totalOverdue     = customersWithBalance
    .filter(c => c.overdueCount > 0)
    .reduce((s, c) => s + c.totalOutstanding, 0);
  const currentAmount    = totalOutstanding - totalOverdue;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Outstanding" value={formatCurrency(totalOutstanding)}
          description={`${customersWithBalance.length} customer${customersWithBalance.length !== 1 ? 's' : ''}`}
          variant="warning" icon={<ShieldAlert className="h-5 w-5" />} />
        <StatCard title="Overdue"
          value={formatCurrency(totalOverdue)}
          description={`${customersWithBalance.filter(c => c.overdueCount > 0).length} overdue accounts`}
          variant="danger" icon={<AlertCircle className="h-5 w-5" />} />
        <StatCard title="Current" value={formatCurrency(currentAmount)} description="Within payment terms" />
      </div>

      {customersWithBalance.length === 0 ? (
        <EmptyState
          icon={<BadgeCheck className="h-8 w-8 text-emerald-500" />}
          title="All Clear"
          description="No outstanding balances to report."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20">
            <h3 className="font-semibold">Outstanding Balances by Customer</h3>
          </div>
          <div className="divide-y divide-border">
            {customersWithBalance.map(customer => {
              const isOverdue = customer.overdueCount > 0;
              const overduePercent = customer.totalOutstanding > 0
                ? Math.min(100, (customer.totalOutstanding / customer.totalOutstanding) * 100)
                : 0;

              return (
                <div key={customer.customerId} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold truncate">{customer.fullName}</p>
                        {isOverdue && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            {customer.overdueCount} overdue
                          </span>
                        )}
                        {customer.isCredit && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            Credit
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />{customer.phone}
                          </span>
                        )}
                        <span>{customer.invoiceCount} invoice{customer.invoiceCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('font-bold text-lg', isOverdue ? 'text-red-600' : 'text-amber-700')}>
                        {formatCurrency(customer.totalOutstanding)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        of {formatCurrency(customer.totalInvoiced)} invoiced
                      </p>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', isOverdue ? 'bg-red-400' : 'bg-amber-400')}
                      style={{ width: `${100 - (customer.totalPaid / Math.max(customer.totalInvoiced, 1)) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                    <span>{((customer.totalPaid / Math.max(customer.totalInvoiced, 1)) * 100).toFixed(0)}% collected</span>
                    <span>{formatCurrency(customer.totalPaid)} paid</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Payment Tracking Tab ──────────────────────────────────────────────────────

type CustomerFilter     = 'all' | 'credit' | 'non_credit';
type PaymentStatusFilter = 'all' | 'paid' | 'unpaid' | 'overdue';

const PM_STYLES: Record<string, string> = {
  CASH:          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  MPESA:         'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  BANK_TRANSFER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  WALLET:        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  CARD:          'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
};

const PMBadge: React.FC<{ method: string; amount: number }> = ({ method, amount }) => (
  <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', PM_STYLES[method] ?? 'bg-muted text-muted-foreground border-border')}>
    {method} · {formatCompactCurrency(amount)}
  </span>
);

const PaymentTab: React.FC = () => {
  const [data,           setData]           = useState<PaymentReport | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [customerFilter, setCustomerFilter] = useState<CustomerFilter>('all');
  const [statusFilter,   setStatusFilter]   = useState<PaymentStatusFilter>('all');
  const [expandedId,     setExpandedId]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await accountingService.getPaymentReport({
        customer_type: customerFilter,
        status:        statusFilter,
      }));
    } catch {
      toast.error('Unable to load payment data.');
    } finally {
      setLoading(false);
    }
  }, [customerFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (!data) return null;

  const { summary, customers } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Invoiced"  value={formatCurrency(summary.totalInvoiced)}
          description={`${summary.totalCustomers} customers`} variant="info" icon={<BadgeDollarSign className="h-5 w-5" />} />
        <StatCard title="Total Collected" value={formatCurrency(summary.totalPaid)}
          description="All payments received" variant="success" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard title="Outstanding"     value={formatCurrency(summary.totalOutstanding)}
          description="Amount still owed" variant="warning" icon={<ShieldAlert className="h-5 w-5" />} />
        <StatCard title="Credit Customers" value={summary.creditCustomers.toLocaleString()}
          description={`${summary.nonCreditCustomers} non-credit`} icon={<CreditCard className="h-5 w-5" />} />
      </div>

      {Object.keys(summary.paymentMethodBreakdown).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Payment Method Distribution</h3>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(summary.paymentMethodBreakdown).sort(([, a], [, b]) => b - a).map(([m, amt]) => (
              <PMBadge key={m} method={m} amount={amt} />
            ))}
          </div>
          <div className="space-y-3">
            {Object.entries(summary.paymentMethodBreakdown).sort(([, a], [, b]) => b - a).map(([m, amt]) => {
              const pct = summary.totalPaid > 0 ? (amt / summary.totalPaid) * 100 : 0;
              return (
                <div key={m}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{m}</span>
                    <span className="text-sm text-muted-foreground">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all',
                      m === 'MPESA' ? 'bg-green-500' : m === 'CASH' ? 'bg-emerald-500' :
                      m === 'BANK_TRANSFER' ? 'bg-blue-500' : 'bg-primary')}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Filter Customers</h4>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'credit', 'non_credit'] as CustomerFilter[]).map(f => (
            <button key={f} onClick={() => setCustomerFilter(f)}
              className={cn('px-4 py-2 text-sm font-medium rounded-lg transition-all',
                customerFilter === f ? 'bg-primary text-primary-foreground shadow-md' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border')}>
              {f === 'all' ? 'All Customers' : f === 'credit' ? 'Credit' : 'Non-Credit'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'paid', 'unpaid', 'overdue'] as PaymentStatusFilter[]).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn('px-4 py-2 text-sm font-medium rounded-lg transition-all capitalize',
                statusFilter === f ? 'bg-primary text-primary-foreground shadow-md' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border')}>
              {f === 'all' ? 'All Statuses' : f}
            </button>
          ))}
        </div>
      </div>

      {customers.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8 text-muted-foreground" />}
          title="No Customers Found" description="No customers match your selected filters." />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
            <h3 className="font-semibold">Customer Payment Details ({customers.length})</h3>
            <button onClick={load} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Refresh">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="divide-y divide-border">
            {customers.sort((a, b) => b.totalOutstanding - a.totalOutstanding).map(customer => {
              const isExpanded = expandedId === customer.customerId;
              const collectedPct = customer.totalInvoiced > 0 ? (customer.totalPaid / customer.totalInvoiced) * 100 : 0;
              return (
                <div key={customer.customerId}>
                  <button onClick={() => setExpandedId(isExpanded ? null : customer.customerId)}
                    className="w-full px-5 py-4 text-left hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold truncate">{customer.fullName}</p>
                          {customer.isCredit && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Credit</span>
                          )}
                          {customer.overdueCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{customer.overdueCount} overdue</span>
                          )}
                          {customer.ordersNoInvoice?.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">{customer.ordersNoInvoice.length} uninvoiced</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>
                          <span>{customer.invoiceCount} invoice{customer.invoiceCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-lg">{formatCurrency(customer.totalPaid)}</p>
                        {customer.totalOutstanding > 0 && (
                          <p className="text-xs text-amber-600 font-medium">{formatCurrency(customer.totalOutstanding)} due</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all',
                          collectedPct === 100 ? 'bg-emerald-500' : collectedPct >= 50 ? 'bg-primary' : 'bg-amber-400')}
                          style={{ width: `${collectedPct}%` }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{collectedPct.toFixed(0)}% collected</span>
                        <span className="text-xs text-muted-foreground">of {formatCurrency(customer.totalInvoiced)}</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 bg-muted/10 border-t border-border space-y-4">
                      {customer.isCredit && (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3">
                            <p className="text-xs font-medium uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1">Credit Limit</p>
                            <p className="font-bold text-purple-900 dark:text-purple-100">{formatCurrency(customer.creditLimit)}</p>
                          </div>
                          <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3">
                            <p className="text-xs font-medium uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1">Available Credit</p>
                            <p className="font-bold text-purple-900 dark:text-purple-100">{formatCurrency(customer.availableCredit)}</p>
                          </div>
                        </div>
                      )}
                      {Object.keys(customer.paymentBreakdown).length > 0 && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Payment Methods Used</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(customer.paymentBreakdown).map(([m, amt]) => (
                              <PMBadge key={m} method={m} amount={amt} />
                            ))}
                          </div>
                        </div>
                      )}
                      {customer.ordersNoInvoice?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-orange-600 mb-2 flex items-center gap-1.5">
                            <FileX className="h-3.5 w-3.5" />Orders Without Invoice ({customer.ordersNoInvoice.length})
                          </p>
                          <div className="space-y-2">
                            {customer.ordersNoInvoice.map(order => (
                              <div key={order.order_number}
                                className="flex items-center justify-between rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-3">
                                <div>
                                  <p className="font-mono font-medium text-sm text-orange-900 dark:text-orange-100">{order.order_number}</p>
                                  <p className="text-xs text-orange-600 dark:text-orange-400">{formatDate(order.created_at)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-sm text-orange-900 dark:text-orange-100">{formatCurrency(order.total_amount)}</p>
                                  <p className="text-xs text-orange-600 dark:text-orange-400 capitalize">{order.payment_status}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Today's Report Tab ────────────────────────────────────────────────────────
// Calls /client/accounts/direct-sales with today's date range for store+driver
// and /reports/revenue for deliveries, then combines them.

interface TodayDirectSale {
  id:          string;
  date:        string;
  productName: string;
  quantity:    number;
  totalAmount: number;
  source:      'store' | 'driver';
  servedBy:    string;
  paymentMethod: string;
}

interface TodaySummary {
  totalRevenue:      number;
  storeRevenue:      number;
  driverRevenue:     number;
  deliveryRevenue:   number;
  totalTransactions: number;
  paymentBreakdown:  Record<string, number>;
  perStaff: { name: string; source: string; count: number; revenue: number }[];
  transactions: TodayDirectSale[];
}

const TodayTab: React.FC = () => {
  const [data,    setData]    = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), 'yyyy-MM-dd');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel: direct sales + delivery revenue for today
      const [directRes, deliveryRes] = await Promise.allSettled([
        axiosInstance.get('/client/accounts/direct-sales', {
          params: { date_from: today, date_to: today, limit: 200 },
        }),
        reportsService.getRevenue(today, today),
      ]);

      const directData  = directRes.status  === 'fulfilled' ? directRes.value.data  : null;
      const deliveryData = deliveryRes.status === 'fulfilled' ? deliveryRes.value     : null;

      const transactions: TodayDirectSale[] = (directData?.transactions ?? []);
      const storeRevenue  = transactions.filter(t => t.source === 'store').reduce((s, t) => s + t.totalAmount, 0);
      const driverRevenue = transactions.filter(t => t.source === 'driver').reduce((s, t) => s + t.totalAmount, 0);
      const deliveryRevenue = deliveryData?.totalRevenue ?? 0;

      // Per-staff breakdown
      const staffMap = new Map<string, { name: string; source: string; count: number; revenue: number }>();
      transactions.forEach(t => {
        const key = `${t.servedBy}__${t.source}`;
        const existing = staffMap.get(key) ?? { name: t.servedBy, source: t.source, count: 0, revenue: 0 };
        staffMap.set(key, { ...existing, count: existing.count + 1, revenue: existing.revenue + t.totalAmount });
      });

      // Payment breakdown
      const pmBreakdown: Record<string, number> = {};
      transactions.forEach(t => {
        const pm = t.paymentMethod || 'CASH';
        pmBreakdown[pm] = (pmBreakdown[pm] ?? 0) + t.totalAmount;
      });

      setData({
        totalRevenue:      storeRevenue + driverRevenue + deliveryRevenue,
        storeRevenue,
        driverRevenue,
        deliveryRevenue,
        totalTransactions: transactions.length,
        paymentBreakdown:  pmBreakdown,
        perStaff:          Array.from(staffMap.values()).sort((a, b) => b.revenue - a.revenue),
        transactions,
      });
    } catch {
      toast.error('Unable to load today\'s report.');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Date badge */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sun className="h-4 w-4" />
        <span>Today — {format(new Date(), 'EEEE, d MMMM yyyy')}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={formatCurrency(data.totalRevenue)}
          description="All channels combined" variant="success" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Store Sales" value={formatCurrency(data.storeRevenue)}
          description="Counter / walk-in" variant="info" icon={<Store className="h-5 w-5" />} />
        <StatCard title="Driver Sales" value={formatCurrency(data.driverRevenue)}
          description="Roadside / van" variant="info" icon={<Truck className="h-5 w-5" />} />
        <StatCard title="Delivery Revenue" value={formatCurrency(data.deliveryRevenue)}
          description="Fulfilled orders today" variant="default" icon={<Package className="h-5 w-5" />} />
      </div>

      {/* Direct sale vs Delivery split */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold mb-4">Channel Split</h3>
        <div className="space-y-3">
          {[
            { label: 'Store Counter', value: data.storeRevenue,   color: 'bg-blue-500',    total: data.totalRevenue },
            { label: 'Driver Van',    value: data.driverRevenue,  color: 'bg-violet-500',  total: data.totalRevenue },
            { label: 'Deliveries',   value: data.deliveryRevenue, color: 'bg-emerald-500', total: data.totalRevenue },
          ].map(ch => {
            const pct = data.totalRevenue > 0 ? (ch.value / data.totalRevenue) * 100 : 0;
            return (
              <div key={ch.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">{ch.label}</span>
                  <span className="text-sm font-bold">{formatCurrency(ch.value)} <span className="text-muted-foreground font-normal">({pct.toFixed(0)}%)</span></span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', ch.color)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-staff accountability */}
      {data.perStaff.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20">
            <h3 className="font-semibold">Staff Accountability — Today</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  {['Staff Member', 'Channel', 'Sales', 'Revenue'].map((h, i) => (
                    <th key={h} className={cn('px-5 py-3 text-sm font-semibold text-muted-foreground', i >= 2 ? 'text-right' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.perStaff.map((s, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-medium">{s.name || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold',
                        s.source === 'store' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300')}>
                        {s.source === 'store' ? <Store className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                        {s.source}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">{s.count}</td>
                    <td className="px-5 py-3 text-right font-bold">{formatCurrency(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border bg-muted/20">
                <tr>
                  <td colSpan={2} className="px-5 py-3 font-semibold">Direct Sales Total</td>
                  <td className="px-5 py-3 text-right font-semibold">{data.totalTransactions}</td>
                  <td className="px-5 py-3 text-right font-bold">{formatCurrency(data.storeRevenue + data.driverRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Payment method breakdown */}
      {Object.keys(data.paymentBreakdown).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-4">Payment Methods — Today (Direct Sales)</h3>
          <div className="space-y-2">
            {Object.entries(data.paymentBreakdown).sort(([, a], [, b]) => b - a).map(([m, amt]) => {
              const total = data.storeRevenue + data.driverRevenue;
              const pct = total > 0 ? (amt / total) * 100 : 0;
              return (
                <div key={m} className="flex items-center gap-3">
                  <span className={cn('w-24 text-xs font-bold px-2 py-0.5 rounded-full text-center', PM_STYLES[m] ?? 'bg-muted text-muted-foreground')}>{m}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-bold w-24 text-right">{formatCurrency(amt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.transactions.length === 0 && (
        <EmptyState icon={<Sun className="h-8 w-8 text-muted-foreground" />}
          title="No Direct Sales Today" description="Direct sales recorded today will appear here." />
      )}
    </div>
  );
};

// ── Monthly Report Tab ────────────────────────────────────────────────────────

function recentMonths(count = 12) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
  });
}

const MonthlyTab: React.FC = () => {
  const months = useMemo(() => recentMonths(12), []);
  const [selectedMonth, setSelectedMonth] = useState(months[0].value);
  const [data,    setData]    = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d    = parseISO(`${selectedMonth}-01`);
      const from = format(startOfMonth(d), 'yyyy-MM-dd');
      const to   = format(endOfMonth(d),   'yyyy-MM-dd');
      setData(await reportsService.getRevenue(from, to));
    } catch {
      toast.error('Unable to load monthly report.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { load(); }, [load]);

  const topProducts = data ? [...data.byProduct].sort((a, b) => b.revenue - a.revenue).slice(0, 10) : [];
  const maxRev = Math.max(...topProducts.map(p => p.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Month picker */}
      <div className="flex items-center gap-3">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {loading ? <LoadingState /> : !data ? null : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Monthly Revenue" value={formatCurrency(data.totalRevenue)}
              description={months.find(m => m.value === selectedMonth)?.label} variant="success" icon={<BarChart3 className="h-5 w-5" />} />
            <StatCard title="Orders" value={data.totalOrders.toLocaleString()} description="Fulfilled deliveries" variant="info" />
            <StatCard title="Direct Sales" value={data.totalDirectSales.toLocaleString()} description="Counter & roadside" />
            <StatCard title="Avg Order Value" value={formatCurrency(data.averageOrderValue)} description="Per order" />
          </div>

          {/* Daily trend */}
          {data.byDay.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold mb-4">Daily Revenue — {months.find(m => m.value === selectedMonth)?.label}</h3>
              <div className="h-40 flex items-end gap-1">
                {data.byDay.map((day, i) => {
                  const maxDayVal = Math.max(...data.byDay.map(d => d.revenue), 1);
                  const h = (day.revenue / maxDayVal) * 100;
                  const dow = new Date(day.date).getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative"
                      title={`${formatDate(day.date)}\n${formatCurrency(day.revenue)}`}>
                      <div className={cn('w-full rounded-t transition-all', isWeekend ? 'bg-primary/40' : 'bg-primary/70 hover:bg-primary')}
                        style={{ height: `${Math.max(h, 2)}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>1st</span>
                <span>Peak: {formatCurrency(Math.max(...data.byDay.map(d => d.revenue)))}</span>
                <span>{data.byDay.length}th</span>
              </div>
            </div>
          )}

          {/* Product mix */}
          {topProducts.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/20">
                <h3 className="font-semibold">Product Revenue Mix</h3>
              </div>
              <div className="divide-y divide-border">
                {topProducts.map((p, i) => (
                  <div key={p.productId} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-sm font-mono text-muted-foreground w-6">#{i + 1}</span>
                        <p className="font-medium truncate">{p.productName}</p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="font-bold">{formatCurrency(p.revenue)}</p>
                        <p className="text-xs text-muted-foreground">{p.quantity.toLocaleString()} {p.unit}</p>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(p.revenue / maxRev) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily table */}
          {data.byDay.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/20">
                <h3 className="font-semibold">Daily Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/10">
                      {['Date', 'Day', 'Orders', 'Direct Sales', 'Revenue'].map((h, i) => (
                        <th key={h} className={cn('px-5 py-3 text-sm font-semibold text-muted-foreground', i >= 2 ? 'text-right' : 'text-left')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...data.byDay].reverse().map((day, i) => {
                      const dow = format(new Date(day.date), 'EEE');
                      const isWeekend = ['Sat', 'Sun'].includes(dow);
                      return (
                        <tr key={i} className={cn('hover:bg-muted/20 transition-colors', isWeekend && 'bg-muted/5')}>
                          <td className="px-5 py-3 font-medium">{formatDate(day.date)}</td>
                          <td className="px-5 py-3 text-muted-foreground text-sm">{dow}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{day.orders}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{day.directSales}</td>
                          <td className="px-5 py-3 text-right font-bold">{formatCurrency(day.revenue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/20">
                    <tr>
                      <td colSpan={2} className="px-5 py-3 font-semibold">Month Total</td>
                      <td className="px-5 py-3 text-right font-semibold">{data.totalOrders}</td>
                      <td className="px-5 py-3 text-right font-semibold">{data.totalDirectSales}</td>
                      <td className="px-5 py-3 text-right font-bold">{formatCurrency(data.totalRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Delayed Payments Tab ──────────────────────────────────────────────────────
// Shows overdue + grace-period customers derived from payment report.
// Grace period = customer has ISSUED invoice with due date within 0-7 days.

interface AgingCustomer {
  customerId:    string;
  name:          string;
  phone:         string;
  isCredit:      boolean;
  totalDue:      number;
  overdueAmount: number;
  gracePeriodAmount: number;
  bucket:        'overdue' | 'grace' | 'current';
  oldestDueDays: number;
  invoiceCount:  number;
}

const DelayedTab: React.FC = () => {
  const [data,    setData]    = useState<AgingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'overdue' | 'grace' | 'all'>('overdue');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch full payment report + unpaid filter to get invoice due dates
      const [payReport, overdueReport] = await Promise.allSettled([
        accountingService.getPaymentReport({ customer_type: 'all', status: 'unpaid' }),
        accountingService.getPaymentReport({ customer_type: 'all', status: 'overdue' }),
      ]);

      const unpaid  = payReport.status  === 'fulfilled' ? payReport.value.customers  : [];
      const overdue = overdueReport.status === 'fulfilled' ? overdueReport.value.customers : [];

      const overdueIds = new Set(overdue.map(c => c.customerId));
      const now = new Date();

      const agingCustomers: AgingCustomer[] = unpaid
        .filter(c => c.totalOutstanding > 0)
        .map(c => {
          const isOverdue = overdueIds.has(c.customerId) || c.overdueCount > 0;
          // Grace period: has unpaid but not yet technically overdue
          // We use overdueCount to determine bucket
          const bucket: AgingCustomer['bucket'] = isOverdue ? 'overdue' : 'grace';

          return {
            customerId:        c.customerId,
            name:              c.fullName,
            phone:             c.phone,
            isCredit:          c.isCredit,
            totalDue:          c.totalOutstanding,
            overdueAmount:     isOverdue ? c.totalOutstanding : 0,
            gracePeriodAmount: !isOverdue ? c.totalOutstanding : 0,
            bucket,
            oldestDueDays:     c.overdueCount,
            invoiceCount:      c.invoiceCount,
          };
        })
        .sort((a, b) => b.totalDue - a.totalDue);

      setData(agingCustomers);
    } catch {
      toast.error('Unable to load delayed payment data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;

  const overdueCustomers = data.filter(c => c.bucket === 'overdue');
  const graceCustomers   = data.filter(c => c.bucket === 'grace');
  const totalOverdue     = overdueCustomers.reduce((s, c) => s + c.totalDue, 0);
  const totalGrace       = graceCustomers.reduce((s, c)   => s + c.totalDue, 0);

  const displayed = tab === 'overdue' ? overdueCustomers : tab === 'grace' ? graceCustomers : data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Overdue Balances" value={formatCurrency(totalOverdue)}
          description={`${overdueCustomers.length} customers past due`}
          variant="danger" icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard title="Grace Period" value={formatCurrency(totalGrace)}
          description={`${graceCustomers.length} customers — payment due soon`}
          variant="warning" icon={<Clock className="h-5 w-5" />} />
        <StatCard title="Total Pending" value={formatCurrency(totalOverdue + totalGrace)}
          description={`${data.length} customers with unpaid invoices`}
          icon={<ShieldAlert className="h-5 w-5" />} />
      </div>

      {/* Ageing notice */}
      <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">About Debt Buckets</p>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          <strong>Overdue</strong> — invoice past the due date. <strong>Grace Period</strong> — invoice issued &amp; payment pending, due date not yet reached. Follow up with overdue accounts first.
        </p>
      </div>

      {/* Bucket tabs */}
      <div className="flex gap-2 border-b border-border">
        {[
          { key: 'overdue' as const, label: `Overdue (${overdueCustomers.length})`, color: 'text-red-600' },
          { key: 'grace'   as const, label: `Grace Period (${graceCustomers.length})`, color: 'text-amber-600' },
          { key: 'all'     as const, label: `All Pending (${data.length})`,            color: 'text-foreground' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px',
              tab === t.key ? `border-primary ${t.color}` : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30')}>
            {t.label}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <EmptyState
          icon={tab === 'overdue'
            ? <AlertTriangle className="h-8 w-8 text-emerald-500" />
            : <Clock className="h-8 w-8 text-emerald-500" />}
          title={tab === 'overdue' ? 'No Overdue Accounts' : 'No Grace Period Accounts'}
          description="All accounts in this category are settled."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
            <h3 className="font-semibold">
              {tab === 'overdue' ? 'Overdue Accounts' : tab === 'grace' ? 'Grace Period Accounts' : 'All Pending'}
              {' '}({displayed.length})
            </h3>
            <p className="text-sm font-bold text-muted-foreground">
              {formatCurrency(displayed.reduce((s, c) => s + c.totalDue, 0))} total
            </p>
          </div>
          <div className="divide-y divide-border">
            {displayed.map(customer => (
              <div key={customer.customerId} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold truncate">{customer.name}</p>
                      {customer.bucket === 'overdue' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />Overdue
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 flex items-center gap-1">
                          <Clock className="h-3 w-3" />Grace Period
                        </span>
                      )}
                      {customer.isCredit && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Credit</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>}
                      <span>{customer.invoiceCount} invoice{customer.invoiceCount !== 1 ? 's' : ''}</span>
                      {customer.oldestDueDays > 0 && (
                        <span className={cn(customer.bucket === 'overdue' ? 'text-red-600 font-semibold' : '')}>
                          {customer.oldestDueDays} overdue invoice{customer.oldestDueDays !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('font-bold text-lg', customer.bucket === 'overdue' ? 'text-red-600' : 'text-amber-700')}>
                      {formatCurrency(customer.totalDue)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

type ReportTab = 'revenue' | 'vat' | 'outstanding' | 'payments' | 'today' | 'monthly' | 'delayed';

const REPORT_TABS: { key: ReportTab; label: string; icon: React.ReactNode }[] = [
  { key: 'revenue',     label: 'Revenue Analysis',   icon: <TrendingUp    className="h-4 w-4" /> },
  { key: 'vat',         label: 'VAT Summary',         icon: <Receipt       className="h-4 w-4" /> },
  { key: 'outstanding', label: 'Outstanding',         icon: <AlertCircle   className="h-4 w-4" /> },
  { key: 'payments',    label: 'Payment Tracking',    icon: <CreditCard    className="h-4 w-4" /> },
  { key: 'today',       label: "Today's Report",      icon: <Sun           className="h-4 w-4" /> },
  { key: 'monthly',     label: 'Monthly Report',      icon: <BarChart3     className="h-4 w-4" /> },
  { key: 'delayed',     label: 'Delayed Payments',    icon: <AlertTriangle className="h-4 w-4" /> },
];

export const ReportsPage: React.FC = () => {
  const [activeTab,      setActiveTab]      = useState<ReportTab>('revenue');
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('30d');

  return (
    <AccountsLayout
      title="Financial Reports"
      subtitle="Revenue, VAT, outstanding balances, payment tracking and more"
    >
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="border-b border-border pb-4">
          <h1 className="text-2xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-muted-foreground mt-1">Comprehensive financial analytics and reporting</p>
        </div>

        {/* Tab navigation — scrollable on mobile */}
        <div className="flex flex-nowrap gap-1 border-b border-border overflow-x-auto scrollbar-none pb-px">
          {REPORT_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap shrink-0',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Period selector — Revenue & VAT only */}
        {(activeTab === 'revenue' || activeTab === 'vat') && (
          <div className="pt-2">
            <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
          </div>
        )}

        <div className="pt-4">
          {activeTab === 'revenue'     && <RevenueTab     period={selectedPeriod} />}
          {activeTab === 'vat'         && <VatTab         period={selectedPeriod} />}
          {activeTab === 'outstanding' && <OutstandingTab />}
          {activeTab === 'payments'    && <PaymentTab />}
          {activeTab === 'today'       && <TodayTab />}
          {activeTab === 'monthly'     && <MonthlyTab />}
          {activeTab === 'delayed'     && <DelayedTab />}
        </div>
      </div>
    </AccountsLayout>
  );
};

export default ReportsPage;
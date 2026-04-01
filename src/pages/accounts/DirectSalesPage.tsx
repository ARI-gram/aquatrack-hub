/**
 * DirectSalesPage — Enhanced Accountant Report View
 * src/pages/accounts/DirectSalesPage.tsx
 *
 * All logic/functions unchanged. Restyled for accountant usability:
 *  - Cleaner summary cards with trend context
 *  - Collapsible filter panel
 *  - Better table with sticky header, zebra rows, hover states
 *  - Export-ready layout
 *  - Mobile-first card view improved
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import {
  Loader2, Search, X, RefreshCw, Calendar,
  ShoppingBag, Truck, Store, TrendingUp,
  ChevronDown, Phone, User,
  Package, BarChart3, InboxIcon,
  Filter, ArrowUpDown, Download,
  CreditCard, Banknote, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountsLayout } from '@/pages/accounts/AccountsLayout';
import axiosInstance from '@/api/axios.config';

// ─────────────────────────────────────────────────────────────────────────────
// Types (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

interface DirectSaleRow {
  id:            string;
  date:          string;
  productName:   string;
  productId:     string;
  productType:   'bottle' | 'consumable';
  quantity:      number;
  unitPrice:     number;
  totalAmount:   number;
  source:        'store' | 'driver';
  servedBy:      string;
  customerName:  string;
  customerPhone: string;
  paymentMethod: string;
  notes:         string;
}

interface ProductBreakdown {
  productId:   string;
  productName: string;
  productType: string;
  quantity:    number;
  revenue:     number;
}

interface ServedBreakdown {
  servedBy: string;
  source:   'store' | 'driver';
  count:    number;
  revenue:  number;
}

interface DailyTotal {
  date:    string;
  revenue: number;
  count:   number;
}

interface Summary {
  totalRevenue:      number;
  totalTransactions: number;
  storeRevenue:      number;
  driverRevenue:     number;
  paymentBreakdown:  Record<string, number>;
  productBreakdown:  ProductBreakdown[];
  dailyTotals:       DailyTotal[];
  servedBreakdown:   ServedBreakdown[];
}

interface DirectSalesResponse {
  summary:      Summary;
  transactions: DirectSaleRow[];
  pagination: {
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer resolution helpers (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function parseCustomerFromNotes(notes: string): { name: string; phone: string } {
  if (!notes) return { name: '', phone: '' };
  const firstSegment = notes.split('·')[0].trim();
  const customerMatch = firstSegment.match(/Customer:\s*(.+?)(?:\s*\(([^)]+)\))?\s*$/);
  if (customerMatch) {
    return { name: customerMatch[1].trim(), phone: (customerMatch[2] ?? '').trim() };
  }
  const walkInMatch = firstSegment.match(/Walk-in:\s*(.+?)\s*$/);
  if (walkInMatch) return { name: walkInMatch[1].trim(), phone: '' };
  return { name: '', phone: '' };
}

function resolveCustomer(tx: DirectSaleRow): { name: string; phone: string; isWalkIn: boolean } {
  const apiName = tx.customerName?.trim();
  if (apiName && apiName !== 'Walk-in') {
    return { name: apiName, phone: tx.customerPhone ?? '', isWalkIn: false };
  }
  const fromNotes = parseCustomerFromNotes(tx.notes);
  if (fromNotes.name) {
    const phone = tx.customerPhone?.trim() || fromNotes.phone;
    return { name: fromNotes.name, phone, isWalkIn: false };
  }
  return { name: '', phone: '', isWalkIn: true };
}

function resolvePaymentMethod(tx: DirectSaleRow): string {
  const pm = tx.paymentMethod;
  if (pm && pm !== 'CASH') return pm;
  const notesUpper = (tx.notes ?? '').toUpperCase();
  if (notesUpper.includes('PAYMENT: CREDIT') || notesUpper.includes('CREDIT')) return 'CREDIT';
  if (notesUpper.includes('MPESA') || notesUpper.includes('M-PESA'))           return 'MPESA';
  if (notesUpper.includes('BANK'))                                              return 'BANK_TRANSFER';
  return pm || 'CASH';
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtK = (n: number) => {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `KES ${(n / 1_000).toFixed(1)}K`;
  return `KES ${n.toFixed(0)}`;
};

const fmtDate = (iso: string) => {
  try { return format(parseISO(iso), 'd MMM yyyy'); } catch { return iso; }
};

const fmtTime = (iso: string) => {
  try { return format(parseISO(iso), 'h:mm a'); } catch { return ''; }
};

function recentMonths(count = 12): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy') };
  });
}

const SOURCE_CFG = {
  store:  { label: 'Store',  icon: Store,  color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' },
  driver: { label: 'Driver', icon: Truck,  color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800' },
} as const;

const PM_CFG: Record<string, { color: string; icon: React.ReactNode }> = {
  MPESA:         { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',     icon: <Wallet className="h-2.5 w-2.5" /> },
  CASH:          { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', icon: <Banknote className="h-2.5 w-2.5" /> },
  BANK_TRANSFER: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',         icon: <CreditCard className="h-2.5 w-2.5" /> },
  CREDIT:        { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', icon: <CreditCard className="h-2.5 w-2.5" /> },
  UNKNOWN:       { color: 'bg-muted text-muted-foreground',                                           icon: null },
};

// ─────────────────────────────────────────────────────────────────────────────
// Daily bar chart (improved with labels)
// ─────────────────────────────────────────────────────────────────────────────

const DailyChart: React.FC<{ data: DailyTotal[] }> = ({ data }) => {
  if (!data.length) return null;
  const maxRev = Math.max(...data.map(d => d.revenue), 1);
  const slice  = data.slice(-30);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-0.5 h-32">
        {slice.map((day, i) => {
          const pct = (day.revenue / maxRev) * 100;
          const isWeekend = [0, 6].includes(new Date(day.date).getDay());
          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-0.5 group relative"
              title={`${fmtDate(day.date)}\n${fmt(day.revenue)}\n${day.count} sale${day.count !== 1 ? 's' : ''}`}
            >
              <div
                className={cn(
                  'w-full rounded-t transition-all duration-300 group-hover:opacity-80',
                  isWeekend ? 'bg-primary/40' : 'bg-primary/70 group-hover:bg-primary',
                )}
                style={{ height: `${Math.max(pct, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{slice[0] ? fmtDate(slice[0].date) : ''}</span>
        <span className="text-center font-medium text-foreground/60">{slice.length} days</span>
        <span>{slice[slice.length - 1] ? fmtDate(slice[slice.length - 1].date) : ''}</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Payment badge
// ─────────────────────────────────────────────────────────────────────────────

const PaymentBadge: React.FC<{ method: string }> = ({ method }) => {
  const cfg = PM_CFG[method] ?? PM_CFG.UNKNOWN;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full', cfg.color)}>
      {cfg.icon}
      {method}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Customer cell (unchanged logic)
// ─────────────────────────────────────────────────────────────────────────────

const CustomerCell: React.FC<{ tx: DirectSaleRow }> = ({ tx }) => {
  const { name, phone, isWalkIn } = resolveCustomer(tx);
  if (isWalkIn) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="h-3 w-3 text-muted-foreground/50" />
        </div>
        <span className="text-xs text-muted-foreground italic">Walk-in</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[10px] font-black text-primary">
        {name[0]?.toUpperCase()}
      </div>
      <div>
        <p className="text-xs font-semibold truncate max-w-[120px]">{name}</p>
        {phone && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Phone className="h-2.5 w-2.5" />{phone}
          </p>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Transaction row
// ─────────────────────────────────────────────────────────────────────────────

const TxRow: React.FC<{ tx: DirectSaleRow; index: number }> = ({ tx, index }) => {
  const [expanded, setExpanded] = useState(false);
  const srcCfg  = SOURCE_CFG[tx.source];
  const SrcIcon = srcCfg.icon;
  const pm      = resolvePaymentMethod(tx);
  const { name: custName, phone: custPhone, isWalkIn } = resolveCustomer(tx);

  return (
    <>
      {/* Desktop row */}
      <tr
        className={cn(
          'border-b border-border/20 hover:bg-primary/[0.03] cursor-pointer transition-colors hidden md:table-row group',
          index % 2 === 0 ? 'bg-background' : 'bg-muted/[0.03]',
        )}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Date */}
        <td className="px-4 py-3 whitespace-nowrap">
          <p className="text-xs font-semibold text-foreground">{fmtDate(tx.date)}</p>
          <p className="text-[10px] text-muted-foreground">{fmtTime(tx.date)}</p>
        </td>

        {/* Product */}
        <td className="px-4 py-3 max-w-[200px]">
          <p className="text-xs font-semibold truncate">{tx.productName}</p>
          <span className={cn(
            'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
            tx.productType === 'bottle'
              ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
          )}>
            {tx.productType === 'bottle' ? 'BOTTLE' : 'CONSUMABLE'}
          </span>
        </td>

        {/* Source */}
        <td className="px-4 py-3">
          <div className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border', srcCfg.bg)}>
            <SrcIcon className={cn('h-3 w-3', srcCfg.color)} />
            <span className={srcCfg.color}>{srcCfg.label}</span>
          </div>
        </td>

        {/* Served by */}
        <td className="px-4 py-3">
          {tx.servedBy ? (
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-black text-muted-foreground shrink-0">
                {tx.servedBy[0]?.toUpperCase()}
              </div>
              <p className="text-xs truncate max-w-[100px]">{tx.servedBy}</p>
            </div>
          ) : (
            <span className="text-muted-foreground/40 text-xs">—</span>
          )}
        </td>

        {/* Customer */}
        <td className="px-4 py-3">
          <CustomerCell tx={tx} />
        </td>

        {/* Qty × price */}
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <p className="text-xs font-mono text-muted-foreground">{tx.quantity} × {fmt(tx.unitPrice)}</p>
        </td>

        {/* Total + payment */}
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <p className="font-bold text-sm tabular-nums font-mono">{fmt(tx.totalAmount)}</p>
          <PaymentBadge method={pm} />
        </td>

        {/* Expand */}
        <td className="px-3 py-3 w-8">
          <ChevronDown className={cn(
            'h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:text-muted-foreground',
            expanded && 'rotate-180 text-muted-foreground',
          )} />
        </td>
      </tr>

      {/* Desktop expanded notes */}
      {expanded && tx.notes && (
        <tr className="hidden md:table-row bg-muted/5 border-b border-border/20">
          <td colSpan={8} className="px-4 py-3">
            <div className="flex items-start gap-2">
              <div className="w-1 h-full bg-border rounded-full shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground italic leading-relaxed">{tx.notes}</p>
            </div>
          </td>
        </tr>
      )}

      {/* Mobile card */}
      <div className="md:hidden border-b border-border/20 px-4 py-4 hover:bg-muted/10 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-bold text-sm">{tx.productName}</p>
              <div className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-bold border', srcCfg.bg)}>
                <SrcIcon className={cn('h-2.5 w-2.5', srcCfg.color)} />
                <span className={srcCfg.color}>{srcCfg.label}</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">{fmtDate(tx.date)} · {fmtTime(tx.date)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-black text-base tabular-nums font-mono">{fmt(tx.totalAmount)}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{tx.quantity} × {fmt(tx.unitPrice)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px]">
            {tx.servedBy && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-black">
                  {tx.servedBy[0]?.toUpperCase()}
                </div>
                <span className="truncate max-w-[80px]">{tx.servedBy}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-muted-foreground">
              {isWalkIn ? (
                <span className="italic">Walk-in</span>
              ) : (
                <span className="truncate max-w-[80px] font-medium text-foreground">{custName}</span>
              )}
            </div>
            {custPhone && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Phone className="h-2.5 w-2.5" />
                <span>{custPhone}</span>
              </div>
            )}
          </div>
          <PaymentBadge method={pm} />
        </div>

        {tx.notes && (
          <p className="text-[11px] text-muted-foreground italic mt-2 pl-2 border-l-2 border-border">{tx.notes}</p>
        )}
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type SourceFilter = 'all' | 'store' | 'driver';

const AccountingDirectSalesPage: React.FC = () => {
  const [data,         setData]         = useState<DirectSalesResponse | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [source,       setSource]       = useState<SourceFilter>('all');
  const [monthFilter,  setMonthFilter]  = useState<string>('');
  const [page,         setPage]         = useState(1);
  const [filtersOpen,  setFiltersOpen]  = useState(false);

  const months = useMemo(() => recentMonths(12), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let dateFrom: string | undefined;
      let dateTo:   string | undefined;
      if (monthFilter) {
        const d = parseISO(`${monthFilter}-01`);
        dateFrom = format(startOfMonth(d), 'yyyy-MM-dd');
        dateTo   = format(endOfMonth(d),   'yyyy-MM-dd');
      }
      const params: Record<string, string | number> = { page, limit: 50 };
      if (source !== 'all') params.source    = source;
      if (dateFrom)         params.date_from = dateFrom;
      if (dateTo)           params.date_to   = dateTo;

      const { data: res } = await axiosInstance.get('/client/accounts/direct-sales', { params });
      setData(res);
    } catch {
      toast.error('Failed to load direct sales data');
    } finally {
      setLoading(false);
    }
  }, [source, monthFilter, page]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.transactions;
    const q = search.toLowerCase();
    return data.transactions.filter(tx => {
      const { name: custName, phone: custPhone } = resolveCustomer(tx);
      return (
        tx.productName.toLowerCase().includes(q) ||
        tx.servedBy.toLowerCase().includes(q)    ||
        custName.toLowerCase().includes(q)       ||
        custPhone.includes(q)                    ||
        tx.notes.toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  const summary    = data?.summary;
  const pagination = data?.pagination;

  const activeFilters = [source !== 'all', !!monthFilter].filter(Boolean).length;

  return (
    <AccountsLayout title="Direct Sales" subtitle="Store counter & driver roadside accountability">
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-12 space-y-6">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Direct Sales Report</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Consolidated view of store counter and driver van sales
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={load}
              disabled={loading}
              className="h-9 px-3 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted transition-colors text-xs font-semibold text-muted-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── KPI strip ── */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

            {/* Total revenue */}
            <div className="col-span-2 lg:col-span-1 rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Revenue</p>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-black tabular-nums">{fmtK(summary.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.totalTransactions} transactions</p>
            </div>

            {/* Store */}
            <div className="rounded-2xl border border-blue-200/60 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800/40 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600/70">Store Sales</p>
                <Store className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-black tabular-nums text-blue-700 dark:text-blue-300">{fmtK(summary.storeRevenue)}</p>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-1 bg-blue-200/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${summary.totalRevenue > 0 ? (summary.storeRevenue / summary.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-blue-600">
                  {summary.totalRevenue > 0 ? Math.round((summary.storeRevenue / summary.totalRevenue) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* Driver */}
            <div className="rounded-2xl border border-violet-200/60 bg-violet-50/50 dark:bg-violet-950/20 dark:border-violet-800/40 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-violet-600/70">Driver Sales</p>
                <Truck className="h-4 w-4 text-violet-500" />
              </div>
              <p className="text-2xl font-black tabular-nums text-violet-700 dark:text-violet-300">{fmtK(summary.driverRevenue)}</p>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-1 bg-violet-200/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${summary.totalRevenue > 0 ? (summary.driverRevenue / summary.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-violet-600">
                  {summary.totalRevenue > 0 ? Math.round((summary.driverRevenue / summary.totalRevenue) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* Products */}
            <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800/40 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">Products</p>
                <Package className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">{summary.productBreakdown.length}</p>
              <p className="text-xs text-emerald-600/70 mt-1">distinct SKUs sold</p>
            </div>
          </div>
        )}

        {/* ── Analytics row ── */}
        {summary && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Daily trend */}
            {summary.dailyTotals.length > 0 && (
              <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-bold">Daily Revenue Trend</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Peak: {fmtK(Math.max(...summary.dailyTotals.map(d => d.revenue)))}
                  </p>
                </div>
                <DailyChart data={summary.dailyTotals} />
              </div>
            )}

            {/* Payment methods */}
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <p className="text-sm font-bold mb-4">Payment Breakdown</p>
              <div className="space-y-3">
                {Object.entries(summary.paymentBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([method, amount]) => {
                    const pct = summary.totalRevenue > 0 ? (amount / summary.totalRevenue) * 100 : 0;
                    const cfg = PM_CFG[method] ?? PM_CFG.UNKNOWN;
                    return (
                      <div key={method}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn('inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full', cfg.color)}>
                            {cfg.icon}{method}
                          </span>
                          <div className="text-right">
                            <span className="text-xs font-bold">{fmt(amount)}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ── Staff accountability + top products ── */}
        {summary && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Staff */}
            {summary.servedBreakdown.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Staff Accountability
                  </p>
                  <p className="text-[10px] text-muted-foreground">{summary.servedBreakdown.length} people</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/5">
                        {['Person', 'Channel', 'Sales', 'Revenue'].map(h => (
                          <th key={h} className={cn(
                            'px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground',
                            ['Revenue', 'Sales'].includes(h) ? 'text-right' : 'text-left',
                          )}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.servedBreakdown.map((s, i) => {
                        const srcCfg  = SOURCE_CFG[s.source as keyof typeof SOURCE_CFG];
                        const SrcIcon = srcCfg?.icon ?? Store;
                        return (
                          <tr key={i} className={cn('border-b border-border/20 hover:bg-muted/10', i % 2 === 0 ? '' : 'bg-muted/[0.03]')}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-black text-muted-foreground shrink-0">
                                  {(s.servedBy || '?')[0]?.toUpperCase()}
                                </div>
                                <span className="text-xs font-medium truncate max-w-[100px]">{s.servedBy || '—'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold border', srcCfg?.bg ?? '')}>
                                <SrcIcon className={cn('h-2.5 w-2.5', srcCfg?.color)} />
                                <span className={srcCfg?.color}>{srcCfg?.label ?? s.source}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-xs tabular-nums">{s.count}</td>
                            <td className="px-4 py-3 text-right text-xs font-bold tabular-nums font-mono">{fmt(s.revenue)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/20 font-black">
                        <td className="px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground" colSpan={2}>Total</td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums">{summary.totalTransactions}</td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums font-mono">{fmt(summary.totalRevenue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Top products */}
            {summary.productBreakdown.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Top Products</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{summary.productBreakdown.length} SKUs</p>
                </div>
                <div className="p-5 space-y-3">
                  {summary.productBreakdown.slice(0, 6).map((p, i) => {
                    const maxRev = summary.productBreakdown[0]?.revenue || 1;
                    const pct    = (p.revenue / maxRev) * 100;
                    return (
                      <div key={p.productId}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-black text-muted-foreground/60 w-4 shrink-0">#{i + 1}</span>
                            <span className="text-xs font-semibold truncate">{p.productName}</span>
                            <span className={cn(
                              'shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                              p.productType === 'bottle'
                                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
                            )}>
                              {p.productType.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <span className="text-xs font-bold font-mono">{fmt(p.revenue)}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">({p.quantity}u)</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Filter bar ── */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div
            className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-muted/10 transition-colors"
            onClick={() => setFiltersOpen(o => !o)}
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-bold">Filters & Search</span>
              {activeFilters > 0 && (
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </div>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', filtersOpen && 'rotate-180')} />
          </div>

          {filtersOpen && (
            <div className="px-5 pb-5 border-t border-border/40 pt-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by product, customer, staff name, or notes…"
                  className="w-full h-10 pl-10 pr-10 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {/* Month picker */}
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <select
                    value={monthFilter}
                    onChange={e => { setMonthFilter(e.target.value); setPage(1); }}
                    className="h-9 pl-8 pr-4 rounded-xl border border-border/60 bg-muted/30 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                  >
                    <option value="">All time</option>
                    {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>

                {/* Source toggle */}
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl">
                  {(['all', 'store', 'driver'] as SourceFilter[]).map(s => {
                    const cfg  = s !== 'all' ? SOURCE_CFG[s] : null;
                    const Icon = cfg?.icon;
                    return (
                      <button
                        key={s}
                        onClick={() => { setSource(s); setPage(1); }}
                        className={cn(
                          'flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-bold transition-all',
                          source === s
                            ? 'bg-background text-foreground shadow-sm border border-border/60'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {Icon && <Icon className={cn('h-3 w-3', cfg?.color)} />}
                        {s === 'all' ? 'All' : s === 'store' ? 'Store' : 'Driver'}
                      </button>
                    );
                  })}
                </div>

                {/* Clear filters */}
                {activeFilters > 0 && (
                  <button
                    onClick={() => { setSource('all'); setMonthFilter(''); setPage(1); }}
                    className="h-9 px-3 rounded-xl border border-border/60 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                  >
                    <X className="h-3 w-3" />
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Transaction ledger ── */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">

          {/* Ledger header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40 bg-muted/20">
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Transaction Ledger
              </p>
              <span className="h-5 px-2 rounded-full bg-muted text-[10px] font-bold text-muted-foreground flex items-center">
                {search ? `${filtered.length} of ${pagination?.total ?? 0}` : pagination?.total ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {filtered.length > 0 && (
                <p className="text-xs font-bold tabular-nums text-muted-foreground">
                  {fmt(filtered.reduce((s, r) => s + r.totalAmount, 0))}
                </p>
              )}
              {!search && pagination && pagination.totalPages > 1 && (
                <p className="text-[10px] text-muted-foreground">
                  Page {pagination.page}/{pagination.totalPages}
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">Loading transactions…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <InboxIcon className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm font-medium text-muted-foreground">No transactions found</p>
              <p className="text-xs text-muted-foreground/60">
                {search || monthFilter || source !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No direct sales recorded yet'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border/40 bg-muted/30 backdrop-blur-sm">
                      {[
                        { label: 'Date',       align: 'left'  },
                        { label: 'Product',    align: 'left'  },
                        { label: 'Source',     align: 'left'  },
                        { label: 'Served By',  align: 'left'  },
                        { label: 'Customer',   align: 'left'  },
                        { label: 'Qty × Price',align: 'right' },
                        { label: 'Amount',     align: 'right' },
                        { label: '',           align: 'left'  },
                      ].map(h => (
                        <th key={h.label} className={cn(
                          'px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground',
                          h.align === 'right' ? 'text-right' : 'text-left',
                        )}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((tx, i) => <TxRow key={tx.id} tx={tx} index={i} />)}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20">
                      <td className="px-4 py-3 text-xs font-black uppercase tracking-wide text-muted-foreground" colSpan={5}>
                        {search ? `Showing ${filtered.length} matching` : `Page ${pagination?.page ?? 1} total`}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">
                        {filtered.reduce((s, r) => s + r.quantity, 0)} units
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-black tabular-nums font-mono">
                        {fmt(filtered.reduce((s, r) => s + r.totalAmount, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-border/20">
                {filtered.map((tx, i) => <TxRow key={tx.id} tx={tx} index={i} />)}
                {/* Mobile footer total */}
                <div className="px-4 py-3 bg-muted/20 flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                    {search ? `${filtered.length} matching` : 'Page total'}
                  </span>
                  <span className="text-sm font-black tabular-nums font-mono">
                    {fmt(filtered.reduce((s, r) => s + r.totalAmount, 0))}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Pagination ── */}
        {!search && pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-9 px-4 rounded-xl border border-border/60 text-xs font-semibold disabled:opacity-40 hover:bg-muted transition-colors"
            >
              ← Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      'h-8 w-8 rounded-lg text-xs font-bold transition-colors',
                      page === p
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {p}
                  </button>
                );
              })}
              {pagination.totalPages > 7 && (
                <span className="text-xs text-muted-foreground px-1">…{pagination.totalPages}</span>
              )}
            </div>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="h-9 px-4 rounded-xl border border-border/60 text-xs font-semibold disabled:opacity-40 hover:bg-muted transition-colors"
            >
              Next →
            </button>
          </div>
        )}

      </div>
    </AccountsLayout>
  );
};

export default AccountingDirectSalesPage;
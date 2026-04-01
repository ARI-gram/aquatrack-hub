/**
 * AccountantDashboard
 * src/pages/accounts/AccountantDashboard.tsx
 *
 * Route: /client/accounts/dashboard
 *
 * Financial command center for the accountant role.
 * All data sourced from existing endpoints — no new API required.
 *
 * Sections:
 *  1. KPI strip        — revenue today, outstanding, overdue, collection rate
 *  2. Cash flow bar    — 30-day daily revenue sparkline
 *  3. Aging buckets    — Current / Grace / Overdue visual breakdown
 *  4. Top debtors      — Top 5 customers by outstanding balance
 *  5. Payment methods  — Distribution from payment report
 *  6. Quick actions    — Navigate to key workflows
 *  7. Recent invoices  — Last 5 issued/overdue invoices
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import {
  TrendingUp, AlertTriangle, CheckCircle2, Clock,
  CreditCard, FileText, ArrowRight, RefreshCw,
  Loader2, Users, ShoppingBag, Settings,
  BadgeDollarSign, ShieldAlert, BarChart3,
  Banknote, Phone, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountsLayout } from '@/pages/accounts/AccountsLayout';
import { accountingService } from '@/api/services/accounting.service';
import { reportsService } from '@/api/services/reports.service';
import type { PaymentReport } from '@/types/accounting.types';
import type { RevenueSummary } from '@/types/reports.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtK = (n: number) => {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `KES ${(n / 1_000).toFixed(1)}K`;
  return `KES ${n.toFixed(0)}`;
};

const today     = format(new Date(), 'yyyy-MM-dd');
const ago30     = format(subDays(new Date(), 30), 'yyyy-MM-dd');
const ago7      = format(subDays(new Date(), 7), 'yyyy-MM-dd');
const todayFmt  = format(new Date(), 'EEEE, d MMMM yyyy');

// ── Mini sparkline (pure CSS/SVG, no lib) ─────────────────────────────────────

const Sparkline: React.FC<{ data: number[]; color?: string }> = ({
  data,
  color = 'var(--color-text-info, #3b82f6)',
}) => {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const W = 200, H = 48, pad = 2;
  const step = (W - pad * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((v, i) => {
    const x = pad + i * step;
    const y = H - pad - ((v / max) * (H - pad * 2));
    return `${x},${y}`;
  });
  const area = `M${pts[0]} L${pts.join(' L')} L${pad + (data.length - 1) * step},${H} L${pad},${H} Z`;
  const line = `M${pts[0]} L${pts.join(' L')}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 48 }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label:       string;
  value:       string;
  sub?:        string;
  icon:        React.ReactNode;
  accent:      string;   // tailwind classes for border/bg tint
  textAccent:  string;
  onClick?:    () => void;
  sparkData?:  number[];
  sparkColor?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({
  label, value, sub, icon, accent, textAccent, onClick, sparkData, sparkColor,
}) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    className={cn(
      'group relative rounded-2xl border p-5 text-left transition-all duration-200 w-full',
      'hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0',
      accent,
      !onClick && 'cursor-default',
    )}
  >
    <div className="flex items-start justify-between mb-3">
      <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', textAccent, 'bg-white/30 dark:bg-black/20')}>
        {icon}
      </div>
      {onClick && (
        <ArrowRight className={cn('h-4 w-4 opacity-0 group-hover:opacity-60 transition-opacity', textAccent)} />
      )}
    </div>
    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
    <p className={cn('text-2xl font-black tabular-nums leading-tight', textAccent)}>{value}</p>
    {sub && <p className="text-[11px] opacity-60 mt-0.5 font-medium">{sub}</p>}
    {sparkData && sparkData.length > 0 && (
      <div className="mt-3 -mx-1">
        <Sparkline data={sparkData} color={sparkColor} />
      </div>
    )}
  </button>
);

// ── Aging Bar ─────────────────────────────────────────────────────────────────

interface AgingBarProps {
  current:  number;
  grace:    number;
  overdue:  number;
}

const AgingBar: React.FC<AgingBarProps> = ({ current, grace, overdue }) => {
  const total = current + grace + overdue || 1;
  const segments = [
    { label: 'Current',      value: current, color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', light: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
    { label: 'Grace Period', value: grace,   color: 'bg-amber-400',   text: 'text-amber-700 dark:text-amber-300',   light: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'   },
    { label: 'Overdue',      value: overdue, color: 'bg-red-500',     text: 'text-red-700 dark:text-red-300',       light: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'           },
  ];

  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div className="flex h-5 rounded-xl overflow-hidden gap-0.5">
        {segments.map(s => (
          <div
            key={s.label}
            className={cn('transition-all first:rounded-l-xl last:rounded-r-xl', s.color)}
            style={{ width: `${(s.value / total) * 100}%`, minWidth: s.value > 0 ? '4px' : '0px' }}
            title={`${s.label}: ${fmtK(s.value)}`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-3 gap-3">
        {segments.map(s => (
          <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.light)}>
            <p className={cn('text-sm font-black tabular-nums', s.text)}>{fmtK(s.value)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{s.label}</p>
            <p className={cn('text-[10px] font-bold mt-0.5', s.text)}>
              {((s.value / total) * 100).toFixed(0)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Quick Action Card ─────────────────────────────────────────────────────────

const QuickAction: React.FC<{
  label:    string;
  sub:      string;
  icon:     React.ReactNode;
  onClick:  () => void;
  accent:   string;
}> = ({ label, sub, icon, onClick, accent }) => (
  <button
    onClick={onClick}
    className={cn(
      'group flex items-center gap-3.5 rounded-2xl border p-4 text-left w-full',
      'hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200',
      accent,
    )}
  >
    <div className="h-10 w-10 rounded-xl bg-white/30 dark:bg-black/20 flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-bold text-sm leading-tight">{label}</p>
      <p className="text-[11px] opacity-60 mt-0.5">{sub}</p>
    </div>
    <ArrowRight className="h-4 w-4 opacity-40 group-hover:opacity-80 group-hover:translate-x-0.5 transition-all shrink-0" />
  </button>
);

// ── Invoice status badge ──────────────────────────────────────────────────────

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const color = {
    PAID:      'bg-emerald-500',
    ISSUED:    'bg-blue-500',
    OVERDUE:   'bg-red-500',
    DRAFT:     'bg-border',
    CANCELLED: 'bg-border',
  }[status] ?? 'bg-border';
  return <span className={cn('h-2 w-2 rounded-full shrink-0', color)} />;
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

const AccountantDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Data state
  const [payReport,   setPayReport]   = useState<PaymentReport | null>(null);
  const [revenue30,   setRevenue30]   = useState<RevenueSummary | null>(null);
  const [revenueToday, setRevenueToday] = useState<RevenueSummary | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, r30, rToday] = await Promise.allSettled([
        accountingService.getPaymentReport({ customer_type: 'all', status: 'all' }),
        reportsService.getRevenue(ago30, today),
        reportsService.getRevenue(today, today),
      ]);

      if (pr.status      === 'fulfilled') setPayReport(pr.value);
      if (r30.status     === 'fulfilled') setRevenue30(r30.value);
      if (rToday.status  === 'fulfilled') setRevenueToday(rToday.value);

      setLastRefresh(new Date());
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived metrics ────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalOutstanding  = payReport?.summary.totalOutstanding ?? 0;
    const totalInvoiced     = payReport?.summary.totalInvoiced    ?? 0;
    const totalPaid         = payReport?.summary.totalPaid        ?? 0;
    const collectionRate    = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;
    const todayRevenue      = revenueToday?.totalRevenue ?? 0;

    // Overdue customers
    const overdueCustomers  = (payReport?.customers ?? []).filter(c => c.overdueCount > 0);
    const totalOverdue      = overdueCustomers.reduce((s, c) => s + c.totalOutstanding, 0);

    // Grace period = outstanding but not overdue
    const graceCustomers    = (payReport?.customers ?? []).filter(c => c.totalOutstanding > 0 && c.overdueCount === 0);
    const totalGrace        = graceCustomers.reduce((s, c) => s + c.totalOutstanding, 0);
    const currentAmount     = 0; // current = paid within terms — no separate figure available

    // Revenue 30-day sparkline
    const sparkData = (revenue30?.byDay ?? []).map(d => d.revenue);

    // Top debtors
    const topDebtors = [...(payReport?.customers ?? [])]
      .filter(c => c.totalOutstanding > 0)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, 5);

    // Payment method breakdown
    const pmBreakdown = payReport?.summary.paymentMethodBreakdown ?? {};

    // Recent invoices (latest 5 from customers list — limited data, best we have)
    const uninvoicedOrders = (payReport?.customers ?? [])
      .flatMap(c => (c.ordersNoInvoice ?? []).map(o => ({ ...o, customerName: c.fullName })))
      .slice(0, 5);

    return {
      todayRevenue,
      totalOutstanding,
      totalOverdue,
      totalGrace,
      currentAmount,
      collectionRate,
      totalCustomers: payReport?.summary.totalCustomers ?? 0,
      creditCustomers: payReport?.summary.creditCustomers ?? 0,
      sparkData,
      topDebtors,
      pmBreakdown,
      uninvoicedOrders,
      overdueCount: overdueCustomers.length,
    };
  }, [payReport, revenue30, revenueToday]);

  // ── Quick Actions ──────────────────────────────────────────────────────────

  const quickActions = [
    {
      label:   'New Invoice',
      sub:     'Generate for a customer',
      icon:    <FileText className="h-5 w-5 text-blue-700 dark:text-blue-300" />,
      accent:  'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100',
      route:   '/client/accounts/customers',
    },
    {
      label:   'Outstanding',
      sub:     'View pending balances',
      icon:    <ShieldAlert className="h-5 w-5 text-amber-700 dark:text-amber-300" />,
      accent:  'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100',
      route:   '/client/accounts/reports',
    },
    {
      label:   'Direct Sales',
      sub:     'Store & driver ledger',
      icon:    <ShoppingBag className="h-5 w-5 text-violet-700 dark:text-violet-300" />,
      accent:  'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800 text-violet-900 dark:text-violet-100',
      route:   '/client/accounts/direct-sales',
    },
    {
      label:   'Reports',
      sub:     'Revenue, VAT & monthly',
      icon:    <BarChart3 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />,
      accent:  'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100',
      route:   '/client/accounts/reports',
    },
    {
      label:   'Customers',
      sub:     'Account statements',
      icon:    <Users className="h-5 w-5 text-sky-700 dark:text-sky-300" />,
      accent:  'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-100',
      route:   '/client/accounts/customers',
    },
    {
      label:   'Settings',
      sub:     'VAT, KRA, bank details',
      icon:    <Settings className="h-5 w-5 text-gray-700 dark:text-gray-300" />,
      accent:  'bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100',
      route:   '/client/accounts/settings',
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AccountsLayout title="Dashboard" subtitle="Financial overview">
      <div className="space-y-6 pb-8">

        {/* ── Header row ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Good morning 👋</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{todayFmt}</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 h-9 px-3.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted transition-colors text-xs font-semibold text-muted-foreground disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground">Loading dashboard…</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── KPI Strip ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard
                label="Revenue Today"
                value={fmtK(kpis.todayRevenue)}
                sub="All channels"
                icon={<TrendingUp className="h-5 w-5" />}
                accent="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                textAccent="text-emerald-800 dark:text-emerald-200"
                onClick={() => navigate('/client/accounts/reports')}
                sparkData={kpis.sparkData}
                sparkColor="#10b981"
              />
              <KpiCard
                label="Outstanding"
                value={fmtK(kpis.totalOutstanding)}
                sub={`${kpis.totalCustomers} customers`}
                icon={<ShieldAlert className="h-5 w-5" />}
                accent="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                textAccent="text-amber-800 dark:text-amber-200"
                onClick={() => navigate('/client/accounts/reports')}
              />
              <KpiCard
                label="Overdue"
                value={fmtK(kpis.totalOverdue)}
                sub={`${kpis.overdueCount} accounts`}
                icon={<AlertTriangle className="h-5 w-5" />}
                accent={kpis.totalOverdue > 0
                  ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                  : 'bg-muted/40 border-border/60'}
                textAccent={kpis.totalOverdue > 0
                  ? 'text-red-800 dark:text-red-200'
                  : 'text-foreground'}
                onClick={() => navigate('/client/accounts/reports')}
              />
              <KpiCard
                label="Collection Rate"
                value={`${kpis.collectionRate.toFixed(1)}%`}
                sub="Invoiced vs collected"
                icon={<CheckCircle2 className="h-5 w-5" />}
                accent={kpis.collectionRate >= 80
                  ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                  : 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'}
                textAccent={kpis.collectionRate >= 80
                  ? 'text-blue-800 dark:text-blue-200'
                  : 'text-orange-800 dark:text-orange-200'}
              />
            </div>

            {/* ── Middle row: Aging + Top debtors ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Aging analysis */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <h2 className="font-bold text-sm">Debt Aging</h2>
                  </div>
                  <button
                    onClick={() => navigate('/client/accounts/reports')}
                    className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    Full report <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <AgingBar
                  current={0}
                  grace={kpis.totalGrace}
                  overdue={kpis.totalOverdue}
                />
                {kpis.totalOverdue > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                      {kpis.overdueCount} account{kpis.overdueCount !== 1 ? 's' : ''} require immediate follow-up
                    </p>
                  </div>
                )}
              </div>

              {/* Top debtors */}
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <h2 className="font-bold text-sm">Top Outstanding Accounts</h2>
                  </div>
                  <button
                    onClick={() => navigate('/client/accounts/customers')}
                    className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    All <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                {kpis.topDebtors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                    <p className="text-sm text-muted-foreground font-medium">All accounts settled</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {kpis.topDebtors.map((c, i) => {
                      const isOverdue = c.overdueCount > 0;
                      const pct = c.totalInvoiced > 0 ? (c.totalPaid / c.totalInvoiced) * 100 : 0;
                      return (
                        <button
                          key={c.customerId}
                          onClick={() => navigate(`/client/accounts/customers/${c.customerId}/statement`)}
                          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors text-left group"
                        >
                          {/* Rank */}
                          <span className="text-[10px] font-black text-muted-foreground/50 w-4 shrink-0">
                            #{i + 1}
                          </span>
                          {/* Avatar */}
                          <div className={cn(
                            'h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black',
                            isOverdue
                              ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                          )}>
                            {c.fullName[0]?.toUpperCase()}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold truncate">{c.fullName}</p>
                              {isOverdue && (
                                <span className="text-[8px] font-black bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 px-1.5 py-0.5 rounded-full shrink-0">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : isOverdue ? 'bg-red-400' : 'bg-amber-400')}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">{pct.toFixed(0)}%</span>
                            </div>
                          </div>
                          {/* Amount */}
                          <div className="text-right shrink-0">
                            <p className={cn('text-xs font-black tabular-nums', isOverdue ? 'text-red-600' : 'text-amber-700 dark:text-amber-400')}>
                              {fmtK(c.totalOutstanding)}
                            </p>
                            <p className="text-[9px] text-muted-foreground">due</p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Payment methods + Uninvoiced orders ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Payment method distribution */}
              {Object.keys(kpis.pmBreakdown).length > 0 && (
                <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <h2 className="font-bold text-sm">Payment Methods</h2>
                  </div>
                  <div className="space-y-2.5">
                    {Object.entries(kpis.pmBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([method, amount]) => {
                        const total = Object.values(kpis.pmBreakdown).reduce((s, v) => s + v, 0);
                        const pct   = total > 0 ? (amount / total) * 100 : 0;
                        const colors: Record<string, string> = {
                          MPESA:         'bg-green-500',
                          CASH:          'bg-emerald-500',
                          BANK_TRANSFER: 'bg-blue-500',
                          WALLET:        'bg-purple-500',
                          CHEQUE:        'bg-gray-400',
                        };
                        const bar = colors[method] ?? 'bg-primary';
                        return (
                          <div key={method}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold">{method === 'BANK_TRANSFER' ? 'Bank Transfer' : method === 'MPESA' ? 'M-Pesa' : method}</span>
                              <div className="text-right">
                                <span className="text-xs font-bold">{fmtK(amount)}</span>
                                <span className="text-[10px] text-muted-foreground ml-1.5">({pct.toFixed(0)}%)</span>
                              </div>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all duration-500', bar)} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Uninvoiced orders alert */}
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h2 className="font-bold text-sm">Orders Without Invoice</h2>
                  </div>
                  <button
                    onClick={() => navigate('/client/accounts/invoices')}
                    className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    Invoices <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                {kpis.uninvoicedOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                    <p className="text-sm text-muted-foreground font-medium">All orders invoiced</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {kpis.uninvoicedOrders.map((order, i) => (
                      <div key={`${order.order_number}-${i}`}
                        className="flex items-center gap-3 px-5 py-3.5">
                        <div className="h-8 w-8 rounded-xl bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center shrink-0">
                          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold font-mono truncate">{order.order_number}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{order.customerName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold tabular-nums">
                            {fmt(order.total_amount)}
                          </p>
                          <p className="text-[9px] text-orange-600 capitalize">{order.payment_status}</p>
                        </div>
                      </div>
                    ))}
                    <div className="px-5 py-3 bg-orange-50 dark:bg-orange-950/20 flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                      <p className="text-[11px] text-orange-700 dark:text-orange-400 font-medium">
                        These orders need invoices generated. Go to Invoices → New Invoice.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Quick Actions ── */}
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3">Quick Actions</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {quickActions.map(a => (
                  <QuickAction
                    key={a.label}
                    label={a.label}
                    sub={a.sub}
                    icon={a.icon}
                    accent={a.accent}
                    onClick={() => navigate(a.route)}
                  />
                ))}
              </div>
            </div>

            {/* ── 30-day revenue trend ── */}
            {revenue30 && revenue30.byDay.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <h2 className="font-bold text-sm">30-Day Revenue Trend</h2>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Total: {fmtK(revenue30.totalRevenue)} · Avg/day: {fmtK(revenue30.totalRevenue / Math.max(revenue30.byDay.length, 1))}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/client/accounts/reports')}
                    className="text-[11px] text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    Full report <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                {/* Bar chart */}
                <div className="flex items-end gap-0.5 h-28">
                  {revenue30.byDay.map((day, i) => {
                    const maxVal = Math.max(...revenue30.byDay.map(d => d.revenue), 1);
                    const h = (day.revenue / maxVal) * 100;
                    const dow = new Date(day.date).getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const label = format(new Date(day.date), 'd');
                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col items-center gap-0.5 group relative"
                        title={`${format(new Date(day.date), 'd MMM')}: ${fmtK(day.revenue)}`}
                      >
                        <div
                          className={cn(
                            'w-full rounded-t transition-all duration-300',
                            isWeekend ? 'bg-primary/30' : 'bg-primary/60 group-hover:bg-primary',
                          )}
                          style={{ height: `${Math.max(h, 2)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                  <span>{format(new Date(revenue30.byDay[0].date), 'd MMM')}</span>
                  <span className="font-semibold text-foreground/60">Last 30 days</span>
                  <span>{format(new Date(revenue30.byDay[revenue30.byDay.length - 1].date), 'd MMM')}</span>
                </div>
              </div>
            )}

            {/* ── Stats footer ── */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                {
                  label: 'Total Customers',
                  value: kpis.totalCustomers,
                  sub:   `${kpis.creditCustomers} on credit`,
                  icon:  <Users className="h-4 w-4" />,
                },
                {
                  label: 'Grace Period',
                  value: fmt(kpis.totalGrace),
                  sub:   'Not yet overdue',
                  icon:  <Clock className="h-4 w-4" />,
                },
                {
                  label: 'Last Refreshed',
                  value: format(lastRefresh, 'h:mm a'),
                  sub:   format(lastRefresh, 'd MMM yyyy'),
                  icon:  <RefreshCw className="h-4 w-4" />,
                },
              ].map(s => (
                <div key={s.label} className="rounded-2xl border border-border/60 bg-card p-4 text-center">
                  <div className="flex justify-center text-muted-foreground mb-2">{s.icon}</div>
                  <p className="text-base font-black tabular-nums">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium leading-tight">{s.label}</p>
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AccountsLayout>
  );
};

export default AccountantDashboard;
// src/pages/accounts/InvoicesListPage.tsx
//
// Two views toggled by a tab:
//   1. "By Customer" — groups invoices per customer, shows total unpaid,
//      expandable to see individual invoices, "Pay All Unpaid" bulk action.
//   2. "All Invoices" — flat list (original behaviour).
//
// Filters: month picker, status tab, search.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { toast } from 'sonner';
import {
  Search, X, Plus, ChevronRight, ChevronDown,
  FileText, CheckCircle, Clock, AlertCircle,
  Loader2, InboxIcon, RefreshCw, Users, List,
  CreditCard, Calendar, TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { accountingService } from '@/api/services/accounting.service';
import type { Invoice } from '@/types/accounting.types';
import { AccountsLayout } from '@/pages/accounts/AccountsLayout';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; pill: string; icon: React.ReactNode }> = {
  DRAFT:     { label: 'Draft',     pill: 'bg-muted/60 text-muted-foreground border-border',               icon: <FileText    className="h-3 w-3" /> },
  ISSUED:    { label: 'Issued',    pill: 'bg-blue-50 text-blue-700 border-blue-200',                      icon: <Clock       className="h-3 w-3" /> },
  PAID:      { label: 'Paid',      pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',             icon: <CheckCircle className="h-3 w-3" /> },
  OVERDUE:   { label: 'Overdue',   pill: 'bg-red-50 text-red-700 border-red-200',                         icon: <AlertCircle className="h-3 w-3" /> },
  CANCELLED: { label: 'Cancelled', pill: 'bg-muted/60 text-muted-foreground border-border',               icon: <X           className="h-3 w-3" /> },
};

const UNPAID_STATUSES = new Set(['DRAFT', 'ISSUED', 'OVERDUE']);

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  try { return format(new Date(iso), 'd MMM yyyy'); } catch { return iso; }
};

const fmtMoney = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Returns the first 6 months going back from today, for the month picker */
function recentMonths(count = 6): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMM yyyy'),
    });
  }
  return months;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status pill
// ─────────────────────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.DRAFT;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', cfg.pill)}>
      {cfg.icon}{cfg.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Individual invoice row (used inside expanded customer section)
// ─────────────────────────────────────────────────────────────────────────────

const InvoiceRow: React.FC<{
  invoice:   Invoice;
  onView:    () => void;
  onIssue?:  () => void;
  onPay?:    () => void;
  issuing?:  boolean;
}> = ({ invoice, onView, onIssue, onPay, issuing }) => (
  <div
    className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer rounded-xl"
    onClick={onView}
  >
    {/* Status stripe dot */}
    <div className={cn(
      'h-2 w-2 rounded-full shrink-0',
      invoice.status === 'PAID'    ? 'bg-emerald-500' :
      invoice.status === 'OVERDUE' ? 'bg-red-500'     :
      invoice.status === 'ISSUED'  ? 'bg-blue-500'    : 'bg-border',
    )} />

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-mono text-muted-foreground">{invoice.invoiceNumber}</p>
        <StatusPill status={invoice.status} />
        {invoice.isOverdue && invoice.status !== 'PAID' && (
          <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">Overdue</span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        {fmtDate(invoice.createdAt)}
        {invoice.dueDate && invoice.status !== 'PAID' && ` · Due ${fmtDate(invoice.dueDate)}`}
        {invoice.paidAt && ` · Paid ${fmtDate(invoice.paidAt)}`}
      </p>
    </div>

    <div className="flex items-center gap-2 shrink-0">
      <p className="font-bold text-sm tabular-nums">{fmtMoney(invoice.totalAmount)}</p>

      {/* Quick actions — stop propagation so row click still navigates */}
      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        {invoice.status === 'DRAFT' && onIssue && (
          <button
            onClick={onIssue}
            disabled={issuing}
            className="h-7 px-2.5 rounded-lg bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {issuing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Issue'}
          </button>
        )}
        {(invoice.status === 'ISSUED' || invoice.status === 'OVERDUE') && onPay && (
          <button
            onClick={onPay}
            className="h-7 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-700 text-[11px] font-bold hover:bg-emerald-500/20 transition-colors"
          >
            Pay
          </button>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Customer group card
// ─────────────────────────────────────────────────────────────────────────────

interface CustomerGroup {
  customerName:  string;
  customerPhone: string | undefined;
  invoices:      Invoice[];
  totalUnpaid:   number;
  totalAll:      number;
  unpaidCount:   number;
  hasOverdue:    boolean;
}

const CustomerGroupCard: React.FC<{
  group:        CustomerGroup;
  expanded:     boolean;
  onToggle:     () => void;
  onViewInv:    (id: string) => void;
  onIssueInv:   (id: string) => void;
  onPayInv:     (inv: Invoice) => void;
  onPayAll:     () => void;
  issuingId:    string | null;
  payingAll:    boolean;
}> = ({ group, expanded, onToggle, onViewInv, onIssueInv, onPayInv, onPayAll, issuingId, payingAll }) => {

  const unpaidInvoices = group.invoices.filter(i => UNPAID_STATUSES.has(i.status));

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all',
      group.hasOverdue ? 'border-red-200 dark:border-red-900' : 'border-border/60',
    )}>
      {/* Customer header row — click to expand */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-4 cursor-pointer transition-colors',
          expanded ? 'bg-muted/40' : 'bg-card hover:bg-muted/20',
        )}
        onClick={onToggle}
      >
        {/* Avatar */}
        <div className={cn(
          'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm',
          group.hasOverdue
            ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
            : group.totalUnpaid > 0
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
        )}>
          {group.customerName[0]?.toUpperCase() ?? '?'}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm">{group.customerName}</p>
            {group.hasOverdue && (
              <span className="text-[9px] font-bold bg-red-50 text-red-600 border border-red-200 rounded-full px-1.5 py-0.5">Overdue</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {group.invoices.length} invoice{group.invoices.length !== 1 ? 's' : ''}
            {group.unpaidCount > 0 && ` · ${group.unpaidCount} unpaid`}
            {group.customerPhone && ` · ${group.customerPhone}`}
          </p>
        </div>

        {/* Unpaid total + chevron */}
        <div className="text-right shrink-0 flex items-center gap-3">
          <div>
            {group.totalUnpaid > 0 ? (
              <>
                <p className="font-black text-sm tabular-nums text-amber-700 dark:text-amber-400">
                  {fmtMoney(group.totalUnpaid)}
                </p>
                <p className="text-[10px] text-muted-foreground">unpaid</p>
              </>
            ) : (
              <>
                <p className="font-bold text-sm text-emerald-600">All clear</p>
                <p className="text-[10px] text-muted-foreground">{fmtMoney(group.totalAll)} total</p>
              </>
            )}
          </div>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </div>
      </div>

      {/* Expanded invoice list */}
      {expanded && (
        <div className="border-t border-border/40">

          {/* Pay All banner — only if there are unpaid invoices */}
          {unpaidInvoices.length > 1 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200/60 dark:border-amber-900">
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  {unpaidInvoices.length} unpaid invoices — {fmtMoney(group.totalUnpaid)} total
                </p>
                <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">
                  Paying all will mark every unpaid invoice as settled at once.
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onPayAll(); }}
                disabled={payingAll}
                className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {payingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                Pay All
              </button>
            </div>
          )}

          {/* Single unpaid — show a lighter prompt */}
          {unpaidInvoices.length === 1 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50/60 dark:bg-amber-950/10 border-b border-amber-200/40 dark:border-amber-900/50">
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                1 unpaid invoice — {fmtMoney(group.totalUnpaid)}
              </p>
              <button
                onClick={e => { e.stopPropagation(); onPayInv(unpaidInvoices[0]); }}
                className="shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle className="h-3 w-3" />Mark Paid
              </button>
            </div>
          )}

          {/* Invoice rows */}
          <div className="divide-y divide-border/30 px-1 py-1">
            {group.invoices.map(inv => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                onView={() => onViewInv(inv.id)}
                onIssue={() => onIssueInv(inv.id)}
                onPay={() => onPayInv(inv)}
                issuing={issuingId === inv.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Flat invoice card (All Invoices view)
// ─────────────────────────────────────────────────────────────────────────────

const InvoiceCard: React.FC<{ invoice: Invoice; onClick: () => void }> = ({ invoice, onClick }) => (
  <div
    onClick={onClick}
    className="rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-border hover:shadow-sm transition-all cursor-pointer active:scale-[0.99]"
  >
    <div className={cn(
      'h-[3px] w-full',
      invoice.status === 'PAID'    ? 'bg-emerald-500' :
      invoice.status === 'OVERDUE' ? 'bg-red-400'     :
      invoice.status === 'ISSUED'  ? 'bg-blue-500'    : 'bg-border',
    )} />
    <div className="p-4">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="font-bold text-sm">{invoice.customerName}</p>
            {invoice.isOverdue && invoice.status !== 'PAID' && (
              <span className="text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5">Overdue</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">{invoice.invoiceNumber}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-sm tabular-nums">{fmtMoney(invoice.totalAmount)}</p>
          <StatusPill status={invoice.status} />
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3 flex-wrap">
          <span>Issued: {fmtDate(invoice.createdAt)}</span>
          {invoice.dueDate && invoice.status !== 'PAID' && (
            <span className={invoice.isOverdue ? 'text-red-600 font-semibold' : ''}>Due: {fmtDate(invoice.dueDate)}</span>
          )}
          {invoice.paidAt && <span className="text-emerald-600 font-semibold">Paid: {fmtDate(invoice.paidAt)}</span>}
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Pay All confirmation sheet
// ─────────────────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = ['MPESA', 'CASH', 'BANK_TRANSFER', 'CHEQUE'];

const PayAllSheet: React.FC<{
  customerName:  string;
  totalAmount:   number;
  invoiceCount:  number;
  onConfirm:     (method: string, ref: string) => void;
  onCancel:      () => void;
  loading:       boolean;
}> = ({ customerName, totalAmount, invoiceCount, onConfirm, onCancel, loading }) => {
  const [method, setMethod] = useState('MPESA');
  const [ref,    setRef]    = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-background rounded-t-3xl shadow-2xl z-10">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        <div className="px-5 pb-6 pt-3 space-y-4">
          <div>
            <p className="font-bold text-base">Pay All Unpaid Invoices</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {customerName} · {invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''} · {fmtMoney(totalAmount)}
            </p>
          </div>

          <div className="flex items-start gap-3 px-3 py-3 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-950/30 dark:border-amber-800">
            <TrendingDown className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              This will mark <strong>all {invoiceCount} unpaid invoices</strong> for {customerName} as paid
              using the same payment method and reference.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={cn(
                  'py-3 rounded-2xl text-sm font-semibold border-2 transition-all active:scale-[0.97]',
                  method === m
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-border/60 bg-muted/30 text-muted-foreground',
                )}
              >
                {m === 'BANK_TRANSFER' ? 'Bank' : m === 'MPESA' ? 'M-Pesa' : m.charAt(0) + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Payment Reference {method === 'MPESA' ? '(M-Pesa code)' : '(optional)'}
            </label>
            <input
              value={ref}
              onChange={e => setRef(e.target.value.toUpperCase())}
              placeholder={method === 'MPESA' ? 'e.g. QJK3HY789' : 'Ref number…'}
              className="w-full h-11 px-3.5 rounded-xl border border-border/60 bg-muted/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 h-12 rounded-2xl border-2 border-border/60 text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(method, ref)}
              disabled={loading}
              className="flex-1 h-12 rounded-2xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-colors active:scale-[0.98]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Confirm Payment
            </button>
          </div>
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Single invoice pay sheet (reuse same UI)
// ─────────────────────────────────────────────────────────────────────────────

const PayOneSheet: React.FC<{
  invoice:   Invoice;
  onConfirm: (method: string, ref: string) => void;
  onCancel:  () => void;
  loading:   boolean;
}> = ({ invoice, onConfirm, onCancel, loading }) => {
  const [method, setMethod] = useState('MPESA');
  const [ref,    setRef]    = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-background rounded-t-3xl shadow-2xl z-10">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>
        <div className="px-5 pb-6 pt-3 space-y-4">
          <div>
            <p className="font-bold text-base">Mark as Paid</p>
            <p className="text-xs text-muted-foreground mt-0.5">{invoice.invoiceNumber} · {fmtMoney(invoice.totalAmount)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(m => (
              <button key={m} onClick={() => setMethod(m)}
                className={cn('py-3 rounded-2xl text-sm font-semibold border-2 transition-all active:scale-[0.97]',
                  method === m ? 'border-primary bg-primary/8 text-primary' : 'border-border/60 bg-muted/30 text-muted-foreground')}>
                {m === 'BANK_TRANSFER' ? 'Bank' : m === 'MPESA' ? 'M-Pesa' : m.charAt(0) + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Reference {method === 'MPESA' ? '(M-Pesa code)' : '(optional)'}
            </label>
            <input value={ref} onChange={e => setRef(e.target.value.toUpperCase())}
              placeholder={method === 'MPESA' ? 'e.g. QJK3HY789' : 'Ref…'}
              className="w-full h-11 px-3.5 rounded-xl border border-border/60 bg-muted/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onCancel} disabled={loading}
              className="flex-1 h-12 rounded-2xl border-2 border-border/60 text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors">
              Cancel
            </button>
            <button onClick={() => onConfirm(method, ref)} disabled={loading}
              className="flex-1 h-12 rounded-2xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-colors active:scale-[0.98]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Confirm
            </button>
          </div>
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode     = 'customers' | 'list';
type StatusFilter = 'ALL' | 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE';

export const InvoicesListPage: React.FC = () => {
  const navigate = useNavigate();

  // ── Data ────────────────────────────────────────────────────────────────
  const [invoices,    setInvoices]    = useState<Invoice[]>([]);
  const [loading,     setLoading]     = useState(true);

  // ── Filters ─────────────────────────────────────────────────────────────
  const [viewMode,    setViewMode]    = useState<ViewMode>('customers');
  const [search,      setSearch]      = useState('');
  const [status,      setStatus]      = useState<StatusFilter>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>(''); // 'yyyy-MM' or ''
  const [page,        setPage]        = useState(1);
  const [total,       setTotal]       = useState(0);
  const [totalPages,  setTotalPages]  = useState(1);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [issuingId,   setIssuingId]   = useState<string | null>(null);

  // Pay-all sheet
  const [payAllGroup, setPayAllGroup] = useState<CustomerGroup | null>(null);
  const [payAllLoading, setPayAllLoading] = useState(false);
  const [payingAllFor,  setPayingAllFor]  = useState<string | null>(null); // customerName

  // Single pay sheet
  const [payOneInv,   setPayOneInv]   = useState<Invoice | null>(null);
  const [payOneLoading, setPayOneLoading] = useState(false);

  const LIMIT = 100; // load plenty so client-side grouping works well

  const months = useMemo(() => recentMonths(12), []);

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Build date range from month filter
      let dateFrom: string | undefined;
      let dateTo:   string | undefined;
      if (monthFilter) {
        const d = parseISO(`${monthFilter}-01`);
        dateFrom = format(startOfMonth(d), 'yyyy-MM-dd');
        dateTo   = format(endOfMonth(d),   'yyyy-MM-dd');
      }

      const res = await accountingService.listInvoices({
        status:    status !== 'ALL' ? status : undefined,
        date_from: dateFrom,
        date_to:   dateTo,
        page,
        limit:     LIMIT,
      });
      setInvoices(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [status, monthFilter, page]);

  useEffect(() => { load(); }, [load]);

  // ── Client-side search ────────────────────────────────────────────────────
  const searchFiltered = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(inv =>
      inv.customerName.toLowerCase().includes(q) ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.customerPhone ?? '').toLowerCase().includes(q),
    );
  }, [invoices, search]);

  // ── Group by customer ─────────────────────────────────────────────────────
  const customerGroups = useMemo((): CustomerGroup[] => {
    const map = new Map<string, Invoice[]>();
    for (const inv of searchFiltered) {
      const existing = map.get(inv.customerName) ?? [];
      existing.push(inv);
      map.set(inv.customerName, existing);
    }

    return Array.from(map.entries())
      .map(([name, invs]) => {
        const unpaid = invs.filter(i => UNPAID_STATUSES.has(i.status));
        return {
          customerName:  name,
          customerPhone: invs.find(i => i.customerPhone)?.customerPhone,
          invoices:      invs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
          totalUnpaid:   unpaid.reduce((s, i) => s + i.totalAmount, 0),
          totalAll:      invs.reduce((s, i) => s + i.totalAmount, 0),
          unpaidCount:   unpaid.length,
          hasOverdue:    invs.some(i => i.isOverdue && i.status !== 'PAID'),
        };
      })
      // Sort: overdue first, then by unpaid amount desc, then alphabetical
      .sort((a, b) => {
        if (a.hasOverdue && !b.hasOverdue) return -1;
        if (!a.hasOverdue && b.hasOverdue) return 1;
        if (b.totalUnpaid !== a.totalUnpaid) return b.totalUnpaid - a.totalUnpaid;
        return a.customerName.localeCompare(b.customerName);
      });
  }, [searchFiltered]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:        invoices.length,
    paid:         invoices.filter(i => i.status === 'PAID').length,
    overdue:      invoices.filter(i => i.isOverdue && i.status !== 'PAID').length,
    totalUnpaid:  invoices.filter(i => UNPAID_STATUSES.has(i.status)).reduce((s, i) => s + i.totalAmount, 0),
  }), [invoices]);

  // ── Toggle expand ─────────────────────────────────────────────────────────
  const toggleCustomer = (name: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // ── Issue single invoice ──────────────────────────────────────────────────
  const handleIssue = async (id: string) => {
    setIssuingId(id);
    try {
      const res = await accountingService.issueInvoice(id);
      setInvoices(prev => prev.map(inv => inv.id === id ? res.invoice : inv));
      toast.success('Invoice issued');
    } catch {
      toast.error('Failed to issue invoice');
    } finally {
      setIssuingId(null);
    }
  };

  // ── Pay single invoice ────────────────────────────────────────────────────
  const handlePayOne = async (method: string, ref: string) => {
    if (!payOneInv) return;
    setPayOneLoading(true);
    try {
      const res = await accountingService.markPaid(payOneInv.id, {
        payment_method:    method,
        payment_reference: ref || undefined,
      });
      setInvoices(prev => prev.map(inv => inv.id === payOneInv.id ? res.invoice : inv));
      setPayOneInv(null);
      toast.success('Invoice marked as paid');
    } catch {
      toast.error('Failed to mark invoice as paid');
    } finally {
      setPayOneLoading(false);
    }
  };

  // ── Pay ALL unpaid for a customer ─────────────────────────────────────────
  const handlePayAll = async (method: string, ref: string) => {
    if (!payAllGroup) return;
    setPayAllLoading(true);
    setPayingAllFor(payAllGroup.customerName);
    try {
      const unpaid = payAllGroup.invoices.filter(i => UNPAID_STATUSES.has(i.status));

      // Fire all in parallel
      const results = await Promise.allSettled(
        unpaid.map(inv =>
          accountingService.markPaid(inv.id, {
            payment_method:    method,
            payment_reference: ref || undefined,
          }),
        ),
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed    = results.length - succeeded;

      // Patch local state with successful results
      const updatedMap = new Map<string, Invoice>();
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          updatedMap.set(unpaid[idx].id, (r as PromiseFulfilledResult<{ invoice: Invoice }>).value.invoice);
        }
      });
      setInvoices(prev => prev.map(inv => updatedMap.has(inv.id) ? updatedMap.get(inv.id)! : inv));

      setPayAllGroup(null);

      if (failed === 0) {
        toast.success(`All ${succeeded} invoices marked as paid for ${payAllGroup.customerName}`);
      } else {
        toast.warning(`${succeeded} paid, ${failed} failed — check individual invoices`);
      }
    } catch {
      toast.error('Failed to process payments');
    } finally {
      setPayAllLoading(false);
      setPayingAllFor(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AccountsLayout title="Invoices" subtitle="Issue and manage customer invoices">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-10 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Invoices</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} invoice{total !== 1 ? 's' : ''}
              {stats.totalUnpaid > 0 && (
                <span className="ml-2 text-amber-600 font-semibold">
                  · {fmtMoney(stats.totalUnpaid)} unpaid
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-border/60 bg-muted/30 hover:bg-muted transition-colors">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate('/client/accounts/customers')}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors">
              <Plus className="h-4 w-4" />New Invoice
            </button>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Total',      val: stats.total,                                     cls: 'bg-muted/60 text-foreground border-border/60' },
            { label: 'Paid',       val: stats.paid,                                      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
            { label: 'Overdue',    val: stats.overdue,                                   cls: stats.overdue > 0 ? 'bg-red-50 text-red-700 border-red-200/60' : 'bg-muted/60 text-muted-foreground border-border/60' },
            { label: 'Customers',  val: customerGroups.length,                           cls: 'bg-blue-50 text-blue-700 border-blue-200/60' },
          ].map(({ label, val, cls }) => (
            <div key={label} className={cn('rounded-2xl border px-3 py-3 text-center', cls)}>
              <p className="text-2xl font-black leading-none tabular-nums">{val}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* ── View toggle ── */}
        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setViewMode('customers')}
            className={cn(
              'flex items-center gap-2 h-8 px-3.5 rounded-xl text-xs font-bold transition-all',
              viewMode === 'customers' ? 'bg-background text-foreground shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Users className="h-3.5 w-3.5" />By Customer
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-2 h-8 px-3.5 rounded-xl text-xs font-bold transition-all',
              viewMode === 'list' ? 'bg-background text-foreground shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <List className="h-3.5 w-3.5" />All Invoices
          </button>
        </div>

        {/* ── Search + month filter ── */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customer, invoice number…"
              className="w-full h-11 pl-10 pr-10 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Month picker */}
          <div className="relative shrink-0">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              value={monthFilter}
              onChange={e => { setMonthFilter(e.target.value); setPage(1); }}
              className="h-11 pl-9 pr-4 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
            >
              <option value="">All months</option>
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Status tabs (list view only) ── */}
        {viewMode === 'list' && (
          <div className="flex gap-1.5 bg-muted/40 p-1 rounded-2xl overflow-x-auto scrollbar-none">
            {(['ALL', 'ISSUED', 'OVERDUE', 'PAID', 'DRAFT'] as StatusFilter[]).map(s => (
              <button key={s}
                onClick={() => { setStatus(s); setPage(1); }}
                className={cn(
                  'flex-1 min-w-fit py-2 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                  status === s ? 'bg-background text-foreground shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground',
                )}>
                {s === 'ALL' ? 'All' : STATUS_CFG[s]?.label ?? s}
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" />
          </div>
        ) : searchFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <InboxIcon className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="font-bold text-base mb-1">No invoices found</p>
            <p className="text-sm text-muted-foreground">
              {search || monthFilter ? 'Try a different filter.' : 'Invoices will appear here once generated.'}
            </p>
          </div>
        ) : viewMode === 'customers' ? (

          /* ── Customer grouped view ── */
          <div className="space-y-3">
            {customerGroups.map(group => (
              <CustomerGroupCard
                key={group.customerName}
                group={group}
                expanded={expandedCustomers.has(group.customerName)}
                onToggle={() => toggleCustomer(group.customerName)}
                onViewInv={id => navigate(`/client/accounts/invoices/${id}`)}
                onIssueInv={id => handleIssue(id)}
                onPayInv={inv => setPayOneInv(inv)}
                onPayAll={() => setPayAllGroup(group)}
                issuingId={issuingId}
                payingAll={payingAllFor === group.customerName}
              />
            ))}
          </div>

        ) : (

          /* ── Flat list view ── */
          <>
            <div className="space-y-3">
              {searchFiltered.map(inv => (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  onClick={() => navigate(`/client/accounts/invoices/${inv.id}`)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="h-9 px-4 rounded-xl border border-border/60 text-xs font-semibold disabled:opacity-40 hover:bg-muted transition-colors">
                  Previous
                </button>
                <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="h-9 px-4 rounded-xl border border-border/60 text-xs font-semibold disabled:opacity-40 hover:bg-muted transition-colors">
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Pay All sheet ── */}
      {payAllGroup && (
        <PayAllSheet
          customerName={payAllGroup.customerName}
          totalAmount={payAllGroup.totalUnpaid}
          invoiceCount={payAllGroup.unpaidCount}
          onConfirm={handlePayAll}
          onCancel={() => setPayAllGroup(null)}
          loading={payAllLoading}
        />
      )}

      {/* ── Pay One sheet ── */}
      {payOneInv && (
        <PayOneSheet
          invoice={payOneInv}
          onConfirm={handlePayOne}
          onCancel={() => setPayOneInv(null)}
          loading={payOneLoading}
        />
      )}
    </AccountsLayout>
  );
};

export default InvoicesListPage;
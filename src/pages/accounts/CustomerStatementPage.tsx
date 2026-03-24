/**
 * CustomerStatementPage
 * src/pages/accounts/CustomerStatementPage.tsx
 *
 * Route: /client/accounts/customers/:id/statement
 *
 * A proper accountant-grade customer ledger showing:
 *  ─ Account summary card (outstanding, credit limit, available credit)
 *  ─ Aging analysis with visual bar (Current / 1-30 / 31-60 / 61-90 / 90+)
 *  ─ Full invoice ledger table — sortable, with running balance column
 *  ─ Pay All / Pay Single bottom sheet (M-Pesa / Cash / Bank / Cheque)
 *  ─ Print-ready statement (opens InvoiceModal-style overlay)
 *  ─ Individual invoice navigation
 */

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import {
  Loader2, AlertTriangle, CheckCircle2, Clock,
  CreditCard, Phone, ChevronLeft, RefreshCw,
  Banknote, Printer, ChevronRight, FileText,
  TrendingDown, Calendar, X, Download, Send,
  Building, Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountsLayout } from '@/pages/accounts/AccountsLayout';
import { paymentService }  from '@/api/services/payment.service';
import { accountingService } from '@/api/services/accounting.service';
import type { CustomerStatement } from '@/api/services/payment.service';
import type { Invoice } from '@/types/accounting.types';
import type { AccountingSettings } from '@/types/accounting.types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'd MMM yyyy'); } catch { return String(d); }
};

const today = () => new Date();

const daysOverdue = (dueDate?: string | null): number => {
  if (!dueDate) return 0;
  return differenceInDays(today(), new Date(dueDate));
};

const UNPAID = new Set(['ISSUED', 'OVERDUE']);
const PAYMENT_METHODS = ['MPESA', 'CASH', 'BANK_TRANSFER', 'CHEQUE'] as const;
type PayMethod = typeof PAYMENT_METHODS[number];

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string; small?: boolean }> = ({ status, small }) => {
  const cls = {
    PAID:      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300',
    ISSUED:    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300',
    OVERDUE:   'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300',
    DRAFT:     'bg-muted/60 text-muted-foreground border-border',
    CANCELLED: 'bg-muted/60 text-muted-foreground border-border',
  }[status] ?? 'bg-muted/60 text-muted-foreground border-border';

  return (
    <span className={cn(
      'inline-flex items-center font-bold border rounded-full',
      small ? 'text-[9px] px-1.5 py-0' : 'text-[10px] px-2 py-0.5',
      cls,
    )}>
      {status}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Aging bar
// ─────────────────────────────────────────────────────────────────────────────

interface Aging {
  current:      number;
  days_1_30:    number;
  days_31_60:   number;
  days_61_90:   number;
  days_90_plus: number;
}

const AgingSection: React.FC<{ aging: Aging; total: number }> = ({ aging, total }) => {
  if (total === 0) return null;

  const segments = [
    { label: 'Current',  value: aging.current,       color: 'bg-emerald-500', text: 'text-emerald-700' },
    { label: '1–30 days', value: aging.days_1_30,    color: 'bg-amber-400',   text: 'text-amber-700'   },
    { label: '31–60 days', value: aging.days_31_60,  color: 'bg-orange-500',  text: 'text-orange-700'  },
    { label: '61–90 days', value: aging.days_61_90,  color: 'bg-red-500',     text: 'text-red-700'     },
    { label: '90+ days',  value: aging.days_90_plus, color: 'bg-red-800',     text: 'text-red-900'     },
  ].filter(s => s.value > 0);

  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div className="flex h-4 rounded-xl overflow-hidden gap-0.5">
        {segments.map(s => (
          <div
            key={s.label}
            className={cn('transition-all first:rounded-l-xl last:rounded-r-xl', s.color)}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label}: ${fmt(s.value)}`}
          />
        ))}
      </div>

      {/* Legend grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {segments.map(s => (
          <div key={s.label} className="flex items-start gap-2">
            <div className={cn('h-3 w-3 rounded-full shrink-0 mt-0.5', s.color)} />
            <div>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className={cn('text-sm font-bold tabular-nums', s.text)}>{fmt(s.value)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Payment bottom sheet
// ─────────────────────────────────────────────────────────────────────────────

interface PaySheetProps {
  title:        string;
  subtitle:     string;
  warning?:     string;
  onConfirm:    (method: PayMethod, ref: string) => void;
  onCancel:     () => void;
  loading:      boolean;
}

const PaySheet: React.FC<PaySheetProps> = ({
  title, subtitle, warning, onConfirm, onCancel, loading,
}) => {
  const [method, setMethod] = useState<PayMethod>('MPESA');
  const [ref,    setRef]    = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-background rounded-t-3xl shadow-2xl z-10">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        <div className="px-5 pb-6 pt-2 space-y-4">
          <div>
            <p className="font-bold text-base">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>

          {warning && (
            <div className="flex items-start gap-2.5 px-3 py-3 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-950/30 dark:border-amber-800">
              <TrendingDown className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{warning}</p>
            </div>
          )}

          {/* Payment method picker */}
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
                {m === 'BANK_TRANSFER' ? 'Bank Transfer'
                  : m === 'MPESA' ? 'M-Pesa'
                  : m.charAt(0) + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Reference */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {method === 'MPESA' ? 'M-Pesa Transaction Code' : 'Reference (optional)'}
            </label>
            <input
              value={ref}
              onChange={e => setRef(e.target.value.toUpperCase())}
              placeholder={method === 'MPESA' ? 'e.g. QJK3HY789' : 'Cheque no. / bank ref…'}
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
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
// Printable statement overlay
// ─────────────────────────────────────────────────────────────────────────────

interface PrintStatementProps {
  statement: CustomerStatement;
  settings:  AccountingSettings | null;
  onClose:   () => void;
}

const PrintStatement: React.FC<PrintStatementProps> = ({ statement, settings, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { customer, creditInfo, summary, aging, invoices } = statement;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head>
        <title>Account Statement – ${customer.fullName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; }
          .page { padding: 32px; max-width: 800px; margin: 0 auto; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #1f2937; color: #fff; font-weight: 700; font-size: 11px; text-transform: uppercase; }
          tr:nth-child(even) td { background: #f9fafb; }
          .paid   { color: #059669; font-weight: 700; }
          .unpaid { color: #d97706; font-weight: 700; }
          .overdue{ color: #dc2626; font-weight: 700; }
          .right  { text-align: right; }
          .mono   { font-family: monospace; }
          @media print { .no-print { display: none !important; } }
        </style>
      </head><body>
        <div class="page">${content.innerHTML}</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const totalAgingOutstanding =
    aging.current + aging.days_1_30 + aging.days_31_60 +
    aging.days_61_90 + aging.days_90_plus;

  // Running balance calculation (oldest first for the ledger)
  const sortedInvoices = [...invoices].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  let runningBalance = 0;
  const ledger = sortedInvoices.map(inv => {
    runningBalance += Number(inv.totalAmount) - Number(inv.amountPaid ?? 0);
    return { inv, runningBalance };
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20 shrink-0">
        <div>
          <p className="font-bold text-sm">Account Statement</p>
          <p className="text-xs text-muted-foreground">{customer.fullName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />Print / PDF
          </button>
          <button
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/60 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable preview */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-muted/10">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 text-gray-900" ref={printRef}
          style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px' }}>

          {/* ── Statement header ── */}
          <div className="flex items-start justify-between pb-5 border-b-2 border-gray-800 mb-6">
            <div>
              <p className="text-xl font-black">{settings?.legalName || 'Your Business'}</p>
              {settings?.address && <p className="text-xs text-gray-600 mt-1">{settings.address}{settings.city ? `, ${settings.city}` : ''}</p>}
              {settings?.phone && <p className="text-xs text-gray-600">Tel: {settings.phone}</p>}
              {settings?.kraPin && <p className="text-xs font-semibold text-gray-700 mt-1">KRA PIN: {settings.kraPin}</p>}
            </div>
            <div className="text-right">
              <p className="text-2xl font-black tracking-tight">ACCOUNT STATEMENT</p>
              <p className="text-xs text-gray-500 mt-1">Date: {format(new Date(), 'd MMM yyyy')}</p>
              <p className="text-xs text-gray-500">As of: {format(new Date(), 'd MMMM yyyy')}</p>
            </div>
          </div>

          {/* ── Bill to ── */}
          <div className="flex gap-8 mb-6">
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Account Holder</p>
              <p className="font-bold text-base">{customer.fullName}</p>
              {customer.phoneNumber && <p className="text-xs text-gray-600 mt-0.5">{customer.phoneNumber}</p>}
              {customer.email && <p className="text-xs text-gray-600">{customer.email}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Statement Summary</p>
              <table className="text-xs ml-auto">
                <tbody>
                  <tr><td className="pr-4 text-gray-600 py-0.5">Total Invoiced</td><td className="font-semibold text-right">{fmt(summary.totalInvoiced)}</td></tr>
                  <tr><td className="pr-4 text-gray-600 py-0.5">Total Paid</td><td className="font-semibold text-right text-green-700">{fmt(summary.totalPaid)}</td></tr>
                  <tr className="border-t border-gray-300">
                    <td className="pr-4 font-bold py-1">Balance Due</td>
                    <td className={cn('font-black text-right', summary.totalDue > 0 ? 'text-red-700' : 'text-green-700')}>{fmt(summary.totalDue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Credit info ── */}
          {creditInfo.creditEnabled && (
            <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Credit Account</p>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div><p className="text-gray-500">Credit Limit</p><p className="font-bold">{fmt(creditInfo.creditLimit)}</p></div>
                <div><p className="text-gray-500">Used</p><p className="font-bold text-amber-700">{fmt(creditInfo.outstandingBalance)}</p></div>
                <div><p className="text-gray-500">Available</p><p className="font-bold text-green-700">{fmt(creditInfo.availableCredit)}</p></div>
              </div>
            </div>
          )}

          {/* ── Aging analysis ── */}
          {totalAgingOutstanding > 0 && (
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Debt Aging Analysis</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#1f2937', color: '#fff' }}>
                    {['Current (not due)', '1–30 Days', '31–60 Days', '61–90 Days', '90+ Days', 'Total'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}
                        className={h === 'Current (not due)' ? 'text-left' : ''}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {[aging.current, aging.days_1_30, aging.days_31_60, aging.days_61_90, aging.days_90_plus, totalAgingOutstanding].map((v, i) => (
                      <td key={i} style={{ padding: '8px 10px', textAlign: i === 0 ? 'left' : 'right', fontWeight: i === 5 ? 800 : 600, color: i === 5 ? '#991b1b' : i > 0 && v > 0 ? '#92400e' : '#059669', borderBottom: '1px solid #e5e7eb' }}>
                        {fmt(v)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ── Invoice ledger ── */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Invoice Ledger</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#1f2937', color: '#fff' }}>
                  {['Invoice #', 'Date', 'Due Date', 'Amount (KES)', 'Paid (KES)', 'Balance (KES)', 'Status'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: h.includes('KES') ? 'right' : 'left', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledger.map(({ inv }, i) => {
                  const balanceDue = Number(inv.totalAmount) - Number(inv.amountPaid ?? 0);
                  const isOverdue = inv.status === 'OVERDUE' || (inv.status === 'ISSUED' && inv.dueDate && daysOverdue(inv.dueDate) > 0);
                  return (
                    <tr key={inv.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', borderBottom: '1px solid #e5e7eb' }}>{inv.invoiceNumber}</td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #e5e7eb' }}>{fmtDate(inv.createdAt)}</td>
                      <td style={{ padding: '7px 10px', color: isOverdue ? '#dc2626' : '#374151', fontWeight: isOverdue ? 700 : 400, borderBottom: '1px solid #e5e7eb' }}>{fmtDate(inv.dueDate)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>{fmt(Number(inv.totalAmount))}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: '#059669', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>{fmt(Number(inv.amountPaid ?? 0))}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 800, color: balanceDue > 0 ? '#d97706' : '#059669', borderBottom: '1px solid #e5e7eb' }}>{fmt(balanceDue)}</td>
                      <td style={{ padding: '7px 10px', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '999px', background: inv.status === 'PAID' ? '#d1fae5' : inv.status === 'OVERDUE' ? '#fee2e2' : '#dbeafe', color: inv.status === 'PAID' ? '#065f46' : inv.status === 'OVERDUE' ? '#991b1b' : '#1e40af' }}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#1f2937', color: '#fff', fontWeight: 800 }}>
                  <td style={{ padding: '9px 10px' }} colSpan={3}>TOTALS</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmt(summary.totalInvoiced)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmt(summary.totalPaid)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmt(summary.totalDue)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── Footer ── */}
          <div className="mt-8 pt-4 border-t border-gray-300 text-center">
            <p style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic' }}>
              {settings?.invoiceFooterNote || 'This is a computer-generated statement. Please contact us for any queries.'}
            </p>
            {settings?.kraPin && (
              <p style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px' }}>
                {settings.legalName} | KRA PIN: {settings.kraPin}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Invoice ledger row
// ─────────────────────────────────────────────────────────────────────────────

const LedgerRow: React.FC<{
  invoice:     Invoice;
  index:       number;
  onNavigate:  () => void;
  onPay:       () => void;
}> = ({ invoice: inv, index, onNavigate, onPay }) => {
  const balanceDue = Number(inv.totalAmount) - Number(inv.amountPaid ?? 0);
  const isOverdue  = inv.status === 'OVERDUE' || (inv.status === 'ISSUED' && inv.dueDate && daysOverdue(inv.dueDate) > 0);
  const overdueDays = inv.dueDate ? daysOverdue(inv.dueDate) : 0;

  return (
    <tr
      className={cn(
        'border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer',
        index % 2 === 0 ? 'bg-background' : 'bg-muted/5',
        isOverdue && 'bg-red-50/30 dark:bg-red-950/5',
      )}
      onClick={onNavigate}
    >
      {/* Invoice # */}
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="font-mono font-bold text-xs">{inv.invoiceNumber}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(inv.createdAt)}</p>
      </td>

      {/* Due date */}
      <td className="px-4 py-3 whitespace-nowrap">
        {inv.dueDate ? (
          <p className={cn(
            'text-xs font-semibold',
            isOverdue ? 'text-red-600' : 'text-muted-foreground',
          )}>
            {fmtDate(inv.dueDate)}
          </p>
        ) : <p className="text-xs text-muted-foreground">—</p>}
        {isOverdue && overdueDays > 0 && (
          <p className="text-[10px] text-red-500 font-bold mt-0.5">{overdueDays}d overdue</p>
        )}
        {inv.paidAt && (
          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Paid {fmtDate(inv.paidAt)}</p>
        )}
      </td>

      {/* Invoice amount */}
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <p className="font-semibold text-sm tabular-nums">{fmt(Number(inv.totalAmount))}</p>
      </td>

      {/* Amount paid */}
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <p className={cn('text-sm tabular-nums font-semibold', Number(inv.amountPaid ?? 0) > 0 ? 'text-emerald-600' : 'text-muted-foreground/50')}>
          {fmt(Number(inv.amountPaid ?? 0))}
        </p>
      </td>

      {/* Balance due */}
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <p className={cn(
          'font-black text-sm tabular-nums',
          balanceDue > 0 ? (isOverdue ? 'text-red-600' : 'text-amber-600') : 'text-emerald-600',
        )}>
          {fmt(balanceDue)}
        </p>
      </td>

      {/* Status + action */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <StatusBadge status={inv.status} small />
          {UNPAID.has(inv.status) && (
            <button
              onClick={onPay}
              className="h-6 px-2 rounded-lg bg-emerald-500/10 text-emerald-700 text-[10px] font-bold hover:bg-emerald-500/20 transition-colors"
            >
              Pay
            </button>
          )}
          <ChevronRight className="h-3 w-3 text-muted-foreground/40" onClick={onNavigate} />
        </div>
      </td>
    </tr>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

const CustomerStatementPage: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [statement,  setStatement]  = useState<CustomerStatement | null>(null);
  const [settings,   setSettings]   = useState<AccountingSettings | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [showPrint,  setShowPrint]  = useState(false);

  // Pay sheets
  const [payAll,    setPayAll]    = useState(false);
  const [payOne,    setPayOne]    = useState<Invoice | null>(null);
  const [paying,    setPaying]    = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [stmt, cfg] = await Promise.all([
        paymentService.getCustomerStatement(id),
        accountingService.getSettings().catch(() => null),
      ]);
      setStatement(stmt);
      setSettings(cfg);
    } catch {
      toast.error('Failed to load customer statement');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Pay single invoice ────────────────────────────────────────────────────
  const handlePayOne = async (method: PayMethod, ref: string) => {
    if (!payOne) return;
    setPaying(true);
    try {
      await accountingService.markPaid(payOne.id, {
        payment_method:    method,
        payment_reference: ref || undefined,
      });
      toast.success(`Invoice ${payOne.invoiceNumber} marked as paid`);
      setPayOne(null);
      load();
    } catch {
      toast.error('Failed to record payment');
    } finally {
      setPaying(false);
    }
  };

  // ── Pay all unpaid ────────────────────────────────────────────────────────
  const handlePayAll = async (method: PayMethod, ref: string) => {
    if (!statement) return;
    setPaying(true);
    const unpaidInvoices = statement.invoices.filter(i => UNPAID.has(i.status));
    try {
      const results = await Promise.allSettled(
        unpaidInvoices.map(inv =>
          accountingService.markPaid(inv.id, {
            payment_method:    method,
            payment_reference: ref || undefined,
          }),
        ),
      );
      const ok   = results.filter(r => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      if (fail === 0) toast.success(`All ${ok} invoices marked as paid`);
      else toast.warning(`${ok} paid, ${fail} failed — please check individually`);
      setPayAll(false);
      load();
    } catch {
      toast.error('Failed to process payments');
    } finally {
      setPaying(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const unpaidInvoices = useMemo(() =>
    statement?.invoices.filter(i => UNPAID.has(i.status)) ?? [],
  [statement]);

  const hasOverdue = useMemo(() =>
    unpaidInvoices.some(i => i.status === 'OVERDUE'),
  [unpaidInvoices]);

  const totalAgingOutstanding = statement
    ? statement.aging.current + statement.aging.days_1_30 +
      statement.aging.days_31_60 + statement.aging.days_61_90 +
      statement.aging.days_90_plus
    : 0;

  const creditUsedPct = statement
    ? statement.creditInfo.creditLimit > 0
      ? Math.min(100, (statement.creditInfo.outstandingBalance / statement.creditInfo.creditLimit) * 100)
      : 0
    : 0;

  // Sort invoices newest first for the ledger display
  const sortedInvoices = useMemo(() =>
    [...(statement?.invoices ?? [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  [statement]);

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <AccountsLayout title="Account Statement" showBackButton onBack={() => navigate(-1)}>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" />
      </div>
    </AccountsLayout>
  );

  if (!statement) return (
    <AccountsLayout title="Account Statement" showBackButton onBack={() => navigate(-1)}>
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-muted-foreground">Customer not found.</p>
      </div>
    </AccountsLayout>
  );

  const { customer, creditInfo, summary, aging } = statement;

  return (
    <AccountsLayout
      title="Account Statement"
      subtitle={customer.fullName}
      showBackButton
      onBack={() => navigate(-1)}
    >
      <div className="max-w-4xl mx-auto space-y-4 pb-10 px-4">

        {/* ── Top action bar ── */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowPrint(true)}
              className="flex items-center gap-2 h-9 px-3.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted text-sm font-semibold transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />Print Statement
            </button>
            {unpaidInvoices.length > 0 && (
              <button
                onClick={() => setPayAll(true)}
                className="flex items-center gap-2 h-9 px-3.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
              >
                <Banknote className="h-3.5 w-3.5" />
                Pay All ({fmt(summary.totalDue)})
              </button>
            )}
          </div>
        </div>

        {/* ── Customer identity card ── */}
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-start gap-4">
            <div className={cn(
              'h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 font-black text-xl',
              hasOverdue
                ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                : summary.totalDue > 0
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
            )}>
              {customer.fullName[0]?.toUpperCase() ?? '?'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-black text-lg">{customer.fullName}</h1>
                {hasOverdue && (
                  <span className="text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                    OVERDUE
                  </span>
                )}
                {creditInfo.creditEnabled && (
                  <span className="text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                    <CreditCard className="h-2.5 w-2.5" />CREDIT
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap mt-1">
                {customer.phoneNumber && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />{customer.phoneNumber}
                  </p>
                )}
                {customer.email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />{customer.email}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Summary numbers ── */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-border/40">
            <div className="text-center">
              <p className="text-2xl font-black tabular-nums">{fmt(summary.totalInvoiced)}</p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-1">Total Invoiced</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black tabular-nums text-emerald-600">{fmt(summary.totalPaid)}</p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-1">Total Paid</p>
            </div>
            <div className="text-center">
              <p className={cn('text-2xl font-black tabular-nums', summary.totalDue > 0 ? (hasOverdue ? 'text-red-600' : 'text-amber-600') : 'text-emerald-600')}>
                {fmt(summary.totalDue)}
              </p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-1">Balance Due</p>
            </div>
          </div>
        </div>

        {/* ── Credit account ── */}
        {creditInfo.creditEnabled && (
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <p className="font-bold text-sm">Credit Account</p>
              <span className="ml-auto text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700">
                ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Credit Limit',      value: creditInfo.creditLimit,        sub: 'maximum allowed',  color: '' },
                { label: 'Used',              value: creditInfo.outstandingBalance, sub: `${creditUsedPct.toFixed(0)}% of limit`, color: creditUsedPct >= 80 ? 'text-red-600' : 'text-amber-600' },
                { label: 'Available Credit',  value: creditInfo.availableCredit,    sub: 'can still order',  color: 'text-emerald-600' },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-muted/30 p-3.5 text-center">
                  <p className={cn('font-black text-sm tabular-nums', s.color)}>{fmt(s.value)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    creditUsedPct >= 100 ? 'bg-red-600'    :
                    creditUsedPct >= 80  ? 'bg-orange-500' :
                    creditUsedPct >= 50  ? 'bg-amber-400'  : 'bg-emerald-500',
                  )}
                  style={{ width: `${Math.min(100, creditUsedPct)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right">
                {creditUsedPct.toFixed(0)}% of credit limit used
              </p>
            </div>
          </div>
        )}

        {/* ── Aging analysis ── */}
        {totalAgingOutstanding > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="font-bold text-sm">Debt Aging Analysis</p>
              <span className="ml-auto text-xs font-bold text-muted-foreground tabular-nums">
                {fmt(totalAgingOutstanding)} total
              </span>
            </div>
            <AgingSection aging={aging} total={totalAgingOutstanding} />
          </div>
        )}

        {/* ── Outstanding alert ── */}
        {unpaidInvoices.length > 0 && (
          <div className={cn(
            'rounded-2xl border p-4 flex items-center justify-between gap-3',
            hasOverdue
              ? 'border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-800/50'
              : 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-800/50',
          )}>
            <div className="flex items-center gap-2.5 min-w-0">
              {hasOverdue
                ? <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                : <Clock         className="h-5 w-5 text-amber-500 shrink-0" />
              }
              <div>
                <p className={cn('font-bold text-sm', hasOverdue ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300')}>
                  {unpaidInvoices.length} unpaid invoice{unpaidInvoices.length !== 1 ? 's' : ''}
                  {hasOverdue ? ' — includes overdue' : ''}
                </p>
                <p className={cn('text-xs', hasOverdue ? 'text-red-600/80 dark:text-red-400' : 'text-amber-600/80 dark:text-amber-400')}>
                  Total outstanding: {fmt(summary.totalDue)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setPayAll(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors active:scale-[0.96] shrink-0"
            >
              <Banknote className="h-3.5 w-3.5" />Pay All
            </button>
          </div>
        )}

        {/* ── Invoice ledger table ── */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40 bg-muted/20">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Invoice Ledger ({sortedInvoices.length})
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {sortedInvoices.filter(i => i.status === 'PAID').length} paid · {unpaidInvoices.length} outstanding
            </p>
          </div>

          {sortedInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FileText className="h-8 w-8 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No invoices on record</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/10">
                      {['Invoice', 'Due / Paid', 'Amount', 'Paid', 'Balance', 'Status'].map(h => (
                        <th key={h} className={cn(
                          'px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground',
                          ['Amount', 'Paid', 'Balance'].includes(h) ? 'text-right' : 'text-left',
                        )}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInvoices.map((inv, i) => (
                      <LedgerRow
                        key={inv.id}
                        invoice={inv}
                        index={i}
                        onNavigate={() => navigate(`/client/accounts/invoices/${inv.id}`)}
                        onPay={() => setPayOne(inv)}
                      />
                    ))}
                  </tbody>
                  {/* Totals footer */}
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30 font-black">
                      <td className="px-4 py-3 text-xs uppercase tracking-wide" colSpan={2}>Totals</td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums">{fmt(summary.totalInvoiced)}</td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-emerald-600">{fmt(summary.totalPaid)}</td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-amber-600">{fmt(summary.totalDue)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border/30">
                {sortedInvoices.map(inv => {
                  const balanceDue = Number(inv.totalAmount) - Number(inv.amountPaid ?? 0);
                  const isOverdue  = inv.status === 'OVERDUE' || (inv.status === 'ISSUED' && inv.dueDate && daysOverdue(inv.dueDate) > 0);
                  return (
                    <div
                      key={inv.id}
                      className={cn('px-4 py-4 cursor-pointer hover:bg-muted/20 transition-colors', isOverdue && 'bg-red-50/30 dark:bg-red-950/5')}
                      onClick={() => navigate(`/client/accounts/invoices/${inv.id}`)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="font-mono font-bold text-xs">{inv.invoiceNumber}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <StatusBadge status={inv.status} small />
                            <p className="text-[10px] text-muted-foreground">{fmtDate(inv.createdAt)}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm tabular-nums">{fmt(Number(inv.totalAmount))}</p>
                          {balanceDue > 0 && (
                            <p className={cn('text-xs font-bold tabular-nums', isOverdue ? 'text-red-600' : 'text-amber-600')}>
                              Due: {fmt(balanceDue)}
                            </p>
                          )}
                        </div>
                      </div>
                      {inv.dueDate && !inv.paidAt && (
                        <p className={cn('text-[11px]', isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground')}>
                          Due {fmtDate(inv.dueDate)}
                          {isOverdue && inv.dueDate && ` · ${daysOverdue(inv.dueDate)}d overdue`}
                        </p>
                      )}
                      {inv.paidAt && (
                        <p className="text-[11px] text-emerald-600 font-semibold">Paid {fmtDate(inv.paidAt)}</p>
                      )}
                      {UNPAID.has(inv.status) && (
                        <div className="mt-2.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setPayOne(inv)}
                            className="h-8 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
                          >
                            Mark as Paid
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Print statement overlay ── */}
      {showPrint && statement && (
        <PrintStatement
          statement={statement}
          settings={settings}
          onClose={() => setShowPrint(false)}
        />
      )}

      {/* ── Pay All sheet ── */}
      {payAll && statement && (
        <PaySheet
          title="Pay All Outstanding Invoices"
          subtitle={`${customer.fullName} · ${unpaidInvoices.length} invoice${unpaidInvoices.length !== 1 ? 's' : ''} · ${fmt(summary.totalDue)}`}
          warning={`This will mark all ${unpaidInvoices.length} unpaid invoices as settled using the same payment method and reference.`}
          onConfirm={handlePayAll}
          onCancel={() => setPayAll(false)}
          loading={paying}
        />
      )}

      {/* ── Pay single invoice sheet ── */}
      {payOne && (
        <PaySheet
          title="Mark Invoice as Paid"
          subtitle={`${payOne.invoiceNumber} · ${fmt(Number(payOne.totalAmount) - Number(payOne.amountPaid ?? 0))} due`}
          onConfirm={handlePayOne}
          onCancel={() => setPayOne(null)}
          loading={paying}
        />
      )}
    </AccountsLayout>
  );
};

export default CustomerStatementPage;
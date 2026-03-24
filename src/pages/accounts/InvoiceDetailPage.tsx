// src/pages/accounts/InvoiceDetailPage.tsx
//
// View a single invoice, issue it, mark it paid, print/share via InvoiceModal.

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Loader2, ChevronLeft, Send, CheckCircle,
  Printer, AlertCircle, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { accountingService } from '@/api/services/accounting.service';
import { InvoiceModal } from './InvoiceModal';
import type { Invoice } from '@/types/accounting.types';
import type { AccountingSettings } from '@/types/accounting.types';
import type { TemplateData } from './InvoiceTemplate';
import { AccountsLayout } from '@/pages/accounts/AccountsLayout';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (n: number | undefined | null) =>
  `KES ${(Number(n) || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  try { return format(new Date(iso), 'd MMM yyyy'); } catch { return iso; }
};

const STATUS_CFG: Record<string, { label: string; pill: string }> = {
  DRAFT:     { label: 'Draft',     pill: 'bg-muted/60 text-muted-foreground border-border' },
  ISSUED:    { label: 'Issued',    pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  PAID:      { label: 'Paid',      pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  OVERDUE:   { label: 'Overdue',   pill: 'bg-red-50 text-red-700 border-red-200' },
  CANCELLED: { label: 'Cancelled', pill: 'bg-muted/60 text-muted-foreground border-border' },
};

// ── Mark paid dialog ──────────────────────────────────────────────────────────

const PAYMENT_METHODS = ['MPESA', 'CASH', 'BANK_TRANSFER', 'CHEQUE'];

const MarkPaidDialog: React.FC<{
  invoiceNumber: string;
  totalAmount:   number;
  onConfirm:     (method: string, ref: string) => void;
  onCancel:      () => void;
  loading:       boolean;
}> = ({ invoiceNumber, totalAmount, onConfirm, onCancel, loading }) => {
  const [method, setMethod] = useState('MPESA');
  const [ref,    setRef]    = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-background rounded-t-3xl shadow-2xl z-10">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        <div className="px-5 pb-6 pt-3 space-y-4">
          <div>
            <p className="font-bold text-base">Mark as Paid</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {invoiceNumber} · {fmtMoney(totalAmount)}
            </p>
          </div>

          {/* Payment method */}
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
                {m === 'BANK_TRANSFER' ? 'Bank' : m === 'MPESA' ? 'M-Pesa' :
                 m.charAt(0) + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Reference */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Payment Reference {method === 'MPESA' ? '(M-Pesa code)' : '(optional)'}
            </label>
            <input
              value={ref}
              onChange={e => setRef(e.target.value.toUpperCase())}
              placeholder={method === 'MPESA' ? 'e.g. QJK3HY789' : 'Cheque no. / bank ref…'}
              className="w-full h-11 px-3.5 rounded-xl border border-border/60 bg-muted/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>

          {/* Actions */}
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
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle className="h-4 w-4" />
              }
              Confirm
            </button>
          </div>
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export const InvoiceDetailPage: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [invoice,    setInvoice]    = useState<Invoice | null>(null);
  const [settings,   setSettings]   = useState<AccountingSettings | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [issuing,    setIssuing]    = useState(false);
  const [showPaid,   setShowPaid]   = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [showModal,  setShowModal]  = useState(false);

  // Load invoice + settings in parallel
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const [inv, cfg] = await Promise.all([
          accountingService.getInvoice(id),
          accountingService.getSettings(),
        ]);
        setInvoice(inv);
        setSettings(cfg);
      } catch {
        toast.error('Failed to load invoice');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Issue / Re-issue invoice
  const handleIssue = async () => {
    if (!id) return;
    setIssuing(true);
    try {
      const res = await accountingService.issueInvoice(id);
      setInvoice(res.invoice);
      toast.success('Invoice issued — email sent to customer');
    } catch {
      toast.error('Failed to issue invoice');
    } finally {
      setIssuing(false);
    }
  };

  // Mark paid
  const handleMarkPaid = async (method: string, ref: string) => {
    if (!id) return;
    setPayLoading(true);
    try {
      const res = await accountingService.markPaid(id, {
        payment_method:    method,
        payment_reference: ref || undefined,
      });
      setInvoice(res.invoice);
      setShowPaid(false);
      toast.success('Invoice marked as paid');
    } catch {
      toast.error('Failed to mark invoice as paid');
    } finally {
      setPayLoading(false);
    }
  };

  // Build TemplateData for InvoiceModal — all camelCase from Invoice interface
  const templateData: TemplateData | null = invoice
    ? {
        invoiceNumber: invoice.invoiceNumber,
        date:          invoice.createdAt,
        dueDate:       invoice.dueDate,
        status:        invoice.status,
        customerName:  invoice.customerName,
        customerPhone: invoice.customerPhone,
        periodStart:   invoice.periodStart,
        periodEnd:     invoice.periodEnd,
        items: invoice.items.map(item => ({
          description: item.productName,  // serializer sends productName
          quantity:    item.quantity,
          unitPrice:   item.unitPrice,
          subtotal:    item.subtotal,
        })),
        subtotal:         invoice.subtotal,
        deliveryFees:     invoice.deliveryFees,
        vatAmount:        invoice.vatAmount,
        totalAmount:      invoice.totalAmount,
        paymentMethod:    invoice.paymentMethod,
        paymentReference: invoice.paymentReference,
        paidAt:           invoice.paidAt,
        notes:            invoice.notes,
      }
    : null;

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice || !settings) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-10 text-center">
        <p className="text-muted-foreground">Invoice not found.</p>
        <button
          onClick={() => navigate('/client/accounts/invoices')}
          className="mt-4 text-sm text-primary underline"
        >
          Back to invoices
        </button>
      </div>
    );
  }

  const statusCfg  = STATUS_CFG[invoice.status] ?? STATUS_CFG.DRAFT;
  const canIssue   = invoice.status === 'DRAFT';
  const canPay     = invoice.status === 'ISSUED' || invoice.status === 'OVERDUE';
  const canReissue = invoice.status === 'ISSUED' || invoice.status === 'OVERDUE';

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AccountsLayout title="Invoice" showBackButton onBack={() => navigate('/client/accounts/invoices')}>
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-10 space-y-4">

        {/* Back + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/client/accounts/invoices')}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/60 hover:bg-muted transition-colors shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold truncate">{invoice.invoiceNumber}</h1>
            <p className="text-xs text-muted-foreground">{invoice.customerName}</p>
          </div>
          <span className={cn(
            'text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0',
            statusCfg.pill,
          )}>
            {statusCfg.label}
          </span>
        </div>

        {/* Overdue warning */}
        {invoice.isOverdue && invoice.status !== 'PAID' && (
          <div className="flex items-center gap-3 px-4 py-3.5 bg-red-50 border border-red-200 rounded-2xl dark:bg-red-950/30 dark:border-red-800">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700">Overdue</p>
              <p className="text-xs text-red-600/80">
                Due date was {fmtDate(invoice.dueDate)} — please follow up with the customer.
              </p>
            </div>
          </div>
        )}

        {/* Summary card */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">

          {/* Amount */}
          <div className="text-center py-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
              Total Amount
            </p>
            <p className="text-4xl font-black tabular-nums">{fmtMoney(invoice.totalAmount)}</p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Invoice No',    value: invoice.invoiceNumber },
              { label: 'Customer',      value: invoice.customerName },
              { label: 'Issued',        value: fmtDate(invoice.createdAt) },
              { label: 'Due Date',      value: fmtDate(invoice.dueDate) },
              { label: 'Billing Cycle', value: invoice.billingCycle },
              { label: 'Period',        value: `${fmtDate(invoice.periodStart)} – ${fmtDate(invoice.periodEnd)}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/40 rounded-xl px-3.5 py-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                  {label}
                </p>
                <p className="font-semibold text-sm truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Totals breakdown */}
          <div className="border-t border-border/40 pt-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>{fmtMoney(invoice.subtotal)}</span>
            </div>
            {!!invoice.deliveryFees && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Delivery Fees</span>
                <span>{fmtMoney(invoice.deliveryFees)}</span>
              </div>
            )}
            {invoice.vatAmount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>VAT</span>
                <span>{fmtMoney(invoice.vatAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-base border-t border-border/40 pt-2">
              <span>Total</span>
              <span>{fmtMoney(invoice.totalAmount)}</span>
            </div>
          </div>

          {/* Payment info */}
          {invoice.paidAt && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-950/30 dark:border-emerald-800">
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-emerald-700">Paid {fmtDate(invoice.paidAt)}</p>
                {invoice.paymentMethod && (
                  <p className="text-emerald-600 mt-0.5">
                    {invoice.paymentMethod}
                    {invoice.paymentReference ? ` · ${invoice.paymentReference}` : ''}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />Line Items ({invoice.items.length})
            </p>
          </div>
          <div className="divide-y divide-border/30">
            {invoice.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3.5">
                <div className="min-w-0 flex-1 mr-3">
                  <p className="font-semibold text-sm truncate">{item.productName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.quantity} × {fmtMoney(item.unitPrice)}
                  </p>
                </div>
                <p className="font-bold text-sm shrink-0">{fmtMoney(item.subtotal)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2.5">

          {/* Issue — DRAFT only */}
          {canIssue && (
            <button
              onClick={handleIssue}
              disabled={issuing}
              className="w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-colors active:scale-[0.98]"
              style={{ height: '52px' }}
            >
              {issuing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
              Issue Invoice & Notify Customer
            </button>
          )}

          {/* Mark as Paid — ISSUED or OVERDUE */}
          {canPay && (
            <button
              onClick={() => setShowPaid(true)}
              className="w-full rounded-2xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors active:scale-[0.98]"
              style={{ height: '52px' }}
            >
              <CheckCircle className="h-4 w-4" />
              Mark as Paid
            </button>
          )}

          {/* Re-send — ISSUED or OVERDUE */}
          {canReissue && (
            <button
              onClick={handleIssue}
              disabled={issuing}
              className="w-full rounded-2xl border-2 border-primary/40 bg-primary/5 text-primary font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/10 disabled:opacity-50 transition-colors active:scale-[0.98]"
              style={{ height: '48px' }}
            >
              {issuing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
              Re-send Invoice to Customer
            </button>
          )}

          {/* Print / Share */}
          <button
            onClick={() => setShowModal(true)}
            className="w-full rounded-2xl border border-border/60 bg-muted/30 font-bold text-sm flex items-center justify-center gap-2 hover:bg-muted transition-colors active:scale-[0.98]"
            style={{ height: '52px' }}
          >
            <Printer className="h-4 w-4" />
            Print / Share Invoice
          </button>

        </div>
      </div>

      {/* Mark paid dialog */}
      {showPaid && (
        <MarkPaidDialog
          invoiceNumber={invoice.invoiceNumber}
          totalAmount={invoice.totalAmount}
          onConfirm={handleMarkPaid}
          onCancel={() => setShowPaid(false)}
          loading={payLoading}
        />
      )}

      {/* Invoice modal — print / PDF / WhatsApp / email */}
      {showModal && templateData && settings && (
        <InvoiceModal
          open={showModal}
          onClose={() => setShowModal(false)}
          settings={settings}
          data={templateData}
          mode="invoice"
          customerPhone={invoice.customerPhone}
        />
      )}
    </AccountsLayout>
  );
};

export default InvoiceDetailPage;
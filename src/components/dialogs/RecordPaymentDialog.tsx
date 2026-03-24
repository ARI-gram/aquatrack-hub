/**
 * RecordPaymentDialog
 * src/components/dialogs/RecordPaymentDialog.tsx
 *
 * Two modes:
 *  - mode="bulk"   → customer pays a lump sum, system allocates oldest first
 *  - mode="single" → pay against one specific invoice
 *
 * Usage (bulk):
 *   <RecordPaymentDialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onSuccess={refreshData}
 *     mode="bulk"
 *     customer={{ id, fullName, phoneNumber, outstandingBalance }}
 *   />
 *
 * Usage (single invoice):
 *   <RecordPaymentDialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onSuccess={refreshData}
 *     mode="single"
 *     invoice={invoice}
 *     customer={{ id, fullName, phoneNumber, outstandingBalance }}
 *   />
 */

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  X, CheckCircle2, Loader2, Banknote,
  Smartphone, Building, ChevronsRight,
  AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  paymentService,
  type BulkPaymentResponse,
  type PaymentAllocation,
} from '@/api/services/payment.service';
import type { Invoice } from '@/types/accounting.types';

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentMethod = 'MPESA' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';

interface CustomerInfo {
  id:                 string;
  fullName:           string;
  phoneNumber:        string;
  outstandingBalance: number;
}

interface Props {
  open:       boolean;
  onClose:    () => void;
  onSuccess:  () => void;
  mode:       'bulk' | 'single';
  customer:   CustomerInfo;
  invoice?:   Invoice;  // required when mode = 'single'
}

// ── Payment method config ─────────────────────────────────────────────────────

const PAYMENT_METHODS: {
  key:   PaymentMethod;
  label: string;
  icon:  React.ReactNode;
  hint:  string;
}[] = [
  {
    key:   'MPESA',
    label: 'M-Pesa',
    icon:  <Smartphone className="h-4 w-4" />,
    hint:  'Enter M-Pesa confirmation code',
  },
  {
    key:   'CASH',
    label: 'Cash',
    icon:  <Banknote className="h-4 w-4" />,
    hint:  'Cash received in hand',
  },
  {
    key:   'BANK_TRANSFER',
    label: 'Bank Transfer',
    icon:  <Building className="h-4 w-4" />,
    hint:  'Enter bank reference number',
  },
  {
    key:   'CHEQUE',
    label: 'Cheque',
    icon:  <ChevronsRight className="h-4 w-4" />,
    hint:  'Enter cheque number',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Success screen ────────────────────────────────────────────────────────────

const SuccessScreen: React.FC<{
  result:   BulkPaymentResponse | null;
  amount:   number;
  onClose:  () => void;
}> = ({ result, amount, onClose }) => {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="space-y-5 pb-4">
      {/* Success badge */}
      <div className="flex flex-col items-center gap-3 pt-4 pb-2">
        <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
        </div>
        <div className="text-center">
          <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">
            {fmtMoney(amount)}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">Payment recorded successfully</p>
        </div>
      </div>

      {/* Allocation summary */}
      {result && (
        <div className="rounded-2xl border border-border/60 bg-muted/20 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-bold">
                {result.invoicesPaid} invoice{result.invoicesPaid !== 1 ? 's' : ''} fully paid
                {result.invoicesPartial > 0 && `, ${result.invoicesPartial} partial`}
              </p>
              {result.remainingBalance > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                  Remaining balance: {fmtMoney(result.remainingBalance)}
                </p>
              )}
              {result.remainingBalance === 0 && (
                <p className="text-xs text-emerald-600 font-semibold">
                  Account fully cleared 🎉
                </p>
              )}
            </div>
            <button
              onClick={() => setShowDetail(s => !s)}
              className="flex items-center gap-1 text-xs text-primary font-semibold"
            >
              Details
              {showDetail
                ? <ChevronUp   className="h-3.5 w-3.5" />
                : <ChevronDown className="h-3.5 w-3.5" />
              }
            </button>
          </div>

          {showDetail && (
            <div className="border-t border-border/40 divide-y divide-border/30">
              {result.allocations.map(a => (
                <div key={a.invoiceId} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono font-bold">{a.invoiceNumber}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Applied: {fmtMoney(a.applied)}
                    </p>
                  </div>
                  <div className="text-right">
                    {a.status === 'PAID' ? (
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                        PAID
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                        {fmtMoney(a.balanceDue)} left
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors active:scale-[0.98]"
      >
        Done
      </button>
    </div>
  );
};

// ── Main dialog ───────────────────────────────────────────────────────────────

export const RecordPaymentDialog: React.FC<Props> = ({
  open,
  onClose,
  onSuccess,
  mode,
  customer,
  invoice,
}) => {
  const [amount,    setAmount]    = useState('');
  const [method,    setMethod]    = useState<PaymentMethod>('MPESA');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result,    setResult]    = useState<BulkPaymentResponse | null>(null);
  const [success,   setSuccess]   = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setAmount('');
      setMethod('MPESA');
      setReference('');
      setResult(null);
      setSuccess(false);
      // Pre-fill with outstanding balance for bulk, or balance_due for single
      if (mode === 'bulk') {
        setAmount(customer.outstandingBalance.toFixed(2));
      } else if (invoice) {
        const due = Number(invoice.totalAmount) - Number(invoice.amountPaid ?? 0);
        setAmount(due.toFixed(2));
      }
    }
  }, [open, mode, customer, invoice]);

  const maxAmount = mode === 'bulk'
    ? customer.outstandingBalance
    : invoice
      ? Number(invoice.totalAmount) - Number(invoice.amountPaid ?? 0)
      : 0;

  const parsedAmount = parseFloat(amount) || 0;
  const isValid      = parsedAmount > 0 && parsedAmount <= maxAmount;
  const needsRef     = (method as string) !== 'CASH';

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      if (mode === 'bulk') {
        const res = await paymentService.bulkPayment({
          customer_id:        customer.id,
          amount_paid:        parsedAmount,
          payment_method:     method,
          payment_reference:  reference.trim() || undefined,
        });
        setResult(res);
        setSuccess(true);
        onSuccess();
        toast.success(res.message);
      } else if (invoice) {
        await paymentService.recordPayment(invoice.id, {
          amount_paid:       parsedAmount,
          payment_method:    method,
          payment_reference: reference.trim() || undefined,
        });
        setSuccess(true);
        onSuccess();
        toast.success('Payment recorded successfully');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Failed to record payment';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setResult(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Sheet */}
      <div className="relative mt-auto w-full max-w-lg mx-auto bg-background rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 shrink-0">
          <div>
            <p className="font-bold text-base">
              {success ? 'Payment Recorded' : 'Record Payment'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {customer.fullName}
              {!success && customer.outstandingBalance > 0 && (
                <span className="ml-1.5 text-amber-600 font-semibold">
                  · owes {fmtMoney(customer.outstandingBalance)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {success ? (
            <SuccessScreen
              result={result}
              amount={parsedAmount}
              onClose={handleClose}
            />
          ) : (
            <div className="space-y-5 pb-6">

              {/* Invoice info — single mode */}
              {mode === 'single' && invoice && (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-mono text-xs font-bold">{invoice.invoiceNumber}</p>
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      invoice.status === 'OVERDUE'
                        ? 'bg-red-50 text-red-600 dark:bg-red-950/30'
                        : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30',
                    )}>
                      {invoice.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                      <p className="font-bold text-sm">{fmtMoney(Number(invoice.totalAmount))}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Paid</p>
                      <p className="font-bold text-sm text-emerald-600">
                        {fmtMoney(Number(invoice.amountPaid ?? 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Balance</p>
                      <p className="font-bold text-sm text-amber-600">
                        {fmtMoney(maxAmount)}
                      </p>
                    </div>
                  </div>
                  {invoice.dueDate && (
                    <p className={cn(
                      'text-[11px] font-semibold text-center mt-2',
                      invoice.status === 'OVERDUE' ? 'text-red-500' : 'text-muted-foreground',
                    )}>
                      Due: {format(new Date(invoice.dueDate), 'd MMM yyyy')}
                    </p>
                  )}
                </div>
              )}

              {/* Bulk mode header */}
              {mode === 'bulk' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">
                    Outstanding Balance
                  </p>
                  <p className="text-2xl font-black text-amber-800 dark:text-amber-200 tabular-nums">
                    {fmtMoney(customer.outstandingBalance)}
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    Payment will be applied oldest invoices first
                  </p>
                </div>
              )}

              {/* Amount input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Amount Received (KES)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                    KES
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    min={0.01}
                    max={maxAmount}
                    step={0.01}
                    className={cn(
                      'w-full h-14 pl-14 pr-4 rounded-2xl border-2 text-xl font-black tabular-nums focus:outline-none transition-colors',
                      parsedAmount > maxAmount
                        ? 'border-red-300 bg-red-50 dark:bg-red-950/20 text-red-700'
                        : parsedAmount > 0
                          ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                          : 'border-border/60 bg-muted/30 focus:border-primary/40',
                    )}
                  />
                </div>

                {/* Quick fill buttons */}
                <div className="flex gap-2">
                  {[0.25, 0.5, 0.75, 1].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setAmount((maxAmount * pct).toFixed(2))}
                      className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-muted/50 hover:bg-muted transition-colors active:scale-[0.97]"
                    >
                      {pct === 1 ? 'Full' : `${pct * 100}%`}
                    </button>
                  ))}
                </div>

                {parsedAmount > maxAmount && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-xs font-semibold text-red-700">
                      Amount exceeds the outstanding balance of {fmtMoney(maxAmount)}
                    </p>
                  </div>
                )}
              </div>

              {/* Payment method selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(pm => (
                    <button
                      key={pm.key}
                      onClick={() => setMethod(pm.key)}
                      className={cn(
                        'flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-[0.97] text-left',
                        method === pm.key
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-border',
                      )}
                    >
                      <span className={cn(
                        'h-8 w-8 rounded-xl flex items-center justify-center shrink-0',
                        method === pm.key ? 'bg-primary/10' : 'bg-muted/50',
                      )}>
                        {pm.icon}
                      </span>
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Reference / Code
                  {!needsRef && (
                    <span className="ml-1.5 normal-case font-normal text-muted-foreground/50">
                      (optional for cash)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder={
                    method === 'MPESA'         ? 'e.g. QHJ7K9X1P2' :
                    method === 'BANK_TRANSFER' ? 'e.g. REF-20260319' :
                    method === 'CHEQUE'        ? 'e.g. CHQ-001234' :
                    'Receipt or note number'
                  }
                  className="w-full h-11 px-4 rounded-xl border border-border/60 bg-muted/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!isValid || submitting || ((method as string) !== 'CASH' && !reference.trim())}
                className="w-full h-14 rounded-2xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Recording payment…</>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Record {parsedAmount > 0 ? fmtMoney(parsedAmount) : 'Payment'}
                  </>
                )}
              </button>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordPaymentDialog;
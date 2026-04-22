/**
 * Customer Detail Page
 * src/pages/client/CustomerDetailPage.tsx
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, Phone, Mail, Calendar, Wallet, Package, CreditCard,
  MapPin, ShoppingBag, Loader2, Lock, AlertTriangle, CheckCircle2,
  Clock, FileText, RefreshCw, Banknote, TrendingUp,
  Trash2, ArchiveX, Info, ChevronDown, ChevronUp, ShieldAlert,
  Eye, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  customerAdminService,
  AdminCustomer,
  CustomerInvoice,
  InvoicePaymentMethod,
  BillingCycle,
} from '@/api/services/customerAdmin.service';
import axiosInstance from '@/api/axios.config';
import { API_ENDPOINTS } from '@/api/endpoints';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount?: string;
  total?: string;
  created_at: string;
}

interface WalletTransaction {
  id: string;
  description?: string;
  transaction_type: string;
  amount: string;
  created_at: string;
}

interface WalletData {
  balance?: string;
  total_topped_up?: string;
  total_spent?: string;
  transactions?: WalletTransaction[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const UNPAID_STATUSES = new Set(['DRAFT', 'ISSUED', 'OVERDUE']);

const fmt = (v: string | number) =>
  `KES ${parseFloat(String(v)).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) : '—';

const TABS = ['Overview', 'Orders', 'Wallet', 'Credit & Invoices'] as const;
type Tab = typeof TABS[number];

const BILLING_CYCLES: { value: BillingCycle; label: string; hint: string }[] = [
  { value: 'IMMEDIATE', label: 'Per Order',  hint: 'Invoice generated for each order individually' },
  { value: 'WEEKLY',    label: 'Weekly',     hint: 'Invoiced every Monday for the prior week' },
  { value: 'BIWEEKLY',  label: 'Bi-Weekly',  hint: 'Invoiced on the 1st and 15th of each month' },
  { value: 'MONTHLY',   label: 'Monthly',    hint: 'Invoiced on the 1st of each month' },
];

const PAYMENT_METHODS_LIST: InvoicePaymentMethod[] = ['MPESA', 'CASH', 'BANK_TRANSFER', 'CHEQUE'];

// ── StatCard ──────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string;
}> = ({ icon, label, value, sub, color = 'text-foreground' }) => (
  <Card className="border-border/50">
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold truncate ${color}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

// ── InvoiceStatusBadge ────────────────────────────────────────────────────────

const InvoiceStatusBadge: React.FC<{ status: string; isOverdue: boolean }> = ({ status, isOverdue }) => {
  if (isOverdue && status !== 'PAID') return <Badge variant="destructive">Overdue</Badge>;
  const map: Record<string, { variant: 'secondary' | 'warning' | 'success' | 'destructive' | 'info'; label: string }> = {
    DRAFT:     { variant: 'secondary',   label: 'Draft' },
    ISSUED:    { variant: 'warning',     label: 'Issued' },
    PAID:      { variant: 'success',     label: 'Paid' },
    OVERDUE:   { variant: 'destructive', label: 'Overdue' },
    CANCELLED: { variant: 'secondary',   label: 'Cancelled' },
  };
  const cfg = map[status] ?? { variant: 'secondary', label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

// ── PaymentMethodPicker (shared) ──────────────────────────────────────────────

const PaymentMethodPicker: React.FC<{
  value: InvoicePaymentMethod;
  onChange: (m: InvoicePaymentMethod) => void;
}> = ({ value, onChange }) => (
  <div className="grid grid-cols-2 gap-2">
    {PAYMENT_METHODS_LIST.map(m => (
      <button
        key={m}
        type="button"
        onClick={() => onChange(m)}
        className={cn(
          'py-2.5 rounded-xl text-sm font-semibold border-2 transition-all active:scale-[0.97]',
          value === m
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border/60 bg-muted/30 text-muted-foreground hover:border-border',
        )}
      >
        {m === 'BANK_TRANSFER' ? 'Bank' : m === 'MPESA' ? 'M-Pesa' : m.charAt(0) + m.slice(1).toLowerCase()}
      </button>
    ))}
  </div>
);

// ── MarkPaidDialog ────────────────────────────────────────────────────────────

const MarkPaidDialog: React.FC<{
  invoice: CustomerInvoice | null;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ invoice, onClose, onSuccess }) => {
  const { toast }             = useToast();
  const [method, setMethod]   = useState<InvoicePaymentMethod>('CHEQUE');
  const [ref, setRef]         = useState('');
  const [loading, setLoading] = useState(false);

  // Reset on open
  useEffect(() => {
    if (invoice) { setMethod('CHEQUE'); setRef(''); }
  }, [invoice]);

  if (!invoice) return null;

  const handle = async () => {
    setLoading(true);
    try {
      await customerAdminService.markInvoicePaid(invoice.id, {
        payment_method: method, payment_reference: ref,
      });
      toast({ title: `Invoice ${invoice.invoice_number} marked as paid.` });
      onSuccess();
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to mark invoice paid.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Invoice Paid</DialogTitle>
          <DialogDescription>
            {invoice.invoice_number} · {fmt(invoice.total_amount)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <PaymentMethodPicker value={method} onChange={setMethod} />
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Reference {method === 'MPESA' ? '(M-Pesa code)' : '(optional)'}
            </Label>
            <Input
              placeholder={method === 'MPESA' ? 'e.g. QJK3HY789' : 'Cheque no. / bank ref…'}
              value={ref}
              onChange={e => setRef(e.target.value.toUpperCase())}
              className="font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            onClick={handle}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── PayAllDialog ──────────────────────────────────────────────────────────────

const PayAllDialog: React.FC<{
  open:         boolean;
  invoices:     CustomerInvoice[];
  customerName: string;
  onClose:      () => void;
  onSuccess:    () => void;
}> = ({ open, invoices, customerName, onClose, onSuccess }) => {
  const { toast }             = useToast();
  const [method, setMethod]   = useState<InvoicePaymentMethod>('CHEQUE');
  const [ref, setRef]         = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) { setMethod('CHEQUE'); setRef(''); }
  }, [open]);

  const unpaid      = invoices.filter(i => UNPAID_STATUSES.has(i.status));
  const totalUnpaid = unpaid.reduce((s, i) => s + parseFloat(String(i.total_amount)), 0);

  const handle = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        unpaid.map(inv =>
          customerAdminService.markInvoicePaid(inv.id, {
            payment_method: method,
            payment_reference: ref || undefined,
          })
        )
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed    = results.length - succeeded;

      onSuccess();
      onClose();

      if (failed === 0) {
        toast({ title: `All ${succeeded} invoices marked as paid for ${customerName}.` });
      } else {
        toast({
          title: `${succeeded} paid, ${failed} failed`,
          description: 'Check individual invoices for details.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to process payments.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay All Unpaid Invoices</DialogTitle>
          <DialogDescription>
            {customerName} · {unpaid.length} invoice{unpaid.length !== 1 ? 's' : ''} · {fmt(totalUnpaid)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Warning banner */}
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              This will mark <strong>all {unpaid.length} unpaid invoices</strong> as paid using
              the same payment method and reference.
            </p>
          </div>

          <PaymentMethodPicker value={method} onChange={setMethod} />

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Reference {method === 'MPESA' ? '(M-Pesa code)' : '(optional)'}
            </Label>
            <Input
              placeholder={method === 'MPESA' ? 'e.g. QJK3HY789' : 'Ref number…'}
              value={ref}
              onChange={e => setRef(e.target.value.toUpperCase())}
              className="font-mono"
            />
          </div>

          {/* Invoice list summary */}
          <div className="rounded-lg border border-border/60 divide-y divide-border/40 max-h-48 overflow-y-auto">
            {unpaid.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="font-mono text-muted-foreground">{inv.invoice_number}</span>
                <span className="font-semibold">{fmt(inv.total_amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            onClick={handle}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <CheckCircle2 className="mr-2 h-4 w-4" />
            }
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── EnableCreditDialog ────────────────────────────────────────────────────────

const EnableCreditDialog: React.FC<{
  open: boolean;
  customerId: string;
  customerName: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ open, customerId, customerName, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [creditLimit, setCreditLimit]   = useState('');
  const [dueDays, setDueDays]           = useState('30');
  const [graceDays, setGraceDays]       = useState('7');
  const [notes, setNotes]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [showInfo, setShowInfo]         = useState(true);

  useEffect(() => {
    if (open) {
      setBillingCycle('MONTHLY');
      setCreditLimit('');
      setDueDays('30');
      setGraceDays('7');
      setNotes('');
      setShowInfo(true);
    }
  }, [open]);

  const handleSave = async () => {
    const limit = parseFloat(creditLimit);
    if (!creditLimit || isNaN(limit) || limit <= 0) {
      toast({ title: 'Credit limit must be greater than 0', variant: 'destructive' }); return;
    }
    const due = parseInt(dueDays, 10);
    if (isNaN(due) || due < 1 || due > 365) {
      toast({ title: 'Payment due days must be between 1 and 365', variant: 'destructive' }); return;
    }
    const grace = parseInt(graceDays, 10);
    if (isNaN(grace) || grace < 0) {
      toast({ title: 'Grace period days must be 0 or more', variant: 'destructive' }); return;
    }
    setLoading(true);
    try {
      await customerAdminService.setCreditTerms(customerId, {
        billing_cycle:     billingCycle,
        credit_limit:      limit.toFixed(2),
        payment_due_days:  due,
        grace_period_days: grace,
        notes,
      });
      toast({ title: 'Credit account enabled!', description: `${customerName} can now order on credit.` });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err as { response?: { data?: { non_field_errors?: string[] } } })
          ?.response?.data?.non_field_errors?.[0] ??
        'Failed to enable credit account. Please try again.';
      toast({ title: 'Error', description: String(msg), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const limitNum = parseFloat(creditLimit) || 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-purple-600" />
            Enable Credit Account
          </DialogTitle>
          <DialogDescription>
            Set up a credit account for{' '}
            <span className="font-semibold text-foreground">{customerName}</span>.
            They will be able to order without upfront payment and receive periodic invoices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <button
            type="button"
            onClick={() => setShowInfo(v => !v)}
            className="w-full flex items-start gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-left"
          >
            <Info className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-purple-800 dark:text-purple-300 font-medium">How credit accounts work</p>
              {showInfo && (
                <p className="text-xs text-purple-700 dark:text-purple-400 mt-1 leading-relaxed">
                  Credit customers place orders without wallet balance. Orders accumulate against their
                  credit limit. You invoice them on your chosen cycle; they settle by cheque, bank
                  transfer, or cash. Accounts freeze automatically if payment is overdue past the grace period.
                </p>
              )}
            </div>
            {showInfo
              ? <ChevronUp className="h-3.5 w-3.5 text-purple-600 shrink-0" />
              : <ChevronDown className="h-3.5 w-3.5 text-purple-600 shrink-0" />
            }
          </button>

          <div className="space-y-2">
            <Label>Billing Cycle <span className="text-destructive">*</span></Label>
            <Select value={billingCycle} onValueChange={v => setBillingCycle(v as BillingCycle)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BILLING_CYCLES.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Credit Limit (KES) <span className="text-destructive">*</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">KES</span>
                <Input
                  type="number" min={0} step={500} placeholder="5000"
                  className="pl-12" value={creditLimit}
                  onChange={e => setCreditLimit(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">Max unpaid balance</p>
            </div>
            <div className="space-y-2">
              <Label>Payment Due (days) <span className="text-destructive">*</span></Label>
              <Input
                type="number" min={1} max={365} placeholder="30"
                value={dueDays} onChange={e => setDueDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Days until overdue</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Grace Period (days)</Label>
            <Input
              type="number" min={0} max={60} placeholder="7"
              value={graceDays} onChange={e => setGraceDays(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Extra days after due date before account freezes (0 = freeze immediately on due date)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              placeholder="e.g. Pays by cheque end of month. Contact Finance on +254…"
              rows={2} value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {limitNum > 0 && (
            <div className="p-3 rounded-lg bg-muted/60 border border-border/60 text-sm space-y-1.5">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">Summary</p>
              {[
                ['Credit Limit',  fmt(limitNum)],
                ['Billing Cycle', BILLING_CYCLES.find(c => c.value === billingCycle)?.label ?? billingCycle],
                ['Payment Due',   `${dueDays} days after invoice`],
                ['Grace Period',  `${graceDays} days`],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white">
            {loading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enabling…</>
              : <><CreditCard className="mr-2 h-4 w-4" />Enable Credit Account</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── DangerActionDialog ────────────────────────────────────────────────────────

const DangerActionDialog: React.FC<{
  open: boolean;
  variant: 'temporary' | 'permanent';
  customerName: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}> = ({ open, variant, customerName, onClose, onConfirm }) => {
  const [reason, setReason]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) { setReason(''); setConfirm(''); }
  }, [open]);

  const isPermanent  = variant === 'permanent';
  const CONFIRM_WORD = 'DELETE';
  const canSubmit    = reason.trim().length >= 5 && (!isPermanent || confirm === CONFIRM_WORD);

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try { await onConfirm(reason.trim()); onClose(); }
    catch { /* parent toasts */ }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isPermanent ? 'text-red-600' : 'text-amber-600'}`}>
            {isPermanent
              ? <><Trash2 className="h-5 w-5" />Permanently Delete Customer</>
              : <><ArchiveX className="h-5 w-5" />Move to Recycle Bin</>
            }
          </DialogTitle>
          <DialogDescription className="pt-1">
            {isPermanent ? (
              <>This action <span className="font-semibold text-red-600">cannot be undone</span>. All data for{' '}
              <span className="font-semibold text-foreground">{customerName}</span>{' '}
              — orders, wallet, invoices, history — will be permanently erased.</>
            ) : (
              <><span className="font-semibold text-foreground">{customerName}</span>{' '}
              will be hidden from all active lists and their login suspended.
              Fully restorable from the Recycle Bin.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className={cn('flex items-start gap-3 p-3 rounded-lg border', isPermanent
            ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
            : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
          )}>
            <ShieldAlert className={cn('h-4 w-4 shrink-0 mt-0.5', isPermanent ? 'text-red-600' : 'text-amber-600')} />
            <p className={cn('text-xs', isPermanent ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400')}>
              {isPermanent
                ? 'Deletes the customer account and ALL associated records. Irreversible.'
                : 'Customer loses access immediately. Data is preserved and fully restorable.'
              }
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              Reason <span className="text-destructive">*</span>
              <span className="text-muted-foreground font-normal ml-1">(min. 5 characters)</span>
            </Label>
            <Textarea
              placeholder={isPermanent
                ? 'e.g. Duplicate account, customer requested full data removal…'
                : 'e.g. Customer relocated, seasonal account, awaiting review…'
              }
              rows={3} value={reason}
              onChange={e => setReason(e.target.value.slice(0, 500))}
            />
            <p className="text-xs text-muted-foreground">{reason.trim().length}/500</p>
          </div>

          {isPermanent && (
            <div className="space-y-2">
              <Label>
                Type <span className="font-mono font-bold text-red-600">{CONFIRM_WORD}</span> to confirm
              </Label>
              <Input
                placeholder={CONFIRM_WORD} value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className={cn('font-mono', confirm === CONFIRM_WORD && 'border-red-400 focus-visible:ring-red-400')}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            disabled={!canSubmit || loading} onClick={handleConfirm}
            className={isPermanent ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}
          >
            {loading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : isPermanent ? <Trash2 className="mr-2 h-4 w-4" /> : <ArchiveX className="mr-2 h-4 w-4" />
            }
            {loading ? 'Processing…' : isPermanent ? 'Permanently Delete' : 'Move to Recycle Bin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── DangerZone ────────────────────────────────────────────────────────────────

const DangerZone: React.FC<{
  customer: AdminCustomer;
  onTemporaryDelete: (reason: string) => Promise<void>;
  onPermanentDelete: (reason: string) => Promise<void>;
}> = ({ customer, onTemporaryDelete, onPermanentDelete }) => {
  const [showTemp, setShowTemp] = useState(false);
  const [showPerm, setShowPerm] = useState(false);

  return (
    <>
      <div className="mt-8 rounded-xl border-2 border-red-200 dark:border-red-900 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900">
          <ShieldAlert className="h-4 w-4 text-red-600" />
          <span className="font-semibold text-red-700 dark:text-red-400 text-sm tracking-wide uppercase">Danger Zone</span>
        </div>
        <div className="divide-y divide-red-100 dark:divide-red-900/60 bg-white dark:bg-background">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 mt-0.5">
                <ArchiveX className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-sm">Move to Recycle Bin</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                  Hides the customer and suspends their login. All data is preserved and fully restorable.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 shrink-0"
              onClick={() => setShowTemp(true)}>
              <ArchiveX className="mr-2 h-3.5 w-3.5" />Move to Bin
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 mt-0.5">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-red-700 dark:text-red-400">Permanently Delete</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                  Irreversibly erases <span className="font-semibold">{customer.full_name}</span> and all associated records. Cannot be undone.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm"
              className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 shrink-0"
              onClick={() => setShowPerm(true)}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />Delete Forever
            </Button>
          </div>
        </div>
      </div>

      <DangerActionDialog
        open={showTemp} variant="temporary" customerName={customer.full_name}
        onClose={() => setShowTemp(false)} onConfirm={onTemporaryDelete}
      />
      <DangerActionDialog
        open={showPerm} variant="permanent" customerName={customer.full_name}
        onClose={() => setShowPerm(false)} onConfirm={onPermanentDelete}
      />
    </>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export const CustomerDetailPage: React.FC = () => {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { toast } = useToast();

  const [customer, setCustomer]     = useState<AdminCustomer | null>(null);
  const [activeTab, setActiveTab]   = useState<Tab>('Overview');
  const [loading, setLoading]       = useState(true);
  const [orders, setOrders]         = useState<CustomerOrder[]>([]);
  const [wallet, setWallet]         = useState<WalletData | null>(null);
  const [invoices, setInvoices]     = useState<CustomerInvoice[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  const [markPaidInvoice, setMarkPaidInvoice]     = useState<CustomerInvoice | null>(null);
  const [showPayAll, setShowPayAll]               = useState(false);
  const [issuingId, setIssuingId]                 = useState<string | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [showEnableCredit, setShowEnableCredit]   = useState(false);

  // ── Load customer ─────────────────────────────────────────────────────────

  const loadCustomer = useCallback(async () => {
    if (!id) return;
    try {
      const data = await customerAdminService.getCustomer(id);
      setCustomer(data);
    } catch {
      toast({ title: 'Error', description: 'Customer not found.', variant: 'destructive' });
      navigate('/customers');
    } finally { setLoading(false); }
  }, [id, navigate, toast]);

  useEffect(() => { loadCustomer(); }, [loadCustomer]);

  // ── Load tab data ─────────────────────────────────────────────────────────

  const reloadInvoices = useCallback(async () => {
    if (!id) return;
    const data = await customerAdminService.getCustomerInvoices(id);
    setInvoices(data);
  }, [id]);

  useEffect(() => {
    if (!id || !customer) return;
    const load = async () => {
      setTabLoading(true);
      try {
        if (activeTab === 'Orders') {
          const r = await axiosInstance.get('/orders/all/', { params: { customer_id: id } });
          setOrders(Array.isArray(r.data) ? r.data : (r.data.results ?? r.data.data ?? []));
        } else if (activeTab === 'Wallet') {
          const r = await axiosInstance.get<WalletData>(API_ENDPOINTS.CUSTOMERS.WALLET(id));
          setWallet(r.data);
        } else if (activeTab === 'Credit & Invoices') {
          await reloadInvoices();
        }
      } catch {
        // silently fail — empty state shown in each tab
      } finally { setTabLoading(false); }
    };
    load();
  }, [activeTab, id, customer, reloadInvoices]);

  // ── Invoice actions ───────────────────────────────────────────────────────

  const handleIssue = async (invoice: CustomerInvoice) => {
    setIssuingId(invoice.id);
    try {
      await customerAdminService.issueInvoice(invoice.id);
      toast({ title: `Invoice ${invoice.invoice_number} issued & emailed.` });
      await reloadInvoices();
    } catch {
      toast({ title: 'Error', description: 'Failed to issue invoice.', variant: 'destructive' });
    } finally { setIssuingId(null); }
  };

  const handleGenerate = async () => {
    setGeneratingInvoice(true);
    try {
      await customerAdminService.generateInvoice(id!);
      toast({ title: 'Invoice generated.' });
      await reloadInvoices();
    } catch {
      toast({ title: 'Error', description: 'No unbilled orders found.', variant: 'destructive' });
    } finally { setGeneratingInvoice(false); }
  };

  // ── Danger zone ───────────────────────────────────────────────────────────

  const handleTemporaryDelete = async (reason: string) => {
    try {
      await axiosInstance.post(`/customers/${id}/soft-delete/`, { reason });
      toast({ title: 'Moved to Recycle Bin', description: `${customer?.full_name} has been archived.` });
      navigate('/customers');
    } catch {
      toast({ title: 'Error', description: 'Failed to archive customer.', variant: 'destructive' });
      throw new Error('failed');
    }
  };

  const handlePermanentDelete = async (reason: string) => {
    try {
      await axiosInstance.post(`/customers/${id}/delete-permanent/`, { reason });
      toast({ title: 'Customer permanently deleted.' });
      navigate('/customers');
    } catch {
      toast({ title: 'Error', description: 'Failed to permanently delete customer.', variant: 'destructive' });
      throw new Error('failed');
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout title="Customer" subtitle="">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }
  if (!customer) return null;

  const ct = customer.credit_terms;

  // Derived invoice stats (used in Credit & Invoices tab)
  const unpaidInvoices  = invoices.filter(i => UNPAID_STATUSES.has(i.status));
  const totalUnpaid     = unpaidInvoices.reduce((s, i) => s + parseFloat(String(i.total_amount)), 0);
  const hasOverdueInvs  = invoices.some(i => i.is_overdue && i.status !== 'PAID');

  const CreditChip = () => {
    if (!ct) return null;
    if (ct.account_frozen)
      return <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" /> Frozen</Badge>;
    if (ct.is_in_grace_period)
      return <Badge variant="warning" className="gap-1"><AlertTriangle className="h-3 w-3" /> Overdue · {ct.grace_days_remaining}d left</Badge>;
    return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Credit OK</Badge>;
  };

  return (
    <DashboardLayout title={customer.full_name} subtitle={customer.phone_number}>

      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Customers
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
              {customer.full_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{customer.full_name}</h1>
              <Badge variant={customer.status === 'ACTIVE' ? 'success' : 'destructive'}>{customer.status_display}</Badge>
              <Badge variant={customer.customer_type === 'REFILL' ? 'info' : 'secondary'}>{customer.customer_type_display}</Badge>
              {!customer.is_registered && (
                <Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" /> Invite Pending</Badge>
              )}
              <CreditChip />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{customer.phone_number}</span>
              {customer.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{customer.email}</span>}
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Joined {fmtDate(customer.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ────────────────────────────────────────────────────── */}
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<ShoppingBag className="h-4 w-4 text-primary" />} label="Total Orders" value={String(customer.total_orders)} sub={`Last: ${fmtDate(customer.last_order_date)}`} />
            <StatCard icon={<Wallet className="h-4 w-4 text-success" />} label="Wallet Balance" value={fmt(customer.wallet_balance)} color="text-success" />
            {ct && <>
              <StatCard icon={<CreditCard className="h-4 w-4 text-purple-600" />} label="Credit Limit" value={fmt(ct.credit_limit)} sub={ct.billing_cycle_display} />
              <StatCard icon={<TrendingUp className="h-4 w-4 text-amber-600" />} label="Outstanding" value={fmt(ct.outstanding_balance)} color={parseFloat(ct.outstanding_balance) > 0 ? 'text-amber-600' : 'text-foreground'} sub={`Available: ${fmt(ct.available_credit)}`} />
            </>}
          </div>

          {ct?.account_frozen && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <Lock className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Account Frozen</p>
                <p className="text-sm text-red-700">Outstanding: {fmt(ct.outstanding_balance)}. Mark invoices as paid to unfreeze.</p>
              </div>
            </div>
          )}
          {!ct?.account_frozen && ct?.is_in_grace_period && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">In Grace Period</p>
                <p className="text-sm text-amber-700">Ends {fmtDate(ct.grace_until)} ({ct.grace_days_remaining} days remaining).</p>
              </div>
            </div>
          )}

          <Card className="border-border/50">
            <CardContent className="p-5">
              <h3 className="font-semibold mb-4">Account Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {([
                  ['Phone',      customer.phone_number],
                  ['Email',      customer.email ?? '—'],
                  ['Type',       customer.customer_type_display],
                  ['Status',     customer.status_display],
                  ['Registered', customer.is_registered ? 'Yes' : 'Invite pending'],
                  ['Last Login', fmtDate(customer.last_login)],
                  ['Joined',     fmtDate(customer.created_at)],
                  ['Last Order', fmtDate(customer.last_order_date)],
                ] as [string, string][]).map(([label, val]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-border/40 last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{val}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <DangerZone
            customer={customer}
            onTemporaryDelete={handleTemporaryDelete}
            onPermanentDelete={handlePermanentDelete}
          />
        </div>
      )}

      {/* ── ORDERS ──────────────────────────────────────────────────────── */}
      {activeTab === 'Orders' && (
        <Card className="border-border/50">
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4">Order History</h3>
            {tabLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {orders.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                    <div>
                      <p className="font-medium">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(order.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{fmt(order.total_amount ?? order.total ?? 0)}</span>
                      <Badge variant="secondary">{order.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── WALLET ──────────────────────────────────────────────────────── */}
      {activeTab === 'Wallet' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={<Wallet className="h-4 w-4 text-success" />} label="Current Balance" value={fmt(customer.wallet_balance)} color="text-success" />
            <StatCard icon={<TrendingUp className="h-4 w-4 text-primary" />} label="Total Topped Up" value={fmt(wallet?.total_topped_up ?? '0')} />
            <StatCard icon={<ShoppingBag className="h-4 w-4 text-amber-600" />} label="Total Spent" value={fmt(wallet?.total_spent ?? '0')} />
          </div>
          <Card className="border-border/50">
            <CardContent className="p-5">
              <h3 className="font-semibold mb-4">Recent Transactions</h3>
              {tabLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (wallet?.transactions ?? []).length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No transactions yet.</p>
              ) : (
                <div className="space-y-2">
                  {(wallet?.transactions ?? []).map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                      <div>
                        <p className="font-medium">{tx.description ?? tx.transaction_type}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(tx.created_at)}</p>
                      </div>
                      <span className={cn('font-semibold', parseFloat(tx.amount) >= 0 ? 'text-success' : 'text-destructive')}>
                        {parseFloat(tx.amount) >= 0 ? '+' : ''}{fmt(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── CREDIT & INVOICES ───────────────────────────────────────────── */}
      {activeTab === 'Credit & Invoices' && (
        <div className="space-y-6">
          {!ct ? (
            <Card className="border-border/50">
              <CardContent className="p-8">
                <div className="text-center max-w-sm mx-auto">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 mb-4">
                    <CreditCard className="h-7 w-7 text-purple-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">No Credit Account</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    This customer currently pays per order (wallet / cash / M-Pesa).
                    Set up a credit account so they can order on account and receive periodic invoices.
                  </p>
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white gap-2" onClick={() => setShowEnableCredit(true)}>
                    <CreditCard className="h-4 w-4" />Enable Credit Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── Credit Terms card ── */}
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Credit Terms</h3>
                    <CreditChip />
                  </div>
                  {ct.account_frozen && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200 mb-4">
                      <Lock className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">Account frozen — mark all outstanding invoices as paid to unfreeze.</p>
                    </div>
                  )}
                  {!ct.account_frozen && ct.is_in_grace_period && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-4">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-700">Grace period: {ct.grace_days_remaining} days remaining until {fmtDate(ct.grace_until)}.</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 text-sm">
                    {([
                      ['Billing Cycle',    ct.billing_cycle_display],
                      ['Credit Limit',     fmt(ct.credit_limit)],
                      ['Original Limit',   fmt(ct.original_credit_limit)],
                      ['Outstanding',      fmt(ct.outstanding_balance)],
                      ['Available Credit', fmt(ct.available_credit)],
                      ['Payment Due Days', `${ct.payment_due_days} days`],
                      ['Grace Period',     `${ct.grace_period_days} days`],
                    ] as [string, string][]).map(([label, val]) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-semibold mt-0.5">{val}</p>
                      </div>
                    ))}
                  </div>
                  {ct.notes && (
                    <p className="mt-4 text-sm text-muted-foreground border-t pt-3">Notes: {ct.notes}</p>
                  )}
                </CardContent>
              </Card>

              {/* ── Invoices card ── */}
              <Card className="border-border/50">
                <CardContent className="p-5">

                  {/* Header row */}
                  <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                    <div>
                      <h3 className="font-semibold">Invoices</h3>
                      {invoices.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {invoices.length} total
                          {unpaidInvoices.length > 0 && (
                            <span className={cn('ml-1.5 font-semibold', hasOverdueInvs ? 'text-red-600' : 'text-amber-600')}>
                              · {unpaidInvoices.length} unpaid
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Pay All — only when 2+ unpaid */}
                      {unpaidInvoices.length > 1 && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                          onClick={() => setShowPayAll(true)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Pay All ({unpaidInvoices.length})
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generatingInvoice}>
                        {generatingInvoice
                          ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                          : <FileText className="h-4 w-4 mr-1.5" />}
                        Generate
                      </Button>
                    </div>
                  </div>

                  {/* Unpaid summary banner */}
                  {!tabLoading && unpaidInvoices.length > 0 && (
                    <div className={cn(
                      'flex items-center justify-between gap-3 px-4 py-3 rounded-xl mb-4 border',
                      hasOverdueInvs
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                        : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900',
                    )}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AlertTriangle className={cn('h-4 w-4 shrink-0', hasOverdueInvs ? 'text-red-600' : 'text-amber-600')} />
                        <div>
                          <p className={cn('text-sm font-bold', hasOverdueInvs ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300')}>
                            {fmt(totalUnpaid)} outstanding
                          </p>
                          <p className={cn('text-xs', hasOverdueInvs ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                            {unpaidInvoices.length} unpaid invoice{unpaidInvoices.length !== 1 ? 's' : ''}
                            {hasOverdueInvs && ' · includes overdue'}
                          </p>
                        </div>
                      </div>
                      {/* Single unpaid — show pay shortcut in the banner */}
                      {unpaidInvoices.length === 1 && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 h-7 px-2.5 text-xs"
                          onClick={() => setMarkPaidInvoice(unpaidInvoices[0])}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Mark Paid
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Invoice list */}
                  {tabLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : invoices.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">No invoices yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {invoices.map(inv => {
                        const isUnpaid   = UNPAID_STATUSES.has(inv.status);
                        const isOverdue  = inv.is_overdue && inv.status !== 'PAID';
                        const isIssuing  = issuingId === inv.id;

                        return (
                          <div
                            key={inv.id}
                            className={cn(
                              'flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl gap-3 transition-colors',
                              isOverdue
                                ? 'border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/10'
                                : isUnpaid
                                  ? 'border-amber-200/70 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10'
                                  : 'border-border/60',
                            )}
                          >
                            {/* Left — info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                {/* Status dot */}
                                <div className={cn('h-2 w-2 rounded-full shrink-0',
                                  inv.status === 'PAID'   ? 'bg-emerald-500' :
                                  isOverdue               ? 'bg-red-500'     :
                                  inv.status === 'ISSUED' ? 'bg-blue-500'    : 'bg-border',
                                )} />
                                <p className="font-medium text-sm font-mono">{inv.invoice_number}</p>
                                <InvoiceStatusBadge status={inv.status} isOverdue={inv.is_overdue} />
                              </div>
                              <p className="text-xs text-muted-foreground pl-4">
                                {fmtDate(inv.period_start)} – {fmtDate(inv.period_end)}
                                {' · '}Due {fmtDate(inv.due_date)}
                                {' · '}{(inv.items ?? []).length} order{(inv.items ?? []).length !== 1 ? 's' : ''}
                                {inv.paid_at && (
                                  <span className="text-emerald-600 font-medium"> · Paid {fmtDate(inv.paid_at)}</span>
                                )}
                              </p>
                            </div>

                            {/* Right — amount + actions */}
                            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                              <span className="font-bold text-sm tabular-nums">{fmt(inv.total_amount)}</span>

                              {/* Issue — DRAFT only */}
                              {inv.status === 'DRAFT' && (
                                <Button
                                  variant="outline" size="sm"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={() => handleIssue(inv)}
                                  disabled={isIssuing}
                                >
                                  {isIssuing
                                    ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    : <Mail className="h-3 w-3 mr-1" />}
                                  Issue
                                </Button>
                              )}

                              {/* Pay — ISSUED or OVERDUE */}
                              {(inv.status === 'ISSUED' || inv.status === 'OVERDUE' || isOverdue) && inv.status !== 'PAID' && (
                                <Button
                                  size="sm"
                                  className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => setMarkPaidInvoice(inv)}
                                >
                                  <Banknote className="h-3 w-3 mr-1" />Pay
                                </Button>
                              )}

                              {/* Paid chip */}
                              {inv.status === 'PAID' && (
                                <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                                  <CheckCircle2 className="h-3.5 w-3.5" />Paid
                                </div>
                              )}

                              {/* View full invoice */}
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                                onClick={() => navigate(`/client/accounts/invoices/${inv.id}`)}
                                title="View full invoice"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                View
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      <MarkPaidDialog
        invoice={markPaidInvoice}
        onClose={() => setMarkPaidInvoice(null)}
        onSuccess={async () => {
          await reloadInvoices();
          await loadCustomer();
        }}
      />

      <PayAllDialog
        open={showPayAll}
        invoices={invoices}
        customerName={customer.full_name}
        onClose={() => setShowPayAll(false)}
        onSuccess={async () => {
          await reloadInvoices();
          await loadCustomer();
        }}
      />

      <EnableCreditDialog
        open={showEnableCredit}
        customerId={id!}
        customerName={customer.full_name}
        onClose={() => setShowEnableCredit(false)}
        onSuccess={async () => {
          await loadCustomer();
          setActiveTab('Credit & Invoices');
        }}
      />
    </DashboardLayout>
  );
};

export default CustomerDetailPage;
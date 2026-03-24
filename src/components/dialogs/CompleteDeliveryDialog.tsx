/**
 * src/components/dialogs/CompleteDeliveryDialog.tsx
 *
 * Mobile-first unified completion dialog.
 *
 * Changes in this revision:
 *  - Cash collection section now pre-fills with order total_amount.
 *  - Shows "Expected: KES X" label above the input.
 *  - Real-time indicator: Full Payment ✓ / Short by KES X / Overpaid by KES X.
 *  - Input border changes colour: emerald = exact, amber = short, blue = over.
 *  - "✓ Full amount" quick-fill button.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Loader2, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Package, MapPin, X, User, Check,
  Plus, Minus, Droplets, AlertTriangle, Layers,
  ShieldCheck, KeyRound, Grid3X3, RotateCcw, RefreshCw,
  PackageX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  BottomSheet, Field, TextInput, TextArea, PrimaryButton,
} from './shared';
import { deliveryService, type DriverDelivery } from '@/api/services/delivery.service';
import { parseSlot, buildGroups, type CustomerGroup } from '@/lib/deliveryUtils';
import type { DeliveryStockCheck } from '@/pages/driver/DeliveryQueuePage';
import { DeliveryReceiptModal } from '@/pages/driver/DeliveryReceiptModal';

export type { CustomerGroup } from '@/lib/deliveryUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = [
  'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS',
];

const STATUS_META: Record<string, { label: string; dot: string; pill: string }> = {
  ASSIGNED:    { label: 'New',         dot: 'bg-amber-400',  pill: 'bg-amber-50   text-amber-700   border-amber-200'   },
  ACCEPTED:    { label: 'Accepted',    dot: 'bg-sky-500',    pill: 'bg-sky-50     text-sky-700     border-sky-200'     },
  PICKED_UP:   { label: 'Picked Up',   dot: 'bg-violet-500', pill: 'bg-violet-50  text-violet-700  border-violet-200'  },
  EN_ROUTE:    { label: 'En Route',    dot: 'bg-blue-500',   pill: 'bg-blue-50    text-blue-700    border-blue-200'    },
  ARRIVED:     { label: 'Arrived',     dot: 'bg-teal-500',   pill: 'bg-teal-50    text-teal-700    border-teal-200'    },
  IN_PROGRESS: { label: 'In Progress', dot: 'bg-indigo-500', pill: 'bg-indigo-50  text-indigo-700  border-indigo-200'  },
};

const SHORT_REASONS = [
  'Customer not home',
  'Customer refused delivery',
  'Incorrect address',
  'Damaged bottles removed',
  'Insufficient payment',
  'Customer requested partial delivery',
  'Van ran out of stock',
  'Other (see notes)',
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Step =
  | { type: 'list' }
  | { type: 'single'; delivery: DriverDelivery }
  | { type: 'bulk';   group: CustomerGroup }
  | { type: 'otp';    deliveryId: string; onVerified: () => void; onBack: () => void };

export interface OrderItem {
  id:            string;
  product_id:    string;
  product_name:  string;
  product_unit:  'BOTTLES' | 'LITRES' | 'DOZENS' | string;
  is_returnable: boolean;
  quantity:      number;
}

interface ItemState {
  product_id:    string;
  product_name:  string;
  product_unit:  string;
  is_returnable: boolean;
  ordered_qty:   number;
  delivered_qty: number;
  collected_qty: number;
}

type DriverDeliveryWithItems = DriverDelivery & { order_items?: OrderItem[] };

function isApiError(e: unknown): e is {
  response?: { data?: { error?: string; requires_otp?: boolean } };
} {
  return typeof e === 'object' && e !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function unitLabel(unit: string, qty = 1): string {
  switch (unit) {
    case 'LITRES':  return qty === 1 ? 'litre'  : 'litres';
    case 'DOZENS':  return qty === 1 ? 'dozen'  : 'dozens';
    default:        return qty === 1 ? 'bottle' : 'bottles';
  }
}

const fmtKES = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function UnitBadge({ unit, isReturnable }: { unit: string; isReturnable: boolean }) {
  const cfg =
    isReturnable         ? { cls: 'bg-blue-50   text-blue-700   border-blue-200   dark:bg-blue-950/30   dark:border-blue-800',   icon: <RotateCcw className="h-2.5 w-2.5" />, label: unitLabel(unit, 2) }
    : unit === 'LITRES'  ? { cls: 'bg-sky-50    text-sky-700    border-sky-200    dark:bg-sky-950/30    dark:border-sky-800',    icon: <Droplets  className="h-2.5 w-2.5" />, label: 'litres'         }
    : unit === 'DOZENS'  ? { cls: 'bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-950/30  dark:border-amber-800',  icon: <Grid3X3   className="h-2.5 w-2.5" />, label: 'dozens'         }
    :                      { cls: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800', icon: <Package   className="h-2.5 w-2.5" />, label: 'units'          };
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold border rounded-full px-1.5 py-0.5 ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cash collection card
// Pre-filled with expected amount; shows exact / short / over indicator
// ─────────────────────────────────────────────────────────────────────────────

const CashCollectionCard: React.FC<{
  expectedAmount:  number;
  amountCollected: string;
  collectedMethod: 'CASH' | 'MPESA';
  onAmountChange:  (v: string) => void;
  onMethodChange:  (m: 'CASH' | 'MPESA') => void;
}> = ({ expectedAmount, amountCollected, collectedMethod, onAmountChange, onMethodChange }) => {
  const parsed   = parseFloat(amountCollected);
  const hasValue = amountCollected !== '' && !isNaN(parsed) && parsed >= 0;

  type PayState = 'exact' | 'short' | 'over' | 'empty';
  const payState: PayState = !hasValue
    ? 'empty'
    : parsed === expectedAmount ? 'exact'
    : parsed  < expectedAmount  ? 'short'
    : 'over';

  const diff = hasValue ? Math.abs(parsed - expectedAmount) : 0;

  const inputBorder =
    payState === 'exact' ? 'border-emerald-400 focus:border-emerald-500' :
    payState === 'short' ? 'border-amber-400   focus:border-amber-500'   :
    payState === 'over'  ? 'border-blue-400    focus:border-blue-500'    :
    'border-border/60 focus:border-emerald-400';

  return (
    <div className="rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/40 bg-card p-4 space-y-3">
      {/* Header */}
      <div>
        <p className="text-sm font-bold">Cash collected on delivery</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enter the amount the customer paid. Leave blank if not yet collected.
        </p>
      </div>

      {/* Expected amount pill */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-xl">
        <p className="text-xs text-muted-foreground font-semibold">Expected</p>
        <p className="text-sm font-black tabular-nums">{fmtKES(expectedAmount)}</p>
      </div>

      {/* Method toggle */}
      <div className="grid grid-cols-2 gap-2 bg-muted/40 p-1 rounded-xl">
        {(['CASH', 'MPESA'] as const).map(m => (
          <button
            key={m}
            onPointerDown={() => onMethodChange(m)}
            className={cn(
              'py-2 rounded-lg text-xs font-bold transition-all touch-manipulation',
              collectedMethod === m
                ? 'bg-background shadow-sm border border-border/60 text-foreground'
                : 'text-muted-foreground',
            )}
          >
            {m === 'CASH' ? '💵 Cash' : '📱 M-Pesa'}
          </button>
        ))}
      </div>

      {/* Amount input + quick-fill */}
      <div className="space-y-2">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">
            KES
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={amountCollected}
            onChange={e => onAmountChange(e.target.value)}
            placeholder={expectedAmount > 0 ? expectedAmount.toFixed(2) : '0.00'}
            className={cn(
              'w-full h-14 pl-14 pr-4 rounded-2xl border-2 bg-muted/30 text-xl font-black focus:outline-none tabular-nums transition-colors',
              inputBorder,
            )}
          />
        </div>

        {/* Quick-fill buttons */}
        {expectedAmount > 0 && (
          <div className="flex gap-2">
            <button
              onPointerDown={() => onAmountChange(expectedAmount.toFixed(2))}
              className="flex-1 text-[11px] font-bold py-2 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-[0.98] transition-all touch-manipulation dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
            >
              ✓ Full amount ({fmtKES(expectedAmount)})
            </button>
            <button
              onPointerDown={() => onAmountChange('')}
              className="px-3 text-[11px] font-bold py-2 rounded-xl border-2 border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted active:scale-[0.98] transition-all touch-manipulation"
            >
              Clear
            </button>
          </div>
        )}

        {/* Payment state indicator */}
        {payState === 'exact' && (
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-950/30 dark:border-emerald-800">
            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
              Full payment — invoice will be marked PAID ✓
            </p>
          </div>
        )}
        {payState === 'short' && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-950/30 dark:border-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
              Short by {fmtKES(diff)} — invoice stays open for the balance
            </p>
          </div>
        )}
        {payState === 'over' && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl dark:bg-blue-950/30 dark:border-blue-800">
            <AlertTriangle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
              Overpaid by {fmtKES(diff)} — admin will reconcile the difference
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Stock alert banner
// ─────────────────────────────────────────────────────────────────────────────

const StockAlertBanner: React.FC<{ check: DeliveryStockCheck }> = ({ check }) => {
  if (!check || check.status === 'full' || check.status === 'unknown') return null;

  if (check.status === 'none') {
    return (
      <div className="flex items-start gap-3 px-4 py-4 bg-red-50 border-2 border-red-200 rounded-2xl dark:bg-red-950/30 dark:border-red-900">
        <PackageX className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-800 dark:text-red-300">Items not on your van</p>
          <p className="text-xs text-red-700 dark:text-red-400 mt-1 leading-snug">
            None of the required stock is currently loaded. Contact the store to get stocked,
            or proceed to record a zero-quantity delivery if pre-arranged.
          </p>
          <div className="mt-2 space-y-1">
            {check.itemChecks.map(item => (
              <div key={item.product_id} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                <p className="text-[11px] font-semibold text-red-700 dark:text-red-300">
                  {item.product_name}: 0/{item.ordered_qty} available
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const shortItems = check.itemChecks.filter(c => c.available_qty < c.ordered_qty);
  return (
    <div className="flex items-start gap-3 px-4 py-4 bg-amber-50 border-2 border-amber-200 rounded-2xl dark:bg-amber-950/30 dark:border-amber-900">
      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Partial stock — short delivery</p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-snug">
          Quantities have been capped to what's on your van. Adjust if needed.
        </p>
        {shortItems.length > 0 && (
          <div className="mt-2 space-y-1">
            {shortItems.map(item => (
              <div key={item.product_id} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  {item.product_name}: {item.available_qty}/{item.ordered_qty} available
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Item state initializers
// ─────────────────────────────────────────────────────────────────────────────

function initItemStates(items: OrderItem[], check?: DeliveryStockCheck): ItemState[] {
  return items.map(item => {
    const stockItem = check?.itemChecks.find(c => c.product_id === item.product_id);
    const available = stockItem ? stockItem.available_qty : item.quantity;
    const cappedDelivered = check && (check.status === 'partial' || check.status === 'none')
      ? Math.min(item.quantity, available)
      : item.quantity;
    return {
      product_id:    item.product_id,
      product_name:  item.product_name,
      product_unit:  item.product_unit,
      is_returnable: item.is_returnable,
      ordered_qty:   item.quantity,
      delivered_qty: cappedDelivered,
      collected_qty: item.is_returnable ? cappedDelivered : 0,
    };
  });
}

function initLegacyItemStates(delivery: DriverDelivery): ItemState[] {
  const deliver = delivery.bottles_to_deliver ?? 0;
  if (deliver === 0) return [];
  return [{
    product_id:    'legacy-bottles',
    product_name:  'Bottles',
    product_unit:  'BOTTLES',
    is_returnable: true,
    ordered_qty:   deliver,
    delivered_qty: deliver,
    collected_qty: delivery.bottles_to_collect ?? 0,
  }];
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottle stepper
// ─────────────────────────────────────────────────────────────────────────────

const BottleStepper: React.FC<{
  label:     string;
  sublabel?: string;
  value:     number;
  onChange:  (n: number) => void;
  min?:      number;
  max?:      number;
  accent?:   'blue' | 'amber';
}> = ({ label, sublabel, value, onChange, min = 0, max, accent = 'blue' }) => {
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;
  const btnBase    = 'h-[52px] w-[52px] rounded-2xl flex items-center justify-center transition-all select-none active:scale-90 touch-manipulation';
  const activeCls  = accent === 'blue'
    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 border-2 border-blue-200 dark:border-blue-800 active:bg-blue-100'
    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-2 border-amber-200 dark:border-amber-800 active:bg-amber-100';
  const disabledCls = 'bg-muted/30 text-muted-foreground/30 border-2 border-border/20 cursor-default';

  return (
    <div className={cn(
      'rounded-2xl border-2 bg-card p-4 flex flex-col items-center gap-3 transition-colors',
      accent === 'blue' ? 'border-blue-100 dark:border-blue-900/40' : 'border-amber-100 dark:border-amber-900/40',
    )}>
      <div className="text-center">
        <p className="text-xs font-bold text-foreground leading-tight">{label}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      <div className="flex items-center gap-4">
        <button onPointerDown={e => { e.preventDefault(); if (!atMin) onChange(value - 1); }} disabled={atMin} className={cn(btnBase, atMin ? disabledCls : activeCls)}>
          <Minus className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <span className={cn('text-4xl font-black tabular-nums w-14 text-center leading-none', accent === 'blue' ? 'text-blue-600' : 'text-amber-500')}>
          {value}
        </span>
        <button onPointerDown={e => { e.preventDefault(); if (!atMax) onChange(value + 1); }} disabled={atMax} className={cn(btnBase, atMax ? disabledCls : activeCls)}>
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>
      {max !== undefined && (
        <p className={cn('text-[10px] font-semibold', atMax ? (accent === 'blue' ? 'text-blue-500' : 'text-amber-500') : 'text-muted-foreground/50')}>
          max {max}
        </p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// OTP verify step
// ─────────────────────────────────────────────────────────────────────────────

const RESEND_COOLDOWN = 30;

const OTPVerifyStep: React.FC<{
  deliveryId: string;
  onVerified: () => void;
  onBack:     () => void;
}> = ({ deliveryId, onVerified, onBack }) => {
  const [code,       setCode]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending,  setResending]  = useState(false);
  const [error,      setError]      = useState('');
  const [cooldown,   setCooldown]   = useState(0);
  const inputRef    = useRef<HTMLInputElement>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => { if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; } return prev - 1; });
    }, 1000);
  };

  const handleVerify = async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6) { setError('Enter the 6-digit code'); return; }
    setSubmitting(true); setError('');
    try {
      const result = await deliveryService.verifyOTP(deliveryId, trimmed);
      const sibs = result.siblings_verified ?? 0;
      toast.success(sibs ? `Code verified ✓ — ${sibs} other order${sibs > 1 ? 's' : ''} also cleared.` : 'Code verified ✓');
      onVerified();
    } catch (e: unknown) {
      const msg = isApiError(e) ? (e.response?.data?.error ?? 'Incorrect code — ask the customer to check again') : 'Incorrect code — ask the customer to check again';
      setError(msg); setCode(''); inputRef.current?.focus();
    } finally { setSubmitting(false); }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true); setError('');
    try {
      await deliveryService.resendOTP(deliveryId);
      toast.success('New code sent to customer ✓');
      startCooldown();
    } catch (e: unknown) {
      const msg = isApiError(e) ? (e.response?.data?.error ?? 'Could not resend code') : 'Could not resend code';
      toast.error(msg);
    } finally { setResending(false); }
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col items-center gap-3 pt-2">
        <div className="h-16 w-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
          <KeyRound className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="text-center space-y-1 px-4">
          <p className="font-bold text-base">Customer Verification Code</p>
          <p className="text-sm text-muted-foreground leading-snug">
            Ask the customer for the 6-digit code sent to them when their order was assigned.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <input
          ref={inputRef} type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={6}
          value={code}
          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); if (error) setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter' && code.length === 6) handleVerify(); }}
          placeholder="000000"
          className={cn(
            'w-full h-16 rounded-2xl border-2 text-center text-3xl font-black tracking-[0.5em] font-mono focus:outline-none transition-colors',
            error ? 'border-red-400 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300' : 'border-border/60 bg-muted/30 focus:border-indigo-400 focus:bg-indigo-50/30 dark:focus:bg-indigo-950/20',
          )}
        />
        {error && (
          <div className="flex items-center gap-2 px-3.5 py-3 bg-red-50 border border-red-200 rounded-xl dark:bg-red-950/30 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
      </div>
      <PrimaryButton onClick={handleVerify} loading={submitting} loadingLabel="Verifying…" disabled={code.length !== 6 || submitting} label="Verify Code" icon={<ShieldCheck className="h-5 w-5" />} color="emerald" />
      <button
        onPointerDown={handleResend} disabled={cooldown > 0 || resending}
        className={cn('w-full flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-4 text-sm font-semibold transition-all touch-manipulation',
          cooldown > 0 || resending ? 'border-border/30 bg-muted/20 text-muted-foreground/40 cursor-default' : 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 active:scale-[0.98]')}
      >
        {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {resending ? 'Sending…' : cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code to customer'}
      </button>
      <button onPointerDown={onBack} className="w-full text-center text-sm text-muted-foreground underline underline-offset-2 py-2 touch-manipulation">← Go back</button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Submit helper
// ─────────────────────────────────────────────────────────────────────────────

async function _submitCompletion(
  deliveryId: string,
  fd: FormData,
): Promise<{ ok: true } | { ok: false; requiresOtp: true }> {
  try {
    await deliveryService.completeDelivery(deliveryId, fd);
    return { ok: true };
  } catch (err: unknown) {
    if (isApiError(err) && err.response?.data?.requires_otp) return { ok: false, requiresOtp: true };
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Item delivery card
// ─────────────────────────────────────────────────────────────────────────────

const ItemDeliveryCard: React.FC<{
  item:              ItemState;
  onDeliveredChange: (qty: number) => void;
  onCollectedChange: (qty: number) => void;
}> = ({ item, onDeliveredChange, onCollectedChange }) => {
  const isShort = item.delivered_qty < item.ordered_qty;
  const unit    = unitLabel(item.product_unit, 2);
  return (
    <div className={cn('rounded-2xl border-2 bg-card p-4 space-y-3 transition-colors',
      isShort ? 'border-red-200 dark:border-red-900/50' : item.is_returnable ? 'border-blue-100 dark:border-blue-900/40' : 'border-violet-100 dark:border-violet-900/40')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {item.is_returnable ? (
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0"><Droplets className="h-4 w-4" /></div>
          ) : item.product_unit === 'LITRES' ? (
            <div className="h-9 w-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0"><Droplets className="h-4 w-4" /></div>
          ) : item.product_unit === 'DOZENS' ? (
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0"><Grid3X3 className="h-4 w-4" /></div>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0"><Package className="h-4 w-4" /></div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate">{item.product_name}</p>
            <UnitBadge unit={item.product_unit} isReturnable={item.is_returnable} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-muted-foreground">Ordered</p>
          <p className="font-black text-sm tabular-nums">{item.ordered_qty} {unit}</p>
        </div>
      </div>
      {item.is_returnable ? (
        <div className="grid grid-cols-2 gap-3">
          <BottleStepper label="Delivering" sublabel={`Full ${unit} out`} value={item.delivered_qty} onChange={onDeliveredChange} accent="blue" />
          <BottleStepper label="Collecting" sublabel={`Empty ${unit} back`} value={item.collected_qty} onChange={onCollectedChange} max={item.delivered_qty} accent="amber" />
        </div>
      ) : (
        <BottleStepper label={`Delivering (${unit})`} sublabel={`Max: ${item.ordered_qty} ordered`} value={item.delivered_qty} onChange={onDeliveredChange} max={item.ordered_qty} accent="blue" />
      )}
      {isShort && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl dark:bg-red-950/30 dark:border-red-900">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <p className="text-xs font-semibold text-red-700 dark:text-red-300">{item.ordered_qty - item.delivered_qty} fewer {unit} than ordered</p>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Items delivery section
// ─────────────────────────────────────────────────────────────────────────────

const ItemsDeliverySection: React.FC<{
  items:             ItemState[];
  onDeliveredChange: (pid: string, qty: number) => void;
  onCollectedChange: (pid: string, qty: number) => void;
  label?:            string;
}> = ({ items, onDeliveredChange, onCollectedChange, label }) => {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold">{label ?? 'Items to Deliver'}</p>
      {items.map(item => (
        <ItemDeliveryCard
          key={item.product_id}
          item={item}
          onDeliveredChange={qty => onDeliveredChange(item.product_id, qty)}
          onCollectedChange={qty => onCollectedChange(item.product_id, qty)}
        />
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Star rating
// ─────────────────────────────────────────────────────────────────────────────

const StarRating: React.FC<{ value: number; onChange: (n: number) => void }> = ({ value, onChange }) => (
  <div className="flex gap-2">
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} onPointerDown={e => { e.preventDefault(); onChange(n === value ? 0 : n); }}
        className={cn('flex-1 h-12 rounded-2xl border-2 text-2xl transition-all active:scale-95 touch-manipulation',
          value >= n ? 'bg-amber-50 border-amber-300 text-amber-400 dark:bg-amber-950/30 dark:border-amber-700' : 'bg-muted/30 border-border/40 text-muted-foreground/20')}
      >★</button>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Delivery row (LIST step)
// ─────────────────────────────────────────────────────────────────────────────

const DeliveryRow: React.FC<{ d: DriverDelivery; onSelect: () => void }> = ({ d, onSelect }) => {
  const sc = STATUS_META[d.status] ?? { label: d.status, dot: 'bg-muted-foreground', pill: 'bg-muted text-muted-foreground border-border' };
  return (
    <button onPointerDown={onSelect} className="w-full text-left rounded-2xl border border-border/50 bg-background/80 p-4 active:scale-[0.98] active:bg-primary/5 transition-all touch-manipulation flex items-start gap-3">
      <div className={cn('h-2 w-2 rounded-full shrink-0 mt-2', sc.dot)} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-mono text-xs font-bold tracking-tight">{d.order_number}</p>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', sc.pill)}>{sc.label}</span>
          {(d.bottles_to_deliver ?? 0) > 0 && (
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 dark:bg-blue-950/30 dark:border-blue-800">🫧 {d.bottles_to_deliver}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          {d.scheduled_time_slot && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{d.scheduled_time_slot}</span>}
          {d.items_count > 0 && <span className="flex items-center gap-1"><Package className="h-3 w-3" />{d.items_count} item{d.items_count !== 1 ? 's' : ''}</span>}
        </div>
        {d.full_address && <p className="text-[11px] text-muted-foreground flex items-start gap-1 line-clamp-2"><MapPin className="h-3 w-3 shrink-0 mt-0.5" />{d.full_address}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-1" />
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Customer group row (LIST step)
// ─────────────────────────────────────────────────────────────────────────────

const CustomerGroupRow: React.FC<{
  group:          CustomerGroup;
  onSelectSingle: (d: DriverDelivery) => void;
  onCompleteAll:  (g: CustomerGroup) => void;
}> = ({ group, onSelectSingle, onCompleteAll }) => {
  const [expanded, setExpanded] = useState(false);
  const single = group.deliveries.length === 1;

  return (
    <div className={cn('rounded-2xl border-2 overflow-hidden transition-all duration-150', expanded ? 'border-primary/25 bg-primary/[0.02]' : 'border-border/50 bg-card')}>
      <div className="flex items-center gap-3 p-4 min-h-[72px]">
        <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 font-black text-base select-none">{group.initial}</div>
        <button onPointerDown={() => single ? onSelectSingle(group.deliveries[0]) : setExpanded(e => !e)} className="flex-1 min-w-0 text-left touch-manipulation">
          <p className="font-bold text-sm leading-tight truncate">{group.name}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2.5 py-0.5 border', single ? 'bg-muted/60 text-muted-foreground border-border/50' : 'bg-primary/8 text-primary border-primary/20')}>
              {group.deliveries.length} deliver{group.deliveries.length !== 1 ? 'ies' : 'y'}
            </span>
            {group.totalBottles > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-600 border border-blue-200 dark:border-blue-800 rounded-full px-2.5 py-0.5">
                <Droplets className="h-3 w-3" />{group.totalBottles}
              </span>
            )}
            {group.earliestSlot && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" />{group.earliestSlot}</span>}
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {!single && (
            <button onPointerDown={e => { e.stopPropagation(); onCompleteAll(group); }} className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2.5 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 active:scale-95 transition-all touch-manipulation">
              <Layers className="h-3.5 w-3.5" />All
            </button>
          )}
          {single ? <ChevronRight className="h-4 w-4 text-muted-foreground/60" /> : (
            <button onPointerDown={() => setExpanded(e => !e)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/40 hover:bg-muted active:scale-95 transition-all touch-manipulation">
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', expanded && 'rotate-180')} />
            </button>
          )}
        </div>
      </div>
      {!single && expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/30 bg-muted/10 pt-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Tap to complete individually</p>
          {group.deliveries.map(d => <DeliveryRow key={d.id} d={d} onSelect={() => onSelectSingle(d)} />)}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Single confirm step
// ─────────────────────────────────────────────────────────────────────────────

const SingleConfirmStep: React.FC<{
  delivery:    DriverDelivery;
  stockCheck?: DeliveryStockCheck;
  onBack:      (() => void) | null;
  onComplete:  () => void;
  onNeedsOtp:  (deliveryId: string, retryFn: () => void) => void;
}> = ({ delivery, stockCheck, onBack, onComplete, onNeedsOtp }) => {
  const rawItems: OrderItem[] = (delivery as DriverDeliveryWithItems).order_items ?? [];
  const [itemStates, setItemStates] = useState<ItemState[]>(() =>
    rawItems.length > 0 ? initItemStates(rawItems, stockCheck) : initLegacyItemStates(delivery),
  );

  const [customerName,    setCustomerName]    = useState(delivery.customer_name);
  const [shortReason,     setShortReason]     = useState('');
  const [notes,           setNotes]           = useState('');
  const [rating,          setRating]          = useState(0);
  const [submitting,      setSubmitting]      = useState(false);
  const [collectedMethod, setCollectedMethod] = useState<'CASH' | 'MPESA'>('CASH');

  // Expected amount from the serializer field order_total_amount
  const expectedAmount = parseFloat((delivery as DriverDelivery).order_total_amount ?? '0') || 0;

  // Pre-fill with expected — driver just taps submit if full payment received
  const [amountCollected, setAmountCollected] = useState(() =>
    expectedAmount > 0 ? expectedAmount.toFixed(2) : '',
  );

  const isCashOrder = (delivery as DriverDelivery).order_payment_method === 'CASH';

  const updateDelivered = (pid: string, qty: number) => {
    setItemStates(prev => prev.map(item => {
      if (item.product_id !== pid) return item;
      const newQty = Math.max(0, qty);
      return { ...item, delivered_qty: newQty, collected_qty: item.is_returnable ? Math.min(item.collected_qty, newQty) : item.collected_qty };
    }));
  };

  const updateCollected = (pid: string, qty: number) => {
    setItemStates(prev => prev.map(item => {
      if (item.product_id !== pid) return item;
      return { ...item, collected_qty: Math.min(Math.max(0, qty), item.delivered_qty) };
    }));
  };

  const isShort         = itemStates.some(i => i.delivered_qty < i.ordered_qty);
  const hasItems        = itemStates.length > 0;
  const canSubmit       = customerName.trim() && (!isShort || shortReason);
  const returnableItems = itemStates.filter(i => i.is_returnable);
  const totalDelivered  = returnableItems.reduce((s, i) => s + i.delivered_qty, 0);
  const totalCollected  = returnableItems.reduce((s, i) => s + i.collected_qty, 0);

  const buildAndSubmit = async () => {
    const fd = new FormData();
    fd.append('customer_name_confirmed', customerName.trim());
    if (returnableItems.length > 0) {
      fd.append('bottles_delivered', String(totalDelivered));
      fd.append('bottles_collected', String(totalCollected));
    }
    if (isShort && shortReason) fd.append('short_reason', shortReason);
    if (notes.trim())           fd.append('driver_notes', notes.trim());
    if (rating > 0)             fd.append('customer_rating', String(rating));

    // ✅ Payment fields BEFORE _submitCompletion
    if (isCashOrder && amountCollected) {
      const parsed = parseFloat(amountCollected);
      if (!isNaN(parsed) && parsed > 0) {
        fd.append('amount_collected',         String(parsed));
        fd.append('payment_method_collected', collectedMethod);
      }
    }

    const result = await _submitCompletion(delivery.id, fd);
    if (result.ok) { toast.success('Delivery completed! 🎉'); onComplete(); }
    else           { onNeedsOtp(delivery.id, buildAndSubmit); }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try { await buildAndSubmit(); }
    catch { toast.error('Could not complete delivery — please try again'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-4 pb-6">
      {stockCheck && <StockAlertBanner check={stockCheck} />}

      {/* Delivery summary card */}
      <div className="rounded-2xl bg-muted/40 border border-border/60 p-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm leading-tight">{delivery.customer_name}</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{delivery.order_number}</p>
            <div className="flex flex-col gap-1 mt-1.5">
              {delivery.scheduled_time_slot && (
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />{delivery.scheduled_time_slot}
                </span>
              )}
              {delivery.full_address && (
                <span className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{delivery.full_address}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Field label="Received by" required>
        <TextInput value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Name of person who received" />
      </Field>

      {hasItems && (
        <ItemsDeliverySection items={itemStates} onDeliveredChange={updateDelivered} onCollectedChange={updateCollected} />
      )}

      {/* ✅ Cash collection — pre-filled with expected, shows exact/short/over feedback */}
      {isCashOrder && (
        <CashCollectionCard
          expectedAmount={expectedAmount}
          amountCollected={amountCollected}
          collectedMethod={collectedMethod}
          onAmountChange={setAmountCollected}
          onMethodChange={setCollectedMethod}
        />
      )}

      {isShort && (
        <Field label="Reason for short delivery" required>
          <div className="space-y-2">
            {SHORT_REASONS.map(r => (
              <button key={r} onPointerDown={() => setShortReason(r)}
                className={cn('w-full text-left text-sm font-semibold px-4 py-3.5 rounded-2xl border-2 transition-all touch-manipulation active:scale-[0.98]',
                  shortReason === r ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-300' : 'bg-muted/30 border-border/50 text-muted-foreground')}
              >{r}</button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Customer rating (optional)">
        <StarRating value={rating} onChange={setRating} />
      </Field>

      <Field label="Notes (optional)">
        <TextArea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder={isShort ? 'Additional details about the short delivery…' : 'Any issues or special notes…'} />
      </Field>

      <PrimaryButton onClick={handleSubmit} loading={submitting} loadingLabel="Completing…" disabled={!canSubmit || submitting} label="Mark as Delivered" icon={<Check className="h-5 w-5" />} color="emerald" />

      {isShort && !shortReason && (
        <p className="text-center text-xs text-muted-foreground pb-1">Select a reason for the short delivery to continue</p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Bulk confirm step
// ─────────────────────────────────────────────────────────────────────────────

const BulkConfirmStep: React.FC<{
  group:       CustomerGroup;
  stockCheck?: DeliveryStockCheck;
  onBack:      (() => void) | null;
  onComplete:  () => void;
  onNeedsOtp:  (deliveryId: string, retryFn: () => void) => void;
}> = ({ group, stockCheck, onBack, onComplete, onNeedsOtp }) => {
  const [itemStates, setItemStates] = useState<ItemState[]>(() => {
    const rawItems: OrderItem[] = group.deliveries.flatMap(d => ((d as DriverDeliveryWithItems).order_items ?? []));
    if (rawItems.length > 0) {
      const merged: Record<string, ItemState> = {};
      for (const item of rawItems) {
        if (merged[item.product_id]) {
          merged[item.product_id].ordered_qty   += item.quantity;
          merged[item.product_id].delivered_qty += item.quantity;
          merged[item.product_id].collected_qty += item.quantity;
        } else {
          merged[item.product_id] = { product_id: item.product_id, product_name: item.product_name, product_unit: item.product_unit, is_returnable: item.is_returnable, ordered_qty: item.quantity, delivered_qty: item.quantity, collected_qty: item.quantity };
        }
      }
      const states = Object.values(merged);
      if (stockCheck && (stockCheck.status === 'partial' || stockCheck.status === 'none')) {
        return states.map(s => {
          const sc = stockCheck.itemChecks.find(c => c.product_id === s.product_id);
          const available = sc ? sc.available_qty : s.ordered_qty;
          const capped = Math.min(s.ordered_qty, available);
          return { ...s, delivered_qty: capped, collected_qty: s.is_returnable ? capped : 0 };
        });
      }
      return states;
    }
    const totalDeliver = group.totalBottles;
    const totalCollect = group.totalCollect;
    if (totalDeliver === 0) return [];
    return [{ product_id: 'legacy-bottles', product_name: 'Bottles', product_unit: 'BOTTLES', is_returnable: true, ordered_qty: totalDeliver, delivered_qty: totalDeliver, collected_qty: totalCollect }];
  });

  const [customerName, setCustomerName] = useState(group.name);
  const [shortReason,  setShortReason]  = useState('');
  const [notes,        setNotes]        = useState('');
  const [rating,       setRating]       = useState(0);
  const [submitting,   setSubmitting]   = useState(false);
  const [progress,     setProgress]     = useState<{ done: number; total: number } | null>(null);

  const updateDelivered = (pid: string, qty: number) => {
    setItemStates(prev => prev.map(item => {
      if (item.product_id !== pid) return item;
      const newQty = Math.max(0, qty);
      return { ...item, delivered_qty: newQty, collected_qty: item.is_returnable ? Math.min(item.collected_qty, newQty) : item.collected_qty };
    }));
  };
  const updateCollected = (pid: string, qty: number) => {
    setItemStates(prev => prev.map(item => {
      if (item.product_id !== pid) return item;
      return { ...item, collected_qty: Math.min(Math.max(0, qty), item.delivered_qty) };
    }));
  };

  const isShort         = itemStates.some(i => i.delivered_qty < i.ordered_qty);
  const hasItems        = itemStates.length > 0;
  const returnableItems = itemStates.filter(i => i.is_returnable);
  const totalDelivered  = returnableItems.reduce((s, i) => s + i.delivered_qty, 0);
  const totalCollected  = returnableItems.reduce((s, i) => s + i.collected_qty, 0);

  const handleSubmit = async () => {
    if (!customerName.trim()) { toast.error('Enter the customer name'); return; }
    setSubmitting(true);
    setProgress({ done: 0, total: group.deliveries.length });

    const totalOrderedReturnable = group.deliveries.reduce((s, d) => s + (d.bottles_to_deliver ?? 0), 0);
    const returnableScale = totalOrderedReturnable > 0 ? totalDelivered / totalOrderedReturnable : 1;

    let successCount = 0;
    let otpBlockedId: string | null = null;

    for (let i = 0; i < group.deliveries.length; i++) {
      const d = group.deliveries[i];
      const fd = new FormData();
      fd.append('customer_name_confirmed', customerName.trim());
      if (returnableItems.length > 0) {
        fd.append('bottles_delivered', String(Math.round((d.bottles_to_deliver ?? 0) * returnableScale)));
        fd.append('bottles_collected', String(Math.round((d.bottles_to_collect ?? 0) * returnableScale)));
      }
      if (isShort && shortReason) fd.append('short_reason', shortReason);
      if (notes.trim())           fd.append('driver_notes', notes.trim());
      if (rating > 0)             fd.append('customer_rating', String(rating));

      try {
        const result = await _submitCompletion(d.id, fd);
        if (result.ok) { successCount++; }
        else { otpBlockedId = d.id; break; }
      } catch { /* skip */ }

      setProgress({ done: i + 1, total: group.deliveries.length });
    }

    setSubmitting(false);
    setProgress(null);

    if (otpBlockedId) {
      if (successCount > 0) toast.info(`${successCount} completed — verify code to continue`);
      onNeedsOtp(otpBlockedId, handleSubmit);
      return;
    }

    if (successCount === group.deliveries.length) {
      toast.success(`All ${successCount} deliveries completed! 🎉`);
      onComplete();
    } else if (successCount > 0) {
      toast.warning(`${successCount} completed, ${group.deliveries.length - successCount} failed — retry individually`);
      onComplete();
    } else {
      toast.error('All deliveries failed to complete');
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {stockCheck && <StockAlertBanner check={stockCheck} />}

      <div className="rounded-2xl bg-muted/40 border border-border/60 p-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 font-black text-base">{group.initial}</div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm">{group.name}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[10px] font-bold bg-primary/8 text-primary border border-primary/15 rounded-full px-2.5 py-0.5">{group.deliveries.length} deliveries</span>
              {itemStates.map(item => (
                <span key={item.product_id} className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-600 border border-blue-200 dark:border-blue-800 rounded-full px-2 py-0.5">
                  {item.ordered_qty} {unitLabel(item.product_unit, item.ordered_qty)}
                </span>
              ))}
            </div>
            <div className="mt-2.5 space-y-1">
              {group.deliveries.map(d => (
                <p key={d.id} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_META[d.status]?.dot ?? 'bg-muted-foreground')} />
                  <span className="font-mono font-bold">{d.order_number}</span>
                  {d.scheduled_time_slot && <span>· {d.scheduled_time_slot}</span>}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {progress && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-muted-foreground">Completing deliveries…</span>
            <span className="font-mono">{progress.done} / {progress.total}</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        </div>
      )}

      <Field label="Received by" required>
        <TextInput value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Name of person who received all deliveries" />
      </Field>

      {hasItems && (
        <ItemsDeliverySection items={itemStates} onDeliveredChange={updateDelivered} onCollectedChange={updateCollected} label="Items to Deliver (combined)" />
      )}

      {isShort && (
        <Field label="Reason for short delivery (applies to all)" required>
          <div className="space-y-2">
            {SHORT_REASONS.map(r => (
              <button key={r} onPointerDown={() => setShortReason(r)}
                className={cn('w-full text-left text-sm font-semibold px-4 py-3.5 rounded-2xl border-2 transition-all touch-manipulation active:scale-[0.98]',
                  shortReason === r ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-300' : 'bg-muted/30 border-border/50 text-muted-foreground')}
              >{r}</button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Customer rating (optional)">
        <StarRating value={rating} onChange={setRating} />
      </Field>

      <Field label="Notes (optional)">
        <TextArea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any issues across all deliveries…" />
      </Field>

      <PrimaryButton
        onClick={handleSubmit} loading={submitting}
        loadingLabel={progress ? `${progress.done} / ${progress.total}…` : 'Completing…'}
        disabled={!customerName.trim() || submitting || (isShort && !shortReason)}
        label={`Complete All ${group.deliveries.length} Deliveries`}
        icon={<Layers className="h-5 w-5" />} color="emerald"
      />

      {isShort && !shortReason && (
        <p className="text-center text-xs text-muted-foreground pb-1">Select a reason for the short delivery to continue</p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// List step
// ─────────────────────────────────────────────────────────────────────────────

const ListStep: React.FC<{
  allDeliveries:  DriverDelivery[];
  onSelectSingle: (d: DriverDelivery) => void;
  onCompleteAll:  (g: CustomerGroup)  => void;
}> = ({ allDeliveries, onSelectSingle, onCompleteAll }) => {
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy,       setSortBy]       = useState<'time' | 'name' | 'count'>('time');

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of allDeliveries) c[d.status] = (c[d.status] || 0) + 1;
    return c;
  }, [allDeliveries]);

  const filtered = useMemo(() => {
    let list = [...allDeliveries];
    if (statusFilter !== 'all') list = list.filter(d => d.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d => d.customer_name.toLowerCase().includes(q) || d.order_number.toLowerCase().includes(q) || (d.full_address || '').toLowerCase().includes(q));
    }
    return list;
  }, [allDeliveries, search, statusFilter]);

  const groups = useMemo(() => {
    const g = buildGroups(filtered);
    if (sortBy === 'name')  g.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'count') g.sort((a, b) => b.deliveries.length - a.deliveries.length);
    if (sortBy === 'time')  g.sort((a, b) => parseSlot(a.earliestSlot) - parseSlot(b.earliestSlot));
    return g;
  }, [filtered, sortBy]);

  return (
    <div className="pb-4 space-y-3">
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, order, address…"
          className="w-full h-12 pl-11 pr-10 rounded-2xl border-2 border-border/50 bg-muted/30 text-sm focus:outline-none focus:border-primary/40" />
        {search && (
          <button onPointerDown={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full bg-muted text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5 -mx-4 px-4">
        {['all', ...ACTIVE_STATUSES.filter(s => statusCounts[s])].map(s => (
          <button key={s} onPointerDown={() => setStatusFilter(s)}
            className={cn('shrink-0 text-[11px] font-bold px-3.5 py-2 rounded-full border-2 transition-all touch-manipulation',
              statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 text-muted-foreground border-border/40')}
          >
            {s === 'all' ? `All · ${allDeliveries.length}` : `${STATUS_META[s]?.label} · ${statusCounts[s]}`}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <span className="text-[11px] text-muted-foreground font-semibold shrink-0">Sort:</span>
        {(['time', 'name', 'count'] as const).map(s => (
          <button key={s} onPointerDown={() => setSortBy(s)}
            className={cn('text-[11px] font-bold px-3.5 py-2 rounded-full border-2 transition-all touch-manipulation',
              sortBy === s ? 'bg-foreground text-background border-foreground' : 'bg-muted/30 text-muted-foreground border-border/40')}
          >
            {s === 'time' ? 'Time' : s === 'name' ? 'A–Z' : 'Most'}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          <strong>{groups.length}</strong> customer{groups.length !== 1 ? 's' : ''}{' · '}
          <strong>{filtered.length}</strong> deliver{filtered.length !== 1 ? 'ies' : 'y'}
        </p>
        {(search || statusFilter !== 'all') && (
          <button onPointerDown={() => { setSearch(''); setStatusFilter('all'); }} className="text-[11px] text-primary underline underline-offset-2">Clear filters</button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed border-border/40">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm font-bold text-muted-foreground">{allDeliveries.length === 0 ? 'No pending deliveries' : 'No results found'}</p>
          <p className="text-xs text-muted-foreground/50 mt-1">{allDeliveries.length === 0 ? 'You have no active deliveries assigned.' : 'Try adjusting your search or filter.'}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {groups.map(g => <CustomerGroupRow key={g.name} group={g} onSelectSingle={onSelectSingle} onCompleteAll={onCompleteAll} />)}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DIALOG
// ─────────────────────────────────────────────────────────────────────────────

export const CompleteDeliveryDialog: React.FC<{
  open:             boolean;
  onClose:          () => void;
  onDone:           () => void;
  initialDelivery?: DriverDelivery;
  initialGroup?:    CustomerGroup;
  stockCheck?:      DeliveryStockCheck;
}> = ({ open, onClose, onDone, initialDelivery, initialGroup, stockCheck }) => {
  const [allDeliveries,   setAllDeliveries]   = useState<DriverDelivery[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [step,            setStep]            = useState<Step>({ type: 'list' });
  const [receiptDelivery, setReceiptDelivery] = useState<DriverDelivery | null>(null);
  const [showReceipt,     setShowReceipt]     = useState(false);

  const pendingRetryRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) { setStep({ type: 'list' }); pendingRetryRef.current = null; return; }
    if (initialDelivery) { setStep({ type: 'single', delivery: initialDelivery }); return; }
    if (initialGroup)    { setStep({ type: 'bulk',   group: initialGroup });       return; }

    (async () => {
      setLoading(true);
      try {
        const data = await deliveryService.getDriverDeliveries();
        const raw: DriverDelivery[] = data.deliveries || data || [];
        setAllDeliveries(raw.filter(d => ACTIVE_STATUSES.includes(d.status)));
      } catch { toast.error('Could not load deliveries'); }
      finally  { setLoading(false); }
    })();
  }, [open, initialDelivery, initialGroup]);

  const handleComplete = (delivery?: DriverDelivery) => {
    onDone();
    onClose();
    if (delivery) {
      setReceiptDelivery(delivery);
      setTimeout(() => setShowReceipt(true), 350);
    }
  };

  const handleNeedsOtp = (deliveryId: string, retryFn: () => void) => {
    pendingRetryRef.current = retryFn;
    setStep({
      type: 'otp',
      deliveryId,
      onVerified: () => { if (pendingRetryRef.current) { pendingRetryRef.current(); pendingRetryRef.current = null; } },
      onBack: () => {
        pendingRetryRef.current = null;
        setStep(initialDelivery ? { type: 'single', delivery: initialDelivery } : initialGroup ? { type: 'bulk', group: initialGroup } : { type: 'list' });
      },
    });
  };

  const titles: Record<Step['type'], string> = {
    list:   'Select Delivery',
    single: 'Complete Delivery',
    bulk:   'Complete All Deliveries',
    otp:    'Verify Customer Code',
  };

  return (
    <>
      <BottomSheet
        open={open} onClose={onClose} title={titles[step.type]}
        titleRight={step.type !== 'list' ? (
          <button
            onPointerDown={() => {
              if (step.type === 'otp') { step.onBack(); }
              else if (initialDelivery || initialGroup) { onClose(); }
              else { setStep({ type: 'list' }); }
            }}
            className="flex items-center gap-1 text-xs font-semibold text-primary px-2 py-1 rounded-lg active:bg-primary/10 touch-manipulation"
          >← Back</button>
        ) : undefined}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">Loading deliveries…</p>
          </div>
        ) : step.type === 'list' ? (
          <ListStep allDeliveries={allDeliveries} onSelectSingle={d => setStep({ type: 'single', delivery: d })} onCompleteAll={g => setStep({ type: 'bulk', group: g })} />
        ) : step.type === 'single' ? (
          <SingleConfirmStep delivery={step.delivery} stockCheck={stockCheck} onBack={initialDelivery ? null : () => setStep({ type: 'list' })} onComplete={() => handleComplete(step.delivery)} onNeedsOtp={handleNeedsOtp} />
        ) : step.type === 'bulk' ? (
          <BulkConfirmStep group={step.group} stockCheck={stockCheck} onBack={initialGroup ? null : () => setStep({ type: 'list' })} onComplete={() => handleComplete(step.group.deliveries[0])} onNeedsOtp={handleNeedsOtp} />
        ) : (
          <OTPVerifyStep deliveryId={step.deliveryId} onVerified={step.onVerified} onBack={step.onBack} />
        )}
      </BottomSheet>

      {receiptDelivery && (
        <DeliveryReceiptModal
          open={showReceipt}
          onClose={() => { setShowReceipt(false); setReceiptDelivery(null); }}
          delivery={receiptDelivery}
        />
      )}
    </>
  );
};

export default CompleteDeliveryDialog;
/**
 * src/components/dialogs/StockRequestDialog.tsx
 *
 * Driver-side stock top-up request dialog.
 * Can be opened from:
 *  - DriverStorePage  → "Request Top-up" button (general)
 *  - DeliveryQueuePage → "No stock" / "Partial stock" badge (pre-filled)
 *  - DriverDashboard  → Quick Action "Request Top-up"
 *
 * POST /driver/store/request-topup/
 * Body: { items: [{ product_id, product_type, quantity_requested, notes? }], delivery_id? }
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Loader2, PackagePlus, Droplets, Package,
  AlertTriangle, CheckCircle2, Send, Minus, Plus,
  Truck, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import axiosInstance from '@/api/axios.config';
import {
  driverStoreService,
  type DriverBottleStock,
  type DriverConsumableStock,
} from '@/api/services/driver-store.service';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StockRequestItem {
  product_id:          string;
  product_name:        string;
  product_type:        'bottle' | 'consumable';
  unit?:               string;
  quantity_requested:  number;
  /** How many the driver currently has on the van */
  current_qty:         number;
  /** How many are needed for today's route (optional context) */
  needed_qty?:         number;
}

interface StockRequestDialogProps {
  open:         boolean;
  onClose:      () => void;
  /** Pre-fill specific items (e.g. from a delivery's missing stock) */
  prefillItems?: StockRequestItem[];
  /** Optionally link to a specific delivery */
  deliveryId?:  string;
  deliveryOrderNumber?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Qty stepper
// ─────────────────────────────────────────────────────────────────────────────

const QtyStepper: React.FC<{
  value:    number;
  min?:     number;
  onChange: (n: number) => void;
}> = ({ value, min = 1, onChange }) => (
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => onChange(Math.max(min, value - 1))}
      disabled={value <= min}
      className="h-8 w-8 rounded-lg border border-border/60 bg-muted/40 flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors active:scale-90"
    >
      <Minus className="h-3.5 w-3.5" />
    </button>
    <span className="w-10 text-center font-bold text-base tabular-nums">{value}</span>
    <button
      type="button"
      onClick={() => onChange(value + 1)}
      className="h-8 w-8 rounded-lg border border-border/60 bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors active:scale-90"
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Product row in the request list
// ─────────────────────────────────────────────────────────────────────────────

const RequestItemRow: React.FC<{
  item:     StockRequestItem;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
}> = ({ item, onQtyChange, onRemove }) => {
  const isBottle = item.product_type === 'bottle';
  const short = item.needed_qty !== undefined
    ? Math.max(0, item.needed_qty - item.current_qty)
    : null;

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-border/60 bg-card">
      {/* Icon */}
      <div className={cn(
        'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
        isBottle ? 'bg-blue-500/10 text-blue-600' : 'bg-sky-500/10 text-sky-600',
      )}>
        {isBottle
          ? <Droplets className="h-5 w-5" />
          : <Package  className="h-5 w-5" />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{item.product_name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground">
            On van: <strong>{item.current_qty}</strong>
          </span>
          {short !== null && short > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800 rounded-full px-1.5 py-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              Short {short}
            </span>
          )}
          {item.unit && (
            <span className="text-[10px] text-muted-foreground capitalize">
              {item.unit.toLowerCase()}
            </span>
          )}
        </div>
      </div>

      {/* Stepper */}
      <QtyStepper value={item.quantity_requested} onChange={onQtyChange} />

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Product picker — add more products to the request
// ─────────────────────────────────────────────────────────────────────────────

const ProductPicker: React.FC<{
  bottles:     DriverBottleStock[];
  consumables: DriverConsumableStock[];
  existingIds: Set<string>;
  onAdd:       (item: StockRequestItem) => void;
}> = ({ bottles, consumables, existingIds, onAdd }) => {
  const [open, setOpen] = useState(false);

  const available = [
    ...bottles.map(b => ({
      product_id:   b.product_id,
      product_name: b.product_name,
      product_type: 'bottle' as const,
      current_qty:  b.balance.full,
      unit:         undefined,
    })),
    ...consumables.map(c => ({
      product_id:   c.product_id,
      product_name: c.product_name,
      product_type: 'consumable' as const,
      current_qty:  c.balance.in_stock,
      unit:         c.unit,
    })),
  ].filter(p => !existingIds.has(p.product_id));

  if (available.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 text-sm font-semibold text-muted-foreground hover:text-primary transition-all active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        Add another product
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1.5 z-20 rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden max-h-64 overflow-y-auto">
            {available.map(p => (
              <button
                key={p.product_id}
                type="button"
                onClick={() => {
                  onAdd({
                    ...p,
                    quantity_requested: Math.max(1, p.current_qty <= 5 ? 5 : 10),
                  });
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/30 last:border-0"
              >
                <div className={cn(
                  'h-8 w-8 rounded-xl flex items-center justify-center shrink-0',
                  p.product_type === 'bottle'
                    ? 'bg-blue-500/10 text-blue-600'
                    : 'bg-sky-500/10 text-sky-600',
                )}>
                  {p.product_type === 'bottle'
                    ? <Droplets className="h-4 w-4" />
                    : <Package  className="h-4 w-4" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.product_name}</p>
                  <p className="text-[11px] text-muted-foreground">On van: {p.current_qty}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main dialog
// ─────────────────────────────────────────────────────────────────────────────

export const StockRequestDialog: React.FC<StockRequestDialogProps> = ({
  open,
  onClose,
  prefillItems,
  deliveryId,
  deliveryOrderNumber,
}) => {
  const [items,       setItems]       = useState<StockRequestItem[]>([]);
  const [notes,       setNotes]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [bottles,     setBottles]     = useState<DriverBottleStock[]>([]);
  const [consumables, setConsumables] = useState<DriverConsumableStock[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  // Load driver's current stock for the picker
  const loadStock = useCallback(async () => {
    setLoadingStock(true);
    try {
      const [b, c] = await Promise.all([
        driverStoreService.getBottleStock(),
        driverStoreService.getConsumableStock(),
      ]);
      setBottles(b);
      setConsumables(c);
    } catch {
      // non-fatal
    } finally {
      setLoadingStock(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setNotes('');

    if (prefillItems && prefillItems.length > 0) {
      setItems(prefillItems.map(i => ({ ...i })));
    } else {
      // Auto-populate with items that are low / out
      setItems([]);
    }

    loadStock();
  }, [open, prefillItems, loadStock]);

  // After stock loads, if no prefill, auto-add all items that need a top-up
  useEffect(() => {
    if (loadingStock || prefillItems?.length || items.length > 0) return;

    const autoItems: StockRequestItem[] = [
      ...bottles
        .filter(b => b.balance.full <= 5)
        .map(b => ({
          product_id:         b.product_id,
          product_name:       b.product_name,
          product_type:       'bottle' as const,
          current_qty:        b.balance.full,
          quantity_requested: Math.max(10, 10 - b.balance.full),
        })),
      ...consumables
        .filter(c => c.balance.in_stock <= 10)
        .map(c => ({
          product_id:         c.product_id,
          product_name:       c.product_name,
          product_type:       'consumable' as const,
          unit:               c.unit,
          current_qty:        c.balance.in_stock,
          quantity_requested: Math.max(10, 10 - c.balance.in_stock),
        })),
    ];

    if (autoItems.length > 0) setItems(autoItems);
  }, [loadingStock, bottles, consumables, prefillItems, items.length]);

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error('Add at least one product to request.');
      return;
    }
    setSubmitting(true);
    try {
      await axiosInstance.post('/driver/store/request-topup/', {
        items: items.map(i => ({
          product_id:         i.product_id,
          product_type:       i.product_type,
          quantity_requested: i.quantity_requested,
        })),
        delivery_id: deliveryId ?? undefined,
        notes:       notes.trim() || undefined,
      });
      setSubmitted(true);
      toast.success('Top-up request sent to the store!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Failed to send request. Please try again.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const existingIds = new Set(items.map(i => i.product_id));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border/60 z-10 overflow-hidden flex flex-col max-h-[92vh]">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <PackagePlus className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base">Request Stock Top-up</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {deliveryOrderNumber
                  ? `For delivery ${deliveryOrderNumber}`
                  : 'Send a restocking request to the store'
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Delivery context banner */}
        {deliveryId && deliveryOrderNumber && (
          <div className="mx-5 mt-4 flex items-center gap-2.5 px-3.5 py-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl shrink-0">
            <Truck className="h-4 w-4 text-indigo-600 shrink-0" />
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              This request will be linked to order {deliveryOrderNumber}
            </p>
          </div>
        )}

        {/* Success state */}
        {submitted ? (
          <div className="flex flex-col items-center justify-center px-5 py-12 gap-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-lg text-emerald-800 dark:text-emerald-300">
                Request Sent!
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                The store has been notified. They'll prepare your stock and confirm shortly.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 h-11 px-8 rounded-2xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3">

              {loadingStock && items.length === 0 ? (
                <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading stock…</span>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 rounded-2xl border border-dashed border-border">
                  <PackagePlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm font-semibold text-muted-foreground">No items added yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Add products you need restocked below.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Items to request ({items.length})
                    </p>
                  </div>
                  {items.map((item) => (
                    <RequestItemRow
                      key={item.product_id}
                      item={item}
                      onQtyChange={qty =>
                        setItems(prev =>
                          prev.map(i =>
                            i.product_id === item.product_id
                              ? { ...i, quantity_requested: qty }
                              : i,
                          ),
                        )
                      }
                      onRemove={() =>
                        setItems(prev => prev.filter(i => i.product_id !== item.product_id))
                      }
                    />
                  ))}
                </>
              )}

              {/* Add more products */}
              {!loadingStock && (
                <ProductPicker
                  bottles={bottles}
                  consumables={consumables}
                  existingIds={existingIds}
                  onAdd={item => setItems(prev => [...prev, item])}
                />
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Notes for the store (optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Urgent — delivery in 30 min, need 20L bottles specifically…"
                  className="w-full rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                />
              </div>

              {/* Info hint */}
              <div className="flex items-start gap-2.5 px-3.5 py-3 bg-muted/30 border border-border/40 rounded-2xl">
                <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  The store admin will see your request and distribute stock to your van.
                  You'll be notified once it's approved.
                </p>
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-5 pb-5 pt-3 border-t border-border/40 shrink-0 space-y-2.5">
              <button
                onClick={handleSubmit}
                disabled={items.length === 0 || submitting}
                className="w-full h-13 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-40 transition-colors active:scale-[0.98] shadow-md shadow-primary/20"
                style={{ height: '52px' }}
              >
                {submitting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />
                }
                {submitting ? 'Sending request…' : `Send Request${items.length > 0 ? ` (${items.length} item${items.length > 1 ? 's' : ''})` : ''}`}
              </button>
              <button
                onClick={onClose}
                className="w-full h-11 rounded-2xl border-2 border-border/60 font-bold text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* Safe area */}
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
};

export default StockRequestDialog;
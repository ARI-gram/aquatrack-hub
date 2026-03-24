/**
 * src/components/dialogs/DirectSaleDialog.tsx
 * ✅ Fix: unitPrice reads selling_price from van stock
 * ✅ Fix: QtyStepper added back for sale qty (min=1, amber)
 * ✅ Fix: QtyStepperWithZero for empties (min=0, blue) so 0 empties can be sent correctly
 */

import React, { useState, useEffect } from 'react';
import {
  Loader2, Droplets, Package, Check, Minus, Plus,
  ShoppingCart, X, User, Phone, UserCheck,
  ChevronRight, Search, InboxIcon,
  CheckCircle2, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  BottomSheet, Field, TextInput, TextArea, PrimaryButton,
} from './shared';
import {
  driverStoreService,
  type DriverBottleStock,
  type DriverConsumableStock,
} from '@/api/services/driver-store.service';
import axiosInstance from '@/api/axios.config';
import { DriverSaleReceiptModal } from '@/pages/driver/DriverSaleReceiptModal';
import type { DriverSaleData } from '@/pages/driver/DriverSaleReceiptModal';
import { useAuth } from '@/contexts/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CustomerResult {
  id:    string;
  name:  string;
  phone: string;
  email: string;
}

interface ProductOption {
  id:           string;
  name:         string;
  max:          number;
  unitPrice:    number;
  isReturnable: boolean;
}

type DialogStep = 'customer' | 'sale';

// ─────────────────────────────────────────────────────────────────────────────
// Customer picker step
// ─────────────────────────────────────────────────────────────────────────────

const CustomerPickerStep: React.FC<{
  onSelect: (c: CustomerResult) => void;
  onWalkIn: () => void;
}> = ({ onSelect, onWalkIn }) => {
  const [customers, setCustomers] = useState<CustomerResult[]>([]);
  const [filtered,  setFiltered]  = useState<CustomerResult[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [query,     setQuery]     = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get('/driver/customers/');
        const raw: CustomerResult[] = (res.data ?? []).map((c: {
          id: string; name: string; phone: string; email: string;
        }) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email }));
        setCustomers(raw);
        setFiltered(raw);
      } catch {
        toast.error('Could not load customers');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setFiltered(customers); return; }
    const q = query.toLowerCase();
    setFiltered(customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.email.toLowerCase().includes(q),
    ));
  }, [query, customers]);

  return (
    <div className="space-y-4 pb-2">
      <div className="flex flex-col items-center gap-2 pt-2 pb-1">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <User className="h-7 w-7 text-primary" />
        </div>
        <p className="font-bold text-base">Who is this sale for?</p>
        <p className="text-sm text-muted-foreground text-center max-w-[260px]">
          Select an existing customer or record as a walk-in.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by name or phone…"
          className="w-full h-11 pl-10 pr-10 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:border-primary/40"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <button
        onClick={onWalkIn}
        className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98] transition-all text-left"
      >
        <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Walk-in / Roadside Customer</p>
          <p className="text-xs text-muted-foreground mt-0.5">Record without linking to an account.</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border/50" />
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Existing customers</span>
        <div className="flex-1 h-px bg-border/50" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading customers…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <InboxIcon className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground">
            {query ? 'No customers match your filter' : 'No customers found'}
          </p>
          {query && (
            <button onClick={() => setQuery('')} className="text-xs text-primary underline underline-offset-2">
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5 pb-2">
          <p className="text-xs text-muted-foreground px-1">
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
            {query ? ` matching "${query}"` : ''}
          </p>
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98] transition-all text-left"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-base">
                {c.name.trim()[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{c.name}</p>
                {c.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3 shrink-0" />{c.phone}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Product card
// ─────────────────────────────────────────────────────────────────────────────

const ProductCard: React.FC<{
  product:  ProductOption;
  selected: boolean;
  onSelect: () => void;
}> = ({ product, selected, onSelect }) => (
  <button
    onClick={onSelect}
    disabled={product.max <= 0}
    className={cn(
      'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
      selected
        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
        : product.max <= 0
          ? 'border-border/40 bg-muted/20 opacity-50 cursor-not-allowed'
          : 'border-border/60 bg-card hover:border-border active:scale-[0.98]',
    )}
  >
    <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
      <Package className="h-5 w-5 text-muted-foreground" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold truncate">{product.name}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <p className={cn(
          'text-xs font-medium',
          product.max <= 0 ? 'text-destructive' : product.max <= 5 ? 'text-amber-600' : 'text-muted-foreground',
        )}>
          {product.max <= 0 ? 'Out of stock' : `${product.max} available`}
        </p>
        {product.unitPrice > 0 && (
          <span className="text-xs font-semibold text-emerald-600">
            KES {product.unitPrice.toLocaleString('en-KE')}
          </span>
        )}
      </div>
    </div>
    {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// QtyStepper — sale quantity, min=1, value shown in AMBER
// ─────────────────────────────────────────────────────────────────────────────

const QtyStepper: React.FC<{
  value:    number;
  max:      number;
  onChange: (n: number) => void;
}> = ({ value, max, onChange }) => (
  <div className="flex items-center justify-center gap-6">
    <button
      onClick={() => onChange(Math.max(1, value - 1))}
      disabled={value <= 1}
      className="h-12 w-12 rounded-full border border-border/80 bg-muted/40 flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors active:scale-90"
    >
      <Minus className="h-5 w-5" />
    </button>
    <div className="text-center min-w-[64px]">
      <span className="text-4xl font-black tabular-nums text-amber-600">{value}</span>
      <p className="text-[10px] text-muted-foreground mt-0.5">of {max}</p>
    </div>
    <button
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
      className="h-12 w-12 rounded-full border border-border/80 bg-muted/40 flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors active:scale-90"
    >
      <Plus className="h-5 w-5" />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// QtyStepperWithZero — empties collection, min=0, value shown in BLUE
// ─────────────────────────────────────────────────────────────────────────────

const QtyStepperWithZero: React.FC<{
  value:    number;
  max:      number;
  min?:     number;
  onChange: (n: number) => void;
}> = ({ value, max, min = 0, onChange }) => (
  <div className="flex items-center justify-center gap-6">
    <button
      onClick={() => onChange(Math.max(min, value - 1))}
      disabled={value <= min}
      className="h-12 w-12 rounded-full border border-border/80 bg-muted/40 flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors active:scale-90"
    >
      <Minus className="h-5 w-5" />
    </button>
    <div className="text-center min-w-[64px]">
      <span className="text-4xl font-black tabular-nums text-blue-600">{value}</span>
      <p className="text-[10px] text-muted-foreground mt-0.5">of {max}</p>
    </div>
    <button
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
      className="h-12 w-12 rounded-full border border-border/80 bg-muted/40 flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors active:scale-90"
    >
      <Plus className="h-5 w-5" />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main dialog
// ─────────────────────────────────────────────────────────────────────────────

export const DirectSaleDialog: React.FC<{
  open:        boolean;
  onClose:     () => void;
  onDone:      () => void;
  bottles:     DriverBottleStock[];
  consumables: DriverConsumableStock[];
}> = ({ open, onClose, onDone, bottles, consumables }) => {
  const { user } = useAuth();

  const [step,             setStep]             = useState<DialogStep>('customer');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [isWalkIn,         setIsWalkIn]         = useState(false);
  const [productType,      setProductType]      = useState<'bottle' | 'consumable'>('bottle');
  const [productId,        setProductId]        = useState('');
  const [qty,              setQty]              = useState(1);
  const [qtyCollected,     setQtyCollected]     = useState(0);
  const [customerName,     setCustomerName]     = useState('');
  const [notes,            setNotes]            = useState('');
  const [submitting,       setSubmitting]       = useState(false);
  const [showReceipt,      setShowReceipt]      = useState(false);
  const [saleData,         setSaleData]         = useState<DriverSaleData | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('customer');
      setSelectedCustomer(null);
      setIsWalkIn(false);
      setProductId(''); setQty(1); setQtyCollected(0);
      setCustomerName(''); setNotes('');
      setProductType('bottle');
    }
  }, [open]);

  const handleSelectCustomer = (c: CustomerResult) => {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setIsWalkIn(false);
    setStep('sale');
  };

  const handleWalkIn = () => {
    setSelectedCustomer(null);
    setIsWalkIn(true);
    setCustomerName('');
    setStep('sale');
  };

  const handleBack = () => {
    setStep('customer');
    setSelectedCustomer(null);
    setIsWalkIn(false);
    setProductId(''); setQty(1);
  };

  const products: ProductOption[] = productType === 'bottle'
    ? bottles.map(b => ({
        id:           b.product_id,
        name:         b.product_name,
        max:          b.balance.full,
        unitPrice:    b.selling_price ? parseFloat(b.selling_price) : 0,
        isReturnable: true,
      }))
    : consumables.map(c => ({
        id:           c.product_id,
        name:         c.product_name,
        max:          c.balance.in_stock,
        unitPrice:    c.selling_price ? parseFloat(c.selling_price) : 0,
        isReturnable: false,
      }));

  const selected = products.find(p => p.id === productId);

  const switchType = (t: 'bottle' | 'consumable') => {
    setProductType(t); setProductId(''); setQty(1); setQtyCollected(0);
  };

  const handleSubmit = async () => {
    if (!productId)                               { toast.error('Select a product'); return; }
    if (qty < 1)                                  { toast.error('Quantity must be at least 1'); return; }
    if (isWalkIn && !customerName.trim())         { toast.error('Enter a customer name'); return; }

    setSubmitting(true);
    try {
      const noteParts = [
        selectedCustomer
          ? `Customer: ${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}`
          : customerName.trim()
            ? `Walk-in: ${customerName.trim()}`
            : 'Walk-in sale',
        notes.trim(),
      ].filter(Boolean);

      await driverStoreService.recordUse({
        product_id:    productId,
        product_type:  productType,
        quantity:      qty,
        customer_id:   selectedCustomer?.id,
        notes:         noteParts.join(' · '),
        // ✅ always send qty_collected for returnable products
        // even if 0 — so backend knows empties were not collected
        qty_collected: selected?.isReturnable ? qtyCollected : undefined,
      });

      toast.success(
        `Sale recorded — ${qty} × ${selected?.name}${selectedCustomer ? ` for ${selectedCustomer.name}` : ''}`,
      );

      const servedBy = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Driver';
      const receipt: DriverSaleData = {
        productName:   selected?.name    ?? 'Product',
        productUnit:   productType === 'bottle' ? 'BOTTLES' : 'UNITS',
        isReturnable:  selected?.isReturnable ?? productType === 'bottle',
        quantity:      qty,
        unitPrice:     selected?.unitPrice ?? 0,
        customerName:  (selectedCustomer?.name ?? customerName.trim()) || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone ?? undefined,
        isWalkIn:      !selectedCustomer,
        paymentMethod: 'CASH',
        servedBy,
        date:          new Date().toISOString(),
      };

      setSaleData(receipt);
      setShowReceipt(true);
      onClose();

    } catch {
      toast.error('Failed to record sale');
    } finally {
      setSubmitting(false);
    }
  };

  const dialogTitle = step === 'customer'
    ? 'Direct Sale — Select Customer'
    : selectedCustomer
      ? `Sale for ${selectedCustomer.name}`
      : 'Walk-in Sale';

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={dialogTitle}
        titleRight={
          step === 'sale' ? (
            <button
              onClick={handleBack}
              className="text-xs font-semibold text-primary px-2 py-1 rounded-lg active:bg-primary/10"
            >
              ← Back
            </button>
          ) : undefined
        }
      >
        {/* ── Step 1: customer picker ── */}
        {step === 'customer' && (
          <CustomerPickerStep
            onSelect={handleSelectCustomer}
            onWalkIn={handleWalkIn}
          />
        )}

        {/* ── Step 2: sale form ── */}
        {step === 'sale' && (
          <div className="space-y-5 pb-6">

            {/* Customer chip */}
            <div className={cn(
              'flex items-center gap-3 p-3.5 rounded-xl border-2',
              selectedCustomer
                ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800'
                : 'border-border/60 bg-muted/30',
            )}>
              {selectedCustomer ? (
                <>
                  <UserCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-emerald-800 dark:text-emerald-300 truncate">
                      {selectedCustomer.name}
                    </p>
                    {selectedCustomer.phone && (
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />{selectedCustomer.phone}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 rounded-full px-2 py-0.5 shrink-0">
                    Account
                  </span>
                </>
              ) : (
                <>
                  <User className="h-5 w-5 text-muted-foreground shrink-0" />
                  <p className="font-semibold text-sm text-muted-foreground">Walk-in Customer</p>
                </>
              )}
            </div>

            {/* Walk-in name input */}
            {isWalkIn && (
              <Field label="Customer Name" required>
                <TextInput
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  autoFocus
                />
              </Field>
            )}

            {/* Product type toggle */}
            <div className="grid grid-cols-2 gap-2 bg-muted/40 p-1 rounded-2xl">
              {([
                { key: 'bottle'     as const, label: 'Bottles',     icon: <Droplets className="h-3.5 w-3.5" /> },
                { key: 'consumable' as const, label: 'Consumables', icon: <Package  className="h-3.5 w-3.5" /> },
              ]).map(t => (
                <button
                  key={t.key}
                  onClick={() => switchType(t.key)}
                  className={cn(
                    'py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all',
                    productType === t.key
                      ? 'bg-background shadow-sm border border-border/60 text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* Product list */}
            <Field label="Product" required>
              {products.length === 0 ? (
                <div className="text-center py-6 rounded-xl border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">No {productType}s on your van.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                  {products.map(p => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      selected={productId === p.id}
                      onSelect={() => { setProductId(p.id); setQty(1); setQtyCollected(0); }}
                    />
                  ))}
                </div>
              )}
            </Field>

            {/* Sale qty stepper — amber, min=1 */}
            {selected && (
              <Field label="Quantity">
                <div className="py-2">
                  <QtyStepper
                    value={qty}
                    max={selected.max}
                    onChange={v => { setQty(v); setQtyCollected(c => Math.min(c, v)); }}
                  />
                </div>
                {selected.unitPrice > 0 && (
                  <p className="text-center text-sm font-bold text-emerald-600 mt-2">
                    Total: KES {(qty * selected.unitPrice).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </Field>
            )}

            {/* Collect empties — blue stepper, min=0, only for returnable */}
            {selected?.isReturnable && qty > 0 && (
              <div className="rounded-2xl border-2 border-blue-100 dark:border-blue-900/40 bg-card p-4 space-y-3">
                <div>
                  <p className="text-sm font-bold flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-blue-600" />
                    Collect empty bottles back
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    How many empty bottles is the customer returning now?
                  </p>
                </div>

                {/* ✅ QtyStepperWithZero — can go to 0 so backend receives correct value */}
                <QtyStepperWithZero
                  value={qtyCollected}
                  max={qty}
                  min={0}
                  onChange={setQtyCollected}
                />

                {qtyCollected === 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-950/30 dark:border-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                      No empties collected — the customer owes {qty} bottle{qty !== 1 ? 's' : ''} back.
                    </p>
                  </div>
                )}
                {qtyCollected > 0 && qtyCollected < qty && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-950/30 dark:border-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                      {qty - qtyCollected} bottle{qty - qtyCollected !== 1 ? 's' : ''} still outstanding.
                    </p>
                  </div>
                )}
                {qtyCollected === qty && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-950/30 dark:border-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                      All empties collected ✓
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <Field label="Notes (optional)">
              <TextArea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any notes about this sale…"
              />
            </Field>

            <PrimaryButton
              onClick={handleSubmit}
              loading={submitting}
              loadingLabel="Recording…"
              disabled={
                !productId ||
                qty < 1 ||
                (!!selected && qty > selected.max) ||
                (isWalkIn && !customerName.trim())
              }
              label={
                selectedCustomer
                  ? `Record Sale for ${selectedCustomer.name}`
                  : 'Record Walk-in Sale'
              }
              icon={<ShoppingCart className="h-5 w-5" />}
              color="amber"
            />
          </div>
        )}
      </BottomSheet>

      {/* Receipt modal */}
      {saleData && (
        <DriverSaleReceiptModal
          open={showReceipt}
          onClose={() => {
            setShowReceipt(false);
            setSaleData(null);
            onDone();
          }}
          sale={saleData}
        />
      )}
    </>
  );
};

export default DirectSaleDialog;
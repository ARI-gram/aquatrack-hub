/**
 * src/components/dialogs/DirectSaleDialog.tsx
 *
 * Restyled to match StorePage DirectSaleDialog visual language:
 *  - Dialog (not BottomSheet) with amber gradient header
 *  - Same customer chip, product cards, qty steppers, empties section
 *  - Payment method selector — mirrors StorePage logic:
 *      · Walk-in → CASH + MPESA only
 *      · Account customer → all 4 methods; credit auto-selected if active, CASH if frozen
 *      · Profile fetched from /driver/customers/:id/ (graceful fallback if unavailable)
 *  - All original driver logic preserved (CustomerPickerStep, receipt modal, etc.)
 */

import React, { useState, useEffect } from 'react';
import {
  Loader2, Droplets, Package, Check, Minus, Plus,
  ShoppingCart, X, User, Phone, UserCheck,
  ChevronRight, Search, InboxIcon,
  CheckCircle2, AlertTriangle, RotateCcw, ShoppingBag, ImageOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input }    from '@/components/ui/input';
import { Button }   from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
// Payment method config — mirrors StorePage
// ─────────────────────────────────────────────────────────────────────────────

const DIRECT_SALE_PAYMENT_METHODS = [
  { value: 'CASH',          label: 'Cash',               icon: '💵', desc: 'Collect cash on the spot'  },
  { value: 'MPESA',         label: 'M-Pesa',             icon: '📱', desc: 'Mobile money transfer'      },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer',      icon: '🏦', desc: 'Direct bank payment'        },
  { value: 'CREDIT',        label: 'Pay Later (Credit)', icon: '🧾', desc: 'Added to customer invoice'  },
] as const;

type DirectSalePM = typeof DIRECT_SALE_PAYMENT_METHODS[number]['value'];

// ─────────────────────────────────────────────────────────────────────────────
// Minimal credit-terms shape — only what we display
// ─────────────────────────────────────────────────────────────────────────────

interface CustomerCreditTerms {
  account_frozen:         boolean;
  is_in_grace_period?:    boolean;
  grace_days_remaining?:  number | null;
  billing_cycle_display?: string;
  available_credit?:      string;
}

interface CustomerProfile {
  credit_terms?: CustomerCreditTerms | null;
}

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
  imageUrl?:    string | null;
}

type DialogStep = 'customer' | 'sale';

// ─────────────────────────────────────────────────────────────────────────────
// Field wrapper
// ─────────────────────────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}> = ({ label, required, hint, children }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

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
      <div className="flex flex-col items-center gap-2 pt-1 pb-1">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <User className="h-7 w-7 text-amber-600" />
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
          className="w-full h-11 pl-10 pr-10 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:border-amber-400/50"
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
        className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-border/60 hover:border-amber-400/40 hover:bg-amber-500/5 active:scale-[0.98] transition-all text-left"
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
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-card hover:border-amber-400/40 hover:bg-amber-500/5 active:scale-[0.98] transition-all text-left"
            >
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 font-bold text-base">
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
        ? 'border-amber-400 bg-amber-500/5 ring-1 ring-amber-400/20'
        : product.max <= 0
          ? 'border-border/40 bg-muted/20 opacity-50 cursor-not-allowed'
          : 'border-border/60 bg-card hover:border-border active:scale-[0.98]',
    )}
  >
    {product.imageUrl ? (
      <img
        src={product.imageUrl}
        alt={product.name}
        className="h-10 w-10 rounded-xl object-cover shrink-0 border border-border/30"
        onError={e => {
          const t = e.currentTarget;
          t.style.display = 'none';
          t.nextElementSibling?.removeAttribute('style');
        }}
      />
    ) : null}
    <div
      className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 border border-border/30"
      style={product.imageUrl ? { display: 'none' } : undefined}
    >
      <ImageOff className="h-4 w-4 text-muted-foreground/40" />
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
    {selected && <Check className="h-4 w-4 text-amber-600 shrink-0" />}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// QtyStepper — amber, min=1
// ─────────────────────────────────────────────────────────────────────────────

const QtyStepper: React.FC<{
  value: number; max: number; onChange: (n: number) => void;
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
// QtyStepperWithZero — blue, min=0
// ─────────────────────────────────────────────────────────────────────────────

const QtyStepperWithZero: React.FC<{
  value: number; max: number; min?: number; onChange: (n: number) => void;
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

  // ── Payment method state ─────────────────────────────────────────────────
  const [paymentMethod,   setPaymentMethod]   = useState<DirectSalePM | ''>('');
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [profileLoading,  setProfileLoading]  = useState(false);

  // ── Reset on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setStep('customer');
      setSelectedCustomer(null);
      setIsWalkIn(false);
      setProductId(''); setQty(1); setQtyCollected(0);
      setCustomerName(''); setNotes('');
      setProductType('bottle');
      setPaymentMethod('');
      setCustomerProfile(null);
      setProfileLoading(false);
    }
  }, [open]);

  // ── Customer selected — fetch credit profile ─────────────────────────────
  const handleSelectCustomer = async (c: CustomerResult) => {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setIsWalkIn(false);
    setStep('sale');

    setProfileLoading(true);
    try {
      // Drivers fetch from their own scoped endpoint; fall back gracefully if
      // the response doesn't include credit_terms (older API versions).
      const res = await axiosInstance.get<CustomerProfile>(`/driver/customers/${c.id}/`);
      const profile = res.data ?? null;
      setCustomerProfile(profile);

      const ct      = profile?.credit_terms;
      const frozen  = ct?.account_frozen ?? false;
      const hasCredit = !!ct && !frozen;

      setPaymentMethod(hasCredit ? 'CREDIT' : 'CASH');
    } catch {
      // Endpoint may not exist for drivers — default to CASH silently.
      setCustomerProfile(null);
      setPaymentMethod('CASH');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleWalkIn = () => {
    setSelectedCustomer(null);
    setCustomerProfile(null);
    setIsWalkIn(true);
    setCustomerName('');
    setPaymentMethod('CASH');
    setStep('sale');
  };

  const handleBack = () => {
    setStep('customer');
    setSelectedCustomer(null);
    setCustomerProfile(null);
    setIsWalkIn(false);
    setCustomerName('');
    setPaymentMethod('');
    setProductId(''); setQty(1); setQtyCollected(0);
  };

  // ── Products ─────────────────────────────────────────────────────────────
  const products: ProductOption[] = productType === 'bottle'
    ? bottles.map(b => ({
        id:           b.product_id,
        name:         b.product_name,
        max:          b.balance.full,
        unitPrice:    b.selling_price ? parseFloat(b.selling_price) : 0,
        isReturnable: true,
        imageUrl:     b.product_image ?? null,
      }))
    : consumables.map(c => ({
        id:           c.product_id,
        name:         c.product_name,
        max:          c.balance.in_stock,
        unitPrice:    c.selling_price ? parseFloat(c.selling_price) : 0,
        isReturnable: false,
        imageUrl:     c.product_image ?? null,
      }));

  const selected = products.find(p => p.id === productId);

  const switchType = (t: 'bottle' | 'consumable') => {
    setProductType(t); setProductId(''); setQty(1); setQtyCollected(0);
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const canSubmit =
    !!productId &&
    qty >= 1 &&
    !!paymentMethod &&
    !(isWalkIn && !customerName.trim());

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!productId)                       { toast.error('Select a product'); return; }
    if (qty < 1)                          { toast.error('Quantity must be at least 1'); return; }
    if (isWalkIn && !customerName.trim()) { toast.error('Enter a customer name'); return; }

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
        qty_collected: selected?.isReturnable ? qtyCollected : undefined,
        payment_method: paymentMethod as DirectSalePM,
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
        paymentMethod: (paymentMethod || 'CASH') as DriverSaleData['paymentMethod'],
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

  // ── Credit-terms shorthand ────────────────────────────────────────────────
  const ct     = customerProfile?.credit_terms;
  const frozen = ct?.account_frozen ?? false;

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">

          {/* ── Amber gradient header ── */}
          <div className="bg-gradient-to-br from-amber-500/10 to-transparent -mx-6 -mt-6 px-6 pt-6 pb-5 mb-2 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold truncate">{dialogTitle}</DialogTitle>
                <DialogDescription className="text-xs mt-0">
                  {step === 'customer'
                    ? 'Choose a customer to continue'
                    : 'Configure and record the sale'}
                </DialogDescription>
              </div>
              {step === 'sale' && (
                <button
                  onClick={handleBack}
                  className="text-xs font-semibold text-amber-600 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                >
                  ← Back
                </button>
              )}
            </div>
          </div>

          {/* ── Step 1: customer picker ── */}
          {step === 'customer' && (
            <CustomerPickerStep
              onSelect={handleSelectCustomer}
              onWalkIn={handleWalkIn}
            />
          )}

          {/* ── Step 2: sale form ── */}
          {step === 'sale' && (
            <div className="space-y-5 pb-2">

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

              {/* ── Payment method ─────────────────────────────────────────── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Payment Method</p>
                  {profileLoading && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Detecting…
                    </span>
                  )}
                </div>

                {/* Frozen credit warning */}
                {frozen && (
                  <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-destructive">Credit account frozen</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        This customer's credit is paused due to an outstanding balance. Please collect payment now.
                      </p>
                    </div>
                  </div>
                )}

                {/* Grace period warning */}
                {ct?.is_in_grace_period && !frozen && (
                  <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Invoice overdue — grace period active</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ct.grace_days_remaining ?? 0} grace day(s) remaining.
                        Credit is still available but payment is overdue.
                      </p>
                    </div>
                  </div>
                )}

                {/* Active credit summary chip */}
                {paymentMethod === 'CREDIT' && ct && !frozen && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-purple-500/8 border border-purple-300/40 dark:border-purple-700/40">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🧾</span>
                      <div>
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-300">Credit account</p>
                        {ct.billing_cycle_display && (
                          <p className="text-xs text-muted-foreground">{ct.billing_cycle_display} billing</p>
                        )}
                      </div>
                    </div>
                    {ct.available_credit && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Available credit</p>
                        <p className="text-sm font-bold text-purple-700 dark:text-purple-300 tabular-nums">
                          KES {parseFloat(ct.available_credit).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment method buttons */}
                <div className="space-y-2">
                  {DIRECT_SALE_PAYMENT_METHODS
                    .filter(pm => {
                      // Walk-in: cash and M-Pesa only
                      if (isWalkIn) return pm.value === 'CASH' || pm.value === 'MPESA';
                      // Frozen credit accounts cannot use credit
                      if (frozen && pm.value === 'CREDIT') return false;
                      // Customers with no credit_terms cannot use credit
                      if (!ct && pm.value === 'CREDIT') return false;
                      return true;
                    })
                    .map(pm => (
                      <button
                        key={pm.value}
                        type="button"
                        disabled={pm.value === 'CREDIT' && frozen}
                        onClick={() => setPaymentMethod(pm.value)}
                        className={cn(
                          'flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-left transition-all',
                          'disabled:opacity-40 disabled:cursor-not-allowed',
                          paymentMethod === pm.value
                            ? pm.value === 'CREDIT'
                              ? 'border-purple-400/60 bg-purple-500/8 ring-1 ring-purple-400/20'
                              : pm.value === 'MPESA'
                              ? 'border-green-400/60 bg-green-500/8 ring-1 ring-green-400/20'
                              : pm.value === 'BANK_TRANSFER'
                              ? 'border-blue-400/60 bg-blue-500/8 ring-1 ring-blue-400/20'
                              : 'border-emerald-400/60 bg-emerald-500/8 ring-1 ring-emerald-400/20'
                            : 'border-border/60 bg-card hover:bg-muted/30',
                        )}
                      >
                        <span className="text-xl shrink-0">{pm.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm font-bold',
                            paymentMethod === pm.value
                              ? pm.value === 'CREDIT'        ? 'text-purple-700 dark:text-purple-300'
                              : pm.value === 'MPESA'         ? 'text-green-700 dark:text-green-300'
                              : pm.value === 'BANK_TRANSFER' ? 'text-blue-700 dark:text-blue-300'
                              : 'text-emerald-700 dark:text-emerald-300'
                              : 'text-foreground',
                          )}>
                            {pm.label}{paymentMethod === pm.value && ' ✓'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{pm.desc}</p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>

              {/* Walk-in name */}
              {isWalkIn && (
                <Field label="Customer Name" required>
                  <Input
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

              {/* Qty stepper — amber, min=1 */}
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

              {/* Collect empties — blue, min=0, bottles only */}
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
                        No empties collected — customer owes {qty} bottle{qty !== 1 ? 's' : ''} back.
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
                <Textarea
                  rows={2}
                  className="resize-none"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any notes about this sale…"
                />
              </Field>

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="ocean"
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                >
                  {submitting
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Recording…</>
                    : <><ShoppingCart className="h-4 w-4 mr-2" />
                        {selectedCustomer ? `Sell to ${selectedCustomer.name}` : 'Record Walk-in Sale'}
                      </>
                  }
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

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
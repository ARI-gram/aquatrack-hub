/**
 * src/pages/client/DirectSalesPage.tsx
 * Route: /client/direct-sales
 *
 * Unified view of ALL direct sales:
 *  - Driver roadside sales  (from driver stock movements)
 *  - Admin / client-admin sales (from bottle + consumable store history)
 *    → "Admin" replaces "Store" — shows recorded_by_name as the seller
 *
 * Changes:
 *  ✅ Added "New Direct Sale" button — opens DirectSaleDialog (bottle + consumable)
 *  ✅ DirectSaleDialog imported from StorePage logic (self-contained copy)
 *  ✅ After a sale is recorded the list auto-refreshes
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ManagerLayout }   from '@/components/layout/ManagerLayout';
import { Input }  from '@/components/ui/input';
import { Badge }  from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ShoppingBag, Droplets, Package, Loader2,
  Search, RefreshCw, InboxIcon, User,
  Phone, X, TrendingUp, Users, Calendar,
  UserCog, Truck, Plus, Check, UserCheck,
  ChevronRight, ImageOff, Minus, RotateCcw,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { driverStoreService }                          from '@/api/services/driver-store.service';
import { bottleStoreService, consumableStoreService }  from '@/api/services/store.service';
import type {
  BottleProductStore,
  ConsumableProductStore,
} from '@/api/services/store.service';
import { customerAdminService, type AdminCustomer }    from '@/api/services/customerAdmin.service';
import { DriverSaleReceiptModal }                      from '@/pages/driver/DriverSaleReceiptModal';
import type { DriverSaleData }                         from '@/pages/driver/DriverSaleReceiptModal';
import axiosInstance                                   from '@/api/axios.config';
import { useAuth }                                     from '@/contexts/AuthContext';
import { toast }                                       from 'sonner';
import { cn }                                          from '@/lib/utils';
import { format }                                      from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DirectSale {
  id:                  string;
  movement_date:       string;
  product_name:        string;
  product_type:        'bottle' | 'consumable';
  quantity:            number;
  driver_name?:        string;
  driver_id?:          string;
  recorded_by_name?:   string | null;
  customer_name?:      string;
  notes:               string;
  source:              'driver' | 'admin';
}

interface DriverOption {
  id:   string;
  name: string;
}

interface StoreHistoryItem {
  id:                string;
  movement_type:     string;
  movement_date:     string;
  product_name?:     string;
  driver_name?:      string | null;
  customer_name?:    string;
  recorded_by_name?: string | null;
  notes?:            string;
  qty_total?:        number;
  quantity?:         number;
}

interface DeliveriesPageProps {
  layout?: 'dashboard' | 'manager';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sale dialog types
// ─────────────────────────────────────────────────────────────────────────────

interface CustomerResult {
  id:    string;
  name:  string;
  phone: string;
  email: string;
}

interface SaleProductOption {
  id:            string;
  name:          string;
  maxQty:        number;
  selling_price?: string;
  unit?:         string;
  imageUrl?:     string | null;
}

type SaleStep     = 'customer' | 'sale';
type SaleMode     = 'bottle' | 'consumable' | null; // null = dialog closed

const DIRECT_SALE_PAYMENT_METHODS = [
  { value: 'CASH',          label: 'Cash',               icon: '💵', desc: 'Collect cash on the spot'    },
  { value: 'MPESA',         label: 'M-Pesa',             icon: '📱', desc: 'Mobile money transfer'        },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer',      icon: '🏦', desc: 'Direct bank payment'          },
  { value: 'CREDIT',        label: 'Pay Later (Credit)', icon: '🧾', desc: 'Added to customer invoice'    },
] as const;
type DirectSalePM = typeof DIRECT_SALE_PAYMENT_METHODS[number]['value'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseLocal(iso: string): Date {
  if (!iso || typeof iso !== 'string') return new Date(0);
  const clean = iso.replace('Z', '');
  const [datePart, timePart = '00:00:00'] = clean.split('T');
  if (!datePart || !datePart.includes('-')) return new Date(0);
  const [year, month, day]                 = datePart.split('-').map(Number);
  const [hour = 0, minute = 0, second = 0] = timePart.split(':').map(Number);
  const d = new Date(year, month - 1, day, hour, minute, second);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function dateLabel(iso: string): string {
  if (!iso) return 'Unknown date';
  const d   = parseLocal(iso);
  if (d.getTime() === 0) return 'Unknown date';
  const now = new Date();

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (sameDay(d, now))       return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return format(d, 'EEE, d MMM yyyy');
}

function sortNewestFirst<T extends { movement_date: string }>(arr: T[]): T[] {
  return [...arr].sort(
    (a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime(),
  );
}

function groupByDate(items: DirectSale[]): Record<string, DirectSale[]> {
  const g: Record<string, DirectSale[]> = {};
  for (const item of items) {
    const k = dateLabel(item.movement_date);
    if (!g[k]) g[k] = [];
    g[k].push(item);
  }
  return g;
}

function parseCustomer(notes: string): { name: string; phone: string; isAccount: boolean } {
  if (!notes) return { name: 'Walk-in', phone: '', isAccount: false };
  const custMatch = notes.match(/^Customer:\s*([^(·\n]+?)(?:\s*\(([^)]+)\))?(?:\s*·|$)/i);
  if (custMatch) return {
    name:      custMatch[1].trim(),
    phone:     custMatch[2]?.trim() ?? '',
    isAccount: true,
  };
  const walkMatch = notes.match(/^Walk-in:\s*([^·\n]+)/i);
  if (walkMatch) return { name: walkMatch[1].trim(), phone: '', isAccount: false };
  return { name: 'Walk-in', phone: '', isAccount: false };
}

function extractAdminSales(
  products: Array<{ product_name: string; history: StoreHistoryItem[] }>,
  productType: 'bottle' | 'consumable',
): DirectSale[] {
  const out: DirectSale[] = [];
  for (const product of products) {
    for (const h of product.history) {
      if (h.movement_type !== 'DIRECT_SALE') continue;
      if (!h.movement_date) continue;
      out.push({
        id:               `admin-${h.id}`,
        movement_date:    h.movement_date,
        product_name:     product.product_name,
        product_type:     productType,
        quantity:         h.qty_total ?? h.quantity ?? 0,
        driver_name:      h.driver_name      ?? undefined,
        driver_id:        undefined,
        recorded_by_name: h.recorded_by_name ?? null,
        customer_name:    h.customer_name    ?? undefined,
        notes:            h.notes            ?? '',
        source:           'admin',
      });
    }
  }
  return out;
}

function passesDateFilter(iso: string, dateFrom: string, dateTo: string): boolean {
  if (!dateFrom && !dateTo) return true;
  const d = parseLocal(iso);
  if (dateFrom) {
    const [y, m, day] = dateFrom.split('-').map(Number);
    if (d < new Date(y, m - 1, day, 0, 0, 0)) return false;
  }
  if (dateTo) {
    const [y, m, day] = dateTo.split('-').map(Number);
    if (d > new Date(y, m - 1, day, 23, 59, 59)) return false;
  }
  return true;
}

function getUnitLabel(unit?: string): string {
  const map: Record<string, string> = {
    BOTTLES: 'Bottles', LITRES: 'Litres', DOZENS: 'Dozens',
    PIECES: 'Pieces', CRATES: 'Crates', JERRICANS: 'Jerricans',
    SACHETS: 'Sachets', GALLONS: 'Gallons', PACKS: 'Packs', CARTONS: 'Cartons',
  };
  return map[unit ?? ''] ?? (unit ?? '');
}

function getUnitColor(unit?: string): string {
  const map: Record<string, string> = {
    BOTTLES: 'text-violet-500 bg-violet-500/10', LITRES: 'text-sky-500 bg-sky-500/10',
    DOZENS: 'text-amber-500 bg-amber-500/10', PIECES: 'text-emerald-500 bg-emerald-500/10',
    CRATES: 'text-orange-500 bg-orange-500/10', JERRICANS: 'text-cyan-500 bg-cyan-500/10',
    SACHETS: 'text-pink-500 bg-pink-500/10', GALLONS: 'text-blue-500 bg-blue-500/10',
    PACKS: 'text-indigo-500 bg-indigo-500/10', CARTONS: 'text-rose-500 bg-rose-500/10',
  };
  return map[unit ?? ''] ?? 'text-muted-foreground bg-muted';
}

// ─────────────────────────────────────────────────────────────────────────────
// Source badge
// ─────────────────────────────────────────────────────────────────────────────

const SourceBadge: React.FC<{ source: DirectSale['source'] }> = ({ source }) =>
  source === 'driver' ? (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700 rounded-full px-1.5 py-0.5 shrink-0">
      <Truck   className="h-2.5 w-2.5" />Driver
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-700 rounded-full px-1.5 py-0.5 shrink-0">
      <UserCog className="h-2.5 w-2.5" />Admin
    </span>
  );

function soldBy(sale: DirectSale): string {
  if (sale.source === 'driver') return sale.driver_name ?? 'Driver';
  return sale.recorded_by_name ?? 'Admin';
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop table row
// ─────────────────────────────────────────────────────────────────────────────

const SaleRow: React.FC<{ sale: DirectSale; isEven: boolean }> = ({ sale, isEven }) => {
  const { name: custName, phone, isAccount } = parseCustomer(sale.notes);
  const seller = soldBy(sale);

  return (
    <tr className={cn(
      'border-b last:border-0 transition-colors hover:bg-muted/30',
      isEven ? 'bg-background' : 'bg-muted/10',
    )}>
      <td className="px-4 py-3.5">
        <p className="text-sm font-semibold">
          {sale.movement_date ? format(parseLocal(sale.movement_date), 'dd MMM yyyy') : '—'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {sale.movement_date ? format(parseLocal(sale.movement_date), 'HH:mm') : '—'}
        </p>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className={cn(
            'h-7 w-7 rounded-full flex items-center justify-center shrink-0 font-bold text-xs',
            sale.source === 'driver' ? 'bg-violet-500/10 text-violet-600' : 'bg-teal-500/10 text-teal-600',
          )}>
            {seller.trim()[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{seller}</p>
            <SourceBadge source={sale.source} />
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className={cn(
            'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
            sale.product_type === 'bottle' ? 'bg-blue-500/10 text-blue-600' : 'bg-sky-500/10 text-sky-600',
          )}>
            {sale.product_type === 'bottle'
              ? <Droplets className="h-3.5 w-3.5" />
              : <Package  className="h-3.5 w-3.5" />
            }
          </div>
          <span className="text-sm">{sale.product_name}</span>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <span className="font-bold text-amber-600 tabular-nums text-base">×{sale.quantity}</span>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className={cn(
            'h-6 w-6 rounded-full flex items-center justify-center shrink-0',
            isAccount ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground',
          )}>
            <User className="h-3 w-3" />
          </div>
          <div className="min-w-0">
            <p className={cn(
              'text-sm font-medium truncate',
              isAccount ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground',
            )}>
              {sale.customer_name || custName}
            </p>
            {phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone className="h-2.5 w-2.5" />{phone}
              </p>
            )}
          </div>
          {isAccount && (
            <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 rounded-full px-1.5 py-0.5 shrink-0">
              Account
            </span>
          )}
        </div>
      </td>
    </tr>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Mobile card
// ─────────────────────────────────────────────────────────────────────────────

const SaleCard: React.FC<{ sale: DirectSale }> = ({ sale }) => {
  const { name: custName, phone, isAccount } = parseCustomer(sale.notes);
  const seller = soldBy(sale);

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className={cn('h-[3px] w-full', sale.source === 'driver' ? 'bg-violet-400' : 'bg-teal-400')} />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
              sale.product_type === 'bottle' ? 'bg-blue-500/10 text-blue-600' : 'bg-sky-500/10 text-sky-600',
            )}>
              {sale.product_type === 'bottle' ? <Droplets className="h-5 w-5" /> : <Package className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{sale.product_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sale.movement_date ? format(parseLocal(sale.movement_date), 'dd MMM · HH:mm') : '—'}
              </p>
            </div>
          </div>
          <span className="text-2xl font-black tabular-nums text-amber-600 shrink-0">×{sale.quantity}</span>
        </div>

        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl border',
          sale.source === 'driver'
            ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900'
            : 'bg-teal-50 dark:bg-teal-950/30 border-teal-100 dark:border-teal-900',
        )}>
          <div className={cn(
            'h-6 w-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[10px]',
            sale.source === 'driver' ? 'bg-violet-500/20 text-violet-600' : 'bg-teal-500/20 text-teal-600',
          )}>
            {seller.trim()[0]?.toUpperCase() ?? '?'}
          </div>
          <p className={cn(
            'text-xs font-semibold truncate flex-1',
            sale.source === 'driver' ? 'text-violet-800 dark:text-violet-300' : 'text-teal-800 dark:text-teal-300',
          )}>
            {seller}
          </p>
          <SourceBadge source={sale.source} />
        </div>

        <div className={cn(
          'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border',
          isAccount
            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
            : 'bg-muted/40 border-border/40',
        )}>
          <User className={cn('h-3.5 w-3.5 shrink-0', isAccount ? 'text-emerald-600' : 'text-muted-foreground')} />
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs font-semibold truncate', isAccount ? 'text-emerald-800 dark:text-emerald-300' : 'text-muted-foreground')}>
              {sale.customer_name || custName}
            </p>
            {phone && (
              <p className="text-[10px] text-emerald-700/70 flex items-center gap-1 mt-0.5">
                <Phone className="h-2.5 w-2.5" />{phone}
              </p>
            )}
          </div>
          {isAccount && (
            <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 rounded-full px-1.5 py-0.5 shrink-0">
              Account
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable form field
// ─────────────────────────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode; hint?: string }> = ({
  label, required, children, hint,
}) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Qty steppers
// ─────────────────────────────────────────────────────────────────────────────

const QtyStepper: React.FC<{ value: number; max: number; onChange: (n: number) => void }> = ({ value, max, onChange }) => (
  <div className="flex items-center justify-center gap-6">
    <button onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1}
      className="h-12 w-12 rounded-full border border-border/80 bg-muted/40 flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors active:scale-90">
      <Minus className="h-5 w-5" />
    </button>
    <div className="text-center min-w-[64px]">
      <span className="text-4xl font-black tabular-nums text-amber-600">{value}</span>
      <p className="text-[10px] text-muted-foreground mt-0.5">of {max}</p>
    </div>
    <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
      className="h-12 w-12 rounded-full border border-border/80 bg-muted/40 flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors active:scale-90">
      <Plus className="h-5 w-5" />
    </button>
  </div>
);

const QtyStepperWithZero: React.FC<{ value: number; max: number; onChange: (n: number) => void }> = ({ value, max, onChange }) => (
  <div className="flex items-center justify-center gap-6">
    <button onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0}
      className="h-12 w-12 rounded-full border border-border/80 bg-muted/40 flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors active:scale-90">
      <Minus className="h-5 w-5" />
    </button>
    <div className="text-center min-w-[64px]">
      <span className="text-4xl font-black tabular-nums text-blue-600">{value}</span>
      <p className="text-[10px] text-muted-foreground mt-0.5">of {max}</p>
    </div>
    <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
      className="h-12 w-12 rounded-full border border-border/80 bg-muted/40 flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors active:scale-90">
      <Plus className="h-5 w-5" />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Product card for sale dialog
// ─────────────────────────────────────────────────────────────────────────────

const SaleProductCard: React.FC<{
  product:  SaleProductOption;
  selected: boolean;
  onSelect: () => void;
}> = ({ product, selected, onSelect }) => (
  <button onClick={onSelect} disabled={product.maxQty <= 0}
    className={cn(
      'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
      selected
        ? 'border-amber-400 bg-amber-500/5 ring-1 ring-amber-400/20'
        : product.maxQty <= 0
          ? 'border-border/40 bg-muted/20 opacity-50 cursor-not-allowed'
          : 'border-border/60 bg-card hover:border-border active:scale-[0.98]',
    )}>
    <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden border border-border/30">
      {product.imageUrl
        ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
        : <ImageOff className="h-4 w-4 text-muted-foreground/40" />
      }
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold truncate">{product.name}</p>
      <div className="flex items-center gap-2 mt-0.5">
        {product.unit && (
          <span className={cn('text-[10px] font-semibold px-1.5 rounded-full', getUnitColor(product.unit))}>
            {getUnitLabel(product.unit)}
          </span>
        )}
        <p className={cn('text-xs font-medium',
          product.maxQty <= 0 ? 'text-destructive' : product.maxQty <= 5 ? 'text-amber-600' : 'text-muted-foreground',
        )}>
          {product.maxQty <= 0 ? 'Out of stock' : `${product.maxQty} available`}
        </p>
        {product.selling_price && parseFloat(product.selling_price) > 0 && (
          <span className="text-xs font-semibold text-emerald-600">
            KES {parseFloat(product.selling_price).toLocaleString('en-KE')}
          </span>
        )}
      </div>
    </div>
    {selected && <Check className="h-4 w-4 text-amber-600 shrink-0" />}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Customer picker step
// ─────────────────────────────────────────────────────────────────────────────

const CustomerPickerStep: React.FC<{
  onSelect: (c: CustomerResult) => void;
  onWalkIn: () => void;
}> = ({ onSelect, onWalkIn }) => {
  const [customers,       setCustomers]       = useState<CustomerResult[]>([]);
  const [filtered,        setFiltered]        = useState<CustomerResult[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [query,           setQuery]           = useState('');
  const [fetchAttempted,  setFetchAttempted]  = useState(false);

  useEffect(() => {
    if (fetchAttempted) return;
    setFetchAttempted(true);
    customerAdminService.getCustomers({ limit: 100 })
      .then(result => {
        const raw: CustomerResult[] = (result.data ?? []).map(c => ({
          id: c.id, name: c.full_name, phone: c.phone_number, email: c.email ?? '',
        }));
        setCustomers(raw);
        setFiltered(raw);
        if (raw.length === 0) setError('No customers found.');
      })
      .catch(() => setError('Could not load customers. Walk-in sales are still supported.'))
      .finally(() => setLoading(false));
  }, [fetchAttempted]);

  useEffect(() => {
    if (!query.trim()) { setFiltered(customers); return; }
    const q = query.toLowerCase();
    setFiltered(customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)),
    ));
  }, [query, customers]);

  return (
    <div className="space-y-4 pb-2">
      <div className="flex flex-col items-center gap-2 pt-2 pb-1">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <User className="h-7 w-7 text-amber-600" />
        </div>
        <p className="font-bold text-base">Who is this sale for?</p>
        <p className="text-sm text-muted-foreground text-center max-w-[260px]">
          Select an existing customer or record as a walk-in.
        </p>
      </div>

      {(customers.length > 0 || (!loading && error)) && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Filter by name or phone…" disabled={customers.length === 0}
            className="w-full h-11 pl-10 pr-10 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:border-amber-400/50 disabled:opacity-50"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <button onClick={onWalkIn}
        className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-border/60 hover:border-amber-400/40 hover:bg-amber-500/5 active:scale-[0.98] transition-all text-left">
        <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Walk-in / Roadside Customer</p>
          <p className="text-xs text-muted-foreground mt-0.5">Record without linking to an account.</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {error && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-center">
          <p className="text-xs text-amber-700 dark:text-amber-400">{error}</p>
        </div>
      )}

      {customers.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Existing customers</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Loading customers…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm font-semibold text-muted-foreground">
                {query ? 'No customers match your filter' : 'No customers found'}
              </p>
              {query && (
                <button onClick={() => setQuery('')} className="text-xs text-primary underline underline-offset-2">Clear filter</button>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5 pb-2">
              <p className="text-xs text-muted-foreground px-1">
                {filtered.length} customer{filtered.length !== 1 ? 's' : ''}{query ? ` matching "${query}"` : ''}
              </p>
              {filtered.map(c => (
                <button key={c.id} onClick={() => onSelect(c)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-card hover:border-amber-400/40 hover:bg-amber-500/5 active:scale-[0.98] transition-all text-left">
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
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Direct Sale Dialog (self-contained — same logic as StorePage)
// ─────────────────────────────────────────────────────────────────────────────

interface DirectSaleDialogProps {
  open:       boolean;
  mode:       'bottle' | 'consumable';
  products:   SaleProductOption[];
  onClose:    () => void;
  onSaved:    () => void;   // triggers list refresh
}

const DirectSaleDialog: React.FC<DirectSaleDialogProps> = ({ open, mode, products, onClose, onSaved }) => {
  const { user } = useAuth();

  const [step,             setStep]             = useState<SaleStep>('customer');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [isWalkIn,         setIsWalkIn]         = useState(false);
  const [customerName,     setCustomerName]     = useState('');
  const [productId,        setProductId]        = useState('');
  const [qty,              setQty]              = useState(1);
  const [qtyCollected,     setQtyCollected]     = useState(0);
  const [notes,            setNotes]            = useState('');
  const [loading,          setLoading]          = useState(false);
  const [showReceipt,      setShowReceipt]      = useState(false);
  const [receiptData,      setReceiptData]      = useState<DriverSaleData | null>(null);
  const [customerProfile,  setCustomerProfile]  = useState<AdminCustomer | null>(null);
  const [profileLoading,   setProfileLoading]   = useState(false);
  const [paymentMethod,    setPaymentMethod]    = useState<DirectSalePM | ''>('');

  useEffect(() => {
    if (open) {
      setStep('customer'); setSelectedCustomer(null); setIsWalkIn(false);
      setCustomerName(''); setProductId(''); setQty(1); setQtyCollected(0);
      setNotes(''); setCustomerProfile(null); setProfileLoading(false); setPaymentMethod('');
    }
  }, [open]);

  const handleSelectCustomer = async (c: CustomerResult) => {
    setSelectedCustomer(c); setCustomerName(c.name); setIsWalkIn(false); setStep('sale');
    setProfileLoading(true);
    try {
      const profile = await customerAdminService.getCustomer(c.id);
      setCustomerProfile(profile);
      const ct = profile.credit_terms;
      setPaymentMethod(ct && !ct.account_frozen ? 'CREDIT' : 'CASH');
    } catch {
      setCustomerProfile(null); setPaymentMethod('CASH');
    } finally { setProfileLoading(false); }
  };

  const handleWalkIn = () => {
    setSelectedCustomer(null); setCustomerProfile(null); setIsWalkIn(true);
    setCustomerName(''); setPaymentMethod('CASH'); setStep('sale');
  };

  const handleBack = () => {
    setStep('customer'); setSelectedCustomer(null); setCustomerProfile(null);
    setIsWalkIn(false); setCustomerName(''); setPaymentMethod('');
    setProductId(''); setQty(1); setQtyCollected(0);
  };

  const selected    = products.find(p => p.id === productId);
  const isReturnable = mode === 'bottle';
  const unitPrice   = selected?.selling_price ? parseFloat(selected.selling_price) : 0;

  const canSubmit =
    !!productId && qty >= 1 && !!paymentMethod &&
    !(isWalkIn && !customerName.trim());

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const finalNotes = [
        selectedCustomer
          ? `Customer: ${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}`
          : customerName.trim() ? `Walk-in: ${customerName.trim()}` : 'Walk-in sale',
        paymentMethod ? `Payment: ${paymentMethod}` : '',
        notes.trim(),
      ].filter(Boolean).join(' · ');

      if (mode === 'bottle') {
        await bottleStoreService.directSale({
          product: productId, quantity: qty,
          customer_id: selectedCustomer?.id,
          customer_name: selectedCustomer?.name ?? customerName.trim(),
          qty_collected: qtyCollected, notes: finalNotes,
        });
      } else {
        await consumableStoreService.directSale({
          product: productId, quantity: qty,
          customer_id: selectedCustomer?.id,
          customer_name: selectedCustomer?.name ?? customerName.trim(),
          notes: finalNotes,
        });
      }

      toast.success(`Sale recorded — ${qty} × ${selected?.name}`);

      const servedBy = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Store Admin';
      setReceiptData({
        productName:   selected?.name ?? 'Product',
        productUnit:   selected?.unit ?? (mode === 'bottle' ? 'BOTTLES' : 'UNITS'),
        isReturnable, quantity: qty, unitPrice,
        customerName:  (selectedCustomer?.name ?? customerName.trim()) || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone ?? undefined,
        isWalkIn:      !selectedCustomer,
        paymentMethod: 'CASH', servedBy, date: new Date().toISOString(),
      });
      setShowReceipt(true);
      onClose();
      onSaved();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
          ?? 'Failed to record sale.',
      );
    } finally { setLoading(false); }
  };

  const dialogTitle = step === 'customer'
    ? 'New Direct Sale'
    : selectedCustomer ? `Sale for ${selectedCustomer.name}` : 'Walk-in Sale';

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-br from-amber-500/10 to-transparent -mx-6 -mt-6 px-6 pt-6 pb-5 mb-2 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold truncate">{dialogTitle}</DialogTitle>
                <DialogDescription className="text-xs mt-0">
                  {step === 'customer' ? 'Choose a customer to continue' : 'Configure and record the sale'}
                </DialogDescription>
              </div>
              {step === 'sale' && (
                <button onClick={handleBack}
                  className="text-xs font-semibold text-amber-600 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0">
                  ← Back
                </button>
              )}
            </div>
          </div>

          {/* Step 1 — customer */}
          {step === 'customer' && (
            <CustomerPickerStep onSelect={handleSelectCustomer} onWalkIn={handleWalkIn} />
          )}

          {/* Step 2 — sale form */}
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
                      <p className="font-bold text-sm text-emerald-800 dark:text-emerald-300 truncate">{selectedCustomer.name}</p>
                      {selectedCustomer.phone && (
                        <p className="text-xs text-emerald-700/80 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" />{selectedCustomer.phone}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 rounded-full px-2 py-0.5 shrink-0">Account</span>
                  </>
                ) : (
                  <>
                    <User className="h-5 w-5 text-muted-foreground shrink-0" />
                    <p className="font-semibold text-sm text-muted-foreground">Walk-in Customer</p>
                  </>
                )}
              </div>

              {/* Payment method */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Payment Method</p>
                  {profileLoading && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />Detecting…
                    </span>
                  )}
                </div>

                {customerProfile?.credit_terms?.account_frozen && (
                  <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-destructive">Credit account frozen</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Please collect payment now.</p>
                    </div>
                  </div>
                )}

                {customerProfile?.credit_terms?.is_in_grace_period && !customerProfile?.credit_terms?.account_frozen && (
                  <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Invoice overdue — grace period active</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {customerProfile.credit_terms.grace_days_remaining ?? 0} grace day(s) remaining.
                      </p>
                    </div>
                  </div>
                )}

                {paymentMethod === 'CREDIT' && customerProfile?.credit_terms && !customerProfile.credit_terms.account_frozen && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-purple-500/8 border border-purple-300/40 dark:border-purple-700/40">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🧾</span>
                      <div>
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-300">Credit account</p>
                        <p className="text-xs text-muted-foreground">{customerProfile.credit_terms.billing_cycle_display} billing</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Available credit</p>
                      <p className="text-sm font-bold text-purple-700 dark:text-purple-300 tabular-nums">
                        KES {parseFloat(customerProfile.credit_terms.available_credit).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {DIRECT_SALE_PAYMENT_METHODS
                    .filter(pm => {
                      if (isWalkIn) return pm.value === 'CASH' || pm.value === 'MPESA';
                      if (customerProfile?.credit_terms?.account_frozen && pm.value === 'CREDIT') return false;
                      if (!customerProfile?.credit_terms && pm.value === 'CREDIT') return false;
                      return true;
                    })
                    .map(pm => (
                      <button key={pm.value} type="button"
                        disabled={pm.value === 'CREDIT' && !!(customerProfile?.credit_terms?.account_frozen)}
                        onClick={() => setPaymentMethod(pm.value)}
                        className={cn(
                          'flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                          paymentMethod === pm.value
                            ? pm.value === 'CREDIT'        ? 'border-purple-400/60 bg-purple-500/8 ring-1 ring-purple-400/20'
                            : pm.value === 'MPESA'         ? 'border-green-400/60 bg-green-500/8 ring-1 ring-green-400/20'
                            : pm.value === 'BANK_TRANSFER' ? 'border-blue-400/60 bg-blue-500/8 ring-1 ring-blue-400/20'
                            : 'border-emerald-400/60 bg-emerald-500/8 ring-1 ring-emerald-400/20'
                            : 'border-border/60 bg-card hover:bg-muted/30',
                        )}>
                        <span className="text-xl shrink-0">{pm.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-bold',
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
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)}
                    placeholder="Enter customer name" autoFocus />
                </Field>
              )}

              {/* Product list */}
              <Field label="Product" required>
                {products.length === 0 ? (
                  <div className="text-center py-6 rounded-xl border border-dashed border-border">
                    <p className="text-sm text-muted-foreground">No {mode === 'bottle' ? 'bottles' : 'consumables'} in store.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                    {products.map(p => (
                      <SaleProductCard key={p.id} product={p} selected={productId === p.id}
                        onSelect={() => { setProductId(p.id); setQty(1); setQtyCollected(0); }} />
                    ))}
                  </div>
                )}
              </Field>

              {/* Qty stepper */}
              {selected && selected.maxQty > 0 && (
                <Field label="Quantity">
                  <div className="py-2">
                    <QtyStepper value={qty} max={selected.maxQty}
                      onChange={v => { setQty(v); setQtyCollected(c => Math.min(c, v)); }} />
                  </div>
                  {unitPrice > 0 && (
                    <p className="text-center text-sm font-bold text-emerald-600 mt-2">
                      Total: KES {(qty * unitPrice).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </Field>
              )}

              {/* Collect empties — bottles only */}
              {isReturnable && selected && selected.maxQty > 0 && qty > 0 && (
                <div className="rounded-2xl border-2 border-blue-100 dark:border-blue-900/40 bg-card p-4 space-y-3">
                  <div>
                    <p className="text-sm font-bold flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-blue-600" />Collect empty bottles back
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">How many empty bottles is the customer returning now?</p>
                  </div>
                  <QtyStepperWithZero value={qtyCollected} max={qty} onChange={setQtyCollected} />
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
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">All empties collected ✓</p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <Field label="Notes (optional)">
                <Textarea rows={2} className="resize-none" value={notes}
                  onChange={e => setNotes(e.target.value)} placeholder="Any notes about this sale…" />
              </Field>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
                <Button variant="ocean" className="flex-1" onClick={handleSubmit} disabled={!canSubmit || loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingBag className="h-4 w-4 mr-2" />}
                  {selectedCustomer ? `Sell to ${selectedCustomer.name}` : 'Record Walk-in Sale'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {receiptData && (
        <DriverSaleReceiptModal
          open={showReceipt}
          onClose={() => { setShowReceipt(false); setReceiptData(null); }}
          sale={receiptData}
        />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

type SourceFilter = 'all' | 'driver' | 'admin';

const DirectSalesPage: React.FC<DeliveriesPageProps> = ({ layout = 'dashboard' }) => {
  const [sales,        setSales]        = useState<DirectSale[]>([]);
  const [drivers,      setDrivers]      = useState<DriverOption[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');

  // ── Sale dialog state ─────────────────────────────────────────────────────
  const [saleMode,              setSaleMode]              = useState<SaleMode>(null);
  const [bottleProducts,        setBottleProducts]        = useState<BottleProductStore[]>([]);
  const [consumableProducts,    setConsumableProducts]    = useState<ConsumableProductStore[]>([]);
  const [productsLoading,       setProductsLoading]       = useState(false);

  // ── Wrapper ───────────────────────────────────────────────────────────────
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    layout === 'manager'
      ? <ManagerLayout   title="Direct Sales" subtitle="Driver roadside sales + admin walk-in sales">{children}</ManagerLayout>
      : <DashboardLayout title="Direct Sales" subtitle="Driver roadside sales + admin walk-in sales">{children}</DashboardLayout>;

  // ── Load drivers ──────────────────────────────────────────────────────────
  useEffect(() => {
    axiosInstance.get('/auth/employees/', { params: { role: 'driver', limit: 100 } })
      .then(res => {
        const raw = res.data?.data ?? res.data?.results ?? res.data ?? [];
        setDrivers(raw.map((d: Record<string, unknown>) => ({
          id:   String(d.id),
          name: `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || String(d.email),
        })));
      })
      .catch(() => {});
  }, []);

  // ── Load all sales ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [driverSales, bottleProds, consumableProds] = await Promise.all([
        driverStoreService.getDirectSalesAdmin({
          driver_id: driverFilter || undefined,
          date_from: dateFrom     || undefined,
          date_to:   dateTo       || undefined,
        }),
        bottleStoreService.getAll(),
        consumableStoreService.getAll(),
      ]);

      // Keep products in state for the sale dialog
      setBottleProducts(bottleProds);
      setConsumableProducts(consumableProds);

      const normDriver: DirectSale[] = (driverSales as Array<{
        id: string; movement_date: string; product_name: string;
        product_type: 'bottle' | 'consumable'; quantity: number;
        driver_name: string; driver_id: string; notes: string;
      }>).map(s => ({ ...s, source: 'driver' as const }));

      const rawAdmin: DirectSale[] = [
        ...extractAdminSales(
          bottleProds.map(p => ({
            product_name: p.product_name,
            history:      p.history as StoreHistoryItem[],
          })),
          'bottle',
        ),
        ...extractAdminSales(
          consumableProds.map(p => ({
            product_name: p.product_name,
            history:      p.history as StoreHistoryItem[],
          })),
          'consumable',
        ),
      ];

      const adminSales = driverFilter
        ? []
        : rawAdmin.filter(s => passesDateFilter(s.movement_date, dateFrom, dateTo));

      setSales(sortNewestFirst([...normDriver, ...adminSales]));
    } catch {
      toast.error('Failed to load direct sales');
    } finally {
      setLoading(false);
    }
  }, [driverFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // ── Open sale dialog — refresh products if stale ──────────────────────────
  const openSaleDialog = async (mode: 'bottle' | 'consumable') => {
    setSaleMode(mode);
    // Products are already loaded via load(), but refresh if needed
    if (bottleProducts.length === 0 && consumableProducts.length === 0) {
      setProductsLoading(true);
      try {
        const [b, c] = await Promise.all([
          bottleStoreService.getAll(),
          consumableStoreService.getAll(),
        ]);
        setBottleProducts(b);
        setConsumableProducts(c);
      } catch { /* silent */ } finally {
        setProductsLoading(false);
      }
    }
  };

  // ── Filter + re-sort ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = sales;
    if (sourceFilter !== 'all') list = list.filter(s => s.source === sourceFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.product_name.toLowerCase().includes(q)              ||
        (s.driver_name       ?? '').toLowerCase().includes(q) ||
        (s.recorded_by_name  ?? '').toLowerCase().includes(q) ||
        (s.customer_name     ?? '').toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q),
      );
    }
    return sortNewestFirst(list);
  }, [sales, search, sourceFilter]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalUnits      = filtered.reduce((s, r) => s + r.quantity, 0);
  const todayCount      = filtered.filter(s => dateLabel(s.movement_date) === 'Today').length;
  const accountCount    = filtered.filter(s => /^Customer:/i.test(s.notes)).length;
  const driverSaleCount = filtered.filter(s => s.source === 'driver').length;
  const adminSaleCount  = filtered.filter(s => s.source === 'admin').length;

  const grouped    = useMemo(() => groupByDate(filtered), [filtered]);
  const hasFilters = !!(search || driverFilter || dateFrom || dateTo || sourceFilter !== 'all');

  const clearFilters = () => {
    setSearch(''); setDriverFilter(''); setDateFrom(''); setDateTo('');
    setSourceFilter('all');
  };

  // ── Sale dialog products ──────────────────────────────────────────────────
  const bottleSaleProducts: SaleProductOption[] = bottleProducts.map(p => ({
    id:            p.product_id,
    name:          p.product_name,
    maxQty:        p.balance.full,
    unit:          (p as unknown as Record<string, string>).product_unit ?? 'BOTTLES',
    imageUrl:      (p as unknown as Record<string, string | null>).product_image ?? null,
    selling_price: (p as unknown as Record<string, string>).selling_price ?? undefined,
  }));

  const consumableSaleProducts: SaleProductOption[] = consumableProducts.map(p => ({
    id:            p.product_id,
    name:          p.product_name,
    maxQty:        p.balance.in_stock,
    unit:          p.unit,
    imageUrl:      (p as unknown as Record<string, string | null>).product_image ?? null,
    selling_price: (p as unknown as Record<string, string>).selling_price ?? undefined,
  }));

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Wrapper>
      {/* ── Top action bar ── */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => openSaleDialog('bottle')}
            disabled={productsLoading}
            className="gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            {productsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <Droplets className="h-4 w-4" />
            Bottle Sale
          </Button>
          <Button
            onClick={() => openSaleDialog('consumable')}
            disabled={productsLoading}
            className="gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white"
            size="sm"
          >
            {productsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <Package className="h-4 w-4" />
            Consumable Sale
          </Button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {[
          { label: 'Total Sales',   val: filtered.length, cls: 'bg-amber-50   text-amber-700   border-amber-200/60'   },
          { label: 'Today',         val: todayCount,       cls: 'bg-blue-50    text-blue-700    border-blue-200/60'    },
          { label: 'Units Sold',    val: totalUnits,       cls: 'bg-muted/60   text-foreground  border-border/60'      },
          { label: 'Account Sales', val: accountCount,     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
        ].map(({ label, val, cls }) => (
          <div key={label} className={cn('rounded-2xl border px-4 py-3 flex items-center justify-between gap-3', cls)}>
            <div>
              <p className="text-2xl font-black tabular-nums leading-none">{val}</p>
              <p className="text-[11px] font-semibold opacity-60 mt-1 uppercase tracking-wide">{label}</p>
            </div>
            <ShoppingBag className="h-5 w-5 opacity-20 shrink-0" />
          </div>
        ))}
      </div>

      {/* ── Driver vs Admin breakdown ── */}
      {(driverSaleCount > 0 || adminSaleCount > 0) && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 mb-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-violet-500" />
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">{driverSaleCount}</strong> driver sale{driverSaleCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-teal-500" />
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">{adminSaleCount}</strong> admin sale{adminSaleCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                <strong className="text-foreground">{totalUnits}</strong> units total
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search product, driver, admin, customer…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-muted/40 border-transparent text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center rounded-xl border border-border/60 bg-muted/30 p-1 gap-0.5 shrink-0">
          {([
            { val: 'all'    as SourceFilter, label: 'All'    },
            { val: 'driver' as SourceFilter, label: 'Driver' },
            { val: 'admin'  as SourceFilter, label: 'Admin'  },
          ]).map(opt => (
            <button key={opt.val} onClick={() => setSourceFilter(opt.val)}
              className={cn(
                'h-8 px-3 rounded-lg text-xs font-semibold transition-colors',
                sourceFilter === opt.val ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}>
              {opt.label}
            </button>
          ))}
        </div>

        <Select value={driverFilter || 'all'} onValueChange={val => setDriverFilter(val === 'all' ? '' : val)}>
          <SelectTrigger className="h-10 w-full sm:w-44 rounded-xl bg-muted/40 border-transparent text-sm">
            <SelectValue placeholder="All drivers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Drivers</SelectItem>
            {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="pl-9 h-10 w-full sm:w-36 rounded-xl bg-muted/40 border-transparent text-sm" />
        </div>

        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="pl-9 h-10 w-full sm:w-36 rounded-xl bg-muted/40 border-transparent text-sm" />
        </div>

        <Button variant="outline" size="sm" className="h-10 rounded-xl gap-2 shrink-0" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-10 rounded-xl gap-1.5 shrink-0 text-muted-foreground" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" />Clear
          </Button>
        )}
      </div>

      {/* ── Summary ── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          <strong>{filtered.length}</strong> sale{filtered.length !== 1 ? 's' : ''}
          {hasFilters && ' · filtered'}
          {filtered.length > 0 && ` · ${totalUnits} unit${totalUnits !== 1 ? 's' : ''} total`}
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5">
            <div className="h-1.5 w-1.5 rounded-full bg-violet-500" />Driver
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5">
            <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />Admin
          </Badge>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary/50" />
          <p className="text-sm">Loading sales…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <InboxIcon className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <p className="font-bold text-base mb-1">No direct sales found</p>
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? 'Try adjusting your filters.'
              : 'Sales will appear here once drivers or admins start recording them.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-2xl border overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {['Date / Time', 'Sold By', 'Product', 'Qty', 'Customer'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale, i) => <SaleRow key={sale.id} sale={sale} isEven={i % 2 === 0} />)}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {filtered.length} sale{filtered.length !== 1 ? 's' : ''}
                {' · '}<span className="text-violet-600">{driverSaleCount} driver</span>
                {' · '}<span className="text-teal-600">{adminSaleCount} admin</span>
              </p>
              <p className="text-xs font-semibold text-amber-600">{totalUnits} unit{totalUnits !== 1 ? 's' : ''} total</p>
            </div>
          </div>

          {/* Mobile cards grouped by date */}
          <div className="md:hidden space-y-6 pb-8">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{date}</p>
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {items.length} sale{items.length !== 1 ? 's' : ''} · {items.reduce((s, i) => s + i.quantity, 0)} units
                  </span>
                </div>
                <div className="space-y-2.5">
                  {items.map(sale => <SaleCard key={sale.id} sale={sale} />)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Direct Sale Dialogs ── */}
      <DirectSaleDialog
        open={saleMode === 'bottle'}
        mode="bottle"
        products={bottleSaleProducts}
        onClose={() => setSaleMode(null)}
        onSaved={() => load()}
      />
      <DirectSaleDialog
        open={saleMode === 'consumable'}
        mode="consumable"
        products={consumableSaleProducts}
        onClose={() => setSaleMode(null)}
        onSaved={() => load()}
      />
    </Wrapper>
  );
};

export default DirectSalesPage;
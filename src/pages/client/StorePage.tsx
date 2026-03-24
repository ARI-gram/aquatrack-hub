/**
 * Store Page
 * Role: Client Admin / Site Manager
 * Route: /client/store
 * src/pages/client/StorePage.tsx
 *
 * Changes:
 *  ✅ Grid card click → right-side drawer (full-screen on mobile)
 *  ✅ Drawer: full balance stats + complete history + action buttons
 *  ✅ Drawer history filter: date range + time-of-day range (dropdown of available times)
 *  ✅ Toolbar: date-range + time-of-day filter for last-activity
 *  ✅ Group by driver: reads drivers list, shows picker, groups products by last driver
 *  ✅ Toolbar redesigned: professional two-row layout, integrated filter chips
 *  ✅ Product dropdowns: show image, unit label, and stock count in all dialogs
 *  ✅ Fix: <button> inside <button> in BottleListRow and ConsumableListRow
 *  ✅ DirectSaleDialog: shows receipt modal (DriverSaleReceiptModal) after successful sale
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout }   from '@/components/layout/DashboardLayout';
import { ManagerLayout }     from '@/components/layout/ManagerLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button }            from '@/components/ui/button';
import { Input }             from '@/components/ui/input';
import { Badge }             from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea }  from '@/components/ui/textarea';
import {
  Package, Droplets, Loader2, RefreshCw,
  ArrowDownToLine, RotateCcw, Truck, ShoppingBag,
  User, Clock, PackageCheck, ArrowRightLeft,
  Search, LayoutGrid, List, X,
  ImageOff, CalendarDays, ArrowUpDown, Layers,
  ChevronLeft, SlidersHorizontal, Filter, Users,
  ChevronDown, CheckCircle2, AlertTriangle, TrendingDown, TrendingUp,
} from 'lucide-react';
import { useToast }    from '@/hooks/use-toast';
import { useAuth }     from '@/contexts/AuthContext';
import { format, isToday, isYesterday, parseISO, startOfDay, endOfDay } from 'date-fns';
import { cn }          from '@/lib/utils';
import {
  bottleStoreService,
  consumableStoreService,
  type BottleProductStore,
  type ConsumableProductStore,
  type BottleBalance,
  type ConsumableBalance,
} from '@/api/services/store.service';
import type { Employee } from '@/types/employee.types';
import axiosInstance from '@/api/axios.config';
import { DriverSaleReceiptModal } from '@/pages/driver/DriverSaleReceiptModal';
import type { DriverSaleData }    from '@/pages/driver/DriverSaleReceiptModal';

// ─────────────────────────────────────────────────────────────────────────────
// UNIT DISPLAY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const UNIT_LABEL_MAP: Record<string, string> = {
  BOTTLES:  'Bottles',
  LITRES:   'Litres',
  DOZENS:   'Dozens',
  PIECES:   'Pieces',
  CRATES:   'Crates',
  JERRICANS:'Jerricans',
  SACHETS:  'Sachets',
  GALLONS:  'Gallons',
  PACKS:    'Packs',
  CARTONS:  'Cartons',
};

const UNIT_COLOR_MAP: Record<string, string> = {
  BOTTLES:  'text-violet-500 bg-violet-500/10',
  LITRES:   'text-sky-500 bg-sky-500/10',
  DOZENS:   'text-amber-500 bg-amber-500/10',
  PIECES:   'text-emerald-500 bg-emerald-500/10',
  CRATES:   'text-orange-500 bg-orange-500/10',
  JERRICANS:'text-cyan-500 bg-cyan-500/10',
  SACHETS:  'text-pink-500 bg-pink-500/10',
  GALLONS:  'text-blue-500 bg-blue-500/10',
  PACKS:    'text-indigo-500 bg-indigo-500/10',
  CARTONS:  'text-rose-500 bg-rose-500/10',
};

function getUnitLabel(unit?: string) {
  return UNIT_LABEL_MAP[unit ?? ''] ?? (unit ?? '');
}
function getUnitColor(unit?: string) {
  return UNIT_COLOR_MAP[unit ?? ''] ?? 'text-muted-foreground bg-muted';
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT DROPDOWN ITEM — shared across all dialogs
// ─────────────────────────────────────────────────────────────────────────────

interface ProductDropdownItemProps {
  name:        string;
  unit?:       string;
  imageUrl?:   string | null;
  stockLabel?:   string;
  stockVariant?: 'ok' | 'low' | 'out';
}

const ProductDropdownItem: React.FC<ProductDropdownItemProps> = ({
  name, unit, imageUrl, stockLabel, stockVariant = 'ok',
}) => {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="flex items-center gap-2.5 w-full py-0.5">
      <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0 bg-muted/60 border border-border/40 flex items-center justify-center">
        {imageUrl && !imgErr ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <ImageOff className="h-3.5 w-3.5 text-muted-foreground/40" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-tight">{name}</p>
        {unit && (
          <span className={cn(
            'inline-flex items-center text-[10px] font-semibold px-1.5 py-0 rounded-full mt-0.5',
            getUnitColor(unit),
          )}>
            {getUnitLabel(unit)}
          </span>
        )}
      </div>

      {stockLabel && (
        <Badge
          variant={
            stockVariant === 'out' ? 'destructive' :
            stockVariant === 'low' ? 'warning'     : 'secondary'
          }
          className="text-[10px] px-1.5 py-0 h-4 shrink-0 tabular-nums"
        >
          {stockLabel}
        </Badge>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE FETCHER
// ─────────────────────────────────────────────────────────────────────────────

type RawEmployee = Record<string, unknown>;

function mapEmployee(raw: RawEmployee): Employee {
  const firstName = (raw.firstName ?? raw.first_name ?? '') as string;
  const lastName  = (raw.lastName  ?? raw.last_name  ?? '') as string;
  return {
    id:          raw.id          as string,
    firstName,
    lastName,
    fullName:    (raw.fullName   ?? raw.full_name ?? `${firstName} ${lastName}`.trim()) as string,
    numberPlate: (raw.numberPlate ?? raw.vehicle_number ?? raw.number_plate ?? '') as string,
    role:        (raw.role       ?? 'driver') as Employee['role'],
    email:       (raw.email      ?? '') as string,
    phone:       (raw.phone      ?? raw.phone_number ?? null) as string | null,
    isActive:    (raw.isActive   ?? raw.is_active   ?? true) as boolean,
    isVerified:  (raw.isVerified ?? raw.is_verified ?? false) as boolean,
    lastLogin:   (raw.lastLogin  ?? raw.last_login  ?? null) as string | null,
    createdAt:   (raw.createdAt  ?? raw.created_at  ?? '') as string,
  };
}

async function fetchDrivers(): Promise<Employee[]> {
  try {
    type Resp = { data: RawEmployee[] } | { results: RawEmployee[] } | RawEmployee[];
    const r = await axiosInstance.get<Resp>('/auth/employees/', { params: { role: 'driver', limit: 100 } });
    const raw: RawEmployee[] =
      Array.isArray(r.data)                                 ? r.data :
      'data'    in r.data && Array.isArray(r.data.data)     ? r.data.data :
      'results' in r.data && Array.isArray(r.data.results)  ? r.data.results :
      [];
    return raw.map(mapEmployee);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY TYPES + HELPERS
// ─────────────────────────────────────────────────────────────────────────────

interface HistoryItem {
  id:                    string;
  movement_type:         string;
  movement_type_display: string;
  movement_date:         string;
  driver_name?:          string | null;
  customer_name?:        string;
  recorded_by_name?:     string | null;
  notes?:                string;
  qty_good?:             number;
  qty_damaged?:          number;
  qty_missing?:          number;
  qty_expected?:         number;
  qty_total?:            number;
  quantity?:             number;
}

const movementIcon = (type: string) => {
  switch (type) {
    case 'RECEIVE_EMPTY': return <ArrowDownToLine className="h-3.5 w-3.5" />;
    case 'REFILL':        return <RotateCcw       className="h-3.5 w-3.5" />;
    case 'DISTRIBUTE':    return <Truck           className="h-3.5 w-3.5" />;
    case 'DIRECT_SALE':   return <ShoppingBag     className="h-3.5 w-3.5" />;
    case 'RECEIVE':       return <PackageCheck    className="h-3.5 w-3.5" />;
    default:              return <Clock           className="h-3.5 w-3.5" />;
  }
};

const movementColor = (type: string) => {
  switch (type) {
    case 'RECEIVE_EMPTY': return 'bg-blue-500/10    text-blue-600';
    case 'REFILL':        return 'bg-emerald-500/10 text-emerald-600';
    case 'DISTRIBUTE':    return 'bg-violet-500/10  text-violet-600';
    case 'DIRECT_SALE':   return 'bg-amber-500/10   text-amber-600';
    case 'RECEIVE':       return 'bg-sky-500/10     text-sky-600';
    default:              return 'bg-muted           text-muted-foreground';
  }
};

const dateGroup = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (isToday(d))     return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd MMM yyyy');
};

function groupByDate(items: HistoryItem[]) {
  const groups: Record<string, HistoryItem[]> = {};
  for (const item of items) {
    const key = dateGroup(item.movement_date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

function lastMovement(history: unknown[]): Date {
  if (!history.length) return new Date(0);
  return new Date((history[0] as HistoryItem).movement_date);
}

function getLastDriverName(history: unknown[]): string {
  for (const item of history as HistoryItem[]) {
    if (item.driver_name) return item.driver_name;
  }
  return '__unassigned__';
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE / TIME FILTER TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DateTimeFilter {
  dateFrom: string;
  dateTo:   string;
  timeFrom: string;
  timeTo:   string;
}

const emptyDTF: DateTimeFilter = { dateFrom: '', dateTo: '', timeFrom: '', timeTo: '' };

function availableTimes(items: HistoryItem[]): string[] {
  const set = new Set<string>();
  items.forEach(i => {
    try { set.add(format(new Date(i.movement_date), 'HH:mm')); } catch { /* skip */ }
  });
  return Array.from(set).sort();
}

function passesDateTimeFilter(item: HistoryItem, f: DateTimeFilter): boolean {
  const d = new Date(item.movement_date);
  if (f.dateFrom) {
    const from = startOfDay(parseISO(f.dateFrom));
    if (d < from) return false;
  }
  if (f.dateTo) {
    const to = endOfDay(parseISO(f.dateTo));
    if (d > to) return false;
  }
  if (f.timeFrom) {
    const [fh, fm] = f.timeFrom.split(':').map(Number);
    if (d.getHours() * 60 + d.getMinutes() < fh * 60 + fm) return false;
  }
  if (f.timeTo) {
    const [th, tm] = f.timeTo.split(':').map(Number);
    if (d.getHours() * 60 + d.getMinutes() > th * 60 + tm) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}> = ({ label, required, children, hint }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const GroupLabel: React.FC<{ label: string; count: number; isDriver?: boolean }> = ({ label, count, isDriver }) => (
  <div className="flex items-center gap-2.5 py-1.5">
    {isDriver && (
      <div className="flex items-center justify-center h-5 w-5 rounded-full bg-violet-500/10 text-violet-600 shrink-0">
        <User className="h-3 w-3" />
      </div>
    )}
    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {label}
    </span>
    <div className="flex-1 h-px bg-border/50" />
    <Badge variant="secondary" className="text-[10px] py-0 h-4 tabular-nums font-medium">{count}</Badge>
  </div>
);

// ── Product image ─────────────────────────────────────────────────────────────
const ProductImage: React.FC<{ url?: string | null; name: string; size?: 'sm' | 'md' | 'lg' }> = ({
  url, name, size = 'md',
}) => {
  const [err, setErr]         = useState(false);
  const [loading, setLoading] = useState(true);
  const dims     = size === 'sm' ? 'h-8 w-8'     : size === 'lg' ? 'h-16 w-16' : 'h-11 w-11';
  const iconDims = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-7 w-7'   : 'h-5 w-5';

  if (!url || err) return (
    <div className={cn('rounded-xl flex items-center justify-center bg-muted/60 shrink-0', dims)}>
      <ImageOff className={cn('text-muted-foreground/40', iconDims)} />
    </div>
  );
  return (
    <div className={cn('relative rounded-xl overflow-hidden shrink-0 bg-muted/30', dims)}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/40" />
        </div>
      )}
      <img
        src={url} alt={name}
        className={cn('w-full h-full object-cover transition-opacity duration-300', loading ? 'opacity-0' : 'opacity-100')}
        onLoad={() => setLoading(false)}
        onError={() => { setErr(true); setLoading(false); }}
      />
    </div>
  );
};

// ── History row ───────────────────────────────────────────────────────────────
const HistoryRow: React.FC<{ item: HistoryItem }> = ({ item }) => {
  const total = item.qty_total ?? item.quantity ?? 0;
  const who   = item.driver_name || item.customer_name || item.recorded_by_name || '—';
  return (
    <div className="flex items-start gap-3 py-3">
      <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg shrink-0 mt-0.5', movementColor(item.movement_type))}>
        {movementIcon(item.movement_type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{item.movement_type_display}</span>
          <Badge variant="outline" className="text-xs tabular-nums py-0 h-4">×{total}</Badge>
          {(item.qty_damaged ?? 0) > 0 && <Badge variant="warning"     className="text-xs py-0 h-4">{item.qty_damaged} damaged</Badge>}
          {(item.qty_missing ?? 0) > 0 && <Badge variant="destructive" className="text-xs py-0 h-4">{item.qty_missing} missing</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <User className="h-3 w-3 shrink-0" />{who}
          <span className="mx-1">·</span>{format(new Date(item.movement_date), 'HH:mm')}
        </p>
        {item.notes && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{item.notes}</p>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DATE/TIME FILTER BAR
// ─────────────────────────────────────────────────────────────────────────────

interface DTFilterBarProps {
  value:        DateTimeFilter;
  onChange:     (v: DateTimeFilter) => void;
  timeOptions?: string[];
  compact?:     boolean;
}

const DTFilterBar: React.FC<DTFilterBarProps> = ({ value, onChange, timeOptions, compact }) => {
  const set = (patch: Partial<DateTimeFilter>) => onChange({ ...value, ...patch });
  const active = value.dateFrom || value.dateTo || value.timeFrom || value.timeTo;

  const TimeInput: React.FC<{ val: string; placeholder: string; onSet: (v: string) => void }> = ({ val, placeholder, onSet }) => {
    if (timeOptions && timeOptions.length > 0) {
      return (
        <Select value={val || '__none__'} onValueChange={v => onSet(v === '__none__' ? '' : v)}>
          <SelectTrigger className={cn('h-8 text-xs', compact ? 'w-full' : 'w-28')}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{placeholder}</SelectItem>
            {timeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        type="time" value={val}
        onChange={e => onSet(e.target.value)}
        className={cn('h-8 text-xs', compact ? 'w-full' : 'w-28')}
      />
    );
  };

  return (
    <div className={cn('rounded-xl border border-border/60 bg-card space-y-2', compact ? 'p-3' : 'p-3')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3 w-3" /> Activity filter
        </div>
        {active && (
          <button onClick={() => onChange(emptyDTF)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground w-12 shrink-0">Date</span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
          <Input type="date" value={value.dateFrom} onChange={e => set({ dateFrom: e.target.value })} className="h-8 text-xs flex-1 min-w-28" />
          <span className="text-xs text-muted-foreground">→</span>
          <Input type="date" value={value.dateTo}   onChange={e => set({ dateTo: e.target.value })}   className="h-8 text-xs flex-1 min-w-28" />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground w-12 shrink-0">Time</span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
          <TimeInput val={value.timeFrom} placeholder="From" onSet={v => set({ timeFrom: v })} />
          <span className="text-xs text-muted-foreground">→</span>
          <TimeInput val={value.timeTo}   placeholder="To"   onSet={v => set({ timeTo: v })}   />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────

type DrawerProduct =
  | (BottleProductStore     & { product_image?: string | null; kind: 'bottle'     })
  | (ConsumableProductStore & { product_image?: string | null; kind: 'consumable' });

interface ProductDrawerProps {
  product:  DrawerProduct | null;
  onClose:  () => void;
  onAction: (type: string) => void;
}

const ProductDrawer: React.FC<ProductDrawerProps> = ({ product, onClose, onAction }) => {
  const [dtf, setDtf]           = useState<DateTimeFilter>(emptyDTF);
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => { if (product) setDtf(emptyDTF); }, [product]);

  if (!product) return null;

  const isBottle = product.kind === 'bottle';
  const bp = isBottle ? (product as BottleProductStore) : null;
  const cp = !isBottle ? (product as ConsumableProductStore) : null;
  const history = (product as BottleProductStore).history as HistoryItem[] ?? [];
  const times = availableTimes(history);

  const filteredHistory = history.filter(item => passesDateTimeFilter(item, dtf));
  const grouped = groupByDate(filteredHistory);

  const stockStatus = isBottle
    ? (bp!.balance.full <= 0 ? 'out' : bp!.balance.full <= 5 ? 'low' : 'ok')
    : (cp!.balance.in_stock <= 0 ? 'out' : cp!.balance.in_stock <= 10 ? 'low' : 'ok');

  const bottleActions = [
    { type: 'receive',    label: 'Receive',    icon: <ArrowDownToLine className="h-4 w-4" />, color: 'text-blue-600',    bg: 'hover:bg-blue-500/5 hover:border-blue-500/30'       },
    { type: 'refill',     label: 'Refill',     icon: <RotateCcw       className="h-4 w-4" />, color: 'text-emerald-600', bg: 'hover:bg-emerald-500/5 hover:border-emerald-500/30' },
    { type: 'distribute', label: 'Distribute', icon: <Truck           className="h-4 w-4" />, color: 'text-violet-600',  bg: 'hover:bg-violet-500/5 hover:border-violet-500/30'   },
    { type: 'sale',       label: 'Sell',       icon: <ShoppingBag     className="h-4 w-4" />, color: 'text-amber-600',   bg: 'hover:bg-amber-500/5 hover:border-amber-500/30'     },
  ];
  const consumableActions = [
    { type: 'receive',    label: 'Receive',    icon: <PackageCheck    className="h-4 w-4" />, color: 'text-sky-600',    bg: 'hover:bg-sky-500/5 hover:border-sky-500/20'         },
    { type: 'distribute', label: 'Distribute', icon: <ArrowRightLeft  className="h-4 w-4" />, color: 'text-violet-600', bg: 'hover:bg-violet-500/5 hover:border-violet-500/20'   },
    { type: 'sale',       label: 'Sell',       icon: <ShoppingBag     className="h-4 w-4" />, color: 'text-amber-600',  bg: 'hover:bg-amber-500/5 hover:border-amber-500/20'     },
  ];
  const actions = isBottle ? bottleActions : consumableActions;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className={cn(
        'fixed inset-y-0 right-0 z-50 flex flex-col bg-background shadow-2xl',
        'w-full md:w-[480px] transition-transform duration-300 ease-in-out',
        'border-l border-border/60',
      )}>
        {/* Header */}
        <div className={cn(
          'flex items-center gap-3 px-4 py-4 border-b border-border/60 shrink-0',
          stockStatus === 'out' ? 'bg-destructive/5' :
          stockStatus === 'low' ? 'bg-amber-500/5'   : 'bg-card',
        )}>
          <button onClick={onClose} className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </button>

          {(product as BottleProductStore & { product_image?: string | null }).product_image ? (
            <ProductImage url={(product as BottleProductStore & { product_image?: string | null }).product_image} name={product.product_name} size="md" />
          ) : (
            <div className={cn('flex items-center justify-center h-11 w-11 rounded-xl shrink-0', isBottle ? 'bg-blue-500/10 text-blue-600' : 'bg-sky-500/10 text-sky-600')}>
              {isBottle ? <Droplets className="h-5 w-5" /> : <Package className="h-5 w-5" />}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base leading-tight truncate">{product.product_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {isBottle
                ? <Badge variant="outline" className="text-[10px] py-0 h-4">Returnable</Badge>
                : <p className="text-xs text-muted-foreground capitalize">{cp?.unit?.toLowerCase()}</p>
              }
              <Badge
                variant={stockStatus === 'out' ? 'destructive' : stockStatus === 'low' ? 'warning' : 'secondary'}
                className="text-[10px] py-0 h-4"
              >
                {isBottle
                  ? (stockStatus === 'out' ? 'Out of stock' : `${bp!.balance.full} full`)
                  : (stockStatus === 'out' ? 'Out of stock' : `${cp!.balance.in_stock} in stock`)
                }
              </Badge>
            </div>
          </div>

          <button
            onClick={() => setShowFilter(v => !v)}
            className={cn('flex items-center justify-center h-8 w-8 rounded-lg transition-colors shrink-0', showFilter ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground')}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 pt-4 pb-3">
            {isBottle ? (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Full',    value: bp!.balance.full,    color: 'text-emerald-600', bg: 'bg-emerald-500/8'  },
                  { label: 'Empty',   value: bp!.balance.empty,   color: 'text-amber-600',   bg: 'bg-amber-500/8'    },
                  { label: 'Damaged', value: bp!.balance.damaged, color: 'text-orange-600',  bg: 'bg-orange-500/8'   },
                  { label: 'Missing', value: bp!.balance.missing, color: 'text-destructive', bg: 'bg-destructive/5'  },
                ].map(s => (
                  <div key={s.label} className={cn('rounded-xl px-3 py-2.5 flex items-center justify-between', s.bg)}>
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <span className={cn('text-xl font-bold tabular-nums', s.color)}>{s.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-sky-500/8 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">In stock</span>
                  <span className="text-2xl font-bold tabular-nums text-sky-600">{cp!.balance.in_stock}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', stockStatus === 'low' ? 'bg-amber-500' : 'bg-sky-500')}
                    style={{ width: stockStatus === 'out' ? '0%' : `${Math.min(100, (cp!.balance.in_stock / 50) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="px-4 pb-4">
            <div className={cn('grid gap-2', actions.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
              {actions.map(a => (
                <button
                  key={a.type}
                  onClick={() => { onAction(a.type); onClose(); }}
                  className={cn('flex flex-col items-center justify-center gap-1 h-14 rounded-xl text-[11px] font-medium border border-border/60 transition-colors', a.color, a.bg)}
                >
                  {a.icon}{a.label}
                </button>
              ))}
            </div>
          </div>

          {showFilter && (
            <div className="px-4 pb-3">
              <DTFilterBar value={dtf} onChange={setDtf} timeOptions={times} compact />
            </div>
          )}

          <div className="px-4 pb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Movement history</p>
              <span className="text-xs text-muted-foreground tabular-nums">
                {filteredHistory.length} / {history.length} record{history.length !== 1 ? 's' : ''}
              </span>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-xl">
                <Clock className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {history.length === 0 ? 'No movements yet.' : 'No records match this filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(grouped).map(([date, items]) => (
                  <div key={date}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 sticky top-0 bg-background/90 py-0.5">{date}</p>
                    <div className="divide-y divide-border/40">
                      {(items as HistoryItem[]).map(item => <HistoryRow key={item.id} item={item} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TOOLBAR
// ─────────────────────────────────────────────────────────────────────────────

type ViewMode  = 'grid' | 'list';
type SortKey   = 'name' | 'stock_asc' | 'stock_desc' | 'date_asc' | 'date_desc';
type GroupMode = 'none' | 'unit' | 'stock_status' | 'driver';

interface ToolbarProps {
  search:          string;
  onSearch:        (v: string) => void;
  sortKey:         SortKey;
  onSort:          (v: SortKey) => void;
  groupMode:       GroupMode;
  onGroup:         (v: GroupMode) => void;
  viewMode:        ViewMode;
  onView:          (v: ViewMode) => void;
  filterStock:     'all' | 'low' | 'out';
  onFilter:        (v: 'all' | 'low' | 'out') => void;
  dtFilter:        DateTimeFilter;
  onDTFilter:      (v: DateTimeFilter) => void;
  resultCount:     number;
  drivers?:        Employee[];
  driverFilter?:   string;
  onDriverFilter?: (v: string) => void;
}

const GROUP_OPTS: { value: GroupMode; label: string; icon: React.ReactNode }[] = [
  { value: 'none',         label: 'No grouping',  icon: <X       className="h-3 w-3" /> },
  { value: 'stock_status', label: 'Stock status', icon: <Layers  className="h-3 w-3" /> },
  { value: 'unit',         label: 'Unit type',    icon: <Package className="h-3 w-3" /> },
  { value: 'driver',       label: 'Driver',       icon: <Users   className="h-3 w-3" /> },
];

const Toolbar: React.FC<ToolbarProps> = ({
  search, onSearch, sortKey, onSort, groupMode, onGroup,
  viewMode, onView, filterStock, onFilter,
  dtFilter, onDTFilter, resultCount,
  drivers = [], driverFilter = '', onDriverFilter,
}) => {
  const [showDT, setShowDT] = useState(false);
  const dtActive    = !!(dtFilter.dateFrom || dtFilter.dateTo || dtFilter.timeFrom || dtFilter.timeTo);
  const hasFilters  = !!(search || filterStock !== 'all' || sortKey !== 'name' || groupMode !== 'none' || dtActive || driverFilter);
  const currentGroup = GROUP_OPTS.find(o => o.value === groupMode) ?? GROUP_OPTS[0];

  const clearAll = () => {
    onSearch(''); onSort('name'); onGroup('none'); onFilter('all');
    onDTFilter(emptyDTF); setShowDT(false);
    onDriverFilter?.('');
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">

      {/* ── Row 1: Search + view toggle ──────────────────────────────── */}
      <div className="flex gap-2 px-3 pt-3 pb-2.5 border-b border-border/40">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search products…" value={search}
            onChange={e => onSearch(e.target.value)}
            className="pl-8 h-9 text-sm bg-transparent"
          />
          {search && (
            <button onClick={() => onSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-border/60 p-0.5 bg-muted/30 shrink-0">
          {([
            { mode: 'grid' as ViewMode, icon: <LayoutGrid className="h-3.5 w-3.5" />, label: 'Grid' },
            { mode: 'list' as ViewMode, icon: <List       className="h-3.5 w-3.5" />, label: 'List' },
          ]).map(v => (
            <button
              key={v.mode} onClick={() => onView(v.mode)}
              title={v.label}
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-md transition-colors',
                viewMode === v.mode ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >{v.icon}</button>
          ))}
        </div>
      </div>

      {/* ── Row 2: Sort · Group · Stock chips · Actions ───────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 flex-wrap">

        {/* Sort */}
        <Select value={sortKey} onValueChange={v => onSort(v as SortKey)}>
          <SelectTrigger className="h-8 text-xs w-auto min-w-0 gap-1 border-dashed pl-2 pr-2.5">
            <ArrowUpDown className="h-3 w-3 text-muted-foreground shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="stock_desc">Stock ↓ high to low</SelectItem>
            <SelectItem value="stock_asc">Stock ↑ low to high</SelectItem>
            <SelectItem value="date_desc">Newest activity</SelectItem>
            <SelectItem value="date_asc">Oldest activity</SelectItem>
          </SelectContent>
        </Select>

        <div className="h-4 w-px bg-border/60 shrink-0" />

        {/* Group */}
        <Select value={groupMode} onValueChange={v => onGroup(v as GroupMode)}>
          <SelectTrigger
            className={cn(
              'h-8 text-xs w-auto min-w-0 gap-1.5 pl-2 pr-2.5',
              groupMode !== 'none'
                ? 'border-primary/40 bg-primary/5 text-primary'
                : 'border-dashed text-muted-foreground',
            )}
          >
            <span className={cn('shrink-0', groupMode !== 'none' ? 'text-primary' : 'text-muted-foreground')}>
              {currentGroup.icon}
            </span>
            <span>{groupMode === 'none' ? 'Group by…' : currentGroup.label}</span>
            <ChevronDown className="h-3 w-3 ml-auto opacity-60 shrink-0" />
          </SelectTrigger>
          <SelectContent>
            {GROUP_OPTS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{o.icon}</span>
                  {o.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="h-4 w-px bg-border/60 shrink-0" />

        {/* Stock status chips */}
        <div className="flex items-center rounded-lg border border-border/50 bg-muted/20 p-0.5 gap-0.5">
          {([
            { val: 'all', label: 'All' },
            { val: 'low', label: 'Low' },
            { val: 'out', label: 'Out' },
          ] as const).map(f => (
            <button
              key={f.val} onClick={() => onFilter(f.val)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-md transition-colors font-medium',
                filterStock === f.val
                  ? f.val === 'out' ? 'bg-destructive/10 text-destructive shadow-sm'
                  : f.val === 'low' ? 'bg-amber-500/10 text-amber-700 shadow-sm'
                  : 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >{f.label}</button>
          ))}
        </div>

        {/* Date/time toggle */}
        <button
          onClick={() => setShowDT(v => !v)}
          className={cn(
            'flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition-colors',
            showDT || dtActive
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'border-dashed text-muted-foreground hover:text-foreground hover:border-border',
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {dtActive ? 'Date ✓' : 'Date'}
        </button>

        {/* Result count + clear */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground tabular-nums">
            {resultCount} product{resultCount !== 1 ? 's' : ''}
          </span>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Driver picker row ─────────────────────────────────────────── */}
      {groupMode === 'driver' && (
        <div className="flex items-center gap-3 px-3 py-2.5 border-t border-border/40 bg-violet-500/3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-violet-700 shrink-0">
            <Users className="h-3.5 w-3.5" />
            Driver
          </div>
          <div className="flex-1 flex flex-wrap gap-1.5">
            <button
              onClick={() => onDriverFilter?.('')}
              className={cn(
                'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition-colors',
                !driverFilter
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-violet-400/50',
              )}
            >
              All drivers
            </button>
            {drivers.map(d => (
              <button
                key={d.id}
                onClick={() => onDriverFilter?.(driverFilter === d.fullName ? '' : d.fullName)}
                className={cn(
                  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition-colors',
                  driverFilter === d.fullName
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-violet-400/50',
                )}
              >
                <span className="flex items-center justify-center h-4 w-4 rounded-full bg-white/20 text-[9px] font-bold">
                  {d.firstName?.[0]}{d.lastName?.[0]}
                </span>
                {d.firstName} {d.lastName}
                {d.numberPlate && (
                  <span className={cn('text-[10px]', driverFilter === d.fullName ? 'text-white/70' : 'text-muted-foreground/60')}>
                    · {d.numberPlate}
                  </span>
                )}
              </button>
            ))}
            {drivers.length === 0 && (
              <span className="text-xs text-muted-foreground italic">No drivers found</span>
            )}
          </div>
        </div>
      )}

      {/* ── Date/time filter panel ────────────────────────────────────── */}
      {showDT && (
        <div className="border-t border-border/40 p-3">
          <DTFilterBar value={dtFilter} onChange={onDTFilter} compact />
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GRID CARDS
// ─────────────────────────────────────────────────────────────────────────────

const BottleGridCard: React.FC<{
  p:        BottleProductStore & { product_image?: string | null };
  onOpen:   () => void;
  onAction: (type: string) => void;
}> = ({ p, onOpen, onAction }) => {
  const stockStatus = p.balance.full <= 0 ? 'out' : p.balance.full <= 5 ? 'low' : 'ok';
  return (
    <Card className={cn('border-border/50 transition-colors overflow-hidden', stockStatus === 'out' && 'border-destructive/20', stockStatus === 'low' && 'border-amber-500/20')}>
      <button className="w-full text-left" onClick={onOpen}>
        <CardContent className="p-4 pb-3 hover:bg-muted/20 transition-colors cursor-pointer">
          <div className="flex items-start gap-2.5 mb-3">
            {!p.product_image ? (
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 shrink-0">
                <Droplets style={{ height: 18, width: 18 }} />
              </div>
            ) : (
              <ProductImage url={p.product_image} name={p.product_name} size="md" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">{p.product_name}</p>
              <Badge variant="outline" className="text-[10px] mt-0.5 py-0 h-4">Returnable</Badge>
            </div>
            <Badge variant={stockStatus === 'out' ? 'destructive' : stockStatus === 'low' ? 'warning' : 'secondary'} className="text-[10px] tabular-nums shrink-0">
              {p.balance.full} full
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {[
              { label: 'Full',    value: p.balance.full,    color: 'text-emerald-600', bg: 'bg-emerald-500/8' },
              { label: 'Empty',   value: p.balance.empty,   color: 'text-amber-600',   bg: 'bg-amber-500/8'   },
              { label: 'Damaged', value: p.balance.damaged, color: 'text-orange-600',  bg: 'bg-orange-500/8'  },
              { label: 'Missing', value: p.balance.missing, color: 'text-destructive', bg: 'bg-destructive/5' },
            ].map(s => (
              <div key={s.label} className={cn('rounded-lg px-2.5 py-1.5 flex items-center justify-between', s.bg)}>
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
                <span className={cn('text-sm font-bold tabular-nums', s.color)}>{s.value}</span>
              </div>
            ))}
          </div>

          {p.history.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarDays className="h-3 w-3 shrink-0" />
              Last: {format(new Date((p.history[0] as HistoryItem).movement_date), 'dd MMM · HH:mm')}
            </div>
          )}
        </CardContent>
      </button>

      <div className="px-4 pb-4 pt-0 border-t border-border/30 mt-0">
        <div className="grid grid-cols-4 gap-1.5 pt-3" onClick={e => e.stopPropagation()}>
          <button onClick={() => onAction('receive')}    className="flex flex-col items-center gap-0.5 h-10 rounded-lg text-[10px] font-medium border border-border/60 hover:bg-blue-500/5 hover:text-blue-600 transition-colors justify-center"><ArrowDownToLine className="h-3 w-3" />Receive</button>
          <button onClick={() => onAction('refill')}     className="flex flex-col items-center gap-0.5 h-10 rounded-lg text-[10px] font-medium border border-border/60 hover:bg-emerald-500/5 hover:text-emerald-600 transition-colors justify-center"><RotateCcw className="h-3 w-3" />Refill</button>
          <button onClick={() => onAction('distribute')} className="flex flex-col items-center gap-0.5 h-10 rounded-lg text-[10px] font-medium border border-border/60 hover:bg-violet-500/5 hover:text-violet-600 transition-colors justify-center"><Truck className="h-3 w-3" />Distribute</button>
          <button onClick={() => onAction('sale')}       className="flex flex-col items-center gap-0.5 h-10 rounded-lg text-[10px] font-medium border border-border/60 hover:bg-amber-500/5 hover:text-amber-600 transition-colors justify-center"><ShoppingBag className="h-3 w-3" />Sell</button>
        </div>
      </div>
    </Card>
  );
};

const ConsumableGridCard: React.FC<{
  p:        ConsumableProductStore & { product_image?: string | null };
  onOpen:   () => void;
  onAction: (type: string) => void;
}> = ({ p, onOpen, onAction }) => {
  const stockStatus = p.balance.in_stock <= 0 ? 'out' : p.balance.in_stock <= 10 ? 'low' : 'ok';
  return (
    <Card className={cn('border-border/50 transition-colors overflow-hidden', stockStatus === 'out' && 'border-destructive/20', stockStatus === 'low' && 'border-amber-500/20')}>
      <button className="w-full text-left" onClick={onOpen}>
        <CardContent className="p-4 pb-3 hover:bg-muted/20 transition-colors cursor-pointer">
          <div className="flex items-start gap-2.5 mb-3">
            {p.product_image
              ? <ProductImage url={p.product_image} name={p.product_name} size="md" />
              : <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-sky-500/10 text-sky-600 shrink-0"><Package className="h-5 w-5" /></div>
            }
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">{p.product_name}</p>
              <p className="text-[11px] text-muted-foreground capitalize mt-0.5">{p.unit?.toLowerCase()}</p>
            </div>
            <Badge variant={stockStatus === 'out' ? 'destructive' : stockStatus === 'low' ? 'warning' : 'secondary'} className="text-[10px] tabular-nums shrink-0">
              {stockStatus === 'out' ? 'Out' : p.balance.in_stock}
            </Badge>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">In stock</span>
              <span className="text-sm font-bold tabular-nums">{p.balance.in_stock}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', stockStatus === 'out' ? 'bg-destructive w-0' : stockStatus === 'low' ? 'bg-amber-500' : 'bg-emerald-500')}
                style={{ width: stockStatus === 'ok' ? '100%' : `${Math.min(100, (p.balance.in_stock / 50) * 100)}%` }}
              />
            </div>
          </div>

          {p.history.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarDays className="h-3 w-3 shrink-0" />
              Last: {format(new Date((p.history[0] as HistoryItem).movement_date), 'dd MMM · HH:mm')}
            </div>
          )}
        </CardContent>
      </button>

      <div className="px-4 pb-4 pt-0 border-t border-border/30">
        <div className="grid grid-cols-3 gap-1.5 pt-3" onClick={e => e.stopPropagation()}>
          <button onClick={() => onAction('receive')}    className="flex flex-col items-center gap-0.5 h-10 rounded-lg text-[10px] font-medium border border-border/60 hover:bg-sky-500/5 hover:text-sky-600 transition-colors justify-center"><PackageCheck className="h-3 w-3" />Receive</button>
          <button onClick={() => onAction('distribute')} className="flex flex-col items-center gap-0.5 h-10 rounded-lg text-[10px] font-medium border border-border/60 hover:bg-violet-500/5 hover:text-violet-600 transition-colors justify-center"><ArrowRightLeft className="h-3 w-3" />Distribute</button>
          <button onClick={() => onAction('sale')}       className="flex flex-col items-center gap-0.5 h-10 rounded-lg text-[10px] font-medium border border-border/60 hover:bg-amber-500/5 hover:text-amber-600 transition-colors justify-center"><ShoppingBag className="h-3 w-3" />Sell</button>
        </div>
      </div>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LIST ROWS — fixed: outer <button> replaced with <div role="button">
// ─────────────────────────────────────────────────────────────────────────────

const BottleListRow: React.FC<{
  p: BottleProductStore & { product_image?: string | null };
  expanded: boolean; onToggle: () => void; onAction: (type: string) => void;
}> = ({ p, expanded, onToggle, onAction }) => {
  const [dtf, setDtf]   = useState<DateTimeFilter>(emptyDTF);
  const [showDT, setShowDT] = useState(false);
  const history    = p.history as HistoryItem[];
  const times      = availableTimes(history);
  const filtered   = history.filter(i => passesDateTimeFilter(i, dtf));
  const grouped    = groupByDate(filtered);
  const stockStatus = p.balance.full <= 0 ? 'out' : p.balance.full <= 5 ? 'low' : 'ok';

  return (
    <Card className={cn('border-border/50 overflow-hidden transition-colors', stockStatus === 'out' && 'border-destructive/20', stockStatus === 'low' && 'border-amber-500/20')}>
      <div
        role="button"
        tabIndex={0}
        className="w-full text-left cursor-pointer"
        onClick={onToggle}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      >
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
          {p.product_image
            ? <ProductImage url={p.product_image} name={p.product_name} size="sm" />
            : <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 shrink-0"><Droplets className="h-4 w-4" /></div>
          }
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{p.product_name}</p>
            <Badge variant="outline" className="text-[10px] py-0 h-4 mt-0.5">Returnable</Badge>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs">
            {[['Full', p.balance.full, 'text-emerald-600'], ['Empty', p.balance.empty, 'text-amber-600'], ['Damaged', p.balance.damaged, 'text-orange-600']].map(([l, v, c]) => (
              <div key={String(l)} className="text-center">
                <p className={cn('font-bold tabular-nums', c)}>{v}</p>
                <p className="text-muted-foreground text-[10px]">{l}</p>
              </div>
            ))}
            {p.balance.missing > 0 && (
              <div className="text-center"><p className="font-bold text-destructive tabular-nums">{p.balance.missing}</p><p className="text-muted-foreground text-[10px]">Missing</p></div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => onAction('receive')}    className="hidden md:flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium border hover:bg-blue-500/5 hover:text-blue-600 transition-colors"><ArrowDownToLine className="h-3 w-3" />Receive</button>
            <button onClick={() => onAction('refill')}     className="hidden md:flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium border hover:bg-emerald-500/5 hover:text-emerald-600 transition-colors"><RotateCcw className="h-3 w-3" />Refill</button>
            <button onClick={() => onAction('distribute')} className="hidden md:flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium border hover:bg-violet-500/5 hover:text-violet-600 transition-colors"><Truck className="h-3 w-3" />Distribute</button>
            <button onClick={() => onAction('sale')}       className="hidden md:flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium border hover:bg-amber-500/5 hover:text-amber-600 transition-colors"><ShoppingBag className="h-3 w-3" />Sell</button>
          </div>
          <div className={cn('ml-1 text-muted-foreground transition-transform shrink-0', expanded && 'rotate-180')}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/40 px-4 py-4 space-y-3">
          <div className="flex gap-2 md:hidden">
            <button onClick={() => onAction('receive')}    className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg text-xs font-medium border hover:bg-blue-500/5 hover:text-blue-600 transition-colors"><ArrowDownToLine className="h-3 w-3" />Receive</button>
            <button onClick={() => onAction('refill')}     className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg text-xs font-medium border hover:bg-emerald-500/5 hover:text-emerald-600 transition-colors"><RotateCcw className="h-3 w-3" />Refill</button>
            <button onClick={() => onAction('distribute')} className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg text-xs font-medium border hover:bg-violet-500/5 hover:text-violet-600 transition-colors"><Truck className="h-3 w-3" />Dist.</button>
            <button onClick={() => onAction('sale')}       className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg text-xs font-medium border hover:bg-amber-500/5 hover:text-amber-600 transition-colors"><ShoppingBag className="h-3 w-3" />Sell</button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">History</p>
            <button onClick={() => setShowDT(v => !v)}
              className={cn('flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11px] font-medium transition-colors',
                showDT || (dtf.dateFrom || dtf.dateTo || dtf.timeFrom || dtf.timeTo)
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-border/60 text-muted-foreground hover:text-foreground',
              )}>
              <SlidersHorizontal className="h-3 w-3" /> Filter
            </button>
          </div>
          {showDT && <DTFilterBar value={dtf} onChange={setDtf} timeOptions={times} compact />}

          {filtered.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
              {history.length === 0 ? 'No movements yet.' : 'No records match this filter.'}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(grouped).map(([date, items]) => (
                <div key={date}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">{date}</p>
                  <div className="divide-y divide-border/40">
                    {(items as HistoryItem[]).map(item => <HistoryRow key={item.id} item={item} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

const ConsumableListRow: React.FC<{
  p: ConsumableProductStore & { product_image?: string | null };
  expanded: boolean; onToggle: () => void; onAction: (type: string) => void;
}> = ({ p, expanded, onToggle, onAction }) => {
  const [dtf, setDtf]   = useState<DateTimeFilter>(emptyDTF);
  const [showDT, setShowDT] = useState(false);
  const history    = p.history as HistoryItem[];
  const times      = availableTimes(history);
  const filtered   = history.filter(i => passesDateTimeFilter(i, dtf));
  const grouped    = groupByDate(filtered);
  const stockStatus = p.balance.in_stock <= 0 ? 'out' : p.balance.in_stock <= 10 ? 'low' : 'ok';

  return (
    <Card className={cn('border-border/50 overflow-hidden transition-colors', stockStatus === 'out' && 'border-destructive/20', stockStatus === 'low' && 'border-amber-500/20')}>
      <div
        role="button"
        tabIndex={0}
        className="w-full text-left cursor-pointer"
        onClick={onToggle}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      >
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
          {p.product_image
            ? <ProductImage url={p.product_image} name={p.product_name} size="sm" />
            : <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-sky-500/10 text-sky-600 shrink-0"><Package className="h-4 w-4" /></div>
          }
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{p.product_name}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{p.unit?.toLowerCase()}</p>
          </div>
          <Badge variant={stockStatus === 'out' ? 'destructive' : stockStatus === 'low' ? 'warning' : 'secondary'} className="text-xs tabular-nums shrink-0">
            {stockStatus === 'out' ? 'Out of stock' : `${p.balance.in_stock} units`}
          </Badge>
          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => onAction('receive')}    className="hidden md:flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium border hover:bg-sky-500/5 hover:text-sky-600 transition-colors"><PackageCheck className="h-3 w-3" />Receive</button>
            <button onClick={() => onAction('distribute')} className="hidden md:flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium border hover:bg-violet-500/5 hover:text-violet-600 transition-colors"><ArrowRightLeft className="h-3 w-3" />Distribute</button>
            <button onClick={() => onAction('sale')}       className="hidden md:flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium border hover:bg-amber-500/5 hover:text-amber-600 transition-colors"><ShoppingBag className="h-3 w-3" />Sell</button>
          </div>
          <div className={cn('ml-1 text-muted-foreground transition-transform shrink-0', expanded && 'rotate-180')}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/40 px-4 py-4 space-y-3">
          <div className="flex gap-2 md:hidden">
            <button onClick={() => onAction('receive')}    className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg text-xs border hover:bg-sky-500/5 hover:text-sky-600 transition-colors"><PackageCheck className="h-3 w-3" />Receive</button>
            <button onClick={() => onAction('distribute')} className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg text-xs border hover:bg-violet-500/5 hover:text-violet-600 transition-colors"><ArrowRightLeft className="h-3 w-3" />Dist.</button>
            <button onClick={() => onAction('sale')}       className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg text-xs border hover:bg-amber-500/5 hover:text-amber-600 transition-colors"><ShoppingBag className="h-3 w-3" />Sell</button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">History</p>
            <button onClick={() => setShowDT(v => !v)}
              className={cn('flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11px] font-medium transition-colors',
                showDT || (dtf.dateFrom || dtf.dateTo || dtf.timeFrom || dtf.timeTo)
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-border/60 text-muted-foreground hover:text-foreground',
              )}>
              <SlidersHorizontal className="h-3 w-3" /> Filter
            </button>
          </div>
          {showDT && <DTFilterBar value={dtf} onChange={setDtf} timeOptions={times} compact />}

          {filtered.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
              {history.length === 0 ? 'No movements yet.' : 'No records match this filter.'}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(grouped).map(([date, items]) => (
                <div key={date}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">{date}</p>
                  <div className="divide-y divide-border/40">
                    {(items as HistoryItem[]).map(item => <HistoryRow key={item.id} item={item} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION DIALOGS
// ─────────────────────────────────────────────────────────────────────────────

type BottleDialog     = 'receive' | 'refill' | 'distribute' | 'sale' | null;
type ConsumableDialog = 'receive' | 'distribute' | 'sale' | null;

const ProductSelectTrigger: React.FC<{
  selectedId: string;
  products:   Array<{ id: string; name: string; unit?: string; imageUrl?: string | null }>;
  placeholder?: string;
}> = ({ selectedId, products, placeholder = 'Select product…' }) => {
  const selected = products.find(p => p.id === selectedId);
  const [imgErr, setImgErr] = useState(false);

  if (!selected) {
    return <SelectValue placeholder={placeholder} />;
  }

  return (
    <div className="flex items-center gap-2 w-full min-w-0">
      <div className="h-6 w-6 rounded-md overflow-hidden shrink-0 bg-muted/60 flex items-center justify-center border border-border/30">
        {selected.imageUrl && !imgErr ? (
          <img
            src={selected.imageUrl}
            alt={selected.name}
            className="h-full w-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <ImageOff className="h-3 w-3 text-muted-foreground/40" />
        )}
      </div>
      <span className="text-sm font-medium truncate flex-1">{selected.name}</span>
      {selected.unit && (
        <span className={cn('text-[10px] font-semibold px-1.5 py-0 rounded-full shrink-0', getUnitColor(selected.unit))}>
          {getUnitLabel(selected.unit)}
        </span>
      )}
    </div>
  );
};

// ── Receive Empties — supporting constants, types & sub-component ─────────────

const SHORT_REASONS = [
  'Driver broke some bottles',
  'Bottles lost in transit',
  'Customer kept bottles',
  'Partial return — driver coming back',
  'Bottles left at another location',
  'Count error on dispatch',
  'Other (see notes)',
];

const OVER_REASONS = [
  'Driver returned extra from previous delivery',
  'Bottles collected from another customer',
  'Count error on dispatch (more were sent)',
  'Other (see notes)',
];

interface ExpectedEntry {
  driver_id:         string;
  driver_name:       string;
  vehicle_number:    string;
  product_id:        string;
  product_name:      string;
  expected_qty:      number;
  last_deliver_date: string | null;
}

interface ReceiveResult {
  balance:           BottleBalance;
  expected_before:   number;
  outstanding_after: number;
  cleared:           boolean;
}

type CompareState = 'exact' | 'short' | 'over' | 'empty';

const ReasonPicker: React.FC<{
  reasons:  string[];
  value:    string;
  onChange: (v: string) => void;
  accent:   'amber' | 'blue';
}> = ({ reasons, value, onChange, accent }) => (
  <div className="space-y-1.5">
    {reasons.map(r => (
      <button
        key={r}
        type="button"
        onClick={() => onChange(r)}
        className={cn(
          'w-full text-left text-sm font-semibold px-4 py-3 rounded-xl border-2 transition-all active:scale-[0.98]',
          value === r
            ? accent === 'amber'
              ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300'
              : 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-300'
            : 'bg-muted/30 border-border/50 text-muted-foreground',
        )}
      >
        {r}
      </button>
    ))}
  </div>
);
// ── Receive Empties ───────────────────────────────────────────────────────────

const ReceiveEmptiesDialog: React.FC<{
  open:     boolean;
  products: BottleProductStore[];
  drivers:  Employee[];
  onClose:  () => void;
  onSaved:  (id: string, b: BottleBalance) => void;
}> = ({ open, products, drivers, onClose, onSaved }) => {
  const { toast } = useToast();

  const [loading,       setLoading]       = useState(false);
  const [productId,     setProductId]     = useState('');
  const [driverId,      setDriverId]      = useState('');
  const [qtyGood,       setQtyGood]       = useState('');
  const [qtyDamaged,    setQtyDamaged]    = useState('');
  const [notes,         setNotes]         = useState('');
  const [shortReason,   setShortReason]   = useState('');
  const [overReason,    setOverReason]    = useState('');
  const [expectedMap,   setExpectedMap]   = useState<Record<string, number>>({});
  const [fetchingExp,   setFetchingExp]   = useState(false);
  const [loadedDrivers, setLoadedDrivers] = useState<Set<string>>(new Set());
  const [result,        setResult]        = useState<ReceiveResult | null>(null);

  // Reset everything when dialog opens
  useEffect(() => {
    if (open) {
      setProductId(''); setDriverId('');
      setQtyGood(''); setQtyDamaged(''); setNotes('');
      setShortReason(''); setOverReason(''); setResult(null);
      setExpectedMap({}); setLoadedDrivers(new Set());
    }
  }, [open]);

  const fetchExpected = useCallback(async (dId: string) => {
    if (!dId) return;
    setFetchingExp(true);
    try {
      const r = await axiosInstance.get<ExpectedEntry[]>(
        '/store/bottles/expected-empties/',
        { params: { driver_id: dId } },
      );
      const map: Record<string, number> = {};
      (r.data ?? []).forEach(e => {
        map[`${e.driver_id}::${e.product_id}`] = e.expected_qty;
      });
      setExpectedMap(prev => ({ ...prev, ...map }));
    } catch {
      // non-fatal — we still mark as loaded so spinner stops
    } finally {
      setFetchingExp(false);
      // ✅ Always mark driver as loaded, even if response had no records
      setLoadedDrivers(prev => new Set(prev).add(dId));
    }
  }, []);

  const handleDriverChange = (id: string) => {
    setDriverId(id);
    setShortReason(''); setOverReason('');
    fetchExpected(id);
  };

  const handleProductChange = (id: string) => {
    setProductId(id);
    setShortReason(''); setOverReason('');
  };

  // ── Derived numbers ──────────────────────────────────────────────────────
  const driverLoaded = loadedDrivers.has(driverId);

  // null  = still loading (driver selected but fetch not done yet)
  // 0     = loaded, no outstanding empties
  // n > 0 = loaded, n empties expected
  const systemExpected: number | null =
    !driverId || !productId   ? null :
    fetchingExp || !driverLoaded ? null :
    (expectedMap[`${driverId}::${productId}`] ?? 0);

  const good     = parseInt(qtyGood)    || 0;
  const damaged  = parseInt(qtyDamaged) || 0;
  const received = good + damaged;

  const hasExpected  = systemExpected !== null && systemExpected > 0;
  const diff         = hasExpected ? received - systemExpected : 0;
  const progressPct  = hasExpected ? Math.min(100, (received / systemExpected) * 100) : 0;

  const compareState: CompareState =
    !qtyGood && !qtyDamaged ? 'empty' :
    !hasExpected            ? 'exact' :   // no tracking → just accept
    received === systemExpected ? 'exact' :
    received  <  systemExpected ? 'short' :
                                  'over';

  const reasonRequired =
    (hasExpected && compareState === 'short' && !shortReason) ||
    (hasExpected && compareState === 'over'  && !overReason);

  const canSubmit = !!(productId && received > 0 && !reasonRequired);

  const productOptions = products.map(p => ({
    id:           p.product_id,
    name:         p.product_name,
    unit:         (p as unknown as Record<string, string>).product_unit ?? 'BOTTLES',
    imageUrl:     (p as unknown as Record<string, string | null>).product_image ?? null,
    stockLabel:   `${p.balance.empty} empty`,
    stockVariant: (p.balance.empty <= 0 ? 'out' : p.balance.empty <= 5 ? 'low' : 'ok') as 'ok' | 'low' | 'out',
  }));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await bottleStoreService.receiveEmpty({
        product:      productId,
        driver_id:    driverId || undefined,
        qty_expected: systemExpected ?? 0,
        qty_good:     good,
        qty_damaged:  damaged,
        notes,
        short_reason: compareState === 'short' ? shortReason : undefined,
        over_reason:  compareState === 'over'  ? overReason  : undefined,
      } as Parameters<typeof bottleStoreService.receiveEmpty>[0]);

      const fullRes = res as unknown as ReceiveResult & typeof res;
      onSaved(productId, fullRes.balance);

      setResult({
        balance:           fullRes.balance,
        expected_before:   fullRes.expected_before   ?? systemExpected ?? 0,
        outstanding_after: fullRes.outstanding_after ?? 0,
        cleared:           fullRes.cleared           ?? false,
      });

      if (fullRes.cleared) {
        toast({ title: `✓ All empties received — driver's balance cleared.` });
      } else if ((fullRes.outstanding_after ?? 0) > 0) {
        toast({ title: `Received ${received}. ${fullRes.outstanding_after} still outstanding.` });
      } else {
        toast({ title: `Received ${received} empties.` });
      }

      setTimeout(() => onClose(), 2200);

    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to record receive.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500/10 to-transparent -mx-6 -mt-6 px-6 pt-6 pb-5 mb-5 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20">
              <ArrowDownToLine className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Receive Empties</DialogTitle>
              <DialogDescription className="text-xs mt-0">
                Driver returning empty bottles to store
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Result banner — shown after successful submit */}
        {result && (
          <div className={cn(
            'rounded-2xl border-2 px-4 py-4 mb-4 flex items-start gap-3',
            result.cleared
              ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
              : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
          )}>
            {result.cleared
              ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              : <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            }
            <div>
              <p className={cn(
                'text-sm font-bold',
                result.cleared
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-amber-700 dark:text-amber-300',
              )}>
                {result.cleared
                  ? "✓ Driver's balance cleared — no more empties expected."
                  : `${result.outstanding_after} empties still outstanding from this driver.`
                }
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Expected {result.expected_before} · received {received}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">

          {/* Product */}
          <Field label="Product" required>
            <Select value={productId} onValueChange={handleProductChange}>
              <SelectTrigger className="h-11">
                <ProductSelectTrigger
                  selectedId={productId}
                  products={productOptions}
                  placeholder="Select bottle product…"
                />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {productOptions.map(p => (
                  <SelectItem key={p.id} value={p.id} className="py-1.5">
                    <ProductDropdownItem
                      name={p.name} unit={p.unit} imageUrl={p.imageUrl}
                      stockLabel={p.stockLabel} stockVariant={p.stockVariant}
                    />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Driver */}
          <Field label="Driver" hint="Select driver to auto-load expected count">
            <Select value={driverId} onValueChange={handleDriverChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select driver…" />
                {fetchingExp && (
                  <Loader2 className="h-3 w-3 animate-spin ml-auto text-muted-foreground shrink-0" />
                )}
              </SelectTrigger>
              <SelectContent>
                {drivers.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.firstName} {d.lastName}{d.numberPlate && ` — ${d.numberPlate}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* ── Expected count banner ─────────────────────────────────────── */}
          {driverId && productId && !result && (() => {
            // Still fetching
            if (fetchingExp || !driverLoaded) return (
              <div className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-muted/30 border border-border/50">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">Loading expected count from system…</p>
              </div>
            );

            // Loaded — nothing outstanding
            if (systemExpected === 0) return (
              <div className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-muted/30 border border-border/50">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">No outstanding empties</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    System has no pending empties recorded for this driver.
                    You can still record a free-form receive below.
                  </p>
                </div>
              </div>
            );

            // Loaded — has outstanding
            return (
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-4 py-3 space-y-2">
                {/* Target row */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    System expects from this driver
                  </p>
                  <span className="text-2xl font-black tabular-nums text-blue-700 dark:text-blue-300">
                    {systemExpected}
                  </span>
                </div>

                {/* Progress bar — only shows once user starts typing */}
                {received > 0 && (
                  <>
                    <div className="h-3 rounded-full bg-blue-200/60 dark:bg-blue-900/40 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          compareState === 'exact' ? 'bg-emerald-500' :
                          compareState === 'short' ? 'bg-amber-500'   :
                          compareState === 'over'  ? 'bg-blue-500'    : 'bg-blue-400',
                        )}
                        style={{ width: `${Math.min(100, progressPct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-blue-600/70 dark:text-blue-400">
                        {received} of {systemExpected} received
                      </span>
                      <span className={cn(
                        'font-bold',
                        compareState === 'exact' ? 'text-emerald-600' :
                        compareState === 'short' ? 'text-amber-600'   :
                        compareState === 'over'  ? 'text-blue-600'    : '',
                      )}>
                        {compareState === 'exact' ? '✓ Exact match'        :
                         compareState === 'short' ? `${Math.abs(diff)} short` :
                         compareState === 'over'  ? `${diff} over`         : ''}
                      </span>
                    </div>
                  </>
                )}

                {/* Hint before user types */}
                {received === 0 && (
                  <p className="text-[11px] text-blue-600/70 dark:text-blue-400">
                    Enter quantities below — the system will track short or over.
                  </p>
                )}
              </div>
            );
          })()}

          {/* Good + Damaged inputs */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Good condition" required>
              <Input
                type="number" min={0} placeholder="0"
                value={qtyGood}
                onChange={e => {
                  setQtyGood(e.target.value);
                  setShortReason(''); setOverReason('');
                }}
                className={cn(
                  received > 0 && hasExpected && 'border-2',
                  compareState === 'exact' && received > 0
                    ? 'border-emerald-400 focus-visible:ring-emerald-400/30' :
                  compareState === 'short' && received > 0
                    ? 'border-amber-400 focus-visible:ring-amber-400/30'     :
                  compareState === 'over'  && received > 0
                    ? 'border-blue-400 focus-visible:ring-blue-400/30'       : '',
                )}
              />
            </Field>
            <Field label="Damaged">
              <Input
                type="number" min={0} placeholder="0"
                value={qtyDamaged}
                onChange={e => {
                  setQtyDamaged(e.target.value);
                  setShortReason(''); setOverReason('');
                }}
              />
            </Field>
          </div>

          {/* Total summary card */}
          {received > 0 && (
            <div className={cn(
              'rounded-xl px-4 py-3 border-2 space-y-2 transition-all',
              compareState === 'exact'
                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' :
              compareState === 'short'
                ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'         :
              compareState === 'over'
                ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'             :
              'bg-muted/40 border-border/50',
            )}>
              {/* Total */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-medium">Total receiving</span>
                <span className="text-xl font-black tabular-nums">{received}</span>
              </div>

              {/* Good / damaged breakdown */}
              {good > 0 && damaged > 0 && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    {good} good
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-orange-400 shrink-0" />
                    {damaged} damaged
                  </span>
                </div>
              )}

              {/* Verdict line — only when system tracking */}
              {hasExpected && (
                <div className={cn(
                  'flex items-center gap-2 pt-2 border-t text-xs font-bold',
                  compareState === 'exact'
                    ? 'border-emerald-200 text-emerald-700 dark:text-emerald-300' :
                  compareState === 'short'
                    ? 'border-amber-200 text-amber-700 dark:text-amber-300'       :
                  'border-blue-200 text-blue-700 dark:text-blue-300',
                )}>
                  {compareState === 'exact' && (
                    <><CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Exact count — driver's balance will be cleared ✓
                    </>
                  )}
                  {compareState === 'short' && (
                    <><TrendingDown className="h-3.5 w-3.5 shrink-0" />
                      Short by {Math.abs(diff)} — select a reason below to continue
                    </>
                  )}
                  {compareState === 'over' && (
                    <><TrendingUp className="h-3.5 w-3.5 shrink-0" />
                      Over by {diff} — select a reason below to continue
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reason pickers */}
          {compareState === 'short' && hasExpected && (
            <Field label="Why is the count short?" required>
              <ReasonPicker
                reasons={SHORT_REASONS}
                value={shortReason}
                onChange={setShortReason}
                accent="amber"
              />
            </Field>
          )}
          {compareState === 'over' && hasExpected && (
            <Field label="Why are there extra bottles?" required>
              <ReasonPicker
                reasons={OVER_REASONS}
                value={overReason}
                onChange={setOverReason}
                accent="blue"
              />
            </Field>
          )}

          <Field label="Notes" hint="Optional">
            <Textarea
              rows={2} className="resize-none"
              placeholder="Any additional notes…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="ocean" className="flex-1"
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <ArrowDownToLine className="h-4 w-4 mr-2" />
            }
            Record Receive
          </Button>
        </div>

        {reasonRequired && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            {compareState === 'short'
              ? 'Select a reason for the shortage to continue.'
              : 'Select a reason for the extra bottles to continue.'}
          </p>
        )}

      </DialogContent>
    </Dialog>
  );
};
// ── Refill ────────────────────────────────────────────────────────────────────

const RefillDialog: React.FC<{
  open: boolean; products: BottleProductStore[];
  onClose: () => void; onSaved: (id: string, b: BottleBalance) => void;
}> = ({ open, products, onClose, onSaved }) => {
  const { toast } = useToast();
  const [loading, setLoading]     = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity]   = useState('');
  const [notes, setNotes]         = useState('');

  const selected = products.find(p => p.product_id === productId);

  useEffect(() => { if (open) { setProductId(''); setQuantity(''); setNotes(''); } }, [open]);

  const productOptions = products.map(p => ({
    id:       p.product_id,
    name:     p.product_name,
    unit:     (p as unknown as Record<string, string>).product_unit ?? 'BOTTLES',
    imageUrl: (p as unknown as Record<string, string | null>).product_image ?? null,
    stockLabel:   `${p.balance.empty} empty`,
    stockVariant: (p.balance.empty <= 0 ? 'out' : p.balance.empty <= 5 ? 'low' : 'ok') as 'ok' | 'low' | 'out',
  }));

  const handleSubmit = async () => {
    if (!productId) return toast({ title: 'Select a product', variant: 'destructive' });
    const qty = parseInt(quantity) || 0;
    if (qty < 1) return toast({ title: 'Enter quantity', variant: 'destructive' });
    setLoading(true);
    try {
      const res = await bottleStoreService.refill({ product: productId, quantity: qty, notes });
      toast({ title: `${qty} bottles refilled.` });
      onSaved(productId, res.balance); onClose();
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm max-h-[90dvh] overflow-y-auto">
        <div className="bg-gradient-to-br from-emerald-500/10 to-transparent -mx-6 -mt-6 px-6 pt-6 pb-5 mb-5 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"><RotateCcw className="h-5 w-5" /></div>
            <div><DialogTitle className="text-base font-semibold">Refill Empties</DialogTitle><DialogDescription className="text-xs mt-0">Mark empties as refilled</DialogDescription></div>
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Product" required>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="h-11">
                <ProductSelectTrigger selectedId={productId} products={productOptions} placeholder="Select product…" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {productOptions.map(p => (
                  <SelectItem key={p.id} value={p.id} className="py-1.5">
                    <ProductDropdownItem name={p.name} unit={p.unit} imageUrl={p.imageUrl} stockLabel={p.stockLabel} stockVariant={p.stockVariant} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {selected && (
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Empties available</span>
              <span className="font-semibold text-amber-600">{selected.balance.empty}</span>
            </div>
          )}

          <Field label="Quantity" required>
            <Input type="number" min={1} placeholder="0" max={selected?.balance.empty} value={quantity} onChange={e => setQuantity(e.target.value)} />
          </Field>

          <Field label="Notes">
            <Textarea rows={2} className="resize-none" placeholder="Optional…" value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="ocean" className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}Refill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Distribute Bottles ────────────────────────────────────────────────────────

const DistributeBottlesDialog: React.FC<{
  open: boolean; products: BottleProductStore[]; drivers: Employee[];
  onClose: () => void; onSaved: (id: string, b: BottleBalance) => void;
}> = ({ open, products, drivers, onClose, onSaved }) => {
  const { toast } = useToast();
  const [loading, setLoading]     = useState(false);
  const [productId, setProductId] = useState('');
  const [driverId, setDriverId]   = useState('');
  const [quantity, setQuantity]   = useState('');
  const [notes, setNotes]         = useState('');

  const selected = products.find(p => p.product_id === productId);

  useEffect(() => { if (open) { setProductId(''); setDriverId(''); setQuantity(''); setNotes(''); } }, [open]);

  const productOptions = products.map(p => ({
    id:       p.product_id,
    name:     p.product_name,
    unit:     (p as unknown as Record<string, string>).product_unit ?? 'BOTTLES',
    imageUrl: (p as unknown as Record<string, string | null>).product_image ?? null,
    stockLabel:   `${p.balance.full} full`,
    stockVariant: (p.balance.full <= 0 ? 'out' : p.balance.full <= 5 ? 'low' : 'ok') as 'ok' | 'low' | 'out',
  }));

  const handleSubmit = async () => {
    if (!productId) return toast({ title: 'Select a product', variant: 'destructive' });
    if (!driverId)  return toast({ title: 'Select a driver',  variant: 'destructive' });
    const qty = parseInt(quantity) || 0;
    if (qty < 1) return toast({ title: 'Enter quantity', variant: 'destructive' });
    setLoading(true);
    try {
      const res = await bottleStoreService.distribute({ product: productId, driver_id: driverId, quantity: qty, notes });
      toast({ title: `${qty} bottles distributed.` });
      onSaved(productId, res.balance); onClose();
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm max-h-[90dvh] overflow-y-auto">
        <div className="bg-gradient-to-br from-violet-500/10 to-transparent -mx-6 -mt-6 px-6 pt-6 pb-5 mb-5 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-violet-500/10 text-violet-600 border border-violet-500/20"><Truck className="h-5 w-5" /></div>
            <div><DialogTitle className="text-base font-semibold">Distribute to Van</DialogTitle><DialogDescription className="text-xs mt-0">Load full bottles onto driver's van</DialogDescription></div>
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Product" required>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="h-11">
                <ProductSelectTrigger selectedId={productId} products={productOptions} placeholder="Select product…" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {productOptions.map(p => (
                  <SelectItem key={p.id} value={p.id} className="py-1.5">
                    <ProductDropdownItem name={p.name} unit={p.unit} imageUrl={p.imageUrl} stockLabel={p.stockLabel} stockVariant={p.stockVariant} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {selected && (
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Full bottles available</span>
              <span className="font-semibold text-emerald-600">{selected.balance.full}</span>
            </div>
          )}

          <Field label="Driver" required>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger><SelectValue placeholder="Select driver…" /></SelectTrigger>
              <SelectContent>
                {drivers.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.firstName} {d.lastName}{d.numberPlate && ` — ${d.numberPlate}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Quantity" required>
            <Input type="number" min={1} placeholder="0" max={selected?.balance.full} value={quantity} onChange={e => setQuantity(e.target.value)} />
          </Field>

          <Field label="Notes">
            <Textarea rows={2} className="resize-none" placeholder="Optional…" value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="ocean" className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}Distribute
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Direct Sale ───────────────────────────────────────────────────────────────
// ✅ Updated: shows DriverSaleReceiptModal after a successful sale

const DirectSaleDialog: React.FC<{
  open:    boolean;
  mode:    'bottle' | 'consumable';
  products: Array<{
    id:             string;
    name:           string;
    maxQty:         number;
    selling_price?: string;
    unit?:          string;
    imageUrl?:      string | null;
  }>;
  onClose: () => void;
  onSaved: (id: string) => void;
}> = ({ open, mode, products, onClose, onSaved }) => {
  const { toast }  = useToast();
  const { user }   = useAuth();

  const [loading,      setLoading]      = useState(false);
  const [productId,    setProductId]    = useState('');
  const [quantity,     setQuantity]     = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes,        setNotes]        = useState('');

  // ── Receipt state ─────────────────────────────────────────────────────────
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<DriverSaleData | null>(null);

  const selected = products.find(p => p.id === productId);

  useEffect(() => {
    if (open) { setProductId(''); setQuantity(''); setCustomerName(''); setNotes(''); }
  }, [open]);

  const productOptions = products.map(p => ({
    id:           p.id,
    name:         p.name,
    unit:         p.unit,
    imageUrl:     p.imageUrl ?? null,
    stockLabel:   `${p.maxQty} in stock`,
    stockVariant: (
      p.maxQty <= 0
        ? 'out'
        : p.maxQty <= (mode === 'bottle' ? 5 : 10)
          ? 'low'
          : 'ok'
    ) as 'ok' | 'low' | 'out',
  }));

  const handleSubmit = async () => {
    if (!productId) return toast({ title: 'Select a product', variant: 'destructive' });
    const qty = parseInt(quantity) || 0;
    if (qty < 1) return toast({ title: 'Enter quantity', variant: 'destructive' });

    setLoading(true);
    try {
      if (mode === 'bottle') {
        await bottleStoreService.directSale({
          product:       productId,
          quantity:      qty,
          customer_name: customerName,
          notes,
        });
      } else {
        await consumableStoreService.directSale({
          product:       productId,
          quantity:      qty,
          customer_name: customerName,
          notes,
        });
      }

      toast({ title: `Direct sale — ${qty} units recorded.` });

      // ── Build receipt ────────────────────────────────────────────────────
      const servedBy = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Store Admin';

      const receipt: DriverSaleData = {
        productName:   selected?.name    ?? 'Product',
        productUnit:   selected?.unit    ?? (mode === 'bottle' ? 'BOTTLES' : 'UNITS'),
        isReturnable:  mode === 'bottle',
        quantity:      qty,
        unitPrice:     selected?.selling_price ? parseFloat(selected.selling_price) : 0,
        customerName:  customerName.trim() || 'Walk-in Customer',
        customerPhone: undefined,
        isWalkIn:      true,
        paymentMethod: 'CASH',
        servedBy,
        date:          new Date().toISOString(),
      };

      // Show receipt before calling onSaved so parent can reload stock in bg
      setReceiptData(receipt);
      setShowReceipt(true);
      onClose();           // close the sale form dialog
      onSaved(productId);  // trigger stock refresh on the parent

    } catch (err: unknown) {
      toast({
        title:       'Error',
        description: (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to record sale.',
        variant:     'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-sm max-h-[90dvh] overflow-y-auto">
          <div className="bg-gradient-to-br from-amber-500/10 to-transparent -mx-6 -mt-6 px-6 pt-6 pb-5 mb-5 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20"><ShoppingBag className="h-5 w-5" /></div>
              <div><DialogTitle className="text-base font-semibold">Direct Sale</DialogTitle><DialogDescription className="text-xs mt-0">Walk-in or one-time customer</DialogDescription></div>
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Product" required>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="h-11">
                  <ProductSelectTrigger selectedId={productId} products={productOptions} placeholder="Select product…" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {productOptions.map(p => (
                    <SelectItem key={p.id} value={p.id} className="py-1.5">
                      <ProductDropdownItem name={p.name} unit={p.unit} imageUrl={p.imageUrl} stockLabel={p.stockLabel} stockVariant={p.stockVariant} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {selected?.selling_price && (
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Price per unit</span>
                <span className="font-semibold">KES {parseFloat(selected.selling_price).toLocaleString()}</span>
              </div>
            )}

            <Field label="Quantity" required>
              <Input type="number" min={1} placeholder="0" max={selected?.maxQty} value={quantity} onChange={e => setQuantity(e.target.value)} />
            </Field>

            <Field label="Customer name" hint="Leave blank if anonymous">
              <Input placeholder="e.g. John Kamau" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </Field>

            <Field label="Notes">
              <Textarea rows={2} className="resize-none" placeholder="Optional…" value={notes} onChange={e => setNotes(e.target.value)} />
            </Field>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button variant="ocean" className="flex-1" onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingBag className="h-4 w-4 mr-2" />}Record Sale
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt modal — fixed overlay, renders above everything */}
      {receiptData && (
        <DriverSaleReceiptModal
          open={showReceipt}
          onClose={() => {
            setShowReceipt(false);
            setReceiptData(null);
          }}
          sale={receiptData}
        />
      )}
    </>
  );
};

// ── Receive Consumable ────────────────────────────────────────────────────────

const ReceiveConsumableDialog: React.FC<{
  open: boolean; products: ConsumableProductStore[];
  onClose: () => void; onSaved: (id: string, b: ConsumableBalance) => void;
}> = ({ open, products, onClose, onSaved }) => {
  const { toast } = useToast();
  const [loading, setLoading]           = useState(false);
  const [productId, setProductId]       = useState('');
  const [quantity, setQuantity]         = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [notes, setNotes]               = useState('');

  useEffect(() => { if (open) { setProductId(''); setQuantity(''); setSupplierName(''); setNotes(''); } }, [open]);

  const productOptions = products.map(p => ({
    id:       p.product_id,
    name:     p.product_name,
    unit:     p.unit,
    imageUrl: (p as unknown as Record<string, string | null>).product_image ?? null,
    stockLabel:   `${p.balance.in_stock} in stock`,
    stockVariant: (p.balance.in_stock <= 0 ? 'out' : p.balance.in_stock <= 10 ? 'low' : 'ok') as 'ok' | 'low' | 'out',
  }));

  const handleSubmit = async () => {
    if (!productId) return toast({ title: 'Select a product', variant: 'destructive' });
    const qty = parseInt(quantity) || 0;
    if (qty < 1) return toast({ title: 'Enter quantity', variant: 'destructive' });
    setLoading(true);
    try {
      const res = await consumableStoreService.receive({ product: productId, quantity: qty, supplier_name: supplierName, notes });
      toast({ title: `${qty} units received.` });
      onSaved(productId, res.balance); onClose();
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm max-h-[90dvh] overflow-y-auto">
        <div className="bg-gradient-to-br from-sky-500/10 to-transparent -mx-6 -mt-6 px-6 pt-6 pb-5 mb-5 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-sky-500/10 text-sky-600 border border-sky-500/20"><PackageCheck className="h-5 w-5" /></div>
            <div><DialogTitle className="text-base font-semibold">Receive Stock</DialogTitle><DialogDescription className="text-xs mt-0">Add stock from supplier</DialogDescription></div>
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Product" required>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="h-11">
                <ProductSelectTrigger selectedId={productId} products={productOptions} placeholder="Select product…" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {productOptions.map(p => (
                  <SelectItem key={p.id} value={p.id} className="py-1.5">
                    <ProductDropdownItem name={p.name} unit={p.unit} imageUrl={p.imageUrl} stockLabel={p.stockLabel} stockVariant={p.stockVariant} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Quantity" required>
            <Input type="number" min={1} placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} />
          </Field>

          <Field label="Supplier" hint="Optional">
            <Input placeholder="e.g. Aqua Supplier Ltd" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
          </Field>

          <Field label="Notes" hint="Invoice, batch, etc.">
            <Textarea rows={2} className="resize-none" placeholder="Optional…" value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="ocean" className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackageCheck className="h-4 w-4 mr-2" />}Receive
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Distribute Consumable ─────────────────────────────────────────────────────

const DistributeConsumableDialog: React.FC<{
  open: boolean; products: ConsumableProductStore[]; drivers: Employee[];
  onClose: () => void; onSaved: (id: string, b: ConsumableBalance) => void;
}> = ({ open, products, drivers, onClose, onSaved }) => {
  const { toast } = useToast();
  const [loading, setLoading]     = useState(false);
  const [productId, setProductId] = useState('');
  const [driverId, setDriverId]   = useState('');
  const [quantity, setQuantity]   = useState('');
  const [notes, setNotes]         = useState('');

  const selected = products.find(p => p.product_id === productId);

  useEffect(() => { if (open) { setProductId(''); setDriverId(''); setQuantity(''); setNotes(''); } }, [open]);

  const productOptions = products.map(p => ({
    id:       p.product_id,
    name:     p.product_name,
    unit:     p.unit,
    imageUrl: (p as unknown as Record<string, string | null>).product_image ?? null,
    stockLabel:   `${p.balance.in_stock} in stock`,
    stockVariant: (p.balance.in_stock <= 0 ? 'out' : p.balance.in_stock <= 10 ? 'low' : 'ok') as 'ok' | 'low' | 'out',
  }));

  const handleSubmit = async () => {
    if (!productId) return toast({ title: 'Select a product', variant: 'destructive' });
    if (!driverId)  return toast({ title: 'Select a driver',  variant: 'destructive' });
    const qty = parseInt(quantity) || 0;
    if (qty < 1) return toast({ title: 'Enter quantity', variant: 'destructive' });
    setLoading(true);
    try {
      const res = await consumableStoreService.distribute({ product: productId, driver_id: driverId, quantity: qty, notes });
      toast({ title: `${qty} units distributed.` });
      onSaved(productId, res.balance); onClose();
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm max-h-[90dvh] overflow-y-auto">
        <div className="bg-gradient-to-br from-violet-500/10 to-transparent -mx-6 -mt-6 px-6 pt-6 pb-5 mb-5 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-violet-500/10 text-violet-600 border border-violet-500/20"><ArrowRightLeft className="h-5 w-5" /></div>
            <div><DialogTitle className="text-base font-semibold">Distribute to Van</DialogTitle><DialogDescription className="text-xs mt-0">Load consumables onto driver's van</DialogDescription></div>
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Product" required>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="h-11">
                <ProductSelectTrigger selectedId={productId} products={productOptions} placeholder="Select product…" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {productOptions.map(p => (
                  <SelectItem key={p.id} value={p.id} className="py-1.5">
                    <ProductDropdownItem name={p.name} unit={p.unit} imageUrl={p.imageUrl} stockLabel={p.stockLabel} stockVariant={p.stockVariant} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {selected && (
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Available</span>
              <span className="font-semibold">{selected.balance.in_stock}</span>
            </div>
          )}

          <Field label="Driver" required>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger><SelectValue placeholder="Select driver…" /></SelectTrigger>
              <SelectContent>
                {drivers.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.firstName} {d.lastName}{d.numberPlate && ` — ${d.numberPlate}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Quantity" required>
            <Input type="number" min={1} placeholder="0" max={selected?.balance.in_stock} value={quantity} onChange={e => setQuantity(e.target.value)} />
          </Field>

          <Field label="Notes">
            <Textarea rows={2} className="resize-none" placeholder="Optional…" value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="ocean" className="flex-1" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}Distribute
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

interface StorePageProps {
  layout?: 'dashboard' | 'manager';
}

const StorePage: React.FC<StorePageProps> = ({ layout = 'dashboard' }) => {
  const { toast } = useToast();

  const [bottleProducts,     setBottleProducts]     = useState<BottleProductStore[]>([]);
  const [consumableProducts, setConsumableProducts] = useState<ConsumableProductStore[]>([]);
  const [drivers,            setDrivers]            = useState<Employee[]>([]);
  const [isLoading,          setIsLoading]          = useState(true);

  const [bottleDialog,     setBottleDialog]     = useState<BottleDialog>(null);
  const [consumableDialog, setConsumableDialog] = useState<ConsumableDialog>(null);
  const [drawerProduct,    setDrawerProduct]    = useState<DrawerProduct | null>(null);

  // Bottles toolbar state
  const [bSearch,       setBSearch]       = useState('');
  const [bSort,         setBSort]         = useState<SortKey>('name');
  const [bGroup,        setBGroup]        = useState<GroupMode>('none');
  const [bView,         setBView]         = useState<ViewMode>('list');
  const [bFilter,       setBFilter]       = useState<'all' | 'low' | 'out'>('all');
  const [bDTF,          setBDTF]          = useState<DateTimeFilter>(emptyDTF);
  const [bDriverFilter, setBDriverFilter] = useState('');
  const [bExpanded,     setBExpanded]     = useState<Set<string>>(new Set());

  // Consumables toolbar state
  const [cSearch,       setCSearch]       = useState('');
  const [cSort,         setCSort]         = useState<SortKey>('name');
  const [cGroup,        setCGroup]        = useState<GroupMode>('none');
  const [cView,         setCView]         = useState<ViewMode>('grid');
  const [cFilter,       setCFilter]       = useState<'all' | 'low' | 'out'>('all');
  const [cDTF,          setCDTF]          = useState<DateTimeFilter>(emptyDTF);
  const [cDriverFilter, setCDriverFilter] = useState('');
  const [cExpanded,     setCExpanded]     = useState<Set<string>>(new Set());

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [bottles, consumables, driverList] = await Promise.all([
        bottleStoreService.getAll(),
        consumableStoreService.getAll(),
        fetchDrivers(),
      ]);
      setBottleProducts(bottles);
      setConsumableProducts(consumables);
      setDrivers(driverList);
    } catch {
      toast({ title: 'Error', description: 'Failed to load store data.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // ── Balance helpers ────────────────────────────────────────────────────────
  const updateBottleBalance = (id: string, b: BottleBalance) =>
    setBottleProducts(prev => prev.map(p => p.product_id === id ? { ...p, balance: b } : p));

  const reloadBottleHistory = async (id: string) => {
    const updated = await bottleStoreService.getAll();
    const found = updated.find(p => p.product_id === id);
    if (found) setBottleProducts(prev => prev.map(p => p.product_id === id ? found : p));
  };

  const updateConsumableBalance = (id: string, b: ConsumableBalance) =>
    setConsumableProducts(prev => prev.map(p => p.product_id === id ? { ...p, balance: b } : p));

  // ── Toolbar date/time filter for last activity ─────────────────────────────
  const passesToolbarDTF = (history: unknown[], dtf: DateTimeFilter): boolean => {
    if (!dtf.dateFrom && !dtf.dateTo && !dtf.timeFrom && !dtf.timeTo) return true;
    const last = lastMovement(history);
    if (last.getTime() === 0) return false;
    const item: HistoryItem = { id: '', movement_type: '', movement_type_display: '', movement_date: last.toISOString() };
    return passesDateTimeFilter(item, dtf);
  };

  // ── Filtered + sorted bottles ──────────────────────────────────────────────
  const filteredBottles = useMemo(() => {
    let result = [...bottleProducts];
    if (bSearch)            result = result.filter(p => p.product_name.toLowerCase().includes(bSearch.toLowerCase()));
    if (bFilter === 'out')  result = result.filter(p => p.balance.full <= 0);
    else if (bFilter === 'low') result = result.filter(p => p.balance.full > 0 && p.balance.full <= 5);
    result = result.filter(p => passesToolbarDTF(p.history, bDTF));
    if (bGroup === 'driver' && bDriverFilter) {
      result = result.filter(p => getLastDriverName(p.history) === bDriverFilter);
    }
    result.sort((a, b) => {
      switch (bSort) {
        case 'name':       return a.product_name.localeCompare(b.product_name);
        case 'stock_desc': return b.balance.full - a.balance.full;
        case 'stock_asc':  return a.balance.full - b.balance.full;
        case 'date_desc':  return lastMovement(b.history).getTime() - lastMovement(a.history).getTime();
        case 'date_asc':   return lastMovement(a.history).getTime() - lastMovement(b.history).getTime();
        default:           return 0;
      }
    });
    return result;
  }, [bottleProducts, bSearch, bSort, bFilter, bDTF, bGroup, bDriverFilter]);

  // ── Filtered + sorted consumables ──────────────────────────────────────────
  const filteredConsumables = useMemo(() => {
    let result = [...consumableProducts];
    if (cSearch)            result = result.filter(p => p.product_name.toLowerCase().includes(cSearch.toLowerCase()));
    if (cFilter === 'out')  result = result.filter(p => p.balance.in_stock <= 0);
    else if (cFilter === 'low') result = result.filter(p => p.balance.in_stock > 0 && p.balance.in_stock <= 10);
    result = result.filter(p => passesToolbarDTF(p.history, cDTF));
    if (cGroup === 'driver' && cDriverFilter) {
      result = result.filter(p => getLastDriverName(p.history) === cDriverFilter);
    }
    result.sort((a, b) => {
      switch (cSort) {
        case 'name':       return a.product_name.localeCompare(b.product_name);
        case 'stock_desc': return b.balance.in_stock - a.balance.in_stock;
        case 'stock_asc':  return a.balance.in_stock - b.balance.in_stock;
        case 'date_desc':  return lastMovement(b.history).getTime() - lastMovement(a.history).getTime();
        case 'date_asc':   return lastMovement(a.history).getTime() - lastMovement(b.history).getTime();
        default:           return 0;
      }
    });
    return result;
  }, [consumableProducts, cSearch, cSort, cFilter, cDTF, cGroup, cDriverFilter]);

  // ── Grouped bottles ────────────────────────────────────────────────────────
  const groupedBottles = useMemo(() => {
    if (bGroup === 'none') return { '': filteredBottles };
    if (bGroup === 'unit') {
      const g: Record<string, BottleProductStore[]> = {};
      filteredBottles.forEach(p => {
        const k = ((p as unknown) as Record<string, string>).product_unit ?? 'BOTTLES';
        if (!g[k]) g[k] = [];
        g[k].push(p);
      });
      return g;
    }
    if (bGroup === 'driver') {
      const g: Record<string, BottleProductStore[]> = {};
      filteredBottles.forEach(p => {
        const driverKey = getLastDriverName(p.history);
        const label = driverKey === '__unassigned__' ? 'No driver assigned' : driverKey;
        if (!g[label]) g[label] = [];
        g[label].push(p);
      });
      return Object.fromEntries(
        Object.entries(g).sort(([a], [b]) => {
          if (a === 'No driver assigned') return 1;
          if (b === 'No driver assigned') return -1;
          return a.localeCompare(b);
        })
      );
    }
    const g: Record<string, BottleProductStore[]> = { 'Out of stock': [], 'Low stock (≤5)': [], 'In stock': [] };
    filteredBottles.forEach(p => {
      if (p.balance.full <= 0) g['Out of stock'].push(p);
      else if (p.balance.full <= 5) g['Low stock (≤5)'].push(p);
      else g['In stock'].push(p);
    });
    return Object.fromEntries(Object.entries(g).filter(([, v]) => v.length > 0));
  }, [filteredBottles, bGroup]);

  // ── Grouped consumables ────────────────────────────────────────────────────
  const groupedConsumables = useMemo(() => {
    if (cGroup === 'none') return { '': filteredConsumables };
    if (cGroup === 'unit') {
      const g: Record<string, ConsumableProductStore[]> = {};
      filteredConsumables.forEach(p => {
        const k = p.unit ?? 'UNITS';
        if (!g[k]) g[k] = [];
        g[k].push(p);
      });
      return g;
    }
    if (cGroup === 'driver') {
      const g: Record<string, ConsumableProductStore[]> = {};
      filteredConsumables.forEach(p => {
        const driverKey = getLastDriverName(p.history);
        const label = driverKey === '__unassigned__' ? 'No driver assigned' : driverKey;
        if (!g[label]) g[label] = [];
        g[label].push(p);
      });
      return Object.fromEntries(
        Object.entries(g).sort(([a], [b]) => {
          if (a === 'No driver assigned') return 1;
          if (b === 'No driver assigned') return -1;
          return a.localeCompare(b);
        })
      );
    }
    const g: Record<string, ConsumableProductStore[]> = { 'Out of stock': [], 'Low stock (≤10)': [], 'In stock': [] };
    filteredConsumables.forEach(p => {
      if (p.balance.in_stock <= 0) g['Out of stock'].push(p);
      else if (p.balance.in_stock <= 10) g['Low stock (≤10)'].push(p);
      else g['In stock'].push(p);
    });
    return Object.fromEntries(Object.entries(g).filter(([, v]) => v.length > 0));
  }, [filteredConsumables, cGroup]);

  const toggleBExpanded = (id: string) => setBExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleCExpanded = (id: string) => setCExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // ── Render ─────────────────────────────────────────────────────────────────
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    layout === 'manager'
      ? <ManagerLayout title="Store" subtitle="Daily stock operations">{children}</ManagerLayout>
      : <DashboardLayout title="Store" subtitle="Daily stock operations">{children}</DashboardLayout>;

  return (
    <Wrapper>
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="bottles" className="space-y-5">

          <div className="flex items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="bottles" className="gap-2">
                <Droplets className="h-4 w-4" />Bottles
                {bottleProducts.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 h-4">{bottleProducts.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="consumables" className="gap-2">
                <Package className="h-4 w-4" />Consumables
                {consumableProducts.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 h-4">{consumableProducts.length}</Badge>}
              </TabsTrigger>
            </TabsList>
            <Button variant="ghost" size="icon" onClick={load} className="h-9 w-9"><RefreshCw className="h-4 w-4" /></Button>
          </div>

          {/* ══ BOTTLES TAB ══ */}
          <TabsContent value="bottles" className="space-y-4 mt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Receive Empties', icon: <ArrowDownToLine className="h-4 w-4" />, color: 'text-blue-600',    bg: 'hover:bg-blue-500/5 hover:border-blue-500/20',       onClick: () => setBottleDialog('receive')    },
                { label: 'Refill',          icon: <RotateCcw       className="h-4 w-4" />, color: 'text-emerald-600', bg: 'hover:bg-emerald-500/5 hover:border-emerald-500/20', onClick: () => setBottleDialog('refill')     },
                { label: 'Distribute',      icon: <Truck           className="h-4 w-4" />, color: 'text-violet-600',  bg: 'hover:bg-violet-500/5 hover:border-violet-500/20',   onClick: () => setBottleDialog('distribute') },
                { label: 'Direct Sale',     icon: <ShoppingBag     className="h-4 w-4" />, color: 'text-amber-600',   bg: 'hover:bg-amber-500/5 hover:border-amber-500/20',     onClick: () => setBottleDialog('sale')       },
              ].map(btn => (
                <button key={btn.label} onClick={btn.onClick}
                  className={cn('flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5 transition-colors cursor-pointer', btn.bg)}
                >
                  <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg bg-muted/60 shrink-0', btn.color)}>{btn.icon}</div>
                  <span className="text-sm font-medium">{btn.label}</span>
                </button>
              ))}
            </div>

            {bottleProducts.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                  <Droplets className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No returnable bottle products found.</p>
                  <p className="text-xs text-muted-foreground/70">Go to Catalogue and enable "Returnable" on a product.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Toolbar
                  search={bSearch}       onSearch={setBSearch}
                  sortKey={bSort}        onSort={setBSort}
                  groupMode={bGroup}     onGroup={v => { setBGroup(v); if (v !== 'driver') setBDriverFilter(''); }}
                  viewMode={bView}       onView={setBView}
                  filterStock={bFilter}  onFilter={setBFilter}
                  dtFilter={bDTF}        onDTFilter={setBDTF}
                  resultCount={filteredBottles.length}
                  drivers={drivers}
                  driverFilter={bDriverFilter}
                  onDriverFilter={setBDriverFilter}
                />
                {filteredBottles.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">No products match your filters.</div>
                ) : bView === 'grid' ? (
                  <div className="space-y-4">
                    {Object.entries(groupedBottles).map(([groupLabel, items]) => (
                      <div key={groupLabel} className="space-y-3">
                        {bGroup !== 'none' && groupLabel && (
                          <GroupLabel label={groupLabel} count={items.length} isDriver={bGroup === 'driver'} />
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                          {items.map(p => (
                            <BottleGridCard
                              key={p.product_id}
                              p={p as BottleProductStore & { product_image?: string | null }}
                              onOpen={() => setDrawerProduct({ ...(p as BottleProductStore & { product_image?: string | null }), kind: 'bottle' })}
                              onAction={type => setBottleDialog(type as BottleDialog)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedBottles).map(([groupLabel, items]) => (
                      <div key={groupLabel} className="space-y-2">
                        {bGroup !== 'none' && groupLabel && (
                          <GroupLabel label={groupLabel} count={items.length} isDriver={bGroup === 'driver'} />
                        )}
                        {items.map(p => (
                          <BottleListRow
                            key={p.product_id}
                            p={p as BottleProductStore & { product_image?: string | null }}
                            expanded={bExpanded.has(p.product_id)}
                            onToggle={() => toggleBExpanded(p.product_id)}
                            onAction={type => setBottleDialog(type as BottleDialog)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ══ CONSUMABLES TAB ══ */}
          <TabsContent value="consumables" className="space-y-4 mt-0">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Receive Stock', icon: <PackageCheck   className="h-4 w-4" />, color: 'text-sky-600',    bg: 'hover:bg-sky-500/5 hover:border-sky-500/20',      onClick: () => setConsumableDialog('receive')    },
                { label: 'Distribute',    icon: <ArrowRightLeft className="h-4 w-4" />, color: 'text-violet-600', bg: 'hover:bg-violet-500/5 hover:border-violet-500/20', onClick: () => setConsumableDialog('distribute') },
                { label: 'Direct Sale',   icon: <ShoppingBag    className="h-4 w-4" />, color: 'text-amber-600',  bg: 'hover:bg-amber-500/5 hover:border-amber-500/20',   onClick: () => setConsumableDialog('sale')       },
              ].map(btn => (
                <button key={btn.label} onClick={btn.onClick}
                  className={cn('flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5 transition-colors cursor-pointer', btn.bg)}
                >
                  <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg bg-muted/60 shrink-0', btn.color)}>{btn.icon}</div>
                  <span className="text-sm font-medium">{btn.label}</span>
                </button>
              ))}
            </div>

            {consumableProducts.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                  <Package className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No consumable products found.</p>
                  <p className="text-xs text-muted-foreground/70">Products without "Returnable" enabled appear here.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Toolbar
                  search={cSearch}       onSearch={setCSearch}
                  sortKey={cSort}        onSort={setCSort}
                  groupMode={cGroup}     onGroup={v => { setCGroup(v); if (v !== 'driver') setCDriverFilter(''); }}
                  viewMode={cView}       onView={setCView}
                  filterStock={cFilter}  onFilter={setCFilter}
                  dtFilter={cDTF}        onDTFilter={setCDTF}
                  resultCount={filteredConsumables.length}
                  drivers={drivers}
                  driverFilter={cDriverFilter}
                  onDriverFilter={setCDriverFilter}
                />
                {filteredConsumables.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">No products match your filters.</div>
                ) : cView === 'grid' ? (
                  <div className="space-y-4">
                    {Object.entries(groupedConsumables).map(([groupLabel, items]) => (
                      <div key={groupLabel} className="space-y-3">
                        {cGroup !== 'none' && groupLabel && (
                          <GroupLabel label={groupLabel} count={items.length} isDriver={cGroup === 'driver'} />
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                          {items.map(p => (
                            <ConsumableGridCard
                              key={p.product_id}
                              p={p as ConsumableProductStore & { product_image?: string | null }}
                              onOpen={() => setDrawerProduct({ ...(p as ConsumableProductStore & { product_image?: string | null }), kind: 'consumable' })}
                              onAction={type => setConsumableDialog(type as ConsumableDialog)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedConsumables).map(([groupLabel, items]) => (
                      <div key={groupLabel} className="space-y-2">
                        {cGroup !== 'none' && groupLabel && (
                          <GroupLabel label={groupLabel} count={items.length} isDriver={cGroup === 'driver'} />
                        )}
                        {items.map(p => (
                          <ConsumableListRow
                            key={p.product_id}
                            p={p as ConsumableProductStore & { product_image?: string | null }}
                            expanded={cExpanded.has(p.product_id)}
                            onToggle={() => toggleCExpanded(p.product_id)}
                            onAction={type => setConsumableDialog(type as ConsumableDialog)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* ── Product detail drawer ── */}
      <ProductDrawer
        product={drawerProduct}
        onClose={() => setDrawerProduct(null)}
        onAction={type => {
          if (drawerProduct?.kind === 'bottle') setBottleDialog(type as BottleDialog);
          else                                  setConsumableDialog(type as ConsumableDialog);
        }}
      />

      {/* ── Bottle dialogs ── */}
      <ReceiveEmptiesDialog
        open={bottleDialog === 'receive'} products={bottleProducts} drivers={drivers}
        onClose={() => setBottleDialog(null)}
        onSaved={(id, b) => { updateBottleBalance(id, b); reloadBottleHistory(id); }}
      />
      <RefillDialog
        open={bottleDialog === 'refill'} products={bottleProducts}
        onClose={() => setBottleDialog(null)}
        onSaved={(id, b) => { updateBottleBalance(id, b); reloadBottleHistory(id); }}
      />
      <DistributeBottlesDialog
        open={bottleDialog === 'distribute'} products={bottleProducts} drivers={drivers}
        onClose={() => setBottleDialog(null)}
        onSaved={(id, b) => { updateBottleBalance(id, b); reloadBottleHistory(id); }}
      />
      <DirectSaleDialog
        open={bottleDialog === 'sale'} mode="bottle"
        products={bottleProducts.map(p => ({
          id:            p.product_id,
          name:          p.product_name,
          maxQty:        p.balance.full,
          unit:          (p as unknown as Record<string, string>).product_unit ?? 'BOTTLES',
          imageUrl:      (p as unknown as Record<string, string | null>).product_image ?? null,
          selling_price: (p as unknown as Record<string, string>).selling_price ?? undefined,
        }))}
        onClose={() => setBottleDialog(null)}
        onSaved={id => reloadBottleHistory(id)}
      />

      {/* ── Consumable dialogs ── */}
      <ReceiveConsumableDialog
        open={consumableDialog === 'receive'} products={consumableProducts}
        onClose={() => setConsumableDialog(null)}
        onSaved={(id, b) => updateConsumableBalance(id, b)}
      />
      <DistributeConsumableDialog
        open={consumableDialog === 'distribute'} products={consumableProducts} drivers={drivers}
        onClose={() => setConsumableDialog(null)}
        onSaved={(id, b) => updateConsumableBalance(id, b)}
      />
      <DirectSaleDialog
        open={consumableDialog === 'sale'} mode="consumable"
        products={consumableProducts.map(p => ({
          id:            p.product_id,
          name:          p.product_name,
          maxQty:        p.balance.in_stock,
          unit:          p.unit,
          imageUrl:      (p as unknown as Record<string, string | null>).product_image ?? null,
          selling_price: (p as unknown as Record<string, string>).selling_price ?? undefined,
        }))}
        onClose={() => setConsumableDialog(null)}
        onSaved={() => consumableStoreService.getAll().then(setConsumableProducts)}
      />
    </Wrapper>
  );
};

export default StorePage;
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
 *  ✅ Driver Stock tab: ENHANCED — search, sort, filter chips, grid/list/compact views,
 *     summary stats bar, group-by-status, color-coded avatars, animated stock bars
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
  AlignJustify, ChevronRight, Phone, Plus, Check, UserCheck, Minus,
} from 'lucide-react';
import { useToast }    from '@/hooks/use-toast';
import { useAuth }     from '@/contexts/AuthContext';
import { format, isToday, isYesterday, parseISO, startOfDay, endOfDay } from 'date-fns';
import { cn }          from '@/lib/utils';
import {
  bottleStoreService,
  consumableStoreService,
  driverVanStockService,
  type BottleProductStore,
  type ConsumableProductStore,
  type BottleBalance,
  type ConsumableBalance,
  type DriverVanStock,
} from '@/api/services/store.service';
import type { Employee } from '@/types/employee.types';
import axiosInstance from '@/api/axios.config';
import { customerAdminService, type AdminCustomer } from '@/api/services/customerAdmin.service';
import { DriverSaleReceiptModal } from '@/pages/driver/DriverSaleReceiptModal';
import type { DriverSaleData }    from '@/pages/driver/DriverSaleReceiptModal';

// ─────────────────────────────────────────────────────────────────────────────
// UNIT DISPLAY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const UNIT_LABEL_MAP: Record<string, string> = {
  BOTTLES:   'Bottles',
  LITRES:    'Litres',
  DOZENS:    'Dozens',
  PIECES:    'Pieces',
  CRATES:    'Crates',
  JERRICANS: 'Jerricans',
  SACHETS:   'Sachets',
  GALLONS:   'Gallons',
  PACKS:     'Packs',
  CARTONS:   'Cartons',
};

const UNIT_COLOR_MAP: Record<string, string> = {
  BOTTLES:   'text-violet-500 bg-violet-500/10',
  LITRES:    'text-sky-500 bg-sky-500/10',
  DOZENS:    'text-amber-500 bg-amber-500/10',
  PIECES:    'text-emerald-500 bg-emerald-500/10',
  CRATES:    'text-orange-500 bg-orange-500/10',
  JERRICANS: 'text-cyan-500 bg-cyan-500/10',
  SACHETS:   'text-pink-500 bg-pink-500/10',
  GALLONS:   'text-blue-500 bg-blue-500/10',
  PACKS:     'text-indigo-500 bg-indigo-500/10',
  CARTONS:   'text-rose-500 bg-rose-500/10',
};

// Driver van stock unit colors (slightly stronger for card context)
const DRIVER_UNIT_COLOR: Record<string, string> = {
  BOTTLES:   'text-violet-600 bg-violet-500/10',
  LITRES:    'text-sky-600   bg-sky-500/10',
  DOZENS:    'text-amber-600 bg-amber-500/10',
  PIECES:    'text-emerald-600 bg-emerald-500/10',
  CRATES:    'text-orange-600 bg-orange-500/10',
  JERRICANS: 'text-cyan-600  bg-cyan-500/10',
  SACHETS:   'text-pink-600  bg-pink-500/10',
  GALLONS:   'text-blue-600  bg-blue-500/10',
  PACKS:     'text-indigo-600 bg-indigo-500/10',
  CARTONS:   'text-rose-600  bg-rose-500/10',
};

function getUnitLabel(unit?: string) {
  return UNIT_LABEL_MAP[unit ?? ''] ?? (unit ?? '');
}
function getUnitColor(unit?: string) {
  return UNIT_COLOR_MAP[unit ?? ''] ?? 'text-muted-foreground bg-muted';
}
function getDriverUnitColor(unit?: string) {
  return DRIVER_UNIT_COLOR[unit ?? ''] ?? 'text-muted-foreground bg-muted';
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT DROPDOWN ITEM — shared across all dialogs
// ─────────────────────────────────────────────────────────────────────────────

interface ProductDropdownItemProps {
  name:          string;
  unit?:         string;
  imageUrl?:     string | null;
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
      Array.isArray(r.data)                                ? r.data :
      'data'    in r.data && Array.isArray(r.data.data)    ? r.data.data :
      'results' in r.data && Array.isArray(r.data.results) ? r.data.results :
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
  const [dtf, setDtf]               = useState<DateTimeFilter>(emptyDTF);
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
// TOOLBAR (Bottles / Consumables tabs)
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
// GRID CARDS (Bottles / Consumables)
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
  const [dtf, setDtf]       = useState<DateTimeFilter>(emptyDTF);
  const [showDT, setShowDT] = useState(false);
  const history     = p.history as HistoryItem[];
  const times       = availableTimes(history);
  const filtered    = history.filter(i => passesDateTimeFilter(i, dtf));
  const grouped     = groupByDate(filtered);
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
  const [dtf, setDtf]       = useState<DateTimeFilter>(emptyDTF);
  const [showDT, setShowDT] = useState(false);
  const history     = p.history as HistoryItem[];
  const times       = availableTimes(history);
  const filtered    = history.filter(i => passesDateTimeFilter(i, dtf));
  const grouped     = groupByDate(filtered);
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
// DRIVER VAN STOCK — ENHANCED TAB
// ─────────────────────────────────────────────────────────────────────────────

type DriverStockStatus = 'ok' | 'low' | 'empty';
type DVViewMode        = 'grid' | 'list' | 'compact';
type DVSortKey         = 'name' | 'total_desc' | 'total_asc' | 'bottles_desc' | 'consumables_desc';
type DVFilterMode      = 'all' | 'stocked' | 'low' | 'empty';
type DVGroupMode       = 'none' | 'status';

function driverStockStatus(d: DriverVanStock): DriverStockStatus {
  if (d.total_items <= 0) return 'empty';
  if (d.total_items <= 5) return 'low';
  return 'ok';
}

function dvBottlesFull(d: DriverVanStock) {
  return d.bottles.reduce((s, b) => s + b.balance.full, 0);
}
function dvConsTotal(d: DriverVanStock) {
  return d.consumables.reduce((s, c) => s + c.balance.in_stock, 0);
}

// Avatar with name-derived colour
const AVATAR_PALETTES = [
  'bg-violet-500/15 text-violet-700 border-violet-300/40 dark:text-violet-300 dark:border-violet-700/40',
  'bg-sky-500/15    text-sky-700    border-sky-300/40    dark:text-sky-300    dark:border-sky-700/40',
  'bg-emerald-500/15 text-emerald-700 border-emerald-300/40 dark:text-emerald-300 dark:border-emerald-700/40',
  'bg-amber-500/15  text-amber-700  border-amber-300/40  dark:text-amber-300  dark:border-amber-700/40',
  'bg-rose-500/15   text-rose-700   border-rose-300/40   dark:text-rose-300   dark:border-rose-700/40',
  'bg-indigo-500/15 text-indigo-700 border-indigo-300/40 dark:text-indigo-300 dark:border-indigo-700/40',
];

function dvAvatarPalette(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length];
}

function dvInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
}

const DriverAvatar: React.FC<{ name: string; size?: 'sm' | 'md' }> = ({ name, size = 'md' }) => {
  const dims = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <div className={cn(
      'flex items-center justify-center rounded-full border font-semibold shrink-0 select-none',
      dims, dvAvatarPalette(name),
    )}>
      {dvInitials(name) || <User className="h-4 w-4" />}
    </div>
  );
};

const DVStockBar: React.FC<{ value: number; status: DriverStockStatus }> = ({ value, status }) => (
  <div className="h-1.5 rounded-full bg-muted overflow-hidden w-full">
    <div
      className={cn(
        'h-full rounded-full transition-all duration-500',
        status === 'empty' ? 'w-0' : status === 'low' ? 'bg-amber-500' : 'bg-emerald-500',
      )}
      style={{ width: status === 'empty' ? '0%' : `${Math.min(100, (value / 30) * 100)}%` }}
    />
  </div>
);

// ── Driver Grid Card ───────────────────────────────────────────────────────────

const DriverGridCard: React.FC<{ driver: DriverVanStock }> = ({ driver }) => {
  const [expanded, setExpanded] = useState(false);
  const status        = driverStockStatus(driver);
  const hasBottles    = driver.bottles.length > 0;
  const hasConsumables = driver.consumables.length > 0;

  return (
    <Card className={cn(
      'border-border/50 overflow-hidden transition-all duration-200',
      status === 'empty' && 'border-destructive/20',
      status === 'low'   && 'border-amber-500/20',
    )}>
      <CardContent className="p-0">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <DriverAvatar name={driver.driver_name} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm truncate">{driver.driver_name}</p>
                <Badge
                  variant={status === 'empty' ? 'destructive' : status === 'low' ? 'warning' : 'secondary'}
                  className="text-[10px] tabular-nums shrink-0 py-0 h-4"
                >
                  {driver.total_items} item{driver.total_items !== 1 ? 's' : ''}
                </Badge>
              </div>
              {driver.vehicle_number ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Truck className="h-3 w-3 shrink-0" />{driver.vehicle_number}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/50 mt-0.5 italic">No vehicle</p>
              )}
            </div>
          </div>

          {/* Stock bar */}
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{driver.bottles.length} bottle type{driver.bottles.length !== 1 ? 's' : ''}</span>
              <span>{driver.consumables.length} consumable{driver.consumables.length !== 1 ? 's' : ''}</span>
            </div>
            <DVStockBar value={driver.total_items} status={status} />
          </div>

          {/* Product pills */}
          {driver.total_items > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {driver.bottles.slice(0, 3).map(b => (
                <div key={b.product_id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/8 border border-blue-200/50 dark:border-blue-800/30">
                  <Droplets className="h-2.5 w-2.5 text-blue-500 shrink-0" />
                  <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300 max-w-20 truncate">{b.product_name}</span>
                  <span className="text-[10px] font-bold text-emerald-600 tabular-nums">{b.balance.full}</span>
                </div>
              ))}
              {driver.consumables.slice(0, 2).map(c => (
                <div key={c.product_id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/8 border border-sky-200/50 dark:border-sky-800/30">
                  <Package className="h-2.5 w-2.5 text-sky-500 shrink-0" />
                  <span className="text-[10px] font-medium text-sky-700 dark:text-sky-300 max-w-20 truncate">{c.product_name}</span>
                  <span className="text-[10px] font-bold text-sky-600 tabular-nums">{c.balance.in_stock}</span>
                </div>
              ))}
              {(driver.bottles.length + driver.consumables.length > 5) && (
                <div className="flex items-center px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">
                  +{driver.bottles.length + driver.consumables.length - 5} more
                </div>
              )}
            </div>
          )}

          {driver.total_items === 0 && (
            <div className="mt-3 rounded-lg border border-dashed py-2 text-center text-xs text-muted-foreground/60">
              No stock on van
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center justify-between w-full px-4 py-2 border-t border-border/40 hover:bg-muted/30 transition-colors text-xs text-muted-foreground hover:text-foreground"
        >
          <span>{expanded ? 'Hide breakdown' : 'Show breakdown'}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>

        {/* Expanded breakdown */}
        {expanded && (
          <div className="border-t border-border/30 bg-muted/10 px-4 py-3 space-y-3">
            {hasBottles && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Droplets className="h-3 w-3" /> Returnable Bottles
                </p>
                <div className="space-y-2">
                  {driver.bottles.map(b => (
                    <div key={b.product_id} className="rounded-xl border border-border/50 bg-card px-3 py-2.5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium truncate flex-1 mr-2">{b.product_name}</p>
                        {b.selling_price && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            KES {parseFloat(b.selling_price).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { label: 'Full',    value: b.balance.full,    color: 'text-emerald-600', bg: 'bg-emerald-500/8'  },
                          { label: 'Empty',   value: b.balance.empty,   color: 'text-amber-600',   bg: 'bg-amber-500/8'    },
                          { label: 'Damaged', value: b.balance.damaged, color: 'text-orange-600',  bg: 'bg-orange-500/8'   },
                          { label: 'Missing', value: b.balance.missing, color: 'text-destructive', bg: 'bg-destructive/5'  },
                        ].map(s => (
                          <div key={s.label} className={cn('rounded-lg px-1 py-1.5 text-center', s.bg)}>
                            <p className={cn('text-xs font-bold tabular-nums', s.color)}>{s.value}</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasConsumables && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Package className="h-3 w-3" /> Consumables
                </p>
                <div className="space-y-1.5">
                  {driver.consumables.map(c => (
                    <div key={c.product_id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{c.product_name}</p>
                        {c.unit && (
                          <span className={cn('inline-flex text-[9px] font-semibold px-1.5 py-0 rounded-full mt-0.5', getDriverUnitColor(c.unit))}>
                            {getUnitLabel(c.unit)}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums text-sky-600">{c.balance.in_stock}</p>
                        {c.selling_price && (
                          <p className="text-[9px] text-muted-foreground">KES {parseFloat(c.selling_price).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasBottles && !hasConsumables && (
              <p className="text-xs text-muted-foreground text-center py-2">No stock details available.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ── Driver List Row ────────────────────────────────────────────────────────────

const DriverListRow: React.FC<{ driver: DriverVanStock }> = ({ driver }) => {
  const [expanded, setExpanded] = useState(false);
  const status        = driverStockStatus(driver);
  const totalFull     = dvBottlesFull(driver);
  const totalCons     = dvConsTotal(driver);

  return (
    <Card className={cn(
      'border-border/50 overflow-hidden',
      status === 'empty' && 'border-destructive/20',
      status === 'low'   && 'border-amber-500/20',
    )}>
      <div
        role="button"
        tabIndex={0}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => setExpanded(v => !v)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setExpanded(v => !v)}
      >
        <DriverAvatar name={driver.driver_name} size="sm" />

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{driver.driver_name}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Truck className="h-3 w-3 shrink-0" />
            {driver.vehicle_number || 'No vehicle'}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs shrink-0">
          <div className="text-center">
            <p className="font-bold text-blue-600 tabular-nums">{totalFull}</p>
            <p className="text-muted-foreground text-[10px]">Bottles</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-sky-600 tabular-nums">{totalCons}</p>
            <p className="text-muted-foreground text-[10px]">Units</p>
          </div>
          <div className="text-center">
            <p className={cn('font-bold tabular-nums', status === 'empty' ? 'text-destructive' : status === 'low' ? 'text-amber-600' : 'text-emerald-600')}>{driver.total_items}</p>
            <p className="text-muted-foreground text-[10px]">Total</p>
          </div>
        </div>

        <Badge
          variant={status === 'empty' ? 'destructive' : status === 'low' ? 'warning' : 'secondary'}
          className="text-[10px] shrink-0 sm:hidden py-0 h-4"
        >
          {driver.total_items}
        </Badge>

        <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 transition-transform', expanded && 'rotate-180')} />
      </div>

      {expanded && (
        <div className="border-t border-border/40 px-4 py-3 bg-muted/10">
          {(driver.bottles.length > 0 || driver.consumables.length > 0) ? (
            <div className="space-y-3">
              {driver.bottles.map(b => (
                <div key={b.product_id} className="rounded-xl border border-border/50 bg-card px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <p className="text-xs font-medium truncate flex-1">{b.product_name}</p>
                    {b.selling_price && <span className="text-[10px] text-muted-foreground">KES {parseFloat(b.selling_price).toLocaleString()}</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { l: 'Full',    v: b.balance.full,    c: 'text-emerald-600', bg: 'bg-emerald-500/8'  },
                      { l: 'Empty',   v: b.balance.empty,   c: 'text-amber-600',   bg: 'bg-amber-500/8'    },
                      { l: 'Damaged', v: b.balance.damaged, c: 'text-orange-600',  bg: 'bg-orange-500/8'   },
                      { l: 'Missing', v: b.balance.missing, c: 'text-destructive', bg: 'bg-destructive/5'  },
                    ].map(s => (
                      <div key={s.l} className={cn('rounded-lg px-2 py-1.5 text-center', s.bg)}>
                        <p className={cn('text-xs font-bold tabular-nums', s.c)}>{s.v}</p>
                        <p className="text-[9px] text-muted-foreground">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {driver.consumables.map(c => (
                <div key={c.product_id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5">
                  <Package className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.product_name}</p>
                    {c.unit && (
                      <span className={cn('inline-flex text-[9px] font-semibold px-1.5 py-0 rounded-full mt-0.5', getDriverUnitColor(c.unit))}>
                        {getUnitLabel(c.unit)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold tabular-nums text-sky-600 shrink-0">{c.balance.in_stock}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Van is empty.</p>
          )}
        </div>
      )}
    </Card>
  );
};

// ── Driver Compact Row ─────────────────────────────────────────────────────────

const DriverCompactRow: React.FC<{ driver: DriverVanStock }> = ({ driver }) => {
  const [expanded, setExpanded] = useState(false);
  const status    = driverStockStatus(driver);
  const totalFull = dvBottlesFull(driver);
  const totalCons = dvConsTotal(driver);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => setExpanded(v => !v)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setExpanded(v => !v)}
      >
        <DriverAvatar name={driver.driver_name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{driver.driver_name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{driver.vehicle_number || '—'}</p>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="flex items-center gap-1 text-blue-600"><Droplets className="h-3 w-3" />{totalFull}</span>
          <span className="flex items-center gap-1 text-sky-600"><Package className="h-3 w-3" />{totalCons}</span>
          <span className={cn('font-bold tabular-nums w-6 text-right', status === 'empty' ? 'text-destructive' : status === 'low' ? 'text-amber-600' : 'text-emerald-600')}>{driver.total_items}</span>
        </div>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ml-1', expanded && 'rotate-180')} />
      </div>

      {expanded && (
        <div className="ml-10 pl-3 border-l border-border/40 mb-2 space-y-1.5">
          {driver.bottles.map(b => (
            <div key={b.product_id} className="flex items-center gap-2 text-xs py-0.5">
              <Droplets className="h-3 w-3 text-blue-400 shrink-0" />
              <span className="flex-1 truncate text-muted-foreground">{b.product_name}</span>
              <span className="text-emerald-600 tabular-nums">{b.balance.full}f</span>
              {b.balance.empty   > 0 && <span className="text-amber-600 tabular-nums">{b.balance.empty}e</span>}
              {b.balance.damaged > 0 && <span className="text-orange-600 tabular-nums">{b.balance.damaged}d</span>}
            </div>
          ))}
          {driver.consumables.map(c => (
            <div key={c.product_id} className="flex items-center gap-2 text-xs py-0.5">
              <Package className="h-3 w-3 text-sky-400 shrink-0" />
              <span className="flex-1 truncate text-muted-foreground">{c.product_name}</span>
              <span className="text-sky-600 tabular-nums">{c.balance.in_stock}</span>
            </div>
          ))}
          {driver.bottles.length === 0 && driver.consumables.length === 0 && (
            <p className="text-[10px] text-muted-foreground/60 py-1">Empty van</p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Summary Stats ──────────────────────────────────────────────────────────────

const DVSummaryStats: React.FC<{ drivers: DriverVanStock[] }> = ({ drivers }) => {
  const totalDrivers     = drivers.length;
  const activeDrivers    = drivers.filter(d => d.total_items > 0).length;
  const totalBottles     = drivers.reduce((s, d) => s + dvBottlesFull(d), 0);
  const totalConsumables = drivers.reduce((s, d) => s + dvConsTotal(d), 0);
  const emptyDrivers     = drivers.filter(d => d.total_items <= 0).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {[
        { label: 'Active drivers',  value: `${activeDrivers}/${totalDrivers}`, icon: <Users    className="h-3.5 w-3.5" />, color: 'text-violet-600', bg: 'bg-violet-500/10' },
        { label: 'Bottles on vans', value: totalBottles,                        icon: <Droplets className="h-3.5 w-3.5" />, color: 'text-blue-600',   bg: 'bg-blue-500/10'   },
        { label: 'Units on vans',   value: totalConsumables,                    icon: <Package  className="h-3.5 w-3.5" />, color: 'text-sky-600',    bg: 'bg-sky-500/10'    },
        { label: 'Empty vans',      value: emptyDrivers,                        icon: <Truck    className="h-3.5 w-3.5" />, color: 'text-amber-600',  bg: 'bg-amber-500/10'  },
      ].map(s => (
        <div key={s.label} className="rounded-xl border border-border/50 bg-card px-3 py-2.5 flex items-center gap-2.5">
          <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg shrink-0', s.bg, s.color)}>
            {s.icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
            <p className={cn('text-lg font-bold tabular-nums leading-tight', s.color)}>{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Driver Van Stock Tab (enhanced) ───────────────────────────────────────────

const DriverVanStockTab: React.FC<{
  drivers:   DriverVanStock[];
  search:    string;
  onSearch:  (v: string) => void;
  onRefresh: () => void;
}> = ({ drivers, search, onSearch, onRefresh }) => {
  const [viewMode,   setViewMode]   = useState<DVViewMode>('grid');
  const [sortKey,    setSortKey]    = useState<DVSortKey>('name');
  const [filterMode, setFilterMode] = useState<DVFilterMode>('all');
  const [groupMode,  setGroupMode]  = useState<DVGroupMode>('none');

  const clearAll = useCallback(() => {
    onSearch(''); setSortKey('name'); setFilterMode('all'); setGroupMode('none');
  }, [onSearch]);

  const hasFilters = !!(search || sortKey !== 'name' || filterMode !== 'all' || groupMode !== 'none');

  const processed = useMemo(() => {
    let result = [...drivers];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.driver_name.toLowerCase().includes(q) ||
        d.vehicle_number.toLowerCase().includes(q),
      );
    }

    if (filterMode !== 'all') {
      result = result.filter(d => {
        const s = driverStockStatus(d);
        if (filterMode === 'stocked') return s === 'ok';
        if (filterMode === 'low')     return s === 'low';
        if (filterMode === 'empty')   return s === 'empty';
        return true;
      });
    }

    result.sort((a, b) => {
      switch (sortKey) {
        case 'name':             return a.driver_name.localeCompare(b.driver_name);
        case 'total_desc':       return b.total_items - a.total_items;
        case 'total_asc':        return a.total_items - b.total_items;
        case 'bottles_desc':     return dvBottlesFull(b) - dvBottlesFull(a);
        case 'consumables_desc': return dvConsTotal(b) - dvConsTotal(a);
        default: return 0;
      }
    });

    return result;
  }, [drivers, search, sortKey, filterMode]);

  const grouped = useMemo(() => {
    if (groupMode === 'none') return { '': processed };
    const g: Record<string, DriverVanStock[]> = {
      'In stock':   [],
      'Low stock':  [],
      'Empty vans': [],
    };
    processed.forEach(d => {
      const s = driverStockStatus(d);
      if (s === 'ok')    g['In stock'].push(d);
      else if (s === 'low') g['Low stock'].push(d);
      else g['Empty vans'].push(d);
    });
    return Object.fromEntries(Object.entries(g).filter(([, v]) => v.length > 0));
  }, [processed, groupMode]);

  const DVGroupLabel: React.FC<{ label: string; count: number }> = ({ label, count }) => {
    const icon =
      label === 'In stock'   ? <TrendingUp   className="h-3.5 w-3.5 text-emerald-600" /> :
      label === 'Low stock'  ? <TrendingDown className="h-3.5 w-3.5 text-amber-600"  /> :
                               <Minus        className="h-3.5 w-3.5 text-destructive" />;
    return (
      <div className="flex items-center gap-2 py-1.5">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className="flex-1 h-px bg-border/50" />
        <Badge variant="secondary" className="text-[10px] py-0 h-4 tabular-nums">{count}</Badge>
      </div>
    );
  };

  const renderDrivers = (list: DriverVanStock[]) => {
    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map(d => <DriverGridCard key={d.driver_id} driver={d} />)}
        </div>
      );
    }
    if (viewMode === 'list') {
      return (
        <div className="space-y-2">
          {list.map(d => <DriverListRow key={d.driver_id} driver={d} />)}
        </div>
      );
    }
    // compact
    return (
      <Card className="border-border/50 divide-y divide-border/30 overflow-hidden">
        <div className="flex items-center gap-2.5 px-3 py-1.5 bg-muted/30">
          <div className="w-8 shrink-0" />
          <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Driver</span>
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"><Droplets className="h-3 w-3" />Bottles</span>
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-3"><Package className="h-3 w-3" />Units</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-3 w-6 text-right">Total</span>
          <div className="w-5 shrink-0" />
        </div>
        {list.map(d => <DriverCompactRow key={d.driver_id} driver={d} />)}
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      {drivers.length > 0 && <DVSummaryStats drivers={drivers} />}

      {/* Toolbar */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        {/* Row 1: search + view + refresh */}
        <div className="flex gap-2 px-3 pt-3 pb-2.5 border-b border-border/40">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by driver or vehicle…"
              value={search}
              onChange={e => onSearch(e.target.value)}
              className="pl-8 h-9 text-sm bg-transparent"
            />
            {search && (
              <button onClick={() => onSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* View toggle: grid / list / compact */}
          <div className="flex items-center rounded-lg border border-border/60 p-0.5 bg-muted/30 shrink-0">
            {([
              { mode: 'grid'    as DVViewMode, icon: <LayoutGrid   className="h-3.5 w-3.5" />, label: 'Grid'    },
              { mode: 'list'    as DVViewMode, icon: <List         className="h-3.5 w-3.5" />, label: 'List'    },
              { mode: 'compact' as DVViewMode, icon: <AlignJustify className="h-3.5 w-3.5" />, label: 'Compact' },
            ]).map(v => (
              <button
                key={v.mode}
                onClick={() => setViewMode(v.mode)}
                title={v.label}
                className={cn(
                  'flex items-center justify-center h-7 w-7 rounded-md transition-colors',
                  viewMode === v.mode ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >{v.icon}</button>
            ))}
          </div>

          <Button variant="ghost" size="icon" onClick={onRefresh} className="h-9 w-9 shrink-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Row 2: sort · group · filter chips · count */}
        <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
          {/* Sort */}
          <Select value={sortKey} onValueChange={v => setSortKey(v as DVSortKey)}>
            <SelectTrigger className="h-8 text-xs w-auto min-w-0 gap-1 border-dashed pl-2 pr-2.5">
              <ArrowUpDown className="h-3 w-3 text-muted-foreground shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name A–Z</SelectItem>
              <SelectItem value="total_desc">Total stock ↓</SelectItem>
              <SelectItem value="total_asc">Total stock ↑</SelectItem>
              <SelectItem value="bottles_desc">Most bottles</SelectItem>
              <SelectItem value="consumables_desc">Most units</SelectItem>
            </SelectContent>
          </Select>

          <div className="h-4 w-px bg-border/60 shrink-0" />

          {/* Group by status toggle */}
          <button
            onClick={() => setGroupMode(g => g === 'none' ? 'status' : 'none')}
            className={cn(
              'flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition-colors',
              groupMode !== 'none'
                ? 'border-primary/40 bg-primary/5 text-primary'
                : 'border-dashed text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            <Layers className="h-3 w-3" />
            {groupMode !== 'none' ? 'Grouped by status' : 'Group by…'}
          </button>

          <div className="h-4 w-px bg-border/60 shrink-0" />

          {/* Filter chips */}
          <div className="flex items-center rounded-lg border border-border/50 bg-muted/20 p-0.5 gap-0.5">
            {([
              { val: 'all',     label: 'All'     },
              { val: 'stocked', label: 'Stocked' },
              { val: 'low',     label: 'Low'     },
              { val: 'empty',   label: 'Empty'   },
            ] as const).map(f => (
              <button
                key={f.val}
                onClick={() => setFilterMode(f.val)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-md transition-colors font-medium',
                  filterMode === f.val
                    ? f.val === 'empty'   ? 'bg-destructive/10 text-destructive shadow-sm'
                    : f.val === 'low'     ? 'bg-amber-500/10 text-amber-700 shadow-sm'
                    : f.val === 'stocked' ? 'bg-emerald-500/10 text-emerald-700 shadow-sm'
                    : 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >{f.label}</button>
            ))}
          </div>

          {/* Count + clear */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground tabular-nums">
              {processed.length} driver{processed.length !== 1 ? 's' : ''}
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
      </div>

      {/* Empty states */}
      {drivers.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No driver van stock found.</p>
            <p className="text-xs text-muted-foreground/70">Stock must be distributed to a driver's van first.</p>
          </CardContent>
        </Card>
      )}

      {drivers.length > 0 && processed.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <SlidersHorizontal className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No drivers match your filters.</p>
            <button onClick={clearAll} className="text-xs text-primary hover:underline">Clear all filters</button>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {processed.length > 0 && (
        <div className="space-y-4">
          {Object.entries(grouped).map(([label, list]) => (
            <div key={label} className="space-y-3">
              {groupMode !== 'none' && label && <DVGroupLabel label={label} count={list.length} />}
              {renderDrivers(list)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION DIALOGS
// ─────────────────────────────────────────────────────────────────────────────

type BottleDialog     = 'receive' | 'refill' | 'distribute' | 'sale' | null;
type ConsumableDialog = 'receive' | 'distribute' | 'sale' | null;

const ProductSelectTrigger: React.FC<{
  selectedId:   string;
  products:     Array<{ id: string; name: string; unit?: string; imageUrl?: string | null }>;
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
      // non-fatal
    } finally {
      setFetchingExp(false);
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

  const driverLoaded = loadedDrivers.has(driverId);

  const systemExpected: number | null =
    !driverId || !productId        ? null :
    fetchingExp || !driverLoaded   ? null :
    (expectedMap[`${driverId}::${productId}`] ?? 0);

  const good     = parseInt(qtyGood)    || 0;
  const damaged  = parseInt(qtyDamaged) || 0;
  const received = good + damaged;

  const hasExpected  = systemExpected !== null && systemExpected > 0;
  const diff         = hasExpected ? received - systemExpected : 0;
  const progressPct  = hasExpected ? Math.min(100, (received / systemExpected) * 100) : 0;

  const compareState: CompareState =
    !qtyGood && !qtyDamaged     ? 'empty' :
    !hasExpected                ? 'exact' :
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">

        <div className="bg-gradient-to-br from-blue-500/10 to-transparent -mx-6 -mt-6 px-6 pt-6 pb-5 mb-5 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20">
              <ArrowDownToLine className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Receive Empties</DialogTitle>
              <DialogDescription className="text-xs mt-0">Driver returning empty bottles to store</DialogDescription>
            </div>
          </div>
        </div>

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
              <p className={cn('text-sm font-bold', result.cleared ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300')}>
                {result.cleared
                  ? "✓ Driver's balance cleared — no more empties expected."
                  : `${result.outstanding_after} empties still outstanding from this driver.`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Expected {result.expected_before} · received {received}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <Field label="Product" required>
            <Select value={productId} onValueChange={handleProductChange}>
              <SelectTrigger className="h-11">
                <ProductSelectTrigger selectedId={productId} products={productOptions} placeholder="Select bottle product…" />
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

          <Field label="Driver" hint="Select driver to auto-load expected count">
            <Select value={driverId} onValueChange={handleDriverChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select driver…" />
                {fetchingExp && <Loader2 className="h-3 w-3 animate-spin ml-auto text-muted-foreground shrink-0" />}
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

          {driverId && productId && !result && (() => {
            if (fetchingExp || !driverLoaded) return (
              <div className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-muted/30 border border-border/50">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">Loading expected count from system…</p>
              </div>
            );
            if (systemExpected === 0) return (
              <div className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-muted/30 border border-border/50">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">No outstanding empties</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    System has no pending empties for this driver. You can still record a free-form receive below.
                  </p>
                </div>
              </div>
            );
            return (
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">System expects from this driver</p>
                  <span className="text-2xl font-black tabular-nums text-blue-700 dark:text-blue-300">{systemExpected}</span>
                </div>
                {received > 0 && (
                  <>
                    <div className="h-3 rounded-full bg-blue-200/60 dark:bg-blue-900/40 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-300',
                          compareState === 'exact' ? 'bg-emerald-500' :
                          compareState === 'short' ? 'bg-amber-500'   :
                          compareState === 'over'  ? 'bg-blue-500'    : 'bg-blue-400',
                        )}
                        style={{ width: `${Math.min(100, progressPct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-blue-600/70 dark:text-blue-400">{received} of {systemExpected} received</span>
                      <span className={cn('font-bold',
                        compareState === 'exact' ? 'text-emerald-600' :
                        compareState === 'short' ? 'text-amber-600'   :
                        compareState === 'over'  ? 'text-blue-600'    : '',
                      )}>
                        {compareState === 'exact' ? '✓ Exact match' :
                         compareState === 'short' ? `${Math.abs(diff)} short` :
                         compareState === 'over'  ? `${diff} over` : ''}
                      </span>
                    </div>
                  </>
                )}
                {received === 0 && (
                  <p className="text-[11px] text-blue-600/70 dark:text-blue-400">
                    Enter quantities below — the system will track short or over.
                  </p>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Good condition" required>
              <Input
                type="number" min={0} placeholder="0" value={qtyGood}
                onChange={e => { setQtyGood(e.target.value); setShortReason(''); setOverReason(''); }}
                className={cn(
                  received > 0 && hasExpected && 'border-2',
                  compareState === 'exact' && received > 0 ? 'border-emerald-400 focus-visible:ring-emerald-400/30' :
                  compareState === 'short' && received > 0 ? 'border-amber-400 focus-visible:ring-amber-400/30'     :
                  compareState === 'over'  && received > 0 ? 'border-blue-400 focus-visible:ring-blue-400/30'       : '',
                )}
              />
            </Field>
            <Field label="Damaged">
              <Input
                type="number" min={0} placeholder="0" value={qtyDamaged}
                onChange={e => { setQtyDamaged(e.target.value); setShortReason(''); setOverReason(''); }}
              />
            </Field>
          </div>

          {received > 0 && (
            <div className={cn(
              'rounded-xl px-4 py-3 border-2 space-y-2 transition-all',
              compareState === 'exact' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' :
              compareState === 'short' ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'         :
              compareState === 'over'  ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'             :
              'bg-muted/40 border-border/50',
            )}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-medium">Total receiving</span>
                <span className="text-xl font-black tabular-nums">{received}</span>
              </div>
              {good > 0 && damaged > 0 && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />{good} good</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-400 shrink-0" />{damaged} damaged</span>
                </div>
              )}
              {hasExpected && (
                <div className={cn(
                  'flex items-center gap-2 pt-2 border-t text-xs font-bold',
                  compareState === 'exact' ? 'border-emerald-200 text-emerald-700 dark:text-emerald-300' :
                  compareState === 'short' ? 'border-amber-200 text-amber-700 dark:text-amber-300'       :
                  'border-blue-200 text-blue-700 dark:text-blue-300',
                )}>
                  {compareState === 'exact' && <><CheckCircle2 className="h-3.5 w-3.5 shrink-0" />Exact count — driver's balance will be cleared ✓</>}
                  {compareState === 'short' && <><TrendingDown className="h-3.5 w-3.5 shrink-0" />Short by {Math.abs(diff)} — select a reason below to continue</>}
                  {compareState === 'over'  && <><TrendingUp   className="h-3.5 w-3.5 shrink-0" />Over by {diff} — select a reason below to continue</>}
                </div>
              )}
            </div>
          )}

          {compareState === 'short' && hasExpected && (
            <Field label="Why is the count short?" required>
              <ReasonPicker reasons={SHORT_REASONS} value={shortReason} onChange={setShortReason} accent="amber" />
            </Field>
          )}
          {compareState === 'over' && hasExpected && (
            <Field label="Why are there extra bottles?" required>
              <ReasonPicker reasons={OVER_REASONS} value={overReason} onChange={setOverReason} accent="blue" />
            </Field>
          )}

          <Field label="Notes" hint="Optional">
            <Textarea rows={2} className="resize-none" placeholder="Any additional notes…" value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="ocean" className="flex-1" onClick={handleSubmit} disabled={!canSubmit || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownToLine className="h-4 w-4 mr-2" />}
            Record Receive
          </Button>
        </div>

        {reasonRequired && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            {compareState === 'short' ? 'Select a reason for the shortage to continue.' : 'Select a reason for the extra bottles to continue.'}
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
    id:           p.product_id,
    name:         p.product_name,
    unit:         (p as unknown as Record<string, string>).product_unit ?? 'BOTTLES',
    imageUrl:     (p as unknown as Record<string, string | null>).product_image ?? null,
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
    id:           p.product_id,
    name:         p.product_name,
    unit:         (p as unknown as Record<string, string>).product_unit ?? 'BOTTLES',
    imageUrl:     (p as unknown as Record<string, string | null>).product_image ?? null,
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

interface CustomerResult {
  id:    string;
  name:  string;
  phone: string;
  email: string;
}
 
type SaleStep = 'customer' | 'sale';

// ── Customer picker step ──────────────────────────────────────────────────────
const CustomerPickerStep: React.FC<{
  onSelect: (c: CustomerResult) => void;
  onWalkIn: () => void;
}> = ({ onSelect, onWalkIn }) => {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<CustomerResult[]>([]);
  const [filtered, setFiltered] = useState<CustomerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [fetchAttempted, setFetchAttempted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchCustomers = async () => {
      if (fetchAttempted) return;
      setFetchAttempted(true);
      
      try {
        const result = await customerAdminService.getCustomers({ limit: 100 });
        
        const raw: CustomerResult[] = (result.data ?? []).map(c => ({
          id:    c.id,
          name:  c.full_name,
          phone: c.phone_number,
          email: c.email ?? '',
        }));
        
        setCustomers(raw);
        setFiltered(raw);
        
        if (raw.length === 0) {
          setError('No customers found.');
        }
      } catch (err) {
        setError('Could not load customers. Walk-in sales are still supported.');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();

    return () => {
      isMounted = false;
    };
  }, [toast, fetchAttempted]);

  useEffect(() => {
    if (!query.trim()) { 
      setFiltered(customers); 
      return; 
    }
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

      {/* Search input - only show if we have customers or not loading */}
      {(customers.length > 0 || (!loading && error)) && (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter by name or phone…"
            disabled={customers.length === 0}
            className="w-full h-11 pl-10 pr-10 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:border-amber-400/50 disabled:opacity-50"
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
      )}

      {/* Walk-in button - always available */}
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

      {/* Show error message if any */}
      {error && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-center">
          <p className="text-xs text-amber-700 dark:text-amber-400">{error}</p>
          {error.includes('Permission denied') && (
            <Button 
              variant="link" 
              size="sm" 
              className="text-xs mt-1 h-auto p-0"
              onClick={() => window.location.href = '/customers'}
            >
              Go to Customers page
            </Button>
          )}
        </div>
      )}

      {/* Only show customer section if we have customers */}
      {customers.length > 0 && (
        <>
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
              <Search className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm font-semibold text-muted-foreground">
                {query ? 'No customers match your filter' : 'No customers found'}
              </p>
              {query && (
                <button onClick={() => setQuery('')} className="text-xs text-primary underline underline-offset-2">
                  Clear filter
                </button>
              )}
              {!query && (
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-xs mt-1"
                  onClick={() => window.location.href = '/customers'}
                >
                  Add customers
                </Button>
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
        </>
      )}
    </div>
  );
};
// ── Sale qty stepper — amber, min=1 ──────────────────────────────────────────
 
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
 
// ── Collect empties stepper — blue, min=0 ────────────────────────────────────
 
const QtyStepperWithZero: React.FC<{
  value: number; max: number; onChange: (n: number) => void;
}> = ({ value, max, onChange }) => (
  <div className="flex items-center justify-center gap-6">
    <button
      onClick={() => onChange(Math.max(0, value - 1))}
      disabled={value <= 0}
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
 
// ── Product card ──────────────────────────────────────────────────────────────
 
interface SaleProductOption {
  id:           string;
  name:         string;
  maxQty:       number;
  selling_price?: string;
  unit?:         string;
  imageUrl?:     string | null;
}
 
const SaleProductCard: React.FC<{
  product:  SaleProductOption;
  selected: boolean;
  onSelect: () => void;
}> = ({ product, selected, onSelect }) => (
  <button
    onClick={onSelect}
    disabled={product.maxQty <= 0}
    className={cn(
      'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
      selected
        ? 'border-amber-400 bg-amber-500/5 ring-1 ring-amber-400/20'
        : product.maxQty <= 0
          ? 'border-border/40 bg-muted/20 opacity-50 cursor-not-allowed'
          : 'border-border/60 bg-card hover:border-border active:scale-[0.98]',
    )}
  >
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
        <p className={cn(
          'text-xs font-medium',
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
 
// ── Main DirectSaleDialog ─────────────────────────────────────────────────────
// ── Payment method options for DirectSaleDialog ───────────────────────────
const DIRECT_SALE_PAYMENT_METHODS = [
  { value: 'CASH',          label: 'Cash',               icon: '💵', desc: 'Collect cash on the spot'    },
  { value: 'MPESA',         label: 'M-Pesa',             icon: '📱', desc: 'Mobile money transfer'        },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer',      icon: '🏦', desc: 'Direct bank payment'          },
  { value: 'CREDIT',        label: 'Pay Later (Credit)', icon: '🧾', desc: 'Added to customer invoice'    },
] as const;
type DirectSalePM = typeof DIRECT_SALE_PAYMENT_METHODS[number]['value'];

const DirectSaleDialog: React.FC<{
  open:     boolean;
  mode:     'bottle' | 'consumable';
  products: SaleProductOption[];
  onClose:  () => void;
  onSaved:  (id: string) => void;
}> = ({ open, mode, products, onClose, onSaved }) => {
  const { toast } = useToast();
  const { user }  = useAuth();
 
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

  // ── NEW: payment detection state ──────────────────────────────────────────
  const [customerProfile,  setCustomerProfile]  = useState<AdminCustomer | null>(null);
  const [profileLoading,   setProfileLoading]   = useState(false);
  const [paymentMethod,    setPaymentMethod]    = useState<DirectSalePM | ''>('');
 
  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('customer');
      setSelectedCustomer(null);
      setIsWalkIn(false);
      setCustomerName('');
      setProductId('');
      setQty(1);
      setQtyCollected(0);
      setNotes('');
      // NEW
      setCustomerProfile(null);
      setProfileLoading(false);
      setPaymentMethod('');
    }
  }, [open]);
 
  const handleSelectCustomer = async (c: CustomerResult) => {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setIsWalkIn(false);
    setStep('sale');

    // Fetch full profile to detect credit status
    setProfileLoading(true);
    try {
      const profile = await customerAdminService.getCustomer(c.id);
      setCustomerProfile(profile);

      const ct = profile.credit_terms;
      const frozen = ct?.account_frozen ?? false;
      const hasActiveCredit = !!ct && !frozen;

      if (hasActiveCredit) {
        setPaymentMethod('CREDIT');
      } else if (frozen) {
        setPaymentMethod('CASH');
      } else {
        setPaymentMethod('CASH');
      }
    } catch {
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
    setProductId('');
    setQty(1);
    setQtyCollected(0);
  };
 
  const selected = products.find(p => p.id === productId);
  const isReturnable = mode === 'bottle';
  const unitPrice = selected?.selling_price ? parseFloat(selected.selling_price) : 0;
 
  const canSubmit =
    !!productId &&
    qty >= 1 &&
    !!paymentMethod &&
    !(isWalkIn && !customerName.trim());
 
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const finalNotes = [
        selectedCustomer
          ? `Customer: ${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}`
          : customerName.trim()
            ? `Walk-in: ${customerName.trim()}`
            : 'Walk-in sale',
        paymentMethod ? `Payment: ${paymentMethod}` : '',
        notes.trim(),
      ].filter(Boolean).join(' · ');
 
      if (mode === 'bottle') {
        await bottleStoreService.directSale({
          product:       productId,
          quantity:      qty,
          customer_id:   selectedCustomer?.id,
          customer_name: selectedCustomer?.name ?? customerName.trim(),
          qty_collected: qtyCollected,
          notes:         finalNotes,
        });
      } else {
        await consumableStoreService.directSale({
          product:       productId,
          quantity:      qty,
          customer_id:   selectedCustomer?.id,
          customer_name: selectedCustomer?.name ?? customerName.trim(),
          notes:         finalNotes,
        });
      }
 
      toast({ title: `Sale recorded — ${qty} × ${selected?.name}` } as Parameters<typeof toast>[0]);
 
      const servedBy = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Store Admin';
      const receipt: DriverSaleData = {
        productName:   selected?.name ?? 'Product',
        productUnit:   selected?.unit ?? (mode === 'bottle' ? 'BOTTLES' : 'UNITS'),
        isReturnable,
        quantity:      qty,
        unitPrice,
        customerName:  (selectedCustomer?.name ?? customerName.trim()) || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone ?? undefined,
        isWalkIn:      !selectedCustomer,
        paymentMethod: 'CASH',
        servedBy,
        date:          new Date().toISOString(),
      };
 
      setReceiptData(receipt);
      setShowReceipt(true);
      onClose();
      onSaved(productId);
    } catch (err: unknown) {
      toast({
        title:       'Error',
        description: (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to record sale.',
        variant:     'destructive',
      } as Parameters<typeof toast>[0]);
    } finally {
      setLoading(false);
    }
  };
 
  const dialogTitle = step === 'customer'
    ? 'Direct Sale — Select Customer'
    : selectedCustomer
      ? `Sale for ${selectedCustomer.name}`
      : 'Walk-in Sale';
 
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
                <button
                  onClick={handleBack}
                  className="text-xs font-semibold text-amber-600 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                >
                  ← Back
                </button>
              )}
            </div>
          </div>
 
          {/* Step 1 — customer picker */}
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

              {/* ── Payment method selector ── */}
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
                {customerProfile?.credit_terms?.account_frozen && (
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
                {customerProfile?.credit_terms?.is_in_grace_period && !customerProfile?.credit_terms?.account_frozen && (
                  <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Invoice overdue — grace period active</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {customerProfile.credit_terms.grace_days_remaining ?? 0} grace day(s) remaining.
                        Credit is still available but payment is overdue.
                      </p>
                    </div>
                  </div>
                )}

                {/* Credit summary chip — shown when credit is auto-selected and active */}
                {paymentMethod === 'CREDIT' && customerProfile?.credit_terms && !customerProfile.credit_terms.account_frozen && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-purple-500/8 border border-purple-300/40 dark:border-purple-700/40">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🧾</span>
                      <div>
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-300">Credit account</p>
                        <p className="text-xs text-muted-foreground">
                          {customerProfile.credit_terms.billing_cycle_display} billing
                        </p>
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

                {/* Payment method buttons */}
                <div className="space-y-2">
                  {DIRECT_SALE_PAYMENT_METHODS
                    .filter(pm => {
                      // Walk-in: cash and mpesa only
                      if (isWalkIn) return pm.value === 'CASH' || pm.value === 'MPESA';
                      // Frozen credit customers cannot use credit
                      if (customerProfile?.credit_terms?.account_frozen && pm.value === 'CREDIT') return false;
                      // Non-credit customers cannot use credit
                      if (!customerProfile?.credit_terms && pm.value === 'CREDIT') return false;
                      return true;
                    })
                    .map(pm => (
                      <button
                        key={pm.value}
                        type="button"
                        disabled={
                          pm.value === 'CREDIT' &&
                          !!(customerProfile?.credit_terms?.account_frozen)
                        }
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
                              ? pm.value === 'CREDIT' ? 'text-purple-700 dark:text-purple-300'
                              : pm.value === 'MPESA'  ? 'text-green-700 dark:text-green-300'
                              : pm.value === 'BANK_TRANSFER' ? 'text-blue-700 dark:text-blue-300'
                              : 'text-emerald-700 dark:text-emerald-300'
                              : 'text-foreground',
                          )}>
                            {pm.label}
                            {paymentMethod === pm.value && ' ✓'}
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
 
              {/* Product list */}
              <Field label="Product" required>
                {products.length === 0 ? (
                  <div className="text-center py-6 rounded-xl border border-dashed border-border">
                    <p className="text-sm text-muted-foreground">No {mode === 'bottle' ? 'bottles' : 'consumables'} in store.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                    {products.map(p => (
                      <SaleProductCard
                        key={p.id}
                        product={p}
                        selected={productId === p.id}
                        onSelect={() => { setProductId(p.id); setQty(1); setQtyCollected(0); }}
                      />
                    ))}
                  </div>
                )}
              </Field>
 
              {/* Qty stepper — amber */}
              {selected && selected.maxQty > 0 && (
                <Field label="Quantity">
                  <div className="py-2">
                    <QtyStepper
                      value={qty}
                      max={selected.maxQty}
                      onChange={v => { setQty(v); setQtyCollected(c => Math.min(c, v)); }}
                    />
                  </div>
                  {unitPrice > 0 && (
                    <p className="text-center text-sm font-bold text-emerald-600 mt-2">
                      Total: KES {(qty * unitPrice).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </Field>
              )}
 
              {/* Collect empties — blue stepper, only for bottles */}
              {isReturnable && selected && selected.maxQty > 0 && qty > 0 && (
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
 
              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  variant="ocean"
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={!canSubmit || loading}
                >
                  {loading
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : <ShoppingBag className="h-4 w-4 mr-2" />
                  }
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
    id:           p.product_id,
    name:         p.product_name,
    unit:         p.unit,
    imageUrl:     (p as unknown as Record<string, string | null>).product_image ?? null,
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
    id:           p.product_id,
    name:         p.product_name,
    unit:         p.unit,
    imageUrl:     (p as unknown as Record<string, string | null>).product_image ?? null,
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
  const [driverVanStock,     setDriverVanStock]     = useState<DriverVanStock[]>([]);
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

  // Driver Stock tab state
  const [dvSearch, setDvSearch] = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [bottles, consumables, driverList, vanStock] = await Promise.all([
        bottleStoreService.getAll(),
        consumableStoreService.getAll(),
        fetchDrivers(),
        driverVanStockService.getAll(),
      ]);
      setBottleProducts(bottles);
      setConsumableProducts(consumables);
      setDrivers(driverList);
      setDriverVanStock(vanStock);
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
    if (bSearch)               result = result.filter(p => p.product_name.toLowerCase().includes(bSearch.toLowerCase()));
    if (bFilter === 'out')     result = result.filter(p => p.balance.full <= 0);
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
    if (cSearch)               result = result.filter(p => p.product_name.toLowerCase().includes(cSearch.toLowerCase()));
    if (cFilter === 'out')     result = result.filter(p => p.balance.in_stock <= 0);
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
              <TabsTrigger value="driver-stock" className="gap-2">
                <Users className="h-4 w-4" />Driver Stock
                {driverVanStock.length > 0 && <Badge variant="secondary" className="ml-1 text-xs py-0 h-4">{driverVanStock.length}</Badge>}
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

          {/* ══ DRIVER STOCK TAB — ENHANCED ══ */}
          <TabsContent value="driver-stock" className="space-y-4 mt-0">
            <DriverVanStockTab
              drivers={driverVanStock}
              search={dvSearch}
              onSearch={setDvSearch}
              onRefresh={load}
            />
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
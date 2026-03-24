/**
 * src/pages/client/DirectSalesPage.tsx
 * Route: /client/direct-sales
 *
 * Single "Sold By" dropdown with three groups:
 *   • My Sales       — current logged-in user's store sales
 *   • Drivers        — each driver as an individual option
 *   • Site Managers  — each site_manager as an individual option
 *
 * All filtering is client-side (no driver_id sent to API).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input }  from '@/components/ui/input';
import { Badge }  from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectGroup, SelectLabel,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ShoppingBag, Droplets, Package, Loader2,
  Search, RefreshCw, InboxIcon, User,
  Phone, X, TrendingUp, Users, Calendar,
  UserCog, Truck, Building2, Star,
} from 'lucide-react';
import { driverStoreService }                          from '@/api/services/driver-store.service';
import { bottleStoreService, consumableStoreService }  from '@/api/services/store.service';
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

interface EmployeeOption {
  id:   string;   // UUID
  name: string;
}

interface StoreHistoryItem {
  id:                string;
  movement_type:     string;
  movement_date:     string;
  driver_name?:      string | null;
  customer_name?:    string;
  recorded_by_name?: string | null;
  notes?:            string;
  qty_total?:        number;
  quantity?:         number;
}

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
  const d = parseLocal(iso);
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
  if (custMatch) return { name: custMatch[1].trim(), phone: custMatch[2]?.trim() ?? '', isAccount: true };
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
      if (h.movement_type !== 'DIRECT_SALE' || !h.movement_date) continue;
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

function soldBy(sale: DirectSale): string {
  if (sale.source === 'driver') return sale.driver_name ?? 'Driver';
  return sale.recorded_by_name ?? 'Admin';
}

// ─────────────────────────────────────────────────────────────────────────────
// Source badge
// ─────────────────────────────────────────────────────────────────────────────

const SourceBadge: React.FC<{ source: DirectSale['source'] }> = ({ source }) =>
  source === 'driver' ? (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700 rounded-full px-1.5 py-0.5 shrink-0">
      <Truck className="h-2.5 w-2.5" />Driver
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-700 rounded-full px-1.5 py-0.5 shrink-0">
      <UserCog className="h-2.5 w-2.5" />Admin
    </span>
  );

// ─────────────────────────────────────────────────────────────────────────────
// Desktop table row
// ─────────────────────────────────────────────────────────────────────────────

const SaleRow: React.FC<{ sale: DirectSale; isEven: boolean }> = ({ sale, isEven }) => {
  const { name: custName, phone, isAccount } = parseCustomer(sale.notes);
  const seller = soldBy(sale);
  return (
    <tr className={cn('border-b last:border-0 transition-colors hover:bg-muted/30', isEven ? 'bg-background' : 'bg-muted/10')}>
      <td className="px-4 py-3.5">
        <p className="text-sm font-semibold">{sale.movement_date ? format(parseLocal(sale.movement_date), 'dd MMM yyyy') : '—'}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sale.movement_date ? format(parseLocal(sale.movement_date), 'HH:mm') : '—'}</p>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0 font-bold text-xs', sale.source === 'driver' ? 'bg-violet-500/10 text-violet-600' : 'bg-teal-500/10 text-teal-600')}>
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
          <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', sale.product_type === 'bottle' ? 'bg-blue-500/10 text-blue-600' : 'bg-sky-500/10 text-sky-600')}>
            {sale.product_type === 'bottle' ? <Droplets className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
          </div>
          <span className="text-sm">{sale.product_name}</span>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="font-bold text-amber-600 tabular-nums text-base">×{sale.quantity}</span>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className={cn('h-6 w-6 rounded-full flex items-center justify-center shrink-0', isAccount ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
            <User className="h-3 w-3" />
          </div>
          <div className="min-w-0">
            <p className={cn('text-sm font-medium truncate', isAccount ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
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
            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', sale.product_type === 'bottle' ? 'bg-blue-500/10 text-blue-600' : 'bg-sky-500/10 text-sky-600')}>
              {sale.product_type === 'bottle' ? <Droplets className="h-5 w-5" /> : <Package className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{sale.product_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sale.movement_date ? format(parseLocal(sale.movement_date), 'dd MMM · HH:mm') : '—'}</p>
            </div>
          </div>
          <span className="text-2xl font-black tabular-nums text-amber-600 shrink-0">×{sale.quantity}</span>
        </div>

        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border', sale.source === 'driver' ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900' : 'bg-teal-50 dark:bg-teal-950/30 border-teal-100 dark:border-teal-900')}>
          <div className={cn('h-6 w-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[10px]', sale.source === 'driver' ? 'bg-violet-500/20 text-violet-600' : 'bg-teal-500/20 text-teal-600')}>
            {seller.trim()[0]?.toUpperCase() ?? '?'}
          </div>
          <p className={cn('text-xs font-semibold truncate flex-1', sale.source === 'driver' ? 'text-violet-800 dark:text-violet-300' : 'text-teal-800 dark:text-teal-300')}>{seller}</p>
          <SourceBadge source={sale.source} />
        </div>

        <div className={cn('flex items-center gap-2.5 px-3 py-2.5 rounded-xl border', isAccount ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-muted/40 border-border/40')}>
          <User className={cn('h-3.5 w-3.5 shrink-0', isAccount ? 'text-emerald-600' : 'text-muted-foreground')} />
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs font-semibold truncate', isAccount ? 'text-emerald-800 dark:text-emerald-300' : 'text-muted-foreground')}>{sale.customer_name || custName}</p>
            {phone && <p className="text-[10px] text-emerald-700/70 flex items-center gap-1 mt-0.5"><Phone className="h-2.5 w-2.5" />{phone}</p>}
          </div>
          {isAccount && <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 rounded-full px-1.5 py-0.5 shrink-0">Account</span>}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sellerFilter values:
 *   'all'                → no filter
 *   'my'                 → current user's admin sales
 *   'driver::<UUID>'     → one specific driver (matched on driver_id or driver_name)
 *   'manager::<name>'    → one specific site manager (matched on recorded_by_name)
 */
type SellerFilter = 'all' | 'my' | `driver::${string}` | `manager::${string}`;

import { ManagerLayout } from '@/components/layout/ManagerLayout';

interface DirectSalesPageProps {
  layout?: 'dashboard' | 'manager';
}

const DirectSalesPage: React.FC<DirectSalesPageProps> = ({ layout = 'dashboard' }) => {
  const { user } = useAuth();

  const [allSales,     setAllSales]     = useState<DirectSale[]>([]);
  const [drivers,      setDrivers]      = useState<EmployeeOption[]>([]);
  const [siteManagers, setSiteManagers] = useState<EmployeeOption[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [sellerFilter, setSellerFilter] = useState<SellerFilter>('all');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');

  // Current user's full name — used for "My Sales" matching
  const myName = useMemo(() =>
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || '',
  [user]);

  // ── Fetch driver + site_manager lists ─────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      try {
        const safeGet = async (params: Record<string, unknown>) => {
          try {
            const r = await axiosInstance.get('/auth/employees/', { params });
            return (r.data?.data ?? r.data?.results ?? r.data ?? []) as Record<string, unknown>[];
          } catch { return []; }
        };
        const fullName = (d: Record<string, unknown>) =>
          `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || String(d.email ?? d.id);

        const [dList, smList] = await Promise.all([
          safeGet({ role: 'driver',       limit: 100 }),
          safeGet({ role: 'site_manager', limit: 100 }),
        ]);
        setDrivers(dList.map(d => ({ id: String(d.id), name: fullName(d) })));
        setSiteManagers(smList.map(d => ({ id: fullName(d), name: fullName(d) })));
      } catch { /* non-fatal */ }
    };
    fetch();
  }, []);

  // ── Load all sales (no server-side seller filter) ─────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [driverSales, bottleProducts, consumableProducts] = await Promise.all([
        driverStoreService.getDirectSalesAdmin({
          date_from: dateFrom || undefined,
          date_to:   dateTo   || undefined,
        }),
        bottleStoreService.getAll(),
        consumableStoreService.getAll(),
      ]);

      const normDriver: DirectSale[] = (driverSales as Array<{
        id: string; movement_date: string; product_name: string;
        product_type: 'bottle' | 'consumable'; quantity: number;
        driver_name: string; driver_id: string; notes: string;
        recorded_by_name?: string | null;
      }>).map(s => ({ ...s, source: 'driver' as const }));

      const rawAdmin: DirectSale[] = [
        ...extractAdminSales(bottleProducts.map(p => ({ product_name: p.product_name, history: p.history as StoreHistoryItem[] })), 'bottle'),
        ...extractAdminSales(consumableProducts.map(p => ({ product_name: p.product_name, history: p.history as StoreHistoryItem[] })), 'consumable'),
      ];

      const adminSales = rawAdmin.filter(s => passesDateFilter(s.movement_date, dateFrom, dateTo));
      setAllSales(sortNewestFirst([...normDriver, ...adminSales]));
    } catch {
      toast.error('Failed to load direct sales');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // ── Apply seller filter + search ──────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allSales;

    if (sellerFilter === 'my') {
      list = list.filter(s =>
        s.source === 'admin' &&
        (s.recorded_by_name ?? '').toLowerCase() === myName.toLowerCase(),
      );
    } else if (sellerFilter.startsWith('driver::')) {
      const driverId = sellerFilter.slice('driver::'.length);
      const driverName = drivers.find(d => d.id === driverId)?.name ?? '';
      list = list.filter(s =>
        s.source === 'driver' &&
        (s.driver_id === driverId || s.driver_name === driverName),
      );
    } else if (sellerFilter.startsWith('manager::')) {
      const managerName = sellerFilter.slice('manager::'.length);
      list = list.filter(s =>
        s.source === 'admin' &&
        (s.recorded_by_name ?? '').toLowerCase() === managerName.toLowerCase(),
      );
    }

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
  }, [allSales, sellerFilter, search, myName, drivers]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalUnits      = filtered.reduce((s, r) => s + r.quantity, 0);
  const todayCount      = filtered.filter(s => dateLabel(s.movement_date) === 'Today').length;
  const accountCount    = filtered.filter(s => /^Customer:/i.test(s.notes)).length;
  const driverSaleCount = allSales.filter(s => s.source === 'driver').length;
  const adminSaleCount  = allSales.filter(s => s.source === 'admin').length;

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const hasFilters = !!(search || sellerFilter !== 'all' || dateFrom || dateTo);

  const clearFilters = () => {
    setSearch(''); setSellerFilter('all'); setDateFrom(''); setDateTo('');
  };

  // ── Trigger label for the select ─────────────────────────────────────────
  const triggerLabel = useMemo(() => {
    if (sellerFilter === 'all') return null;
    if (sellerFilter === 'my')  return { icon: <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />, text: 'My Sales' };
    if (sellerFilter.startsWith('driver::')) {
      const id   = sellerFilter.slice('driver::'.length);
      const name = drivers.find(d => d.id === id)?.name ?? id;
      return { icon: <Truck className="h-3.5 w-3.5 text-violet-600 shrink-0" />, text: name };
    }
    if (sellerFilter.startsWith('manager::')) {
      const name = sellerFilter.slice('manager::'.length);
      return { icon: <Building2 className="h-3.5 w-3.5 text-teal-600 shrink-0" />, text: name };
    }
    return null;
  }, [sellerFilter, drivers]);

  // ─────────────────────────────────────────────────────────────────────────

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    layout === 'manager'
      ? <ManagerLayout title="Direct Sales" subtitle="Driver roadside sales + admin walk-in sales">{children}</ManagerLayout>
      : <DashboardLayout title="Direct Sales" subtitle="Driver roadside sales + admin walk-in sales">{children}</DashboardLayout>;

  return (
    <Wrapper>

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

      {/* ── Breakdown bar ── */}
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
                <strong className="text-foreground">{allSales.reduce((s, r) => s + r.quantity, 0)}</strong> units total
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5 flex-wrap">

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search product, seller, customer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-muted/40 border-transparent text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── Seller dropdown ── */}
        <Select
          value={sellerFilter}
          onValueChange={v => setSellerFilter(v as SellerFilter)}
        >
          <SelectTrigger className="h-10 w-full sm:w-56 rounded-xl bg-muted/40 border-transparent text-sm shrink-0">
            {triggerLabel ? (
              <div className="flex items-center gap-2 min-w-0">
                {triggerLabel.icon}
                <span className="truncate">{triggerLabel.text}</span>
              </div>
            ) : (
              <SelectValue placeholder="All sellers" />
            )}
          </SelectTrigger>

          <SelectContent className="max-h-80">

            {/* Reset */}
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                All sellers
              </div>
            </SelectItem>

            {/* My Sales */}
            <SelectItem value="my">
              <div className="flex items-center gap-2">
                <Star className="h-3.5 w-3.5 text-amber-500" />
                My Sales
              </div>
            </SelectItem>

            {/* Drivers */}
            {drivers.length > 0 && (
              <SelectGroup>
                <SelectLabel className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-600 px-2 py-1.5">
                  <Truck className="h-3 w-3" /> Drivers
                </SelectLabel>
                {drivers.map(d => (
                  <SelectItem key={d.id} value={`driver::${d.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-violet-500/10 text-violet-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                        {d.name[0]?.toUpperCase()}
                      </div>
                      {d.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {/* Site Managers */}
            {siteManagers.length > 0 && (
              <SelectGroup>
                <SelectLabel className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-600 px-2 py-1.5">
                  <Building2 className="h-3 w-3" /> Site Managers
                </SelectLabel>
                {siteManagers.map(m => (
                  <SelectItem key={m.id} value={`manager::${m.name}`}>
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-teal-500/10 text-teal-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                        {m.name[0]?.toUpperCase()}
                      </div>
                      {m.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

          </SelectContent>
        </Select>

        {/* Date from */}
        <div className="relative shrink-0">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="pl-9 h-10 w-full sm:w-36 rounded-xl bg-muted/40 border-transparent text-sm" />
        </div>

        {/* Date to */}
        <div className="relative shrink-0">
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
            {hasFilters ? 'Try adjusting your filters.' : 'Sales will appear here once drivers or admins start recording them.'}
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
                {' · '}
                <span className="text-violet-600">{filtered.filter(s => s.source === 'driver').length} driver</span>
                {' · '}
                <span className="text-teal-600">{filtered.filter(s => s.source === 'admin').length} admin</span>
              </p>
              <p className="text-xs font-semibold text-amber-600">{totalUnits} unit{totalUnits !== 1 ? 's' : ''} total</p>
            </div>
          </div>

          {/* Mobile cards */}
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
     </Wrapper>
  );
};

export default DirectSalesPage;
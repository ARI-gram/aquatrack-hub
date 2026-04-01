/**
 * src/pages/driver/DriverSalesPage.tsx
 * Mobile-first direct sales history
 *
 * Changes in this revision:
 *  - Each sale card now has a "Receipt" button
 *  - Tapping it builds DriverSaleData from the stock movement and opens
 *    DriverSaleReceiptModal — same modal used right after a sale is recorded
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DriverLayout } from '@/components/layout/DriverLayout';
import {
  ShoppingCart, Loader2, Search, X, Calendar,
  InboxIcon, Package, Droplets, User, Phone,
  TrendingUp, ArrowUpDown, Receipt,
} from 'lucide-react';
import { driverStoreService, type DriverStockHistory } from '@/api/services/driver-store.service';
import { DriverSaleReceiptModal, type DriverSaleData } from './DriverSaleReceiptModal';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function dateLabel(s: string) {
  const d = new Date(s);
  if (isToday(d))     return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE, d MMM yyyy');
}

function parseCustomer(notes?: string): { name: string; phone: string } {
  if (!notes) return { name: 'Walk-in', phone: '' };
  const custMatch = notes.match(/Customer:\s*([^(·\n]+?)(?:\s*\(([^)]+)\))?(?:\s*·|$)/i);
  if (custMatch) return { name: custMatch[1].trim(), phone: custMatch[2]?.trim() ?? '' };
  const walkMatch = notes.match(/Walk-in:\s*([^·\n]+)/i);
  if (walkMatch) return { name: walkMatch[1].trim(), phone: '' };
  return { name: 'Walk-in', phone: '' };
}

function groupByDate(items: DriverStockHistory[]) {
  const g: Record<string, DriverStockHistory[]> = {};
  for (const item of items) {
    const k = dateLabel(item.movement_date);
    if (!g[k]) g[k] = [];
    g[k].push(item);
  }
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sale card
// ─────────────────────────────────────────────────────────────────────────────

const SaleCard: React.FC<{
  sale:      DriverStockHistory;
  servedBy:  string;
  onReceipt: (sale: DriverStockHistory) => void;
}> = ({ sale, servedBy, onReceipt }) => {
  const { name: customerName, phone } = parseCustomer(sale.notes);
  const isWalkIn = customerName === 'Walk-in' || customerName.toLowerCase().startsWith('walk');
  const isWater  = sale.product_name.toLowerCase().includes('bottle') || sale.product_name.toLowerCase().includes('water');

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden transition-all">
      <div className="h-[3px] w-full bg-amber-400" />
      <div className="p-4">

        {/* Product + quantity row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              {isWater ? <Droplets className="h-5 w-5" /> : <Package className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{sale.product_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(sale.movement_date), 'HH:mm')}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black tabular-nums text-amber-600">×{sale.quantity}</p>
            <p className="text-[10px] text-muted-foreground">units sold</p>
          </div>
        </div>

        {/* Customer info */}
        <div className={cn(
          'flex items-center gap-2.5 px-3.5 py-3 rounded-xl mb-3',
          isWalkIn
            ? 'bg-muted/40 border border-border/40'
            : 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
        )}>
          <User className={cn('h-3.5 w-3.5 shrink-0', isWalkIn ? 'text-muted-foreground' : 'text-emerald-600')} />
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-xs font-semibold truncate',
              isWalkIn ? 'text-muted-foreground' : 'text-emerald-800 dark:text-emerald-300',
            )}>
              {customerName}
            </p>
            {phone && (
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                <Phone className="h-2.5 w-2.5" />{phone}
              </p>
            )}
          </div>
          {!isWalkIn && (
            <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 rounded-full px-2 py-0.5 shrink-0">
              Account
            </span>
          )}
        </div>

        {/* ── Receipt shortcut ── */}
        <button
          onClick={() => onReceipt(sale)}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/50 transition-colors active:scale-[0.98]"
        >
          <Receipt className="h-3.5 w-3.5" />
          Issue Receipt
        </button>

      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

type SortKey = 'time' | 'qty';

export const DriverSalesPage: React.FC = () => {
  const { user } = useAuth();

  const [allHistory, setAllHistory] = useState<DriverStockHistory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortKey,    setSortKey]    = useState<SortKey>('time');

  // ── Receipt modal state ────────────────────────────────────────────────────
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [saleData,    setSaleData]    = useState<DriverSaleData | null>(null);

  const servedBy = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Driver';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hist = await driverStoreService.getHistory();
      setAllHistory(hist);
    } catch {
      toast.error('Failed to load sales history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Build DriverSaleData from a stock movement record ─────────────────────

  const handleReceipt = (sale: DriverStockHistory) => {
    const { name: customerName, phone } = parseCustomer(sale.notes);
    const isWalkIn = customerName === 'Walk-in' || customerName.toLowerCase().startsWith('walk');

    const data: DriverSaleData = {
      productName:   sale.product_name,
      productUnit:   'UNITS',   // unit not stored on history — good enough for receipt
      isReturnable:  false,
      quantity:      sale.quantity,
      unitPrice:     sale.unit_price ? parseFloat(String(sale.unit_price)) : 0,
      customerName:  customerName || 'Walk-in Customer',
      customerPhone: phone || undefined,
      isWalkIn,
      paymentMethod: (sale.payment_method || 'CASH') as DriverSaleData['paymentMethod'],
      servedBy,
      date:          sale.movement_date,
    };

    setSaleData(data);
    setReceiptOpen(true);
  };

  const sales = useMemo(() => {
    let list = allHistory.filter(h => h.movement_type === 'DIRECT_SALE');
    if (dateFilter)     list = list.filter(h => h.movement_date.startsWith(dateFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(h =>
        h.product_name.toLowerCase().includes(q) ||
        (h.notes ?? '').toLowerCase().includes(q),
      );
    }
    if (sortKey === 'qty') {
      list = [...list].sort((a, b) => b.quantity - a.quantity);
    }
    return list;
  }, [allHistory, search, dateFilter, sortKey]);

  const totalSales   = sales.length;
  const totalUnits   = sales.reduce((s, h) => s + h.quantity, 0);
  const todaySales   = sales.filter(h => isToday(new Date(h.movement_date))).length;
  const accountSales = sales.filter(h => (h.notes ?? '').toLowerCase().startsWith('customer:')).length;

  const grouped    = useMemo(() => groupByDate(sales), [sales]);
  const hasFilters = search || dateFilter;

  if (loading) return (
    <DriverLayout title="My Sales" subtitle="Loading…">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </DriverLayout>
  );

  return (
    <DriverLayout title="My Sales" subtitle="Direct sales you've recorded">

      {/* Stats — 2×2 grid on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        {[
          { label: 'Total',   val: totalSales,   cls: 'bg-amber-50   text-amber-700   border-amber-200/60'   },
          { label: 'Today',   val: todaySales,   cls: 'bg-blue-50    text-blue-700    border-blue-200/60'    },
          { label: 'Units',   val: totalUnits,   cls: 'bg-muted/60   text-foreground  border-border/60'      },
          { label: 'Account', val: accountSales, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
        ].map(({ label, val, cls }) => (
          <div key={label} className={cn('rounded-2xl border px-3 py-3.5 text-center', cls)}>
            <p className="text-2xl font-black leading-none tabular-nums">{val}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Today's progress bar */}
      {todaySales > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">Today's sales</span>
            </div>
            <span className="text-sm font-black text-amber-600">
              {todaySales} sale{todaySales !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (todaySales / Math.max(totalSales, 1)) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {todaySales} of {totalSales} total sales
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2.5 mb-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search product or customer…"
            className="w-full h-12 pl-10 pr-10 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Date + sort row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>
          <button
            onClick={() => setSortKey(k => k === 'time' ? 'qty' : 'time')}
            className="flex items-center gap-1.5 h-12 px-4 rounded-xl border border-border/60 bg-muted/30 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-[0.97]"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortKey === 'time' ? 'Time' : 'Qty'}
          </button>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setDateFilter(''); }}
              className="h-12 px-4 rounded-xl border border-border/60 bg-muted/30 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-[0.97]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary line */}
      <p className="text-xs text-muted-foreground mb-3">
        <strong>{sales.length}</strong> sale{sales.length !== 1 ? 's' : ''}
        {hasFilters ? ' · filtered' : ''}
        {sales.length > 0 && ` · ${totalUnits} unit${totalUnits !== 1 ? 's' : ''} total`}
      </p>

      {/* List */}
      {sales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <InboxIcon className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <p className="font-bold text-base mb-1">No sales found</p>
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? 'Try adjusting your filters.'
              : 'Direct sales will appear here after you record them.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5 pb-4">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              {/* Date section header */}
              <div className="flex items-center gap-3 mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">
                  {date}
                </p>
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[10px] font-bold text-muted-foreground shrink-0">
                  {items.length} sale{items.length !== 1 ? 's' : ''} · {items.reduce((s, i) => s + i.quantity, 0)} units
                </span>
              </div>
              <div className="space-y-2.5">
                {items.map(sale => (
                  <SaleCard
                    key={sale.id}
                    sale={sale}
                    servedBy={servedBy}
                    onReceipt={handleReceipt}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Receipt modal */}
      {saleData && (
        <DriverSaleReceiptModal
          open={receiptOpen}
          onClose={() => {
            setReceiptOpen(false);
            setSaleData(null);
          }}
          sale={saleData}
        />
      )}

    </DriverLayout>
  );
};

export default DriverSalesPage;
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Search, X, Receipt, Loader2,
  Clock, MapPin, Package, CheckCircle2, CalendarDays,
  RefreshCw, Phone, InboxIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DriverLayout } from '@/components/layout/DriverLayout';
import {
  deliveryService,
  type DriverDelivery,
  type DriverDeliveryDetail,
} from '@/api/services/delivery.service';
import { DeliveryReceiptModal } from './DeliveryReceiptModal';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtKES = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return `KES ${n.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-KE', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return s; }
};

type DateRange = 'today' | 'week' | 'month' | 'all';

const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today'      },
  { value: 'week',  label: 'This week'  },
  { value: 'month', label: 'This month' },
  { value: 'all',   label: 'All time'   },
];

/**
 * Returns a Date representing the START of the range (midnight).
 * Deliveries on or after this date are included.
 * Returns null for "all time" (no lower bound).
 */
function rangeStart(range: DateRange): Date | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (range === 'today') {
    return today;
  }
  if (range === 'week') {
    const d = new Date(today);
    d.setDate(d.getDate() - 6); // last 7 days inclusive
    return d;
  }
  if (range === 'month') {
    const d = new Date(today);
    d.setDate(d.getDate() - 29); // last 30 days inclusive
    return d;
  }
  return null; // 'all'
}

/**
 * Returns today at 23:59:59 — upper bound is always today.
 */
function rangeEnd(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Parse a YYYY-MM-DD string as a local midnight Date (avoids UTC shift).
 */
function parseLocalDate(s: string): Date | null {
  const parts = s.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Returns true if this delivery's scheduled_date falls within the range.
 */
function inRange(delivery: DriverDelivery, range: DateRange): boolean {
  if (range === 'all') return true;

  // Use scheduled_date if available, fall back to order-level dates.
  const rawDate = delivery.scheduled_date;
  if (!rawDate) return true; // no date info — include it rather than hide it

  const deliveryDate = parseLocalDate(rawDate);
  if (!deliveryDate) return true;

  const start = rangeStart(range);
  const end   = rangeEnd();

  if (start && deliveryDate < start) return false;
  if (deliveryDate > end)            return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt row card
// ─────────────────────────────────────────────────────────────────────────────

const ReceiptRow: React.FC<{
  delivery:  DriverDelivery;
  onReissue: () => void;
  loading:   boolean;
}> = ({ delivery, onReissue, loading }) => (
  <div className="rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-border hover:shadow-sm transition-all">
    <div className="h-[3px] w-full bg-emerald-500" />

    <div className="p-4">
      {/* Header: avatar + name + amount */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 font-black text-base select-none">
            {(delivery.customer_name ?? '?').trim()[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="font-bold text-sm truncate">{delivery.customer_name}</p>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold border rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 shrink-0">
                <CheckCircle2 className="h-2.5 w-2.5" />Delivered
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">{delivery.order_number}</p>
          </div>
        </div>

        {delivery.order_total_amount && (
          <p className="font-black text-base tabular-nums shrink-0 text-emerald-600 dark:text-emerald-400">
            {fmtKES(delivery.order_total_amount)}
          </p>
        )}
      </div>

      {/* Address */}
      {delivery.full_address && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground mb-2.5 bg-muted/40 rounded-xl px-3 py-2.5">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="line-clamp-1">{delivery.full_address}</span>
        </div>
      )}

      {/* Meta chips */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap mb-3">
        {delivery.customer_phone && (
          <span className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 shrink-0" />{delivery.customer_phone}
          </span>
        )}
        {delivery.scheduled_date && (
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3 w-3 shrink-0" />{fmtDate(delivery.scheduled_date)}
          </span>
        )}
        {delivery.scheduled_time_slot && (
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 shrink-0" />{delivery.scheduled_time_slot}
          </span>
        )}
        {delivery.items_count > 0 && (
          <span className="flex items-center gap-1.5">
            <Package className="h-3 w-3 shrink-0" />
            {delivery.items_count} item{delivery.items_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Reissue button */}
      <button
        onClick={onReissue}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/50 disabled:opacity-50 transition-colors active:scale-[0.98]"
      >
        {loading
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…</>
          : <><Receipt className="h-3.5 w-3.5" />Reissue Receipt</>
        }
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export const DriverReceiptsPage: React.FC = () => {
  // All completed deliveries — fetched once, filtered client-side
  const [allDeliveries, setAllDeliveries] = useState<DriverDelivery[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [dateRange,     setDateRange]     = useState<DateRange>('week');

  const [receiptOpen,     setReceiptOpen]     = useState(false);
  const [receiptDelivery, setReceiptDelivery] = useState<DriverDelivery | null>(null);
  const [receiptDetail,   setReceiptDetail]   = useState<DriverDeliveryDetail | null>(null);
  const [loadingId,       setLoadingId]       = useState<string | null>(null);

  // ── Fetch ALL completed deliveries once (no date param — backend does exact match only)
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // No date param → backend returns all completed deliveries for this driver
      const data = await deliveryService.getDriverDeliveries(undefined, 'COMPLETED');
      const raw: DriverDelivery[] = data.deliveries ?? [];
      setAllDeliveries(raw);
    } catch {
      toast.error('Failed to load receipts');
      setAllDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filter: date range THEN search — both run client-side ──────────────────
  const filtered = useMemo(() => {
    // Step 1: date range (uses scheduled_date field)
    let list = allDeliveries.filter(d => inRange(d, dateRange));

    // Step 2: text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.customer_name.toLowerCase().includes(q) ||
        d.order_number.toLowerCase().includes(q)  ||
        (d.customer_phone ?? '').includes(q),
      );
    }

    // Sort: newest scheduled_date first
    return list.sort((a, b) => {
      const da = a.scheduled_date ?? '';
      const db = b.scheduled_date ?? '';
      return da > db ? -1 : da < db ? 1 : 0;
    });
  }, [allDeliveries, dateRange, search]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalRevenue = filtered.reduce((s, d) => {
    const n = parseFloat(d.order_total_amount ?? '0');
    return s + (isNaN(n) ? 0 : n);
  }, 0);

  // ── Open receipt ───────────────────────────────────────────────────────────

  const handleReissue = async (delivery: DriverDelivery) => {
    setLoadingId(delivery.id);
    setReceiptDelivery(delivery);
    setReceiptDetail(null);
    try {
      const detail = await deliveryService.getDriverDeliveryDetail(delivery.id);
      setReceiptDetail(detail);
    } catch { /* non-fatal */ }
    setLoadingId(null);
    setReceiptOpen(true);
  };

  const hasFilters = !!search || dateRange !== 'week';

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <DriverLayout title="Receipts" subtitle="Find and reissue past delivery receipts">

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        {[
          {
            label: 'All Time',
            val:   allDeliveries.length,
            cls:   'bg-muted/60 text-foreground border-border/60',
          },
          {
            label: DATE_OPTIONS.find(o => o.value === dateRange)?.label ?? 'Period',
            val:   filtered.length,
            cls:   'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40',
          },
          {
            label: 'Revenue',
            val:   `KES ${totalRevenue.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`,
            cls:   'bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/40',
          },
          {
            label: 'Shown',
            val:   filtered.length,
            cls:   'bg-muted/60 text-foreground border-border/60',
          },
        ].map(({ label, val, cls }) => (
          <div key={label} className={cn('rounded-2xl border px-3 py-3.5 text-center', cls)}>
            <p className="text-xl font-black leading-none tabular-nums truncate">{val}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-2.5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by customer name, order no. or phone…"
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

      {/* Date pills + refresh */}
      <div className="flex gap-2 flex-wrap items-center mb-4">
        {DATE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setDateRange(opt.value)}
            className={cn(
              'text-[11px] font-bold px-3.5 py-2 rounded-full border transition-all',
              dateRange === opt.value
                ? 'bg-foreground text-background border-foreground'
                : 'bg-muted/40 text-muted-foreground border-border/50',
            )}
          >
            {opt.label}
            {/* Show count badge per range */}
            {!loading && (
              <span className={cn(
                'ml-1.5 text-[10px] font-black tabular-nums',
                dateRange === opt.value ? 'opacity-60' : 'opacity-40',
              )}>
                {allDeliveries.filter(d => inRange(d, opt.value)).length}
              </span>
            )}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-2 rounded-full border bg-muted/40 text-muted-foreground border-border/50 hover:border-border disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-[11px] text-muted-foreground">Filters:</span>
          {search && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
              "{search}"
              <button onClick={() => setSearch('')} className="hover:opacity-60 ml-0.5">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {dateRange !== 'week' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
              {DATE_OPTIONS.find(o => o.value === dateRange)?.label}
              <button onClick={() => setDateRange('week')} className="hover:opacity-60 ml-0.5">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          <button
            onClick={() => { setSearch(''); setDateRange('week'); }}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-auto"
          >
            Clear all
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary/50" />
          <p className="text-sm text-muted-foreground">Loading receipts…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            {search
              ? <Search    className="h-7 w-7 text-muted-foreground/30" />
              : <InboxIcon className="h-7 w-7 text-muted-foreground/30" />
            }
          </div>
          <p className="font-bold text-base mb-1">
            {search ? 'No receipts found' : 'No deliveries in this period'}
          </p>
          <p className="text-sm text-muted-foreground">
            {search
              ? 'Try the customer\'s phone number or order number.'
              : 'No completed deliveries match the selected date range.'
            }
          </p>
          {search && (
            <button onClick={() => setSearch('')} className="mt-3 text-xs text-primary underline underline-offset-2">
              Clear search
            </button>
          )}
          {!search && dateRange !== 'all' && (
            <button onClick={() => setDateRange('all')} className="mt-3 text-xs text-primary underline underline-offset-2">
              Show all time
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5 pb-4">
          {filtered.map(d => (
            <ReceiptRow
              key={d.id}
              delivery={d}
              loading={loadingId === d.id}
              onReissue={() => handleReissue(d)}
            />
          ))}

          <p className="text-center text-[11px] text-muted-foreground pt-2 pb-2">
            {filtered.length} receipt{filtered.length !== 1 ? 's' : ''} —{' '}
            {DATE_OPTIONS.find(o => o.value === dateRange)?.label?.toLowerCase()}
            {allDeliveries.length !== filtered.length && ` (${allDeliveries.length} total all time)`}
          </p>
        </div>
      )}

      {/* Tip */}
      {!loading && filtered.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 flex items-start gap-3 mb-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Tap "Reissue Receipt"</span> on any row to open the full receipt. You can then WhatsApp it to the customer, print it, or download a PDF on the spot.
          </p>
        </div>
      )}

      {/* Receipt modal */}
      {receiptDelivery && (
        <DeliveryReceiptModal
          open={receiptOpen}
          onClose={() => {
            setReceiptOpen(false);
            setReceiptDelivery(null);
            setReceiptDetail(null);
          }}
          delivery={receiptDelivery}
          detail={receiptDetail ?? undefined}
        />
      )}

    </DriverLayout>
  );
};

export default DriverReceiptsPage;
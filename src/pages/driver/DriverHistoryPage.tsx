import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverLayout } from '@/components/layout/DriverLayout';
import {
  MapPin, Clock, Package, CheckCircle, XCircle,
  Loader2, Search, Calendar, ArrowUpDown,
  ChevronRight, InboxIcon, X, TrendingUp, Receipt,
} from 'lucide-react';
import {
  deliveryService,
  type DriverDelivery,
  type DriverDeliveryDetail,
} from '@/api/services/delivery.service';
import { DeliveryReceiptModal } from './DeliveryReceiptModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseSlot(slot = ''): number {
  const m = slot.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 9999;
  let h = parseInt(m[1]);
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + parseInt(m[2]);
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'COMPLETED' | 'FAILED';
type SortKey      = 'date' | 'time' | 'status';

export const DriverHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [deliveries,   setDeliveries]   = useState<DriverDelivery[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey,      setSortKey]      = useState<SortKey>('date');
  const [dateFilter,   setDateFilter]   = useState('');

  // ── Receipt modal state ────────────────────────────────────────────────────
  const [receiptOpen,     setReceiptOpen]     = useState(false);
  const [receiptDelivery, setReceiptDelivery] = useState<DriverDelivery | null>(null);
  const [receiptDetail,   setReceiptDetail]   = useState<DriverDeliveryDetail | null>(null);
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await deliveryService.getDriverDeliveries(
        dateFilter || undefined,
        undefined,
      );
      const all: DriverDelivery[] = data.deliveries || [];
      setDeliveries(all.filter(d => ['COMPLETED', 'FAILED'].includes(d.status)));
    } catch {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Open receipt ───────────────────────────────────────────────────────────

  const handleReceipt = async (delivery: DriverDelivery) => {
    setReceiptLoadingId(delivery.id);
    setReceiptDelivery(delivery);
    setReceiptDetail(null);
    try {
      const detail = await deliveryService.getDriverDeliveryDetail(delivery.id);
      setReceiptDetail(detail);
    } catch { /* non-fatal — modal renders with list data */ }
    setReceiptLoadingId(null);
    setReceiptOpen(true);
  };

  const completedCount = deliveries.filter(d => d.status === 'COMPLETED').length;
  const failedCount    = deliveries.filter(d => d.status === 'FAILED').length;
  const rate           = deliveries.length
    ? Math.round((completedCount / deliveries.length) * 100) : 0;
  const totalItems = deliveries.reduce((s, d) => s + (d.items_count || 0), 0);

  const filtered = useMemo(() => {
    let list = [...deliveries];
    if (statusFilter !== 'all') {
      list = list.filter(d => d.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.customer_name.toLowerCase().includes(q) ||
        d.order_number.toLowerCase().includes(q) ||
        (d.full_address || '').toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (sortKey === 'date' || sortKey === 'time') {
        const da = a.scheduled_date ?? '', db = b.scheduled_date ?? '';
        if (da !== db) return da > db ? -1 : 1;
        return parseSlot(a.scheduled_time_slot) - parseSlot(b.scheduled_time_slot);
      }
      if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return -1;
      if (b.status === 'COMPLETED' && a.status !== 'COMPLETED') return 1;
      return 0;
    });
    return list;
  }, [deliveries, search, statusFilter, sortKey]);

  const hasFilters = search || statusFilter !== 'all' || dateFilter;

  const clearAll = () => {
    setSearch('');
    setStatusFilter('all');
    setDateFilter('');
  };

  return (
    <DriverLayout title="History" subtitle="Your past deliveries">

      {/* Stats — 2×2 grid on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        {[
          { label: 'Done',   val: completedCount, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
          { label: 'Failed', val: failedCount,     cls: 'bg-red-50     text-red-700     border-red-200/60'     },
          { label: 'Rate',   val: `${rate}%`,      cls: 'bg-blue-50    text-blue-700    border-blue-200/60'    },
          { label: 'Items',  val: totalItems,       cls: 'bg-muted/60   text-foreground  border-border/60'      },
        ].map(({ label, val, cls }) => (
          <div key={label} className={cn('rounded-2xl border px-3 py-3.5 text-center', cls)}>
            <p className="text-2xl font-black leading-none tabular-nums">{val}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Rate bar */}
      {deliveries.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">Success rate</span>
            </div>
            <span className={cn(
              'text-sm font-black',
              rate >= 80 ? 'text-emerald-600' : rate >= 60 ? 'text-amber-600' : 'text-red-600',
            )}>{rate}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-amber-500' : 'bg-red-500',
              )}
              style={{ width: `${rate}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {completedCount} of {deliveries.length} deliveries completed
            {dateFilter ? ` on ${dateFilter}` : ' (all time)'}
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
            placeholder="Search customer, order, address…"
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

        {/* Date picker */}
        <div className="relative">
          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="w-full h-12 pl-10 pr-10 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status + sort */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'COMPLETED', 'FAILED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'text-[11px] font-bold px-3.5 py-2 rounded-full border transition-all',
                statusFilter === s
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-muted/40 text-muted-foreground border-border/50',
              )}
            >
              {s === 'all' ? 'All' : s === 'COMPLETED' ? 'Completed' : 'Failed'}
            </button>
          ))}

          <div className="flex-1" />

          <button
            onClick={() => setSortKey(k =>
              k === 'date' ? 'time' : k === 'time' ? 'status' : 'date'
            )}
            className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-2 rounded-full border bg-muted/40 text-muted-foreground border-border/50 hover:border-border"
          >
            <ArrowUpDown className="h-3 w-3" />
            {sortKey === 'date' ? 'By Date' : sortKey === 'time' ? 'By Time' : 'By Status'}
          </button>
        </div>
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
          {statusFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
              {statusFilter}
              <button onClick={() => setStatusFilter('all')} className="hover:opacity-60 ml-0.5">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {dateFilter && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
              {dateFilter}
              <button onClick={() => setDateFilter('')} className="hover:opacity-60 ml-0.5">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          <button
            onClick={clearAll}
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
          <p className="text-sm text-muted-foreground">Loading history…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <InboxIcon className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <p className="font-bold text-base mb-1">No deliveries found</p>
          <p className="text-sm text-muted-foreground">
            {hasFilters ? 'Try adjusting your filters.' : 'Completed and failed deliveries will appear here.'}
          </p>
          {hasFilters && (
            <button onClick={clearAll} className="mt-3 text-xs text-primary underline underline-offset-2">
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5 pb-4">
          {filtered.map(d => {
            const isCompleted   = d.status === 'COMPLETED';
            const isLoadingReceipt = receiptLoadingId === d.id;

            return (
              <div
                key={d.id}
                className="rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-border hover:shadow-sm transition-all"
              >
                <div className={cn('h-[3px] w-full', isCompleted ? 'bg-emerald-500' : 'bg-red-400')} />

                <div className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-sm">{d.customer_name}</p>
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold border rounded-full px-2 py-0.5 shrink-0',
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
                        )}>
                          {isCompleted
                            ? <><CheckCircle className="h-2.5 w-2.5" />Completed</>
                            : <><XCircle    className="h-2.5 w-2.5" />Failed</>
                          }
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">{d.order_number}</p>
                    </div>

                    {/* Details button */}
                    <button
                      onClick={() => navigate(`/driver/deliveries/${d.id}`)}
                      className="h-10 px-3.5 flex items-center gap-1.5 rounded-xl border border-border/70 bg-muted/30 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 active:scale-[0.97]"
                    >
                      Details<ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-2 text-xs text-muted-foreground mb-2.5 bg-muted/40 rounded-xl px-3 py-2.5">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-1">{d.full_address || '—'}</span>
                  </div>

                  {/* Meta chips */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap mb-3">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />{d.scheduled_date ?? '—'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />{d.scheduled_time_slot ?? '—'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Package className="h-3 w-3" />{d.items_count} item{d.items_count !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* ── Receipt shortcut — only for COMPLETED deliveries ── */}
                  {isCompleted && (
                    <button
                      onClick={() => handleReceipt(d)}
                      disabled={isLoadingReceipt}
                      className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/50 disabled:opacity-50 transition-colors active:scale-[0.98]"
                    >
                      {isLoadingReceipt
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading receipt…</>
                        : <><Receipt className="h-3.5 w-3.5" />Issue / Reissue Receipt</>
                      }
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <p className="text-center text-[11px] text-muted-foreground pt-2 pb-2">
            Showing {filtered.length} of {deliveries.length} deliver{deliveries.length !== 1 ? 'ies' : 'y'}
            {dateFilter ? ` on ${dateFilter}` : ' (all time)'}
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

export default DriverHistoryPage;
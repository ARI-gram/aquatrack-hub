/**
 * src/pages/driver/DriverDashboard.tsx
 * Mobile-first dashboard — single column on phones, 3-col grid on desktop
 */

import React, { useState, useEffect, useMemo } from 'react';
import { DriverLayout } from '@/components/layout/DriverLayout';
import {
  Truck, CheckCircle, MapPin, Clock, Navigation, Phone,
  Loader2, Search, Package, Users, ChevronRight, AlertCircle, X,
} from 'lucide-react';
import { deliveryService, DriverDelivery } from '@/api/services/delivery.service';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = 'status_active' | 'time_asc';

interface DriverProfile {
  driver: { name: string; phone: string; vehicle_number: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; dot: string; pill: string; priority: number }> = {
  ASSIGNED:    { label: 'New',         dot: 'bg-amber-400',   pill: 'bg-amber-50   text-amber-700   border-amber-200',   priority: 1 },
  ACCEPTED:    { label: 'Accepted',    dot: 'bg-sky-500',     pill: 'bg-sky-50     text-sky-700     border-sky-200',     priority: 2 },
  PICKED_UP:   { label: 'Picked Up',  dot: 'bg-violet-500',  pill: 'bg-violet-50  text-violet-700  border-violet-200',  priority: 3 },
  EN_ROUTE:    { label: 'En Route',   dot: 'bg-blue-500',    pill: 'bg-blue-50    text-blue-700    border-blue-200',    priority: 4 },
  ARRIVED:     { label: 'Arrived',    dot: 'bg-teal-500',    pill: 'bg-teal-50    text-teal-700    border-teal-200',    priority: 5 },
  IN_PROGRESS: { label: 'In Progress',dot: 'bg-indigo-500',  pill: 'bg-indigo-50  text-indigo-700  border-indigo-200',  priority: 6 },
  COMPLETED:   { label: 'Completed',  dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', priority: 99 },
  FAILED:      { label: 'Failed',     dot: 'bg-red-400',     pill: 'bg-red-50     text-red-700     border-red-200',     priority: 99 },
};

function parseTimeSlot(slot: string): number {
  const match = slot?.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 9999;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function isActive(status: string) {
  return !['COMPLETED', 'FAILED'].includes(status);
}

// ── Status Pill ───────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CFG[status];
  if (!cfg) return <span className="text-[10px] border rounded-full px-2 py-0.5">{status}</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 border rounded-full text-[10px] font-bold px-2.5 py-0.5 shrink-0', cfg.pill)}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  );
};

// ── Delivery card ─────────────────────────────────────────────────────────────

const DeliveryCard: React.FC<{
  delivery:     DriverDelivery;
  index:        number;
  isNext:       boolean;
  hasSibling:   boolean;
  onAccept:     (id: string) => void;
  onNavigate:   (id: string) => void;
}> = ({ delivery, index, isNext, hasSibling, onAccept, onNavigate }) => {
  return (
    <div className={cn(
      'relative rounded-2xl border overflow-hidden transition-all duration-200',
      isNext
        ? 'border-primary/40 shadow-md shadow-primary/5 bg-card'
        : 'border-border/60 bg-card',
    )}>
      {/* Left accent bar */}
      <div className={cn(
        'absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl',
        isNext ? 'bg-primary' : STATUS_CFG[delivery.status]?.dot ?? 'bg-border',
      )} />

      <div className="pl-5 pr-4 pt-4 pb-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0',
              isNext ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}>
              {index + 1}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">{delivery.customer_name}</p>
                {hasSibling && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5 shrink-0">
                    <Users className="h-2.5 w-2.5" />Multi-stop
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{delivery.order_number}</p>
            </div>
          </div>
          <StatusPill status={delivery.status} />
        </div>

        {/* Address */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3 bg-muted/30 rounded-xl px-3 py-2.5">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
          <span className="line-clamp-2 leading-relaxed">{delivery.full_address}</span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3 flex-wrap">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />{delivery.scheduled_time_slot}
          </span>
          <span className="flex items-center gap-1.5">
            <Package className="h-3 w-3" />{delivery.items_count} item{delivery.items_count !== 1 ? 's' : ''}
          </span>
          {delivery.bottles_to_deliver > 0 && (
            <span className="flex items-center gap-1.5">
              <Truck className="h-3 w-3" />{delivery.bottles_to_deliver} btl
            </span>
          )}
        </div>

        {delivery.driver_notes && (
          <div className="flex items-start gap-2 mb-3 bg-amber-50/70 border border-amber-100 rounded-xl px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 italic">{delivery.driver_notes}</p>
          </div>
        )}

        {/* Actions — full width on mobile, equal split */}
        <div className="grid grid-cols-3 gap-2">
          <button
            className="h-11 rounded-xl border border-border/60 bg-muted/30 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-muted transition-colors active:scale-[0.97]"
            onClick={() => window.open(`tel:${delivery.customer_phone}`)}
          >
            <Phone className="h-3.5 w-3.5" />Call
          </button>
          <button
            className="h-11 rounded-xl border border-border/60 bg-muted/30 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-muted transition-colors active:scale-[0.97]"
            onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(delivery.full_address)}`)}
          >
            <Navigation className="h-3.5 w-3.5" />Nav
          </button>
          {delivery.status === 'ASSIGNED' ? (
            <button
              className="h-11 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors active:scale-[0.97]"
              onClick={() => onAccept(delivery.id)}
            >
              <CheckCircle className="h-3.5 w-3.5" />Accept
            </button>
          ) : (
            <button
              className="h-11 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors active:scale-[0.97]"
              onClick={() => onNavigate(delivery.id)}
            >
              View<ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const DriverDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [profile,    setProfile]    = useState<DriverProfile | null>(null);
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [search,     setSearch]     = useState('');
  const [sortKey,    setSortKey]    = useState<SortKey>('status_active');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [profileData, deliveriesData] = await Promise.all([
        deliveryService.getDriverProfile(),
        deliveryService.getDriverDeliveries(),
      ]);
      setProfile(profileData);
      setDeliveries(deliveriesData.deliveries || []);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (deliveryId: string) => {
    try {
      await deliveryService.acceptDelivery(deliveryId);
      toast.success('Delivery accepted');
      loadData();
    } catch {
      toast.error('Failed to accept delivery');
    }
  };

  const remaining  = deliveries.filter(d => isActive(d.status)).length;
  const completed  = deliveries.filter(d => d.status === 'COMPLETED').length;
  const totalItems = deliveries.reduce((s, d) => s + (d.items_count || 0), 0);
  const rate       = deliveries.length ? Math.round((completed / deliveries.length) * 100) : 0;

  const customerCount = useMemo(() => {
    const map: Record<string, number> = {};
    deliveries.forEach(d => { map[d.customer_name] = (map[d.customer_name] ?? 0) + 1; });
    return map;
  }, [deliveries]);

  const activeDeliveries = useMemo(() => {
    let list = deliveries.filter(d => isActive(d.status));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.customer_name.toLowerCase().includes(q) ||
        d.order_number.toLowerCase().includes(q) ||
        d.full_address.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortKey === 'time_asc') {
        return parseTimeSlot(a.scheduled_time_slot) - parseTimeSlot(b.scheduled_time_slot);
      }
      const pa = STATUS_CFG[a.status]?.priority ?? 99;
      const pb = STATUS_CFG[b.status]?.priority ?? 99;
      if (pa !== pb) return pa - pb;
      return parseTimeSlot(a.scheduled_time_slot) - parseTimeSlot(b.scheduled_time_slot);
    });
  }, [deliveries, search, sortKey]);

  const completedDeliveries = deliveries.filter(d => d.status === 'COMPLETED');
  const nextDelivery        = activeDeliveries.find(d => d.status === 'ACCEPTED');

  if (isLoading) {
    return (
      <DriverLayout title="My Deliveries" subtitle="Loading…">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DriverLayout>
    );
  }

  return (
    <DriverLayout
      title="My Deliveries"
      subtitle={`Welcome, ${profile?.driver?.name || 'Driver'}`}
    >
      {/* Stats — 2x2 grid on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        {[
          { label: 'Remaining',  val: remaining,         cls: 'bg-blue-50    text-blue-700    border-blue-200/60'    },
          { label: 'Completed',  val: completed,         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
          { label: 'Total',      val: deliveries.length, cls: 'bg-muted/60   text-foreground  border-border/60'     },
          { label: 'Items',      val: totalItems,        cls: 'bg-muted/60   text-foreground  border-border/60'     },
        ].map(({ label, val, cls }) => (
          <div key={label} className={cn('rounded-2xl border px-3 py-3.5 text-center', cls)}>
            <p className="text-2xl font-black leading-none tabular-nums">{val}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Rate + progress */}
      {deliveries.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground">Completion rate</span>
            <span className={cn(
              'text-sm font-black',
              rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600',
            )}>{rate}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500',
                rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
              )}
              style={{ width: `${rate}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">{completed} of {deliveries.length} delivered</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">

        {/* Delivery Queue */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base flex-1">Delivery Queue</h2>
            <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-bold">
              {activeDeliveries.length} active
            </span>
          </div>

          {/* Search + sort */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                placeholder="Search customer, order, address…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-12 pl-10 pr-10 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {([
                { k: 'status_active' as SortKey, label: 'Status' },
                { k: 'time_asc'     as SortKey, label: 'By Time' },
              ]).map(s => (
                <button
                  key={s.k}
                  onClick={() => setSortKey(s.k)}
                  className={cn(
                    'text-[11px] font-bold px-3.5 py-2 rounded-full border transition-all',
                    sortKey === s.k
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-muted/40 text-muted-foreground border-border/50',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {search && (
            <p className="text-[11px] text-muted-foreground">
              {activeDeliveries.length} result{activeDeliveries.length !== 1 ? 's' : ''} for "{search}"
              <button onClick={() => setSearch('')} className="ml-1.5 text-primary hover:underline">Clear</button>
            </p>
          )}

          {activeDeliveries.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-12 text-center">
              <Package className="h-9 w-9 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? 'No results found' : 'No active deliveries'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeDeliveries.map((delivery, i) => (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                  index={i}
                  isNext={nextDelivery?.id === delivery.id}
                  hasSibling={(customerCount[delivery.customer_name] ?? 0) > 1}
                  onAccept={handleAccept}
                  onNavigate={id => navigate(`/driver/deliveries/${id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Completed sidebar — collapses nicely on mobile */}
        <div className="space-y-4">
          {/* Rate card */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Today's Rate
            </p>
            <p className={cn(
              'text-5xl font-black tabular-nums',
              rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600',
            )}>{rate}%</p>
            <p className="text-xs text-muted-foreground mt-2">
              {completed} of {deliveries.length} delivered
            </p>
            <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500',
                  rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${rate}%` }}
              />
            </div>
          </div>

          {/* Completed list */}
          {completedDeliveries.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 bg-muted/20 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Completed · {completedDeliveries.length}
                </p>
              </div>
              <div className="p-3 space-y-1.5">
                {completedDeliveries.map(d => (
                  <button
                    key={d.id}
                    onClick={() => navigate(`/driver/deliveries/${d.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 border border-emerald-100/80 hover:bg-emerald-50 transition-colors active:scale-[0.98] group"
                  >
                    <span className="text-sm font-medium truncate mr-2">{d.customer_name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{d.scheduled_time_slot}</span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DriverLayout>
  );
};

export default DriverDashboard;
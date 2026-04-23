/**
 * src/pages/driver/DriverDashboard.tsx
 *
 * Complete delivery flow now mirrors DeliveryQueuePage exactly:
 *  - Stock maps (bottleMap / consumableMap) derived from van stock on every load
 *  - checkDeliveryStock run before opening CompleteDeliveryDialog — stockCheck passed in
 *  - CompleteTarget carries stockCheck for both single & bulk modes
 *  - myRequests fetched on load → pendingDeliveryIds / pendingProductIds sets built
 *  - openStockRequest has the same duplicate-guard as DeliveryQueuePage
 *  - "Complete Delivery" quick action computes stockCheck for the ACCEPTED delivery
 *    before opening the dialog (falls back to list mode with no stockCheck when none)
 *
 * FIX: DeliveryCard "Open" button and NextStopHero "View Delivery" button have
 * been replaced with "Complete" / "Complete Delivery" buttons that open
 * CompleteDeliveryDialog directly — no navigation to DeliveryDetailPage.
 * DeliveryDetailPage is no longer involved in the completion flow at all.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DriverLayout } from '@/components/layout/DriverLayout';
import {
  Truck, CheckCircle, MapPin, Clock, Navigation, Phone,
  Loader2, Search, Package, Users, ChevronRight, AlertCircle, X,
  Zap, CheckCircle2, ShoppingCart, RefreshCw,
} from 'lucide-react';
import { deliveryService, type DriverDelivery } from '@/api/services/delivery.service';
import {
  driverStoreService,
  type DriverBottleStock,
  type DriverConsumableStock,
} from '@/api/services/driver-store.service';
import { CompleteDeliveryDialog } from '@/components/dialogs/CompleteDeliveryDialog';
import { DirectSaleDialog } from '@/components/dialogs/DirectSaleDialog';
import { StockRequestDialog, type StockRequestItem } from '@/components/dialogs/StockRequestDialog';
import {
  stockRequestService,
  type StockRequest,
} from '@/api/services/stock-request.service';
import { type CustomerGroup } from '@/lib/deliveryUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Stock types ────────────────────────────────────────────────────────────────

export interface ItemStockStatus {
  product_id:    string;
  product_name:  string;
  product_unit:  string;
  is_returnable: boolean;
  ordered_qty:   number;
  available_qty: number;
}

export type DeliveryStockStatus = 'full' | 'partial' | 'none' | 'unknown';

export interface DeliveryStockCheck {
  status:     DeliveryStockStatus;
  itemChecks: ItemStockStatus[];
}

type DriverDeliveryWithItems = DriverDelivery & {
  order_items?: Array<{
    id:            string;
    product_id:    string;
    product_name:  string;
    product_unit:  string;
    is_returnable: boolean;
    quantity:      number;
  }>;
};

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = 'status_active' | 'time_asc';

type CompleteTarget =
  | { mode: 'list' }
  | { mode: 'single'; delivery: DriverDelivery; stockCheck: DeliveryStockCheck }
  | { mode: 'bulk';   group: CustomerGroup;     stockCheck: DeliveryStockCheck };

interface StockRequestState {
  open:         boolean;
  prefillItems: StockRequestItem[];
  deliveryId?:  string;
  orderNumber?: string;
}

interface DriverProfile {
  driver: { name: string; phone: string; vehicle_number: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, {
  label: string; dot: string; pill: string; bar: string; priority: number;
}> = {
  ASSIGNED:    { label: 'New',          dot: 'bg-amber-400',   pill: 'bg-amber-50   text-amber-700   border-amber-200',   bar: 'bg-amber-400',   priority: 1 },
  ACCEPTED:    { label: 'Accepted',     dot: 'bg-sky-500',     pill: 'bg-sky-50     text-sky-700     border-sky-200',     bar: 'bg-sky-500',     priority: 2 },
  PICKED_UP:   { label: 'Picked Up',   dot: 'bg-violet-500',  pill: 'bg-violet-50  text-violet-700  border-violet-200',  bar: 'bg-violet-500',  priority: 3 },
  EN_ROUTE:    { label: 'En Route',    dot: 'bg-blue-500',    pill: 'bg-blue-50    text-blue-700    border-blue-200',    bar: 'bg-blue-500',    priority: 4 },
  ARRIVED:     { label: 'Arrived',     dot: 'bg-teal-500',    pill: 'bg-teal-50    text-teal-700    border-teal-200',    bar: 'bg-teal-500',    priority: 5 },
  IN_PROGRESS: { label: 'In Progress', dot: 'bg-indigo-500',  pill: 'bg-indigo-50  text-indigo-700  border-indigo-200',  bar: 'bg-indigo-500',  priority: 6 },
  COMPLETED:   { label: 'Completed',   dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500', priority: 99 },
  FAILED:      { label: 'Failed',      dot: 'bg-red-400',     pill: 'bg-red-50     text-red-700     border-red-200',     bar: 'bg-red-400',     priority: 99 },
};

const ACTIVE_STATUSES = ['ASSIGNED','ACCEPTED','PICKED_UP','EN_ROUTE','ARRIVED','IN_PROGRESS'];

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

// ── Stock helpers ─────────────────────────────────────────────────────────────

function buildBottleMap(bottles: DriverBottleStock[]): Map<string, number> {
  return new Map(bottles.map(b => [b.product_id, b.balance.full]));
}

function buildConsumableMap(consumables: DriverConsumableStock[]): Map<string, number> {
  return new Map(consumables.map(c => [c.product_id, c.balance.in_stock]));
}

function checkDeliveryStock(
  delivery: DriverDelivery,
  bottleMap: Map<string, number>,
  consumableMap: Map<string, number>,
): DeliveryStockCheck {
  const items = (delivery as DriverDeliveryWithItems).order_items;
  if (!items || items.length === 0) return { status: 'unknown', itemChecks: [] };

  const itemChecks: ItemStockStatus[] = items.map(item => {
    const available = item.is_returnable
      ? (bottleMap.get(item.product_id) ?? 0)
      : (consumableMap.get(item.product_id) ?? 0);
    return {
      product_id:    item.product_id,
      product_name:  item.product_name,
      product_unit:  item.product_unit,
      is_returnable: item.is_returnable,
      ordered_qty:   item.quantity,
      available_qty: available,
    };
  });

  const anyAvailable = itemChecks.some(c => c.available_qty > 0);
  const allFull      = itemChecks.every(c => c.available_qty >= c.ordered_qty);
  const status: DeliveryStockStatus =
    allFull ? 'full' : anyAvailable ? 'partial' : 'none';

  return { status, itemChecks };
}

function buildStockRequestFromDeliveries(
  deliveries: DriverDelivery[],
  bottleMap: Map<string, number>,
  consumableMap: Map<string, number>,
): StockRequestItem[] {
  const aggregated = new Map<string, StockRequestItem>();
  for (const delivery of deliveries) {
    if (!isActive(delivery.status)) continue;
    const check = checkDeliveryStock(delivery, bottleMap, consumableMap);
    if (check.status === 'unknown' || check.status === 'full') continue;
    for (const item of check.itemChecks) {
      const shortage = Math.max(0, item.ordered_qty - item.available_qty);
      if (shortage <= 0) continue;
      const existing = aggregated.get(item.product_id);
      if (existing) {
        aggregated.set(item.product_id, {
          ...existing,
          quantity_requested: existing.quantity_requested + shortage,
          needed_qty: (existing.needed_qty ?? 0) + item.ordered_qty,
        });
      } else {
        aggregated.set(item.product_id, {
          product_id:         item.product_id,
          product_name:       item.product_name,
          product_type:       item.is_returnable ? 'bottle' : 'consumable',
          current_qty:        item.available_qty,
          needed_qty:         item.ordered_qty,
          quantity_requested: shortage,
        });
      }
    }
  }
  return Array.from(aggregated.values());
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

// ── Quick Action Bar ──────────────────────────────────────────────────────────

const QuickActionBar: React.FC<{
  onComplete: () => void;
  onSale:     () => void;
  onTopUp:    () => void;
}> = ({ onComplete, onSale, onTopUp }) => {
  const actions = [
    {
      key:     'complete',
      label:   'Complete\nDelivery',
      icon:    <CheckCircle2 className="h-4 w-4" />,
      iconCls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
      onClick: onComplete,
    },
    {
      key:     'sale',
      label:   'Direct\nSale',
      icon:    <ShoppingCart className="h-4 w-4" />,
      iconCls: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
      onClick: onSale,
    },
    {
      key:     'topup',
      label:   'Request\nTop-up',
      icon:    <RefreshCw className="h-4 w-4" />,
      iconCls: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
      onClick: onTopUp,
    },
  ];

  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
        Quick Actions
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {actions.map(({ key, label, icon, iconCls, onClick }) => (
          <button
            key={key}
            onClick={onClick}
            className="flex flex-col items-center justify-center gap-1.5 h-[72px] rounded-2xl border border-border/60 bg-card hover:bg-muted/40 transition-all active:scale-[0.97] px-2"
          >
            <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center shrink-0', iconCls)}>
              {icon}
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground text-center leading-tight whitespace-pre-line">
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Next Stop Hero Card ────────────────────────────────────────────────────────
// FIX: "View Delivery" → "Complete Delivery" — opens dialog, no page navigation

const NextStopHero: React.FC<{
  delivery:   DriverDelivery;
  stockCheck: DeliveryStockCheck;
  onAccept:   (id: string) => void;
  onComplete: (delivery: DriverDelivery, stockCheck: DeliveryStockCheck) => void;
}> = ({ delivery, stockCheck, onAccept, onComplete }) => (
  <div className="relative rounded-2xl overflow-hidden mb-4 border border-primary/30 shadow-lg shadow-primary/5">
    <div className="h-1 w-full bg-primary" />

    <div className="absolute top-4 right-4">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black bg-primary text-primary-foreground rounded-full px-2.5 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
        NEXT STOP
      </span>
    </div>

    <div className="p-4 pt-3.5">
      <div className="mb-3 pr-24">
        <p className="font-bold text-lg leading-tight truncate">{delivery.customer_name}</p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{delivery.order_number}</p>
      </div>

      <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/15 rounded-xl px-3.5 py-3 mb-3">
        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <span className="text-sm font-medium leading-relaxed line-clamp-2">{delivery.full_address}</span>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
        <span className="flex items-center gap-1.5 font-semibold">
          <Clock className="h-3.5 w-3.5" />{delivery.scheduled_time_slot}
        </span>
        <span className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" />{delivery.items_count} item{delivery.items_count !== 1 ? 's' : ''}
        </span>
        {(delivery.bottles_to_deliver ?? 0) > 0 && (
          <span className="flex items-center gap-1.5 font-semibold text-blue-600">
            <Truck className="h-3.5 w-3.5" />{delivery.bottles_to_deliver} btl
          </span>
        )}
      </div>

      {delivery.driver_notes && (
        <div className="flex items-start gap-2 mb-4 bg-amber-50/80 border border-amber-100 rounded-xl px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 italic">{delivery.driver_notes}</p>
        </div>
      )}

      {/* Call + Navigate icon buttons + Complete CTA */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => window.open(`tel:${delivery.customer_phone}`)}
          className="h-12 w-12 shrink-0 rounded-xl border border-border/60 bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors active:scale-90"
          aria-label="Call customer"
        >
          <Phone className="h-4.5 w-4.5 text-muted-foreground" />
        </button>
        <button
          onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(delivery.full_address)}`)}
          className="h-12 w-12 shrink-0 rounded-xl border border-border/60 bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors active:scale-90"
          aria-label="Navigate"
        >
          <Navigation className="h-4.5 w-4.5 text-muted-foreground" />
        </button>
        {/* FIX: was "View Delivery → navigate(id)", now opens CompleteDeliveryDialog */}
        <button
          className={cn(
            'flex-1 h-12 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2',
            'transition-colors active:scale-[0.98] shadow-md',
            stockCheck.status === 'none'
              ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
              : stockCheck.status === 'partial'
              ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20',
          )}
          onClick={() => onComplete(delivery, stockCheck)}
        >
          <CheckCircle className="h-4 w-4" />
          {stockCheck.status === 'none'
            ? 'Complete (Short)'
            : stockCheck.status === 'partial'
            ? 'Complete (Partial)'
            : 'Complete Delivery'
          }
        </button>
      </div>
    </div>
  </div>
);

// ── Delivery Card ─────────────────────────────────────────────────────────────
// FIX: "Open → navigate(id)" replaced with "Complete → opens dialog directly"

const DeliveryCard: React.FC<{
  delivery:   DriverDelivery;
  index:      number;
  hasSibling: boolean;
  stockCheck: DeliveryStockCheck;
  onAccept:   (id: string) => void;
  onComplete: (delivery: DriverDelivery, stockCheck: DeliveryStockCheck) => void;
}> = ({ delivery, index, hasSibling, stockCheck, onAccept, onComplete }) => {
  const cfg = STATUS_CFG[delivery.status] ?? STATUS_CFG['ASSIGNED'];
  const isCompletable = ACTIVE_STATUSES.includes(delivery.status) && delivery.status !== 'ASSIGNED';

  return (
    <div className="relative rounded-2xl border border-border/60 bg-card overflow-hidden transition-all duration-200">
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px]', cfg.bar)} />

      <div className="pl-4 pr-4 pt-3.5 pb-3.5">
        {/* Top row */}
        <div className="flex items-center gap-2.5 mb-2.5">
          <span className="h-7 w-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 bg-muted text-muted-foreground">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm truncate">{delivery.customer_name}</p>
              {hasSibling && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5 shrink-0">
                  <Users className="h-2.5 w-2.5" />Multi
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">{delivery.order_number}</p>
          </div>
          <StatusPill status={delivery.status} />
        </div>

        {/* Address */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground mb-2.5 bg-muted/30 rounded-xl px-3 py-2">
          <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/60" />
          <span className="line-clamp-1 leading-relaxed">{delivery.full_address}</span>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3 flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />{delivery.scheduled_time_slot}
          </span>
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" />{delivery.items_count} item{delivery.items_count !== 1 ? 's' : ''}
          </span>
          {(delivery.bottles_to_deliver ?? 0) > 0 && (
            <span className="flex items-center gap-1 font-semibold text-blue-600">
              <Truck className="h-3 w-3" />{delivery.bottles_to_deliver} btl
            </span>
          )}
        </div>

        {delivery.driver_notes && (
          <div className="flex items-start gap-2 mb-3 bg-amber-50/70 border border-amber-100 rounded-xl px-3 py-2">
            <AlertCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 italic">{delivery.driver_notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            className="h-10 w-10 shrink-0 rounded-xl border border-border/60 bg-muted/30 flex items-center justify-center hover:bg-muted transition-colors active:scale-90"
            onClick={() => window.open(`tel:${delivery.customer_phone}`)}
            aria-label="Call"
          >
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            className="h-10 w-10 shrink-0 rounded-xl border border-border/60 bg-muted/30 flex items-center justify-center hover:bg-muted transition-colors active:scale-90"
            onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(delivery.full_address)}`)}
            aria-label="Navigate"
          >
            <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {delivery.status === 'ASSIGNED' ? (
            /* ASSIGNED — accept first */
            <button
              className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-colors active:scale-[0.98]"
              onClick={() => onAccept(delivery.id)}
            >
              <CheckCircle className="h-3.5 w-3.5" />Accept
            </button>
          ) : isCompletable ? (
            /* FIX: was "Open → navigate(id)", now opens CompleteDeliveryDialog */
            <button
              className={cn(
                'flex-1 h-10 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]',
                stockCheck.status === 'none'
                  ? 'bg-red-500 hover:bg-red-600'
                  : stockCheck.status === 'partial'
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-emerald-600 hover:bg-emerald-700',
              )}
              onClick={() => onComplete(delivery, stockCheck)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {stockCheck.status === 'none'
                ? 'Complete (Short)'
                : stockCheck.status === 'partial'
                ? 'Complete (Partial)'
                : 'Complete'
              }
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const DriverDashboard: React.FC = () => {
  // ── State ─────────────────────────────────────────────────────────────────
  const [profile,        setProfile]        = useState<DriverProfile | null>(null);
  const [deliveries,     setDeliveries]     = useState<DriverDelivery[]>([]);
  const [bottles,        setBottles]        = useState<DriverBottleStock[]>([]);
  const [consumables,    setConsumables]    = useState<DriverConsumableStock[]>([]);
  const [myRequests,     setMyRequests]     = useState<StockRequest[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [search,         setSearch]         = useState('');
  const [sortKey,        setSortKey]        = useState<SortKey>('status_active');
  const [completeTarget, setCompleteTarget] = useState<CompleteTarget | null>(null);
  const [saleOpen,       setSaleOpen]       = useState(false);
  const [stockReqState,  setStockReqState]  = useState<StockRequestState>({
    open: false, prefillItems: [],
  });

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [profileData, deliveriesData, b, c, myReqs] = await Promise.all([
        deliveryService.getDriverProfile(),
        deliveryService.getDriverDeliveries(),
        driverStoreService.getBottleStock(),
        driverStoreService.getConsumableStock(),
        stockRequestService.getMyRequests().catch(() => [] as StockRequest[]),
      ]);
      setProfile(profileData);
      setDeliveries(deliveriesData.deliveries || []);
      setBottles(b);
      setConsumables(c);
      setMyRequests(myReqs.filter((r: StockRequest) => r.status === 'PENDING'));
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAccept = async (deliveryId: string) => {
    try {
      await deliveryService.acceptDelivery(deliveryId);
      toast.success('Delivery accepted');
      loadData();
    } catch {
      toast.error('Failed to accept delivery');
    }
  };

  const handleDone = useCallback(() => {
    setCompleteTarget(null);
    setSaleOpen(false);
    setStockReqState({ open: false, prefillItems: [] });
    loadData();
  }, [loadData]);

  // ── Derived stock maps ─────────────────────────────────────────────────────

  const bottleMap     = useMemo(() => buildBottleMap(bottles),         [bottles]);
  const consumableMap = useMemo(() => buildConsumableMap(consumables), [consumables]);

  // ── Pending-request lookup sets ────────────────────────────────────────────

  const pendingProductIds = useMemo(
    () => new Set(myRequests.flatMap(r => r.items.map(i => i.product_id))),
    [myRequests],
  );

  // ── Open stock request (with duplicate guard) ──────────────────────────────

  const openStockRequest = useCallback(() => {
    const prefill = buildStockRequestFromDeliveries(deliveries, bottleMap, consumableMap);
    if (prefill.length === 0) {
      toast.success('No stock shortages found — your van is fully loaded!');
      return;
    }
    const filtered = prefill.filter(item => !pendingProductIds.has(item.product_id));
    if (filtered.length === 0) {
      toast.info('All shortages already have a pending request — nothing new to send.');
      return;
    }
    setStockReqState({ open: true, prefillItems: filtered });
  }, [deliveries, bottleMap, consumableMap, pendingProductIds]);

  // ── Open complete dialog for a single delivery ─────────────────────────────
  // Used by both DeliveryCard and NextStopHero

  const handleOpenComplete = useCallback((
    delivery: DriverDelivery,
    stockCheck: DeliveryStockCheck,
  ) => {
    setCompleteTarget({ mode: 'single', delivery, stockCheck });
  }, []);

  // ── Computed values ────────────────────────────────────────────────────────

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
        d.full_address.toLowerCase().includes(q),
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
  const queueDeliveries     = activeDeliveries.filter(d => d.id !== nextDelivery?.id);

  // Pre-compute stockCheck for the nextDelivery hero card
  const nextStockCheck = useMemo(
    () => nextDelivery
      ? checkDeliveryStock(nextDelivery, bottleMap, consumableMap)
      : null,
    [nextDelivery, bottleMap, consumableMap],
  );

  // Dialog derived props
  const completeDialogOpen      = completeTarget !== null;
  const completeInitialDelivery = completeTarget?.mode === 'single' ? completeTarget.delivery : undefined;
  const completeInitialGroup    = completeTarget?.mode === 'bulk'   ? completeTarget.group    : undefined;
  const completeStockCheck      = (completeTarget?.mode === 'single' || completeTarget?.mode === 'bulk')
    ? completeTarget.stockCheck : undefined;

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <DriverLayout title="My Deliveries" subtitle="Loading…">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DriverLayout>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DriverLayout
      title="My Deliveries"
      subtitle={profile?.driver?.name ? `Hi, ${profile.driver.name.split(' ')[0]}` : 'Dashboard'}
    >

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'To Go',  val: remaining,         cls: remaining > 0 ? 'bg-blue-50 text-blue-700 border-blue-200/60' : 'bg-muted/60 text-muted-foreground border-border/60' },
          { label: 'Done',   val: completed,         cls: completed > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'bg-muted/60 text-muted-foreground border-border/60' },
          { label: 'Total',  val: deliveries.length, cls: 'bg-muted/60 text-foreground border-border/60' },
          { label: 'Items',  val: totalItems,        cls: 'bg-muted/60 text-foreground border-border/60' },
        ].map(({ label, val, cls }) => (
          <div key={label} className={cn('rounded-2xl border px-2 py-3 text-center', cls)}>
            <p className="text-xl font-black leading-none tabular-nums">{val}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider opacity-70 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Progress bar ── */}
      {deliveries.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-muted-foreground">Progress</span>
            <span className={cn(
              'text-[11px] font-black',
              rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-muted-foreground',
            )}>
              {completed} / {deliveries.length} · {rate}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-blue-500',
              )}
              style={{ width: `${rate}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      <QuickActionBar
        onComplete={() => {
          if (nextDelivery && nextStockCheck) {
            setCompleteTarget({ mode: 'single', delivery: nextDelivery, stockCheck: nextStockCheck });
          } else {
            setCompleteTarget({ mode: 'list' });
          }
        }}
        onSale={() => setSaleOpen(true)}
        onTopUp={openStockRequest}
      />

      {/* ── Next Stop Hero ── */}
      {nextDelivery && nextStockCheck && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-widest text-primary">
              Your next stop
            </span>
          </div>
          <NextStopHero
            delivery={nextDelivery}
            stockCheck={nextStockCheck}
            onAccept={handleAccept}
            onComplete={handleOpenComplete}
          />
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-3">

        {/* ── Delivery Queue ── */}
        <div className="lg:col-span-2 space-y-3">

          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm flex-1">
              {nextDelivery ? 'Up Next' : 'Delivery Queue'}
            </h2>
            <span className="text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-bold">
              {queueDeliveries.length} queued
            </span>
          </div>

          {/* Search + sort */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                placeholder="Search customer, order, address…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-11 pl-9 pr-9 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              {([
                { k: 'status_active' as SortKey, label: 'Status' },
                { k: 'time_asc'     as SortKey, label: 'Time'   },
              ]).map(s => (
                <button
                  key={s.k}
                  onClick={() => setSortKey(s.k)}
                  className={cn(
                    'text-[11px] font-bold px-3 py-2 rounded-xl border transition-all',
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
              {queueDeliveries.length} result{queueDeliveries.length !== 1 ? 's' : ''} for "{search}"
              <button onClick={() => setSearch('')} className="ml-1.5 text-primary hover:underline">Clear</button>
            </p>
          )}

          {queueDeliveries.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 py-12 text-center">
              <Package className="h-8 w-8 mx-auto mb-2.5 opacity-20" />
              <p className="text-sm font-medium text-muted-foreground">
                {search
                  ? 'No results found'
                  : nextDelivery
                  ? 'No other active deliveries'
                  : 'No active deliveries'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {queueDeliveries.map((delivery, i) => (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                  index={i}
                  hasSibling={(customerCount[delivery.customer_name] ?? 0) > 1}
                  stockCheck={checkDeliveryStock(delivery, bottleMap, consumableMap)}
                  onAccept={handleAccept}
                  onComplete={handleOpenComplete}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Completed sidebar (desktop only) ── */}
        {completedDeliveries.length > 0 && (
          <div className="hidden lg:block">
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden sticky top-20">
              <div className="px-4 py-3 border-b border-border/40 bg-muted/20 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Completed · {completedDeliveries.length}
                </p>
              </div>
              <div className="p-3 space-y-1.5 max-h-[60vh] overflow-y-auto">
                {completedDeliveries.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 border border-emerald-100/80">
                    <span className="text-sm font-medium truncate mr-2">{d.customer_name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{d.scheduled_time_slot}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Completed deliveries on mobile ── */}
      {completedDeliveries.length > 0 && (
        <div className="mt-4 lg:hidden">
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 bg-muted/20 flex items-center gap-2">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Completed · {completedDeliveries.length}
              </p>
            </div>
            <div className="p-2.5 space-y-1">
              {completedDeliveries.map(d => (
                <div key={d.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-sm font-medium truncate">{d.customer_name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{d.scheduled_time_slot}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}
      <CompleteDeliveryDialog
        open={completeDialogOpen}
        onClose={() => setCompleteTarget(null)}
        onDone={handleDone}
        initialDelivery={completeInitialDelivery}
        initialGroup={completeInitialGroup}
        stockCheck={completeStockCheck}
      />

      <DirectSaleDialog
        open={saleOpen}
        onClose={() => setSaleOpen(false)}
        onDone={handleDone}
        bottles={bottles}
        consumables={consumables}
      />

      <StockRequestDialog
        open={stockReqState.open}
        onClose={() => setStockReqState(s => ({ ...s, open: false }))}
        prefillItems={stockReqState.prefillItems}
        deliveryId={stockReqState.deliveryId}
        deliveryOrderNumber={stockReqState.orderNumber}
      />

    </DriverLayout>
  );
};

export default DriverDashboard;
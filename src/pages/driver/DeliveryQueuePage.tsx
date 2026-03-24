/**
 * src/pages/driver/DeliveryQueuePage.tsx
 *
 * Mobile-first delivery queue with stock awareness.
 * Key mobile improvements:
 *  - Larger touch targets throughout
 *  - Horizontal scroll on stats strip removed; 2x2 grid on mobile
 *  - Cards use full-width layout with better info hierarchy
 *  - Action buttons are thumb-friendly (min 44px)
 *  - Search input has native keyboard type
 */

import React, {
  useState, useEffect, useMemo, useCallback,
} from 'react';
import { DriverLayout } from '@/components/layout/DriverLayout';
import {
  MapPin, Clock, Phone, Navigation, Package, Loader2,
  Search, ChevronDown, X, Droplets, Layers, Check,
  AlertCircle, InboxIcon, CheckCircle2, ShoppingCart,
  AlertTriangle, PackageX,
} from 'lucide-react';
import { deliveryService, type DriverDelivery } from '@/api/services/delivery.service';
import {
  driverStoreService,
  type DriverBottleStock,
  type DriverConsumableStock,
} from '@/api/services/driver-store.service';
import { CompleteDeliveryDialog } from '@/components/dialogs/CompleteDeliveryDialog';
import { type CustomerGroup, buildGroups, parseSlot } from '@/lib/deliveryUtils';
import { DirectSaleDialog } from '@/components/dialogs/DirectSaleDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AcceptDeclineButtons } from '@/pages/driver/AcceptDeclineButtons';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = [
  'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS',
];

const STATUS_CFG: Record<string, {
  label: string; dot: string; pill: string; stripe: string;
}> = {
  ASSIGNED:    { label: 'New',         dot: 'bg-amber-400',   pill: 'bg-amber-50   text-amber-700   border-amber-200',   stripe: 'bg-amber-400'   },
  ACCEPTED:    { label: 'Accepted',    dot: 'bg-sky-500',     pill: 'bg-sky-50     text-sky-700     border-sky-200',     stripe: 'bg-sky-500'     },
  PICKED_UP:   { label: 'Picked Up',   dot: 'bg-violet-500',  pill: 'bg-violet-50  text-violet-700  border-violet-200',  stripe: 'bg-violet-500'  },
  EN_ROUTE:    { label: 'En Route',    dot: 'bg-blue-500',    pill: 'bg-blue-50    text-blue-700    border-blue-200',    stripe: 'bg-blue-500'    },
  ARRIVED:     { label: 'Arrived',     dot: 'bg-teal-500',    pill: 'bg-teal-50    text-teal-700    border-teal-200',    stripe: 'bg-teal-500'    },
  IN_PROGRESS: { label: 'In Progress', dot: 'bg-indigo-500',  pill: 'bg-indigo-50  text-indigo-700  border-indigo-200',  stripe: 'bg-indigo-500'  },
  COMPLETED:   { label: 'Completed',   dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', stripe: 'bg-emerald-500' },
  FAILED:      { label: 'Failed',      dot: 'bg-red-400',     pill: 'bg-red-50     text-red-700     border-red-200',     stripe: 'bg-red-400'     },
};

// ─────────────────────────────────────────────────────────────────────────────
// Stock helpers
// ─────────────────────────────────────────────────────────────────────────────

type DriverDeliveryWithItems = DriverDelivery & {
  order_items?: Array<{
    id: string;
    product_id: string;
    product_name: string;
    product_unit: string;
    is_returnable: boolean;
    quantity: number;
  }>;
};

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
    allFull      ? 'full' :
    anyAvailable ? 'partial' :
    'none';

  return { status, itemChecks };
}

function buildBottleMap(bottles: DriverBottleStock[]): Map<string, number> {
  return new Map(bottles.map(b => [b.product_id, b.balance.full]));
}
function buildConsumableMap(consumables: DriverConsumableStock[]): Map<string, number> {
  return new Map(consumables.map(c => [c.product_id, c.balance.in_stock]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Stock badge
// ─────────────────────────────────────────────────────────────────────────────

const StockBadge: React.FC<{ check: DeliveryStockCheck }> = ({ check }) => {
  if (check.status === 'unknown' || check.status === 'full') return null;
  const missingItems = check.itemChecks.filter(c => c.available_qty < c.ordered_qty);

  if (check.status === 'none') {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-xl dark:bg-red-950/30 dark:border-red-900 mt-2">
        <PackageX className="h-3.5 w-3.5 text-red-500 shrink-0" />
        <p className="text-[11px] font-bold text-red-700 dark:text-red-300">
          Stock not on van — request top-up
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-950/30 dark:border-amber-900 mt-2">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Partial stock only</p>
        <div className="mt-0.5 space-y-0.5">
          {missingItems.map(item => (
            <p key={item.product_id} className="text-[10px] text-amber-600 dark:text-amber-400">
              {item.product_name}: {item.available_qty}/{item.ordered_qty} available
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Complete button (stock-aware)
// ─────────────────────────────────────────────────────────────────────────────

const CompleteButton: React.FC<{
  check:      DeliveryStockCheck;
  onComplete: () => void;
  size?:      'sm' | 'md';
}> = ({ check, onComplete, size = 'md' }) => {
  const h    = size === 'sm' ? 'h-9 px-3.5 text-[12px]' : 'h-10 px-4 text-[13px]';
  const icon = 'h-3.5 w-3.5';

  if (check.status === 'none') {
    return (
      <div className={cn(
        'flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-red-500',
        'dark:bg-red-950/30 dark:border-red-900 dark:text-red-400',
        h,
      )}>
        <PackageX className={icon} />
        No stock
      </div>
    );
  }

  if (check.status === 'partial') {
    return (
      <button
        onClick={onComplete}
        className={cn(
          'flex items-center gap-1.5 rounded-xl font-bold text-white transition-all active:scale-[0.97]',
          'bg-amber-500 hover:bg-amber-600 border border-amber-600 shadow-sm shadow-amber-500/20',
          h,
        )}
      >
        <AlertTriangle className={icon} />
        Complete Available
      </button>
    );
  }

  return (
    <button
      onClick={onComplete}
      className={cn(
        'flex items-center gap-1.5 rounded-xl font-bold text-white transition-all active:scale-[0.97]',
        'bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 shadow-sm shadow-emerald-500/20',
        h,
      )}
    >
      <Check className={icon} />
      Complete
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isActive(s: string) { return ACTIVE_STATUSES.includes(s); }

function buildPageGroups(deliveries: DriverDelivery[]): CustomerGroup[] {
  return buildGroups(deliveries).map(g => ({
    ...g,
    allDone: g.deliveries.every(d => !isActive(d.status)),
  })).sort(
    (a, b) => parseSlot(a.earliestSlot) - parseSlot(b.earliestSlot) || a.name.localeCompare(b.name),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status pill
// ─────────────────────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const c = STATUS_CFG[status];
  if (!c) return <span className="text-[10px] border rounded-full px-2 py-0.5">{status}</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 border rounded-full text-[10px] font-bold px-2.5 py-0.5 shrink-0', c.pill)}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', c.dot)} />
      {c.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Delivery row
// ─────────────────────────────────────────────────────────────────────────────

const DeliveryRow: React.FC<{
  delivery:   DriverDelivery;
  isNext:     boolean;
  stockCheck: DeliveryStockCheck;
  onComplete: (d: DriverDelivery) => void;
  onReload:   () => void;
}> = ({ delivery, isNext, stockCheck, onComplete, onReload }) => {
  const c = STATUS_CFG[delivery.status] ?? {
    stripe: 'bg-border', dot: 'bg-muted-foreground',
    pill: 'bg-muted text-muted-foreground border-border', label: delivery.status,
  };
  const active = isActive(delivery.status);

  return (
    <div className={cn('px-4 py-3', isNext && 'bg-primary/[0.02]')}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('h-2 w-2 rounded-full shrink-0', c.stripe)} />
          <p className="font-mono text-xs font-bold text-foreground truncate">{delivery.order_number}</p>
          {isNext && (
            <span className="text-[9px] font-black bg-primary/10 text-primary border border-primary/20 rounded-full px-1.5 py-0.5 shrink-0">
              NEXT
            </span>
          )}
        </div>
        <StatusPill status={delivery.status} />
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2 leading-relaxed">
        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/60" />{delivery.full_address}
      </p>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2.5 flex-wrap">
        {delivery.scheduled_time_slot && (
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{delivery.scheduled_time_slot}</span>
        )}
        <span className="flex items-center gap-1">
          <Package className="h-3 w-3" />{delivery.items_count} item{delivery.items_count !== 1 ? 's' : ''}
        </span>
        {(delivery.bottles_to_deliver ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-blue-600 font-semibold">
            <Droplets className="h-3 w-3" />{delivery.bottles_to_deliver} btl
          </span>
        )}
      </div>

      {delivery.driver_notes && (
        <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-2.5">
          <AlertCircle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 italic">{delivery.driver_notes}</p>
        </div>
      )}

      {active && <StockBadge check={stockCheck} />}

      {/* Action row — good touch targets */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => window.open(`tel:${delivery.customer_phone}`)}
          className="h-10 px-3.5 flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 text-[12px] font-semibold hover:bg-muted transition-colors active:scale-[0.97]"
        >
          <Phone className="h-3.5 w-3.5" />Call
        </button>
        <button
          onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(delivery.full_address)}`)}
          className="h-10 px-3.5 flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 text-[12px] font-semibold hover:bg-muted transition-colors active:scale-[0.97]"
        >
          <Navigation className="h-3.5 w-3.5" />Navigate
        </button>
        {active && delivery.status === 'ASSIGNED' ? (
          <AcceptDeclineButtons
            deliveryId={delivery.id}
            orderNumber={delivery.order_number}
            size="sm"
            onAccepted={onReload}
            onDeclined={onReload}
          />
        ) : active ? (
          <CompleteButton
            check={stockCheck}
            onComplete={() => onComplete(delivery)}
            size="sm"
          />
        ) : null}
      </div>

      {active && stockCheck.status === 'partial' && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 italic">
          Only items currently on your van will be recorded as delivered.
        </p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate group stock
// ─────────────────────────────────────────────────────────────────────────────

function aggregateGroupStock(
  group: CustomerGroup,
  bottleMap: Map<string, number>,
  consumableMap: Map<string, number>,
): DeliveryStockCheck {
  const activeDeliveries = group.deliveries.filter(d => isActive(d.status));
  if (activeDeliveries.length === 0) return { status: 'full', itemChecks: [] };

  const checks = activeDeliveries.map(d => checkDeliveryStock(d, bottleMap, consumableMap));
  if (checks.some(c => c.status === 'unknown')) return { status: 'unknown', itemChecks: [] };

  const merged = new Map<string, ItemStockStatus>();
  for (const chk of checks) {
    for (const item of chk.itemChecks) {
      const existing = merged.get(item.product_id);
      if (existing) {
        merged.set(item.product_id, {
          ...existing,
          ordered_qty: existing.ordered_qty + item.ordered_qty,
          available_qty: item.available_qty,
        });
      } else {
        merged.set(item.product_id, { ...item });
      }
    }
  }

  const itemChecks = Array.from(merged.values());
  const anyAvailable = itemChecks.some(c => c.available_qty > 0);
  const allFull      = itemChecks.every(c => c.available_qty >= c.ordered_qty);
  const status: DeliveryStockStatus = allFull ? 'full' : anyAvailable ? 'partial' : 'none';

  return { status, itemChecks };
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer group card
// ─────────────────────────────────────────────────────────────────────────────

const CustomerGroupCard: React.FC<{
  group:         CustomerGroup;
  nextId:        string | undefined;
  bottleMap:     Map<string, number>;
  consumableMap: Map<string, number>;
  onSingle:      (d: DriverDelivery) => void;
  onBulk:        (g: CustomerGroup)  => void;
  onReload:      () => void;
}> = ({ group, nextId, bottleMap, consumableMap, onSingle, onBulk, onReload }) => {
  const [expanded, setExpanded] = useState(false);
  const single   = group.deliveries.length === 1;
  const d0       = group.deliveries[0];
  const allDone  = group.allDone ?? false;

  const deliveryStockChecks = useMemo(() => {
    const map = new Map<string, DeliveryStockCheck>();
    for (const d of group.deliveries) {
      map.set(d.id, checkDeliveryStock(d, bottleMap, consumableMap));
    }
    return map;
  }, [group.deliveries, bottleMap, consumableMap]);

  const groupStockCheck = useMemo(
    () => aggregateGroupStock(group, bottleMap, consumableMap),
    [group, bottleMap, consumableMap],
  );

  const singleCheck = single
    ? (deliveryStockChecks.get(d0.id) ?? { status: 'unknown', itemChecks: [] })
    : groupStockCheck;

  const accentColor =
    allDone                          ? 'bg-emerald-500' :
    singleCheck.status === 'none'    ? 'bg-red-400'     :
    singleCheck.status === 'partial' ? 'bg-amber-400'   :
    single                           ? 'bg-sky-500'     : 'bg-primary';

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all',
      allDone
        ? 'border-border/40 bg-card opacity-70'
        : singleCheck.status === 'none'
          ? 'border-red-200 dark:border-red-900/50 bg-card'
          : singleCheck.status === 'partial'
            ? 'border-amber-200 dark:border-amber-900/50 bg-card'
            : expanded && !single
              ? 'border-primary/30 bg-card shadow-sm'
              : 'border-border/60 bg-card',
    )}>
      <div className={cn('h-[3px] w-full', accentColor)} />

      {/* Card header */}
      <div className="flex items-center gap-0 px-4 py-3.5">
        <button
          onClick={() => {
            if (single && !allDone) { onSingle(d0); return; }
            if (!single) setExpanded(e => !e);
          }}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{group.name}</p>
            {allDone && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 rounded-full px-2 py-0.5">
                <CheckCircle2 className="h-2.5 w-2.5" />Done
              </span>
            )}
            {!allDone && singleCheck.status === 'none' && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20 rounded-full px-2 py-0.5">
                <PackageX className="h-2.5 w-2.5" />No stock
              </span>
            )}
            {!allDone && singleCheck.status === 'partial' && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-full px-2 py-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />Partial
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 mt-1 flex-wrap">
            {group.earliestSlot && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />{group.earliestSlot}
              </span>
            )}
            {group.totalBottles > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                <Droplets className="h-3 w-3 shrink-0" />{group.totalBottles} btl
              </span>
            )}
            {!single && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Layers className="h-3 w-3 shrink-0" />{group.deliveries.length} stops
              </span>
            )}
            {single && d0.full_address && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[180px]">
                <MapPin className="h-3 w-3 shrink-0" />{d0.full_address}
              </span>
            )}
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {!allDone && single && d0.status === 'ASSIGNED' ? (
            <AcceptDeclineButtons
              deliveryId={d0.id}
              orderNumber={d0.order_number}
              onAccepted={onReload}
              onDeclined={onReload}
            />
          ) : !allDone ? (
            <CompleteButton
              check={single ? singleCheck : groupStockCheck}
              onComplete={() => {
                if (single) { onSingle(d0); } else { onBulk(group); }
              }}
            />
          ) : null}
          {!single && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors shrink-0"
            >
              <ChevronDown className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                expanded && 'rotate-180',
              )} />
            </button>
          )}
        </div>
      </div>

      {!allDone && single && singleCheck.status === 'partial' && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 px-4 pb-2.5 -mt-1 italic">
          Only items on your van will be recorded as delivered.
        </p>
      )}

      {!single && expanded && (
        <div className="border-t border-border/30 divide-y divide-border/20">
          {group.deliveries.map(d => (
            <DeliveryRow
              key={d.id}
              delivery={d}
              isNext={nextId === d.id}
              stockCheck={deliveryStockChecks.get(d.id) ?? { status: 'unknown', itemChecks: [] }}
              onComplete={onSingle}
              onReload={onReload}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Quick Action Bar
// ─────────────────────────────────────────────────────────────────────────────

const QuickActionBar: React.FC<{
  onComplete: () => void;
  onSale:     () => void;
}> = ({ onComplete, onSale }) => (
  <div className="grid grid-cols-2 gap-3 mb-5">
    <button
      onClick={onComplete}
      className={cn(
        'flex items-center justify-center gap-2 h-12 rounded-2xl',
        'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97]',
        'text-white text-[13px] font-bold border border-emerald-700',
        'shadow-sm shadow-emerald-500/20 transition-all',
      )}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      Complete Delivery
    </button>
    <button
      onClick={onSale}
      className={cn(
        'flex items-center justify-center gap-2 h-12 rounded-2xl',
        'bg-amber-500 hover:bg-amber-600 active:scale-[0.97]',
        'text-white text-[13px] font-bold border border-amber-600',
        'shadow-sm shadow-amber-500/20 transition-all',
      )}
    >
      <ShoppingCart className="h-4 w-4 shrink-0" />
      Direct Sale
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Dialog state type
// ─────────────────────────────────────────────────────────────────────────────

type CompleteTarget =
  | { mode: 'list' }
  | { mode: 'single'; delivery: DriverDelivery; stockCheck: DeliveryStockCheck }
  | { mode: 'bulk';   group: CustomerGroup;     stockCheck: DeliveryStockCheck };

type SortKey = 'time' | 'name';
type TabKey  = 'active' | 'done';

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export const DeliveryQueuePage: React.FC = () => {
  const [deliveries,  setDeliveries]  = useState<DriverDelivery[]>([]);
  const [bottles,     setBottles]     = useState<DriverBottleStock[]>([]);
  const [consumables, setConsumables] = useState<DriverConsumableStock[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<TabKey>('active');
  const [search,      setSearch]      = useState('');
  const [sortKey,     setSortKey]     = useState<SortKey>('time');
  const [saleOpen,    setSaleOpen]    = useState(false);
  const [completeTarget, setCompleteTarget] = useState<CompleteTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, b, c] = await Promise.all([
        deliveryService.getDriverDeliveries(),
        driverStoreService.getBottleStock(),
        driverStoreService.getConsumableStock(),
      ]);
      setDeliveries(data.deliveries || []);
      setBottles(b);
      setConsumables(c);
    } catch {
      toast.error('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDone = useCallback(() => {
    setCompleteTarget(null);
    setSaleOpen(false);
    load();
  }, [load]);

  const bottleMap     = useMemo(() => buildBottleMap(bottles),      [bottles]);
  const consumableMap = useMemo(() => buildConsumableMap(consumables), [consumables]);

  const activeCount    = deliveries.filter(d => isActive(d.status)).length;
  const completedCount = deliveries.filter(d => d.status === 'COMPLETED').length;
  const failedCount    = deliveries.filter(d => d.status === 'FAILED').length;
  const totalItems     = deliveries.reduce((s, d) => s + (d.items_count || 0), 0);
  const rate           = deliveries.length ? Math.round((completedCount / deliveries.length) * 100) : 0;

  const groups = useMemo(() => {
    let list = deliveries.filter(d =>
      tab === 'active' ? isActive(d.status) : !isActive(d.status),
    );
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.customer_name.toLowerCase().includes(q) ||
        d.order_number.toLowerCase().includes(q) ||
        (d.full_address || '').toLowerCase().includes(q),
      );
    }
    const gs = buildPageGroups(list);
    if (sortKey === 'name') return [...gs].sort((a, b) => a.name.localeCompare(b.name));
    return gs;
  }, [deliveries, tab, search, sortKey]);

  const nextDelivery = deliveries.find(d => d.status === 'ACCEPTED');
  const totalGroups  = groups.length;
  const totalShown   = groups.reduce((s, g) => s + g.deliveries.length, 0);

  const completeDialogOpen      = completeTarget !== null;
  const completeInitialDelivery = completeTarget?.mode === 'single' ? completeTarget.delivery   : undefined;
  const completeInitialGroup    = completeTarget?.mode === 'bulk'   ? completeTarget.group       : undefined;
  const completeStockCheck      = (completeTarget?.mode === 'single' || completeTarget?.mode === 'bulk')
    ? completeTarget.stockCheck : undefined;

  if (loading) return (
    <DriverLayout title="Deliveries" subtitle="Loading…">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </DriverLayout>
  );

  return (
    <DriverLayout title="Deliveries" subtitle="Your route for today">

      {/* Stats — 2x2 grid on small screens, 4 cols on md+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        {([
          { label: 'Active', val: activeCount,    cls: 'bg-blue-50    text-blue-700    border-blue-200/60    dark:bg-blue-950/30    dark:text-blue-300    dark:border-blue-900'    },
          { label: 'Done',   val: completedCount, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900' },
          { label: 'Failed', val: failedCount,    cls: 'bg-red-50     text-red-700     border-red-200/60     dark:bg-red-950/30     dark:text-red-300     dark:border-red-900'     },
          { label: 'Items',  val: totalItems,     cls: 'bg-muted/60   text-foreground  border-border/60'                                                                          },
        ] as const).map(({ label, val, cls }) => (
          <div key={label} className={cn('rounded-2xl border px-3 py-3.5 text-center', cls)}>
            <p className="text-2xl font-black leading-none tabular-nums">{val}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {deliveries.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground">Today's progress</span>
            <span className={cn(
              'text-sm font-black tabular-nums',
              rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-foreground',
            )}>{rate}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-blue-500')}
              style={{ width: `${rate}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">{completedCount} of {deliveries.length} delivered</p>
        </div>
      )}

      {/* Quick actions */}
      <QuickActionBar
        onComplete={() => setCompleteTarget({ mode: 'list' })}
        onSale={() => setSaleOpen(true)}
      />

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 bg-muted/40 p-1 rounded-2xl">
        {([
          { key: 'active' as TabKey, label: 'Active',    count: activeCount },
          { key: 'done'   as TabKey, label: 'Completed', count: completedCount + failedCount },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all',
              tab === t.key
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-black min-w-[18px] text-center',
              tab === t.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            )}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search + sort */}
      <div className="space-y-2.5 mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            autoComplete="off"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer, order, address…"
            className="w-full h-12 pl-10 pr-10 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-[11px] text-muted-foreground font-medium shrink-0">Sort:</span>
          {([
            { key: 'time' as SortKey, label: 'By Time' },
            { key: 'name' as SortKey, label: 'Name A–Z' },
          ]).map(s => (
            <button
              key={s.key}
              onClick={() => setSortKey(s.key)}
              className={cn(
                'text-[11px] font-bold px-3.5 py-2 rounded-full border transition-all',
                sortKey === s.key
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-muted/40 text-muted-foreground border-border/50',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          <strong>{totalGroups}</strong> customer{totalGroups !== 1 ? 's' : ''}
          {totalShown !== totalGroups && <span className="ml-1">· <strong>{totalShown}</strong> deliveries</span>}
          {search && <span className="ml-1">for "<strong>{search}</strong>"</span>}
        </p>
        {search && (
          <button onClick={() => setSearch('')} className="text-[11px] text-primary underline underline-offset-2">Clear</button>
        )}
      </div>

      {/* Group list */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <InboxIcon className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <p className="font-bold text-base mb-1">No deliveries found</p>
          <p className="text-sm text-muted-foreground">
            {search ? 'Try a different search term.' : `No ${tab === 'active' ? 'active' : 'completed'} deliveries.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {groups.map(group => (
            <CustomerGroupCard
              key={group.name}
              group={group}
              nextId={nextDelivery?.id}
              bottleMap={bottleMap}
              consumableMap={consumableMap}
              onSingle={d => {
                const check = checkDeliveryStock(d, bottleMap, consumableMap);
                setCompleteTarget({ mode: 'single', delivery: d, stockCheck: check });
              }}
              onBulk={g => {
                const check = aggregateGroupStock(g, bottleMap, consumableMap);
                setCompleteTarget({ mode: 'bulk', group: g, stockCheck: check });
              }}
              onReload={load}
            />
          ))}
          <p className="text-center text-[11px] text-muted-foreground pt-2 pb-2">
            {totalGroups} customer{totalGroups !== 1 ? 's' : ''} · {totalShown} deliver{totalShown !== 1 ? 'ies' : 'y'}
          </p>
        </div>
      )}

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
    </DriverLayout>
  );
};

export default DeliveryQueuePage;
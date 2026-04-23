import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DriverLayout } from '@/components/layout/DriverLayout';
import {
  MapPin, Phone, Navigation,
  CheckCircle, XCircle, Loader2,
  AlertCircle,
  Droplets, X, Package,
  AlertTriangle, PackageX, PackagePlus, CheckCircle2,
} from 'lucide-react';
import { deliveryService, type DriverDelivery, type DriverDeliveryDetail } from '@/api/services/delivery.service';
import {
  driverStoreService,
  type DriverBottleStock,
  type DriverConsumableStock,
} from '@/api/services/driver-store.service';
import { CompleteDeliveryDialog } from '@/components/dialogs/CompleteDeliveryDialog';
import { StockRequestDialog, type StockRequestItem } from '@/components/dialogs/StockRequestDialog';
import {
  stockRequestService,
  type StockRequest,
} from '@/api/services/stock-request.service';
import { AcceptDeclineButtons } from '@/pages/driver/AcceptDeclineButtons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FAIL_REASONS: Array<{ value: string; label: string }> = [
  { value: 'CUSTOMER_UNAVAILABLE', label: 'Customer not available / not home' },
  { value: 'WRONG_ADDRESS',        label: 'Incorrect or wrong address'         },
  { value: 'CUSTOMER_CANCELLED',   label: 'Customer cancelled the delivery'    },
  { value: 'VEHICLE_BREAKDOWN',    label: 'Vehicle breakdown'                  },
  { value: 'WEATHER',              label: 'Bad weather conditions'             },
  { value: 'TRAFFIC',              label: 'Heavy traffic / road blocked'       },
  { value: 'OTHER',                label: 'Other (see notes)'                  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Stock types & helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ItemStockStatus {
  product_id:    string;
  product_name:  string;
  product_unit:  string;
  is_returnable: boolean;
  ordered_qty:   number;
  available_qty: number;
}

type DeliveryStockStatus = 'full' | 'partial' | 'none' | 'unknown';

interface DeliveryStockCheck {
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

function buildStockRequestFromDelivery(
  delivery: DriverDelivery,
  bottleMap: Map<string, number>,
  consumableMap: Map<string, number>,
): StockRequestItem[] {
  const check = checkDeliveryStock(delivery, bottleMap, consumableMap);
  if (check.status === 'unknown' || check.status === 'full') return [];

  return check.itemChecks
    .filter(item => item.available_qty < item.ordered_qty)
    .map(item => ({
      product_id:         item.product_id,
      product_name:       item.product_name,
      product_type:       item.is_returnable ? 'bottle' : 'consumable',
      current_qty:        item.available_qty,
      needed_qty:         item.ordered_qty,
      quantity_requested: Math.max(1, item.ordered_qty - item.available_qty),
    }));
}

function isDeliveryAlreadyRequested(
  delivery: DriverDelivery,
  check: DeliveryStockCheck,
  pendingDeliveryIds: Set<string>,
  pendingProductIds: Set<string>,
): boolean {
  if (pendingDeliveryIds.has(delivery.id)) return true;
  if (check.status === 'none' || check.status === 'partial') {
    const shortageIds = check.itemChecks
      .filter(c => c.available_qty < c.ordered_qty)
      .map(c => c.product_id);
    if (shortageIds.length > 0 && shortageIds.every(id => pendingProductIds.has(id))) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stock banner
// ─────────────────────────────────────────────────────────────────────────────

const StockBanner: React.FC<{
  check:            DeliveryStockCheck;
  alreadyRequested: boolean;
  onRequest:        () => void;
}> = ({ check, alreadyRequested, onRequest }) => {
  if (check.status === 'unknown' || check.status === 'full') return null;

  const missingItems = check.itemChecks.filter(c => c.available_qty < c.ordered_qty);

  const RequestedBadge = (
    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" />Stock requested
    </span>
  );

  if (check.status === 'none') return (
    <div className="flex items-start justify-between gap-3 px-4 py-4 bg-red-50 border-2 border-red-200 rounded-2xl dark:bg-red-950/30 dark:border-red-900">
      <div className="flex items-start gap-2.5 min-w-0">
        <PackageX className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-700 dark:text-red-300">Items not on your van</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
            None of the required stock is loaded — this will be a short delivery.
          </p>
          <div className="mt-1.5 space-y-0.5">
            {missingItems.map(item => (
              <p key={item.product_id} className="text-[11px] text-red-600 dark:text-red-400">
                {item.product_name}: 0 / {item.ordered_qty} available
              </p>
            ))}
          </div>
        </div>
      </div>
      {alreadyRequested ? RequestedBadge : (
        <button
          onClick={onRequest}
          className="shrink-0 h-9 px-3.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 active:scale-[0.97] transition-all"
        >
          <PackagePlus className="h-3.5 w-3.5 inline mr-1" />Request
        </button>
      )}
    </div>
  );

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-4 bg-amber-50 border-2 border-amber-200 rounded-2xl dark:bg-amber-950/30 dark:border-amber-900">
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Partial stock on van</p>
          <p className="text-xs text-amber-600/80 dark:text-amber-400 mt-0.5">
            Only what's loaded will be recorded as delivered.
          </p>
          <div className="mt-1.5 space-y-0.5">
            {missingItems.map(item => (
              <p key={item.product_id} className="text-[11px] text-amber-700 dark:text-amber-300">
                {item.product_name}: {item.available_qty} / {item.ordered_qty} available
              </p>
            ))}
          </div>
        </div>
      </div>
      {alreadyRequested ? RequestedBadge : (
        <button
          onClick={onRequest}
          className="shrink-0 h-9 px-3.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 active:scale-[0.97] transition-all"
        >
          <PackagePlus className="h-3.5 w-3.5 inline mr-1" />Request
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Failure modal
// ─────────────────────────────────────────────────────────────────────────────

const FailureModal: React.FC<{
  onClose:  () => void;
  onSubmit: (reason: string, notes: string) => Promise<void>;
}> = ({ onClose, onSubmit }) => {
  const [reason,     setReason]     = useState('');
  const [notes,      setNotes]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) { toast.error('Select a reason'); return; }
    setSubmitting(true);
    await onSubmit(reason, notes);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 z-10 overflow-hidden">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base">Report Failed Delivery</h3>
            <button
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            This will mark the delivery as failed and cannot be undone.
          </p>
          <div className="space-y-2">
            {FAIL_REASONS.map(r => (
              <button
                key={r.value}
                onClick={() => setReason(r.value)}
                className={cn(
                  'w-full text-left text-sm font-semibold px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-[0.98]',
                  reason === r.value
                    ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300'
                    : 'bg-muted/30 border-border/50 text-foreground hover:border-border',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Additional notes (optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional context…"
              className="w-full rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="w-full rounded-2xl bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-40 transition-colors active:scale-[0.98]"
            style={{ height: '52px' }}
          >
            {submitting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <XCircle className="h-4 w-4" />
            }
            Confirm Failed Delivery
          </button>
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export const DeliveryDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id }   = useParams<{ id: string }>();

  // ── Core delivery state ──────────────────────────────────────────────────
  const [delivery,     setDelivery]     = useState<DriverDeliveryDetail | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [showFail,     setShowFail]     = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  // ── Van stock state ──────────────────────────────────────────────────────
  const [bottles,     setBottles]     = useState<DriverBottleStock[]>([]);
  const [consumables, setConsumables] = useState<DriverConsumableStock[]>([]);
  const [myRequests,  setMyRequests]  = useState<StockRequest[]>([]);

  // ── Stock request dialog ─────────────────────────────────────────────────
  const [stockReqOpen,     setStockReqOpen]     = useState(false);
  const [stockReqItems,    setStockReqItems]    = useState<StockRequestItem[]>([]);
  const [stockReqDelivery, setStockReqDelivery] = useState<string | undefined>();
  const [stockReqOrder,    setStockReqOrder]    = useState<string | undefined>();

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async (deliveryId: string) => {
    setLoading(true);
    try {
      const [data, b, c, myReqs] = await Promise.all([
        deliveryService.getDriverDeliveryDetail(deliveryId),
        driverStoreService.getBottleStock(),
        driverStoreService.getConsumableStock(),
        stockRequestService.getMyRequests().catch(() => [] as StockRequest[]),
      ]);
      setDelivery(data);
      setBottles(b);
      setConsumables(c);
      setMyRequests(myReqs.filter((r: StockRequest) => r.status === 'PENDING'));
    } catch {
      toast.error('Failed to load delivery details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (id) load(id); }, [id, load]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleFailed = async (reason: string, notes: string) => {
    if (!id) return;
    try {
      await deliveryService.updateStatus(id, 'FAILED', {
        failure_reason: reason,
        failure_notes:  notes,
      });
      toast.success('Delivery marked as failed');
      navigate('/driver/deliveries');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDone = useCallback(() => {
    setCompleteOpen(false);
    setStockReqOpen(false);
    if (id) load(id);
  }, [id, load]);

  // ── Derived stock maps ────────────────────────────────────────────────────

  const bottleMap     = useMemo(() => buildBottleMap(bottles),         [bottles]);
  const consumableMap = useMemo(() => buildConsumableMap(consumables), [consumables]);

  const pendingDeliveryIds = useMemo(
    () => new Set(myRequests.filter(r => r.delivery_id).map(r => r.delivery_id!)),
    [myRequests],
  );
  const pendingProductIds = useMemo(
    () => new Set(myRequests.flatMap(r => r.items.map(i => i.product_id))),
    [myRequests],
  );

  const stockCheck = useMemo(() => {
    if (!delivery) return { status: 'unknown' as DeliveryStockStatus, itemChecks: [] };
    return checkDeliveryStock(delivery as unknown as DriverDelivery, bottleMap, consumableMap);
  }, [delivery, bottleMap, consumableMap]);

  const alreadyRequested = useMemo(() => {
    if (!delivery) return false;
    return isDeliveryAlreadyRequested(
      delivery as unknown as DriverDelivery,
      stockCheck,
      pendingDeliveryIds,
      pendingProductIds,
    );
  }, [delivery, stockCheck, pendingDeliveryIds, pendingProductIds]);

  const openStockRequest = useCallback(() => {
    if (!delivery) return;
    const items = buildStockRequestFromDelivery(
      delivery as unknown as DriverDelivery,
      bottleMap,
      consumableMap,
    );
    if (items.length === 0) {
      toast.success('Van is fully stocked for this delivery!');
      return;
    }
    const filtered = alreadyRequested
      ? items
      : items.filter(item => !pendingProductIds.has(item.product_id));

    if (filtered.length === 0) {
      toast.info('All shortages already have a pending request.');
      return;
    }
    setStockReqItems(filtered);
    setStockReqDelivery(delivery.id);
    setStockReqOrder(delivery.order?.order_number);
    setStockReqOpen(true);
  }, [delivery, bottleMap, consumableMap, alreadyRequested, pendingProductIds]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const isAssigned   = delivery?.status === 'ASSIGNED';
  const isTerminal   = ['COMPLETED', 'FAILED'].includes(delivery?.status ?? '');
  const isInProgress = !isAssigned && !isTerminal;
  const canComplete  = isInProgress;

  // ── Loading / not found ───────────────────────────────────────────────────

  if (loading) return (
    <DriverLayout title="Delivery" subtitle="Loading…" showBackButton onBack={() => navigate('/driver/deliveries')}>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </DriverLayout>
  );

  if (!delivery) return (
    <DriverLayout title="Delivery" subtitle="Not found" showBackButton onBack={() => navigate('/driver/deliveries')}>
      <div className="text-center py-16 border border-dashed rounded-2xl">
        <p className="text-muted-foreground mb-4">Delivery not found</p>
        <button onClick={() => navigate('/driver/deliveries')} className="text-sm text-primary underline">
          Back to queue
        </button>
      </div>
    </DriverLayout>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <DriverLayout
        title={delivery.order?.order_number ?? 'Delivery'}
        subtitle={delivery.customer?.name ?? ''}
        showBackButton
        onBack={() => navigate('/driver/deliveries')}
      >
        <div className="space-y-3 pb-4">

          {/* ── ASSIGNED banner ────────────────────────────────────────────── */}
          {isAssigned && (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <p className="font-bold text-sm text-amber-800 dark:text-amber-300">
                  New Delivery Assigned
                </p>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Accept this delivery to begin the route, or decline to return it to the queue.
              </p>
              <AcceptDeclineButtons
                deliveryId={delivery.id}
                orderNumber={delivery.order?.order_number ?? ''}
                size="md"
                onAccepted={() => load(delivery.id)}
                onDeclined={() => navigate('/driver/deliveries')}
              />
            </div>
          )}

          {/* ── Terminal banners ───────────────────────────────────────────── */}
          {delivery.status === 'COMPLETED' && (
            <div className="flex items-center gap-3 px-4 py-4 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl">
              <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Delivered ✓</p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400 mt-0.5">
                  This delivery was completed successfully.
                </p>
              </div>
            </div>
          )}
          {delivery.status === 'FAILED' && (
            <div className="flex items-center gap-3 px-4 py-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
              <XCircle className="h-6 w-6 text-red-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-800 dark:text-red-300">Delivery Failed</p>
                <p className="text-xs text-red-700/80 dark:text-red-400 mt-0.5">
                  This delivery was marked as failed.
                </p>
              </div>
            </div>
          )}

          {/* ── Stock banner ───────────────────────────────────────────────── */}
          {isInProgress && (
            <StockBanner
              check={stockCheck}
              alreadyRequested={alreadyRequested}
              onRequest={openStockRequest}
            />
          )}

          {/* ── Complete Delivery CTA ──────────────────────────────────────── */}
          {canComplete && (
            <button
              onClick={() => setCompleteOpen(true)}
              className={cn(
                'w-full h-14 rounded-2xl flex items-center justify-center gap-3 font-bold text-base',
                'text-white shadow-md transition-all active:scale-[0.98]',
                stockCheck.status === 'none'
                  ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20 border border-red-600'
                  : stockCheck.status === 'partial'
                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 border border-amber-600'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 border border-emerald-700',
              )}
            >
              <CheckCircle className="h-5 w-5" />
              {stockCheck.status === 'none'
                ? 'Complete (Short Delivery)'
                : stockCheck.status === 'partial'
                ? 'Complete (Partial Stock)'
                : 'Complete Delivery'
              }
            </button>
          )}

          {/* ── Customer + address ─────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Customer
            </h3>
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-black text-base">
                {delivery.customer?.name?.trim()[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{delivery.customer?.name}</p>
                {delivery.customer?.phone && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {delivery.customer.phone}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-muted/40 rounded-xl px-3.5 py-3">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span className="leading-relaxed text-xs">{delivery.address?.full_address}</span>
            </div>

            {delivery.address?.instructions && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  {delivery.address.instructions}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => window.open(`tel:${delivery.customer?.phone}`)}
                className="h-12 flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-muted/30 text-sm font-bold hover:bg-muted transition-colors active:scale-[0.97]"
              >
                <Phone className="h-4 w-4" />Call
              </button>
              <button
                onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(delivery.address?.full_address ?? '')}`)}
                className="h-12 flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-muted/30 text-sm font-bold hover:bg-muted transition-colors active:scale-[0.97]"
              >
                <Navigation className="h-4 w-4" />Navigate
              </button>
            </div>
          </div>

          {/* ── Order items ────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Package className="h-3.5 w-3.5" />Order Items
              </h3>
            </div>
            <div className="divide-y divide-border/30">
              {delivery.order?.items?.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-4">
                  <p className="font-semibold text-sm truncate mr-3 flex-1">{item.product_name}</p>
                  <span className="font-bold text-sm bg-muted/60 px-3 py-1 rounded-lg shrink-0">×{item.quantity}</span>
                </div>
              ))}
            </div>
            {!!delivery.order?.bottles_to_deliver && (
              <div className="mx-4 mb-4 mt-1 flex items-center gap-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900 rounded-xl px-3.5 py-3">
                <Droplets className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  Deliver <strong>{delivery.order.bottles_to_deliver}</strong> full
                  {' · '}Collect <strong>{delivery.order.bottles_to_collect ?? 0}</strong> empty
                </div>
              </div>
            )}
          </div>

          {/* ── Schedule ───────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
              Schedule
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-xl px-3.5 py-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Date</p>
                <p className="font-bold text-sm">{delivery.order?.scheduled_date ?? '—'}</p>
              </div>
              <div className="bg-muted/40 rounded-xl px-3.5 py-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Time Slot</p>
                <p className="font-bold text-sm">{delivery.order?.scheduled_time_slot ?? '—'}</p>
              </div>
            </div>
          </div>

          {/* ── Fail delivery ──────────────────────────────────────────────── */}
          {isInProgress && (
            <button
              onClick={() => setShowFail(true)}
              className="w-full rounded-2xl border border-red-200 bg-red-50 text-red-700 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors active:scale-[0.98]"
              style={{ height: '52px' }}
            >
              <XCircle className="h-4 w-4" />
              Report Failed Delivery
            </button>
          )}

        </div>
      </DriverLayout>

      {/* ── Failure modal ──────────────────────────────────────────────────── */}
      {showFail && (
        <FailureModal
          onClose={() => setShowFail(false)}
          onSubmit={handleFailed}
        />
      )}

      {/* ── Complete delivery dialog ───────────────────────────────────────── */}
      <CompleteDeliveryDialog
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        onDone={handleDone}
        initialDelivery={{
          ...delivery,
          customer_name:       delivery.customer?.name ?? '',
          full_address:        delivery.address?.full_address ?? '',
          order_number:        delivery.order?.order_number ?? '',
          scheduled_time_slot: delivery.order?.scheduled_time_slot ?? '',
          items_count:         delivery.order?.items?.length ?? 0,
        } as unknown as DriverDelivery}
        stockCheck={stockCheck}
      />

      {/* ── Stock request dialog ───────────────────────────────────────────── */}
      <StockRequestDialog
        open={stockReqOpen}
        onClose={() => setStockReqOpen(false)}
        prefillItems={stockReqItems}
        deliveryId={stockReqDelivery}
        deliveryOrderNumber={stockReqOrder}
      />
    </>
  );
};

export default DeliveryDetailPage;
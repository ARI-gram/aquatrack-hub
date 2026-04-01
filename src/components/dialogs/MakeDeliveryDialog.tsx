/**
 * MakeDeliveryDialog
 * src/components/dialogs/MakeDeliveryDialog.tsx
 *
 * Lets a client admin:
 *   1. Browse all unassigned PENDING / CONFIRMED orders
 *   2. Cherry-pick which ones to bundle into a delivery run
 *   3. Set a departure date + time slot
 *   4. Pick a driver → stock check fires automatically
 *   5a. If driver has enough stock → confirm assignment directly
 *   5b. If stock is SHORT → choose one of three resolutions:
 *       • Assign anyway with existing stock (partial delivery)
 *       • Cancel / pick another driver
 *       • Distribute missing stock to driver + notify them to pick it up
 *   6. Confirm — fires POST /api/client/orders/assign/ with all selected order IDs
 *
 * Props
 *   open          – controls visibility
 *   onClose       – called on cancel / backdrop click
 *   onDeliveryMade(orderIds, driverName) – called after successful assignment
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Badge }    from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Truck,
  Package,
  Loader2,
  User,
  Phone,
  Calendar,
  Clock,
  Car,
  CheckCircle2,
  MapPin,
  Search,
  ChevronRight,
  ChevronLeft,
  Users,
  ArrowRight,
  InboxIcon,
  AlertTriangle,
  Droplets,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  ArrowDownToLine,
  Ban,
  TriangleAlert,
  PackageCheck,
  TruckIcon,
  Bell,
  RefreshCw,
  Info,
} from 'lucide-react';
import axiosInstance from '@/api/axios.config';
import { deliveryService, type Driver as BaseDriver } from '@/api/services/delivery.service';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type Driver = BaseDriver & { vehicle_number?: string };

interface OrderItem {
  id: string;
  product_name: string;
  product_unit: string;
  product_id: string;
  is_returnable: boolean;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

interface UnassignedOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: string;
  payment_method: string;
  items: OrderItem[];
  delivery: {
    scheduled_date?: string;
    scheduled_time_slot?: string;
    address_label: string;
    full_address?: string;
    driver_name?: string | null;
  } | null;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
}

type OrderListResponse = UnassignedOrder[] | { results: UnassignedOrder[]; count: number };

/** Per-product stock requirement aggregated from selected orders */
interface StockRequirement {
  product_id: string;
  product_name: string;
  product_unit: string;
  is_returnable: boolean;
  required: number;
  available: number;   // current van balance for this driver
  shortfall: number;   // required - available (0 if OK)
}

/** Stock check result */
interface StockCheckResult {
  checked: boolean;
  loading: boolean;
  sufficient: boolean;
  requirements: StockRequirement[];
}

type StockResolution = 'proceed_partial' | 'cancel' | 'distribute';

interface MakeDeliveryDialogProps {
  open: boolean;
  onClose: () => void;
  onDeliveryMade: (orderIds: string[], driverName: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIME_SLOTS = [
  '7:00 AM – 9:00 AM',
  '9:00 AM – 11:00 AM',
  '10:00 AM – 12:00 PM',
  '11:00 AM – 1:00 PM',
  '12:00 PM – 2:00 PM',
  '1:00 PM – 3:00 PM',
  '2:00 PM – 4:00 PM',
  '3:00 PM – 5:00 PM',
  '4:00 PM – 6:00 PM',
];

const PAYMENT_LABELS: Record<string, string> = {
  WALLET: 'Wallet', CASH: 'Cash', MPESA: 'M-Pesa', CARD: 'Card', CREDIT: 'Invoice',
};

const STATUS_DOT: Record<string, string> = {
  PENDING:   'bg-amber-400',
  CONFIRMED: 'bg-blue-500',
};

const STEPS = ['Select Orders', 'Schedule & Driver'] as const;
type Step = 0 | 1;

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayInputDate() {
  return new Date().toISOString().split('T')[0];
}

function extractOrders(data: OrderListResponse): UnassignedOrder[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { results: UnassignedOrder[] }).results))
    return (data as { results: UnassignedOrder[] }).results;
  return [];
}

/**
 * Aggregate stock requirements from selected orders.
 * Groups by product_id, sums quantities.
 */
function aggregateRequirements(orders: UnassignedOrder[]): Map<string, Omit<StockRequirement, 'available' | 'shortfall'>> {
  const map = new Map<string, Omit<StockRequirement, 'available' | 'shortfall'>>();
  for (const order of orders) {
    for (const item of order.items) {
      const pid = item.product_id;
      if (!pid) continue;
      const existing = map.get(pid);
      if (existing) {
        map.set(pid, { ...existing, required: existing.required + item.quantity });
      } else {
        map.set(pid, {
          product_id:   pid,
          product_name: item.product_name,
          product_unit: item.product_unit,
          is_returnable: item.is_returnable ?? false,
          required:     item.quantity,
        });
      }
    }
  }
  return map;
}

// ── Step indicator ────────────────────────────────────────────────────────────

const StepBar: React.FC<{ current: Step }> = ({ current }) => (
  <div className="flex items-center gap-2 mb-1">
    {STEPS.map((label, i) => (
      <React.Fragment key={label}>
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors',
              i === current
                ? 'bg-primary text-primary-foreground border-primary'
                : i < current
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-muted text-muted-foreground border-border',
            )}
          >
            {i < current ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
          </div>
          <span
            className={cn(
              'text-xs font-medium transition-colors',
              i === current ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {label}
          </span>
        </div>
        {i < STEPS.length - 1 && (
          <div className={cn('flex-1 h-px', i < current ? 'bg-emerald-400' : 'bg-border')} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// ── Selectable Order Card ─────────────────────────────────────────────────────

const OrderSelectCard: React.FC<{
  order: UnassignedOrder;
  selected: boolean;
  onToggle: () => void;
}> = ({ order, selected, onToggle }) => {
  const itemSummary = order.items
    .slice(0, 2)
    .map(i => `${i.product_name} ×${i.quantity}`)
    .join(' · ');

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full text-left rounded-xl border p-3.5 transition-all',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
          : 'border-border hover:border-primary/30 hover:bg-muted/30',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 h-4.5 w-4.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
            selected ? 'bg-primary border-primary' : 'border-muted-foreground/30 bg-background',
          )}
          style={{ height: 18, width: 18 }}
        >
          {selected && <CheckCircle2 className="h-3 w-3 text-white" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5">
              <span
                className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[order.status] ?? 'bg-border')}
              />
              <span className="font-mono font-bold text-sm">{order.order_number}</span>
            </div>
            <span className="text-sm font-bold shrink-0">
              KES {parseFloat(order.total_amount).toLocaleString()}
            </span>
          </div>

          {order.customer_name && (
            <p className="text-xs font-medium text-foreground/80 mb-1 truncate">
              {order.customer_name}
            </p>
          )}

          {order.delivery?.address_label && (
            <div className="flex items-center gap-1 mb-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {order.delivery.address_label}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {itemSummary && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Package className="h-2.5 w-2.5 shrink-0" />
                {itemSummary}
                {order.items.length > 2 && ` +${order.items.length - 2}`}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CreditCard className="h-2.5 w-2.5 shrink-0" />
              {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};

// ── Driver Card ───────────────────────────────────────────────────────────────

const DriverCard: React.FC<{
  driver: Driver;
  selected: boolean;
  onSelect: () => void;
  stockCheck?: StockCheckResult;
}> = ({ driver, selected, onSelect, stockCheck }) => {
  const completionPct =
    driver.today_assigned > 0
      ? Math.round((driver.today_completed / driver.today_assigned) * 100)
      : 0;
  const remaining    = driver.today_assigned - driver.today_completed;
  const loadColor    =
    driver.today_assigned === 0   ? 'text-emerald-600' :
    driver.today_assigned >= 8    ? 'text-red-500'     :
    driver.today_assigned >= 5    ? 'text-amber-500'   : 'text-emerald-600';
  const initials     = driver.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-xl border p-3.5 transition-all',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
          : 'border-border hover:border-primary/30 hover:bg-muted/30',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
            selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm truncate">{driver.name}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Stock indicator badge when selected */}
              {selected && stockCheck?.checked && !stockCheck.loading && (
                stockCheck.sufficient
                  ? <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      <ShieldCheck className="h-2.5 w-2.5" /> Stock OK
                    </span>
                  : <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      <ShieldAlert className="h-2.5 w-2.5" /> Low Stock
                    </span>
              )}
              {selected && stockCheck?.loading && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> Checking…
                </span>
              )}
              {selected && <CheckCircle2 className="h-4 w-4 text-primary" />}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {driver.phone && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <Phone className="h-2.5 w-2.5" />{driver.phone}
              </span>
            )}
            {driver.vehicle_number && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <Car className="h-2.5 w-2.5" />{driver.vehicle_number}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">
            Today: {driver.today_completed}/{driver.today_assigned} delivered
          </span>
          <span className={cn('font-semibold', loadColor)}>
            {remaining > 0 ? `${remaining} remaining` : 'Clear'}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              completionPct === 100 ? 'bg-emerald-500' :
              driver.today_assigned >= 8 ? 'bg-red-400' : 'bg-primary',
            )}
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>
    </button>
  );
};

// ── Stock Check Panel ─────────────────────────────────────────────────────────

const StockCheckPanel: React.FC<{
  stockCheck: StockCheckResult;
  resolution: StockResolution | null;
  onResolutionChange: (r: StockResolution) => void;
  isDistributing: boolean;
}> = ({ stockCheck, resolution, onResolutionChange, isDistributing }) => {
  if (!stockCheck.checked || stockCheck.loading) return null;
  if (stockCheck.sufficient) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
        <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
          <PackageCheck className="h-4 w-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800">Driver has sufficient stock</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            All {stockCheck.requirements.length} product{stockCheck.requirements.length !== 1 ? 's' : ''} are
            available on the driver's van.
          </p>
        </div>
      </div>
    );
  }

  const shortfalls = stockCheck.requirements.filter(r => r.shortfall > 0);
  const okItems    = stockCheck.requirements.filter(r => r.shortfall === 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
        <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <TriangleAlert className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">Insufficient stock on driver's van</p>
          <p className="text-xs text-amber-600 mt-0.5">
            {shortfalls.length} product{shortfalls.length !== 1 ? 's are' : ' is'} short.
            Choose how to proceed.
          </p>
        </div>
      </div>

      {/* Shortfall breakdown */}
      <div className="rounded-xl border bg-muted/30 overflow-hidden">
        <div className="px-3.5 py-2 border-b bg-background">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Stock Breakdown
          </p>
        </div>
        <div className="divide-y">
          {stockCheck.requirements.map(req => (
            <div key={req.product_id} className="flex items-center justify-between px-3.5 py-2.5 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn(
                  'h-1.5 w-1.5 rounded-full shrink-0',
                  req.shortfall === 0 ? 'bg-emerald-500' : 'bg-red-500',
                )} />
                <p className="text-xs font-medium truncate">{req.product_name}</p>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  ({req.product_unit})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-right">
                <span className="text-[11px] text-muted-foreground">
                  Need {req.required} · Have {req.available}
                </span>
                {req.shortfall > 0 ? (
                  <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full">
                    −{req.shortfall}
                  </span>
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resolution options */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          How would you like to proceed?
        </p>

        {/* Option 1: Proceed with existing stock */}
        <button
          type="button"
          onClick={() => onResolutionChange('proceed_partial')}
          disabled={isDistributing}
          className={cn(
            'w-full text-left rounded-xl border p-3.5 transition-all',
            resolution === 'proceed_partial'
              ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
              : 'border-border hover:border-blue-300 hover:bg-blue-50/40',
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn(
              'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
              resolution === 'proceed_partial' ? 'bg-blue-100' : 'bg-muted',
            )}>
              <TruckIcon className={cn('h-3.5 w-3.5', resolution === 'proceed_partial' ? 'text-blue-600' : 'text-muted-foreground')} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={cn('text-sm font-semibold', resolution === 'proceed_partial' ? 'text-blue-800' : 'text-foreground')}>
                  Assign with existing stock
                </p>
                {resolution === 'proceed_partial' && (
                  <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                )}
              </div>
              <p className={cn('text-xs mt-0.5', resolution === 'proceed_partial' ? 'text-blue-600' : 'text-muted-foreground')}>
                Proceed with what's available. Driver can only deliver what they have.
              </p>
            </div>
          </div>
        </button>

        {/* Option 2: Distribute missing stock first */}
        <button
          type="button"
          onClick={() => onResolutionChange('distribute')}
          disabled={isDistributing}
          className={cn(
            'w-full text-left rounded-xl border p-3.5 transition-all',
            resolution === 'distribute'
              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
              : 'border-border hover:border-primary/30 hover:bg-muted/30',
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn(
              'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
              resolution === 'distribute' ? 'bg-primary/10' : 'bg-muted',
            )}>
              <ArrowDownToLine className={cn('h-3.5 w-3.5', resolution === 'distribute' ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={cn('text-sm font-semibold', resolution === 'distribute' ? 'text-foreground' : 'text-foreground')}>
                  Distribute missing stock to driver
                  <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    Recommended
                  </span>
                </p>
                {resolution === 'distribute' && (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Stock is distributed from warehouse. Driver receives a notification to pick it up.
              </p>
              {resolution === 'distribute' && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-primary font-medium">
                  <Bell className="h-3 w-3" />
                  Driver will be notified to collect stock before departure
                </div>
              )}
            </div>
          </div>
        </button>

        {/* Option 3: Cancel / pick another driver */}
        <button
          type="button"
          onClick={() => onResolutionChange('cancel')}
          disabled={isDistributing}
          className={cn(
            'w-full text-left rounded-xl border p-3.5 transition-all',
            resolution === 'cancel'
              ? 'border-red-300 bg-red-50 ring-1 ring-red-100'
              : 'border-border hover:border-red-200 hover:bg-red-50/30',
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn(
              'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
              resolution === 'cancel' ? 'bg-red-100' : 'bg-muted',
            )}>
              <Ban className={cn('h-3.5 w-3.5', resolution === 'cancel' ? 'text-red-500' : 'text-muted-foreground')} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={cn('text-sm font-semibold', resolution === 'cancel' ? 'text-red-700' : 'text-foreground')}>
                  Don't proceed — choose another driver
                </p>
                {resolution === 'cancel' && (
                  <CheckCircle2 className="h-4 w-4 text-red-400 shrink-0" />
                )}
              </div>
              <p className={cn('text-xs mt-0.5', resolution === 'cancel' ? 'text-red-500' : 'text-muted-foreground')}>
                Go back and select a driver with enough stock.
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

// ── Main Dialog ───────────────────────────────────────────────────────────────

export const MakeDeliveryDialog: React.FC<MakeDeliveryDialogProps> = ({
  open,
  onClose,
  onDeliveryMade,
}) => {
  // Step state
  const [step, setStep] = useState<Step>(0);

  // Step 1 — order selection
  const [allOrders, setAllOrders]         = useState<UnassignedOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  // Step 2 — schedule + driver
  const [scheduledDate, setScheduledDate]         = useState(todayInputDate());
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState(TIME_SLOTS[2]);
  const [drivers, setDrivers]                     = useState<Driver[]>([]);
  const [isLoadingDrivers, setIsLoadingDrivers]   = useState(false);
  const [selectedDriverId, setSelectedDriverId]   = useState<string | null>(null);

  // Stock check
  const [stockCheck, setStockCheck] = useState<StockCheckResult>({
    checked: false,
    loading: false,
    sufficient: false,
    requirements: [],
  });
  const [stockResolution, setStockResolution] = useState<StockResolution | null>(null);
  const [isDistributing, setIsDistributing]   = useState(false);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Load unassigned orders ───────────────────────────────────────────────

  const loadOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      // Fetch PENDING and CONFIRMED separately then merge
      const [pendingRes, confirmedRes] = await Promise.all([
        axiosInstance.get<OrderListResponse>('/orders/all/', {
          params: { status: 'PENDING' }
        }),
        axiosInstance.get<OrderListResponse>('/orders/all/', {
          params: { status: 'CONFIRMED' }
        }),
      ]);

      const pending   = extractOrders(pendingRes.data);
      const confirmed = extractOrders(confirmedRes.data);
      const combined  = [...pending, ...confirmed];

      // Keep only unassigned ones
      setAllOrders(combined.filter(o => !o.delivery?.driver_name));
    } catch {
      toast.error('Could not load orders.');
      setAllOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  // ── Load drivers ────────────────────────────────────────────────────────

  const loadDrivers = useCallback(async () => {
    setIsLoadingDrivers(true);
    try {
      const data = await deliveryService.getAvailableDrivers();
      setDrivers(data);
    } catch {
      toast.error('Could not load drivers.');
    } finally {
      setIsLoadingDrivers(false);
    }
  }, []);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setStep(0);
      setSelectedOrderIds(new Set());
      setSearchQuery('');
      setScheduledDate(todayInputDate());
      setScheduledTimeSlot(TIME_SLOTS[2]);
      setSelectedDriverId(null);
      setStockCheck({ checked: false, loading: false, sufficient: false, requirements: [] });
      setStockResolution(null);
      return;
    }
    loadOrders();
    loadDrivers();
  }, [open, loadOrders, loadDrivers]);

  // ── Stock check — fires when driver is selected ──────────────────────────

  const checkDriverStock = useCallback(async (driverId: string, orders: UnassignedOrder[]) => {
    setStockCheck({ checked: false, loading: true, sufficient: false, requirements: [] });
    setStockResolution(null);

    try {
      // Fetch driver's current van stock
      const [bottlesRes, consumablesRes] = await Promise.all([
        axiosInstance.get<Array<{ product_id: string; balance: { full: number } }>>('/driver/store/bottles/', {
          params: { driver_id: driverId },
        }).catch(() => ({ data: [] })),
        axiosInstance.get<Array<{ product_id: string; balance: { in_stock: number } }>>('/driver/store/consumables/', {
          params: { driver_id: driverId },
        }).catch(() => ({ data: [] })),
      ]);

      // Build available stock map
      type BottleStockRow      = { product_id: string; balance: { full: number } };
      type ConsumableStockRow  = { product_id: string; balance: { in_stock: number } };

      const bottleRows:     BottleStockRow[]     = Array.isArray(bottlesRes.data)     ? bottlesRes.data     : [];
      const consumableRows: ConsumableStockRow[]  = Array.isArray(consumablesRes.data) ? consumablesRes.data : [];

      const stockMap = new Map<string, number>();
      for (const b of bottleRows) {
        stockMap.set(b.product_id, b.balance?.full ?? 0);
      }
      for (const c of consumableRows) {
        stockMap.set(c.product_id, c.balance?.in_stock ?? 0);
      }

      // Build requirements from selected orders
      const reqMap = aggregateRequirements(orders);
      const requirements: StockRequirement[] = [];

      for (const [pid, req] of reqMap) {
        const available = stockMap.get(pid) ?? 0;
        const shortfall = Math.max(0, req.required - available);
        requirements.push({ ...req, available, shortfall });
      }

      const sufficient = requirements.every(r => r.shortfall === 0);

      setStockCheck({ checked: true, loading: false, sufficient, requirements });
    } catch {
      // If stock endpoint not available, assume sufficient and proceed
      setStockCheck({
        checked: true,
        loading: false,
        sufficient: true,
        requirements: [],
      });
    }
  }, []);

  // Trigger stock check whenever driver selection changes (on step 2)
  useEffect(() => {
    if (step !== 1 || !selectedDriverId) return;
    const orders = allOrders.filter(o => selectedOrderIds.has(o.id));
    checkDriverStock(selectedDriverId, orders);
  }, [selectedDriverId, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──────────────────────────────────────────────────────────────

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return allOrders.filter(
      o =>
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_name ?? '').toLowerCase().includes(q) ||
        (o.delivery?.address_label ?? '').toLowerCase().includes(q),
    );
  }, [allOrders, searchQuery]);

  const selectedOrders    = allOrders.filter(o => selectedOrderIds.has(o.id));
  const selectedDriver    = drivers.find(d => d.id === selectedDriverId) ?? null;
  const totalValue        = selectedOrders.reduce((s, o) => s + parseFloat(o.total_amount), 0);
  const totalItems        = selectedOrders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);

  const canProceedStep1   = selectedOrderIds.size > 0;

  // Can submit:
  // - driver is selected
  // - scheduled date exists
  // - stock is sufficient OR user has chosen a resolution (and not 'cancel')
  const canSubmit = useMemo(() => {
    if (!selectedDriverId || !scheduledDate) return false;
    if (!stockCheck.checked) return false;
    if (stockCheck.loading) return false;
    if (stockCheck.sufficient) return true;
    // Stock is insufficient — need a resolution that isn't 'cancel'
    return stockResolution === 'proceed_partial' || stockResolution === 'distribute';
  }, [selectedDriverId, scheduledDate, stockCheck, stockResolution]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleOrder = (id: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleDriverSelect = (driverId: string) => {
    const next = selectedDriverId === driverId ? null : driverId;
    setSelectedDriverId(next);
    if (!next) {
      setStockCheck({ checked: false, loading: false, sufficient: false, requirements: [] });
      setStockResolution(null);
    }
  };

  /**
   * Distribute shortfall stock to driver by calling the warehouse distribute endpoint,
   * then sends a driver pickup notification.
   */
  const distributeStockToDriver = async () => {
    if (!selectedDriverId || !selectedDriver) return;
    const shortfalls = stockCheck.requirements.filter(r => r.shortfall > 0);
    setIsDistributing(true);
    try {
      for (const req of shortfalls) {
        const endpoint = req.is_returnable
          ? '/store/bottles/distribute/'
          : '/store/consumables/distribute/';

        await axiosInstance.post(endpoint, {
          product_id: req.product_id,
          driver_id:  selectedDriverId,
          ...(req.is_returnable
            ? { qty_good: req.shortfall }
            : { quantity: req.shortfall }),
          notes: `Auto-distributed for delivery run on ${scheduledDate}`,
        });
      }

      // Notify driver to pick up stock
      await axiosInstance.post('/client/drivers/notify-stock-pickup/', {
        driver_id: selectedDriverId,
        products:  shortfalls.map(r => ({
          product_id:   r.product_id,
          product_name: r.product_name,
          quantity:     r.shortfall,
        })),
        scheduled_date: scheduledDate,
        message: `Please collect your van stock before departure on ${scheduledDate}.`,
      }).catch(() => {
        // Notification is best-effort — don't fail the whole flow
      });

      toast.success(`Stock distributed to ${selectedDriver.name}. They have been notified to pick it up.`);

      // Re-check stock — should now be sufficient
      const orders = allOrders.filter(o => selectedOrderIds.has(o.id));
      await checkDriverStock(selectedDriverId, orders);
      setStockResolution(null);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      toast.error(
        axiosError?.response?.data?.error ?? 'Failed to distribute stock. Please try from the Store page.',
      );
    } finally {
      setIsDistributing(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDriverId || !selectedDriver) return;

    // If user chose to distribute first, do that before assigning
    if (stockResolution === 'distribute') {
      await distributeStockToDriver();
      // Check again — if still insufficient after distribute (e.g. warehouse is also low),
      // warn but still allow proceed (driver chose this path)
    }

    setIsSubmitting(true);
    try {
      await deliveryService.assignOrderToDriver(
        [...selectedOrderIds][0],
        selectedDriverId,
        scheduledDate,
        scheduledTimeSlot,
      );
      const remaining = [...selectedOrderIds].slice(1);
      for (const orderId of remaining) {
        await deliveryService.assignOrderToDriver(orderId, selectedDriverId, scheduledDate, scheduledTimeSlot);
      }
      toast.success(
        `${selectedOrderIds.size} order${selectedOrderIds.size > 1 ? 's' : ''} assigned to ${selectedDriver.name}`,
      );
      onDeliveryMade([...selectedOrderIds], selectedDriver.name);
      onClose();
    } catch {
      toast.error('Failed to make delivery. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If user chose 'cancel' resolution, deselect driver so they can pick another
  useEffect(() => {
    if (stockResolution === 'cancel') {
      setSelectedDriverId(null);
      setStockCheck({ checked: false, loading: false, sufficient: false, requirements: [] });
      setStockResolution(null);
    }
  }, [stockResolution]);

  // ── Render ───────────────────────────────────────────────────────────────

  const showStockPanel = step === 1 && !!selectedDriverId && stockCheck.checked && !stockCheck.loading;
  const showStockLoader = step === 1 && !!selectedDriverId && stockCheck.loading;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] mx-auto rounded-2xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">

        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-background border-b px-5 py-4 rounded-t-2xl shrink-0">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Truck className="h-4.5 w-4.5 text-primary" style={{ height: 18, width: 18 }} />
                </div>
                <div>
                  <p className="font-bold text-base leading-tight">Make Delivery</p>
                  <p className="text-[11px] text-muted-foreground font-normal">
                    Bundle orders into a delivery run
                  </p>
                </div>
              </div>
              <StepBar current={step} />
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* ===== STEP 1: Select Orders ===== */}
          {step === 0 && (
            <div className="space-y-4">
              {selectedOrderIds.size > 0 && (
                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary-foreground">
                        {selectedOrderIds.size}
                      </span>
                    </div>
                    <span className="text-sm font-semibold">
                      {selectedOrderIds.size} order{selectedOrderIds.size > 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-primary">
                      KES {totalValue.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {totalItems} item{totalItems !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search orders or customers…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-sm rounded-xl bg-muted/40 border-transparent focus:border-input"
                  />
                </div>
                {filteredOrders.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs rounded-xl shrink-0 gap-1.5"
                    onClick={toggleAll}
                  >
                    <Users className="h-3.5 w-3.5" />
                    {selectedOrderIds.size === filteredOrders.length ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
              </div>

              {isLoadingOrders ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                  <p className="text-sm">Loading orders…</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center">
                    <InboxIcon className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-0.5">
                      {allOrders.length === 0 ? 'No pending orders' : 'No results'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {allOrders.length === 0
                        ? 'All orders are either assigned or completed.'
                        : 'Try adjusting your search.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredOrders.map(order => (
                    <OrderSelectCard
                      key={order.id}
                      order={order}
                      selected={selectedOrderIds.has(order.id)}
                      onToggle={() => toggleOrder(order.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== STEP 2: Schedule + Driver ===== */}
          {step === 1 && (
            <div className="space-y-5">

              {/* Selected orders recap */}
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Delivery Run Summary
                </p>
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold">
                      {selectedOrderIds.size} order{selectedOrderIds.size > 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="font-bold text-sm">
                    KES {totalValue.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedOrders.slice(0, 5).map(o => (
                    <span
                      key={o.id}
                      className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-background border"
                    >
                      {o.order_number}
                    </span>
                  ))}
                  {selectedOrders.length > 5 && (
                    <span className="text-[10px] text-muted-foreground px-2 py-0.5">
                      +{selectedOrders.length - 5} more
                    </span>
                  )}
                </div>
              </div>

              {/* Schedule */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Departure Schedule
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Delivery Date
                  </label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    min={todayInputDate()}
                    onChange={e => setScheduledDate(e.target.value)}
                    className="h-9 text-sm rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Departure Time Slot
                  </label>
                  <Select value={scheduledTimeSlot} onValueChange={setScheduledTimeSlot}>
                    <SelectTrigger className="h-9 text-sm rounded-xl">
                      <SelectValue placeholder="Select time slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map(slot => (
                        <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Driver selection */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Assign Driver
                </p>
                {isLoadingDrivers ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading drivers…</span>
                  </div>
                ) : drivers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                    <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center">
                      <User className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-medium">No drivers available</p>
                    <p className="text-xs text-muted-foreground">
                      Add drivers in the Employees section first.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {drivers.map(driver => (
                      <DriverCard
                        key={driver.id}
                        driver={driver}
                        selected={selectedDriverId === driver.id}
                        onSelect={() => handleDriverSelect(driver.id)}
                        stockCheck={selectedDriverId === driver.id ? stockCheck : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Stock check loading indicator */}
              {showStockLoader && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Checking driver's van stock for selected orders…
                </div>
              )}

              {/* Stock check result + resolution panel */}
              {showStockPanel && (
                <StockCheckPanel
                  stockCheck={stockCheck}
                  resolution={stockResolution}
                  onResolutionChange={setStockResolution}
                  isDistributing={isDistributing}
                />
              )}

              {/* Distributing in-progress indicator */}
              {isDistributing && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl border border-primary/20 bg-primary/5 text-sm text-primary font-medium">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  Distributing stock to {selectedDriver?.name}… please wait
                </div>
              )}

              {/* Warning if any orders already assigned */}
              {selectedOrders.some(o => o.status === 'ASSIGNED') && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Some selected orders are already assigned to a driver. Proceeding will reassign them.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="sticky bottom-0 bg-background border-t px-5 py-4 rounded-b-2xl shrink-0">
          <div className="flex gap-2 w-full">
            {step === 0 ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-10"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-10 gap-2"
                  disabled={!canProceedStep1}
                  onClick={() => setStep(1)}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 gap-1.5 px-4"
                  onClick={() => setStep(0)}
                  disabled={isSubmitting || isDistributing}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-10 gap-2"
                  disabled={!canSubmit || isSubmitting || isDistributing}
                  onClick={handleSubmit}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Assigning…
                    </>
                  ) : isDistributing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Distributing Stock…
                    </>
                  ) : stockResolution === 'distribute' ? (
                    <>
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                      Distribute & Assign
                    </>
                  ) : (
                    <>
                      Confirm Delivery Run
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
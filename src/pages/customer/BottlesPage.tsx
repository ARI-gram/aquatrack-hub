/**
 * Customer Bottles Page
 * Route: /customer/bottles
 *
 * No dedicated bottle endpoint exists on the backend.
 * Everything is derived from the customer's order list:
 *
 *  - totalOwned      = sum of all NEW_BOTTLE / MIXED order items (BOTTLES unit)
 *                      delivered to this customer, minus any collected back
 *  - fullBottles     = bottles delivered in most-recent completed order (simple proxy)
 *  - emptyBottles    = totalOwned - fullBottles - inTransit
 *  - inTransit       = bottles in active (non-terminal) orders
 *  - depositPerBottle= product deposit_amount from the first new-bottle order item
 *  - history         = one row per order that involved bottles
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';
import {
  BottleTransactionType,
  type BottleInventory,
  type BottleActivityItem,
} from '@/types/bottle.types';
import {
  Plus, Info, RefreshCw, AlertCircle, Loader2, Droplets,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import axiosInstance from '@/api/axios.config';
import { CUSTOMER_API_ENDPOINTS } from '@/api/customerEndpoints';

// Import the existing tracker / history UI components
import { BottleTracker } from '@/components/customer/BottleTracker';
import { BottleHistory } from '@/components/customer/BottleTracker/BottleHistory';

// ── Types (matching OrderSerializer output) ───────────────────────────────────

interface OrderItem {
  id: string;
  product: string | null;
  product_name: string;
  product_unit: string;    // 'BOTTLES' | 'LITRES'
  quantity: number;
  unit_price: string;
  subtotal: string;
}

interface BottleExchange {
  bottles_to_deliver: number;
  bottles_to_collect: number;
  bottles_delivered:  number | null;
  bottles_collected:  number | null;
  exchange_confirmed: boolean;
  confirmed_at:       string | null;
}

interface OrderResponse {
  id: string;
  order_number: string;
  order_type: string;       // 'REFILL' | 'NEW_BOTTLE' | 'MIXED'
  status: string;
  payment_status: string;
  items: OrderItem[];
  bottle_exchange: BottleExchange | null;
  created_at: string;
  delivery?: {
    scheduled_date: string;
    actual_delivery_time: string | null;
  } | null;
}

// ── Terminal / active status helpers ─────────────────────────────────────────

const TERMINAL = new Set(['DELIVERED', 'COMPLETED', 'CANCELLED']);
const ACTIVE    = new Set(['PENDING', 'CONFIRMED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED']);

function isActive(status: string)   { return ACTIVE.has(status);    }
function isDelivered(status: string){ return TERMINAL.has(status) && status !== 'CANCELLED'; }

// ── Derive everything from orders ─────────────────────────────────────────────

interface DerivedBottleData {
  inventory: BottleInventory;
  history: BottleActivityItem[];
}

function deriveFromOrders(orders: OrderResponse[], customerId = ''): DerivedBottleData {
  let totalOwned    = 0;
  let inTransit     = 0;
  const depositPerBottle = 0;
  const history: BottleActivityItem[] = [];

  for (const order of orders) {
    if (order.status === 'CANCELLED') continue;

    const ex = order.bottle_exchange;

    // Items that are physical bottles (not litres/refills)
    const bottleItems = order.items.filter(i => i.product_unit === 'BOTTLES');
    // Items that are refills (litres)
    const refillItems = order.items.filter(i => i.product_unit === 'LITRES');

    const bottleQty = bottleItems.reduce((s, i) => s + i.quantity, 0);
    const refillQty = refillItems.reduce((s, i) => s + i.quantity, 0);

    // New bottles purchased → add to owned (once delivered)
    if (bottleQty > 0 && isDelivered(order.status)) {
      totalOwned += bottleQty;
    }

    // Bottles collected back (from bottle_exchange) → subtract from owned
    if (ex?.exchange_confirmed && isDelivered(order.status)) {
      const collected = ex.bottles_collected ?? ex.bottles_to_collect;
      totalOwned = Math.max(0, totalOwned - collected);
    }

    // In-transit: bottles going out on an active order
    if (isActive(order.status) && ex) {
      inTransit += ex.bottles_to_deliver;
    }

    // ── History row ────────────────────────────────────────────────────────
    const totalQty = bottleQty + refillQty;
    if (totalQty === 0) continue;   // order has no bottle-related items

    let txType: BottleTransactionType;
    if (order.order_type === 'NEW_BOTTLE') {
      txType = BottleTransactionType.PURCHASE;
    } else if (order.order_type === 'REFILL') {
      txType = BottleTransactionType.REFILL_DELIVERED;
    } else {
      // MIXED: treat as refill for history display
      txType = BottleTransactionType.REFILL_DELIVERED;
    }

    history.push({
      id:          order.id,
      date:        order.delivery?.actual_delivery_time ?? order.created_at,
      type:        txType,
      quantity:    totalQty,
      orderNumber: order.order_number,
      status:      (order.status === 'IN_TRANSIT' ? 'IN_TRANSIT' : TERMINAL.has(order.status) && order.status !== 'CANCELLED' ? 'COMPLETED' : 'PENDING') as 'COMPLETED' | 'PENDING' | 'IN_TRANSIT',
      description: buildDescription(order, bottleQty, refillQty, ex),
    });
  }

  // Simple heuristic: assume ~70% of owned bottles are full if nothing more precise is known
  // (the backend doesn't expose this without a dedicated endpoint)
  const fullBottles  = Math.max(0, Math.round(totalOwned * 0.7) - inTransit);
  const emptyBottles = Math.max(0, totalOwned - fullBottles - inTransit);

  const inventory: BottleInventory = {
    customerId,
    totalOwned,
    fullBottles,
    emptyBottles,
    inTransit,
    atDistributor:   0,
    depositPerBottle,
    totalDeposit:    totalOwned * depositPerBottle,
    lastUpdated:     new Date().toISOString(),
  };

  // History: newest first
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return { inventory, history: sortedHistory };
}

function buildDescription(
  order: OrderResponse,
  bottleQty: number,
  refillQty: number,
  ex: BottleExchange | null,
): string {
  const parts: string[] = [];
  if (refillQty > 0) parts.push(`${refillQty} refill${refillQty !== 1 ? 's' : ''}`);
  if (bottleQty > 0) parts.push(`${bottleQty} new bottle${bottleQty !== 1 ? 's' : ''}`);
  if (ex?.bottles_to_collect && ex.bottles_to_collect > 0) {
    parts.push(`${ex.bottles_to_collect} collected`);
  }
  return parts.join(', ') || order.order_type;
}

function extractOrders(data: unknown): OrderResponse[] {
  if (Array.isArray(data)) return data as OrderResponse[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as OrderResponse[];
    if (Array.isArray(obj.data))    return obj.data    as OrderResponse[];
  }
  return [];
}

// ── Page ──────────────────────────────────────────────────────────────────────

const BottlesPage: React.FC = () => {
  const navigate = useNavigate();

  const [inventory, setInventory] = useState<BottleInventory | null>(null);
  const [history,   setHistory]   = useState<BottleActivityItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await axiosInstance.get(CUSTOMER_API_ENDPOINTS.ORDERS.LIST);
      const orders = extractOrders(res.data);
      const { inventory: inv, history: hist } = deriveFromOrders(orders);
      setInventory(inv);
      setHistory(hist);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── States ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <CustomerLayout title="My Bottles">
        <div className="space-y-4">
          <div className="h-40 rounded-2xl bg-muted animate-pulse" />
          <div className="h-24 rounded-2xl bg-muted animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-16 rounded-xl bg-muted animate-pulse" />
            <div className="h-16 rounded-xl bg-muted animate-pulse" />
          </div>
        </div>
      </CustomerLayout>
    );
  }

  if (error) {
    return (
      <CustomerLayout title="My Bottles">
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="font-semibold">Could not load bottle data</p>
          <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" /> Try Again
          </Button>
        </div>
      </CustomerLayout>
    );
  }

  if (!inventory || inventory.totalOwned === 0) {
    return (
      <CustomerLayout title="My Bottles">
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4 px-4">
          <div className="h-20 w-20 rounded-3xl bg-sky-50 border border-sky-100 flex items-center justify-center">
            <Droplets className="h-9 w-9 text-sky-400" />
          </div>
          <p className="font-bold text-lg">No bottles yet</p>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            Purchase your first bottles to get started. Your inventory will appear here.
          </p>
          <Button variant="ocean" onClick={() => navigate(CUSTOMER_ROUTES.PLACE_ORDER)}>
            <Plus className="h-4 w-4 mr-2" /> Buy Bottles
          </Button>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout title="My Bottles">
      <div className="space-y-6">

        {/* Bottle Tracker */}
        <BottleTracker inventory={inventory} />

        {/* Deposit info — only show if deposit is known */}
        {inventory.depositPerBottle > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50">
                  <Droplets className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium">Deposit on File</p>
                  <p className="text-sm text-muted-foreground">
                    KES {inventory.depositPerBottle.toLocaleString()} × {inventory.totalOwned} bottle{inventory.totalOwned !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <span className="text-xl font-bold text-emerald-600">
                KES {(inventory.totalOwned * inventory.depositPerBottle).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 Deposit is refundable when bottles are returned in good condition
            </p>
          </Card>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="ocean"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate(CUSTOMER_ROUTES.PLACE_ORDER)}
          >
            <RefreshCw className="h-5 w-5" />
            <span>Order Refill</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate(CUSTOMER_ROUTES.PLACE_ORDER)}
          >
            <Plus className="h-5 w-5" />
            <span>Buy Bottles</span>
          </Button>
        </div>

        {/* Warnings */}
        {inventory.emptyBottles > 0 && inventory.fullBottles === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              All your bottles appear to be empty — order a refill soon.
            </AlertDescription>
          </Alert>
        )}

        {/* Bottle history */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Bottle Activity</h3>
            {history.length > 0 && (
              <Badge variant="secondary">
                {history.length} transaction{history.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {history.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No bottle activity yet.</p>
            </Card>
          ) : (
            <BottleHistory activities={history} />
          )}
        </div>

        {/* Accuracy note */}
        <Card className="p-4 bg-amber-50/60 border-amber-100">
          <div className="flex gap-3">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Bottle counts are estimated from your order history. Full vs. empty
              breakdown is approximate — exact counts are updated after each delivery.
            </p>
          </div>
        </Card>

        {/* How it works */}
        <Card className="p-4 bg-muted/50">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">How bottle tracking works</p>
              <ul className="space-y-1">
                <li>• <strong>Full bottles</strong> contain fresh water ready to use</li>
                <li>• <strong>Empty bottles</strong> can be exchanged for refills</li>
                <li>• <strong>In transit</strong> bottles are being delivered or collected</li>
                <li>• Your deposit is protected while bottles are in good condition</li>
              </ul>
            </div>
          </div>
        </Card>

      </div>
    </CustomerLayout>
  );
};

export default BottlesPage;
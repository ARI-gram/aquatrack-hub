/**
 * Customer Dashboard
 * src/pages/customer/CustomerDashboard.tsx
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { BottleTracker } from '@/components/customer/BottleTracker';
import { WalletCard } from '@/components/customer/WalletCard';
import { DeliveryTracker } from '@/components/customer/DeliveryTracker';
import {
  CreditStatusBanner,
  type CreditStatus,
} from '@/components/customer/CreditStatusBanner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';
import { CUSTOMER_PRICING } from '@/constants/pricing';
import {
  type DeliveryTrackingData,
  type CustomerOrderTrackingResponse,
  toDeliveryTrackingData,
} from '@/types/customerOrder.types';
import { BottleInventory } from '@/types/bottle.types';
import { CustomerWallet } from '@/types/wallet.types';
import {
  Package, Plus, Clock, ArrowRight, CalendarClock, Lock, Loader2,
} from 'lucide-react';
import axiosInstance from '@/api/axios.config';
import { CUSTOMER_API_ENDPOINTS } from '@/api/customerEndpoints';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  product: string | null;
  product_name: string;
  product_unit: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

interface OrderResponse {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  subtotal: string;
  delivery_fee: string;
  discount_amount: string;
  total_amount: string;
  payment_status: string;
  payment_method: string;
  paid_at: string | null;
  special_instructions: string;
  items: OrderItem[];
  delivery: {
    scheduled_date: string;
    scheduled_time_slot: string;
    address_label: string;
    full_address: string;
    driver_name: string | null;
    driver_phone: string | null;
    actual_delivery_time: string | null;
    delivery_notes: string;
  } | null;
  created_at: string;
  updated_at: string;
}

// ── Mock data (non-order) ─────────────────────────────────────────────────────

const mockBottleInventory: BottleInventory = {
  customerId:       'customer-001',
  totalOwned:       10,
  fullBottles:      3,
  emptyBottles:     5,
  inTransit:        2,
  atDistributor:    0,
  depositPerBottle: CUSTOMER_PRICING.BOTTLE_DEPOSIT,
  totalDeposit:     100,
  lastUpdated:      new Date().toISOString(),
};

const mockWallet: CustomerWallet = {
  walletId:     'wallet-001',
  customerId:   'customer-001',
  balance:      45.00,
  currency:     'USD',
  lastUpdated:  new Date().toISOString(),
  restrictions: { minBalance: 0, maxBalance: 1000, dailySpendLimit: 500 },
};

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { pill: string; dot: string }> = {
  PENDING:    { pill: 'bg-amber-50   text-amber-700   border-amber-200',   dot: 'bg-amber-400'   },
  CONFIRMED:  { pill: 'bg-blue-50    text-blue-700    border-blue-200',    dot: 'bg-blue-500'    },
  ASSIGNED:   { pill: 'bg-indigo-50  text-indigo-700  border-indigo-200',  dot: 'bg-indigo-500'  },
  PICKED_UP:  { pill: 'bg-cyan-50    text-cyan-700    border-cyan-200',    dot: 'bg-cyan-500'    },
  IN_TRANSIT: { pill: 'bg-violet-50  text-violet-700  border-violet-200',  dot: 'bg-violet-500'  },
  ARRIVED:    { pill: 'bg-teal-50    text-teal-700    border-teal-200',    dot: 'bg-teal-500'    },
  DELIVERED:  { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  COMPLETED:  { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED:  { pill: 'bg-red-50     text-red-700     border-red-200',     dot: 'bg-red-400'     },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchActiveOrderId(): Promise<string | null> {
  try {
    const res = await axiosInstance.get(CUSTOMER_API_ENDPOINTS.ORDERS.LIST);
    const orders: Array<{ id: string; status: string }> = res.data?.results ?? res.data ?? [];
    const active = orders.find(o =>
      ['ASSIGNED', 'IN_TRANSIT', 'NEAR_YOU', 'ARRIVED'].includes(o.status)
    );
    return active?.id ?? null;
  } catch {
    return null;
  }
}

async function fetchTrackingData(orderId: string): Promise<DeliveryTrackingData | null> {
  try {
    const res = await axiosInstance.get<CustomerOrderTrackingResponse>(
      CUSTOMER_API_ENDPOINTS.ORDERS.TRACK(orderId)
    );
    return toDeliveryTrackingData(res.data);
  } catch {
    return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [creditStatus,    setCreditStatus]    = useState<CreditStatus | null>(null);
  const [activeDelivery,  setActiveDelivery]  = useState<DeliveryTrackingData | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(true);
  const [recentOrders,    setRecentOrders]    = useState<OrderResponse[]>([]);
  const [ordersLoading,   setOrdersLoading]   = useState(true);

  // ── Loaders ───────────────────────────────────────────────────────────────

  const loadCreditStatus = async () => {
    try {
      const res = await axiosInstance.get<CreditStatus>(CUSTOMER_API_ENDPOINTS.CREDIT.STATUS);
      setCreditStatus(res.data);
    } catch {
      setCreditStatus(null);
    }
  };

  const loadActiveDelivery = async () => {
    setTrackingLoading(true);
    try {
      const orderId = await fetchActiveOrderId();
      if (orderId) {
        const tracking = await fetchTrackingData(orderId);
        setActiveDelivery(tracking);
      } else {
        setActiveDelivery(null);
      }
    } catch {
      setActiveDelivery(null);
    } finally {
      setTrackingLoading(false);
    }
  };

  const loadRecentOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await axiosInstance.get(CUSTOMER_API_ENDPOINTS.ORDERS.LIST);
      const all: OrderResponse[] = res.data?.results ?? res.data ?? [];
      setRecentOrders(all.slice(0, 3));
    } catch {
      setRecentOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadCreditStatus();
    loadActiveDelivery();
    loadRecentOrders();

    const interval = setInterval(loadActiveDelivery, 30_000);
    return () => clearInterval(interval);
  }, []);

  const isAccountFrozen = creditStatus?.account_frozen === true;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <CustomerLayout title="Dashboard">

      {/* Credit status banner */}
      {creditStatus?.credit_enabled && (
        <div className="mb-4">
          <CreditStatusBanner
            creditStatus={creditStatus}
            onRequestSubmitted={loadCreditStatus}
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        {isAccountFrozen ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <Lock className="h-4 w-4" />
            <span>Ordering paused — settle outstanding invoice to resume</span>
          </div>
        ) : (
          <Button variant="ocean" onClick={() => navigate(CUSTOMER_ROUTES.PLACE_ORDER)}>
            <Plus className="h-4 w-4 mr-2" />
            Place Order
          </Button>
        )}
        <Button variant="outline" onClick={() => navigate(CUSTOMER_ROUTES.WALLET)}>
          Add Funds
        </Button>
      </div>

      {/* Active Delivery Tracker */}
      {trackingLoading ? (
        <div className="flex items-center justify-center py-8 mb-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : activeDelivery ? (
        <div className="mb-6">
          <DeliveryTracker
            tracking={activeDelivery}
            onCallDriver={() => {
              if (activeDelivery.driver?.phone) {
                window.open(`tel:${activeDelivery.driver.phone}`);
              }
            }}
            onTrackLive={() => {
              navigate(`${CUSTOMER_ROUTES.ORDER_HISTORY}/${activeDelivery.orderId}/track`);
            }}
          />
        </div>
      ) : null}

      {/* Bottle & Wallet Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BottleTracker inventory={mockBottleInventory} />
        <WalletCard wallet={mockWallet} />
      </div>

      {/* Scheduled Deliveries — derived from real pending orders */}
      {recentOrders.some(o => ['PENDING', 'CONFIRMED', 'ASSIGNED'].includes(o.status) && o.delivery?.scheduled_date) && (
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Scheduled Deliveries</h3>
          </div>
          <div className="space-y-2">
            {recentOrders
              .filter(o => ['PENDING', 'CONFIRMED', 'ASSIGNED'].includes(o.status) && o.delivery?.scheduled_date)
              .map(o => (
                <div key={o.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">
                    {o.delivery!.scheduled_date} · {o.delivery!.scheduled_time_slot}
                  </span>
                  <span className="text-xs font-medium text-primary">
                    {o.items.reduce((s, i) => s + i.quantity, 0)} item(s)
                  </span>
                </div>
              ))
            }
          </div>
        </Card>
      )}

      {/* Recent Orders */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Recent Orders</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate(CUSTOMER_ROUTES.ORDER_HISTORY)}>
            View All
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {ordersLoading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading orders…</span>
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No orders yet</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => navigate(CUSTOMER_ROUTES.PLACE_ORDER)}
            >
              Place your first order
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {recentOrders.map(order => {
              const cfg = STATUS_CFG[order.status] ?? {
                pill: 'bg-muted text-muted-foreground border-border',
                dot:  'bg-border',
              };
              const itemSummary = order.items
                .map(i => `${i.product_name || 'Item'} ×${i.quantity}`)
                .join(', ');
              const statusLabel = order.status.charAt(0) + order.status.slice(1).toLowerCase().replace('_', ' ');

              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between py-3 border-b last:border-0 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-muted hidden sm:block shrink-0">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {itemSummary || 'No items'}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(order.created_at).toLocaleDateString('en-KE', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="font-bold text-sm">
                      KES {parseFloat(order.total_amount).toLocaleString()}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      {statusLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

    </CustomerLayout>
  );
};

export default CustomerDashboard;
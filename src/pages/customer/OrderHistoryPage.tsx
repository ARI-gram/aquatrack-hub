/**
 * Order History Page — Customer Portal
 * Route: /customer/history
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Search,
  Package,
  Clock,
  Loader2,
  MapPin,
  CreditCard,
  Truck,
  CalendarDays,
  InboxIcon,
  CheckCircle2,
  AlertCircle,
  Droplets,
  SlidersHorizontal,
  ArrowUpRight,
  Receipt,
} from 'lucide-react';
import axiosInstance from '@/api/axios.config';
import { CUSTOMER_API_ENDPOINTS } from '@/api/customerEndpoints';
import { toast } from 'sonner';
import { CustomerReceiptModal } from '@/components/customer/CustomerReceiptModal';
import type { CustomerOrderForReceipt } from '@/components/customer/CustomerReceiptModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItemResponse {
  id:           string;
  product:      string | null;
  product_name: string;
  product_unit: string;
  quantity:     number;
  unit_price:   string;
  subtotal:     string;
}

interface OrderDeliveryResponse {
  scheduled_date:       string;
  scheduled_time_slot:  string;
  address_label:        string;
  full_address:         string;
  driver_name:          string | null;
  driver_phone:         string | null;
  actual_delivery_time: string | null;
  delivery_notes:       string;
}

interface OrderResponse {
  id:                  string;
  order_number:        string;
  order_type:          string;
  status:              string;
  subtotal:            string;
  delivery_fee:        string;
  discount_amount:     string;
  total_amount:        string;
  payment_status:      string;
  payment_method:      string;
  paid_at:             string | null;
  special_instructions: string;
  items:               OrderItemResponse[];
  delivery:            OrderDeliveryResponse | null;
  created_at:          string;
  updated_at:          string;
}

type OrderListResponse = OrderResponse[] | { results: OrderResponse[]; count: number };

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string; pill: string; dot: string; accent: string; bg: string;
}> = {
  PENDING:    { label: 'Pending',    pill: 'text-amber-700   border-amber-200/80',  dot: 'bg-amber-400',   accent: 'bg-amber-400',   bg: 'bg-amber-50/60'   },
  CONFIRMED:  { label: 'Confirmed',  pill: 'text-sky-700     border-sky-200/80',    dot: 'bg-sky-500',     accent: 'bg-sky-500',     bg: 'bg-sky-50/60'     },
  ASSIGNED:   { label: 'Assigned',   pill: 'text-indigo-700  border-indigo-200/80', dot: 'bg-indigo-500',  accent: 'bg-indigo-500',  bg: 'bg-indigo-50/60'  },
  PICKED_UP:  { label: 'Picked Up',  pill: 'text-cyan-700    border-cyan-200/80',   dot: 'bg-cyan-500',    accent: 'bg-cyan-500',    bg: 'bg-cyan-50/60'    },
  IN_TRANSIT: { label: 'In Transit', pill: 'text-violet-700  border-violet-200/80', dot: 'bg-violet-500',  accent: 'bg-violet-500',  bg: 'bg-violet-50/60'  },
  ARRIVED:    { label: 'Arrived',    pill: 'text-teal-700    border-teal-200/80',   dot: 'bg-teal-500',    accent: 'bg-teal-500',    bg: 'bg-teal-50/60'    },
  DELIVERED:  { label: 'Delivered',  pill: 'text-emerald-700 border-emerald-200/80',dot: 'bg-emerald-500', accent: 'bg-emerald-500', bg: 'bg-emerald-50/60' },
  COMPLETED:  { label: 'Completed',  pill: 'text-emerald-700 border-emerald-200/80',dot: 'bg-emerald-500', accent: 'bg-emerald-500', bg: 'bg-emerald-50/60' },
  CANCELLED:  { label: 'Cancelled',  pill: 'text-red-600     border-red-200/80',    dot: 'bg-red-400',     accent: 'bg-red-400',     bg: 'bg-red-50/60'     },
};

const PAYMENT_LABELS: Record<string, string> = {
  WALLET: 'Wallet',
  CASH:   'Cash on Delivery',
  MPESA:  'M-Pesa',
  CARD:   'Card',
  CREDIT: 'Invoice',
  CHEQUE: 'Cheque',
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: 'Unpaid',   cls: 'text-amber-700   bg-amber-50   border-amber-200'   },
  PAID:     { label: 'Paid',     cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  FAILED:   { label: 'Failed',   cls: 'text-red-700     bg-red-50     border-red-200'     },
  REFUNDED: { label: 'Refunded', cls: 'text-blue-700    bg-blue-50    border-blue-200'    },
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  REFILL:     'Refill',
  NEW_BOTTLE: 'New Bottle',
  MIXED:      'Mixed',
};

const RECEIPT_STATUSES = new Set(['DELIVERED', 'COMPLETED']);

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return s; }
};

const fmtDateTime = (s: string) => {
  try {
    return new Date(s).toLocaleString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return s; }
};

function extractOrders(data: OrderListResponse): OrderResponse[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { results: OrderResponse[] }).results))
    return (data as { results: OrderResponse[] }).results;
  return [];
}

// ── Status Pill ───────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return <span className="text-xs border rounded-full px-2.5 py-1">{status}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full font-medium tracking-wide ${cfg.pill} ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[11px] px-2.5 py-1'}`}>
      <span className={`rounded-full shrink-0 ${cfg.dot} ${size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'}`} />
      {cfg.label}
    </span>
  );
};

// ── Order Detail Dialog ───────────────────────────────────────────────────────

const OrderDetailDialog: React.FC<{
  order: OrderResponse;
  onViewReceipt: () => void;
}> = ({ order, onViewReceipt }) => {
  const payStCfg  = PAYMENT_STATUS_CONFIG[order.payment_status];
  const statusCfg = STATUS_CONFIG[order.status];
  const [dialogOpen, setDialogOpen] = useState(false);

  const canViewReceipt = RECEIPT_STATUSES.has(order.status);

  const handleViewReceipt = () => {
    setDialogOpen(false);           // close dialog first
    setTimeout(onViewReceipt, 150); // open receipt after dialog animates out
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <button className="group inline-flex items-center gap-1 text-[11px] font-semibold text-primary/80 hover:text-primary transition-colors">
            View details
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </DialogTrigger>

        <DialogContent
          aria-describedby="order-detail-desc"
          className="max-w-md w-[calc(100vw-1.5rem)] mx-auto rounded-3xl max-h-[92vh] overflow-y-auto p-0 gap-0 shadow-2xl border-0"
        >
          <div className={`${statusCfg?.bg ?? 'bg-muted/30'} px-6 pt-6 pb-5 rounded-t-3xl border-b border-border/50`}>
            <DialogHeader>
              <DialogTitle className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-1.5">
                    Order Details
                  </p>
                  <p className="font-mono font-bold text-xl tracking-tight">{order.order_number}</p>
                  <p id="order-detail-desc" className="text-xs text-muted-foreground mt-1">
                    {fmtDate(order.created_at)}
                  </p>
                </div>
                <StatusPill status={order.status} />
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-5">

            <div className="grid grid-cols-2 gap-2">
              {([
                ['Order Type', ORDER_TYPE_LABELS[order.order_type] ?? order.order_type],
                ['Payment',    PAYMENT_LABELS[order.payment_method] ?? order.payment_method],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} className="bg-muted/30 rounded-2xl p-3.5 border border-border/40">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">{label}</p>
                  <p className="text-sm font-semibold">{val}</p>
                </div>
              ))}
              <div className="bg-muted/30 rounded-2xl p-3.5 border border-border/40 col-span-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                  Payment Status
                </p>
                <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full border ${payStCfg?.cls ?? ''}`}>
                  {payStCfg?.label ?? order.payment_status}
                </span>
              </div>
            </div>

            {order.delivery && (
              <div className="rounded-2xl border border-border/50 overflow-hidden">
                <div className="bg-muted/20 px-4 py-3 border-b border-border/40 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Truck className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Delivery Info
                  </p>
                </div>
                <div className="px-4 py-4 space-y-3.5">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">{order.delivery.scheduled_date}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{order.delivery.scheduled_time_slot}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">{order.delivery.address_label}</p>
                      {order.delivery.full_address && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{order.delivery.full_address}</p>
                      )}
                    </div>
                  </div>
                  {order.delivery.driver_name && (
                    <div className="flex items-center gap-3 pt-3 border-t border-border/40">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0 ring-2 ring-primary/10">
                        <span className="text-xs font-bold text-primary">
                          {order.delivery.driver_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{order.delivery.driver_name}</p>
                        {order.delivery.driver_phone && (
                          <p className="text-xs text-muted-foreground">{order.delivery.driver_phone}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {order.delivery.actual_delivery_time && (
                    <div className="flex items-center gap-2.5 py-2.5 px-3.5 bg-emerald-50 rounded-xl border border-emerald-100">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <p className="text-xs text-emerald-700 font-medium">
                        Delivered · {fmtDateTime(order.delivery.actual_delivery_time)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border/50 overflow-hidden">
              <div className="bg-muted/20 px-4 py-3 border-b border-border/40 flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Items · {order.items.length}
                </p>
              </div>
              <div className="divide-y divide-border/40">
                {order.items.map(item => (
                  <div key={item.id} className="flex items-center gap-3.5 px-4 py-3.5">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center shrink-0">
                      {item.product_unit === 'LITRES'
                        ? <Droplets className="h-4 w-4 text-sky-500" />
                        : <Package  className="h-4 w-4 text-violet-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.product_name || '—'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        KES {parseFloat(item.unit_price).toLocaleString()} × {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-bold shrink-0 tabular-nums">
                      KES {parseFloat(item.subtotal).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 overflow-hidden">
              <div className="divide-y divide-border/40 text-sm">
                <div className="flex justify-between px-4 py-3">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">KES {parseFloat(order.subtotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="text-muted-foreground">Delivery fee</span>
                  <span className="tabular-nums">KES {parseFloat(order.delivery_fee).toLocaleString()}</span>
                </div>
                {parseFloat(order.discount_amount) > 0 && (
                  <div className="flex justify-between px-4 py-3 text-emerald-600">
                    <span>Discount</span>
                    <span className="tabular-nums">−KES {parseFloat(order.discount_amount).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-4 font-bold text-base bg-muted/20">
                  <span>Total</span>
                  <span className="tabular-nums">KES {parseFloat(order.total_amount).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {order.special_instructions && (
              <div className="flex gap-3 p-4 rounded-2xl bg-amber-50/80 border border-amber-100">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800 mb-1 uppercase tracking-wider">Delivery Note</p>
                  <p className="text-xs text-amber-700 leading-relaxed">{order.special_instructions}</p>
                </div>
              </div>
            )}

            {/* ── Receipt button — same style as DriverHistoryPage ── */}
            {canViewReceipt && (
              <button
                onClick={handleViewReceipt}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-sm hover:bg-emerald-100 transition-colors active:scale-[0.98] dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
              >
                <Receipt className="h-4 w-4" />
                View / Download Receipt
              </button>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ── Order Card ────────────────────────────────────────────────────────────────

const OrderCard: React.FC<{ order: OrderResponse }> = ({ order }) => {
  const cfg = STATUS_CONFIG[order.status];
  const [showReceipt, setShowReceipt] = useState(false);

  const itemSummary = order.items
    .map(i => `${i.product_name || 'Item'} ×${i.quantity}`)
    .join(' · ');

  return (
  <>
    <div className="group bg-card border border-border/60 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-black/5 hover:border-border">
      <div className="flex">
        <div className={`w-1 shrink-0 ${cfg?.accent ?? 'bg-border'}`} />
        <div className="flex-1 px-4 pt-4 pb-4 space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-mono font-bold text-sm tracking-tight">{order.order_number}</p>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-medium">
                  {ORDER_TYPE_LABELS[order.order_type] ?? order.order_type}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-2.5 w-2.5" />
                {fmtDate(order.created_at)}
              </p>
            </div>
            <StatusPill status={order.status} size="sm" />
          </div>

          {itemSummary && (
            <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2.5">
              <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground truncate">{itemSummary}</p>
            </div>
          )}

          <div className="flex items-end justify-between gap-2 pt-0.5">
            <div className="space-y-1.5">
              {order.delivery?.scheduled_date && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Truck className="h-3 w-3 shrink-0" />
                  <span>{order.delivery.scheduled_date}</span>
                  <span className="text-border">·</span>
                  <span>{order.delivery.scheduled_time_slot}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CreditCard className="h-3 w-3 shrink-0" />
                <span>{PAYMENT_LABELS[order.payment_method] ?? order.payment_method}</span>
                {order.payment_status === 'PAID' && (
                  <span className="text-emerald-600 font-medium">· Paid</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <p className="font-bold text-lg leading-none tabular-nums">
                KES {parseFloat(order.total_amount).toLocaleString()}
              </p>
              <OrderDetailDialog order={order} onViewReceipt={() => setShowReceipt(true)} />
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Receipt modal lives here — outside Dialog, no z-index conflict */}
    {showReceipt && (
      <CustomerReceiptModal
        open={showReceipt}
        onClose={() => setShowReceipt(false)}
        order={order as unknown as CustomerOrderForReceipt}
      />
    )}
  </>
  );
};

// ── Stat Chip ─────────────────────────────────────────────────────────────────

const StatChip: React.FC<{ label: string; val: number | string; cls: string }> = ({ label, val, cls }) => (
  <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-xs font-medium shrink-0 ${cls}`}>
    <span className="text-lg font-bold leading-none tabular-nums">{val}</span>
    <span className="opacity-70 font-semibold uppercase tracking-wider text-[10px]">{label}</span>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

const OrderHistoryPage: React.FC = () => {
  const [orders,       setOrders]       = useState<OrderResponse[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get<OrderListResponse>(CUSTOMER_API_ENDPOINTS.ORDERS.LIST);
      setOrders(extractOrders(res.data));
    } catch {
      toast.error('Could not load your order history. Please refresh.');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount    = orders.filter(o => !['COMPLETED', 'CANCELLED', 'DELIVERED'].includes(o.status)).length;
  const completedCount = orders.filter(o => ['COMPLETED', 'DELIVERED'].includes(o.status)).length;
  const totalSpend     = orders
    .filter(o => o.payment_status === 'PAID')
    .reduce((s, o) => s + parseFloat(o.total_amount), 0);

  return (
    <CustomerLayout title="My Orders">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Order History</h1>
        <p className="text-sm text-muted-foreground mt-1">Track and manage all your orders</p>
      </div>

      {!isLoading && orders.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          <StatChip label="Total"     val={orders.length}                        cls="bg-muted/50    text-foreground  border-border/60"     />
          <StatChip label="Active"    val={activeCount}                          cls="bg-blue-50     text-blue-700    border-blue-200/60"   />
          <StatChip label="Completed" val={completedCount}                       cls="bg-emerald-50  text-emerald-700 border-emerald-200/60"/>
          <StatChip label="Spent"     val={`KES ${totalSpend.toLocaleString()}`} cls="bg-violet-50  text-violet-700  border-violet-200/60" />
        </div>
      )}

      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search orders…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-muted/30 border-border/50 focus:border-primary/40 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-border/50 text-sm w-auto gap-2 px-3.5 min-w-[44px]">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
            <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {statusFilter !== 'all' && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground">Showing:</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {STATUS_CONFIG[statusFilter]?.label ?? statusFilter}
            <button onClick={() => setStatusFilter('all')} className="hover:text-primary/60 transition-colors">×</button>
          </span>
          <span className="text-xs text-muted-foreground">{filteredOrders.length} result{filteredOrders.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-28 gap-3 text-muted-foreground">
          <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
          </div>
          <p className="text-sm font-medium">Loading your orders…</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <div className="h-20 w-20 rounded-3xl bg-muted/50 border border-border/60 flex items-center justify-center mb-5">
            <InboxIcon className="h-9 w-9 text-muted-foreground/30" />
          </div>
          <p className="font-bold text-lg mb-1">
            {orders.length === 0 ? 'No orders yet' : 'No results found'}
          </p>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            {orders.length === 0
              ? 'Your orders will appear here once you place one.'
              : 'Try a different search term or clear the filter.'}
          </p>
          {statusFilter !== 'all' && (
            <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={() => setStatusFilter('all')}>
              Clear filter
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
          <p className="text-center text-xs text-muted-foreground pt-2 pb-4">
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
            {statusFilter !== 'all' ? ` · filtered` : ''}
          </p>
        </div>
      )}
    </CustomerLayout>
  );
};

export default OrderHistoryPage;
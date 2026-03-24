/**
 * Client Orders Page
 * /src/pages/client/OrdersPage.tsx
 *
 * Wired to GET  /orders/all/        — list orders (scoped by client JWT)
 *          PATCH /orders/manage/{id}/ — update status
 *
 * "Make Delivery" replaces the old per-order "Assign Driver" flow.
 * It opens MakeDeliveryDialog which lets the admin bundle multiple
 * unassigned orders → schedule → assign driver in one step.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ManagerLayout } from '@/components/layout/ManagerLayout';
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
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Filter,
  MoreHorizontal,
  Loader2,
  RefreshCw,
  Eye,
  Truck,
  XCircle,
  CheckCircle2,
  MapPin,
  Package,
  CalendarDays,
  CreditCard,
  AlertTriangle,
  Droplets,
  ChevronRight,
  InboxIcon,
  AlertCircle,
  Plus,
} from 'lucide-react';
import axiosInstance from '@/api/axios.config';
import { toast } from 'sonner';
import { MakeDeliveryDialog } from '@/components/dialogs/MakeDeliveryDialog';

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

interface OrderDelivery {
  scheduled_date: string;
  scheduled_time_slot: string;
  address_label: string;
  full_address: string;
  driver_name: string | null;
  driver_phone: string | null;
  actual_delivery_time: string | null;
  delivery_notes: string;
}

interface BottleExchange {
  bottles_to_deliver: number;
  bottles_to_collect: number;
  bottles_delivered: number | null;
  bottles_collected: number | null;
  exchange_confirmed: boolean;
}

interface Order {
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
  delivery: OrderDelivery | null;
  bottle_exchange: BottleExchange | null;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_phone?: string;
}

type OrderListResponse = Order[] | { results: Order[]; count: number };

// ── Constants ─────────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  'PENDING', 'CONFIRMED', 'ASSIGNED', 'PICKED_UP',
  'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'COMPLETED', 'CANCELLED',
] as const;

type OrderStatus = typeof ORDER_STATUSES[number];

const STATUS_CFG: Record<string, { label: string; pill: string; dot: string; stripe: string }> = {
  PENDING:    { label: 'Pending',    pill: 'bg-amber-50   text-amber-700   border-amber-200',   dot: 'bg-amber-400',   stripe: 'bg-amber-300'   },
  CONFIRMED:  { label: 'Confirmed',  pill: 'bg-blue-50    text-blue-700    border-blue-200',    dot: 'bg-blue-500',    stripe: 'bg-blue-400'    },
  ASSIGNED:   { label: 'Assigned',   pill: 'bg-indigo-50  text-indigo-700  border-indigo-200',  dot: 'bg-indigo-500',  stripe: 'bg-indigo-400'  },
  PICKED_UP:  { label: 'Picked Up',  pill: 'bg-cyan-50    text-cyan-700    border-cyan-200',    dot: 'bg-cyan-500',    stripe: 'bg-cyan-400'    },
  IN_TRANSIT: { label: 'In Transit', pill: 'bg-violet-50  text-violet-700  border-violet-200',  dot: 'bg-violet-500',  stripe: 'bg-violet-400'  },
  ARRIVED:    { label: 'Arrived',    pill: 'bg-teal-50    text-teal-700    border-teal-200',    dot: 'bg-teal-500',    stripe: 'bg-teal-400'    },
  DELIVERED:  { label: 'Delivered',  pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', stripe: 'bg-emerald-400' },
  COMPLETED:  { label: 'Completed',  pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', stripe: 'bg-emerald-400' },
  CANCELLED:  { label: 'Cancelled',  pill: 'bg-red-50     text-red-700     border-red-200',     dot: 'bg-red-400',     stripe: 'bg-red-300'     },
};

const PAYMENT_LABELS: Record<string, string> = {
  WALLET: 'Wallet', CASH: 'Cash', MPESA: 'M-Pesa', CARD: 'Card', CREDIT: 'Invoice',
};

const PAY_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: 'Unpaid',   cls: 'bg-amber-50   text-amber-700   border-amber-200'   },
  PAID:     { label: 'Paid',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  FAILED:   { label: 'Failed',   cls: 'bg-red-50     text-red-700     border-red-200'     },
  REFUNDED: { label: 'Refunded', cls: 'bg-blue-50    text-blue-700    border-blue-200'    },
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  REFILL: 'Refill', NEW_BOTTLE: 'New Bottle', MIXED: 'Mixed',
};

// Statuses a client admin can manually advance an order to.
const ALLOWED_NEXT_STATUSES: Record<string, string[]> = {
  PENDING:    ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['CANCELLED'],
  ASSIGNED:   ['PICKED_UP', 'CANCELLED'],
  PICKED_UP:  ['IN_TRANSIT'],
  IN_TRANSIT: ['ARRIVED'],
  ARRIVED:    ['DELIVERED'],
  DELIVERED:  ['COMPLETED'],
  COMPLETED:  [],
  CANCELLED:  [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleDateString('en-KE', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return s; }
};

const fmtDateTime = (s: string) => {
  try {
    return new Date(s).toLocaleString('en-KE', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return s; }
};

function extractOrders(data: OrderListResponse): Order[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { results: Order[] }).results))
    return (data as { results: Order[] }).results;
  return [];
}

// ── StatusPill ────────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({
  status, size = 'md',
}) => {
  const cfg = STATUS_CFG[status];
  if (!cfg) return <span className="text-xs border rounded-full px-2 py-0.5">{status}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full font-semibold ${cfg.pill} ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ── Order Detail Dialog ───────────────────────────────────────────────────────

interface OrderDialogProps {
  order: Order;
  open: boolean;
  onClose: () => void;
  onStatusChange: (orderId: string, newStatus: string) => Promise<void>;
  onCancel: (orderId: string) => Promise<void>;
  canCancel?: boolean;
}

const OrderDialog: React.FC<OrderDialogProps> = ({
  order, open, onClose, onStatusChange, onCancel, canCancel = true,
}) => {
  const [loadingAction, setLoadingAction]         = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const payStCfg     = PAY_STATUS_CFG[order.payment_status];
  const nextStatuses = ALLOWED_NEXT_STATUSES[order.status] ?? [];
  const cancellable  = canCancel && !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.status);

  const handleStatusChange = async (s: string) => {
    setLoadingAction(`status-${s}`);
    await onStatusChange(order.id, s);
    setLoadingAction(null);
  };

  const handleCancel = async () => {
    setLoadingAction('cancel');
    await onCancel(order.id);
    setLoadingAction(null);
    setShowCancelConfirm(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] mx-auto rounded-2xl max-h-[92vh] overflow-y-auto p-0 gap-0">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-5 py-4 rounded-t-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground font-normal uppercase tracking-wider mb-0.5">
                  Order
                </p>
                <p className="font-mono font-bold text-base">{order.order_number}</p>
              </div>
              <StatusPill status={order.status} />
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-5 py-5 space-y-5">

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {([
              ['Customer', order.customer_name ?? '—'],
              ['Placed',   fmtDate(order.created_at)],
              ['Type',     ORDER_TYPE_LABELS[order.order_type] ?? order.order_type],
              ['Payment',  PAYMENT_LABELS[order.payment_method] ?? order.payment_method],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                  {label}
                </p>
                <p className="text-sm font-semibold truncate">{val}</p>
              </div>
            ))}
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                Pay Status
              </p>
              <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${payStCfg?.cls ?? ''}`}>
                {payStCfg?.label ?? order.payment_status}
              </span>
            </div>
          </div>

          {/* Delivery info */}
          {order.delivery && (
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-muted/40 px-4 py-2.5 border-b flex items-center gap-2">
                <Truck className="h-3.5 w-3.5 text-primary" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Delivery
                </p>
              </div>
              <div className="px-4 py-3 space-y-3">

                <div className="flex items-start gap-3">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{order.delivery.scheduled_date}</p>
                    <p className="text-xs text-muted-foreground">{order.delivery.scheduled_time_slot}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{order.delivery.address_label}</p>
                    {order.delivery.full_address && (
                      <p className="text-xs text-muted-foreground">{order.delivery.full_address}</p>
                    )}
                  </div>
                </div>

                {/* Driver row — read only (assignment is via Make Delivery) */}
                {order.delivery.driver_name ? (
                  <div className="flex items-center gap-2.5 pt-2 border-t">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {order.delivery.driver_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{order.delivery.driver_name}</p>
                      {order.delivery.driver_phone && (
                        <p className="text-xs text-muted-foreground">{order.delivery.driver_phone}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic pt-1">
                    No driver assigned yet — use <span className="font-semibold not-italic text-primary">Make Delivery</span> to assign.
                  </p>
                )}

                {order.delivery.actual_delivery_time && (
                  <div className="flex items-center gap-2 py-2 px-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <p className="text-xs text-emerald-700 font-medium">
                      Delivered · {fmtDateTime(order.delivery.actual_delivery_time)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="rounded-xl border overflow-hidden">
            <div className="bg-muted/40 px-4 py-2.5 border-b flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Items ({order.items.length})
              </p>
            </div>
            <div className="divide-y">
              {order.items.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    {item.product_unit === 'LITRES'
                      ? <Droplets className="h-4 w-4 text-sky-500" />
                      : <Package  className="h-4 w-4 text-violet-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.product_name || '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      KES {parseFloat(item.unit_price).toLocaleString()} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-bold shrink-0">
                    KES {parseFloat(item.subtotal).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Bill */}
          <div className="rounded-xl border overflow-hidden text-sm">
            <div className="divide-y">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Subtotal</span>
                <span>KES {parseFloat(order.subtotal).toLocaleString()}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Delivery</span>
                <span>KES {parseFloat(order.delivery_fee).toLocaleString()}</span>
              </div>
              {parseFloat(order.discount_amount) > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-emerald-600">
                  <span>Discount</span>
                  <span>−KES {parseFloat(order.discount_amount).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-3 font-bold text-base bg-muted/30">
                <span>Total</span>
                <span>KES {parseFloat(order.total_amount).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Special instructions */}
          {order.special_instructions && (
            <div className="flex gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800 mb-0.5">Customer Note</p>
                <p className="text-xs text-amber-700">{order.special_instructions}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Actions
            </p>

            {/* Status progression (excludes CANCELLED — handled separately below) */}
            {nextStatuses.filter(s => s !== 'CANCELLED').length > 0 && (
              <div className="flex flex-wrap gap-2">
                {nextStatuses.filter(s => s !== 'CANCELLED').map(s => (
                  <Button
                    key={s}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    disabled={loadingAction === `status-${s}`}
                    onClick={() => handleStatusChange(s)}
                  >
                    {loadingAction === `status-${s}`
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    }
                    Mark as {STATUS_CFG[s]?.label ?? s}
                  </Button>
                ))}
              </div>
            )}

            {/* Cancel — only shown if canCancel prop allows it */}
            {cancellable && (
              <div>
                {showCancelConfirm ? (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    <p className="text-xs text-red-700 flex-1">
                      Are you sure you want to cancel this order?
                    </p>
                    <Button
                      variant="destructive" size="sm" className="h-7 text-xs px-3 shrink-0"
                      disabled={loadingAction === 'cancel'}
                      onClick={handleCancel}
                    >
                      {loadingAction === 'cancel'
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : 'Confirm'
                      }
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 text-xs px-2 shrink-0"
                      onClick={() => setShowCancelConfirm(false)}
                    >
                      No
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline" size="sm"
                    className="gap-1.5 text-xs h-8 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setShowCancelConfirm(true)}
                  >
                    <XCircle className="h-3 w-3" />
                    Cancel Order
                  </Button>
                )}
              </div>
            )}

            {!cancellable && nextStatuses.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                No further actions available for this order.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Mobile Order Card ─────────────────────────────────────────────────────────

const OrderCard: React.FC<{ order: Order; onOpen: () => void }> = ({ order, onOpen }) => {
  const cfg         = STATUS_CFG[order.status];
  const itemSummary = order.items
    .map(i => `${i.product_name || 'Item'} ×${i.quantity}`)
    .join(' · ');

  return (
    <div className="bg-background border rounded-2xl overflow-hidden transition-shadow hover:shadow-md">
      <div className={`h-[3px] w-full ${cfg?.stripe ?? 'bg-border'}`} />
      <div className="px-4 pt-3 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono font-bold text-sm tracking-tight">{order.order_number}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {order.customer_name && (
                <span className="font-medium text-foreground">{order.customer_name} · </span>
              )}
              {fmtDate(order.created_at)}
            </p>
          </div>
          <StatusPill status={order.status} size="sm" />
        </div>

        {itemSummary && (
          <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground truncate">{itemSummary}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {order.delivery?.scheduled_date && (
              <span className="flex items-center gap-1">
                <Truck className="h-3 w-3 shrink-0" />
                {order.delivery.scheduled_date}
                {order.delivery.driver_name
                  ? ` · ${order.delivery.driver_name}`
                  : ' · No driver'
                }
              </span>
            )}
            <span className="flex items-center gap-1">
              <CreditCard className="h-3 w-3 shrink-0" />
              {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <p className="font-bold text-base leading-none">
              KES {parseFloat(order.total_amount).toLocaleString()}
            </p>
            <button
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary"
              onClick={onOpen}
            >
              Manage <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Desktop Table Row ─────────────────────────────────────────────────────────

const TableRow: React.FC<{ order: Order; onOpen: () => void; isEven: boolean }> = ({
  order, onOpen, isEven,
}) => {
  const cfg = STATUS_CFG[order.status];
  return (
    <tr
      className={`border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/40 ${isEven ? 'bg-muted/10' : 'bg-background'}`}
      onClick={onOpen}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg?.dot ?? 'bg-border'}`} />
          <span className="font-mono font-semibold text-sm">{order.order_number}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium">{order.customer_name ?? '—'}</p>
          {order.customer_phone && (
            <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm">{order.delivery?.scheduled_date ?? '—'}</p>
        {order.delivery?.scheduled_time_slot && (
          <p className="text-xs text-muted-foreground">{order.delivery.scheduled_time_slot}</p>
        )}
      </td>
      <td className="px-4 py-3">
        {order.delivery?.driver_name
          ? <p className="text-sm font-medium">{order.delivery.driver_name}</p>
          : <p className="text-xs text-muted-foreground italic">Unassigned</p>
        }
      </td>
      <td className="px-4 py-3">
        <StatusPill status={order.status} size="sm" />
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${PAY_STATUS_CFG[order.payment_status]?.cls ?? ''}`}>
          {PAY_STATUS_CFG[order.payment_status]?.label ?? order.payment_status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="font-bold text-sm">
          KES {parseFloat(order.total_amount).toLocaleString()}
        </span>
      </td>
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>
              <Eye className="h-4 w-4 mr-2" /> View &amp; Manage
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

interface OrdersPageProps {
  layout?:    'dashboard' | 'manager';
  canCancel?: boolean;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  layout = 'dashboard',
  canCancel: canCancelProp = true,
}) => {
  const [orders, setOrders]               = useState<Order[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [dateFilter, setDateFilter]       = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [makeDeliveryOpen, setMakeDeliveryOpen] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateFilter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        params.date_from = today;
        params.date_to   = today;
      } else if (dateFilter === 'week') {
        const from = new Date(); from.setDate(from.getDate() - 7);
        params.date_from = from.toISOString().split('T')[0];
      } else if (dateFilter === 'month') {
        const from = new Date(); from.setDate(from.getDate() - 30);
        params.date_from = from.toISOString().split('T')[0];
      }
      const res = await axiosInstance.get<OrderListResponse>('/orders/all/', { params });
      setOrders(extractOrders(res.data));
    } catch {
      toast.error('Could not load orders. Please refresh.');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await axiosInstance.patch(`/orders/manage/${orderId}/`, { status: newStatus });
      toast.success(`Order marked as ${STATUS_CFG[newStatus]?.label ?? newStatus}`);
      const patch = (o: Order) => o.id === orderId ? { ...o, status: newStatus } : o;
      setOrders(prev => prev.map(patch));
      setSelectedOrder(prev => prev?.id === orderId ? patch(prev) : prev);
    } catch {
      toast.error('Failed to update order status.');
    }
  };

  const handleCancel = async (orderId: string) => {
    try {
      await axiosInstance.patch(`/orders/manage/${orderId}/`, { status: 'CANCELLED' });
      toast.success('Order cancelled.');
      const patch = (o: Order) => o.id === orderId ? { ...o, status: 'CANCELLED' } : o;
      setOrders(prev => prev.map(patch));
      setSelectedOrder(prev => prev?.id === orderId ? patch(prev) : prev);
    } catch {
      toast.error('Failed to cancel order.');
    }
  };

  /**
   * Called by MakeDeliveryDialog after a successful batch assignment.
   * Optimistically marks all affected orders as ASSIGNED and refreshes.
   */
  const handleDeliveryMade = useCallback((orderIds: string[], driverName: string) => {
    setOrders(prev =>
      prev.map(o =>
        orderIds.includes(o.id)
          ? {
              ...o,
              status: 'ASSIGNED',
              delivery: o.delivery
                ? { ...o.delivery, driver_name: driverName }
                : o.delivery,
            }
          : o,
      ),
    );
  }, []);

  // ── Client-side search ─────────────────────────────────────────────────────

  const filteredOrders = orders.filter(o => {
    const q = searchQuery.toLowerCase();
    return (
      o.order_number.toLowerCase().includes(q) ||
      (o.customer_name ?? '').toLowerCase().includes(q)
    );
  });

  // ── Derived stats ──────────────────────────────────────────────────────────

  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const activeCount    = orders.filter(
    o => !['COMPLETED', 'CANCELLED', 'DELIVERED'].includes(o.status),
  ).length;
  const completedCount = orders.filter(
    o => ['COMPLETED', 'DELIVERED'].includes(o.status),
  ).length;
  const revenue = orders
    .filter(o => o.payment_status === 'PAID')
    .reduce((s, o) => s + parseFloat(o.total_amount), 0);

  // How many unassigned pending/confirmed orders exist (drives the badge on the button)
  const unassignedCount = orders.filter(
    o => ['PENDING', 'CONFIRMED'].includes(o.status) && !o.delivery?.driver_name,
  ).length;

  // ── Layout wrapper ─────────────────────────────────────────────────────────

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    layout === 'manager'
      ? <ManagerLayout title="Orders" subtitle="Manage and track all customer orders">{children}</ManagerLayout>
      : <DashboardLayout title="Orders" subtitle="Manage and track all customer orders">{children}</DashboardLayout>;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Wrapper>

      {/* ── Top bar: Make Delivery CTA ── */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex-1" />
        <Button
          className="gap-2 h-10 rounded-xl font-semibold shadow-sm"
          onClick={() => setMakeDeliveryOpen(true)}
        >
          <Truck className="h-4 w-4" />
          Make Delivery
          {unassignedCount > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center h-4.5 min-w-[18px] rounded-full bg-white/20 text-[10px] font-bold px-1">
              {unassignedCount}
            </span>
          )}
        </Button>
      </div>

      {/* Stats strip */}
      {!isLoading && orders.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-0.5 -mx-1 px-1">
          {[
            { label: 'Total',     val: orders.length,                     cls: 'bg-muted/60 text-foreground border-border'         },
            { label: 'Active',    val: activeCount,                       cls: 'bg-blue-50 text-blue-700 border-blue-200'          },
            { label: 'Completed', val: completedCount,                    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { label: 'Revenue',   val: `KES ${revenue.toLocaleString()}`, cls: 'bg-violet-50 text-violet-700 border-violet-200'    },
          ].map(({ label, val, cls }) => (
            <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold shrink-0 ${cls}`}>
              <span className="text-base font-bold leading-none">{val}</span>
              <span className="opacity-60">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${statusFilter === 'all' ? 'bg-foreground text-background border-foreground' : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border'}`}
        >
          All ({orders.length})
        </button>
        {(['PENDING', 'CONFIRMED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'] as OrderStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${statusFilter === s ? 'bg-foreground text-background border-foreground' : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border'}`}
          >
            {STATUS_CFG[s]?.label ?? s} ({statusCounts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* Search + date filter + refresh */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by order number or customer…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-muted/40 border-transparent focus:border-input"
          />
        </div>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="h-10 rounded-xl bg-muted/40 border-transparent text-sm w-full sm:w-44">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 days</SelectItem>
            <SelectItem value="month">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-10 rounded-xl gap-2 shrink-0"
          onClick={fetchOrders}
          disabled={isLoading}
        >
          {isLoading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RefreshCw className="h-4 w-4" />
          }
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary/50" />
          <p className="text-sm">Loading orders…</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
            <InboxIcon className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="font-semibold mb-1">
            {orders.length === 0 ? 'No orders yet' : 'No results found'}
          </p>
          <p className="text-sm text-muted-foreground">
            {orders.length === 0
              ? 'Customer orders will appear here as they come in.'
              : 'Try adjusting your search or filters.'
            }
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-2xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {['Order', 'Customer', 'Scheduled', 'Driver', 'Status', 'Payment', 'Total', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, i) => (
                  <TableRow
                    key={order.id}
                    order={order}
                    isEven={i % 2 === 0}
                    onOpen={() => setSelectedOrder(order)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onOpen={() => setSelectedOrder(order)}
              />
            ))}
          </div>
        </>
      )}

      {/* Order detail dialog */}
      {selectedOrder && (
        <OrderDialog
          order={selectedOrder}
          open={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
          onCancel={handleCancel}
          canCancel={canCancelProp}
        />
      )}

      {/* Make Delivery dialog */}
      <MakeDeliveryDialog
        open={makeDeliveryOpen}
        onClose={() => setMakeDeliveryOpen(false)}
        onDeliveryMade={handleDeliveryMade}
      />

    </Wrapper>
  );
};
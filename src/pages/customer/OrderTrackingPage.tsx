/**
 * Order Tracking Page — Customer Portal
 * Route: /customer/orders/:id/track
 *
 * Calls GET /api/customer/orders/{id}/track/ and renders:
 *   - Live status + progress bar
 *   - Timeline with timestamps
 *   - Driver info card (when assigned)
 *   - OTP code card (when active)
 *   - Delivery address + schedule
 *   - Order summary (items + total)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  CalendarDays,
  Truck,
  User,
  Phone,
  Car,
  KeyRound,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import axiosInstance from '@/api/axios.config';
import { toast } from 'sonner';
import { formatDistanceToNow, format, parseISO } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrackingTimeline {
  order_placed:    string | null;
  confirmed:       string | null;
  driver_assigned: string | null;
  picked_up:       string | null;
  in_transit:      string | null;
  arrived:         string | null;
  delivered:       string | null;
}

interface TrackingDriver {
  name:           string;
  phone:          string;
  vehicle_number: string;
}

interface TrackingData {
  order_id:            string;
  order_number:        string;
  status:              string;
  status_display:      string;
  scheduled_date:      string | null;
  scheduled_time_slot: string | null;
  delivery_address:    string | null;
  address_label:       string | null;
  estimated_arrival:   string | null;
  driver:              TrackingDriver | null;
  otp_code:            string | null;
  timeline:            TrackingTimeline;
  items_count:         number;
  total_amount:        string;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string;
  pill: string;
  dot: string;
  bar: string;
  progress: number;
}> = {
  PENDING:     { label: 'Pending',     pill: 'text-amber-700   border-amber-200/80 bg-amber-50',   dot: 'bg-amber-400',   bar: 'bg-amber-400',   progress: 10 },
  CONFIRMED:   { label: 'Confirmed',   pill: 'text-sky-700     border-sky-200/80   bg-sky-50',     dot: 'bg-sky-500',     bar: 'bg-sky-500',     progress: 25 },
  ASSIGNED:    { label: 'Assigned',    pill: 'text-indigo-700  border-indigo-200/80 bg-indigo-50', dot: 'bg-indigo-500',  bar: 'bg-indigo-500',  progress: 40 },
  PICKED_UP:   { label: 'Picked Up',   pill: 'text-cyan-700    border-cyan-200/80  bg-cyan-50',    dot: 'bg-cyan-500',    bar: 'bg-cyan-500',    progress: 55 },
  IN_TRANSIT:  { label: 'In Transit',  pill: 'text-violet-700  border-violet-200/80 bg-violet-50', dot: 'bg-violet-500',  bar: 'bg-violet-500',  progress: 70 },
  ARRIVED:     { label: 'Arrived',     pill: 'text-teal-700    border-teal-200/80  bg-teal-50',    dot: 'bg-teal-500',    bar: 'bg-teal-500',    progress: 85 },
  DELIVERED:   { label: 'Delivered',   pill: 'text-emerald-700 border-emerald-200/80 bg-emerald-50', dot: 'bg-emerald-500', bar: 'bg-emerald-500', progress: 100 },
  COMPLETED:   { label: 'Completed',   pill: 'text-emerald-700 border-emerald-200/80 bg-emerald-50', dot: 'bg-emerald-500', bar: 'bg-emerald-500', progress: 100 },
  CANCELLED:   { label: 'Cancelled',   pill: 'text-red-600     border-red-200/80   bg-red-50',     dot: 'bg-red-400',     bar: 'bg-red-400',     progress: 0  },
};

// ── Timeline steps config ─────────────────────────────────────────────────────

const TIMELINE_STEPS: { key: keyof TrackingTimeline; label: string; icon: React.ReactNode }[] = [
  { key: 'order_placed',    label: 'Order placed',      icon: <Package    className="h-3.5 w-3.5" /> },
  { key: 'confirmed',       label: 'Confirmed',         icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { key: 'driver_assigned', label: 'Driver assigned',   icon: <User       className="h-3.5 w-3.5" /> },
  { key: 'picked_up',       label: 'Picked up',         icon: <Truck      className="h-3.5 w-3.5" /> },
  { key: 'in_transit',      label: 'In transit',        icon: <Truck      className="h-3.5 w-3.5" /> },
  { key: 'arrived',         label: 'Arrived',           icon: <MapPin     className="h-3.5 w-3.5" /> },
  { key: 'delivered',       label: 'Delivered',         icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(s: string | null): string {
  if (!s) return '';
  try {
    return format(parseISO(s), 'MMM d · h:mm a');
  } catch {
    return s;
  }
}

function fmtRelative(s: string | null): string {
  if (!s) return '';
  try {
    return formatDistanceToNow(parseISO(s), { addSuffix: true });
  } catch {
    return '';
  }
}

// ── OTP Card ──────────────────────────────────────────────────────────────────

const OtpCard: React.FC<{ code: string }> = ({ code }) => (
  <Card className="p-5 border-amber-200/60 bg-amber-50/50">
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
        <KeyRound className="h-5 w-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900">Delivery Confirmation Code</p>
        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
          Share this code with the driver when they arrive to confirm receipt.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="font-mono text-3xl font-bold tracking-[0.25em] text-amber-900">
            {code}
          </span>
        </div>
      </div>
    </div>
  </Card>
);

// ── Driver Card ───────────────────────────────────────────────────────────────

const DriverCard: React.FC<{ driver: TrackingDriver }> = ({ driver }) => (
  <Card className="p-5">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      Your Driver
    </p>
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-2 ring-primary/10 shrink-0">
        <span className="text-base font-bold text-primary">
          {driver.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{driver.name}</p>
        {driver.phone && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{driver.phone}</p>
          </div>
        )}
      </div>
      {driver.vehicle_number && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border/50 shrink-0">
          <Car className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-semibold">{driver.vehicle_number}</span>
        </div>
      )}
    </div>
  </Card>
);

// ── Timeline ──────────────────────────────────────────────────────────────────

const Timeline: React.FC<{ timeline: TrackingTimeline; status: string }> = ({ timeline, status }) => {
  const isCancelled = status === 'CANCELLED';
  let currentStepIdx = -1;
  if (!isCancelled) {
    for (let i = TIMELINE_STEPS.length - 1; i >= 0; i--) {
      if (timeline[TIMELINE_STEPS[i].key]) { currentStepIdx = i; break; }
    }
  }

  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Delivery Timeline
      </p>
      <div className="space-y-0">
        {TIMELINE_STEPS.map((step, idx) => {
          const ts = timeline[step.key];
          const isDone      = !!ts;
          const isCurrent   = idx === currentStepIdx && !isCancelled;
          const isFuture    = !isDone && !isCurrent;

          return (
            <div key={step.key} className="flex gap-3">
              {/* Dot + connector */}
              <div className="flex flex-col items-center">
                <div className={`
                  h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors
                  ${isDone
                    ? 'bg-emerald-100 text-emerald-600'
                    : isCurrent
                    ? 'bg-primary/10 text-primary ring-2 ring-primary/20'
                    : 'bg-muted/60 text-muted-foreground/40'}
                `}>
                  {step.icon}
                </div>
                {idx < TIMELINE_STEPS.length - 1 && (
                  <div className={`w-px flex-1 my-1 min-h-[16px] transition-colors ${isDone ? 'bg-emerald-200' : 'bg-border/60'}`} />
                )}
              </div>

              {/* Label + timestamp */}
              <div className={`pb-4 flex-1 min-w-0 flex items-start justify-between gap-2 ${idx === TIMELINE_STEPS.length - 1 ? 'pb-0' : ''}`}>
                <div>
                  <p className={`text-sm font-medium leading-none mt-1 ${isFuture ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                    {step.label}
                  </p>
                  {isCurrent && !isDone && (
                    <p className="text-xs text-primary mt-1">In progress…</p>
                  )}
                </div>
                {ts && (
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-muted-foreground">{fmtTime(ts)}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{fmtRelative(ts)}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const OrderTrackingPage: React.FC = () => {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const [data, setData]       = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTracking = useCallback(async (quiet = false) => {
    if (!id) return;
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await axiosInstance.get<TrackingData>(`/api/customer/orders/${id}/track/`);
      setData(res.data);
    } catch {
      if (!quiet) toast.error('Could not load tracking information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { fetchTracking(); }, [fetchTracking]);

  // Auto-refresh every 30s for active orders
  useEffect(() => {
    if (!data) return;
    if (['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(data.status)) return;
    const timer = setInterval(() => fetchTracking(true), 30_000);
    return () => clearInterval(timer);
  }, [data, fetchTracking]);

  const cfg = data ? (STATUS_CONFIG[data.status] ?? STATUS_CONFIG['PENDING']) : null;
  const isTerminal = data && ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(data.status);

  return (
    <CustomerLayout title="Track Order">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Back + refresh */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => fetchTracking(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
            <p className="text-sm">Loading tracking info…</p>
          </div>
        )}

        {/* Error / not found */}
        {!loading && !data && (
          <div className="flex flex-col items-center justify-center py-28 text-center px-4">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <AlertCircle className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-base mb-1">Order not found</p>
            <p className="text-sm text-muted-foreground">
              We couldn't find tracking info for this order.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(-1)}>
              Go back
            </Button>
          </div>
        )}

        {/* Content */}
        {!loading && data && cfg && (
          <>
            {/* Status card */}
            <Card className="p-5 overflow-hidden">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                    Tracking Order
                  </p>
                  <p className="font-mono font-bold text-xl tracking-tight">{data.order_number}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 border rounded-full text-[11px] font-semibold px-2.5 py-1 ${cfg.pill}`}>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                  {cfg.label}
                </span>
              </div>

              {/* Progress bar */}
              {!isTerminal && (
                <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
                    style={{ width: `${cfg.progress}%` }}
                  />
                </div>
              )}

              {/* Terminal state */}
              {data.status === 'DELIVERED' || data.status === 'COMPLETED' ? (
                <div className="flex items-center gap-2 mt-3 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Delivered {data.timeline.delivered ? fmtRelative(data.timeline.delivered) : ''}
                  </span>
                </div>
              ) : data.status === 'CANCELLED' ? (
                <div className="flex items-center gap-2 mt-3 text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">This order was cancelled</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">
                  {data.status === 'IN_TRANSIT' || data.status === 'ARRIVED'
                    ? 'Your driver is on the way'
                    : 'Updates every 30 seconds'}
                </p>
              )}
            </Card>

            {/* OTP card — only if active */}
            {data.otp_code && <OtpCard code={data.otp_code} />}

            {/* Driver card */}
            {data.driver && <DriverCard driver={data.driver} />}

            {/* Delivery details */}
            <Card className="p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Delivery Details
              </p>

              {(data.scheduled_date || data.scheduled_time_slot) && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {data.scheduled_date ?? '—'}
                    </p>
                    {data.scheduled_time_slot && (
                      <p className="text-xs text-muted-foreground mt-0.5">{data.scheduled_time_slot}</p>
                    )}
                  </div>
                </div>
              )}

              {data.estimated_arrival && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated arrival</p>
                    <p className="text-sm font-semibold mt-0.5">{fmtTime(data.estimated_arrival)}</p>
                  </div>
                </div>
              )}

              {data.delivery_address && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    {data.address_label && (
                      <p className="text-sm font-semibold">{data.address_label}</p>
                    )}
                    <p className={`text-xs leading-relaxed ${data.address_label ? 'text-muted-foreground mt-0.5' : 'text-sm font-semibold'}`}>
                      {data.delivery_address}
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Order summary */}
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {data.items_count} item{data.items_count !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">Order total</p>
                  </div>
                </div>
                <p className="font-bold text-lg tabular-nums">
                  KES {parseFloat(data.total_amount).toLocaleString()}
                </p>
              </div>
            </Card>

            {/* Timeline */}
            <Timeline timeline={data.timeline} status={data.status} />

            {/* Bottom spacer */}
            <div className="pb-4" />
          </>
        )}
      </div>
    </CustomerLayout>
  );
};

export default OrderTrackingPage;
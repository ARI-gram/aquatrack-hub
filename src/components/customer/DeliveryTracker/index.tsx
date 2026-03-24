/**
 * DeliveryTracker Component — with OTP Confirmation Panel
 * /src/components/customer/DeliveryTracker/index.tsx
 *
 * Changes vs previous version:
 *   + OTP panel — shown when status is ASSIGNED / IN_TRANSIT / NEAR_YOU
 *     and tracking.otpCode is set.  Displays the 6 digits large + copy button.
 *   + scheduledSlot shown below order number
 *   + "Driver on the way" pulsing dot indicator
 *   + estimatedArrival ETA removed from types — read from tracking directly
 */

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  Circle,
  User,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import {
  CustomerOrderStatus,
  type DeliveryTrackingData,
} from '@/types/customerOrder.types';

interface DeliveryTrackerProps {
  tracking:       DeliveryTrackingData;
  onCallDriver?:  () => void;
  onTrackLive?:   () => void;
}

// ─────────────────────────────────────────────────────────────────────────────

export const DeliveryTracker: React.FC<DeliveryTrackerProps> = ({
  tracking,
  onCallDriver,
  onTrackLive,
}) => {
  const [otpCopied, setOtpCopied] = useState(false);

  // ── Progress bar value ──────────────────────────────────────────────────
  const getProgress = (): number => {
    const map: Record<CustomerOrderStatus, number> = {
      [CustomerOrderStatus.DRAFT]:                  0,
      [CustomerOrderStatus.PENDING_PAYMENT]:        10,
      [CustomerOrderStatus.PENDING_CONFIRMATION]:   20,
      [CustomerOrderStatus.CONFIRMED]:              35,
      [CustomerOrderStatus.ASSIGNED]:               50,
      [CustomerOrderStatus.IN_TRANSIT]:             65,
      [CustomerOrderStatus.NEAR_YOU]:               85,
      [CustomerOrderStatus.DELIVERED]:              95,
      [CustomerOrderStatus.EXCHANGE_PENDING]:       98,
      [CustomerOrderStatus.COMPLETED]:             100,
      [CustomerOrderStatus.CANCELLED]:               0,
      [CustomerOrderStatus.FAILED]:                  0,
    };
    return map[tracking.status] ?? 0;
  };

  // ── Status badge ──────────────────────────────────────────────────────────
  const getStatusBadge = () => {
    const cfg: Partial<Record<CustomerOrderStatus, { variant: 'default' | 'warning' | 'info' | 'success' | 'destructive'; label: string }>> = {
      [CustomerOrderStatus.PENDING_CONFIRMATION]: { variant: 'warning',     label: 'Pending' },
      [CustomerOrderStatus.CONFIRMED]:            { variant: 'info',        label: 'Confirmed' },
      [CustomerOrderStatus.ASSIGNED]:             { variant: 'info',        label: 'Driver Assigned' },
      [CustomerOrderStatus.IN_TRANSIT]:           { variant: 'info',        label: 'On The Way' },
      [CustomerOrderStatus.NEAR_YOU]:             { variant: 'success',     label: 'Almost There!' },
      [CustomerOrderStatus.DELIVERED]:            { variant: 'success',     label: 'Delivered' },
      [CustomerOrderStatus.COMPLETED]:            { variant: 'success',     label: 'Completed' },
      [CustomerOrderStatus.CANCELLED]:            { variant: 'destructive', label: 'Cancelled' },
      [CustomerOrderStatus.FAILED]:               { variant: 'destructive', label: 'Failed' },
    };
    const c = cfg[tracking.status] ?? { variant: 'default' as const, label: tracking.status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  // ── ETA text ──────────────────────────────────────────────────────────────
  const getETAText = (): string | null => {
    if (!tracking.estimatedArrival) return null;
    const eta   = new Date(tracking.estimatedArrival);
    const now   = new Date();
    const diff  = Math.max(0, Math.floor((eta.getTime() - now.getTime()) / 60_000));
    if (diff < 1)  return 'Arriving now';
    if (diff < 60) return `${diff} min away`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m away`;
  };

  // ── OTP copy helper ───────────────────────────────────────────────────────
  const handleCopyOtp = () => {
    if (!tracking.otpCode) return;
    navigator.clipboard.writeText(tracking.otpCode).then(() => {
      setOtpCopied(true);
      setTimeout(() => setOtpCopied(false), 2_000);
    });
  };

  // ── Should we show the OTP panel? ────────────────────────────────────────
  const showOtp =
    !!tracking.otpCode &&
    [
      CustomerOrderStatus.ASSIGNED,
      CustomerOrderStatus.IN_TRANSIT,
      CustomerOrderStatus.NEAR_YOU,
    ].includes(tracking.status);

  const etaText = getETAText();

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Card className="p-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Order #{tracking.orderNumber}
          </p>
          <h3 className="font-semibold text-lg">
            {tracking.bottles.toDeliver} Bottle{tracking.bottles.toDeliver !== 1 ? 's' : ''}
          </h3>
          {tracking.scheduledSlot && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {tracking.scheduledDate} · {tracking.scheduledSlot}
            </p>
          )}
        </div>
        {getStatusBadge()}
      </div>

      {/* ── Progress ────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <Progress value={getProgress()} className="h-2" />
        {etaText && (
          <div className="flex items-center gap-2 mt-2">
            <Clock className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">{etaText}</span>
          </div>
        )}
      </div>

      {/* ── OTP Panel ───────────────────────────────────────────────────── */}
      {showOtp && (
        <div className="mb-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-primary">
              Your Delivery Confirmation Code
            </p>
          </div>

          {/* Big OTP digits */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1.5">
              {tracking.otpCode!.split('').map((digit, i) => (
                <span
                  key={i}
                  className="flex h-10 w-8 items-center justify-center rounded-lg bg-background border border-border text-xl font-bold tabular-nums shadow-sm"
                >
                  {digit}
                </span>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyOtp}
              className="ml-2 h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              {otpCopied
                ? <Check className="h-4 w-4 text-success" />
                : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Give this code to your driver when they arrive. They must enter
            it to complete the delivery.
          </p>
        </div>
      )}

      {/* ── Driver Info ─────────────────────────────────────────────────── */}
      {tracking.driver && (
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-4">
          {/* Pulse indicator while actively in transit */}
          <div className="relative flex-shrink-0">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            {tracking.status === CustomerOrderStatus.IN_TRANSIT && (
              <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-success ring-2 ring-background">
                <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{tracking.driver.name}</p>
            <p className="text-sm text-muted-foreground truncate">
              {tracking.driver.vehicleNumber || 'Vehicle not set'}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onCallDriver}
            disabled={!tracking.driver.phone}
          >
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onTrackLive}>
          <MapPin className="h-4 w-4 mr-2" />
          Track Live
        </Button>
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      <div className="mt-6 pt-6 border-t border-border">
        <h4 className="font-medium text-sm text-muted-foreground mb-4">
          Order Timeline
        </h4>
        <OrderTimeline timeline={tracking.timeline} />
      </div>
    </Card>
  );
};

// ─── TIMELINE ─────────────────────────────────────────────────────────────────

interface OrderTimelineProps {
  timeline: DeliveryTrackingData['timeline'];
}

const OrderTimeline: React.FC<OrderTimelineProps> = ({ timeline }) => {
  const steps: { key: keyof typeof timeline; label: string }[] = [
    { key: 'orderPlaced',    label: 'Order Placed' },
    { key: 'confirmed',      label: 'Confirmed' },
    { key: 'driverAssigned', label: 'Driver Assigned' },
    { key: 'inTransit',      label: 'In Transit' },
    { key: 'arrived',        label: 'Driver Arrived' },
    { key: 'delivered',      label: 'Delivered' },
    { key: 'completed',      label: 'Completed' },
  ];

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const time        = timeline[step.key];
        const isCompleted = !!time;
        const isLast      = index === steps.length - 1;

        return (
          <div key={step.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              {isCompleted ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/30" />
              )}
              {!isLast && (
                <div
                  className={`w-0.5 h-6 mt-1 ${
                    isCompleted ? 'bg-success' : 'bg-muted-foreground/20'
                  }`}
                />
              )}
            </div>

            <div className="flex-1 pb-2">
              <p className={`text-sm font-medium ${isCompleted ? '' : 'text-muted-foreground'}`}>
                {step.label}
              </p>
              {time && (
                <p className="text-xs text-muted-foreground">
                  {new Date(time).toLocaleString('en-US', {
                    month:  'short',
                    day:    'numeric',
                    hour:   'numeric',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DeliveryTracker;
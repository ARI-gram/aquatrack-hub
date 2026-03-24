/**
 * AssignDriverDialog
 * src/components/dialogs/AssignDriverDialog.tsx
 *
 * Changes vs previous version:
 *  - Date picker pre-filled from order.delivery.scheduled_date
 *  - Time slot selector pre-filled from order.delivery.scheduled_time_slot
 *  - Vehicle number shown on driver cards
 *  - Sends scheduled_date + scheduled_time_slot to the API
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button }  from '@/components/ui/button';
import { Badge }   from '@/components/ui/badge';
import { Input }   from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Truck,
  CheckCircle2,
  Package,
  Loader2,
  User,
  Phone,
  AlertTriangle,
  ArrowRight,
  Clock,
  Calendar,
  Car,
} from 'lucide-react';
import { deliveryService, type Driver as BaseDriver } from '@/api/services/delivery.service';
type Driver = BaseDriver & { vehicle_number?: string };

import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderSummary {
  id: string;
  order_number: string;
  customer_name?: string;
  delivery?: {
    scheduled_date?: string;
    scheduled_time_slot?: string;
    address_label?: string;
    full_address?: string;
  } | null;
  items: { product_name: string; quantity: number }[];
  total_amount: string;
  status: string;
}

interface AssignDriverDialogProps {
  open: boolean;
  order: OrderSummary | null;
  onClose: () => void;
  onAssigned: (driverName: string) => void;
}

// ── Time slot options ─────────────────────────────────────────────────────────

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

/** Format "2026-03-10" → "2026-03-10" (keep as-is for <input type="date">) */
function toInputDate(s?: string): string {
  if (!s) return '';
  // Already YYYY-MM-DD? return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    return new Date(s).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function todayInputDate(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Driver Card ───────────────────────────────────────────────────────────────

const DriverCard: React.FC<{
  driver: Driver;
  selected: boolean;
  onSelect: () => void;
}> = ({ driver, selected, onSelect }) => {
  const completionPct =
    driver.today_assigned > 0
      ? Math.round((driver.today_completed / driver.today_assigned) * 100)
      : 0;

  const remaining = driver.today_assigned - driver.today_completed;

  const loadColor =
    driver.today_assigned === 0
      ? 'text-emerald-600'
      : driver.today_assigned >= 8
      ? 'text-red-500'
      : driver.today_assigned >= 5
      ? 'text-amber-500'
      : 'text-emerald-600';

  const initials = driver.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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
        {/* Avatar */}
        <div
          className={cn(
            'h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
            selected
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm truncate">{driver.name}</p>
            {selected && (
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {driver.phone && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <Phone className="h-2.5 w-2.5" />
                {driver.phone}
              </span>
            )}
            {/* Vehicle number — shown when present */}
            {driver.vehicle_number && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <Car className="h-2.5 w-2.5" />
                {driver.vehicle_number}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Workload bar */}
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
              completionPct === 100
                ? 'bg-emerald-500'
                : driver.today_assigned >= 8
                ? 'bg-red-400'
                : 'bg-primary',
            )}
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>
    </button>
  );
};

// ── Main Dialog ───────────────────────────────────────────────────────────────

export const AssignDriverDialog: React.FC<AssignDriverDialogProps> = ({
  open,
  order,
  onClose,
  onAssigned,
}) => {
  const [drivers, setDrivers]               = useState<Driver[]>([]);
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [isAssigning, setIsAssigning]       = useState(false);

  // Schedule state — pre-filled from order, editable by admin
  const [scheduledDate, setScheduledDate]           = useState('');
  const [scheduledTimeSlot, setScheduledTimeSlot]   = useState('');

  // Reset + prefill when dialog opens
  useEffect(() => {
    if (!open) {
      setSelectedDriverId(null);
      setScheduledDate('');
      setScheduledTimeSlot('');
      return;
    }

    // Pre-fill from order's existing delivery schedule
    const existingDate = toInputDate(order?.delivery?.scheduled_date);
    setScheduledDate(existingDate || todayInputDate());
    setScheduledTimeSlot(order?.delivery?.scheduled_time_slot || TIME_SLOTS[2]); // default 10–12

    const load = async () => {
      setIsLoadingDrivers(true);
      try {
        const data = await deliveryService.getAvailableDrivers();
        setDrivers(data);
      } catch {
        toast.error('Could not load drivers.');
      } finally {
        setIsLoadingDrivers(false);
      }
    };
    load();
  }, [open, order]);

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId) ?? null;

  const handleAssign = async () => {
    if (!order || !selectedDriverId || !selectedDriver) return;

    setIsAssigning(true);
    try {
      await deliveryService.assignOrderToDriver(
        order.id,
        selectedDriverId,
        scheduledDate || undefined,
        scheduledTimeSlot || undefined,
      );
      toast.success(`${selectedDriver.name} assigned to ${order.order_number}`);
      onAssigned(selectedDriver.name);
      onClose();
    } catch {
      toast.error('Failed to assign driver. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  };

  if (!order) return null;

  const itemSummary = order.items
    .slice(0, 3)
    .map((i) => `${i.product_name} ×${i.quantity}`)
    .join(', ');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md w-[calc(100vw-1.5rem)] mx-auto rounded-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-5 py-4 rounded-t-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Truck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">Assign Driver</p>
                <p className="text-[11px] text-muted-foreground font-normal font-mono">
                  {order.order_number}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-5 py-5 space-y-5">

          {/* Order summary */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                {order.customer_name && (
                  <p className="font-semibold text-sm">{order.customer_name}</p>
                )}
              </div>
              <p className="font-bold text-sm shrink-0">
                KES {parseFloat(order.total_amount).toLocaleString()}
              </p>
            </div>

            {order.delivery?.address_label && (
              <p className="text-xs text-muted-foreground truncate">
                📍 {order.delivery.address_label}
                {order.delivery.full_address &&
                  ` — ${order.delivery.full_address}`}
              </p>
            )}

            {itemSummary && (
              <div className="flex items-center gap-2 pt-1 border-t">
                <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground truncate">{itemSummary}</p>
              </div>
            )}
          </div>

          {/* ── Schedule picker ──────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Delivery Schedule
            </p>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                Delivery Date
              </label>
              <Input
                type="date"
                value={scheduledDate}
                min={todayInputDate()}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="h-9 text-sm rounded-xl"
              />
            </div>

            {/* Time slot */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Time Slot
              </label>
              <Select value={scheduledTimeSlot} onValueChange={setScheduledTimeSlot}>
                <SelectTrigger className="h-9 text-sm rounded-xl">
                  <SelectValue placeholder="Select time slot" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Driver list */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Select a Driver
            </p>

            {isLoadingDrivers ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
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
                {drivers.map((driver) => (
                  <DriverCard
                    key={driver.id}
                    driver={driver}
                    selected={selectedDriverId === driver.id}
                    onSelect={() =>
                      setSelectedDriverId(
                        selectedDriverId === driver.id ? null : driver.id,
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Reassign warning */}
          {order.status === 'ASSIGNED' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                This order is already assigned. Selecting a new driver will
                reassign it.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="sticky bottom-0 bg-background border-t px-5 py-4 rounded-b-2xl flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-10"
            onClick={onClose}
            disabled={isAssigning}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            className="flex-1 h-10 gap-2"
            disabled={!selectedDriverId || !scheduledDate || isAssigning}
            onClick={handleAssign}
          >
            {isAssigning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Assigning…
              </>
            ) : (
              <>
                Assign {selectedDriver?.name.split(' ')[0] ?? 'Driver'}
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
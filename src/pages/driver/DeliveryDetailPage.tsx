/**
 * src/pages/driver/DeliveryDetailPage.tsx
 * Mobile-first delivery detail with improved touch targets and layout
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DriverLayout } from '@/components/layout/DriverLayout';
import {
  MapPin, Phone, Navigation,
  CheckCircle, XCircle, Loader2, ChevronRight,
  AlertCircle, Check, ArrowRight,
  Droplets, X, KeyRound, ShieldCheck, Package,
} from 'lucide-react';
import { deliveryService, type DriverDeliveryDetail } from '@/api/services/delivery.service';
import { AcceptDeclineButtons } from '@/pages/driver/AcceptDeclineButtons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PROGRESS_STEPS: Array<{ status: string; label: string }> = [
  { status: 'ACCEPTED',    label: 'Accepted'    },
  { status: 'PICKED_UP',  label: 'Picked Up'   },
  { status: 'EN_ROUTE',   label: 'En Route'    },
  { status: 'ARRIVED',    label: 'Arrived'     },
  { status: 'IN_PROGRESS',label: 'In Progress' },
];

const STATUS_TO_TIMELINE: Record<string, string> = {
  ACCEPTED:    'accepted',
  PICKED_UP:   'picked_up',
  EN_ROUTE:    'started',
  ARRIVED:     'arrived',
  IN_PROGRESS: 'arrived',
};

// ─────────────────────────────────────────────────────────────────────────────
// Failure modal — bottom sheet on mobile
// ─────────────────────────────────────────────────────────────────────────────

const FAIL_REASONS = [
  'Customer not home',
  'Customer refused delivery',
  'Incorrect address',
  'Payment issue',
  'Access denied',
  'Other',
];

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
        {/* Handle */}
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
                key={r}
                onClick={() => setReason(r)}
                className={cn(
                  'w-full text-left text-sm font-semibold px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-[0.98]',
                  reason === r
                    ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300'
                    : 'bg-muted/30 border-border/50 text-foreground hover:border-border',
                )}
              >
                {r}
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
            className="w-full h-13 rounded-2xl bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-40 transition-colors active:scale-[0.98]"
            style={{ height: '52px' }}
          >
            {submitting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <XCircle className="h-4 w-4" />
            }
            Confirm Failed Delivery
          </button>
        </div>

        {/* Safe area */}
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

  const [delivery,     setDelivery]     = useState<DriverDeliveryDetail | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [updating,     setUpdating]     = useState(false);
  const [showFail,     setShowFail]     = useState(false);

  const [otpCode,      setOtpCode]      = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerified,  setOtpVerified]  = useState(false);

  const load = async (deliveryId: string) => {
    setLoading(true);
    try {
      const data = await deliveryService.getDriverDeliveryDetail(deliveryId);
      setDelivery(data);
    } catch {
      toast.error('Failed to load delivery details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) load(id); }, [id]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!id) return;
    setUpdating(true);
    try {
      await deliveryService.updateStatus(id, newStatus);
      toast.success(`Now: ${newStatus.replace(/_/g, ' ')}`);
      await load(id);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleFailed = async (reason: string, notes: string) => {
    if (!id) return;
    try {
      await deliveryService.updateStatus(id, 'FAILED', {
        failure_reason: reason.toUpperCase().replace(/ /g, '_'),
        failure_notes:  notes,
      });
      toast.success('Delivery marked as failed');
      navigate('/driver/deliveries');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleVerifyOTP = async () => {
    if (!id || otpCode.length !== 6) return;
    setOtpVerifying(true);
    try {
      const result = await deliveryService.verifyOTP(id, otpCode);
      setOtpVerified(true);
      setOtpCode('');
      const sibs = result.siblings_verified ?? 0;
      const msg = sibs
        ? `Code accepted! ${sibs} other order${sibs > 1 ? 's' : ''} for this customer also verified.`
        : 'Customer verified — you can now complete the delivery.';
      toast.success(msg);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Invalid code. Please try again.';
      toast.error(msg);
    } finally {
      setOtpVerifying(false);
    }
  };

  const isAssigned   = delivery?.status === 'ASSIGNED';
  const isTerminal   = ['COMPLETED', 'FAILED'].includes(delivery?.status ?? '');
  const isInProgress = !isAssigned && !isTerminal;

  const getStepState = (step: typeof PROGRESS_STEPS[number]) => {
    if (!delivery) return { isDone: false, isCurrent: false, isNext: false };
    const tlKey     = STATUS_TO_TIMELINE[step.status];
    const isDone    = !!delivery.timeline?.[tlKey as keyof typeof delivery.timeline];
    const isCurrent = delivery.status === step.status;
    const curIdx    = PROGRESS_STEPS.findIndex(s => s.status === delivery.status);
    const stepIdx   = PROGRESS_STEPS.findIndex(s => s.status === step.status);
    const isNext    = stepIdx === curIdx + 1;
    return { isDone, isCurrent, isNext };
  };

  const currentStepIdx = PROGRESS_STEPS.findIndex(s => s.status === delivery?.status);
  const totalSteps     = PROGRESS_STEPS.length;
  const progressPct    = delivery?.status === 'COMPLETED' ? 100
    : currentStepIdx >= 0 ? Math.round((currentStepIdx / totalSteps) * 100) : 0;

  const nextStep = PROGRESS_STEPS.find((_, i) => i === currentStepIdx + 1);

  if (loading) return (
    <DriverLayout
      title="Delivery"
      subtitle="Loading…"
      showBackButton
      onBack={() => navigate('/driver/deliveries')}
    >
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </DriverLayout>
  );

  if (!delivery) return (
    <DriverLayout
      title="Delivery"
      subtitle="Not found"
      showBackButton
      onBack={() => navigate('/driver/deliveries')}
    >
      <div className="text-center py-16 border border-dashed rounded-2xl">
        <p className="text-muted-foreground mb-4">Delivery not found</p>
        <button
          onClick={() => navigate('/driver/deliveries')}
          className="text-sm text-primary underline"
        >
          Back to queue
        </button>
      </div>
    </DriverLayout>
  );

  return (
    <>
      <DriverLayout
        title={delivery.order?.order_number ?? 'Delivery'}
        subtitle={delivery.customer?.name ?? ''}
        showBackButton
        onBack={() => navigate('/driver/deliveries')}
      >
        <div className="space-y-3 pb-4">

          {/* ── ASSIGNED banner ──────────────────────────────────────────── */}
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

          {/* ── Progress bar ──────────────────────────────────────────────── */}
          {isInProgress && (
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold">
                  {PROGRESS_STEPS[currentStepIdx]?.label ?? 'Starting'}
                </span>
                <span className="text-xs text-muted-foreground font-semibold">
                  {progressPct}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {/* Step dots — always visible */}
              <div className="flex justify-between mt-2.5">
                {PROGRESS_STEPS.map(s => {
                  const { isDone, isCurrent } = getStepState(s);
                  return (
                    <div key={s.status} className="flex flex-col items-center gap-1">
                      <div className={cn(
                        'h-2.5 w-2.5 rounded-full transition-all',
                        isDone || isCurrent ? 'bg-primary' : 'bg-muted-foreground/25',
                      )} />
                      <span className={cn(
                        'text-[9px] font-bold',
                        isCurrent ? 'text-primary' : 'text-muted-foreground/50',
                      )}>
                        {s.label.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Terminal banners ──────────────────────────────────────────── */}
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

          {/* ── Primary CTA — next step ───────────────────────────────────── */}
          {isInProgress && nextStep && (
            <button
              onClick={() => handleStatusUpdate(nextStep.status)}
              disabled={updating}
              className={cn(
                'w-full h-14 rounded-2xl flex items-center justify-center gap-3 font-bold text-base',
                'bg-primary text-primary-foreground shadow-md shadow-primary/20',
                'hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50',
              )}
            >
              {updating
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <><ArrowRight className="h-5 w-5" />Mark as {nextStep.label}</>
              }
            </button>
          )}

          {/* ── OTP entry ────────────────────────────────────────────────── */}
          {isInProgress && !otpVerified && (
            <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-indigo-600 shrink-0" />
                <p className="font-bold text-sm text-indigo-800 dark:text-indigo-300">
                  Customer Verification Code
                </p>
              </div>
              <p className="text-xs text-indigo-700 dark:text-indigo-400">
                Ask the customer for the 6-digit code sent to their email when you accepted
                this delivery. One code covers all orders for this customer.
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
                  placeholder="6-digit code"
                  className="flex-1 h-12 rounded-xl border-2 border-indigo-200 bg-white dark:bg-indigo-900/30 px-4 text-base font-mono font-bold tracking-[0.4em] focus:outline-none focus:border-indigo-400 text-center"
                />
                <button
                  onClick={handleVerifyOTP}
                  disabled={otpCode.length !== 6 || otpVerifying}
                  className={cn(
                    'h-12 px-5 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.97]',
                    otpCode.length === 6 && !otpVerifying
                      ? 'bg-indigo-600 hover:bg-indigo-700 border border-indigo-700 shadow-sm'
                      : 'bg-muted border border-border/50 text-muted-foreground cursor-default',
                  )}
                >
                  {otpVerifying
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : 'Verify'
                  }
                </button>
              </div>
            </div>
          )}

          {/* OTP verified */}
          {isInProgress && otpVerified && (
            <div className="flex items-center gap-3 px-4 py-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl dark:bg-emerald-950/30 dark:border-emerald-800">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  Customer verified ✓
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400">
                  You can now complete this delivery.
                </p>
              </div>
            </div>
          )}

          {/* ── Customer + address ───────────────────────────────────────── */}
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

            {/* Action buttons — full width on mobile */}
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

          {/* ── Order items ───────────────────────────────────────────────── */}
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

          {/* ── Schedule ─────────────────────────────────────────────────── */}
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

          {/* ── Progress steps ────────────────────────────────────────────── */}
          {isInProgress && (
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
                Progress Steps
              </h3>
              <div className="space-y-2">
                {PROGRESS_STEPS.map((step, i) => {
                  const { isDone, isCurrent, isNext } = getStepState(step);
                  const canPress = !isTerminal && isNext && !updating;
                  return (
                    <button
                      key={step.status}
                      onClick={() => canPress && handleStatusUpdate(step.status)}
                      disabled={!canPress}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all',
                        isDone
                          ? 'bg-emerald-50 border-emerald-200/60 dark:bg-emerald-950/20 dark:border-emerald-900 cursor-default'
                          : isCurrent
                          ? 'bg-primary/8 border-primary/20 cursor-default'
                          : isNext
                          ? 'bg-card border-border hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98]'
                          : 'bg-muted/20 border-border/40 cursor-default opacity-50',
                      )}
                    >
                      <div className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all',
                        isDone      ? 'bg-emerald-500 text-white'
                        : isCurrent ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2'
                        : isNext    ? 'bg-muted border-2 border-border'
                        : 'bg-muted/40',
                      )}>
                        {isDone
                          ? <Check className="h-4 w-4" />
                          : <span className="text-[11px] font-black">{i + 1}</span>
                        }
                      </div>
                      <span className={cn(
                        'text-sm font-semibold flex-1',
                        isDone      ? 'text-emerald-700 dark:text-emerald-400'
                        : isCurrent ? 'text-primary'
                        : 'text-foreground',
                      )}>
                        {step.label}
                      </span>
                      {isDone    && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
                      {isCurrent && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                          Current
                        </span>
                      )}
                      {isNext && !isTerminal && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Fail delivery ─────────────────────────────────────────────── */}
          {isInProgress && (
            <button
              onClick={() => setShowFail(true)}
              className="w-full h-13 rounded-2xl border border-red-200 bg-red-50 text-red-700 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors active:scale-[0.98]"
              style={{ height: '52px' }}
            >
              <XCircle className="h-4 w-4" />
              Report Failed Delivery
            </button>
          )}

        </div>
      </DriverLayout>

      {showFail && (
        <FailureModal
          onClose={() => setShowFail(false)}
          onSubmit={handleFailed}
        />
      )}
    </>
  );
};

export default DeliveryDetailPage;
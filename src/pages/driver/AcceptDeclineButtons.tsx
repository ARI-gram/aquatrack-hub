/**
 * src/pages/driver/AcceptDeclineButtons.tsx
 *
 * Mobile-optimised Accept / Decline buttons with bottom sheet for decline.
 */

import React, { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { deliveryService } from '@/api/services/delivery.service';

// ── Decline reason bottom sheet ───────────────────────────────────────────────

const DECLINE_REASONS = [
  'Vehicle breakdown',
  'Route too far',
  'Already at capacity',
  'Personal emergency',
  'Other',
];

const DeclineReasonSheet: React.FC<{
  orderNumber: string;
  onConfirm:   (reason: string) => void;
  onCancel:    () => void;
  loading:     boolean;
}> = ({ orderNumber, onConfirm, onCancel, loading }) => {
  const [selected, setSelected] = useState('');
  const [custom,   setCustom]   = useState('');

  const reason = selected === 'Other' ? custom.trim() : selected;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-background rounded-t-3xl shadow-2xl z-10 overflow-hidden">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        <div className="px-5 pb-2 pt-3">
          <p className="font-bold text-base">Decline delivery</p>
          <p className="text-xs text-muted-foreground mt-1">
            Order <span className="font-mono font-bold">{orderNumber}</span> will be
            returned to the queue. Select a reason:
          </p>
        </div>

        <div className="px-4 pb-3 space-y-2">
          {DECLINE_REASONS.map(r => (
            <button
              key={r}
              onClick={() => { setSelected(r); if (r !== 'Other') setCustom(''); }}
              className={cn(
                'w-full text-left text-sm font-semibold px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-[0.98]',
                selected === r
                  ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-300'
                  : 'border-border/60 bg-muted/30 text-foreground',
              )}
            >
              {r}
            </button>
          ))}
        </div>

        {selected === 'Other' && (
          <div className="px-4 pb-3">
            <textarea
              rows={2}
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="Briefly describe the reason…"
              className="w-full rounded-2xl border-2 border-border/60 bg-muted/30 px-4 py-3 text-sm focus:outline-none focus:border-red-300 resize-none"
            />
          </div>
        )}

        <div className="px-4 pb-6 pt-1 flex gap-3" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-12 rounded-2xl border-2 border-border/60 text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason || loading}
            className={cn(
              'flex-1 h-12 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98]',
              reason && !loading
                ? 'bg-red-500 hover:bg-red-600 border-2 border-red-600 shadow-sm'
                : 'bg-muted border-2 border-border/40 text-muted-foreground cursor-default',
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Declining…
              </span>
            ) : 'Confirm Decline'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

interface AcceptDeclineButtonsProps {
  deliveryId:  string;
  orderNumber: string;
  size?:       'sm' | 'md';
  onAccepted:  () => void;
  onDeclined:  () => void;
}

export const AcceptDeclineButtons: React.FC<AcceptDeclineButtonsProps> = ({
  deliveryId,
  orderNumber,
  size = 'md',
  onAccepted,
  onDeclined,
}) => {
  const [accepting,       setAccepting]       = useState(false);
  const [showDecline,     setShowDecline]     = useState(false);
  const [decliningReason, setDecliningReason] = useState(false);

  // Size variants — slightly larger on mobile for easier tapping
  const btnH    = size === 'sm' ? 'h-9 px-3.5 text-[12px]' : 'h-11 px-4 text-[13px]';
  const iconCls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await deliveryService.acceptDelivery(deliveryId);
      toast.success('Delivery accepted — customer sent their verification code');
      onAccepted();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Could not accept delivery';
      toast.error(msg);
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineConfirm = async (reason: string) => {
    setDecliningReason(true);
    try {
      await deliveryService.declineDelivery(deliveryId, reason);
      toast.info(`Order ${orderNumber} returned to queue for reassignment`);
      setShowDecline(false);
      onDeclined();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Could not decline delivery';
      toast.error(msg);
    } finally {
      setDecliningReason(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Accept */}
        <button
          onClick={handleAccept}
          disabled={accepting}
          className={cn(
            'flex items-center gap-2 rounded-xl font-bold text-white transition-all active:scale-[0.97]',
            'bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 shadow-sm shadow-emerald-500/20',
            accepting && 'opacity-70 cursor-default',
            btnH,
          )}
        >
          {accepting
            ? <Loader2 className={cn(iconCls, 'animate-spin')} />
            : <Check className={iconCls} />
          }
          {accepting ? 'Accepting…' : 'Accept'}
        </button>

        {/* Decline */}
        <button
          onClick={() => setShowDecline(true)}
          disabled={accepting}
          className={cn(
            'flex items-center gap-2 rounded-xl font-bold text-white transition-all active:scale-[0.97]',
            'bg-red-500 hover:bg-red-600 border border-red-600 shadow-sm shadow-red-500/20',
            accepting && 'opacity-40 cursor-default',
            btnH,
          )}
        >
          <X className={iconCls} />
          Decline
        </button>
      </div>

      {showDecline && (
        <DeclineReasonSheet
          orderNumber={orderNumber}
          onConfirm={handleDeclineConfirm}
          onCancel={() => setShowDecline(false)}
          loading={decliningReason}
        />
      )}
    </>
  );
};
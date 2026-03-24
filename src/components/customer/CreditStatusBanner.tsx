/**
 * CreditStatusBanner
 * src/components/customer/CreditStatusBanner.tsx
 *
 * Shows the appropriate credit account state:
 *   - OVERDUE + grace active  → amber warning with days remaining + request button
 *   - FROZEN                  → red block with contact message
 *   - Pending grace request   → info pill (waiting for office)
 *   - Normal active credit    → nothing (no banner)
 *
 * Used on: CustomerDashboard, PlaceOrderPage
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Lock, Clock, CheckCircle, ChevronRight, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import axiosInstance from '@/api/axios.config';
import { CUSTOMER_API_ENDPOINTS } from '@/api/customerEndpoints';
import { cn } from '@/lib/utils';

// ── Types (mirrors CreditStatusSerializer) ────────────────────────────────────

export interface CreditStatus {
  credit_enabled:        boolean;
  account_frozen:        boolean;
  credit_limit:          string;
  outstanding_balance:   string;
  available_credit:      string;
  billing_cycle:         string;
  billing_cycle_display: string;
  is_in_grace_period:    boolean;
  grace_days_remaining:  number | null;
  grace_until:           string | null;
  overdue_since:         string | null;
  pending_grace_request: {
    id: string;
    requested_days: number;
    reason: string;
    created_at: string;
  } | null;
}

interface Props {
  creditStatus: CreditStatus | null;
  onRequestSubmitted?: () => void;  // refresh parent after submitting
  /** Pass 'compact' on PlaceOrderPage to reduce vertical space */
  variant?: 'default' | 'compact';
}

// ── Grace Request Dialog ──────────────────────────────────────────────────────

interface GraceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const GraceRequestDialog: React.FC<GraceDialogProps> = ({ open, onClose, onSuccess }) => {
  const [days,      setDays]      = useState('7');
  const [reason,    setReason]    = useState('');
  const [loading,   setLoading]   = useState(false);

  const handleSubmit = async () => {
    const daysNum = parseInt(days, 10);
    if (!daysNum || daysNum < 1 || daysNum > 60) {
      toast.error('Enter a number of days between 1 and 60');
      return;
    }
    if (reason.trim().length < 10) {
      toast.error('Please provide a reason (at least 10 characters)');
      return;
    }

    setLoading(true);
    try {
      await axiosInstance.post(CUSTOMER_API_ENDPOINTS.CREDIT.GRACE_REQUEST, {
        requested_days: daysNum,
        reason: reason.trim(),
      });
      toast.success('Request submitted. The office will review it shortly.');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to submit request. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Grace Period Extension</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Explain why you need extra time to pay. The office will review your
            request and respond as soon as possible.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="grace-days">Extra days needed</Label>
            <Input
              id="grace-days"
              type="number"
              min={1}
              max={60}
              value={days}
              onChange={e => setDays(e.target.value)}
              placeholder="7"
            />
            <p className="text-xs text-muted-foreground">Maximum 60 days</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grace-reason">Reason</Label>
            <Textarea
              id="grace-reason"
              placeholder="e.g. We are awaiting a client payment which is expected on the 15th..."
              rows={4}
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
            ) : (
              'Submit Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Main Banner Component ─────────────────────────────────────────────────────

export const CreditStatusBanner: React.FC<Props> = ({
  creditStatus,
  onRequestSubmitted,
  variant = 'default',
}) => {
  const [graceDialogOpen, setGraceDialogOpen] = useState(false);
  const navigate = useNavigate();

  if (!creditStatus?.credit_enabled) return null;

  const { account_frozen, is_in_grace_period, grace_days_remaining,
          outstanding_balance, overdue_since, pending_grace_request } = creditStatus;

  // ── No issue — don't show anything ───────────────────────────────────────
  if (!account_frozen && !is_in_grace_period) return null;

  const compact = variant === 'compact';

  // ── FROZEN ────────────────────────────────────────────────────────────────
  if (account_frozen) {
    return (
      <div className={cn(
        'flex gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30',
        compact ? 'p-3' : 'p-4',
      )}>
        <Lock className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-900 dark:text-red-200 text-sm">
            Credit account frozen
          </p>
          <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
            Your account has an overdue balance of{' '}
            <strong>KES {parseFloat(outstanding_balance).toLocaleString()}</strong>.
            New orders are paused until payment is received.
          </p>
          {!compact && (
            <p className="text-xs text-red-600 mt-2">
              Contact your distributor to arrange payment and restore your account.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── GRACE PERIOD ACTIVE ───────────────────────────────────────────────────
  const isLastDay  = (grace_days_remaining ?? 99) <= 1;
  const isUrgent   = (grace_days_remaining ?? 99) <= 3;

  return (
    <>
      <div className={cn(
        'rounded-xl border',
        isUrgent
          ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/30'
          : 'border-amber-200 bg-amber-50 dark:bg-amber-950/20',
        compact ? 'p-3' : 'p-4',
      )}>
        <div className="flex gap-3">
          <AlertTriangle className={cn(
            'h-5 w-5 shrink-0 mt-0.5',
            isUrgent ? 'text-orange-600' : 'text-amber-600',
          )} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn(
                'font-semibold text-sm',
                isUrgent ? 'text-orange-900' : 'text-amber-900',
              )}>
                Payment overdue — grace period active
              </p>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                isLastDay
                  ? 'bg-red-100 text-red-700'
                  : isUrgent
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-amber-100 text-amber-700',
              )}>
                {grace_days_remaining === 0
                  ? 'Expires today'
                  : `${grace_days_remaining} day${grace_days_remaining === 1 ? '' : 's'} left`
                }
              </span>
            </div>

            <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
              Outstanding balance:{' '}
              <strong>KES {parseFloat(outstanding_balance).toLocaleString()}</strong>.
              Your account will freeze if unpaid by{' '}
              <strong>{creditStatus.grace_until}</strong>.
            </p>

            {!compact && (
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {/* Pending request indicator */}
                {pending_grace_request ? (
                  <div className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Grace extension request pending review</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                    onClick={() => setGraceDialogOpen(true)}
                  >
                    Request more time
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                )}
              </div>
            )}

            {/* Compact: show pending indicator inline */}
            {compact && pending_grace_request && (
              <div className="flex items-center gap-1.5 text-xs text-blue-700 mt-1.5">
                <Clock className="h-3 w-3" />
                <span>Grace extension request pending</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <GraceRequestDialog
        open={graceDialogOpen}
        onClose={() => setGraceDialogOpen(false)}
        onSuccess={() => onRequestSubmitted?.()}
      />
    </>
  );
};
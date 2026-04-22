/**
 * src/components/store/StockRequestsPanel.tsx
 *
 * Admin/Store-manager panel showing incoming driver stock top-up requests.
 * Drop this as a new tab inside StorePage.tsx (alongside Bottles / Consumables / Driver Stock).
 *
 * Features:
 *  - Live list of PENDING requests with driver name, vehicle, items, delivery link
 *  - Per-item qty adjustment before approving (can approve partial)
 *  - Reject with a reason
 *  - Filter by status / driver
 *  - Auto-refresh every 60s
 *
 * NOTE: useStockRequestPendingCount has been moved to:
 *   src/hooks/useStockRequestPendingCount.ts
 * Import it from there for the tab badge in StorePage.
 */

import React, {
  useState, useEffect, useCallback, useMemo,
} from 'react';
import {
  PackagePlus, Loader2, RefreshCw, CheckCircle2,
  XCircle, Truck, Droplets, Package, Clock,
  AlertTriangle, ChevronDown, X, Check,
  Minus, Plus, Info, InboxIcon, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import {
  stockRequestService,
  type StockRequest,
  type StockRequestStatus,
} from '@/api/services/stock-request.service';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(s: string): string {
  const d = new Date(s);
  if (isToday(d))     return `Today ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'd MMM · HH:mm');
}

const STATUS_CFG: Record<StockRequestStatus, {
  label: string; pill: string; dot: string;
}> = {
  PENDING:            { label: 'Pending',          pill: 'bg-amber-50   text-amber-700   border-amber-200   dark:bg-amber-950/30   dark:text-amber-300   dark:border-amber-800',   dot: 'bg-amber-400'   },
  APPROVED:           { label: 'Approved',          pill: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800', dot: 'bg-emerald-500' },
  REJECTED:           { label: 'Rejected',          pill: 'bg-red-50     text-red-700     border-red-200     dark:bg-red-950/30     dark:text-red-300     dark:border-red-800',     dot: 'bg-red-400'     },
  PARTIALLY_APPROVED: { label: 'Part. Approved',    pill: 'bg-blue-50    text-blue-700    border-blue-200    dark:bg-blue-950/30    dark:text-blue-300    dark:border-blue-800',    dot: 'bg-blue-500'    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Status pill
// ─────────────────────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: StockRequestStatus }> = ({ status }) => {
  const cfg = STATUS_CFG[status];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 border rounded-full text-[10px] font-bold px-2.5 py-0.5 shrink-0',
      cfg.pill,
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Approve modal — lets admin adjust per-item qty before confirming
// ─────────────────────────────────────────────────────────────────────────────

const ApproveModal: React.FC<{
  request:   StockRequest;
  onClose:   () => void;
  onApprove: (approvedItems: Array<{ line_item_id: string; quantity_approved: number }>) => Promise<void>;
}> = ({ request, onClose, onApprove }) => {
  const [approvedQtys, setApprovedQtys] = useState<Record<string, number>>(
    () => Object.fromEntries(
      request.items.map(i => [i.id, i.quantity_requested]),
    ),
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onApprove(
      request.items.map(i => ({
        line_item_id:      i.id,
        quantity_approved: approvedQtys[i.id] ?? 0,
      })),
    );
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border/60 z-10 overflow-hidden">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">Approve Request</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adjust quantities if needed, then confirm.
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            {request.items.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3.5 rounded-2xl border border-border/60 bg-card">
                <div className={cn(
                  'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                  item.product_type === 'bottle'
                    ? 'bg-blue-500/10 text-blue-600'
                    : 'bg-sky-500/10 text-sky-600',
                )}>
                  {item.product_type === 'bottle'
                    ? <Droplets className="h-4 w-4" />
                    : <Package  className="h-4 w-4" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.product_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Requested: <strong>{item.quantity_requested}</strong>
                  </p>
                </div>
                {/* Inline qty adjuster */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setApprovedQtys(prev => ({
                      ...prev,
                      [item.id]: Math.max(0, (prev[item.id] ?? 0) - 1),
                    }))}
                    className="h-7 w-7 rounded-lg border border-border/60 bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center font-bold text-sm tabular-nums">
                    {approvedQtys[item.id] ?? 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => setApprovedQtys(prev => ({
                      ...prev,
                      [item.id]: (prev[item.id] ?? 0) + 1,
                    }))}
                    className="h-7 w-7 rounded-lg border border-border/60 bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2.5 px-3.5 py-3 bg-muted/30 border border-border/40 rounded-2xl">
            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">
              Approving will automatically distribute stock from the store to the driver's van.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-2xl border border-border/60 font-bold text-sm hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 h-11 rounded-2xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Check className="h-4 w-4" />
              }
              Approve & Distribute
            </button>
          </div>
        </div>

        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Reject modal
// ─────────────────────────────────────────────────────────────────────────────

const REJECT_REASONS = [
  'Insufficient stock available',
  'Driver already has enough stock',
  'Requested quantity too high',
  'Product not available at store',
  'Other (see notes)',
];

const RejectModal: React.FC<{
  onClose:  () => void;
  onReject: (reason: string) => Promise<void>;
}> = ({ onClose, onReject }) => {
  const [reason,     setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    await onReject(reason);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border/60 z-10 overflow-hidden">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base">Reject Request</h3>
            <button
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Select a reason — this will be shown to the driver.
          </p>

          <div className="space-y-2">
            {REJECT_REASONS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  'w-full text-left text-sm font-semibold px-4 py-3 rounded-2xl border-2 transition-all',
                  reason === r
                    ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300'
                    : 'bg-muted/30 border-border/50 text-foreground hover:border-border',
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-2xl border border-border/60 font-bold text-sm hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!reason || submitting}
              className="flex-1 h-11 rounded-2xl bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-40 transition-colors"
            >
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <XCircle className="h-4 w-4" />
              }
              Confirm Reject
            </button>
          </div>
        </div>

        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Single request card
// ─────────────────────────────────────────────────────────────────────────────

const RequestCard: React.FC<{
  request:   StockRequest;
  onApprove: (r: StockRequest) => void;
  onReject:  (r: StockRequest) => void;
}> = ({ request, onApprove, onReject }) => {
  const [expanded, setExpanded] = useState(request.status === 'PENDING');
  const isPending = request.status === 'PENDING';

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all',
      isPending
        ? 'border-amber-200/60 dark:border-amber-800/40 bg-card'
        : 'border-border/60 bg-card opacity-80',
    )}>
      {/* Status stripe */}
      <div className={cn('h-[3px] w-full', STATUS_CFG[request.status].dot)} />

      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Driver avatar */}
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-black text-base select-none">
            {request.driver_name.trim()[0]?.toUpperCase() ?? '?'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm">{request.driver_name}</p>
              <StatusPill status={request.status} />
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {request.vehicle_number && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Truck className="h-3 w-3 shrink-0" />
                  {request.vehicle_number}
                </span>
              )}
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                {fmtDate(request.created_at)}
              </span>
              {request.delivery_order_number && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600">
                  <Truck className="h-3 w-3 shrink-0" />
                  {request.delivery_order_number}
                </span>
              )}
            </div>
          </div>

          {/* Item count + expand */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground shrink-0 hover:text-foreground"
          >
            <span className="bg-muted px-2 py-0.5 rounded-full">
              {request.items.length} item{request.items.length !== 1 ? 's' : ''}
            </span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>

        {/* Collapsed summary pills */}
        {!expanded && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {request.items.map(item => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold',
                  item.product_type === 'bottle'
                    ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300'
                    : 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/30 dark:border-sky-800 dark:text-sky-300',
                )}
              >
                {item.product_type === 'bottle'
                  ? <Droplets className="h-2.5 w-2.5 shrink-0" />
                  : <Package  className="h-2.5 w-2.5 shrink-0" />
                }
                {item.product_name} ×{item.quantity_requested}
              </div>
            ))}
          </div>
        )}

        {/* Expanded items */}
        {expanded && (
          <div className="mt-3 space-y-2">
            {request.items.map(item => {
              const approvedQty = item.quantity_approved;
              return (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/20">
                  <div className={cn(
                    'h-8 w-8 rounded-xl flex items-center justify-center shrink-0',
                    item.product_type === 'bottle'
                      ? 'bg-blue-500/10 text-blue-600'
                      : 'bg-sky-500/10 text-sky-600',
                  )}>
                    {item.product_type === 'bottle'
                      ? <Droplets className="h-3.5 w-3.5" />
                      : <Package  className="h-3.5 w-3.5" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.product_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      On van at request: <strong>{item.current_qty_at_request}</strong>
                      {item.unit && ` · ${item.unit.toLowerCase()}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums">×{item.quantity_requested}</p>
                    {approvedQty !== null && approvedQty !== undefined && (
                      <p className={cn(
                        'text-[10px] font-bold tabular-nums',
                        approvedQty === item.quantity_requested
                          ? 'text-emerald-600'
                          : approvedQty === 0
                          ? 'text-red-500'
                          : 'text-amber-600',
                      )}>
                        Approved: {approvedQty}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Notes */}
            {request.notes && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-muted/30 border border-border/40 rounded-xl">
                <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">{request.notes}</p>
              </div>
            )}

            {/* Rejection reason */}
            {request.rejection_reason && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 dark:bg-red-950/20 dark:border-red-900 rounded-xl">
                <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400">{request.rejection_reason}</p>
              </div>
            )}

            {/* Approval info */}
            {request.approved_at && request.approved_by_name && (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900 rounded-xl">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Approved by <strong>{request.approved_by_name}</strong> · {fmtDate(request.approved_at)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action buttons — only for PENDING */}
        {isPending && (
          <div className="flex gap-2.5 mt-4">
            <button
              onClick={() => onReject(request)}
              className="flex-1 h-10 rounded-xl border border-red-200 bg-red-50 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-red-100 transition-colors active:scale-[0.98]"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </button>
            <button
              onClick={() => onApprove(request)}
              className="flex-[2] h-10 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-colors active:scale-[0.98] shadow-sm shadow-emerald-500/20"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Review & Approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

export const StockRequestsPanel: React.FC = () => {
  const [requests,      setRequests]      = useState<StockRequest[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [statusFilter,  setStatusFilter]  = useState<StockRequestStatus | 'all'>('all');
  const [approveTarget, setApproveTarget] = useState<StockRequest | null>(null);
  const [rejectTarget,  setRejectTarget]  = useState<StockRequest | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await stockRequestService.listRequests();
      setRequests(data);
    } catch {
      toast.error('Failed to load stock requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const handleApprove = async (
    approvedItems: Array<{ line_item_id: string; quantity_approved: number }>,
  ) => {
    if (!approveTarget) return;
    try {
      const updated = await stockRequestService.approveRequest(approveTarget.id, {
        items: approvedItems,
      });
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast.success(`Stock approved — distributing to ${approveTarget.driver_name}`);
      setApproveTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Failed to approve request';
      toast.error(msg);
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    try {
      const updated = await stockRequestService.rejectRequest(rejectTarget.id, { reason });
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast.success('Request rejected');
      setRejectTarget(null);
    } catch {
      toast.error('Failed to reject request');
    }
  };

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter(r => r.status === statusFilter);
  }, [requests, statusFilter]);

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  const statusCounts = useMemo(() =>
    requests.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {}),
  [requests]);

  return (
    <div className="space-y-4">

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: 'Pending',  val: pendingCount,                  cls: pendingCount > 0 ? 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800' : 'bg-muted/60 text-foreground border-border/60' },
          { label: 'Approved', val: statusCounts['APPROVED'] ?? 0, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800' },
          { label: 'Rejected', val: statusCounts['REJECTED'] ?? 0, cls: 'bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800' },
          { label: 'Total',    val: requests.length,               cls: 'bg-muted/60 text-foreground border-border/60' },
        ].map(({ label, val, cls }) => (
          <div key={label} className={cn('rounded-2xl border px-3 py-3.5 text-center', cls)}>
            <p className="text-2xl font-black leading-none tabular-nums">{val}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Pending alert banner */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3.5 bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 rounded-2xl">
          <Bell className="h-5 w-5 text-amber-600 shrink-0 animate-bounce" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              {pendingCount} request{pendingCount > 1 ? 's' : ''} waiting for approval
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400 mt-0.5">
              Review and distribute stock to keep drivers moving.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap flex-1">
          {([
            { val: 'all',                label: 'All'            },
            { val: 'PENDING',            label: 'Pending'        },
            { val: 'APPROVED',           label: 'Approved'       },
            { val: 'PARTIALLY_APPROVED', label: 'Part. Approved' },
            { val: 'REJECTED',           label: 'Rejected'       },
          ] as const).map(opt => (
            <button
              key={opt.val}
              onClick={() => setStatusFilter(opt.val)}
              className={cn(
                'text-[11px] font-bold px-3.5 py-2 rounded-full border transition-all',
                statusFilter === opt.val
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-muted/40 text-muted-foreground border-border/50 hover:border-border',
              )}
            >
              {opt.label}
              {opt.val !== 'all' && (
                <span className="ml-1.5 opacity-60">{statusCounts[opt.val] ?? 0}</span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => load()}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-2 rounded-full border bg-muted/40 text-muted-foreground border-border/50 hover:border-border disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary/50" />
          <p className="text-sm text-muted-foreground">Loading requests…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <InboxIcon className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <p className="font-bold text-base mb-1">
            {statusFilter === 'all' ? 'No requests yet' : `No ${statusFilter.toLowerCase()} requests`}
          </p>
          <p className="text-sm text-muted-foreground">
            {statusFilter === 'all'
              ? 'Driver stock requests will appear here.'
              : 'Try selecting a different status filter.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {filtered.map(r => (
            <RequestCard
              key={r.id}
              request={r}
              onApprove={setApproveTarget}
              onReject={setRejectTarget}
            />
          ))}
          <p className="text-center text-[11px] text-muted-foreground pt-2">
            {filtered.length} request{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Approve modal */}
      {approveTarget && (
        <ApproveModal
          request={approveTarget}
          onClose={() => setApproveTarget(null)}
          onApprove={handleApprove}
        />
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          onClose={() => setRejectTarget(null)}
          onReject={handleReject}
        />
      )}
    </div>
  );
};

export default StockRequestsPanel;
/**
 * Client Billing Sheet
 * Slide-over showing a client's invoices and subscription info
 * src/components/dialogs/ClientBillingSheet.tsx
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import billingService from '@/api/services/billing.service';
import type { Client } from '@/api/services/clients.service';
import type { Invoice, PaymentMethod } from '@/types/billing.types';
import {
  CreditCard, FileText, CheckCircle2, Clock,
  AlertTriangle, Loader2, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary'; icon: React.ElementType }> = {
  paid:      { label: 'Paid',      variant: 'success',     icon: CheckCircle2 },
  pending:   { label: 'Pending',   variant: 'warning',     icon: Clock },
  overdue:   { label: 'Overdue',   variant: 'destructive', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', variant: 'secondary',   icon: FileText },
};

const PLAN_LABELS: Record<string, string> = {
  trial: 'Free Trial', basic: 'Starter', pro: 'Professional', enterprise: 'Enterprise',
};

// ─── Mark Paid dialog ─────────────────────────────────────────────────────────

const MarkPaidDialog: React.FC<{
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}> = ({ invoice, open, onOpenChange, onSuccess }) => {
  const [method, setMethod] = useState<PaymentMethod>('mpesa');
  const [reference, setReference] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      billingService.markInvoicePaid(invoice!.id, {
        payment_method: method,
        payment_reference: reference || undefined,
      }),
    onSuccess: () => {
      toast.success(`Invoice ${invoice?.invoiceNumber} marked as paid`);
      setReference('');
      onOpenChange(false);
      onSuccess();
    },
    onError: () => toast.error('Failed to mark invoice as paid'),
  });

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark Invoice as Paid</DialogTitle>
          <DialogDescription>
            {invoice.invoiceNumber} — KSh {Number(invoice.amount).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ref">
              Reference / Transaction ID{' '}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="ref"
              placeholder={method === 'mpesa' ? 'e.g., QGH7K9XZ2' : 'e.g., TRF-2026-001'}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button variant="ocean" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" />Confirm Payment</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClientBillingSheetProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ClientBillingSheet: React.FC<ClientBillingSheetProps> = ({
  client, open, onOpenChange,
}) => {
  const queryClient = useQueryClient();
  const [markPaidInvoice, setMarkPaidInvoice] = useState<Invoice | null>(null);

  const {
    data: invoicesData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['client-invoices', client?.id],
    queryFn: () => billingService.getInvoices({ client: client!.id }),
    enabled: !!client?.id && open,
  });

  const invoices = invoicesData?.data ?? [];

  const handleMarkPaidSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['client-invoices', client?.id] });
    queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
  };

  if (!client) return null;

  const totalOutstanding = invoices
    .filter((inv) => inv.status === 'pending' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + Number(inv.amount), 0);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Billing — {client.name}
            </SheetTitle>
            <SheetDescription>
              {PLAN_LABELS[client.subscriptionPlan] ?? client.subscriptionPlan} plan · {' '}
              <span className="capitalize">{client.subscriptionStatus}</span>
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            {/* ── Summary cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3">
                <p className="text-xs text-muted-foreground mb-1">Total Invoices</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-7 w-8" /> : invoicesData?.total ?? 0}
                </p>
              </Card>
              <Card className={`p-3 ${totalOutstanding > 0 ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
                <p className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-destructive' : ''}`}>
                  {isLoading
                    ? <Skeleton className="h-7 w-24" />
                    : `KSh ${totalOutstanding.toLocaleString()}`}
                </p>
              </Card>
            </div>

            {/* ── Invoice list ────────────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Invoice History
                </p>
                <Button variant="ghost" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh
                </Button>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : isError ? (
                <div className="p-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-destructive opacity-50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Failed to load invoices</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                    Try Again
                  </Button>
                </div>
              ) : invoices.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 opacity-30 mx-auto mb-2" />
                  <p className="text-sm">No invoices yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {invoices.map((invoice) => {
                    const config = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.pending;
                    const StatusIcon = config.icon;
                    const canMarkPaid = invoice.status === 'pending' || invoice.status === 'overdue';
                    return (
                      <Card key={invoice.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${
                              invoice.status === 'paid' ? 'text-success' :
                              invoice.status === 'overdue' ? 'text-destructive' :
                              'text-warning'
                            }`} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {invoice.invoiceNumber}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {invoice.description}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Due {new Date(invoice.dueDate).toLocaleDateString('en-KE', {
                                  day: 'numeric', month: 'short', year: 'numeric',
                                })}
                                {invoice.paidAt && (
                                  <> · Paid {new Date(invoice.paidAt).toLocaleDateString('en-KE', {
                                    day: 'numeric', month: 'short',
                                  })}</>
                                )}
                              </p>
                              {invoice.paymentReference && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  Ref: {invoice.paymentReference}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <p className="text-sm font-bold">
                              KSh {Number(invoice.amount).toLocaleString()}
                            </p>
                            <Badge variant={config.variant} className="text-xs">
                              {config.label}
                            </Badge>
                            {canMarkPaid && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs px-2 mt-1"
                                onClick={() => setMarkPaidInvoice(invoice)}
                              >
                                Mark Paid
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Mark as paid sub-dialog */}
      <MarkPaidDialog
        invoice={markPaidInvoice}
        open={!!markPaidInvoice}
        onOpenChange={(o) => { if (!o) setMarkPaidInvoice(null); }}
        onSuccess={handleMarkPaidSuccess}
      />
    </>
  );
};
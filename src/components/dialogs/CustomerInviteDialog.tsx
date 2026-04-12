/**
 * CustomerInviteDialog
 * src/components/dialogs/CustomerInviteDialog.tsx
 *
 * Shown after a customer is created. Displays the invite URL so the
 * admin can copy it manually if email delivery is delayed.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge }  from '@/components/ui/badge';
import {
  Check, Copy, Mail, ExternalLink, RefreshCw, Loader2, UserCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AdminCustomer, customerAdminService } from '@/api/services/customerAdmin.service';

interface CustomerInviteDialogProps {
  open:      boolean;
  customer:  AdminCustomer | null;
  inviteUrl: string;
  onClose:   () => void;
}

export const CustomerInviteDialog: React.FC<CustomerInviteDialogProps> = ({
  open,
  customer,
  inviteUrl,
  onClose,
}) => {
  const { toast } = useToast();
  const [copied,   setCopied]   = useState(false);
  const [resending, setResending] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast({ title: 'Link copied to clipboard' });
  };

  const handleResend = async () => {
    if (!customer) return;
    setResending(true);
    try {
      await customerAdminService.resendInvite(customer.id);
      toast({
        title:       'Invite resent',
        description: `A new invite email was sent to ${customer.email}`,
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to resend invite.', variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className={[
          // Base — full width on tiny phones, centred card everywhere else
          'w-full max-w-full rounded-none p-0 gap-0',
          // Position: bottom sheet on mobile, centred on sm+
          'fixed inset-x-0 bottom-0',
          'sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2',
          // Width cap & rounded corners on larger screens
          'sm:max-w-md sm:rounded-2xl',
          // Let content define height; never overflow the screen
          'max-h-[95dvh] sm:max-h-[90vh]',
          'flex flex-col overflow-hidden',
        ].join(' ')}
      >

        {/* ── Success hero banner ── */}
        <div className="shrink-0 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40 px-5 pt-5 pb-4 sm:rounded-t-2xl">
          {/* Mobile drag handle */}
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-emerald-200 dark:bg-emerald-800 sm:hidden" />

          <div className="flex items-center gap-3">
            {/* Animated check circle */}
            <div className="h-11 w-11 rounded-full bg-emerald-100 dark:bg-emerald-900/60 border-2 border-emerald-300 dark:border-emerald-700 flex items-center justify-center shrink-0">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
            </div>
            <DialogHeader className="space-y-0.5 text-left">
              <DialogTitle className="text-base font-bold text-emerald-900 dark:text-emerald-100 leading-tight">
                Customer Created
              </DialogTitle>
              <DialogDescription className="text-xs text-emerald-700 dark:text-emerald-400 font-normal">
                Account created &amp; invite email dispatched
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-5 py-5 space-y-4">

            {/* Customer summary card */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl border bg-background">
              {/* Avatar */}
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary text-base">
                {customer.full_name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate leading-tight">
                  {customer.full_name}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {customer.phone_number}
                </p>
                {customer.email && (
                  <p className="text-xs text-muted-foreground truncate">
                    {customer.email}
                  </p>
                )}
              </div>
              <Badge
                variant="warning"
                className="shrink-0 text-[10px] font-semibold px-2 py-0.5"
              >
                Invite Pending
              </Badge>
            </div>

            {/* Email sent confirmation */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 leading-tight">
                  Invite email sent
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5 leading-relaxed">
                  Sent to <strong className="font-semibold">{customer.email}</strong>.
                  The link expires in <strong className="font-semibold">7 days</strong>.
                </p>
              </div>
            </div>

            {/* Invite URL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Invite Link
                </p>
                <p className="text-[10px] text-muted-foreground">Share manually if needed</p>
              </div>

              {/* URL row — full width, no overflow */}
              <div className="rounded-xl border bg-muted/40 overflow-hidden">
                <div className="px-3 py-2.5 flex items-center gap-2">
                  <code className="text-xs text-muted-foreground font-mono flex-1 break-all leading-relaxed">
                    {inviteUrl}
                  </code>
                </div>
                {/* Copy button as a full-width strip for easy tapping on mobile */}
                <button
                  onClick={handleCopy}
                  className={[
                    'w-full flex items-center justify-center gap-2 py-2.5 border-t text-xs font-semibold transition-colors',
                    copied
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                      : 'bg-background hover:bg-muted/60 text-muted-foreground border-border',
                  ].join(' ')}
                >
                  {copied ? (
                    <><Check className="h-3.5 w-3.5" />Copied!</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" />Copy invite link</>
                  )}
                </button>
              </div>
            </div>

            {/* Next-steps hint */}
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-muted/30 border border-dashed">
              <UserCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Once the customer completes sign-up they will be moved to{' '}
                <strong className="font-semibold text-foreground">Active</strong> status
                and can start placing orders.
              </p>
            </div>

          </div>
        </div>

        {/* ── Sticky footer ── */}
        <div className="shrink-0 border-t bg-background px-5 py-4 sm:rounded-b-2xl">
          {/* Three-action row: resend + preview share the left, Done anchors right */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={resending}
              className="h-10 gap-1.5 flex-1 sm:flex-none"
            >
              {resending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />
              }
              Resend Email
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(inviteUrl, '_blank')}
              className="h-10 gap-1.5 flex-1 sm:flex-none"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Preview
            </Button>

            <Button
              onClick={onClose}
              className="h-10 ml-auto px-6"
            >
              Done
            </Button>
          </div>

          {/* iOS home-indicator spacer */}
          <div className="h-safe-area-inset-bottom sm:hidden" />
        </div>

      </DialogContent>
    </Dialog>
  );
};
/**
 * CustomerInviteDialog — Redesigned
 * src/components/dialogs/CustomerInviteDialog.tsx
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
import {
  Check, Copy, Mail, ExternalLink,
  RefreshCw, Loader2, Phone, Link2,
  PartyPopper, ShieldCheck,
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
  const [copied,    setCopied]    = useState(false);
  const [resending, setResending] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast({ title: 'Link copied!' });
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

  const nameInitial = customer.full_name?.[0]?.toUpperCase() ?? '?';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-2xl">

        {/* ── Hero header ── */}
        <div className="relative px-6 pt-8 pb-6 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10" />
          <div className="absolute top-4 right-20 h-8 w-8 rounded-full bg-white/15" />

          {/* Success icon */}
          <div className="relative flex items-center gap-4 mb-5">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shrink-0 shadow-lg">
              <PartyPopper className="h-7 w-7 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-white leading-tight">
                Customer Created!
              </DialogTitle>
              <DialogDescription className="text-emerald-100 text-sm mt-0.5">
                Account ready · Invite sent
              </DialogDescription>
            </div>
          </div>

          {/* Customer identity card */}
          <div className="relative flex items-center gap-3.5 bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl px-4 py-3.5">
            <div className="h-11 w-11 rounded-xl bg-white/25 border border-white/30 flex items-center justify-center shrink-0 font-black text-lg text-white">
              {nameInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white text-base leading-tight truncate">
                {customer.full_name}
              </p>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {customer.phone_number && (
                  <span className="text-emerald-100 text-xs flex items-center gap-1">
                    <Phone className="h-3 w-3" />{customer.phone_number}
                  </span>
                )}
                {customer.email && (
                  <span className="text-emerald-100 text-xs flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span className="truncate max-w-[140px]">{customer.email}</span>
                  </span>
                )}
              </div>
            </div>
            {/* Status dot */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
              <span className="text-[10px] font-bold text-amber-200 uppercase tracking-wide">
                Pending
              </span>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4 bg-background">

          {/* Email sent confirmation */}
          <div className="flex items-start gap-3.5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                Invite email sent successfully
              </p>
              <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5 truncate">
                Delivered to <strong>{customer.email}</strong> · expires in 7 days
              </p>
            </div>
          </div>

          {/* Invite link */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                Share Link Manually
              </p>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border border-border/60 group">
              <code className="text-xs flex-1 truncate text-muted-foreground font-mono min-w-0">
                {inviteUrl}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-primary/10 active:scale-95"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                )}
              </button>
            </div>
            {copied && (
              <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in slide-in-from-bottom-1">
                <Check className="h-3 w-3" />Copied to clipboard!
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={resending}
              className="gap-1.5 h-9 rounded-xl border-border/60"
            >
              {resending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />
              }
              Resend
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(inviteUrl, '_blank')}
              className="gap-1.5 h-9 rounded-xl border-border/60"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Preview
            </Button>
            <Button
              onClick={onClose}
              className="ml-auto h-9 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold border-0 shadow-md shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              Done
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};
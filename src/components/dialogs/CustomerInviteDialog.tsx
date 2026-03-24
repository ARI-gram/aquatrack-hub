/**
 * CustomerInviteDialog
 * src/components/dialogs/CustomerInviteDialog.tsx
 *
 * Shown after a customer is created.  Displays the invite URL so the
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
import { Badge } from '@/components/ui/badge';
import { Check, Copy, Mail, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AdminCustomer, customerAdminService } from '@/api/services/customerAdmin.service';

interface CustomerInviteDialogProps {
  open: boolean;
  customer: AdminCustomer | null;
  inviteUrl: string;
  onClose: () => void;
}

export const CustomerInviteDialog: React.FC<CustomerInviteDialogProps> = ({
  open,
  customer,
  inviteUrl,
  onClose,
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [resending, setResending] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Link copied to clipboard' });
  };

  const handleResend = async () => {
    if (!customer) return;
    setResending(true);
    try {
      await customerAdminService.resendInvite(customer.id);
      toast({
        title: 'Invite resent',
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="h-4 w-4 text-success" />
            </div>
            Customer Created
          </DialogTitle>
          <DialogDescription>
            The customer account has been created and an invite email has been sent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Customer info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-foreground font-semibold text-sm">
              {customer.full_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{customer.full_name}</p>
              <p className="text-sm text-muted-foreground truncate">{customer.phone_number}</p>
            </div>
            <Badge variant="warning" className="shrink-0">Invite Pending</Badge>
          </div>

          {/* Email sent notice */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-success/20 bg-success/5">
            <Mail className="h-4 w-4 text-success mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-success">Invite email sent</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sent to <strong>{customer.email}</strong>. The link expires in 7 days.
              </p>
            </div>
          </div>

          {/* Invite URL */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Invite Link (share manually if needed)
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <code className="text-xs flex-1 truncate text-muted-foreground font-mono">
                {inviteUrl}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResend}
            disabled={resending}
            className="gap-1.5"
          >
            {resending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Resend Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(inviteUrl, '_blank')}
            className="gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Preview Link
          </Button>
          <Button className="ml-auto" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
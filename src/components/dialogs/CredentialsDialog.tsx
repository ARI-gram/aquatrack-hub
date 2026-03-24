/**
 * CredentialsDialog
 * src/components/dialogs/CredentialsDialog.tsx
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, ShieldCheck, RefreshCw, Mail, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  email: string;
  password: string;
  employeeName: string;
  isReset?: boolean;
}

export const CredentialsDialog: React.FC<CredentialsDialogProps> = ({
  open,
  onClose,
  email,
  password,
  employeeName,
  isReset = false,
}) => {
  const [copiedEmail,    setCopiedEmail]    = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll,      setCopiedAll]      = useState(false);

  const copy = async (text: string, type: 'email' | 'password') => {
    await navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const initials = employeeName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/*
        Overflow fixes applied here:
        1. No overflow-hidden on the outer shell — was clipping the -mt-5 card
        2. max-h + overflow-y-auto — dialog scrolls on very small screens
        3. w-[calc(100vw-2rem)] — never bleeds off-screen on mobile
        4. break-all on email/password text — long strings wrap instead of overflow
      */}
      <DialogContent className="p-0 gap-0 rounded-2xl border-0 shadow-2xl w-[calc(100vw-2rem)] sm:max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto">

        {/* ── Header ── */}
        <div className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-5 pt-6 pb-10 rounded-t-2xl overflow-hidden shrink-0">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -right-4 -top-4 h-28 w-28 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sm font-bold text-white ring-2 ring-white/20">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                {isReset
                  ? <RefreshCw className="h-3 w-3 text-white/70 shrink-0" />
                  : <ShieldCheck className="h-3 w-3 text-white/70 shrink-0" />
                }
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">
                  {isReset ? 'Password Reset' : 'Account Created'}
                </span>
              </div>
              <h2 className="text-base font-bold text-white leading-snug break-words">
                {employeeName}
              </h2>
              <p className="text-xs text-white/60 mt-0.5">
                {isReset ? 'New credentials ready to share' : 'Share these securely'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Credential cards — overlap header by 20px ── */}
        <div className="relative -mt-5 mx-4 rounded-xl bg-background shadow-lg ring-1 ring-border/60 overflow-hidden shrink-0">

          {/* Email row */}
          <div className="flex items-start gap-3 border-b border-border px-4 py-3.5 hover:bg-muted/30 transition-colors">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-500 mt-0.5">
              <Mail className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Email
              </p>
              {/* break-all: long emails like verylongemail@somedomain.co.ke wrap correctly */}
              <p className="text-sm font-medium text-foreground break-all leading-snug">
                {email}
              </p>
            </div>
            <button
              onClick={() => copy(email, 'email')}
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all mt-0.5',
                copiedEmail
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
              aria-label="Copy email"
            >
              {copiedEmail ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Password row */}
          <div className="flex items-start gap-3 bg-primary/5 px-4 py-3.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary mt-0.5">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Temporary Password
              </p>
              {/* break-all: long generated passwords wrap instead of pushing layout */}
              <p className="font-mono text-base font-bold tracking-[0.1em] text-primary break-all leading-snug">
                {password}
              </p>
            </div>
            <button
              onClick={() => copy(password, 'password')}
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all mt-0.5',
                copiedPassword
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-primary/10 text-primary hover:bg-primary/20',
              )}
              aria-label="Copy password"
            >
              {copiedPassword ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* ── Copy all ── */}
        <div className="px-4 mt-3 shrink-0">
          <button
            onClick={copyAll}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-all',
              copiedAll
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5',
            )}
          >
            {copiedAll
              ? <><Check className="h-3.5 w-3.5" />Copied!</>
              : <><Copy className="h-3.5 w-3.5" />Copy both to clipboard</>
            }
          </button>
        </div>

        {/* ── Warning ── */}
        <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-100 px-3.5 py-3 shrink-0">
          <span className="shrink-0 text-sm leading-none mt-px">⚠️</span>
          <p className="text-xs text-amber-700 leading-relaxed">
            <span className="font-semibold">Store these credentials safely.</span>{' '}
            This is the only time this password will be visible. The employee
            will be asked to change it on first login.
          </p>
        </div>

        {/* ── Footer ── */}
        <div className="px-4 pt-3 pb-5 shrink-0">
          <Button variant="ocean" className="w-full h-10 font-semibold" onClick={onClose}>
            Done
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};
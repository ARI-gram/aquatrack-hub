/**
 * src/components/dialogs/shared.tsx
 *
 * Shared primitives used across all driver dialogs:
 *  - BottomSheet
 *  - ConfirmSheet (thin wrapper with a single CTA)
 *  - ProductImage
 */

import React, { useEffect } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM SHEET
// ─────────────────────────────────────────────────────────────────────────────

export const BottomSheet: React.FC<{
  open:     boolean;
  onClose:  () => void;
  title:    string;
  children: React.ReactNode;
  /** Optional element rendered right of the title */
  titleRight?: React.ReactNode;
}> = ({ open, onClose, title, children, titleRight }) => {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative bg-background rounded-t-3xl shadow-2xl max-h-[92dvh] flex flex-col"
        style={{ animation: 'slideUp 0.25s cubic-bezier(0.32,0.72,0,1)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-border/60">
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            {titleRight}
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1;   }
        }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY CTA BUTTON
// ─────────────────────────────────────────────────────────────────────────────

export const PrimaryButton: React.FC<{
  onClick:   () => void;
  disabled?: boolean;
  loading?:  boolean;
  loadingLabel?: string;
  label:     string;
  icon?:     React.ReactNode;
  color?:    'emerald' | 'amber' | 'blue' | 'destructive';
}> = ({
  onClick, disabled, loading, loadingLabel = 'Processing…',
  label, icon,
  color = 'emerald',
}) => {
  const colors = {
    emerald:     'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 text-white',
    amber:       'bg-amber-500   hover:bg-amber-600   shadow-amber-500/20   text-white',
    blue:        'bg-blue-600    hover:bg-blue-700    shadow-blue-500/20    text-white',
    destructive: 'bg-destructive hover:bg-destructive/90 shadow-destructive/20 text-white',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5',
        'shadow-lg transition-all active:scale-[0.98]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        colors[color],
      )}
    >
      {loading
        ? <><Loader2 className="h-5 w-5 animate-spin" />{loadingLabel}</>
        : <>{icon}{label}</>
      }
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT IMAGE
// ─────────────────────────────────────────────────────────────────────────────

import { ImageOff } from 'lucide-react';

export const ProductImage: React.FC<{
  url?:  string | null;
  name:  string;
  size?: 'sm' | 'md';
}> = ({ url, name, size = 'md' }) => {
  const [err, setErr] = React.useState(false);
  const dim     = size === 'sm' ? 'h-9 w-9'   : 'h-12 w-12';
  const iconDim = size === 'sm' ? 'h-4 w-4'   : 'h-5 w-5';

  if (!url || err) return (
    <div className={cn(dim, 'rounded-xl flex items-center justify-center bg-muted/60 shrink-0')}>
      <ImageOff className={cn(iconDim, 'text-muted-foreground/40')} />
    </div>
  );
  return (
    <div className={cn(dim, 'rounded-xl overflow-hidden shrink-0 bg-muted/30')}>
      <img src={url} alt={name} className="w-full h-full object-cover" onError={() => setErr(true)} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION LABEL
// ─────────────────────────────────────────────────────────────────────────────

export const SectionLabel: React.FC<{
  children: React.ReactNode;
  required?: boolean;
}> = ({ children, required }) => (
  <label className="block text-sm font-semibold text-foreground mb-1.5">
    {children}
    {required && <span className="text-destructive ml-1">*</span>}
  </label>
);

// ─────────────────────────────────────────────────────────────────────────────
// FIELD WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export const Field: React.FC<{
  label:     string;
  required?: boolean;
  children:  React.ReactNode;
  hint?:     string;
}> = ({ label, required, children, hint }) => (
  <div className="space-y-1.5">
    <SectionLabel required={required}>{label}</SectionLabel>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// TEXT INPUT (styled)
// ─────────────────────────────────────────────────────────────────────────────

export const TextInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement>
> = (props) => (
  <input
    {...props}
    className={cn(
      'w-full h-12 px-4 rounded-xl border border-border/60 bg-background text-sm',
      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40',
      'placeholder:text-muted-foreground/50',
      props.className,
    )}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// TEXTAREA (styled)
// ─────────────────────────────────────────────────────────────────────────────

export const TextArea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
> = (props) => (
  <textarea
    {...props}
    className={cn(
      'w-full px-4 py-3 rounded-xl border border-border/60 bg-background text-sm resize-none',
      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40',
      'placeholder:text-muted-foreground/50',
      props.className,
    )}
  />
);
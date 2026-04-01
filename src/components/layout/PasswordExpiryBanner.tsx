import React, { useState } from 'react';
import { AlertTriangle, X, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  daysLeft:    number;
  onChangeNow: () => void;
}

export const PasswordExpiryBanner: React.FC<Props> = ({ daysLeft, onChangeNow }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const isUrgent = daysLeft <= 3;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-sm border-b
      ${isUrgent
        ? 'bg-destructive/10 border-destructive/20 text-destructive'
        : 'bg-warning/10  border-warning/20  text-warning-foreground'}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {daysLeft === 0 ? 'Your password expires today.' : `Your password expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`}
        {' '}Keep your account secure by updating it now.
      </span>
      <Button variant="outline" size="sm" className="h-7 shrink-0 gap-1.5 text-xs" onClick={onChangeNow}>
        <ShieldCheck className="h-3.5 w-3.5" /> Change Now
      </Button>
      {!isUrgent && (
        <button onClick={() => setDismissed(true)}
          className="ml-1 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
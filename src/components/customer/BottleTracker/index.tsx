/**
 * BottleTracker Component
 * Visual display of customer's bottle inventory
 */
// /src/components/customer/BottleTracker/index.tsx 
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import type { BottleInventory } from '@/types/bottle.types';

interface BottleTrackerProps {
  inventory: BottleInventory;
  showDepositInfo?: boolean;
  compact?: boolean;
}

export const BottleTracker: React.FC<BottleTrackerProps> = ({
  inventory,
  showDepositInfo = true,
  compact = false,
}) => {
  const { fullBottles, emptyBottles, inTransit, totalOwned, depositPerBottle, totalDeposit } = inventory;

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        <BottleCount count={fullBottles} label="Full" variant="full" size="sm" />
        <BottleCount count={emptyBottles} label="Empty" variant="empty" size="sm" />
        <BottleCount count={inTransit} label="Transit" variant="transit" size="sm" />
      </div>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Your Bottles
        </h3>
        <Badge variant="secondary">Total: {totalOwned}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <BottleCount count={fullBottles} label="Full" variant="full" />
        <BottleCount count={emptyBottles} label="Empty" variant="empty" />
        <BottleCount count={inTransit} label="Transit" variant="transit" />
      </div>

      {showDepositInfo && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Deposit on File</span>
            <span className="font-medium text-foreground">
              ${totalDeposit.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            (${depositPerBottle.toFixed(2)} per bottle × {totalOwned} bottles)
          </p>
        </div>
      )}
    </Card>
  );
};

interface BottleCountProps {
  count: number;
  label: string;
  variant: 'full' | 'empty' | 'transit';
  size?: 'sm' | 'md';
}

const BottleCount: React.FC<BottleCountProps> = ({ count, label, variant, size = 'md' }) => {
  const variantStyles = {
    full: 'bg-success/10 text-success border-success/20',
    empty: 'bg-muted text-muted-foreground border-muted-foreground/20',
    transit: 'bg-accent/10 text-accent border-accent/20',
  };

  const icons = {
    full: '🍾',
    empty: '🍾',
    transit: '🚚',
  };

  if (size === 'sm') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg">{icons[variant]}</span>
        <div>
          <span className="font-semibold">{count}</span>
          <span className="text-xs text-muted-foreground ml-1">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 text-center ${variantStyles[variant]}`}>
      <div className="text-2xl mb-1">{icons[variant]}</div>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
};

export default BottleTracker;

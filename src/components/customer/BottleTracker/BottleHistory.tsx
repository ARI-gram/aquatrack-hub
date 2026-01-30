/**
 * BottleHistory Component
 * Displays bottle transaction history
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowDownLeft, ArrowUpRight, RefreshCw, AlertCircle } from 'lucide-react';
import { BottleTransactionType, type BottleActivityItem } from '@/types/bottle.types';

interface BottleHistoryProps {
  activities: BottleActivityItem[];
  limit?: number;
}

export const BottleHistory: React.FC<BottleHistoryProps> = ({
  activities,
  limit,
}) => {
  const displayActivities = limit ? activities.slice(0, limit) : activities;

  const getActivityIcon = (type: BottleTransactionType) => {
    switch (type) {
      case BottleTransactionType.PURCHASE:
        return <Package className="h-4 w-4 text-primary" />;
      case BottleTransactionType.REFILL_DELIVERED:
        return <ArrowDownLeft className="h-4 w-4 text-success" />;
      case BottleTransactionType.EMPTY_COLLECTED:
        return <ArrowUpRight className="h-4 w-4 text-muted-foreground" />;
      case BottleTransactionType.EXCHANGE:
        return <RefreshCw className="h-4 w-4 text-accent" />;
      default:
        return <AlertCircle className="h-4 w-4 text-warning" />;
    }
  };

  const getActivityLabel = (type: BottleTransactionType) => {
    switch (type) {
      case BottleTransactionType.PURCHASE:
        return 'Purchased';
      case BottleTransactionType.REFILL_DELIVERED:
        return 'Refilled';
      case BottleTransactionType.EMPTY_COLLECTED:
        return 'Collected';
      case BottleTransactionType.EXCHANGE:
        return 'Exchanged';
      case BottleTransactionType.RETURNED:
        return 'Returned';
      case BottleTransactionType.DAMAGED_REPORT:
        return 'Damaged';
      case BottleTransactionType.LOST_REPORT:
        return 'Lost';
      default:
        return 'Updated';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success" className="text-xs">Completed</Badge>;
      case 'IN_TRANSIT':
        return <Badge variant="info" className="text-xs">In Transit</Badge>;
      case 'PENDING':
        return <Badge variant="warning" className="text-xs">Pending</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-4">Bottle Activity</h3>
      <div className="space-y-4">
        {displayActivities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
          >
            <div className="p-2 rounded-lg bg-muted">
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {getActivityLabel(activity.type)} {activity.quantity} bottles
                </span>
                {getStatusBadge(activity.status)}
              </div>
              {activity.orderNumber && (
                <p className="text-sm text-muted-foreground">
                  Order #{activity.orderNumber}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(activity.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        ))}

        {displayActivities.length === 0 && (
          <p className="text-center text-muted-foreground py-4">
            No bottle activity yet
          </p>
        )}
      </div>
    </Card>
  );
};

export default BottleHistory;

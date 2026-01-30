/**
 * DeliveryTracker Component
 * Real-time delivery tracking with timeline
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  Circle,
  User,
} from 'lucide-react';
import { CustomerOrderStatus, type DeliveryTrackingData } from '@/types/customerOrder.types';

interface DeliveryTrackerProps {
  tracking: DeliveryTrackingData;
  onCallDriver?: () => void;
  onTrackLive?: () => void;
}

export const DeliveryTracker: React.FC<DeliveryTrackerProps> = ({
  tracking,
  onCallDriver,
  onTrackLive,
}) => {
  const getProgress = () => {
    const statusProgress: Record<CustomerOrderStatus, number> = {
      [CustomerOrderStatus.DRAFT]: 0,
      [CustomerOrderStatus.PENDING_PAYMENT]: 10,
      [CustomerOrderStatus.PENDING_CONFIRMATION]: 20,
      [CustomerOrderStatus.CONFIRMED]: 35,
      [CustomerOrderStatus.ASSIGNED]: 50,
      [CustomerOrderStatus.IN_TRANSIT]: 65,
      [CustomerOrderStatus.NEAR_YOU]: 85,
      [CustomerOrderStatus.DELIVERED]: 95,
      [CustomerOrderStatus.EXCHANGE_PENDING]: 98,
      [CustomerOrderStatus.COMPLETED]: 100,
      [CustomerOrderStatus.CANCELLED]: 0,
      [CustomerOrderStatus.FAILED]: 0,
    };
    return statusProgress[tracking.status] || 0;
  };

  const getStatusBadge = () => {
    const statusConfig: Record<string, { variant: 'default' | 'warning' | 'info' | 'success' | 'destructive'; label: string }> = {
      [CustomerOrderStatus.PENDING_CONFIRMATION]: { variant: 'warning', label: 'Pending' },
      [CustomerOrderStatus.CONFIRMED]: { variant: 'info', label: 'Confirmed' },
      [CustomerOrderStatus.ASSIGNED]: { variant: 'info', label: 'Driver Assigned' },
      [CustomerOrderStatus.IN_TRANSIT]: { variant: 'info', label: 'On The Way' },
      [CustomerOrderStatus.NEAR_YOU]: { variant: 'success', label: 'Almost There!' },
      [CustomerOrderStatus.DELIVERED]: { variant: 'success', label: 'Delivered' },
      [CustomerOrderStatus.COMPLETED]: { variant: 'success', label: 'Completed' },
    };
    const config = statusConfig[tracking.status] || { variant: 'default' as const, label: tracking.status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getETAText = () => {
    if (!tracking.estimatedArrival) return null;
    
    const eta = new Date(tracking.estimatedArrival);
    const now = new Date();
    const diffMinutes = Math.max(0, Math.floor((eta.getTime() - now.getTime()) / 60000));
    
    if (diffMinutes < 1) return 'Arriving now';
    if (diffMinutes < 60) return `${diffMinutes} min away`;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}h ${mins}m away`;
  };

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground">Order #{tracking.orderNumber}</p>
          <h3 className="font-semibold text-lg">
            {tracking.bottles.toDeliver} Bottles
          </h3>
        </div>
        {getStatusBadge()}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <Progress value={getProgress()} className="h-2" />
        {getETAText() && (
          <div className="flex items-center gap-2 mt-2">
            <Clock className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">{getETAText()}</span>
          </div>
        )}
      </div>

      {/* Driver Info */}
      {tracking.driver && (
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium">{tracking.driver.name}</p>
            <p className="text-sm text-muted-foreground">
              {tracking.driver.vehicleNumber}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onCallDriver}>
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onTrackLive}>
          <MapPin className="h-4 w-4 mr-2" />
          Track Live
        </Button>
      </div>

      {/* Timeline */}
      <div className="mt-6 pt-6 border-t border-border">
        <h4 className="font-medium text-sm text-muted-foreground mb-4">Order Timeline</h4>
        <OrderTimeline timeline={tracking.timeline} />
      </div>
    </Card>
  );
};

interface OrderTimelineProps {
  timeline: DeliveryTrackingData['timeline'];
}

const OrderTimeline: React.FC<OrderTimelineProps> = ({ timeline }) => {
  const steps = [
    { key: 'orderPlaced', label: 'Order Placed', time: timeline.orderPlaced },
    { key: 'confirmed', label: 'Confirmed', time: timeline.confirmed },
    { key: 'driverAssigned', label: 'Driver Assigned', time: timeline.driverAssigned },
    { key: 'inTransit', label: 'In Transit', time: timeline.inTransit },
    { key: 'delivered', label: 'Delivered', time: timeline.delivered },
    { key: 'completed', label: 'Completed', time: timeline.completed },
  ];

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const isCompleted = !!step.time;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              {isCompleted ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/30" />
              )}
              {!isLast && (
                <div className={`w-0.5 h-6 mt-1 ${isCompleted ? 'bg-success' : 'bg-muted-foreground/20'}`} />
              )}
            </div>
            <div className="flex-1 pb-2">
              <p className={`text-sm font-medium ${isCompleted ? '' : 'text-muted-foreground'}`}>
                {step.label}
              </p>
              {step.time && (
                <p className="text-xs text-muted-foreground">
                  {new Date(step.time).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DeliveryTracker;

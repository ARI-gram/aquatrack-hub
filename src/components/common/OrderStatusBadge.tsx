// /src/components/common/OrderStatusBadge.tsx
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { OrderStatus, PaymentStatus, orderStatusConfig, paymentStatusConfig } from '@/types/order.types';

type BadgeVariant = 'pending' | 'confirmed' | 'in_delivery' | 'completed' | 'cancelled' | 'invoiced';

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status }) => {
  const variantMap: Record<OrderStatus, BadgeVariant> = {
    pending: 'pending',
    confirmed: 'confirmed',
    in_delivery: 'in_delivery',
    completed: 'completed',
    cancelled: 'cancelled',
    invoiced: 'invoiced',
  };

  return (
    <Badge variant={variantMap[status]} className="font-medium">
      {orderStatusConfig[status].label}
    </Badge>
  );
};

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
}

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({ status }) => {
  const config = paymentStatusConfig[status];
  const variantMap: Record<PaymentStatus, 'pending' | 'success' | 'info' | 'destructive'> = {
    pending: 'pending',
    paid: 'success',
    partial: 'info',
    overdue: 'destructive',
  };
  
  return (
    <Badge variant={variantMap[status]} className="font-medium">
      {config.label}
    </Badge>
  );
};

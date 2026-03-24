/**
 * PricingCalculator Component
 * Real-time price calculation display
 */
// /src/components/customer/PricingCalculator/index.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, DollarSign, Percent } from 'lucide-react';
import {
  CUSTOMER_PRICING,
  calculatePriceWithDiscount,
  calculateDeliveryFee,
  BULK_DISCOUNTS,
} from '@/constants/pricing';

interface PricingCalculatorProps {
  orderType: 'REFILL' | 'NEW_BOTTLE';
  quantity: number;
  isUrgent?: boolean;
  isAfterHours?: boolean;
  showBreakdown?: boolean;
}

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  orderType,
  quantity,
  isUrgent = false,
  isAfterHours = false,
  showBreakdown = true,
}) => {
  const unitPrice = orderType === 'REFILL' 
    ? CUSTOMER_PRICING.REFILL_PRICE 
    : CUSTOMER_PRICING.NEW_BOTTLE_PRICE;

  const { subtotal, discount, total: itemsTotal } = calculatePriceWithDiscount(quantity, unitPrice);
  const deliveryFee = calculateDeliveryFee(itemsTotal, isUrgent, isAfterHours);
  const total = itemsTotal + deliveryFee;

  const applicableDiscount = BULK_DISCOUNTS.find(d => quantity >= d.minQuantity);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Price Breakdown</h3>
      </div>

      {showBreakdown && (
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {quantity} × {orderType === 'REFILL' ? 'Refill' : 'New Bottle'}
            </span>
            <span>${subtotal.toFixed(2)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span className="flex items-center gap-1">
                <Percent className="h-3 w-3" />
                Bulk Discount ({applicableDiscount?.discountPercentage}%)
              </span>
              <span>-${discount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Truck className="h-3 w-3" />
              Delivery Fee
              {deliveryFee === 0 && (
                <Badge variant="success" className="text-xs ml-1">FREE</Badge>
              )}
            </span>
            <span>{deliveryFee > 0 ? `$${deliveryFee.toFixed(2)}` : '$0.00'}</span>
          </div>

          {isUrgent && (
            <div className="flex justify-between text-sm text-accent">
              <span>Urgent Delivery</span>
              <span>+${CUSTOMER_PRICING.URGENT_DELIVERY_FEE.toFixed(2)}</span>
            </div>
          )}

          {isAfterHours && (
            <div className="flex justify-between text-sm text-accent">
              <span>After Hours Fee</span>
              <span>+${CUSTOMER_PRICING.AFTER_HOURS_FEE.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      <div className="pt-4 border-t border-border">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-lg">Total</span>
          <span className="font-bold text-xl text-primary">
            {CUSTOMER_PRICING.CURRENCY_SYMBOL}{total.toFixed(2)}
          </span>
        </div>
      </div>

      {itemsTotal < CUSTOMER_PRICING.FREE_DELIVERY_THRESHOLD && (
        <p className="text-xs text-muted-foreground mt-2">
          Add ${(CUSTOMER_PRICING.FREE_DELIVERY_THRESHOLD - itemsTotal).toFixed(2)} more for free delivery
        </p>
      )}
    </Card>
  );
};

export default PricingCalculator;

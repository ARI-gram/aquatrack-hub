/**
 * OrderWizard Component
 * Multi-step order placement flow
 */
// /src/components/customer/OrderWizard/index.tsx
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  RefreshCw,
  Package,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  Wallet,
  Banknote,
  Building,
  Calendar,
  Clock,
  MapPin,
} from 'lucide-react';
import { PricingCalculator } from '../PricingCalculator';
import { CUSTOMER_PRICING, DELIVERY_TIME_SLOTS } from '@/constants/pricing';
import type { CustomerAddress } from '@/types/customer.types';
import type { CreateOrderRequest } from '@/types/customerOrder.types';
import { OrderType } from '@/types/customerOrder.types';
import { PaymentMethod } from '@/types/wallet.types';

interface OrderWizardProps {
  emptyBottles: number;
  walletBalance: number;
  addresses: CustomerAddress[];
  onSubmit: (order: CreateOrderRequest) => Promise<void>;
  onCancel: () => void;
}

type LocalOrderType = 'REFILL' | 'NEW_BOTTLE';
type Step = 'type' | 'quantity' | 'delivery' | 'payment' | 'review';

const STEPS: { key: Step; label: string }[] = [
  { key: 'type', label: 'Order Type' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'payment', label: 'Payment' },
  { key: 'review', label: 'Review' },
];

export const OrderWizard: React.FC<OrderWizardProps> = ({
  emptyBottles,
  walletBalance,
  addresses,
  onSubmit,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('type');
  const [orderType, setOrderType] = useState<LocalOrderType | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedAddress, setSelectedAddress] = useState<string>(addresses[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.WALLET);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const getMaxQuantity = () => {
    if (orderType === 'REFILL') return emptyBottles;
    return 20;
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'type':
        return orderType !== null;
      case 'quantity':
        return quantity > 0 && quantity <= getMaxQuantity();
      case 'delivery':
        return selectedAddress && selectedDate && selectedTimeSlot;
      case 'payment':
        return paymentMethod !== null;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].key);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].key);
    } else {
      onCancel();
    }
  };

  const handleSubmit = async () => {
    if (!orderType || !selectedAddress || !selectedDate || !selectedTimeSlot) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        orderType: orderType === 'REFILL' ? OrderType.REFILL : OrderType.NEW_BOTTLE,
        items: [{ type: orderType, quantity }],
        addressId: selectedAddress,
        scheduledDate: selectedDate,
        scheduledTimeSlot: selectedTimeSlot,
        paymentMethod,
        deliveryInstructions,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'type':
        return (
          <StepTypeSelection
            selectedType={orderType}
            onSelect={setOrderType}
            emptyBottles={emptyBottles}
          />
        );
      case 'quantity':
        return (
          <StepQuantitySelection
            orderType={orderType!}
            quantity={quantity}
            onQuantityChange={setQuantity}
            maxQuantity={getMaxQuantity()}
          />
        );
      case 'delivery':
        return (
          <StepDeliveryDetails
            addresses={addresses}
            selectedAddress={selectedAddress}
            onAddressChange={setSelectedAddress}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            selectedTimeSlot={selectedTimeSlot}
            onTimeSlotChange={setSelectedTimeSlot}
            deliveryInstructions={deliveryInstructions}
            onInstructionsChange={setDeliveryInstructions}
          />
        );
      case 'payment':
        return (
          <StepPaymentMethod
            selectedMethod={paymentMethod}
            onMethodChange={setPaymentMethod}
            walletBalance={walletBalance}
            orderTotal={calculateTotal()}
          />
        );
      case 'review':
        return (
          <StepOrderReview
            orderType={orderType!}
            quantity={quantity}
            address={addresses.find(a => a.id === selectedAddress)!}
            date={selectedDate}
            timeSlot={selectedTimeSlot}
            paymentMethod={paymentMethod}
            walletBalance={walletBalance}
          />
        );
      default:
        return null;
    }
  };

  const calculateTotal = () => {
    if (!orderType) return 0;
    const unitPrice = orderType === 'REFILL' ? CUSTOMER_PRICING.REFILL_PRICE : CUSTOMER_PRICING.NEW_BOTTLE_PRICE;
    return quantity * unitPrice + CUSTOMER_PRICING.DELIVERY_FEE;
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          {STEPS.map((step, index) => (
            <span
              key={step.key}
              className={`text-xs font-medium ${
                index <= currentStepIndex ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
          ))}
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Content */}
      <Card className="p-6 mb-6">
        {renderStep()}
      </Card>

      {/* Navigation */}
      <div className="flex gap-4">
        <Button variant="outline" onClick={handleBack} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        {currentStep === 'review' ? (
          <Button
            variant="ocean"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Placing Order...' : 'Confirm Order'}
            <CheckCircle className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            variant="ocean"
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex-1"
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
};

// Sub-components
interface StepTypeSelectionProps {
  selectedType: LocalOrderType | null;
  onSelect: (type: LocalOrderType) => void;
  emptyBottles: number;
}

const StepTypeSelection: React.FC<StepTypeSelectionProps> = ({
  selectedType,
  onSelect,
  emptyBottles,
}) => (
  <div>
    <h2 className="text-xl font-semibold mb-2">What would you like to order?</h2>
    <p className="text-muted-foreground mb-6">Choose your order type</p>

    <div className="grid gap-4">
      <button
        onClick={() => onSelect('REFILL')}
        className={`p-4 border-2 rounded-lg text-left transition-colors ${
          selectedType === 'REFILL'
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <RefreshCw className="h-6 w-6 text-primary" />
          <span className="font-semibold">Refill</span>
          {selectedType === 'REFILL' && <CheckCircle className="h-5 w-5 text-primary ml-auto" />}
        </div>
        <p className="text-2xl font-bold text-primary mb-1">
          ${CUSTOMER_PRICING.REFILL_PRICE.toFixed(2)} <span className="text-sm font-normal">per bottle</span>
        </p>
        <p className="text-sm text-muted-foreground">
          You have {emptyBottles} empty bottles ready for refill
        </p>
      </button>

      <button
        onClick={() => onSelect('NEW_BOTTLE')}
        className={`p-4 border-2 rounded-lg text-left transition-colors ${
          selectedType === 'NEW_BOTTLE'
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <Package className="h-6 w-6 text-accent" />
          <span className="font-semibold">New Bottles</span>
          {selectedType === 'NEW_BOTTLE' && <CheckCircle className="h-5 w-5 text-primary ml-auto" />}
        </div>
        <p className="text-2xl font-bold text-accent mb-1">
          ${CUSTOMER_PRICING.NEW_BOTTLE_PRICE.toFixed(2)} <span className="text-sm font-normal">per bottle</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Includes new bottle + water
        </p>
      </button>
    </div>
  </div>
);

interface StepQuantitySelectionProps {
  orderType: LocalOrderType;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  maxQuantity: number;
}

const StepQuantitySelection: React.FC<StepQuantitySelectionProps> = ({
  orderType,
  quantity,
  onQuantityChange,
  maxQuantity,
}) => (
  <div>
    <h2 className="text-xl font-semibold mb-2">How many bottles?</h2>
    <p className="text-muted-foreground mb-6">
      {orderType === 'REFILL' 
        ? `You can refill up to ${maxQuantity} bottles`
        : 'Select your quantity'}
    </p>

    <div className="flex items-center justify-center gap-6 mb-6">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
        disabled={quantity <= 1}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="text-4xl font-bold w-20 text-center">{quantity}</span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
        disabled={quantity >= maxQuantity}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>

    <div className="flex justify-center gap-2 mb-6">
      {Array.from({ length: Math.min(maxQuantity, 5) }).map((_, i) => (
        <span key={i} className={i < quantity ? 'text-2xl' : 'text-2xl opacity-30'}>
          🍾
        </span>
      ))}
      {maxQuantity > 5 && quantity > 5 && <span className="text-sm text-muted-foreground">+{quantity - 5}</span>}
    </div>

    <PricingCalculator orderType={orderType} quantity={quantity} />
  </div>
);

interface StepDeliveryDetailsProps {
  addresses: CustomerAddress[];
  selectedAddress: string;
  onAddressChange: (id: string) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedTimeSlot: string;
  onTimeSlotChange: (slot: string) => void;
  deliveryInstructions: string;
  onInstructionsChange: (instructions: string) => void;
}

const StepDeliveryDetails: React.FC<StepDeliveryDetailsProps> = ({
  addresses,
  selectedAddress,
  onAddressChange,
  selectedDate,
  onDateChange,
  selectedTimeSlot,
  onTimeSlotChange,
  deliveryInstructions,
  onInstructionsChange,
}) => {
  // Generate next 7 days
  const dates = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    return {
      value: date.toISOString().split('T')[0],
      label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    };
  });

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Delivery Details</h2>
      <p className="text-muted-foreground mb-6">When and where should we deliver?</p>

      <div className="space-y-4">
        <div>
          <Label className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4" />
            Delivery Date
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {dates.slice(0, 6).map(date => (
              <Button
                key={date.value}
                variant={selectedDate === date.value ? 'ocean' : 'outline'}
                size="sm"
                onClick={() => onDateChange(date.value)}
                className="text-xs"
              >
                {date.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4" />
            Time Slot
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {DELIVERY_TIME_SLOTS.map(slot => (
              <Button
                key={slot.id}
                variant={selectedTimeSlot === slot.id ? 'ocean' : 'outline'}
                size="sm"
                onClick={() => onTimeSlotChange(slot.id)}
                className="text-xs"
              >
                {slot.label}
                {'surcharge' in slot && slot.surcharge && <Badge className="ml-1 text-xs">+${slot.surcharge}</Badge>}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4" />
            Delivery Address
          </Label>
          {addresses.map(addr => (
            <button
              key={addr.id}
              onClick={() => onAddressChange(addr.id)}
              className={`w-full p-3 border rounded-lg text-left mb-2 transition-colors ${
                selectedAddress === addr.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <p className="font-medium">{addr.label}</p>
              <p className="text-sm text-muted-foreground">{addr.address}</p>
            </button>
          ))}
        </div>

        <div>
          <Label htmlFor="instructions">Special Instructions (Optional)</Label>
          <Textarea
            id="instructions"
            placeholder="e.g., Call when you arrive"
            value={deliveryInstructions}
            onChange={(e) => onInstructionsChange(e.target.value)}
            className="mt-2"
          />
        </div>
      </div>
    </div>
  );
};

interface StepPaymentMethodProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  walletBalance: number;
  orderTotal: number;
}

const StepPaymentMethod: React.FC<StepPaymentMethodProps> = ({
  selectedMethod,
  onMethodChange,
  walletBalance,
  orderTotal,
}) => {
  const paymentOptions = [
    {
      method: PaymentMethod.WALLET,
      icon: Wallet,
      label: 'Wallet Balance',
      subtitle: `Available: $${walletBalance.toFixed(2)}`,
      disabled: walletBalance < orderTotal,
    },
    {
      method: PaymentMethod.CASH,
      icon: Banknote,
      label: 'Cash on Delivery',
      subtitle: 'Pay when driver arrives',
      disabled: false,
    },
    {
      method: PaymentMethod.CREDIT_ACCOUNT,
      icon: Building,
      label: 'Credit Account',
      subtitle: 'Pay later',
      disabled: false,
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Payment Method</h2>
      <p className="text-muted-foreground mb-6">Choose how you'd like to pay</p>

      <div className="space-y-3">
        {paymentOptions.map(option => (
          <button
            key={option.method}
            onClick={() => !option.disabled && onMethodChange(option.method)}
            disabled={option.disabled}
            className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
              selectedMethod === option.method
                ? 'border-primary bg-primary/5'
                : option.disabled
                ? 'border-border opacity-50 cursor-not-allowed'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <option.icon className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium">{option.label}</p>
                <p className="text-sm text-muted-foreground">{option.subtitle}</p>
              </div>
              {selectedMethod === option.method && (
                <CheckCircle className="h-5 w-5 text-primary" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

interface StepOrderReviewProps {
  orderType: LocalOrderType;
  quantity: number;
  address: CustomerAddress;
  date: string;
  timeSlot: string;
  paymentMethod: PaymentMethod;
  walletBalance: number;
}

const StepOrderReview: React.FC<StepOrderReviewProps> = ({
  orderType,
  quantity,
  address,
  date,
  timeSlot,
  paymentMethod,
  walletBalance,
}) => {
  const timeSlotLabel = DELIVERY_TIME_SLOTS.find(s => s.id === timeSlot)?.label || timeSlot;
  const unitPrice = orderType === 'REFILL' ? CUSTOMER_PRICING.REFILL_PRICE : CUSTOMER_PRICING.NEW_BOTTLE_PRICE;
  const subtotal = quantity * unitPrice;
  const deliveryFee = CUSTOMER_PRICING.DELIVERY_FEE;
  const total = subtotal + deliveryFee;

  const paymentLabels: Record<PaymentMethod, string> = {
    [PaymentMethod.WALLET]: 'Wallet Balance',
    [PaymentMethod.CASH]: 'Cash on Delivery',
    [PaymentMethod.CARD]: 'Credit Card',
    [PaymentMethod.CREDIT_ACCOUNT]: 'Credit Account',
    [PaymentMethod.MPESA]: 'M-Pesa',
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Review Your Order</h2>
      <p className="text-muted-foreground mb-6">Please confirm your order details</p>

      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          {orderType === 'REFILL' ? (
            <RefreshCw className="h-5 w-5 text-primary" />
          ) : (
            <Package className="h-5 w-5 text-accent" />
          )}
          <div>
            <p className="font-medium">
              {quantity} × {orderType === 'REFILL' ? 'Refill' : 'New Bottles'}
            </p>
            <p className="text-sm text-muted-foreground">
              ${unitPrice.toFixed(2)} each
            </p>
          </div>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">Delivery</p>
          <p className="font-medium">
            {new Date(date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <p className="text-sm">{timeSlotLabel}</p>
          <p className="text-sm text-muted-foreground mt-2">{address.address}</p>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">Payment</p>
          <p className="font-medium">{paymentLabels[paymentMethod]}</p>
          {paymentMethod === PaymentMethod.WALLET && (
            <p className="text-sm text-muted-foreground">
              New balance: ${(walletBalance - total).toFixed(2)}
            </p>
          )}
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span>Delivery</span>
            <span>${deliveryFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-lg">
            <span>Total</span>
            <span className="text-primary">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderWizard;

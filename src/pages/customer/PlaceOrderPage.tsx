/**
 * Place Order Page
 * Role: Customer
 * Route: /customer/order
 * Customer self-service order placement
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import {
  ArrowLeft,
  CalendarIcon,
  Plus,
  Minus,
  ShoppingCart,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
}

const products: Product[] = [
  {
    id: 'p1',
    name: '20L Water Bottle',
    description: 'Premium purified water - 20 liters',
    price: 15.0,
  },
  {
    id: 'p2',
    name: '5L Water Bottle',
    description: 'Convenient size for home use',
    price: 8.0,
  },
  {
    id: 'p3',
    name: '1L Pack (12 bottles)',
    description: 'Pack of 12 individual bottles',
    price: 12.0,
  },
];

const PlaceOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [deliveryDate, setDeliveryDate] = useState<Date>();
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateCart = (productId: string, delta: number) => {
    setCart((prev) => {
      const newQty = (prev[productId] || 0) + delta;
      if (newQty <= 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: newQty };
    });
  };

  const getCartTotal = () => {
    return Object.entries(cart).reduce((sum, [productId, qty]) => {
      const product = products.find((p) => p.id === productId);
      return sum + (product?.price || 0) * qty;
    }, 0);
  };

  const getCartItemCount = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  };

  const handleSubmit = async () => {
    if (getCartItemCount() === 0) {
      toast.error('Please add items to your cart');
      return;
    }
    if (!deliveryDate) {
      toast.error('Please select a delivery date');
      return;
    }

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    toast.success('Order placed successfully!');
    navigate('/customer');
  };

  return (
    <DashboardLayout title="Place Order" subtitle="Select products and schedule delivery">
      <Button variant="ghost" className="mb-4" onClick={() => navigate('/customer')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Select Products</h3>
            <div className="space-y-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{product.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {product.description}
                    </p>
                    <p className="font-medium text-primary mt-1">
                      ${product.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => updateCart(product.id, -1)}
                      disabled={!cart[product.id]}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">
                      {cart[product.id] || 0}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => updateCart(product.id, 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Delivery Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delivery Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !deliveryDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deliveryDate ? format(deliveryDate, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={deliveryDate}
                      onSelect={setDeliveryDate}
                      initialFocus
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Delivery Address</Label>
                <Input defaultValue="123 Main Street, Apt 4B" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label>Special Instructions (optional)</Label>
              <Textarea
                placeholder="Any special delivery instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Payment Method</h3>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              <div className="flex items-center space-x-2 p-4 border rounded-lg">
                <RadioGroupItem value="wallet" id="wallet" />
                <Label htmlFor="wallet" className="flex-1 flex items-center gap-3 cursor-pointer">
                  <Wallet className="h-5 w-5 text-success" />
                  <div>
                    <p className="font-medium">Wallet Balance</p>
                    <p className="text-sm text-muted-foreground">
                      Available: $125.00
                    </p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-4 border rounded-lg">
                <RadioGroupItem value="card" id="card" />
                <Label htmlFor="card" className="flex-1 flex items-center gap-3 cursor-pointer">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Credit Card</p>
                    <p className="text-sm text-muted-foreground">
                      •••• 4242
                    </p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-4 border rounded-lg">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="flex-1 flex items-center gap-3 cursor-pointer">
                  <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs">
                    $
                  </div>
                  <div>
                    <p className="font-medium">Cash on Delivery</p>
                    <p className="text-sm text-muted-foreground">
                      Pay when you receive
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="p-6 sticky top-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Order Summary
            </h3>

            {getCartItemCount() === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Your cart is empty
              </p>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {Object.entries(cart).map(([productId, qty]) => {
                    const product = products.find((p) => p.id === productId);
                    if (!product) return null;
                    return (
                      <div key={productId} className="flex justify-between text-sm">
                        <span>
                          {product.name} x{qty}
                        </span>
                        <span>${(product.price * qty).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${getCartTotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="text-success">Free</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span className="text-lg">${getCartTotal().toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}

            <Button
              variant="ocean"
              className="w-full mt-6"
              onClick={handleSubmit}
              disabled={isSubmitting || getCartItemCount() === 0}
            >
              {isSubmitting ? 'Placing Order...' : 'Place Order'}
            </Button>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PlaceOrderPage;

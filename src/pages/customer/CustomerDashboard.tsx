/**
 * Customer Dashboard Page
 * Role: Customer
 * Route: /customer
 * Customer portal dashboard with integrated components
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { BottleTracker } from '@/components/customer/BottleTracker';
import { WalletCard } from '@/components/customer/WalletCard';
import { DeliveryTracker } from '@/components/customer/DeliveryTracker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';
import { CUSTOMER_PRICING } from '@/constants/pricing';
import { CustomerOrderStatus, type DeliveryTrackingData } from '@/types/customerOrder.types';
import { BottleInventory } from '@/types/bottle.types';
import { CustomerWallet } from '@/types/wallet.types';
import {
  Package,
  Plus,
  Clock,
  ArrowRight,
  CalendarClock,
} from 'lucide-react';

// Mock data
const mockBottleInventory: BottleInventory = {
  customerId: 'customer-001',
  totalOwned: 10,
  fullBottles: 3,
  emptyBottles: 5,
  inTransit: 2,
  atDistributor: 0,
  depositPerBottle: CUSTOMER_PRICING.BOTTLE_DEPOSIT,
  totalDeposit: 100,
  lastUpdated: new Date().toISOString(),
};

const mockWallet: CustomerWallet = {
  walletId: 'wallet-001',
  customerId: 'customer-001',
  balance: 45.00,
  currency: 'USD',
  lastUpdated: new Date().toISOString(),
  restrictions: {
    minBalance: 0,
    maxBalance: 1000,
    dailySpendLimit: 500,
  },
};

const mockActiveDelivery: DeliveryTrackingData = {
  orderId: 'order-001',
  orderNumber: 'ORD-2024-045',
  status: CustomerOrderStatus.IN_TRANSIT,
  estimatedArrival: new Date(Date.now() + 12 * 60 * 1000).toISOString(), // 12 minutes from now
  driver: {
    name: 'Hassan Mohammed',
    phone: '+254 712 345 678',
    vehicleNumber: 'KBA 123A',
  },
  bottles: {
    toDeliver: 3,
    toCollect: 3,
    exchangeConfirmed: false,
  },
  timeline: {
    orderPlaced: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    confirmed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    driverAssigned: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    inTransit: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
};

const recentOrders = [
  {
    id: '1',
    orderNumber: 'ORD-2024-045',
    date: '2024-11-14',
    items: 3,
    total: 45.0,
    status: 'in_delivery',
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-042',
    date: '2024-11-10',
    items: 5,
    total: 75.0,
    status: 'completed',
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-038',
    date: '2024-11-05',
    items: 2,
    total: 30.0,
    status: 'completed',
  },
];

const scheduledDeliveries = [
  { date: 'Tomorrow', time: '10:00 AM', bottles: 3 },
  { date: 'Friday', time: '2:00 PM', bottles: 5 },
];

const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'warning' | 'info' | 'success'; label: string }> = {
      pending: { variant: 'warning', label: 'Pending' },
      in_delivery: { variant: 'info', label: 'In Delivery' },
      completed: { variant: 'success', label: 'Completed' },
    };
    const statusConfig = config[status] || config.pending;
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
  };

  const hasActiveDelivery = recentOrders.some((o) => o.status === 'in_delivery');

  return (
    <CustomerLayout title="Dashboard">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button variant="ocean" onClick={() => navigate(CUSTOMER_ROUTES.PLACE_ORDER)}>
          <Plus className="h-4 w-4 mr-2" />
          Place Order
        </Button>
        <Button variant="outline" onClick={() => navigate(CUSTOMER_ROUTES.WALLET)}>
          Add Funds
        </Button>
      </div>

      {/* Active Delivery Tracker */}
      {hasActiveDelivery && (
        <div className="mb-6">
          <DeliveryTracker
            tracking={mockActiveDelivery}
            onCallDriver={() => window.open(`tel:${mockActiveDelivery.driver?.phone}`)}
            onTrackLive={() => console.log('Track live')}
          />
        </div>
      )}

      {/* Bottle & Wallet Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BottleTracker inventory={mockBottleInventory} />
        <WalletCard wallet={mockWallet} />
      </div>

      {/* Scheduled Deliveries */}
      {scheduledDeliveries.length > 0 && (
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Scheduled Deliveries</h3>
          </div>
          <div className="space-y-2">
            {scheduledDeliveries.map((delivery, index) => (
              <div key={index} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">
                  {delivery.date} at {delivery.time}
                </span>
                <Badge variant="secondary">{delivery.bottles} bottles</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Orders */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Recent Orders</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(CUSTOMER_ROUTES.ORDER_HISTORY)}
          >
            View All
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
        <div className="space-y-4">
          {recentOrders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between py-3 border-b last:border-0"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 rounded-lg bg-muted hidden sm:block">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm sm:text-base">{order.orderNumber}</p>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {order.date}
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline">{order.items} items</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                <span className="font-medium text-sm sm:text-base">${order.total.toFixed(2)}</span>
                {getStatusBadge(order.status)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </CustomerLayout>
  );
};

export default CustomerDashboard;

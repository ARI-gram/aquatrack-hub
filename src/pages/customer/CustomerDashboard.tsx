/**
 * Customer Dashboard Page
 * Role: Customer
 * Route: /customer
 * Customer portal dashboard
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/common/StatCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Wallet,
  Truck,
  Plus,
  Clock,
  ArrowRight,
} from 'lucide-react';

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

  return (
    <DashboardLayout
      title="Welcome Back!"
      subtitle="Manage your orders and track deliveries"
    >
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Button variant="ocean" onClick={() => navigate('/customer/order')}>
          <Plus className="h-4 w-4 mr-2" />
          Place New Order
        </Button>
        <Button variant="outline" onClick={() => navigate('/customer/wallet')}>
          <Wallet className="h-4 w-4 mr-2" />
          Add Funds
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard
          title="Total Orders"
          value={24}
          icon={Package}
          iconColor="primary"
          change={{ value: 12, type: 'increase' }}
        />
        <StatCard
          title="Wallet Balance"
          value="$125.00"
          icon={Wallet}
          iconColor="success"
        />
        <StatCard
          title="Active Deliveries"
          value={1}
          icon={Truck}
          iconColor="accent"
        />
      </div>

      {/* Active Delivery */}
      {recentOrders.some((o) => o.status === 'in_delivery') && (
        <Card className="p-6 mb-6 border-accent/50 bg-accent/5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-accent/10">
              <Truck className="h-6 w-6 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Your order is on the way!</h3>
              <p className="text-sm text-muted-foreground">
                Order #ORD-2024-045 • Estimated arrival: Today, 2:00 PM - 4:00 PM
              </p>
            </div>
            <Button variant="outline" size="sm">
              Track Order
            </Button>
          </div>
        </Card>
      )}

      {/* Recent Orders */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Recent Orders</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/customer/history')}
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
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{order.orderNumber}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {order.date}
                    <span>•</span>
                    {order.items} items
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium">${order.total.toFixed(2)}</span>
                {getStatusBadge(order.status)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </DashboardLayout>
  );
};

export default CustomerDashboard;

// /src/pages/client/ClientAdminDashboard.tsx
import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/common/StatCard';
import { DataTable, Column } from '@/components/common/DataTable';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/common/OrderStatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Order, OrderStatus, PaymentStatus } from '@/types/order.types';
import {
  Package,
  Truck,
  DollarSign,
  Users,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

// Mock recent orders
const recentOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'ORD-2024-001',
    customerId: 'c1',
    customerName: 'ABC Corporation',
    customerAddress: '123 Business Ave, Suite 100',
    customerPhone: '(555) 123-4567',
    items: [],
    status: 'in_delivery' as OrderStatus,
    paymentMethod: 'credit',
    paymentStatus: 'pending' as PaymentStatus,
    subtotal: 450,
    tax: 36,
    total: 486,
    priority: true,
    scheduledDate: '2024-01-15',
    assignedDriverName: 'Mike Driver',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-002',
    customerId: 'c2',
    customerName: 'XYZ Industries',
    customerAddress: '456 Industrial Park',
    customerPhone: '(555) 987-6543',
    items: [],
    status: 'confirmed' as OrderStatus,
    paymentMethod: 'cash',
    paymentStatus: 'paid' as PaymentStatus,
    subtotal: 320,
    tax: 25.6,
    total: 345.6,
    priority: false,
    scheduledDate: '2024-01-15',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-003',
    customerId: 'c3',
    customerName: 'Downtown Office Complex',
    customerAddress: '789 Main Street',
    customerPhone: '(555) 456-7890',
    items: [],
    status: 'pending' as OrderStatus,
    paymentMethod: 'wallet',
    paymentStatus: 'pending' as PaymentStatus,
    subtotal: 680,
    tax: 54.4,
    total: 734.4,
    priority: true,
    scheduledDate: '2024-01-16',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    orderNumber: 'ORD-2024-004',
    customerId: 'c4',
    customerName: 'Green Valley Gym',
    customerAddress: '321 Fitness Blvd',
    customerPhone: '(555) 321-0987',
    items: [],
    status: 'completed' as OrderStatus,
    paymentMethod: 'card',
    paymentStatus: 'paid' as PaymentStatus,
    subtotal: 280,
    tax: 22.4,
    total: 302.4,
    priority: false,
    scheduledDate: '2024-01-14',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const orderColumns: Column<Order>[] = [
  {
    key: 'orderNumber',
    header: 'Order',
    render: (order) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{order.orderNumber}</span>
        {order.priority && (
          <Badge variant="destructive" className="text-[10px] px-1.5">
            Priority
          </Badge>
        )}
      </div>
    ),
  },
  {
    key: 'customerName',
    header: 'Customer',
    render: (order) => (
      <div>
        <p className="font-medium">{order.customerName}</p>
        <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
      </div>
    ),
  },
  {
    key: 'scheduledDate',
    header: 'Scheduled',
  },
  {
    key: 'status',
    header: 'Status',
    render: (order) => <OrderStatusBadge status={order.status} />,
  },
  {
    key: 'paymentStatus',
    header: 'Payment',
    render: (order) => <PaymentStatusBadge status={order.paymentStatus} />,
  },
  {
    key: 'total',
    header: 'Total',
    render: (order) => <span className="font-medium">${order.total.toFixed(2)}</span>,
  },
];

const deliveryStats = [
  { label: 'En Route', count: 8, icon: Truck, color: 'text-accent' },
  { label: 'Completed', count: 24, icon: CheckCircle, color: 'text-success' },
  { label: 'Pending', count: 12, icon: Clock, color: 'text-warning' },
  { label: 'Issues', count: 2, icon: AlertCircle, color: 'text-destructive' },
];

export const ClientAdminDashboard: React.FC = () => {
  return (
    <DashboardLayout
      title="Dashboard"
      subtitle="Welcome back, John Distributor"
    >
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Today's Orders"
          value="47"
          change={{ value: 18, type: 'increase' }}
          icon={Package}
          iconColor="primary"
        />
        <StatCard
          title="Active Deliveries"
          value="12"
          icon={Truck}
          iconColor="accent"
        />
        <StatCard
          title="Today's Revenue"
          value="$3,842"
          change={{ value: 12, type: 'increase' }}
          icon={DollarSign}
          iconColor="success"
        />
        <StatCard
          title="Active Customers"
          value="248"
          change={{ value: 5, type: 'increase' }}
          icon={Users}
          iconColor="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        {/* Delivery Overview */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Delivery Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {deliveryStats.map((stat) => (
                <div
                  key={stat.label}
                  className="p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stat.count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-auto py-6 flex-col gap-2">
                <Plus className="h-6 w-6 text-primary" />
                <span>New Order</span>
              </Button>
              <Button variant="outline" className="h-auto py-6 flex-col gap-2">
                <Users className="h-6 w-6 text-accent" />
                <span>Add Customer</span>
              </Button>
              <Button variant="outline" className="h-auto py-6 flex-col gap-2">
                <Truck className="h-6 w-6 text-success" />
                <span>Track Delivery</span>
              </Button>
              <Button variant="outline" className="h-auto py-6 flex-col gap-2">
                <DollarSign className="h-6 w-6 text-warning" />
                <span>View Invoices</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Recent Orders</CardTitle>
          <Button variant="ghost" size="sm" className="gap-1">
            View All <ArrowUpRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={orderColumns}
            data={recentOrders}
            onRowClick={(order) => console.log('Clicked order:', order.id)}
          />
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

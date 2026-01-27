import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/common/OrderStatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Order, OrderStatus, PaymentStatus } from '@/types/order.types';
import {
  Plus,
  Search,
  Filter,
  Download,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Mock orders data
const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'ORD-2024-001',
    customerId: 'c1',
    customerName: 'ABC Corporation',
    customerAddress: '123 Business Ave, Suite 100',
    customerPhone: '(555) 123-4567',
    items: [{ id: 'i1', productId: 'p1', productName: '5-Gallon Bottle', quantity: 10, unitPrice: 15, totalPrice: 150 }],
    status: 'in_delivery',
    paymentMethod: 'credit',
    paymentStatus: 'pending',
    subtotal: 450,
    tax: 36,
    total: 486,
    priority: true,
    scheduledDate: '2024-01-15',
    scheduledTime: '10:30 AM',
    assignedDriverId: 'd1',
    assignedDriverName: 'Mike Driver',
    createdAt: '2024-01-14T08:00:00Z',
    updatedAt: '2024-01-14T08:00:00Z',
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-002',
    customerId: 'c2',
    customerName: 'XYZ Industries',
    customerAddress: '456 Industrial Park',
    customerPhone: '(555) 987-6543',
    items: [],
    status: 'confirmed',
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    subtotal: 320,
    tax: 25.6,
    total: 345.6,
    priority: false,
    scheduledDate: '2024-01-15',
    createdAt: '2024-01-14T09:00:00Z',
    updatedAt: '2024-01-14T09:00:00Z',
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-003',
    customerId: 'c3',
    customerName: 'Downtown Office Complex',
    customerAddress: '789 Main Street',
    customerPhone: '(555) 456-7890',
    items: [],
    status: 'pending',
    paymentMethod: 'wallet',
    paymentStatus: 'pending',
    subtotal: 680,
    tax: 54.4,
    total: 734.4,
    priority: true,
    scheduledDate: '2024-01-16',
    createdAt: '2024-01-14T10:00:00Z',
    updatedAt: '2024-01-14T10:00:00Z',
  },
  {
    id: '4',
    orderNumber: 'ORD-2024-004',
    customerId: 'c4',
    customerName: 'Green Valley Gym',
    customerAddress: '321 Fitness Blvd',
    customerPhone: '(555) 321-0987',
    items: [],
    status: 'completed',
    paymentMethod: 'card',
    paymentStatus: 'paid',
    subtotal: 280,
    tax: 22.4,
    total: 302.4,
    priority: false,
    scheduledDate: '2024-01-14',
    createdAt: '2024-01-13T08:00:00Z',
    updatedAt: '2024-01-14T16:00:00Z',
  },
  {
    id: '5',
    orderNumber: 'ORD-2024-005',
    customerId: 'c5',
    customerName: 'Sunrise Medical Center',
    customerAddress: '555 Healthcare Drive',
    customerPhone: '(555) 555-1234',
    items: [],
    status: 'invoiced',
    paymentMethod: 'credit',
    paymentStatus: 'paid',
    subtotal: 1200,
    tax: 96,
    total: 1296,
    priority: false,
    scheduledDate: '2024-01-13',
    createdAt: '2024-01-12T08:00:00Z',
    updatedAt: '2024-01-13T18:00:00Z',
  },
  {
    id: '6',
    orderNumber: 'ORD-2024-006',
    customerId: 'c6',
    customerName: 'Tech Startup Hub',
    customerAddress: '888 Innovation Lane',
    customerPhone: '(555) 888-9999',
    items: [],
    status: 'cancelled',
    paymentMethod: 'card',
    paymentStatus: 'pending',
    subtotal: 450,
    tax: 36,
    total: 486,
    priority: false,
    scheduledDate: '2024-01-15',
    notes: 'Customer requested cancellation',
    createdAt: '2024-01-14T07:00:00Z',
    updatedAt: '2024-01-14T11:00:00Z',
  },
];

const orderColumns: Column<Order>[] = [
  {
    key: 'orderNumber',
    header: 'Order',
    render: (order) => (
      <div className="flex items-center gap-2">
        <span className="font-semibold text-foreground">{order.orderNumber}</span>
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
        <p className="font-medium text-foreground">{order.customerName}</p>
        <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
      </div>
    ),
  },
  {
    key: 'scheduledDate',
    header: 'Scheduled',
    render: (order) => (
      <div>
        <p className="font-medium text-foreground">{order.scheduledDate}</p>
        {order.scheduledTime && (
          <p className="text-xs text-muted-foreground">{order.scheduledTime}</p>
        )}
      </div>
    ),
  },
  {
    key: 'assignedDriverName',
    header: 'Driver',
    render: (order) => (
      <span className={order.assignedDriverName ? 'text-foreground' : 'text-muted-foreground'}>
        {order.assignedDriverName || 'Unassigned'}
      </span>
    ),
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
    render: (order) => (
      <span className="font-semibold text-foreground">${order.total.toFixed(2)}</span>
    ),
  },
  {
    key: 'actions',
    header: '',
    render: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>View Details</DropdownMenuItem>
          <DropdownMenuItem>Edit Order</DropdownMenuItem>
          <DropdownMenuItem>Assign Driver</DropdownMenuItem>
          <DropdownMenuItem>Generate Invoice</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">Cancel Order</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export const OrdersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredOrders = mockOrders.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = mockOrders.reduce(
    (acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <DashboardLayout
      title="Orders"
      subtitle="Manage and track all customer orders"
    >
      {/* Status Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          All Orders ({mockOrders.length})
        </Button>
        {(['pending', 'confirmed', 'in_delivery', 'completed', 'invoiced', 'cancelled'] as OrderStatus[]).map(
          (status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())} (
              {statusCounts[status] || 0})
            </Button>
          )
        )}
      </div>

      {/* Actions Bar */}
      <Card className="mb-6 border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" className="gap-2 flex-1 md:flex-initial">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button variant="ocean" className="gap-2 flex-1 md:flex-initial">
                <Plus className="h-4 w-4" />
                New Order
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <DataTable
        columns={orderColumns}
        data={filteredOrders}
        onRowClick={(order) => console.log('View order:', order.id)}
        emptyMessage="No orders found matching your criteria"
      />
    </DashboardLayout>
  );
};

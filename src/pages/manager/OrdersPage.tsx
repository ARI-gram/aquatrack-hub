/**
 * Manager Orders Page
 * Role: Site Manager
 * Route: /manager/orders
 * View and manage orders for the site
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { Card } from '@/components/ui/card';
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
import { Search, Plus, Package, Clock, CheckCircle, Truck } from 'lucide-react';
import { OrderStatus } from '@/types/order.types';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  items: number;
  total: number;
  status: OrderStatus;
  scheduledDate: string;
  createdAt: string;
}

const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'ORD-2024-001',
    customerName: 'ABC Corporation',
    items: 5,
    total: 250.0,
    status: 'pending',
    scheduledDate: '2024-11-16',
    createdAt: '2024-11-15 09:30',
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-002',
    customerName: 'XYZ Industries',
    items: 12,
    total: 580.0,
    status: 'confirmed',
    scheduledDate: '2024-11-16',
    createdAt: '2024-11-15 10:15',
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-003',
    customerName: 'Tech Solutions',
    items: 3,
    total: 120.0,
    status: 'in_delivery',
    scheduledDate: '2024-11-15',
    createdAt: '2024-11-14 14:00',
  },
];

const ManagerOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredOrders = mockOrders.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: OrderStatus) => {
    const config: Record<OrderStatus, { variant: 'pending' | 'confirmed' | 'in_delivery' | 'completed' | 'cancelled' | 'invoiced' }> = {
      pending: { variant: 'pending' },
      confirmed: { variant: 'confirmed' },
      in_delivery: { variant: 'in_delivery' },
      completed: { variant: 'completed' },
      cancelled: { variant: 'cancelled' },
      invoiced: { variant: 'invoiced' },
    };
    return <Badge variant={config[status].variant}>{status.replace('_', ' ')}</Badge>;
  };

  const columns: Column<Order>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (order) => (
        <span className="font-mono font-medium">{order.orderNumber}</span>
      ),
    },
    { key: 'customerName', header: 'Customer' },
    {
      key: 'items',
      header: 'Items',
      render: (order) => <span>{order.items} items</span>,
    },
    {
      key: 'total',
      header: 'Total',
      render: (order) => <span className="font-medium">${order.total.toFixed(2)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => getStatusBadge(order.status),
    },
    { key: 'scheduledDate', header: 'Scheduled' },
    { key: 'createdAt', header: 'Created' },
  ];

  return (
    <DashboardLayout title="Orders" subtitle="Manage site orders">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockOrders.length}</p>
              <p className="text-sm text-muted-foreground">Total Orders</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mockOrders.filter((o) => o.status === 'pending').length}
              </p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Truck className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mockOrders.filter((o) => o.status === 'in_delivery').length}
              </p>
              <p className="text-sm text-muted-foreground">In Delivery</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mockOrders.filter((o) => o.status === 'completed').length}
              </p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="in_delivery">In Delivery</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ocean" onClick={() => navigate('/manager/create-order')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Order
        </Button>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filteredOrders} />
    </DashboardLayout>
  );
};

export default ManagerOrdersPage;

/**
 * Order History Page
 * Role: Customer
 * Route: /customer/history
 * View past orders and reorder
 */

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Search,
  Package,
  Clock,
  Download,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  orderNumber: string;
  date: string;
  items: OrderItem[];
  total: number;
  status: 'completed' | 'cancelled';
  deliveryDate: string;
}

const mockOrders: Order[] = [
  {
    id: '1',
    orderNumber: 'ORD-2024-042',
    date: '2024-11-10',
    items: [
      { name: '20L Water Bottle', quantity: 3, price: 15.0 },
      { name: '5L Water Bottle', quantity: 2, price: 8.0 },
    ],
    total: 61.0,
    status: 'completed',
    deliveryDate: '2024-11-11',
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-038',
    date: '2024-11-05',
    items: [{ name: '20L Water Bottle', quantity: 2, price: 15.0 }],
    total: 30.0,
    status: 'completed',
    deliveryDate: '2024-11-06',
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-035',
    date: '2024-11-01',
    items: [
      { name: '1L Pack (12 bottles)', quantity: 4, price: 12.0 },
      { name: '5L Water Bottle', quantity: 5, price: 8.0 },
    ],
    total: 88.0,
    status: 'completed',
    deliveryDate: '2024-11-02',
  },
  {
    id: '4',
    orderNumber: 'ORD-2024-030',
    date: '2024-10-25',
    items: [{ name: '20L Water Bottle', quantity: 1, price: 15.0 }],
    total: 15.0,
    status: 'cancelled',
    deliveryDate: '-',
  },
];

const OrderHistoryPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filteredOrders = mockOrders.filter((order) => {
    const matchesSearch = order.orderNumber
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Order['status']) => {
    if (status === 'completed') {
      return <Badge variant="success">Completed</Badge>;
    }
    return <Badge variant="destructive">Cancelled</Badge>;
  };

  return (
    <DashboardLayout title="Order History" subtitle="View your past orders">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No orders found</p>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono font-medium">{order.orderNumber}</span>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {order.date}
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      {order.items.length} item(s)
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {order.items.map((item) => `${item.name} (x${item.quantity})`).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-lg">${order.total.toFixed(2)}</span>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Order {order.orderNumber}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Order Date</span>
                            <span>{order.date}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Delivery Date</span>
                            <span>{order.deliveryDate}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            {getStatusBadge(order.status)}
                          </div>
                          <div className="border-t pt-4">
                            <p className="font-medium mb-2">Items</p>
                            {order.items.map((item, index) => (
                              <div
                                key={index}
                                className="flex justify-between text-sm py-2"
                              >
                                <span>
                                  {item.name} x{item.quantity}
                                </span>
                                <span>${(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="border-t pt-4 flex justify-between font-semibold">
                            <span>Total</span>
                            <span>${order.total.toFixed(2)}</span>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    {order.status === 'completed' && (
                      <>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Invoice
                        </Button>
                        <Button variant="ocean" size="sm">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reorder
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
};

export default OrderHistoryPage;

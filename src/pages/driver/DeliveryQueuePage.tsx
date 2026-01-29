/**
 * Delivery Queue Page
 * Role: Driver
 * Route: /driver/deliveries
 * View assigned deliveries
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MapPin,
  Clock,
  Phone,
  Navigation,
  Package,
  CheckCircle,
  Truck,
} from 'lucide-react';

interface Delivery {
  id: string;
  orderNumber: string;
  customerName: string;
  address: string;
  phone: string;
  items: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  scheduledTime: string;
  notes?: string;
}

const mockDeliveries: Delivery[] = [
  {
    id: '1',
    orderNumber: 'ORD-2024-001',
    customerName: 'ABC Corporation',
    address: '123 Business Park, Suite 100',
    phone: '+1 555-0301',
    items: 5,
    status: 'in_progress',
    scheduledTime: '10:00 AM',
    notes: 'Use back entrance, ask for John',
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-002',
    customerName: 'XYZ Industries',
    address: '456 Industrial Ave',
    phone: '+1 555-0302',
    items: 12,
    status: 'pending',
    scheduledTime: '11:30 AM',
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-003',
    customerName: 'Tech Solutions',
    address: '789 Tech Drive, Floor 3',
    phone: '+1 555-0303',
    items: 3,
    status: 'pending',
    scheduledTime: '1:00 PM',
  },
  {
    id: '4',
    orderNumber: 'ORD-2024-004',
    customerName: 'Downtown Office',
    address: '100 Main Street',
    phone: '+1 555-0304',
    items: 8,
    status: 'completed',
    scheduledTime: '9:00 AM',
  },
];

const DeliveryQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');

  const getStatusBadge = (status: Delivery['status']) => {
    const config: Record<
      Delivery['status'],
      { variant: 'warning' | 'info' | 'success' | 'destructive'; label: string }
    > = {
      pending: { variant: 'warning', label: 'Pending' },
      in_progress: { variant: 'info', label: 'In Progress' },
      completed: { variant: 'success', label: 'Completed' },
      failed: { variant: 'destructive', label: 'Failed' },
    };
    return <Badge variant={config[status].variant}>{config[status].label}</Badge>;
  };

  const filteredDeliveries = mockDeliveries.filter((delivery) => {
    if (activeTab === 'pending') return delivery.status === 'pending' || delivery.status === 'in_progress';
    if (activeTab === 'completed') return delivery.status === 'completed';
    if (activeTab === 'failed') return delivery.status === 'failed';
    return true;
  });

  const pendingCount = mockDeliveries.filter(
    (d) => d.status === 'pending' || d.status === 'in_progress'
  ).length;
  const completedCount = mockDeliveries.filter((d) => d.status === 'completed').length;

  return (
    <DashboardLayout title="Delivery Queue" subtitle="Your assigned deliveries">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Package className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pending Deliveries</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-sm text-muted-foreground">Completed Today</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mockDeliveries.reduce((sum, d) => sum + d.items, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Items</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedCount})
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredDeliveries.length === 0 ? (
            <Card className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No deliveries found</p>
            </Card>
          ) : (
            filteredDeliveries.map((delivery) => (
              <Card key={delivery.id} className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm text-muted-foreground">
                        {delivery.orderNumber}
                      </span>
                      {getStatusBadge(delivery.status)}
                    </div>
                    <h3 className="font-semibold text-lg">{delivery.customerName}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-4 w-4" />
                      {delivery.address}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {delivery.scheduledTime}
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        {delivery.items} items
                      </div>
                    </div>
                    {delivery.notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        Note: {delivery.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                    <Button variant="outline" size="sm">
                      <Navigation className="h-4 w-4 mr-2" />
                      Navigate
                    </Button>
                    <Button
                      variant="ocean"
                      size="sm"
                      onClick={() => navigate(`/driver/deliveries/${delivery.id}`)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default DeliveryQueuePage;

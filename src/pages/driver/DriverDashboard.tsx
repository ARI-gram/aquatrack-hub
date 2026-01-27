import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Truck,
  CheckCircle,
  MapPin,
  Clock,
  Navigation,
  Phone,
} from 'lucide-react';

// Mock deliveries
const todaysDeliveries = [
  {
    id: '1',
    orderNumber: 'ORD-2024-001',
    customer: 'ABC Corporation',
    address: '123 Business Ave, Suite 100',
    phone: '(555) 123-4567',
    items: 5,
    status: 'next',
    eta: '10:30 AM',
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-002',
    customer: 'XYZ Industries',
    address: '456 Industrial Park',
    phone: '(555) 987-6543',
    items: 3,
    status: 'pending',
    eta: '11:15 AM',
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-003',
    customer: 'Downtown Office',
    address: '789 Main Street',
    phone: '(555) 456-7890',
    items: 8,
    status: 'pending',
    eta: '12:00 PM',
  },
];

const completedDeliveries = [
  { id: 'c1', customer: 'Green Valley Gym', time: '9:15 AM' },
  { id: 'c2', customer: 'Sunrise Cafe', time: '8:45 AM' },
];

export const DriverDashboard: React.FC = () => {
  return (
    <DashboardLayout
      title="My Deliveries"
      subtitle="Welcome back, Mike Driver"
    >
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Remaining"
          value="6"
          icon={Truck}
          iconColor="primary"
        />
        <StatCard
          title="Completed"
          value="8"
          icon={CheckCircle}
          iconColor="success"
        />
        <StatCard
          title="Avg. Time"
          value="18 min"
          icon={Clock}
          iconColor="accent"
        />
        <StatCard
          title="Total Items"
          value="42"
          icon={MapPin}
          iconColor="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Delivery Queue */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Delivery Queue</h2>
          
          {todaysDeliveries.map((delivery, index) => (
            <Card
              key={delivery.id}
              className={`border-border/50 ${delivery.status === 'next' ? 'ring-2 ring-primary shadow-glow' : ''}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${
                      delivery.status === 'next' 
                        ? 'bg-gradient-ocean text-white' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{delivery.customer}</h3>
                      <p className="text-sm text-muted-foreground">{delivery.orderNumber}</p>
                    </div>
                  </div>
                  <Badge variant={delivery.status === 'next' ? 'ocean' : 'secondary'}>
                    {delivery.status === 'next' ? 'Next Stop' : `ETA ${delivery.eta}`}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <MapPin className="h-4 w-4" />
                  <span>{delivery.address}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {delivery.items} items to deliver
                  </span>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1">
                      <Phone className="h-4 w-4" /> Call
                    </Button>
                    {delivery.status === 'next' && (
                      <Button variant="ocean" size="sm" className="gap-1">
                        <Navigation className="h-4 w-4" /> Navigate
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Completed Today */}
        <Card className="border-border/50 h-fit">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedDeliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/10"
                >
                  <span className="font-medium text-foreground">{delivery.customer}</span>
                  <span className="text-sm text-muted-foreground">{delivery.time}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-6 p-4 rounded-lg bg-muted/30 text-center">
              <p className="text-3xl font-bold text-success mb-1">85%</p>
              <p className="text-sm text-muted-foreground">On-time delivery rate</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

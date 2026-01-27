import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Truck,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Phone,
  Navigation,
  User,
} from 'lucide-react';

// Mock delivery data
const deliveries = [
  {
    id: '1',
    orderNumber: 'ORD-2024-001',
    customer: 'ABC Corporation',
    address: '123 Business Ave, Suite 100',
    phone: '(555) 123-4567',
    driver: 'Mike Driver',
    status: 'en_route',
    eta: '10:30 AM',
    items: 5,
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-002',
    customer: 'XYZ Industries',
    address: '456 Industrial Park',
    phone: '(555) 987-6543',
    driver: 'Sarah Wilson',
    status: 'assigned',
    eta: '11:15 AM',
    items: 3,
  },
  {
    id: '3',
    orderNumber: 'ORD-2024-003',
    customer: 'Downtown Office',
    address: '789 Main Street',
    phone: '(555) 456-7890',
    driver: 'Mike Driver',
    status: 'arrived',
    eta: '10:45 AM',
    items: 8,
  },
];

const drivers = [
  { id: 'd1', name: 'Mike Driver', deliveries: 6, completed: 3, status: 'active' },
  { id: 'd2', name: 'Sarah Wilson', deliveries: 4, completed: 2, status: 'active' },
  { id: 'd3', name: 'John Smith', deliveries: 5, completed: 5, status: 'completed' },
];

const statusConfig = {
  assigned: { label: 'Assigned', color: 'bg-secondary text-secondary-foreground', icon: Clock },
  en_route: { label: 'En Route', color: 'bg-info/10 text-info', icon: Truck },
  arrived: { label: 'Arrived', color: 'bg-warning/10 text-warning', icon: MapPin },
  completed: { label: 'Completed', color: 'bg-success/10 text-success', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-destructive/10 text-destructive', icon: AlertCircle },
};

export const DeliveriesPage: React.FC = () => {
  return (
    <DashboardLayout
      title="Deliveries"
      subtitle="Track and manage all deliveries in real-time"
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Delivery Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Active Deliveries</h2>
            <Badge variant="info">{deliveries.length} in progress</Badge>
          </div>

          {deliveries.map((delivery) => {
            const status = statusConfig[delivery.status as keyof typeof statusConfig];
            const StatusIcon = status.icon;
            
            return (
              <Card key={delivery.id} className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{delivery.customer}</h3>
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{delivery.orderNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">ETA {delivery.eta}</p>
                      <p className="text-sm text-muted-foreground">{delivery.items} items</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{delivery.address}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{delivery.driver}</span>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Navigation className="h-4 w-4" />
                      </Button>
                      <Button variant="success" size="sm">
                        Mark Complete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Driver Status */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Driver Status</h2>
          
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Today's Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">15</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">10</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-info">5</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {drivers.map((driver) => (
            <Card key={driver.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-ocean flex items-center justify-center text-white font-semibold">
                    {driver.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{driver.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {driver.status === 'completed' ? 'Route completed' : 'On route'}
                    </p>
                  </div>
                  <Badge variant={driver.status === 'completed' ? 'success' : 'info'}>
                    {driver.status === 'completed' ? 'Done' : 'Active'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{driver.completed}/{driver.deliveries}</span>
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-ocean rounded-full transition-all"
                    style={{ width: `${(driver.completed / driver.deliveries) * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

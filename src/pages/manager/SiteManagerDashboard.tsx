import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Clock,
  Plus,
  Warehouse,
  AlertTriangle,
} from 'lucide-react';

// Mock data
const pendingOrders = [
  { id: '1', customer: 'ABC Corp', items: 5, time: '10:30 AM', priority: true },
  { id: '2', customer: 'XYZ Ltd', items: 3, time: '11:00 AM', priority: false },
  { id: '3', customer: 'Downtown Office', items: 8, time: '11:30 AM', priority: true },
];

const lowStockItems = [
  { name: '5-Gallon Bottles', current: 45, threshold: 50 },
  { name: '3-Gallon Bottles', current: 28, threshold: 30 },
];

export const SiteManagerDashboard: React.FC = () => {
  return (
    <DashboardLayout
      title="Site Dashboard"
      subtitle="Welcome back, Sarah Manager"
    >
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Pending Orders"
          value="12"
          icon={Clock}
          iconColor="warning"
        />
        <StatCard
          title="Today's Orders"
          value="28"
          change={{ value: 8, type: 'increase' }}
          icon={Package}
          iconColor="primary"
        />
        <StatCard
          title="Stock Level"
          value="89%"
          icon={Warehouse}
          iconColor="success"
        />
        <StatCard
          title="Low Stock Alerts"
          value="2"
          icon={AlertTriangle}
          iconColor="destructive"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Orders */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Pending Orders</CardTitle>
            <Button variant="ocean" size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> New Order
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{order.customer}</p>
                        {order.priority && (
                          <Badge variant="destructive" className="text-[10px]">Priority</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{order.items} items</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{order.time}</p>
                    <p className="text-xs text-muted-foreground">Scheduled</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockItems.map((item) => (
                <div key={item.name} className="p-4 rounded-lg bg-destructive/5 border border-destructive/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">{item.name}</span>
                    <Badge variant="destructive">Low Stock</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Current: <span className="font-medium text-destructive">{item.current}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Threshold: {item.threshold}
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-destructive rounded-full"
                      style={{ width: `${(item.current / item.threshold) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              
              <Button variant="outline" className="w-full">
                View All Inventory
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

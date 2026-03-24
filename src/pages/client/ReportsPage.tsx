/**
 * Reports Page
 * Role: Client Admin / Site Manager
 * Route: /client/reports
 * Business reports and analytics
 */

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ManagerLayout }   from '@/components/layout/ManagerLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  DollarSign,
  Package,
  Truck,
  Users,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const salesData = [
  { month: 'Jan', sales: 4200, orders: 145 },
  { month: 'Feb', sales: 3800, orders: 132 },
  { month: 'Mar', sales: 5100, orders: 167 },
  { month: 'Apr', sales: 4600, orders: 154 },
  { month: 'May', sales: 5800, orders: 189 },
  { month: 'Jun', sales: 6200, orders: 201 },
];

const deliveryData = [
  { day: 'Mon', completed: 45, failed: 3 },
  { day: 'Tue', completed: 52, failed: 2 },
  { day: 'Wed', completed: 48, failed: 4 },
  { day: 'Thu', completed: 55, failed: 1 },
  { day: 'Fri', completed: 61, failed: 2 },
  { day: 'Sat', completed: 38, failed: 1 },
  { day: 'Sun', completed: 22, failed: 0 },
];

const paymentMethodData = [
  { name: 'Cash', value: 35, color: 'hsl(var(--primary))' },
  { name: 'Credit Card', value: 28, color: 'hsl(var(--accent))' },
  { name: 'Wallet', value: 22, color: 'hsl(var(--success))' },
  { name: 'Credit Account', value: 15, color: 'hsl(var(--warning))' },
];

interface ReportsPageProps {
  layout?:   'dashboard' | 'manager';
  readOnly?: boolean;
}

const ReportsPage: React.FC<ReportsPageProps> = ({
  layout   = 'dashboard',
  readOnly = false,
}) => {
  const [dateRange, setDateRange] = useState('month');

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    layout === 'manager'
      ? <ManagerLayout title="Reports" subtitle="Business analytics and insights">{children}</ManagerLayout>
      : <DashboardLayout title="Reports" subtitle="Business analytics and insights">{children}</DashboardLayout>;

  return (
    <Wrapper>
      {/* Date Range & Export */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!readOnly && (
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">$29,700</p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-xs text-success">+12.5% vs last period</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Package className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">988</p>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-xs text-success">+8.2% vs last period</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Truck className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">96.2%</p>
              <p className="text-sm text-muted-foreground">Delivery Rate</p>
              <p className="text-xs text-success">+2.1% vs last period</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Users className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">142</p>
              <p className="text-sm text-muted-foreground">Active Customers</p>
              <p className="text-xs text-success">+5 new this month</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sales">
            <BarChart3 className="h-4 w-4 mr-2" />
            Sales
          </TabsTrigger>
          <TabsTrigger value="deliveries">
            <Truck className="h-4 w-4 mr-2" />
            Deliveries
          </TabsTrigger>
          <TabsTrigger value="financial">
            <DollarSign className="h-4 w-4 mr-2" />
            Financial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Monthly Sales Trend
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Orders by Month
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                      }}
                    />
                    <Bar dataKey="orders" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="deliveries" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Weekly Delivery Performance</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deliveryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Bar dataKey="completed" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Payment Methods</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-4 justify-center mt-4">
                {paymentMethodData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4">Financial Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                  <span>Total Revenue</span>
                  <span className="font-bold">$29,700</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                  <span>Collected Payments</span>
                  <span className="font-bold text-success">$24,850</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                  <span>Outstanding</span>
                  <span className="font-bold text-warning">$4,850</span>
                </div>
                <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                  <span>Overdue Payments</span>
                  <span className="font-bold text-destructive">$890</span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </Wrapper>
  );
};

export default ReportsPage;
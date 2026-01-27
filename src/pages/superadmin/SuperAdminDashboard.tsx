import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  Plus,
  ArrowUpRight,
} from 'lucide-react';

// Mock data for clients
const recentClients = [
  { id: '1', name: 'Fresh Waters Inc.', plan: 'Enterprise', status: 'active', revenue: '$12,450' },
  { id: '2', name: 'Pure Springs Co.', plan: 'Professional', status: 'active', revenue: '$8,200' },
  { id: '3', name: 'Crystal Clear Ltd.', plan: 'Starter', status: 'trial', revenue: '$0' },
  { id: '4', name: 'Aqua Solutions', plan: 'Professional', status: 'active', revenue: '$6,800' },
];

const systemMetrics = [
  { label: 'API Response Time', value: '45ms', status: 'healthy' },
  { label: 'Database Load', value: '23%', status: 'healthy' },
  { label: 'Active Sessions', value: '1,234', status: 'healthy' },
  { label: 'Error Rate', value: '0.02%', status: 'healthy' },
];

export const SuperAdminDashboard: React.FC = () => {
  return (
    <DashboardLayout
      title="System Dashboard"
      subtitle="Welcome back, System Admin"
    >
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Clients"
          value="156"
          change={{ value: 12, type: 'increase' }}
          icon={Building2}
          iconColor="primary"
        />
        <StatCard
          title="Active Users"
          value="2,847"
          change={{ value: 8, type: 'increase' }}
          icon={Users}
          iconColor="accent"
        />
        <StatCard
          title="Monthly Revenue"
          value="$84,230"
          change={{ value: 15, type: 'increase' }}
          icon={DollarSign}
          iconColor="success"
        />
        <StatCard
          title="Growth Rate"
          value="+23%"
          change={{ value: 5, type: 'increase' }}
          icon={TrendingUp}
          iconColor="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Clients */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Recent Clients</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1">
              View All <ArrowUpRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-gradient-ocean flex items-center justify-center text-white font-semibold">
                      {client.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{client.name}</p>
                      <p className="text-sm text-muted-foreground">{client.plan}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={client.status === 'active' ? 'success' : 'warning'}>
                      {client.status}
                    </Badge>
                    <span className="font-medium text-foreground">{client.revenue}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">System Health</CardTitle>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-success font-medium">All Systems Operational</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {systemMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{metric.label}</span>
                  </div>
                  <span className="font-medium text-foreground">{metric.value}</span>
                </div>
              ))}
            </div>
            
            <Button variant="outline" className="w-full mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Add New Client
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

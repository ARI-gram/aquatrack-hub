/**
 * Super Admin Dashboard
 * Route: /admin/dashboard
 * Loads real client and billing stats from the API.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateClientDialog } from '@/components/dialogs/Createclientdialog';
import { clientsService } from '@/api/services/clients.service';
import billingService from '@/api/services/billing.service';
import {
  Building2, Users, DollarSign, TrendingUp,
  Activity, ArrowUpRight, AlertTriangle,
} from 'lucide-react';
import type { BillingStats } from '@/types/billing.types';

// ─── System metrics (static until a system-health endpoint exists) ────────────

const SYSTEM_METRICS = [
  { label: 'API Response Time', value: '45ms' },
  { label: 'Database Load',     value: '23%' },
  { label: 'Active Sessions',   value: '—' },
  { label: 'Error Rate',        value: '0.02%' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const SuperAdminDashboard: React.FC = () => {
  // ── Real client list (first page, no filter) ───────────────────────────────
  const {
    data: clientsData,
    isLoading: clientsLoading,
  } = useQuery({
    queryKey: ['clients', { page: 1, limit: 5 }],
    queryFn: () => clientsService.getClients({ page: 1, limit: 5 }),
  });

  // ── Real billing stats ─────────────────────────────────────────────────────
  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery<BillingStats>({
    queryKey: ['billing-stats'],
    queryFn: () => billingService.getStats(),
  });

  const recentClients = clientsData?.data ?? [];
  const totalClients  = clientsData?.total ?? 0;

  const PLAN_LABELS: Record<string, string> = {
    trial: 'Free Trial',
    basic: 'Starter',
    pro: 'Professional',
    enterprise: 'Enterprise',
  };

  return (
    <DashboardLayout
      title="System Dashboard"
      subtitle="Welcome back, System Admin"
    >
      {/* ── Stats grid ────────────────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Total Clients"
          value={clientsLoading ? '—' : totalClients.toString()}
          icon={Building2}
          iconColor="primary"
        />
        <StatCard
          title="Active Subscriptions"
          value={statsLoading ? '—' : (stats?.activeSubscriptions ?? 0).toString()}
          icon={Users}
          iconColor="accent"
        />
        <StatCard
          title="Monthly Revenue"
          value={
            statsLoading
              ? '—'
              : `KSh ${(stats?.monthlyRevenue ?? 0).toLocaleString()}`
          }
          icon={DollarSign}
          iconColor="success"
        />
        <StatCard
          title="Trial Conversion"
          value={
            statsLoading
              ? '—'
              : `${stats?.trialConversionRate ?? 0}%`
          }
          icon={TrendingUp}
          iconColor="warning"
        />
      </div>

      {/* ── Overdue alert ─────────────────────────────────────────────────── */}
      {!statsLoading && (stats?.overdueSubscriptions ?? 0) > 0 && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/5 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            {stats!.overdueSubscriptions} client{stats!.overdueSubscriptions > 1 ? 's have' : ' has'} an
            overdue subscription. Go to{' '}
            <a href="/admin/billing" className="underline underline-offset-2">Billing</a>{' '}
            to review.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Recent clients ───────────────────────────────────────────────── */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Recent Clients</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1" asChild>
              <a href="/admin/clients">
                View All <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
          </CardHeader>
          <CardContent>
            {clientsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : recentClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No clients yet. Add your first distributor to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {recentClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-gradient-ocean flex items-center justify-center text-white font-semibold shrink-0">
                        {client.name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{client.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {PLAN_LABELS[client.subscriptionPlan] ?? client.subscriptionPlan}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        client.subscriptionStatus === 'active' ? 'success' :
                        client.subscriptionStatus === 'trial'  ? 'warning' :
                        'secondary'
                      }
                    >
                      {client.subscriptionStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── System health ────────────────────────────────────────────────── */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">System Health</CardTitle>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-success font-medium">Operational</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Live trial / overdue counts from API */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Active Trials</span>
                </div>
                <span className="font-medium">
                  {statsLoading ? '—' : (stats?.trialSubscriptions ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Overdue Accounts</span>
                </div>
                <span className={`font-medium ${(stats?.overdueSubscriptions ?? 0) > 0 ? 'text-destructive' : ''}`}>
                  {statsLoading ? '—' : (stats?.overdueSubscriptions ?? 0)}
                </span>
              </div>

              {/* Static system metrics */}
              {SYSTEM_METRICS.map((metric) => (
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

            <div className="mt-4">
              <CreateClientDialog />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};
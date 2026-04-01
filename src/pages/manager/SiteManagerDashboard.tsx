/**
 * src/pages/manager/SiteManagerDashboard.tsx
 * Site Manager Dashboard - Restyled with improved visual hierarchy
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ManagerLayout } from '@/components/layout/ManagerLayout';
import { ROUTES } from '@/constants/routes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList,
  Truck,
  UserCog,
  Users,
  PackageSearch,
  ShoppingBag,
  BarChart3,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Calendar,
  MapPin,
  Phone,
  Mail,
  ChevronRight,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  sub,
  icon: Icon,
  iconColor = 'text-primary',
  iconBg = 'bg-primary/10',
  badge,
  badgeVariant = 'secondary',
  trend,
}) => (
  <Card className="overflow-hidden border-border/50 transition-all duration-200 hover:shadow-md hover:border-border">
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
            {trend && (
              <span className={cn(
                'text-xs font-medium flex items-center gap-0.5',
                trend.direction === 'up' ? 'text-emerald-600' : 'text-destructive'
              )}>
                {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
        </div>
        <div className={cn('shrink-0 h-11 w-11 rounded-xl flex items-center justify-center', iconBg, iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {badge && (
        <div className="mt-4 pt-2 border-t border-border/40">
          <Badge variant={badgeVariant} className="text-xs font-medium">{badge}</Badge>
        </div>
      )}
    </CardContent>
  </Card>
);

// ── Quick action ──────────────────────────────────────────────────────────────

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  primary?: boolean;
  badge?: string;
}

const QuickAction: React.FC<QuickActionProps> = ({
  title,
  description,
  icon: Icon,
  onClick,
  primary = false,
  badge,
}) => (
  <button
    onClick={onClick}
    className={`
      w-full text-left rounded-xl border p-4 transition-all duration-200
      hover:shadow-lg active:scale-[0.98] group
      ${primary
        ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground border-primary/30 hover:border-primary/50'
        : 'bg-card border-border/60 hover:border-primary/30 hover:shadow-md'
      }
    `}
  >
    <div className="flex items-start gap-3">
      <div className={cn(
        'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200',
        primary
          ? 'bg-white/20 group-hover:bg-white/30'
          : 'bg-primary/10 group-hover:bg-primary/15'
      )}>
        <Icon className={cn(
          'h-5 w-5 transition-all duration-200',
          primary ? 'text-white' : 'text-primary'
        )} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn(
            'text-sm font-semibold leading-tight',
            primary ? 'text-white' : 'text-foreground'
          )}>
            {title}
          </p>
          {badge && (
            <Badge variant="secondary" className="text-[10px] py-0 h-4 bg-white/20 text-white border-0">
              {badge}
            </Badge>
          )}
        </div>
        <p className={cn(
          'text-xs mt-1 leading-relaxed',
          primary ? 'text-white/80' : 'text-muted-foreground'
        )}>
          {description}
        </p>
      </div>
      <ChevronRight className={cn(
        'h-4 w-4 shrink-0 transition-all duration-200 group-hover:translate-x-0.5',
        primary ? 'text-white/70' : 'text-muted-foreground'
      )} />
    </div>
  </button>
);

// ── Empty state component ─────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
    <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
      <Icon className="h-6 w-6 text-muted-foreground/60" />
    </div>
    <div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
    </div>
    {action && (
      <Button
        variant="outline"
        size="sm"
        onClick={action.onClick}
        className="mt-2 text-xs h-8"
      >
        {action.label}
      </Button>
    )}
  </div>
);

// ── Driver status card ───────────────────────────────────────────────────────

interface DriverStatusProps {
  name: string;
  status: 'available' | 'on-route' | 'off-duty';
  vehicle?: string;
  onView?: () => void;
}

const DriverStatusCard: React.FC<DriverStatusProps> = ({
  name,
  status,
  vehicle,
  onView,
}) => {
  const statusConfig = {
    available: { icon: UserCog, color: 'text-emerald-600', bg: 'bg-emerald-500/10', label: 'Available' },
    'on-route': { icon: Truck, color: 'text-blue-600', bg: 'bg-blue-500/10', label: 'On Route' },
    'off-duty': { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/30', label: 'Off Duty' },
  };
  
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/40 hover:border-primary/30 transition-all cursor-pointer group" onClick={onView}>
      <div className="flex items-center gap-3">
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', config.bg)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{name}</p>
          {vehicle && <p className="text-xs text-muted-foreground">{vehicle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={cn('text-[10px] py-0 h-5', config.color)}>
          {config.label}
        </Badge>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const SiteManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Mock data - replace with real data from your API
  const stats = {
    pendingOrders: 3,
    activeDeliveries: 2,
    completedToday: 5,
    issues: 1,
  };

  const recentOrders = [
    // Replace with real data
  ];

  const drivers = [
    // Replace with real driver data
  ];

  return (
    <ManagerLayout title="Dashboard" subtitle="Site Manager Overview">
      <div className="space-y-6 pb-8">

        {/* Greeting Section */}
        <div className="bg-gradient-to-br from-primary/5 via-transparent to-transparent rounded-2xl p-6 -mt-2">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {greeting()}, {user?.firstName ?? 'Manager'} 👋
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Here's what's happening at your site today.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            title="Pending Orders"
            value={stats.pendingOrders}
            sub="Awaiting dispatch"
            icon={ClipboardList}
            iconColor="text-amber-600"
            iconBg="bg-amber-500/10"
            badge="Needs attention"
            badgeVariant="default"
            trend={{ value: 12, direction: 'up' }}
          />
          <StatCard
            title="Active Deliveries"
            value={stats.activeDeliveries}
            sub="Drivers on the road"
            icon={Truck}
            iconColor="text-blue-600"
            iconBg="bg-blue-500/10"
          />
          <StatCard
            title="Completed Today"
            value={stats.completedToday}
            sub="Delivered successfully"
            icon={CheckCircle2}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-500/10"
            trend={{ value: 8, direction: 'up' }}
          />
          <StatCard
            title="Issues"
            value={stats.issues}
            sub="Require attention"
            icon={AlertCircle}
            iconColor="text-destructive"
            iconBg="bg-destructive/10"
            badgeVariant="destructive"
          />
        </div>

        {/* Quick Actions Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Actions
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Common tasks to keep operations running smoothly
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickAction
              title="View Orders"
              description="Process and dispatch incoming orders"
              icon={ClipboardList}
              onClick={() => navigate(ROUTES.SITE_MANAGER.ORDERS)}
              primary
              badge="3 pending"
            />
            <QuickAction
              title="Manage Deliveries"
              description="Track and assign active deliveries"
              icon={Truck}
              onClick={() => navigate(ROUTES.SITE_MANAGER.DELIVERIES)}
            />
            <QuickAction
              title="Check Stock"
              description="Depot inventory and bottle levels"
              icon={PackageSearch}
              onClick={() => navigate(ROUTES.SITE_MANAGER.STOCK)}
            />
            <QuickAction
              title="Direct Sales"
              description="Process walk-in customer sales"
              icon={ShoppingBag}
              onClick={() => navigate(ROUTES.SITE_MANAGER.DIRECT_SALES)}
            />
            <QuickAction
              title="Site Reports"
              description="Performance and activity summaries"
              icon={BarChart3}
              onClick={() => navigate(ROUTES.SITE_MANAGER.REPORTS)}
            />
            <QuickAction
              title="Manage Drivers"
              description="View and manage driver schedules"
              icon={Users}
              onClick={() => navigate(ROUTES.SITE_MANAGER.DRIVERS)}
            />
          </div>
        </div>

        {/* Two-column layout for recent orders and drivers */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Orders Card */}
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Recent Orders
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Orders placed in the last 24 hours
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 gap-1 text-primary hover:text-primary"
                  onClick={() => navigate(ROUTES.SITE_MANAGER.ORDERS)}
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentOrders.length > 0 ? (
                <div className="divide-y divide-border/40">
                  {/* Map your orders here */}
                </div>
              ) : (
                <EmptyState
                  icon={ClipboardList}
                  title="No orders yet today"
                  description="Orders placed at this site will appear here."
                  action={{
                    label: "View all orders",
                    onClick: () => navigate(ROUTES.SITE_MANAGER.ORDERS),
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* Driver Snapshot Card */}
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Driver Snapshot
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Current driver status and assignments
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 gap-1 text-primary hover:text-primary"
                  onClick={() => navigate(ROUTES.SITE_MANAGER.DRIVERS)}
                >
                  Manage <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {/* Status Summary */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Available', count: 2, icon: UserCog, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
                  { label: 'On Route', count: 1, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-500/10' },
                  { label: 'Off Duty', count: 1, icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/30' },
                ].map(({ label, count, icon: Icon, color, bg }) => (
                  <div key={label} className={cn('rounded-xl py-3 flex flex-col items-center gap-1.5 border border-border/40', bg)}>
                    <Icon className={cn('h-4 w-4', color)} />
                    <p className="text-lg font-bold text-foreground">{count}</p>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>

              {/* Driver List */}
              <div className="space-y-2">
                {drivers.length > 0 ? (
                  drivers.map((driver, idx) => (
                    <DriverStatusCard
                      key={idx}
                      name={driver.name}
                      status={driver.status}
                      vehicle={driver.vehicle}
                      onView={() => navigate(`${ROUTES.SITE_MANAGER.DRIVERS}/${driver.id}`)}
                    />
                  ))
                ) : (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    No drivers assigned to this site yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed - Optional section */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-muted-foreground">No recent activity to display</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </ManagerLayout>
  );
};
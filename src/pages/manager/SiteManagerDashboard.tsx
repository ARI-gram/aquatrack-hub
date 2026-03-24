/**
 * src/pages/manager/SiteManagerDashboard.tsx
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
} from 'lucide-react';

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  title:        string;
  value:        string | number;
  sub?:         string;
  icon:         React.ElementType;
  iconColor?:   string;
  badge?:       string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const StatCard: React.FC<StatCardProps> = ({
  title, value, sub, icon: Icon, iconColor = 'text-primary', badge, badgeVariant = 'secondary',
}) => (
  <Card>
    <CardContent className="pt-5 pb-4 px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {title}
          </p>
          <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`shrink-0 h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {badge && (
        <div className="mt-3">
          <Badge variant={badgeVariant} className="text-xs">{badge}</Badge>
        </div>
      )}
    </CardContent>
  </Card>
);

// ── Quick action ──────────────────────────────────────────────────────────────

interface QuickActionProps {
  title:       string;
  description: string;
  icon:        React.ElementType;
  onClick:     () => void;
  primary?:    boolean;
}

const QuickAction: React.FC<QuickActionProps> = ({
  title, description, icon: Icon, onClick, primary = false,
}) => (
  <button
    onClick={onClick}
    className={`
      w-full text-left rounded-xl border p-4 transition-all duration-200
      hover:shadow-sm active:scale-[0.98]
      ${primary
        ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
        : 'bg-card border-border hover:bg-muted/40'
      }
    `}
  >
    <div className="flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
        primary ? 'bg-primary-foreground/20' : 'bg-primary/10'
      }`}>
        <Icon className={`h-5 w-5 ${primary ? 'text-primary-foreground' : 'text-primary'}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold leading-tight ${primary ? 'text-primary-foreground' : 'text-foreground'}`}>
          {title}
        </p>
        <p className={`text-xs mt-0.5 leading-tight ${primary ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {description}
        </p>
      </div>
      <ArrowRight className={`h-4 w-4 shrink-0 ${primary ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} />
    </div>
  </button>
);

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const SiteManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ManagerLayout title="Dashboard" subtitle="Site Manager Overview">
      <div className="space-y-6">

        {/* Greeting */}
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {greeting()}, {user?.firstName ?? 'Manager'} 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here's what's happening at your site today.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            title="Pending Orders"
            value="—"
            sub="Awaiting dispatch"
            icon={ClipboardList}
            badge="Live"
            badgeVariant="default"
          />
          <StatCard
            title="Active Deliveries"
            value="—"
            sub="Drivers on the road"
            icon={Truck}
            iconColor="text-blue-500"
          />
          <StatCard
            title="Completed"
            value="—"
            sub="Delivered today"
            icon={CheckCircle2}
            iconColor="text-green-500"
          />
          <StatCard
            title="Issues"
            value="—"
            sub="Require attention"
            icon={AlertCircle}
            iconColor="text-destructive"
            badgeVariant="destructive"
          />
        </div>

        {/* Quick actions */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickAction
              title="View Orders"
              description="Process and dispatch incoming orders"
              icon={ClipboardList}
              onClick={() => navigate(ROUTES.SITE_MANAGER.ORDERS)}
              primary
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
          </div>
        </div>

        {/* Recent orders */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Orders</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2 text-primary"
                onClick={() => navigate(ROUTES.SITE_MANAGER.ORDERS)}
              >
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No orders yet today</p>
              <p className="text-xs text-muted-foreground">
                Orders placed at this site will appear here.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Driver snapshot */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Driver Snapshot</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2 text-primary"
                onClick={() => navigate(ROUTES.SITE_MANAGER.DRIVERS)}
              >
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Available', icon: UserCog, color: 'text-green-500' },
                { label: 'On Route',  icon: Truck,   color: 'text-blue-500'  },
                { label: 'Off Duty',  icon: Clock,   color: 'text-muted-foreground' },
              ].map(({ label, icon: Icon, color }) => (
                <div key={label} className="rounded-xl bg-muted/40 py-4 flex flex-col items-center gap-1.5">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <p className="text-xl font-bold text-foreground">—</p>
                  <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </ManagerLayout>
  );
};
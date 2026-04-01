/**
 * src/pages/client/ClientAdminDashboard.tsx
 * Client Admin Dashboard - Using real data from working endpoints
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Truck,
  DollarSign,
  Users,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import axiosInstance from '@/api/axios.config';
import { bottleStoreService } from '@/api/services/store.service';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  activeDeliveries: number;
  completedToday: number;
  totalRevenue: number;
  todayRevenue: number;
  activeCustomers: number;
  totalCustomers: number;
  lowStockItems: number;
  outOfStockItems: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  customer_name?: string;
  total_amount: string;
  status: string;
  payment_status: string;
  created_at: string;
}

interface DeliveryStatus {
  assigned: number;
  en_route: number;
  completed: number;
  failed: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Config
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  PENDING:    { label: 'Pending',    color: 'text-amber-600' },
  CONFIRMED:  { label: 'Confirmed',  color: 'text-blue-600'   },
  ASSIGNED:   { label: 'Assigned',   color: 'text-indigo-600' },
  IN_TRANSIT: { label: 'In Transit', color: 'text-violet-600' },
  DELIVERED:  { label: 'Delivered',  color: 'text-emerald-600' },
  COMPLETED:  { label: 'Completed',  color: 'text-emerald-600' },
  CANCELLED:  { label: 'Cancelled',  color: 'text-red-600'    },
};

const PAYMENT_CFG: Record<string, { label: string; color: string }> = {
  PENDING:  { label: 'Unpaid',  color: 'text-amber-600' },
  PAID:     { label: 'Paid',    color: 'text-emerald-600' },
  FAILED:   { label: 'Failed',  color: 'text-red-600' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card Component
// ─────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
  trend?: { value: number; direction: 'up' | 'down' };
}

const StatCard: React.FC<StatCardProps> = ({
  title, value, sub, icon: Icon, color = 'text-primary', trend,
}) => (
  <Card className="border-border/50 overflow-hidden transition-all duration-200 hover:shadow-md">
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
                'text-xs font-medium',
                trend.direction === 'up' ? 'text-emerald-600' : 'text-red-600'
              )}>
                {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
        </div>
        <div className={cn('shrink-0 h-11 w-11 rounded-xl flex items-center justify-center bg-primary/10', color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ─────────────────────────────────────────────────────────────────────────────
// Recent Order Row Component
// ─────────────────────────────────────────────────────────────────────────────

const RecentOrderRow: React.FC<{ order: RecentOrder; onView: () => void }> = ({
  order, onView,
}) => {
  const statusCfg = STATUS_CFG[order.status] || { label: order.status, color: 'text-muted-foreground' };
  const paymentCfg = PAYMENT_CFG[order.payment_status] || { label: order.payment_status, color: 'text-muted-foreground' };
  const amount = parseFloat(order.total_amount).toLocaleString();

  return (
    <div
      className="flex items-center justify-between p-4 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
      onClick={onView}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-mono font-semibold text-sm">{order.order_number}</p>
          <Badge variant="outline" className={cn('text-[10px] py-0 h-4', statusCfg.color)}>
            {statusCfg.label}
          </Badge>
          <Badge variant="outline" className={cn('text-[10px] py-0 h-4', paymentCfg.color)}>
            {paymentCfg.label}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{order.customer_name || '—'}</span>
          <span>•</span>
          <span>{format(new Date(order.created_at), 'dd MMM yyyy')}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-bold text-sm">KES {amount}</p>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard Component
// ─────────────────────────────────────────────────────────────────────────────

export const ClientAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    activeDeliveries: 0,
    completedToday: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    activeCustomers: 0,
    totalCustomers: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>({
    assigned: 0,
    en_route: 0,
    completed: 0,
    failed: 0,
  });
  const [weekRevenue, setWeekRevenue] = useState<{ day: string; amount: number }[]>([]);

  // ── Load Dashboard Data ──────────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch orders
      const ordersRes = await axiosInstance.get('/orders/all/', { params: { limit: 100 } });
      const orders = (ordersRes.data?.results || ordersRes.data || []) as RecentOrder[];

      // Fetch customers
      const customersRes = await axiosInstance.get('/customers/', { params: { limit: 100 } });
      const customers = (customersRes.data?.data || customersRes.data || []) as Array<{ id: string; status: string; full_name: string }>;

      // Fetch bottle stock
      const bottles = await bottleStoreService.getAll();

      // Process stats
      const today = new Date().toISOString().split('T')[0];
      const todayOrders = orders.filter(o => o.created_at?.startsWith(today));
      const completedOrders = orders.filter(o => o.status === 'COMPLETED' || o.status === 'DELIVERED');
      const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED');
      const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
      const todayRevenue = todayOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
      const activeCustomers = customers.filter(c => c.status === 'ACTIVE').length;
      const lowStock = bottles.filter(p => p.balance.full > 0 && p.balance.full <= 5).length;
      const outOfStock = bottles.filter(p => p.balance.full <= 0).length;

      setStats({
        totalOrders: orders.length,
        pendingOrders: pendingOrders.length,
        activeDeliveries: orders.filter(o => o.status === 'IN_TRANSIT').length,
        completedToday: completedOrders.filter(o => o.created_at?.startsWith(today)).length,
        totalRevenue,
        todayRevenue,
        activeCustomers,
        totalCustomers: customers.length,
        lowStockItems: lowStock,
        outOfStockItems: outOfStock,
      });

      setRecentOrders(orders.slice(0, 5));

      setDeliveryStatus({
        assigned: orders.filter(o => o.status === 'ASSIGNED').length,
        en_route: orders.filter(o => o.status === 'IN_TRANSIT').length,
        completed: completedOrders.length,
        failed: orders.filter(o => o.status === 'FAILED').length,
      });

      // Calculate weekly revenue
      const weeklyData = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = date.toISOString().split('T')[0];
        const dayOrders = orders.filter(o => o.created_at?.startsWith(dateStr));
        const dayRevenue = dayOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
        weeklyData.push({
          day: format(date, 'EEE'),
          amount: dayRevenue,
        });
      }
      setWeekRevenue(weeklyData);

    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data. Please refresh.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // ── Loading State ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <DashboardLayout title="Dashboard" subtitle="Welcome back">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout title="Dashboard" subtitle="Welcome back, Admin">
      <div className="space-y-6 pb-8">

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            title="Total Orders"
            value={stats.totalOrders}
            sub={`${stats.pendingOrders} pending`}
            icon={Package}
          />
          <StatCard
            title="Active Deliveries"
            value={stats.activeDeliveries}
            sub="Drivers on the road"
            icon={Truck}
            color="text-blue-500"
          />
          <StatCard
            title="Today's Revenue"
            value={`KES ${stats.todayRevenue.toLocaleString()}`}
            sub={`${stats.completedToday} deliveries`}
            icon={DollarSign}
            color="text-emerald-500"
          />
          <StatCard
            title="Active Customers"
            value={stats.activeCustomers}
            sub={`${stats.totalCustomers} total`}
            icon={Users}
            color="text-amber-500"
          />
        </div>

        {/* Stock Alert */}
        {(stats.lowStockItems > 0 || stats.outOfStockItems > 0) && (
          <div className={cn(
            'flex items-start gap-3 p-4 rounded-xl border',
            stats.outOfStockItems > 0
              ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
              : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
          )}>
            <AlertCircle className={cn(
              'h-5 w-5 shrink-0 mt-0.5',
              stats.outOfStockItems > 0 ? 'text-red-600' : 'text-amber-600'
            )} />
            <div>
              <p className={cn(
                'text-sm font-bold',
                stats.outOfStockItems > 0
                  ? 'text-red-800 dark:text-red-300'
                  : 'text-amber-800 dark:text-amber-300'
              )}>
                Stock Alert
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats.outOfStockItems > 0 && `${stats.outOfStockItems} product(s) out of stock. `}
                {stats.lowStockItems > 0 && `${stats.lowStockItems} product(s) running low. `}
                <button
                  onClick={() => navigate('/client/store')}
                  className="underline font-medium hover:no-underline"
                >
                  Check inventory
                </button>
              </p>
            </div>
          </div>
        )}

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Recent Orders Card */}
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Recent Orders
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Latest customer orders
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 gap-1 text-primary"
                  onClick={() => navigate('/client/orders')}
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">No orders yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Orders will appear here once customers start placing them.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {recentOrders.map(order => (
                    <RecentOrderRow
                      key={order.id}
                      order={order}
                      onView={() => navigate(`/client/orders`)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Status Card */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    Delivery Status
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Current delivery progress
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 gap-1 text-primary"
                  onClick={() => navigate('/client/deliveries')}
                >
                  Manage <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: 'Assigned', count: deliveryStatus.assigned, icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
                  { label: 'En Route', count: deliveryStatus.en_route, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-500/10' },
                  { label: 'Completed', count: deliveryStatus.completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
                  { label: 'Failed', count: deliveryStatus.failed, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-500/10' },
                ].map(({ label, count, icon: Icon, color, bg }) => (
                  <div key={label} className={cn('rounded-xl py-3 flex flex-col items-center gap-1.5 border border-border/40', bg)}>
                    <Icon className={cn('h-4 w-4', color)} />
                    <p className="text-lg font-bold text-foreground">{count}</p>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="pt-3 border-t border-border/40">
                <p className="text-xs font-semibold text-muted-foreground mb-3">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 text-xs"
                    onClick={() => navigate('/client/deliveries')}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Make Delivery
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 text-xs"
                    onClick={() => navigate('/client/store')}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Check Stock
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Revenue Trend */}
        {weekRevenue.length > 0 && weekRevenue.some(d => d.amount > 0) && (
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Weekly Revenue Trend</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-32">
                {weekRevenue.map((day) => {
                  const maxAmount = Math.max(...weekRevenue.map(d => d.amount), 1);
                  const height = (day.amount / maxAmount) * 100;
                  return (
                    <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                      <div className="relative w-full flex justify-center">
                        <div
                          className="w-full max-w-12 bg-primary/50 rounded-t-md transition-all duration-300"
                          style={{ height: `${Math.max(4, height)}%`, minHeight: '4px' }}
                        />
                      </div>
                      <p className="text-[10px] font-medium text-muted-foreground">{day.day}</p>
                      <p className="text-[9px] font-semibold text-foreground">
                        {day.amount > 0 ? `KES ${(day.amount / 1000).toFixed(0)}k` : '0'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={loadDashboard}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Refresh Dashboard
          </Button>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default ClientAdminDashboard;
/**
 * Reports Page — Client Admin / Site Manager
 * src/pages/client/ReportsPage.tsx
 *
 * Five tabs, all real data:
 *   Operations   — delivery stats, status breakdown, live driver activity  [DEFAULT]
 *   Sales        — revenue trend, top products, daily breakdown
 *   Staff        — per-driver performance, completed vs assigned
 *   Customers    — totals, credit vs non-credit, top by orders, status breakdown
 *   Financial    — collections, outstanding, overdue, payment method mix
 */

import React, { useState, useEffect, useCallback } from 'react';
import { format, subDays, startOfMonth, startOfYear } from 'date-fns';
import { toast } from 'sonner';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ManagerLayout }   from '@/components/layout/ManagerLayout';
import { Card }            from '@/components/ui/card';
import { Badge }           from '@/components/ui/badge';
import { Button }          from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie,
  Cell, Legend,
} from 'recharts';

import {
  Truck, TrendingUp, Users, DollarSign, Package,
  BarChart3, Calendar, Download, Loader2, RefreshCw,
  CheckCircle2, XCircle, Clock, AlertCircle,
  BadgeCheck, ShieldAlert, CreditCard, UserCog,
  Activity, Star,
} from 'lucide-react';

import { reportsService }         from '@/api/services/reports.service';
import { deliveryService }        from '@/api/services/delivery.service';
import { ordersService }          from '@/api/services/orders.service';
import { customerAdminService }   from '@/api/services/customerAdmin.service';
import { accountingService }      from '@/api/services/accounting.service';
import { cn }                     from '@/lib/utils';

import type { RevenueSummary, OutstandingSummary } from '@/types/reports.types';
import type { DeliveryStats, Driver, ClientDelivery } from '@/api/services/delivery.service';
import type { AdminCustomer, PaginatedCustomers }    from '@/api/services/customerAdmin.service';
import type { PaymentReport }                        from '@/types/accounting.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtMoneyShort = (n: number) => {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `KES ${(n / 1_000).toFixed(1)}K`;
  return `KES ${n.toFixed(0)}`;
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return '–';
  try { return format(new Date(iso), 'd MMM yyyy'); } catch { return iso; }
};

const periodToDates = (period: string) => {
  const today = new Date();
  const fmt   = (d: Date) => format(d, 'yyyy-MM-dd');
  switch (period) {
    case '7d':  return { from: fmt(subDays(today, 7)),      to: fmt(today) };
    case '30d': return { from: fmt(subDays(today, 30)),     to: fmt(today) };
    case '90d': return { from: fmt(subDays(today, 90)),     to: fmt(today) };
    case 'mtd': return { from: fmt(startOfMonth(today)),    to: fmt(today) };
    case 'ytd': return { from: fmt(startOfYear(today)),     to: fmt(today) };
    default:    return { from: fmt(subDays(today, 30)),     to: fmt(today) };
  }
};

// ── Shared components ─────────────────────────────────────────────────────────

const Spinner: React.FC<{ height?: string }> = ({ height = 'h-64' }) => (
  <Card className="p-6">
    <div className={cn('flex items-center justify-center', height)}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
    </div>
  </Card>
);

const TT = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '12px',
  },
};

const PIE_COLORS = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#0ea5e9','#ec4899'];

interface KpiCardProps {
  icon:      React.ReactNode;
  iconBg:    string;
  value:     string;
  label:     string;
  sub:       string;
  subColor?: string;
}
const KpiCard: React.FC<KpiCardProps> = ({ icon, iconBg, value, label, sub, subColor = 'text-muted-foreground' }) => (
  <Card className="p-4">
    <div className="flex items-start gap-3">
      <div className={cn('p-2 rounded-lg shrink-0 mt-0.5', iconBg)}>{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums leading-none mb-0.5">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn('text-xs font-medium mt-0.5', subColor)}>{sub}</p>
      </div>
    </div>
  </Card>
);

// ── OPERATIONS TAB ────────────────────────────────────────────────────────────

const OperationsTab: React.FC = () => {
  const [stats,      setStats]      = useState<DeliveryStats | null>(null);
  const [drivers,    setDrivers]    = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<ClientDelivery[]>([]);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d, del] = await Promise.all([
        deliveryService.getDeliveryStats(),
        deliveryService.getAvailableDrivers(),
        deliveryService.getClientDeliveries({ limit: 50 }),
      ]);
      setStats(s);
      setDrivers(d);
      setDeliveries(del.results ?? del.data ?? []);
    } catch {
      toast.error('Failed to load operations data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Spinner key={i} height="h-24" />)}
      </div>
      <Spinner height="h-56" />
    </div>
  );

  if (!stats) return null;

  const deliveryRate = stats.total_today > 0
    ? ((stats.completed_today / stats.total_today) * 100).toFixed(1)
    : '0.0';

  // Status breakdown pie
  const statusPie = Object.entries(stats.status_breakdown ?? {})
    .filter(([, v]) => v > 0)
    .map(([name, value], i) => ({ name, value, color: PIE_COLORS[i % PIE_COLORS.length] }));

  // Issues from deliveries list
  const withIssues = deliveries.filter(d => d.has_issues).length;

  return (
    <div className="space-y-6">

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Truck className="h-5 w-5 text-primary" />}
          iconBg="bg-primary/10"
          value={String(stats.total_today)}
          label="Total Today"
          sub="Scheduled deliveries"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          value={String(stats.completed_today)}
          label="Completed"
          sub={`${deliveryRate}% completion rate`}
          subColor="text-emerald-600"
        />
        <KpiCard
          icon={<Activity className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
          value={String(stats.in_progress)}
          label="In Progress"
          sub={`${stats.active_drivers} active drivers`}
          subColor="text-blue-600"
        />
        <KpiCard
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50"
          value={String(stats.failed_today)}
          label="Failed Today"
          sub={withIssues > 0 ? `${withIssues} have issues` : 'No issues reported'}
          subColor={stats.failed_today > 0 ? 'text-red-600' : 'text-muted-foreground'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Status breakdown pie */}
        {statusPie.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Delivery Status Breakdown
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={75}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusPie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...TT} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {statusPie.map(item => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs capitalize">{item.name.toLowerCase().replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Today's revenue + avg time */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Today at a Glance
          </h3>
          <div className="space-y-3">
            {[
              { label: "Revenue Today",       value: fmtMoney(stats.revenue_today ?? 0),              color: "text-emerald-600" },
              { label: "Avg Delivery Time",   value: stats.avg_delivery_time ? `${stats.avg_delivery_time} min` : '–', color: "text-foreground" },
              { label: "Completion Rate",     value: `${deliveryRate}%`,                              color: parseFloat(deliveryRate) >= 80 ? "text-emerald-600" : "text-amber-600" },
              { label: "Active Drivers",      value: String(stats.active_drivers),                   color: "text-blue-600" },
              { label: "Deliveries In Progress", value: String(stats.in_progress),                   color: "text-foreground" },
              { label: "Failed / Issues",     value: `${stats.failed_today} failed · ${withIssues} issues`, color: stats.failed_today > 0 ? "text-red-600" : "text-muted-foreground" },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className={cn('font-bold text-sm', row.color)}>{row.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Driver roster */}
      {drivers.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              Driver Activity Today
              <Badge variant="secondary">{drivers.length}</Badge>
            </h3>
            <button onClick={load} className="text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Driver</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Assigned</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Completed</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Rate</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Vehicle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {drivers
                  .sort((a, b) => b.today_completed - a.today_completed)
                  .map(driver => {
                    const rate = driver.today_assigned > 0
                      ? Math.round((driver.today_completed / driver.today_assigned) * 100)
                      : 0;
                    return (
                      <tr key={driver.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium">{driver.name}</p>
                          <p className="text-xs text-muted-foreground">{driver.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold">{driver.today_assigned}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn('font-bold', driver.today_completed > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
                            {driver.today_completed}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn('h-full rounded-full', rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold w-8">{rate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                          {driver.vehicle_number}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Recent deliveries with issues */}
      {withIssues > 0 && (
        <Card className="overflow-hidden border-red-200">
          <div className="px-6 py-4 border-b border-red-200 bg-red-50 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-800">Deliveries With Issues ({withIssues})</h3>
          </div>
          <div className="divide-y divide-border/30">
            {deliveries.filter(d => d.has_issues).map(d => (
              <div key={d.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{d.order_number}</p>
                  <p className="text-xs text-muted-foreground">{d.customer_name} · {d.customer_phone}</p>
                </div>
                <div className="text-right">
                  <Badge variant="destructive" className="text-[10px]">{d.status_display}</Badge>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.driver_info?.name ?? 'Unassigned'}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// ── SALES & REVENUE TAB ───────────────────────────────────────────────────────

const SalesTab: React.FC<{ period: string }> = ({ period }) => {
  const [data, setData] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = periodToDates(period);
      setData(await reportsService.getRevenue(from, to));
    } catch {
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Spinner /><Spinner /></div>;
  if (!data) return null;

  // Bucket daily data into months for the trend chart
  const monthMap: Record<string, { month: string; revenue: number; orders: number }> = {};
  data.byDay.forEach(d => {
    const key = format(new Date(d.date), 'MMM');
    if (!monthMap[key]) monthMap[key] = { month: key, revenue: 0, orders: 0 };
    monthMap[key].revenue += d.revenue;
    monthMap[key].orders  += d.orders;
  });
  const trendData = Object.values(monthMap).length > 1
    ? Object.values(monthMap)
    : data.byDay.map(d => ({ month: format(new Date(d.date), 'dd MMM'), revenue: d.revenue, orders: d.orders }));

  const topProducts = [...data.byProduct].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<DollarSign className="h-5 w-5 text-primary" />}   iconBg="bg-primary/10"    value={fmtMoneyShort(data.totalRevenue)}      label="Total Revenue"      sub={`${fmtDate(data.periodStart)} – ${fmtDate(data.periodEnd)}`} />
        <KpiCard icon={<Package className="h-5 w-5 text-emerald-600" />}  iconBg="bg-emerald-50"    value={String(data.totalOrders)}             label="Orders Fulfilled"  sub="Completed deliveries"  subColor="text-emerald-600" />
        <KpiCard icon={<BarChart3 className="h-5 w-5 text-blue-600" />}   iconBg="bg-blue-50"       value={String(data.totalDirectSales)}        label="Direct Sales"      sub="Walk-in & counter" />
        <KpiCard icon={<TrendingUp className="h-5 w-5 text-amber-600" />} iconBg="bg-amber-50"      value={fmtMoneyShort(data.averageOrderValue)} label="Avg Order Value"   sub="Per completed order" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue trend */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />Revenue Trend
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickFormatter={v => fmtMoneyShort(v).replace('KES ', '')} />
                <Tooltip {...TT} formatter={(v: number) => [fmtMoney(v), 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Orders volume */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />Orders Volume
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <Tooltip {...TT} />
                <Bar dataKey="orders" name="Orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top products horizontal bar */}
      {topProducts.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />Top Products by Revenue
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickFormatter={v => fmtMoneyShort(v).replace('KES ', '')} />
                <YAxis type="category" dataKey="productName" width={130} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <Tooltip {...TT} formatter={(v: number) => [fmtMoney(v), 'Revenue']} />
                <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Daily breakdown table */}
      {data.byDay.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50">
            <h3 className="font-semibold">Daily Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Date</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Orders</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Direct Sales</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {[...data.byDay].reverse().map((day, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-medium">{fmtDate(day.date)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{day.orders}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{day.directSales}</td>
                    <td className="px-4 py-3 text-right font-bold">{fmtMoney(day.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

// ── STAFF & DRIVERS TAB ───────────────────────────────────────────────────────

const StaffTab: React.FC = () => {
  const [drivers,    setDrivers]    = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<ClientDelivery[]>([]);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, del] = await Promise.all([
        deliveryService.getAvailableDrivers(),
        deliveryService.getClientDeliveries({ limit: 200 }),
      ]);
      setDrivers(d);
      setDeliveries(del.results ?? del.data ?? []);
    } catch {
      toast.error('Failed to load staff data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner height="h-72" />;

  // Build per-driver stats from deliveries list
  const driverMap: Record<string, {
    name: string; phone: string; vehicle: string;
    completed: number; inProgress: number; failed: number; total: number;
  }> = {};

  deliveries.forEach(d => {
    if (!d.driver_info) return;
    const key = d.driver_info.id;
    if (!driverMap[key]) {
      driverMap[key] = {
        name: d.driver_info.name, phone: d.driver_info.phone,
        vehicle: d.driver_info.vehicle_number,
        completed: 0, inProgress: 0, failed: 0, total: 0,
      };
    }
    driverMap[key].total++;
    if (d.status === 'DELIVERED' || d.status === 'COMPLETED') driverMap[key].completed++;
    else if (d.status === 'CANCELLED')                         driverMap[key].failed++;
    else                                                        driverMap[key].inProgress++;
  });

  // Merge with available drivers (captures those with 0 deliveries today too)
  drivers.forEach(d => {
    if (!driverMap[d.id]) {
      driverMap[d.id] = {
        name: d.name, phone: d.phone, vehicle: d.vehicle_number,
        completed: d.today_completed,
        inProgress: d.today_assigned - d.today_completed,
        failed: 0,
        total: d.today_assigned,
      };
    }
  });

  const staffRows = Object.values(driverMap).sort((a, b) => b.completed - a.completed);

  // Bar chart data
  const barData = staffRows.slice(0, 8).map(s => ({
    name:      s.name.split(' ')[0],
    completed: s.completed,
    pending:   s.inProgress,
    failed:    s.failed,
  }));

  const topDriver = staffRows[0];

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<UserCog className="h-5 w-5 text-primary" />}        iconBg="bg-primary/10"  value={String(staffRows.length)}                                       label="Total Drivers"     sub="On the books" />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} iconBg="bg-emerald-50" value={String(staffRows.reduce((s, d) => s + d.completed, 0))}        label="Completed Today"   sub="Across all drivers" subColor="text-emerald-600" />
        <KpiCard icon={<Clock className="h-5 w-5 text-blue-600" />}          iconBg="bg-blue-50"    value={String(staffRows.reduce((s, d) => s + d.inProgress, 0))}       label="In Progress"       sub="Active right now" subColor="text-blue-600" />
        <KpiCard
          icon={<Star className="h-5 w-5 text-amber-500" />}
          iconBg="bg-amber-50"
          value={topDriver ? topDriver.name.split(' ')[0] : '–'}
          label="Top Driver Today"
          sub={topDriver ? `${topDriver.completed} completed` : 'No data'}
          subColor="text-amber-600"
        />
      </div>

      {/* Performance chart */}
      {barData.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />Driver Performance Today
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <Tooltip {...TT} />
                <Legend />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="pending"   name="In Progress" fill="#3b82f6" radius={[0, 0, 0, 0]} stackId="a" />
                <Bar dataKey="failed"    name="Failed"     fill="#ef4444" radius={[0, 0, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Detailed table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            Driver Leaderboard
            <Badge variant="secondary">{staffRows.length}</Badge>
          </h3>
          <button onClick={load} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {staffRows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <UserCog className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No driver data available yet today</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Driver</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Total</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Done</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Active</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Failed</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {staffRows.map((driver, i) => {
                  const rate = driver.total > 0
                    ? Math.round((driver.completed / driver.total) * 100) : 0;
                  return (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 text-muted-foreground font-bold">#{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{driver.name}</p>
                        <p className="text-xs text-muted-foreground">{driver.vehicle}</p>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">{driver.total}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-600">{driver.completed}</td>
                      <td className="px-4 py-3 text-center text-blue-600">{driver.inProgress}</td>
                      <td className="px-4 py-3 text-center text-red-500">{driver.failed}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

// ── CUSTOMERS TAB ─────────────────────────────────────────────────────────────

const CustomersTab: React.FC = () => {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch up to 200 to build a meaningful overview
      const res: PaginatedCustomers = await customerAdminService.getCustomers({ limit: 200 });
      setCustomers(res.data);
    } catch {
      toast.error('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Spinner /><Spinner /></div>;

  const total      = customers.length;
  const active     = customers.filter(c => c.status === 'ACTIVE').length;
  const suspended  = customers.filter(c => c.status === 'SUSPENDED').length;
  const blocked    = customers.filter(c => c.status === 'BLOCKED').length;
  const credit     = customers.filter(c => c.credit_terms !== null).length;
  const registered = customers.filter(c => c.is_registered).length;

  const typePie = [
    { name: 'Refill',   value: customers.filter(c => c.customer_type === 'REFILL').length,  color: '#10b981' },
    { name: 'One-Time', value: customers.filter(c => c.customer_type === 'ONETIME').length, color: '#3b82f6' },
    { name: 'Hybrid',   value: customers.filter(c => c.customer_type === 'HYBRID').length,  color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const statusPie = [
    { name: 'Active',    value: active,    color: '#10b981' },
    { name: 'Suspended', value: suspended, color: '#f59e0b' },
    { name: 'Blocked',   value: blocked,   color: '#ef4444' },
  ].filter(d => d.value > 0);

  const topByOrders = [...customers]
    .sort((a, b) => b.total_orders - a.total_orders)
    .slice(0, 10);

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<Users className="h-5 w-5 text-primary" />}           iconBg="bg-primary/10"  value={String(total)}      label="Total Customers"   sub={`${registered} registered`} />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} iconBg="bg-emerald-50" value={String(active)}     label="Active"            sub={`${((active/total||0)*100).toFixed(0)}% of total`} subColor="text-emerald-600" />
        <KpiCard icon={<CreditCard className="h-5 w-5 text-purple-600" />}   iconBg="bg-purple-50"  value={String(credit)}    label="Credit Customers"  sub={`${total - credit} non-credit`} subColor="text-purple-600" />
        <KpiCard icon={<AlertCircle className="h-5 w-5 text-red-500" />}     iconBg="bg-red-50"     value={String(suspended + blocked)} label="Suspended/Blocked" sub="Need attention" subColor={suspended + blocked > 0 ? 'text-red-600' : 'text-muted-foreground'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Type breakdown */}
        {typePie.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Customer Type Breakdown</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typePie} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={70}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {typePie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip {...TT} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {typePie.map(item => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs">{item.name}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Status breakdown */}
        {statusPie.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Account Status</h3>
            <div className="space-y-3 mt-2">
              {[
                { label: 'Active',    value: active,    color: 'bg-emerald-500', pct: total > 0 ? (active / total) * 100 : 0 },
                { label: 'Suspended', value: suspended, color: 'bg-amber-400',   pct: total > 0 ? (suspended / total) * 100 : 0 },
                { label: 'Blocked',   value: blocked,   color: 'bg-red-500',     pct: total > 0 ? (blocked / total) * 100 : 0 },
                { label: 'Registered', value: registered, color: 'bg-blue-500', pct: total > 0 ? (registered / total) * 100 : 0 },
                { label: 'Credit',    value: credit,    color: 'bg-purple-500',  pct: total > 0 ? (credit / total) * 100 : 0 },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">{row.label}</span>
                    <span className="text-sm font-bold">{row.value}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', row.color)} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Top customers by orders */}
      {topByOrders.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />Top Customers by Orders
            </h3>
            <button onClick={load} className="text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Type</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Orders</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Last Order</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {topByOrders.map((c, i) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-bold text-muted-foreground">#{i + 1}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone_number}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs capitalize text-muted-foreground">{c.customer_type_display}</span>
                      {c.credit_terms && (
                        <Badge className="ml-1.5 text-[10px] bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">Credit</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">{c.total_orders}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{fmtDate(c.last_order_date)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        className={cn('text-[10px]',
                          c.status === 'ACTIVE'    && 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
                          c.status === 'SUSPENDED' && 'bg-amber-100   text-amber-700   border-amber-200   hover:bg-amber-100',
                          c.status === 'BLOCKED'   && 'bg-red-100     text-red-700     border-red-200     hover:bg-red-100',
                        )}
                      >
                        {c.status_display}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

// ── FINANCIAL TAB ─────────────────────────────────────────────────────────────

const FinancialTab: React.FC<{ period: string }> = ({ period }) => {
  const [revenue,     setRevenue]     = useState<RevenueSummary | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingSummary | null>(null);
  const [payments,    setPayments]    = useState<PaymentReport | null>(null);
  const [loading,     setLoading]     = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = periodToDates(period);
      const [rev, out, pay] = await Promise.all([
        reportsService.getRevenue(from, to),
        reportsService.getOutstanding(),
        accountingService.getPaymentReport({}),
      ]);
      setRevenue(rev);
      setOutstanding(out);
      setPayments(pay);
    } catch {
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Spinner /><Spinner /></div>;
  if (!revenue || !outstanding) return null;

  const collected    = revenue.totalRevenue - outstanding.totalOutstanding;
  const collectedPct = revenue.totalRevenue > 0 ? (collected / revenue.totalRevenue) * 100 : 0;

  const methodBreakdown = payments?.summary.paymentMethodBreakdown ?? {};
  const methodPie = Object.entries(methodBreakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value], i) => ({ name, value, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const statusPie = [
    { name: 'Collected',   value: Math.max(0, collected),            color: '#10b981' },
    { name: 'Outstanding', value: outstanding.totalOutstanding,       color: '#f59e0b' },
    { name: 'Overdue',     value: outstanding.totalOverdue,           color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<DollarSign className="h-5 w-5 text-primary" />}       iconBg="bg-primary/10"  value={fmtMoneyShort(revenue.totalRevenue)}          label="Total Invoiced"   sub={`${fmtDate(revenue.periodStart)} – ${fmtDate(revenue.periodEnd)}`} />
        <KpiCard icon={<BadgeCheck className="h-5 w-5 text-emerald-600" />}   iconBg="bg-emerald-50"  value={fmtMoneyShort(Math.max(0, collected))}         label="Collected"        sub={`${collectedPct.toFixed(0)}% of invoiced`}    subColor="text-emerald-600" />
        <KpiCard icon={<ShieldAlert className="h-5 w-5 text-amber-600" />}    iconBg="bg-amber-50"    value={fmtMoneyShort(outstanding.totalOutstanding)}    label="Outstanding"      sub={`${outstanding.customerCount} customers`}     subColor="text-amber-600" />
        <KpiCard icon={<AlertCircle className="h-5 w-5 text-red-500" />}      iconBg="bg-red-50"      value={fmtMoneyShort(outstanding.totalOverdue)}        label="Overdue"          sub={`${outstanding.overdueCount} accounts`}       subColor="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Collection status pie */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Revenue Collection Status</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={70}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {statusPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip {...TT} formatter={(v: number) => fmtMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {statusPie.map(item => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs">{item.name}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Payment method mix */}
        {methodPie.length > 0 ? (
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />Payment Method Mix
            </h3>
            <div className="space-y-3">
              {methodPie.map(item => {
                const total = methodPie.reduce((s, m) => s + m.value, 0);
                const pct   = total > 0 ? (item.value / total) * 100 : 0;
                return (
                  <div key={item.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-sm font-bold">{fmtMoney(item.value)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 text-right">{pct.toFixed(1)}%</p>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          /* Financial summary if no method data */
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Financial Summary</h3>
            <div className="space-y-3">
              {[
                { label: 'Total Revenue',       value: fmtMoney(revenue.totalRevenue),             color: 'text-foreground' },
                { label: 'Collected',           value: fmtMoney(Math.max(0, collected)),           color: 'text-emerald-600' },
                { label: 'Outstanding',         value: fmtMoney(outstanding.totalOutstanding),     color: 'text-amber-600' },
                { label: 'Overdue',             value: fmtMoney(outstanding.totalOverdue),         color: 'text-red-600' },
                { label: 'Total Orders',        value: String(revenue.totalOrders),                color: 'text-foreground' },
                { label: 'Avg Order Value',     value: fmtMoney(revenue.averageOrderValue),        color: 'text-foreground' },
              ].map(row => (
                <div key={row.label} className="flex justify-between p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className={cn('font-bold text-sm', row.color)}>{row.value}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Collection progress */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Overall Collection Rate</h3>
          <span className="text-2xl font-black tabular-nums">{collectedPct.toFixed(1)}%</span>
        </div>
        <div className="h-4 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700',
              collectedPct >= 80 ? 'bg-emerald-500' :
              collectedPct >= 50 ? 'bg-amber-400' : 'bg-red-500',
            )}
            style={{ width: `${Math.min(100, collectedPct)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{fmtMoney(Math.max(0, collected))} collected</span>
          <span>{fmtMoney(outstanding.totalOutstanding)} still owed</span>
        </div>
      </Card>

      {/* Overdue accounts table */}
      {outstanding.customers.filter(c => c.isOverdue).length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-red-200 bg-red-50 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-800">
              Overdue Accounts ({outstanding.customers.filter(c => c.isOverdue).length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Customer</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Outstanding</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Overdue</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Due Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {outstanding.customers
                  .filter(c => c.isOverdue)
                  .sort((a, b) => b.overdueAmount - a.overdueAmount)
                  .map(c => (
                    <tr key={c.customerId} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium">{c.customerName}</p>
                        <p className="text-xs text-muted-foreground">{c.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtMoney(c.outstandingAmount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">{fmtMoney(c.overdueAmount)}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">{fmtDate(c.oldestDueDate)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

interface ReportsPageProps {
  layout?:   'dashboard' | 'manager';
  readOnly?: boolean;
}

const ClientReportsPage: React.FC<ReportsPageProps> = ({
  layout   = 'dashboard',
  readOnly = false,
}) => {
  const [period, setPeriod] = useState('30d');

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    layout === 'manager'
      ? <ManagerLayout   title="Reports" subtitle="Full business overview">{children}</ManagerLayout>
      : <DashboardLayout title="Reports" subtitle="Full business overview">{children}</DashboardLayout>;

  return (
    <Wrapper>
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="mtd">This Month</SelectItem>
              <SelectItem value="ytd">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!readOnly && (
          <Button variant="outline" onClick={() => window.print()}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        )}
      </div>

      {/* Tabs — Operations is default (daily check) */}
      <Tabs defaultValue="operations" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="operations">
            <Truck className="h-4 w-4 mr-1.5 hidden sm:block" />
            <span className="hidden sm:inline">Operations</span>
            <span className="sm:hidden"><Truck className="h-4 w-4" /></span>
          </TabsTrigger>
          <TabsTrigger value="sales">
            <TrendingUp className="h-4 w-4 mr-1.5 hidden sm:block" />
            <span className="hidden sm:inline">Sales</span>
            <span className="sm:hidden"><TrendingUp className="h-4 w-4" /></span>
          </TabsTrigger>
          <TabsTrigger value="staff">
            <UserCog className="h-4 w-4 mr-1.5 hidden sm:block" />
            <span className="hidden sm:inline">Staff</span>
            <span className="sm:hidden"><UserCog className="h-4 w-4" /></span>
          </TabsTrigger>
          <TabsTrigger value="customers">
            <Users className="h-4 w-4 mr-1.5 hidden sm:block" />
            <span className="hidden sm:inline">Customers</span>
            <span className="sm:hidden"><Users className="h-4 w-4" /></span>
          </TabsTrigger>
          <TabsTrigger value="financial">
            <DollarSign className="h-4 w-4 mr-1.5 hidden sm:block" />
            <span className="hidden sm:inline">Financial</span>
            <span className="sm:hidden"><DollarSign className="h-4 w-4" /></span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="operations"><OperationsTab /></TabsContent>
        <TabsContent value="sales"><SalesTab period={period} /></TabsContent>
        <TabsContent value="staff"><StaffTab /></TabsContent>
        <TabsContent value="customers"><CustomersTab /></TabsContent>
        <TabsContent value="financial"><FinancialTab period={period} /></TabsContent>
      </Tabs>
    </Wrapper>
  );
};

export default ClientReportsPage;
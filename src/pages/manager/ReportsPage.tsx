/**
 * Reports Page — Site Manager (Enhanced)
 * src/pages/manager/ReportsPage.tsx
 *
 * Tabs:
 *   Operations      — deliveries today, driver performance, issues     [DEFAULT]
 *   Orders          — status breakdown, pending, recent activity
 *   Sales           — direct sales + revenue trend
 *   Driver Perf     — per-driver KPIs, ranking, revenue, issues
 *   Distribution    — delivery distribution across drivers + empty returns
 *   Damaged Bottles — damaged bottle tracking, costs, trends
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subDays, startOfMonth, startOfYear } from 'date-fns';
import { toast } from 'sonner';

import { ManagerLayout }  from '@/components/layout/ManagerLayout';
import { Card }           from '@/components/ui/card';
import { Badge }          from '@/components/ui/badge';
import { Button }         from '@/components/ui/button';
import { Input }          from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  Legend, AreaChart, Area, ComposedChart,
} from 'recharts';

import {
  Truck, TrendingUp, Package, BarChart3, Calendar,
  Loader2, RefreshCw, CheckCircle2, XCircle, Clock,
  AlertCircle, Activity, UserCog, Star, ShoppingBag,
  DollarSign, ClipboardList, Download, Users,
  Repeat, AlertTriangle, ArrowUpRight, ArrowDownRight,
  RotateCcw, Search, Filter,
} from 'lucide-react';

import { reportsService }  from '@/api/services/reports.service';
import { deliveryService } from '@/api/services/delivery.service';
import { ordersService }   from '@/api/services/orders.service';
import { cn }              from '@/lib/utils';

import type { RevenueSummary }                          from '@/types/reports.types';
import type { DeliveryStats, Driver, ClientDelivery }   from '@/api/services/delivery.service';
import type { Order }                                   from '@/types/order.types';
import axiosInstance from '@/api/axios.config';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DriverPerf {
  id:             string;
  name:           string;
  vehicle:        string;
  avatar?:        string;
  totalDeliveries: number;
  completed:      number;
  failed:         number;
  inProgress:     number;
  issueCount:     number;
  revenue:        number;
  avgTime?:       number;    // minutes
  emptyReturns:   number;
  rating?:        number;
}

interface DamagedBottleRecord {
  id:         string;
  date:       string;
  driverId:   string;
  driverName: string;
  orderId:    string;
  quantity:   number;
  unitCost:   number;
  totalCost:  number;
  reason:     string;
  status:     'pending' | 'written_off' | 'recovered' | 'customer_charged';
  notes?:     string;
}

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

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '–';
  try { return format(new Date(iso), 'd MMM · HH:mm'); } catch { return iso; }
};

const periodToDates = (period: string) => {
  const today = new Date();
  const fmt   = (d: Date) => format(d, 'yyyy-MM-dd');
  switch (period) {
    case '7d':  return { from: fmt(subDays(today, 7)),   to: fmt(today) };
    case '30d': return { from: fmt(subDays(today, 30)),  to: fmt(today) };
    case '90d': return { from: fmt(subDays(today, 90)),  to: fmt(today) };
    case 'mtd': return { from: fmt(startOfMonth(today)), to: fmt(today) };
    case 'ytd': return { from: fmt(startOfYear(today)),  to: fmt(today) };
    default:    return { from: fmt(subDays(today, 30)),  to: fmt(today) };
  }
};

/** Download data as CSV */
const downloadCSV = (rows: Record<string, unknown>[], filename: string) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── Shared UI ─────────────────────────────────────────────────────────────────

const Spinner: React.FC<{ height?: string }> = ({ height = 'h-56' }) => (
  <Card className="p-6">
    <div className={cn('flex items-center justify-center', height)}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
    </div>
  </Card>
);

const TT = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    border:          '1px solid hsl(var(--border))',
    borderRadius:    '8px',
    fontSize:        '12px',
  },
};

const PIE_COLORS  = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9'];
const PERIOD_LABELS: Record<string, string> = {
  '7d':  'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  'mtd': 'This Month',
  'ytd': 'This Year',
};

interface KpiProps {
  icon:      React.ReactNode;
  iconBg:    string;
  value:     string;
  label:     string;
  sub:       string;
  subColor?: string;
  trend?:    { value: number; up: boolean };
}
const Kpi: React.FC<KpiProps> = ({ icon, iconBg, value, label, sub, subColor = 'text-muted-foreground', trend }) => (
  <Card className="p-4">
    <div className="flex items-start gap-3">
      <div className={cn('p-2 rounded-lg shrink-0 mt-0.5', iconBg)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-1">
          <p className="text-2xl font-bold tabular-nums leading-none mb-0.5">{value}</p>
          {trend && (
            <span className={cn('text-xs font-semibold flex items-center gap-0.5', trend.up ? 'text-emerald-600' : 'text-red-500')}>
              {trend.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend.value}%
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn('text-xs font-medium mt-0.5', subColor)}>{sub}</p>
      </div>
    </div>
  </Card>
);

interface SectionHeaderProps {
  icon:      React.ReactNode;
  title:     string;
  badge?:    number;
  onRefresh?: () => void;
  onExport?:  () => void;
}
const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, badge, onRefresh, onExport }) => (
  <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
    <h3 className="font-semibold flex items-center gap-2">
      {icon} {title}
      {badge !== undefined && <Badge variant="secondary">{badge}</Badge>}
    </h3>
    <div className="flex items-center gap-2">
      {onExport  && <button onClick={onExport}  className="text-muted-foreground hover:text-foreground transition-colors"><Download className="h-4 w-4" /></button>}
      {onRefresh && <button onClick={onRefresh} className="text-muted-foreground hover:text-foreground transition-colors"><RefreshCw className="h-4 w-4" /></button>}
    </div>
  </div>
);

// ── OPERATIONS TAB ────────────────────────────────────────────────────────────

const OperationsTab: React.FC<{ period: string }> = ({ period }) => {
  const [stats,      setStats]      = useState<DeliveryStats | null>(null);
  const [drivers,    setDrivers]    = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<ClientDelivery[]>([]);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = periodToDates(period);
      const [s, d, del] = await Promise.all([
        deliveryService.getDeliveryStats(),
        deliveryService.getAvailableDrivers(),
        deliveryService.getClientDeliveries({ limit: 200, date_from: from, date_to: to }),
      ]);
      setStats(s);
      setDrivers(d);
      setDeliveries(del.results ?? del.data ?? []);
    } catch {
      toast.error('Failed to load operations data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <Spinner key={i} height="h-20" />)}</div>
      <Spinner />
    </div>
  );
  if (!stats) return null;

  const completionRate = stats.total_today > 0
    ? ((stats.completed_today / stats.total_today) * 100).toFixed(1) : '0.0';

  const withIssues = deliveries.filter(d => d.has_issues);

  const statusPie = Object.entries(stats.status_breakdown ?? {})
    .filter(([, v]) => v > 0)
    .map(([name, value], i) => ({ name: name.replace(/_/g, ' '), value, color: PIE_COLORS[i % PIE_COLORS.length] }));

  const driverMap: Record<string, { name: string; vehicle: string; completed: number; inProgress: number; failed: number; total: number }> = {};
  deliveries.forEach(d => {
    if (!d.driver_info) return;
    const key = d.driver_info.id;
    if (!driverMap[key]) driverMap[key] = { name: d.driver_info.name, vehicle: d.driver_info.vehicle_number, completed: 0, inProgress: 0, failed: 0, total: 0 };
    driverMap[key].total++;
    if (['DELIVERED', 'COMPLETED'].includes(d.status)) driverMap[key].completed++;
    else if (d.status === 'CANCELLED')                  driverMap[key].failed++;
    else                                                driverMap[key].inProgress++;
  });
  drivers.forEach(d => {
    if (!driverMap[d.id]) driverMap[d.id] = { name: d.name, vehicle: d.vehicle_number, completed: d.today_completed, inProgress: Math.max(0, d.today_assigned - d.today_completed), failed: 0, total: d.today_assigned };
  });
  const driverRows = Object.values(driverMap).sort((a, b) => b.completed - a.completed);
  const topDriver  = driverRows[0];

  const handleExportDeliveries = () => {
    downloadCSV(
      deliveries.map(d => ({
        order_number:   d.order_number,
        customer:       d.customer_name,
        driver:         d.driver_info?.name ?? '',
        status:         d.status,
        has_issues:     d.has_issues,
        scheduled_date: d.scheduled_date,
      })),
      `deliveries-${period}`,
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Kpi icon={<Truck className="h-5 w-5 text-primary" />}            iconBg="bg-primary/10"  value={String(stats.total_today)}     label="Total Today"   sub="Scheduled deliveries" />
        <Kpi icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} iconBg="bg-emerald-50"  value={String(stats.completed_today)} label="Completed"     sub={`${completionRate}% done`} subColor="text-emerald-600" />
        <Kpi icon={<Activity className="h-5 w-5 text-blue-600" />}        iconBg="bg-blue-50"     value={String(stats.in_progress)}     label="In Progress"   sub={`${stats.active_drivers} drivers active`} subColor="text-blue-600" />
        <Kpi icon={<XCircle className="h-5 w-5 text-red-500" />}          iconBg="bg-red-50"      value={String(stats.failed_today)}    label="Failed"        sub={withIssues.length > 0 ? `${withIssues.length} have issues` : 'No issues'} subColor={stats.failed_today > 0 ? 'text-red-600' : 'text-muted-foreground'} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5" />Top Driver Today
          </p>
          {topDriver ? (
            <div>
              <p className="text-lg font-bold">{topDriver.name}</p>
              <p className="text-sm text-muted-foreground">{topDriver.vehicle}</p>
              <p className="text-sm text-emerald-600 font-semibold mt-1">{topDriver.completed} completed · {topDriver.inProgress} in progress</p>
            </div>
          ) : <p className="text-muted-foreground text-sm">No data yet today</p>}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />Revenue Today
          </p>
          <p className="text-2xl font-black tabular-nums">{fmtMoney(stats.revenue_today ?? 0)}</p>
          {stats.avg_delivery_time && <p className="text-sm text-muted-foreground mt-1">Avg delivery: {stats.avg_delivery_time} min</p>}
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', parseFloat(completionRate) >= 80 ? 'bg-emerald-500' : parseFloat(completionRate) >= 50 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${Math.min(100, parseFloat(completionRate))}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">{completionRate}% completion rate</p>
        </Card>
      </div>

      {statusPie.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Status Breakdown</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {statusPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip {...TT} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {statusPie.map(item => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs capitalize">{item.name.toLowerCase()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {driverRows.length > 0 && (
        <Card className="overflow-hidden">
          <SectionHeader icon={<UserCog className="h-5 w-5 text-primary" />} title={`Driver Activity — ${PERIOD_LABELS[period] ?? period}`} badge={driverRows.length} onRefresh={load} onExport={handleExportDeliveries} />
          <div className="divide-y divide-border/30">
            {driverRows.map((driver, i) => {
              const rate = driver.total > 0 ? Math.round((driver.completed / driver.total) * 100) : 0;
              return (
                <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                  <span className="text-sm font-black text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{driver.name}</p>
                    <p className="text-xs text-muted-foreground">{driver.vehicle}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="font-bold text-emerald-600">{driver.completed} ✓</span>
                    <span className="text-blue-500">{driver.inProgress} ⟳</span>
                    {driver.failed > 0 && <span className="text-red-500">{driver.failed} ✗</span>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 w-20">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-xs font-semibold w-7 text-right">{rate}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {withIssues.length > 0 && (
        <Card className="overflow-hidden border-red-200">
          <div className="px-5 py-4 border-b border-red-200 bg-red-50 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h3 className="font-semibold text-red-800">Deliveries With Issues ({withIssues.length})</h3>
          </div>
          <div className="divide-y divide-border/30">
            {withIssues.map(d => (
              <div key={d.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono font-bold text-sm">{d.order_number}</p>
                  <p className="text-xs text-muted-foreground truncate">{d.customer_name} · {d.driver_info?.name ?? 'Unassigned'}</p>
                </div>
                <Badge variant="destructive" className="text-[10px] shrink-0">{d.status_display}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};


// ── ORDERS TAB ────────────────────────────────────────────────────────────────

const OrdersTab: React.FC = () => {
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Use the correct endpoint that matches your Django backend
      const response = await axiosInstance.get('/orders/all/', {
        params: { limit: 100 }
      });
      
      // Handle the response - it could be an array or an object with results
      let ordersData: Order[] = [];
      if (Array.isArray(response.data)) {
        ordersData = response.data;
      } else if (response.data && Array.isArray(response.data.results)) {
        ordersData = response.data.results;
      } else {
        ordersData = [];
      }
      
      setOrders(ordersData);
    } catch (error) {
      console.error('Failed to load orders:', error);
      toast.error('Failed to load orders data');
    } finally { 
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="space-y-4"><Spinner height="h-32" /><Spinner /></div>;

  const filtered = search
    ? orders.filter(o => o.orderNumber?.toLowerCase().includes(search.toLowerCase()) || o.customerName?.toLowerCase().includes(search.toLowerCase()))
    : orders;

  const total      = orders.length;
  const pending    = orders.filter(o => o.status === 'pending').length;
  const confirmed  = orders.filter(o => o.status === 'confirmed').length;
  const inDelivery = orders.filter(o => o.status === 'in_delivery').length;
  const completed  = orders.filter(o => o.status === 'completed').length;
  const cancelled  = orders.filter(o => o.status === 'cancelled').length;
  const invoiced   = orders.filter(o => o.status === 'invoiced').length;

  const statusBars = [
    { label: 'Pending',     value: pending,    color: '#f59e0b', bg: 'bg-amber-400'   },
    { label: 'Confirmed',   value: confirmed,  color: '#3b82f6', bg: 'bg-blue-500'    },
    { label: 'In Delivery', value: inDelivery, color: '#0ea5e9', bg: 'bg-sky-500'     },
    { label: 'Completed',   value: completed,  color: '#10b981', bg: 'bg-emerald-500' },
    { label: 'Invoiced',    value: invoiced,   color: '#8b5cf6', bg: 'bg-purple-500'  },
    { label: 'Cancelled',   value: cancelled,  color: '#ef4444', bg: 'bg-red-500'     },
  ].filter(s => s.value > 0);

  const barChartData  = statusBars.map(s => ({ name: s.label, count: s.value }));
  const needsAction   = filtered.filter(o => ['pending', 'confirmed'].includes(o.status)).slice(0, 15);

  const handleExport = () => {
    downloadCSV(orders.map(o => ({
      order_number:    o.orderNumber,
      customer:        o.customerName,
      status:          o.status,
      payment_method:  o.paymentMethod,
      payment_status:  o.paymentStatus,
      total:           o.total,
      scheduled_date:  o.scheduledDate,
      created_at:      o.createdAt,
    })), 'orders-report');
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Kpi icon={<ClipboardList className="h-5 w-5 text-primary" />}    iconBg="bg-primary/10"  value={String(total)}               label="Total Orders"  sub="In selected period" />
        <Kpi icon={<Clock className="h-5 w-5 text-amber-600" />}          iconBg="bg-amber-50"    value={String(pending + confirmed)}  label="Need Action"   sub="Pending or confirmed"  subColor={pending + confirmed > 0 ? 'text-amber-600' : 'text-muted-foreground'} />
        <Kpi icon={<Truck className="h-5 w-5 text-blue-600" />}           iconBg="bg-blue-50"     value={String(inDelivery)}           label="In Delivery"   sub="Out for delivery"      subColor="text-blue-600" />
        <Kpi icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} iconBg="bg-emerald-50"  value={String(completed + invoiced)} label="Done"          sub="Completed or invoiced" subColor="text-emerald-600" />
      </div>

      {barChartData.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Orders by Status</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <Tooltip {...TT} />
                <Bar dataKey="count" name="Orders" radius={[4, 4, 0, 0]}>
                  {barChartData.map((_, i) => <Cell key={i} fill={statusBars[i]?.color ?? '#10b981'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="font-semibold mb-4">Status Breakdown</h3>
        <div className="space-y-3">
          {statusBars.map(row => (
            <div key={row.label}>
              <div className="flex justify-between mb-1">
                <span className="text-sm">{row.label}</span>
                <span className="text-sm font-bold">{row.value}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', row.bg)} style={{ width: `${total > 0 ? (row.value / total) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {needsAction.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-200 bg-amber-50 flex items-center justify-between">
            <h3 className="font-semibold text-amber-800 flex items-center gap-2">
              <Clock className="h-5 w-5" />Needs Action ({needsAction.length})
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={handleExport} className="text-amber-600 hover:text-amber-800 transition-colors"><Download className="h-4 w-4" /></button>
              <button onClick={load} className="text-amber-600 hover:text-amber-800 transition-colors"><RefreshCw className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="px-5 py-3 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8 h-8 text-sm" placeholder="Search order or customer…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {needsAction.map(order => (
              <div key={order.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-bold text-sm">{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground truncate">{order.customerName ?? '–'} · {fmtDateTime(order.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{fmtMoney(order.total ?? 0)}</p>
                  <Badge className={cn('text-[10px] mt-0.5', order.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100')}>
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {total === 0 && (
        <Card className="p-12 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold">No orders found</p>
          <p className="text-sm text-muted-foreground mt-1">Orders will appear here once placed.</p>
        </Card>
      )}
    </div>
  );
};

// ── SALES TAB ─────────────────────────────────────────────────────────────────

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
    } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="space-y-4"><Spinner height="h-32" /><Spinner /></div>;
  if (!data)   return null;

  const dailyData  = data.byDay.map(d => ({ date: format(new Date(d.date), 'dd MMM'), revenue: d.revenue, orders: d.orders, directSales: d.directSales }));
  const topProducts = [...data.byProduct].sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  const handleExport = () => {
    downloadCSV(
      data.byDay.map(d => ({ date: d.date, orders: d.orders, direct_sales: d.directSales, revenue: d.revenue })),
      `sales-${period}`,
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Kpi icon={<DollarSign className="h-5 w-5 text-primary" />}   iconBg="bg-primary/10"  value={fmtMoneyShort(data.totalRevenue)}     label="Total Revenue"    sub={`${fmtDate(data.periodStart)} – ${fmtDate(data.periodEnd)}`} />
        <Kpi icon={<Package className="h-5 w-5 text-emerald-600" />}  iconBg="bg-emerald-50"  value={String(data.totalOrders)}             label="Orders Fulfilled" sub="Completed deliveries" subColor="text-emerald-600" />
        <Kpi icon={<ShoppingBag className="h-5 w-5 text-blue-600" />} iconBg="bg-blue-50"     value={String(data.totalDirectSales)}        label="Direct Sales"     sub="Counter / walk-in" />
        <Kpi icon={<TrendingUp className="h-5 w-5 text-amber-600" />} iconBg="bg-amber-50"    value={fmtMoneyShort(data.averageOrderValue)} label="Avg Order"        sub="Per completed order" />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Revenue & Orders Trend</h3>
          <button onClick={handleExport} className="text-muted-foreground hover:text-foreground transition-colors"><Download className="h-4 w-4" /></button>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis yAxisId="left"  stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} tickFormatter={v => fmtMoneyShort(v).replace('KES ', '')} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
              <Tooltip {...TT} formatter={(v: number, name: string) => [name === 'Revenue' ? fmtMoney(v) : v, name]} />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.1)" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="directSales" name="Direct Sales" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {topProducts.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Top Products</h3>
          <div className="space-y-3">
            {topProducts.map((p, i) => {
              const pct = topProducts[0].revenue > 0 ? (p.revenue / topProducts[0].revenue) * 100 : 0;
              return (
                <div key={p.productId}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-black text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                      <p className="font-semibold text-sm truncate">{p.productName}</p>
                      <span className="text-xs text-muted-foreground shrink-0">{p.unit}</span>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-bold text-sm">{fmtMoney(p.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{p.quantity} units</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {dailyData.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50">
            <h3 className="font-semibold">Daily Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left px-5 py-2.5 font-semibold text-muted-foreground">Date</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Orders</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Direct</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {[...dailyData].reverse().map((day, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-2.5 font-medium">{day.date}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{day.orders}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{day.directSales}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{fmtMoney(day.revenue)}</td>
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

// ── DRIVER PERFORMANCE TAB ────────────────────────────────────────────────────

const DriverPerfTab: React.FC<{ period: string }> = ({ period }) => {
  const [drivers,    setDrivers]    = useState<DriverPerf[]>([]);
  const [deliveries, setDeliveries] = useState<ClientDelivery[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [sortBy,     setSortBy]     = useState<'completed' | 'revenue' | 'issues' | 'rate'>('completed');
  const [filterDriver, setFilterDriver] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = periodToDates(period);
      const [driverList, del] = await Promise.all([
        deliveryService.getAvailableDrivers(),
        deliveryService.getClientDeliveries({ limit: 500, date_from: from, date_to: to }),
      ]);
      const dels: ClientDelivery[] = del.results ?? del.data ?? [];
      setDeliveries(dels);

      // Aggregate per driver
      const map: Record<string, DriverPerf> = {};
      driverList.forEach(d => {
        map[d.id] = { id: d.id, name: d.name, vehicle: d.vehicle_number, totalDeliveries: 0, completed: 0, failed: 0, inProgress: 0, issueCount: 0, revenue: 0, emptyReturns: 0 };
      });
      dels.forEach(d => {
        if (!d.driver_info) return;
        const k = d.driver_info.id;
        if (!map[k]) map[k] = { id: k, name: d.driver_info.name, vehicle: d.driver_info.vehicle_number, totalDeliveries: 0, completed: 0, failed: 0, inProgress: 0, issueCount: 0, revenue: 0, emptyReturns: 0 };
        map[k].totalDeliveries++;
        if (['DELIVERED', 'COMPLETED'].includes(d.status)) {
          map[k].completed++;
          map[k].revenue += d.total_amount ?? 0;
        } else if (d.status === 'CANCELLED') map[k].failed++;
        else map[k].inProgress++;
        if (d.has_issues)       map[k].issueCount++;
        if (d.is_empty_return)  map[k].emptyReturns++;
      });
      setDrivers(Object.values(map));
    } catch {
      toast.error('Failed to load driver performance data');
    } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => {
    const filtered = filterDriver === 'all' ? drivers : drivers.filter(d => d.id === filterDriver);
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'revenue':   return b.revenue - a.revenue;
        case 'issues':    return b.issueCount - a.issueCount;
        case 'rate':      return (b.totalDeliveries > 0 ? b.completed / b.totalDeliveries : 0) - (a.totalDeliveries > 0 ? a.completed / a.totalDeliveries : 0);
        default:          return b.completed - a.completed;
      }
    });
  }, [drivers, sortBy, filterDriver]);

  const topDriver    = sorted[0];
  const totalRevenue = drivers.reduce((s, d) => s + d.revenue, 0);
  const totalIssues  = drivers.reduce((s, d) => s + d.issueCount, 0);
  const totalDone    = drivers.reduce((s, d) => s + d.completed, 0);

  // Bar chart data — top 8 by completed
  const barData = [...drivers].sort((a, b) => b.completed - a.completed).slice(0, 8).map(d => ({
    name:      d.name.split(' ')[0],
    completed: d.completed,
    failed:    d.failed,
    revenue:   d.revenue,
  }));

  const handleExport = () => {
    downloadCSV(sorted.map(d => ({
      name:             d.name,
      vehicle:          d.vehicle,
      total_deliveries: d.totalDeliveries,
      completed:        d.completed,
      failed:           d.failed,
      issues:           d.issueCount,
      empty_returns:    d.emptyReturns,
      revenue:          d.revenue,
      completion_rate:  d.totalDeliveries > 0 ? ((d.completed / d.totalDeliveries) * 100).toFixed(1) + '%' : '0%',
    })), `driver-performance-${period}`);
  };

  if (loading) return <div className="space-y-4"><div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <Spinner key={i} height="h-20" />)}</div><Spinner /></div>;

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Kpi icon={<Users className="h-5 w-5 text-primary" />}            iconBg="bg-primary/10"  value={String(drivers.length)}    label="Active Drivers"    sub={`${PERIOD_LABELS[period]}`} />
        <Kpi icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} iconBg="bg-emerald-50"  value={String(totalDone)}         label="Total Completed"   sub="Across all drivers"  subColor="text-emerald-600" />
        <Kpi icon={<DollarSign className="h-5 w-5 text-blue-600" />}      iconBg="bg-blue-50"     value={fmtMoneyShort(totalRevenue)} label="Total Revenue"   sub="Driver-attributed" />
        <Kpi icon={<AlertTriangle className="h-5 w-5 text-red-500" />}    iconBg="bg-red-50"      value={String(totalIssues)}       label="Total Issues"      sub="All drivers combined"  subColor={totalIssues > 0 ? 'text-red-600' : 'text-muted-foreground'} />
      </div>

      {/* Top performer card */}
      {topDriver && (
        <Card className="p-5 border-emerald-200 bg-gradient-to-r from-emerald-50 to-transparent">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2 flex items-center gap-1.5"><Star className="h-3.5 w-3.5" />Top Performer — {PERIOD_LABELS[period]}</p>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xl font-black">{topDriver.name}</p>
              <p className="text-sm text-muted-foreground">{topDriver.vehicle}</p>
            </div>
            <div className="flex gap-6 text-center">
              <div><p className="text-2xl font-black text-emerald-600">{topDriver.completed}</p><p className="text-xs text-muted-foreground">Completed</p></div>
              <div><p className="text-2xl font-black text-blue-600">{fmtMoneyShort(topDriver.revenue)}</p><p className="text-xs text-muted-foreground">Revenue</p></div>
              <div><p className="text-2xl font-black">{topDriver.totalDeliveries > 0 ? Math.round((topDriver.completed / topDriver.totalDeliveries) * 100) : 0}%</p><p className="text-xs text-muted-foreground">Rate</p></div>
            </div>
          </div>
        </Card>
      )}

      {/* Chart */}
      {barData.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Deliveries by Driver</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <Tooltip {...TT} />
                <Legend />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="failed"    name="Failed"    fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="completed">Sort: Completed</SelectItem>
            <SelectItem value="revenue">Sort: Revenue</SelectItem>
            <SelectItem value="rate">Sort: Comp. Rate</SelectItem>
            <SelectItem value="issues">Sort: Issues</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDriver} onValueChange={setFilterDriver}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Drivers</SelectItem>
            {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <button onClick={handleExport} className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Download className="h-4 w-4" />Export CSV
        </button>
      </div>

      {/* Driver table */}
      <Card className="overflow-hidden">
        <SectionHeader icon={<UserCog className="h-5 w-5 text-primary" />} title="Driver Leaderboard" badge={sorted.length} onRefresh={load} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left px-5 py-2.5 font-semibold text-muted-foreground">#</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Driver</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Total</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Done</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Failed</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Issues</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Revenue</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {sorted.map((d, i) => {
                const rate = d.totalDeliveries > 0 ? Math.round((d.completed / d.totalDeliveries) * 100) : 0;
                return (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-2.5 font-black text-muted-foreground">#{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.vehicle}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right">{d.totalDeliveries}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{d.completed}</td>
                    <td className="px-4 py-2.5 text-right text-red-500">{d.failed}</td>
                    <td className="px-4 py-2.5 text-right">
                      {d.issueCount > 0
                        ? <span className="text-red-600 font-bold">{d.issueCount}</span>
                        : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold">{fmtMoneyShort(d.revenue)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full', rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${rate}%` }} />
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
      </Card>
    </div>
  );
};

// ── DISTRIBUTION TAB ──────────────────────────────────────────────────────────

const DistributionTab: React.FC<{ period: string }> = ({ period }) => {
  const [deliveries, setDeliveries] = useState<ClientDelivery[]>([]);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = periodToDates(period);
      const del = await deliveryService.getClientDeliveries({ limit: 500, date_from: from, date_to: to });
      setDeliveries(del.results ?? del.data ?? []);
    } catch {
      toast.error('Failed to load distribution data');
    } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const { driverDist, emptyReturnRate, totalDeliveries, totalEmptyReturns, dailyTrend } = useMemo(() => {
    const map: Record<string, { name: string; total: number; emptyReturns: number; color: string }> = {};
    const dayMap: Record<string, { date: string; deliveries: number; emptyReturns: number }> = {};

    deliveries.forEach(d => {
      const key  = d.driver_info?.id ?? 'unassigned';
      const name = d.driver_info?.name ?? 'Unassigned';
      if (!map[key]) map[key] = { name, total: 0, emptyReturns: 0, color: PIE_COLORS[Object.keys(map).length % PIE_COLORS.length] };
      map[key].total++;
      if (d.is_empty_return) map[key].emptyReturns++;

      const day = d.scheduled_date?.slice(0, 10) ?? d.created_at?.slice(0, 10) ?? '';
      if (day) {
        if (!dayMap[day]) dayMap[day] = { date: day, deliveries: 0, emptyReturns: 0 };
        dayMap[day].deliveries++;
        if (d.is_empty_return) dayMap[day].emptyReturns++;
      }
    });

    const driverDist  = Object.values(map).sort((a, b) => b.total - a.total);
    const totalDel    = deliveries.length;
    const totalER     = deliveries.filter(d => d.is_empty_return).length;
    const erRate      = totalDel > 0 ? ((totalER / totalDel) * 100).toFixed(1) : '0.0';
    const daily       = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      date:         format(new Date(d.date), 'dd MMM'),
      deliveries:   d.deliveries,
      emptyReturns: d.emptyReturns,
    }));

    return { driverDist, emptyReturnRate: erRate, totalDeliveries: totalDel, totalEmptyReturns: totalER, dailyTrend: daily };
  }, [deliveries]);

  const handleExport = () => {
    downloadCSV(driverDist.map(d => ({
      driver:        d.name,
      total:         d.total,
      empty_returns: d.emptyReturns,
      er_rate:       d.total > 0 ? ((d.emptyReturns / d.total) * 100).toFixed(1) + '%' : '0%',
      share:         totalDeliveries > 0 ? ((d.total / totalDeliveries) * 100).toFixed(1) + '%' : '0%',
    })), `distribution-${period}`);
  };

  if (loading) return <div className="space-y-4"><div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <Spinner key={i} height="h-20" />)}</div><Spinner /></div>;

  const erRateNum = parseFloat(emptyReturnRate);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Kpi icon={<Truck className="h-5 w-5 text-primary" />}         iconBg="bg-primary/10"  value={String(totalDeliveries)}   label="Total Deliveries"   sub={PERIOD_LABELS[period]} />
        <Kpi icon={<Users className="h-5 w-5 text-blue-600" />}        iconBg="bg-blue-50"     value={String(driverDist.length)} label="Drivers Active"     sub="With assigned deliveries" subColor="text-blue-600" />
        <Kpi icon={<RotateCcw className="h-5 w-5 text-amber-600" />}   iconBg="bg-amber-50"    value={String(totalEmptyReturns)} label="Empty Returns"      sub={`${emptyReturnRate}% rate`} subColor={erRateNum > 15 ? 'text-red-600' : erRateNum > 8 ? 'text-amber-600' : 'text-emerald-600'} />
        <Kpi
          icon={<Activity className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          value={driverDist[0]?.name.split(' ')[0] ?? '–'}
          label="Busiest Driver"
          sub={driverDist[0] ? `${driverDist[0].total} deliveries` : 'No data'}
          subColor="text-emerald-600"
        />
      </div>

      {/* Pie + bar side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Distribution Share</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={driverDist} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {driverDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip {...TT} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
            {driverDist.map(d => (
              <div key={d.name} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[11px] text-muted-foreground">{d.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><RotateCcw className="h-5 w-5 text-amber-500" />Empty Returns / Driver</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driverDist.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} width={60} tickFormatter={n => n.split(' ')[0]} />
                <Tooltip {...TT} />
                <Bar dataKey="emptyReturns" name="Empty Returns" fill="#f59e0b" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Daily trend */}
      {dailyTrend.length > 1 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Delivery & Empty Return Trend</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip {...TT} />
                <Legend />
                <Area type="monotone" dataKey="deliveries" name="Deliveries" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.15)" strokeWidth={2} />
                <Area type="monotone" dataKey="emptyReturns" name="Empty Returns" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Driver distribution table */}
      <Card className="overflow-hidden">
        <SectionHeader icon={<Users className="h-5 w-5 text-primary" />} title="Per-Driver Distribution" badge={driverDist.length} onRefresh={load} onExport={handleExport} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left px-5 py-2.5 font-semibold text-muted-foreground">Driver</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Deliveries</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Share</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Empty Returns</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">ER Rate</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {driverDist.map((d, i) => {
                const share  = totalDeliveries > 0 ? (d.total / totalDeliveries) * 100 : 0;
                const erRate = d.total > 0 ? (d.emptyReturns / d.total) * 100 : 0;
                return (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="font-semibold">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold">{d.total}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: d.color }} />
                        </div>
                        <span className="text-xs">{share.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">{d.emptyReturns}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn('text-xs font-bold', erRate > 15 ? 'text-red-600' : erRate > 8 ? 'text-amber-600' : 'text-emerald-600')}>
                        {erRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', erRate > 15 ? 'bg-red-500' : erRate > 8 ? 'bg-amber-400' : 'bg-emerald-500')} style={{ width: `${Math.min(100, erRate * 4)}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ── DAMAGED BOTTLES TAB ───────────────────────────────────────────────────────

// NOTE: Replace with your actual API call when available.
// This tab is wired to a placeholder loader — swap in your real service endpoint.
const useDamagedBottles = (period: string) => {
  const [records,  setRecords]  = useState<DamagedBottleRecord[]>([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: swap this for your real API once the endpoint is ready
      // const { from, to } = periodToDates(period);
      // const res = await inventoryService.getDamagedBottles({ from, to });
      // setRecords(res);

      // Placeholder — remove when wiring the real API
      await new Promise(r => setTimeout(r, 600));
      setRecords([]);
    } catch {
      toast.error('Failed to load damaged bottles data');
    } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);
  return { records, loading, reload: load };
};

const STATUS_CONFIG: Record<DamagedBottleRecord['status'], { label: string; color: string }> = {
  pending:          { label: 'Pending',          color: 'bg-amber-100 text-amber-700 border-amber-200' },
  written_off:      { label: 'Written Off',      color: 'bg-red-100 text-red-700 border-red-200'       },
  recovered:        { label: 'Recovered',        color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  customer_charged: { label: 'Cust. Charged',    color: 'bg-blue-100 text-blue-700 border-blue-200'    },
};

const DamagedBottlesTab: React.FC<{ period: string }> = ({ period }) => {
  const { records, loading, reload } = useDamagedBottles(period);
  const [filterStatus, setFilterStatus] = useState<DamagedBottleRecord['status'] | 'all'>('all');
  const [filterDriver, setFilterDriver] = useState('all');

  const drivers = useMemo(() => {
    const names = new Set(records.map(r => r.driverName));
    return Array.from(names);
  }, [records]);

  const filtered = useMemo(() =>
    records.filter(r =>
      (filterStatus === 'all' || r.status === filterStatus) &&
      (filterDriver === 'all' || r.driverName === filterDriver),
    ), [records, filterStatus, filterDriver]);

  const totalBottles = filtered.reduce((s, r) => s + r.quantity, 0);
  const totalCost    = filtered.reduce((s, r) => s + r.totalCost, 0);
  const recovered    = filtered.filter(r => r.status === 'recovered').reduce((s, r) => s + r.totalCost, 0);
  const pending      = filtered.filter(r => r.status === 'pending').length;

  // Trend — group by day
  const trend = useMemo(() => {
    const map: Record<string, { date: string; bottles: number; cost: number }> = {};
    filtered.forEach(r => {
      const d = r.date.slice(0, 10);
      if (!map[d]) map[d] = { date: format(new Date(d), 'dd MMM'), bottles: 0, cost: 0 };
      map[d].bottles += r.quantity;
      map[d].cost    += r.totalCost;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  // By driver pie
  const byDriver = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => { map[r.driverName] = (map[r.driverName] ?? 0) + r.quantity; });
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: PIE_COLORS[i % PIE_COLORS.length] })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  // By reason
  const byReason = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => { map[r.reason] = (map[r.reason] ?? 0) + r.quantity; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const handleExport = () => {
    downloadCSV(filtered.map(r => ({
      date:       r.date,
      driver:     r.driverName,
      order_id:   r.orderId,
      quantity:   r.quantity,
      unit_cost:  r.unitCost,
      total_cost: r.totalCost,
      reason:     r.reason,
      status:     r.status,
      notes:      r.notes ?? '',
    })), `damaged-bottles-${period}`);
  };

  if (loading) return <div className="space-y-4"><div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <Spinner key={i} height="h-20" />)}</div><Spinner /></div>;

  if (records.length === 0) return (
    <Card className="p-16 text-center">
      <div className="mx-auto mb-4 p-4 rounded-full bg-muted/40 w-fit">
        <Package className="h-10 w-10 text-muted-foreground/40" />
      </div>
      <p className="font-bold text-lg">No damaged bottle records</p>
      <p className="text-sm text-muted-foreground mt-1">Records will appear here once logged via the delivery app.</p>
      <p className="text-xs text-muted-foreground/60 mt-4">Connect your inventory service to populate this tab automatically.</p>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Kpi icon={<AlertTriangle className="h-5 w-5 text-red-500" />}    iconBg="bg-red-50"    value={String(totalBottles)}         label="Damaged Bottles"  sub={`${filtered.length} incidents`} subColor="text-red-600" />
        <Kpi icon={<DollarSign className="h-5 w-5 text-red-500" />}       iconBg="bg-red-50"    value={fmtMoneyShort(totalCost)}     label="Total Loss"       sub="Gross cost"         subColor="text-red-600" />
        <Kpi icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} iconBg="bg-emerald-50" value={fmtMoneyShort(recovered)}    label="Recovered"        sub="Charged or retrieved" subColor="text-emerald-600" />
        <Kpi icon={<Clock className="h-5 w-5 text-amber-600" />}          iconBg="bg-amber-50"  value={String(pending)}              label="Pending Action"   sub="Unresolved incidents"  subColor={pending > 0 ? 'text-amber-600' : 'text-muted-foreground'} />
      </div>

      {/* Charts row */}
      {byDriver.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Users className="h-5 w-5 text-primary" />By Driver</h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byDriver} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {byDriver.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TT} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />By Reason</h3>
            <div className="space-y-2.5">
              {byReason.slice(0, 5).map((r, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize">{r.name}</span>
                    <span className="font-bold">{r.value}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${byReason[0].value > 0 ? (r.value / byReason[0].value) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Trend */}
      {trend.length > 1 && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Damaged Bottles Trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left"  stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} tickFormatter={v => fmtMoneyShort(v).replace('KES ', '')} />
                <Tooltip {...TT} formatter={(v: number, name: string) => [name === 'Cost' ? fmtMoney(v) : v, name]} />
                <Legend />
                <Bar yAxisId="left" dataKey="bottles" name="Bottles" fill="#ef4444" radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="cost" name="Cost" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Filters + table */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as typeof filterStatus)}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(Object.keys(STATUS_CONFIG) as DamagedBottleRecord['status'][]).map(s => <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDriver} onValueChange={setFilterDriver}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All drivers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Drivers</SelectItem>
            {drivers.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <button onClick={handleExport} className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Download className="h-4 w-4" />Export CSV
        </button>
      </div>

      <Card className="overflow-hidden">
        <SectionHeader icon={<AlertTriangle className="h-5 w-5 text-red-500" />} title="Incident Log" badge={filtered.length} onRefresh={reload} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left px-5 py-2.5 font-semibold text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Driver</th>
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Reason</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Qty</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">Cost</th>
                <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-2.5 text-muted-foreground">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2.5 font-medium">{r.driverName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground capitalize">{r.reason}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-red-600">{r.quantity}</td>
                  <td className="px-4 py-2.5 text-right font-bold">{fmtMoney(r.totalCost)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge className={cn('text-[10px]', STATUS_CONFIG[r.status].color)}>
                      {STATUS_CONFIG[r.status].label}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

const ManagerReportsPage: React.FC = () => {
  const [period, setPeriod] = useState('30d');

  return (
    <ManagerLayout title="Reports" subtitle="Depot operations overview">

      <div className="flex items-center gap-3 mb-5">
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="mtd">This Month</SelectItem>
            <SelectItem value="ytd">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="operations" className="space-y-5">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="operations"   className="flex-1 flex items-center gap-1.5 whitespace-nowrap"><Truck className="h-4 w-4" /><span>Operations</span></TabsTrigger>
          <TabsTrigger value="orders"       className="flex-1 flex items-center gap-1.5 whitespace-nowrap"><ClipboardList className="h-4 w-4" /><span>Orders</span></TabsTrigger>
          <TabsTrigger value="sales"        className="flex-1 flex items-center gap-1.5 whitespace-nowrap"><TrendingUp className="h-4 w-4" /><span>Sales</span></TabsTrigger>
          <TabsTrigger value="driverperf"   className="flex-1 flex items-center gap-1.5 whitespace-nowrap"><UserCog className="h-4 w-4" /><span>Drivers</span></TabsTrigger>
          <TabsTrigger value="distribution" className="flex-1 flex items-center gap-1.5 whitespace-nowrap"><Repeat className="h-4 w-4" /><span>Distribution</span></TabsTrigger>
          <TabsTrigger value="damaged"      className="flex-1 flex items-center gap-1.5 whitespace-nowrap"><AlertTriangle className="h-4 w-4" /><span>Damaged</span></TabsTrigger>
        </TabsList>

        <TabsContent value="operations">   <OperationsTab  period={period} /></TabsContent>
        <TabsContent value="orders">       <OrdersTab /></TabsContent>
        <TabsContent value="sales">        <SalesTab       period={period} /></TabsContent>
        <TabsContent value="driverperf">   <DriverPerfTab  period={period} /></TabsContent>
        <TabsContent value="distribution"> <DistributionTab period={period} /></TabsContent>
        <TabsContent value="damaged">      <DamagedBottlesTab period={period} /></TabsContent>
      </Tabs>

    </ManagerLayout>
  );
};

export default ManagerReportsPage;
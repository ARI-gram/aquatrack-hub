// /src/pages/accounts/BottleAuditPage.tsx
/**
 * Bottle Audit Page
 * Role: Accountant / Client Admin
 * Route: /client/accounts/bottle-audit
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package, Truck, AlertTriangle, CheckCircle2,
  TrendingDown, RefreshCw, Loader2,
  ArrowDownCircle, ArrowUpCircle, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import axiosInstance from '@/api/axios.config';
import { AccountsLayout } from '@/pages/accounts/AccountsLayout';

interface DriverAuditRow {
  driver_id:          string;
  driver_name:        string;
  vehicle_number:     string;
  total_deliveries:   number;
  pending_deliveries: number;
  bottles_delivered:  number;
  bottles_to_collect: number;
  bottles_collected:  number;
  shortfall:          number;
  damages:            number;
}

interface AuditTotals {
  total_deliveries:   number;
  bottles_delivered:  number;
  bottles_to_collect: number;
  bottles_collected:  number;
  shortfall:          number;
  damages:            number;
}

interface AuditResponse {
  period:    string;
  date_from: string;
  date_to:   string;
  drivers:   DriverAuditRow[];
  totals:    AuditTotals;
}

type Period = 'week' | 'month' | 'year';

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });

const initials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const StatCard: React.FC<{
  label: string; value: string | number;
  icon: React.ReactNode; color: string; sub?: string;
}> = ({ label, value, icon, color, sub }) => (
  <Card className="p-4">
    <div className="flex items-start justify-between gap-3">
      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', color)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-right">
        <p className="text-2xl font-bold leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
    <p className="text-xs text-muted-foreground font-medium mt-3">{label}</p>
  </Card>
);

const RowSkeleton = () => (
  <tr className="border-b">
    {Array.from({ length: 10 }).map((_, i) => (
      <td key={i} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
    ))}
  </tr>
);

const BottleAuditPage: React.FC = () => {
  const [data,        setData]        = useState<AuditResponse | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [period,      setPeriod]      = useState<Period>('month');
  const [bottlePrice, setBottlePrice] = useState<string>('1500');

  const fetchAudit = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get<AuditResponse>('/drivers/bottle-audit/', {
        params: { period },
      });
      setData(res.data);
    } catch {
      toast.error('Failed to load bottle audit data.');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const price      = parseFloat(bottlePrice) || 0;
  const totals     = data?.totals;
  const estLoss    = totals ? totals.shortfall * price : 0;
  const returnRate = totals && totals.bottles_to_collect > 0
    ? Math.round((totals.bottles_collected / totals.bottles_to_collect) * 100)
    : 100;

  return (
    <AccountsLayout
      title="Bottle Audit"
      subtitle="Track bottle flow, returns, damages and losses per driver"
    >
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-12 space-y-6">

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2">
            {(['week', 'month', 'year'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-semibold border transition-colors',
                  period === p
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border',
                )}
              >
                {p === 'week' ? 'Last 7 Days' : p === 'month' ? 'Last 30 Days' : 'Last Year'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              Bottle price (KES)
            </Label>
            <Input
              type="number"
              value={bottlePrice}
              onChange={e => setBottlePrice(e.target.value)}
              className="h-9 w-28 text-sm"
              min="0"
            />
            <Button variant="outline" size="sm" className="h-9 gap-2 shrink-0" onClick={fetchAudit} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
        </div>

        {/* Date range */}
        {data && (
          <p className="text-xs text-muted-foreground">
            Showing data from <strong>{fmtDate(data.date_from)}</strong> to <strong>{fmtDate(data.date_to)}</strong>
          </p>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-10 w-10 rounded-xl mb-3" />
                <Skeleton className="h-7 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </Card>
            ))
          ) : totals ? (
            <>
              <StatCard label="Bottles Delivered" value={totals.bottles_delivered.toLocaleString()} icon={<ArrowUpCircle className="h-5 w-5 text-blue-600" />} color="bg-blue-50" sub={`${totals.total_deliveries} deliveries`} />
              <StatCard label="Empty Returns" value={totals.bottles_collected.toLocaleString()} icon={<ArrowDownCircle className="h-5 w-5 text-emerald-600" />} color="bg-emerald-50" sub={`${returnRate}% return rate`} />
              <StatCard label="Shortfall" value={totals.shortfall.toLocaleString()} icon={<TrendingDown className="h-5 w-5 text-red-600" />} color="bg-red-50" sub={`Est. KES ${estLoss.toLocaleString()} loss`} />
              <StatCard label="Damage Incidents" value={totals.damages.toLocaleString()} icon={<AlertTriangle className="h-5 w-5 text-amber-600" />} color="bg-amber-50" sub="flagged deliveries" />
            </>
          ) : null}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/20 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Driver Bottle Summary</p>
              <p className="text-xs text-muted-foreground">
                Per-driver breakdown · bottle price KES {parseFloat(bottlePrice || '0').toLocaleString()}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/10">
                  {['Driver','Vehicle','Deliveries','Pending','Delivered','Expected Returns','Actual Returns','Shortfall','Damages','Est. Loss (KES)'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)
                ) : !data || data.drivers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-muted-foreground text-sm">
                      No driver data found for this period.
                    </td>
                  </tr>
                ) : (
                  <>
                    {data.drivers.map((row, i) => {
                      const driverLoss   = row.shortfall * price;
                      const hasShortfall = row.shortfall > 0;
                      const hasDamages   = row.damages > 0;
                      return (
                        <tr key={row.driver_id} className={cn('border-b border-border/20 last:border-0 transition-colors hover:bg-muted/20', i % 2 === 0 ? 'bg-background' : 'bg-muted/[0.03]')}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-primary">{initials(row.driver_name)}</span>
                              </div>
                              <span className="font-medium whitespace-nowrap">{row.driver_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Truck className="h-3.5 w-3.5 shrink-0" />
                              <span className="text-xs font-mono">{row.vehicle_number}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span className="font-semibold">{row.total_deliveries}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {row.pending_deliveries > 0 ? (
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <span className="font-semibold text-amber-700">{row.pending_deliveries}</span>
                              </div>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3"><span className="font-semibold text-blue-700">{row.bottles_delivered}</span></td>
                          <td className="px-4 py-3"><span className="text-muted-foreground">{row.bottles_to_collect}</span></td>
                          <td className="px-4 py-3">
                            <span className={cn('font-semibold', row.bottles_collected >= row.bottles_to_collect ? 'text-emerald-700' : 'text-amber-700')}>
                              {row.bottles_collected}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {hasShortfall ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                                <TrendingDown className="h-3 w-3" />{row.shortfall}
                              </span>
                            ) : <span className="text-emerald-600 text-xs font-semibold">✓ None</span>}
                          </td>
                          <td className="px-4 py-3">
                            {hasDamages ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                                <AlertTriangle className="h-3 w-3" />{row.damages}
                              </span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {driverLoss > 0
                              ? <span className="font-bold text-red-700">KES {driverLoss.toLocaleString()}</span>
                              : <span className="text-emerald-600 text-xs font-semibold">KES 0</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                    {totals && (
                      <tr className="border-t-2 border-border bg-muted/20 font-black">
                        <td className="px-4 py-3 text-xs uppercase tracking-wide" colSpan={2}>Totals</td>
                        <td className="px-4 py-3">{totals.total_deliveries}</td>
                        <td className="px-4 py-3 text-muted-foreground">—</td>
                        <td className="px-4 py-3 text-blue-700">{totals.bottles_delivered}</td>
                        <td className="px-4 py-3">{totals.bottles_to_collect}</td>
                        <td className="px-4 py-3">{totals.bottles_collected}</td>
                        <td className="px-4 py-3 text-red-700">{totals.shortfall}</td>
                        <td className="px-4 py-3 text-amber-700">{totals.damages}</td>
                        <td className="px-4 py-3 text-red-700">KES {estLoss.toLocaleString()}</td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {[
            { color: 'bg-blue-500',    text: 'Bottles Delivered = total units sent out in completed deliveries' },
            { color: 'bg-emerald-500', text: 'Actual Returns = empty bottles physically collected back' },
            { color: 'bg-red-500',     text: 'Shortfall = Expected Returns − Actual Returns' },
            { color: 'bg-amber-500',   text: 'Damages = deliveries flagged with issues' },
          ].map(({ color, text }) => (
            <span key={text} className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full shrink-0', color)} />{text}
            </span>
          ))}
        </div>

      </div>
    </AccountsLayout>
  );
};

export default BottleAuditPage;
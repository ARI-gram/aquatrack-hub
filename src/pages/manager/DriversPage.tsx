/**
 * src/pages/manager/DriversPage.tsx
 * Site Manager – Drivers management page
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ManagerLayout } from '@/components/layout/ManagerLayout';
import { managerService, ManagerDriver } from '@/api/services/manager.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  Truck,
  UserCog,
  Clock,
  Phone,
  Mail,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  available: {
    label: 'Available',
    icon: UserCog,
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  },
  on_route: {
    label: 'On Route',
    icon: Truck,
    color: 'text-blue-600',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    badge: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  },
  off_duty: {
    label: 'Off Duty',
    icon: Clock,
    color: 'text-muted-foreground',
    bg: 'bg-muted/30',
    border: 'border-border/40',
    badge: 'bg-muted/30 text-muted-foreground border-border/40',
  },
} satisfies Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  badge: string;
}>;

type DriverStatus = keyof typeof STATUS_CFG;

// ── Summary pill ──────────────────────────────────────────────────────────────

const SummaryPill: React.FC<{
  label: string;
  count: number;
  icon: React.ElementType;
  color: string;
  bg: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, count, icon: Icon, color, bg, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'flex flex-col items-center gap-1.5 rounded-xl py-3 px-4 border transition-all',
      bg,
      active ? 'ring-2 ring-primary/40 border-primary/30' : 'border-border/40 hover:border-primary/20',
    )}
  >
    <Icon className={cn('h-4 w-4', color)} />
    <p className="text-xl font-bold text-foreground">{count}</p>
    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
  </button>
);

// ── Driver card ───────────────────────────────────────────────────────────────

const DriverCard: React.FC<{ driver: ManagerDriver }> = ({ driver }) => {
  const cfg = STATUS_CFG[driver.status as DriverStatus] ?? STATUS_CFG.off_duty;
  const Icon = cfg.icon;

  return (
    <div className={cn(
      'rounded-xl border p-4 bg-card transition-all hover:shadow-md hover:border-primary/30 group',
      'border-border/50',
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0', cfg.bg)}>
            <Icon className={cn('h-5 w-5', cfg.color)} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{driver.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{driver.vehicle_number}</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn('text-[10px] py-0 h-5 shrink-0 font-medium', cfg.badge)}
        >
          {cfg.label}
        </Badge>
      </div>

      {/* Contact */}
      <div className="mt-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" />
          <span>{driver.phone}</span>
        </div>
        {driver.email && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{driver.email}</span>
          </div>
        )}
      </div>

      {/* Today's stats */}
      <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-sm font-bold text-foreground">{driver.today_assigned}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Assigned</p>
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-600">{driver.today_completed}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Done</p>
        </div>
        <div>
          <p className={cn('text-sm font-bold', driver.today_failed > 0 ? 'text-destructive' : 'text-foreground')}>
            {driver.today_failed}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Failed</p>
        </div>
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export const DriversPage: React.FC = () => {
  const [drivers, setDrivers]         = useState<ManagerDriver[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<DriverStatus | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await managerService.getDrivers();
      setDrivers(data);
    } catch {
      setError('Failed to load drivers. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived counts ───────────────────────────────────────────────────────
  const counts = {
    all:       drivers.length,
    available: drivers.filter(d => d.status === 'available').length,
    on_route:  drivers.filter(d => d.status === 'on_route').length,
    off_duty:  drivers.filter(d => d.status === 'off_duty').length,
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = drivers.filter(d => {
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      d.name.toLowerCase().includes(q) ||
      d.phone.includes(q) ||
      d.vehicle_number.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <ManagerLayout title="Drivers" subtitle="Driver roster and daily performance">
      <div className="space-y-6 pb-8">

        {/* Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone or vehicle…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs self-start sm:self-auto"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Summary pills */}
        <div className="grid grid-cols-4 gap-3">
          <SummaryPill
            label="All"
            count={counts.all}
            icon={Users}
            color="text-primary"
            bg="bg-primary/10"
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          {(['available', 'on_route', 'off_duty'] as DriverStatus[]).map(s => (
            <SummaryPill
              key={s}
              label={STATUS_CFG[s].label}
              count={counts[s]}
              icon={STATUS_CFG[s].icon}
              color={STATUS_CFG[s].color}
              bg={STATUS_CFG[s].bg}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            />
          ))}
        </div>

        {/* Content */}
        {error ? (
          <Card className="border-destructive/30">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <XCircle className="h-8 w-8 text-destructive/60" />
              <p className="text-sm font-medium text-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={load} className="text-xs h-8">
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/40 bg-muted/20 h-44 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                <Users className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {search || statusFilter !== 'all' ? 'No drivers match your filters' : 'No drivers yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search || statusFilter !== 'all'
                    ? 'Try clearing the search or changing the status filter.'
                    : 'Drivers assigned to this site will appear here.'}
                </p>
              </div>
              {(search || statusFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 mt-1"
                  onClick={() => { setSearch(''); setStatusFilter('all'); }}
                >
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(driver => (
              <DriverCard key={driver.id} driver={driver} />
            ))}
          </div>
        )}

      </div>
    </ManagerLayout>
  );
};
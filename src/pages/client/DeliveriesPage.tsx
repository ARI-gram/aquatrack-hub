/**
 * Client Deliveries Page
 * /src/pages/client/DeliveriesPage.tsx
 *
 * Restyled to match OrdersPage layout:
 *   - Desktop table + mobile cards
 *   - Same stats strip, filter pills, search bar patterns
 *
 * New: Group By — customer name | date | none (default: latest scheduled first)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ManagerLayout }   from '@/components/layout/ManagerLayout';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Truck, MapPin, Clock, AlertCircle, Phone,
  Navigation, Search, RefreshCw, Loader2,
  InboxIcon, Car, Filter, MoreHorizontal,
  Layers, ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  deliveryService,
  type ClientDelivery,
  type DeliveryStats,
  type Driver,
} from '@/api/services/delivery.service';
import { MakeDeliveryDialog } from '@/components/dialogs/MakeDeliveryDialog';
import { toast }   from 'sonner';
import { format, isToday, isYesterday, isTomorrow } from 'date-fns';
import { cn }      from '@/lib/utils';

// ── Status config (mirrors OrdersPage) ───────────────────────────────────────

const STATUS_CFG: Record<string, {
  label: string; pill: string; dot: string; stripe: string;
}> = {
  ASSIGNED:    { label: 'Assigned',    pill: 'bg-indigo-50  text-indigo-700  border-indigo-200',  dot: 'bg-indigo-500',  stripe: 'bg-indigo-400'  },
  ACCEPTED:    { label: 'Accepted',    pill: 'bg-blue-50    text-blue-700    border-blue-200',    dot: 'bg-blue-500',    stripe: 'bg-blue-400'    },
  PICKED_UP:   { label: 'Picked Up',   pill: 'bg-cyan-50    text-cyan-700    border-cyan-200',    dot: 'bg-cyan-500',    stripe: 'bg-cyan-400'    },
  EN_ROUTE:    { label: 'En Route',    pill: 'bg-violet-50  text-violet-700  border-violet-200',  dot: 'bg-violet-500',  stripe: 'bg-violet-400'  },
  ARRIVED:     { label: 'Arrived',     pill: 'bg-teal-50    text-teal-700    border-teal-200',    dot: 'bg-teal-500',    stripe: 'bg-teal-400'    },
  IN_PROGRESS: { label: 'In Progress', pill: 'bg-amber-50   text-amber-700   border-amber-200',   dot: 'bg-amber-400',   stripe: 'bg-amber-300'   },
  COMPLETED:   { label: 'Completed',   pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', stripe: 'bg-emerald-400' },
  FAILED:      { label: 'Failed',      pill: 'bg-red-50     text-red-700     border-red-200',     dot: 'bg-red-400',     stripe: 'bg-red-300'     },
};

type GroupBy = 'none' | 'customer' | 'date';

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDeliveries(data: unknown): ClientDelivery[] {
  if (Array.isArray(data)) return data as ClientDelivery[];
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.data))    return d.data    as ClientDelivery[];
    if (Array.isArray(d.results)) return d.results as ClientDelivery[];
  }
  return [];
}

function friendlyDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isToday(d))     return 'Today';
    if (isTomorrow(d))  return 'Tomorrow';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEE, d MMM yyyy');
  } catch { return dateStr; }
}

function getScheduledDate(d: ClientDelivery): string {
  return (d as ClientDelivery & { scheduled_date?: string }).scheduled_date ?? '';
}

function sortByScheduledDateDesc(a: ClientDelivery, b: ClientDelivery): number {
  return getScheduledDate(b).localeCompare(getScheduledDate(a));
}

// ── StatusPill ────────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({
  status, size = 'md',
}) => {
  const cfg = STATUS_CFG[status];
  if (!cfg) return <span className="text-xs border rounded-full px-2 py-0.5">{status}</span>;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 border rounded-full font-semibold',
      cfg.pill,
      size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  );
};

// ── Mobile Delivery Card ──────────────────────────────────────────────────────

const DeliveryCard: React.FC<{ delivery: ClientDelivery }> = ({ delivery }) => {
  const cfg        = STATUS_CFG[delivery.status];
  const scheduled  = getScheduledDate(delivery);
  const addressExt = delivery as ClientDelivery & { address_label?: string };

  return (
    <div className="bg-background border rounded-2xl overflow-hidden transition-shadow hover:shadow-md">
      <div className={cn('h-[3px] w-full', cfg?.stripe ?? 'bg-border')} />
      <div className="px-4 pt-3 pb-4 space-y-3">

        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono font-bold text-sm tracking-tight">{delivery.order_number}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {delivery.customer_name && (
                <span className="font-medium text-foreground">{delivery.customer_name} · </span>
              )}
              {scheduled ? friendlyDate(scheduled) : '—'}
            </p>
          </div>
          <StatusPill status={delivery.status} size="sm" />
        </div>

        {addressExt.address_label && (
          <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground truncate">{addressExt.address_label}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {delivery.driver_info ? (
              <span className="flex items-center gap-1">
                <Truck className="h-3 w-3 shrink-0" />
                {delivery.driver_info.name}
                {delivery.driver_info.vehicle_number && ` · ${delivery.driver_info.vehicle_number}`}
              </span>
            ) : (
              <span className="flex items-center gap-1 italic">
                <Truck className="h-3 w-3 shrink-0" /> Unassigned
              </span>
            )}
            {delivery.scheduled_time_slot && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" />
                {delivery.scheduled_time_slot}
              </span>
            )}
          </div>
          {delivery.has_issues && (
            <span className="inline-flex items-center gap-1 text-[10px] text-red-600 font-semibold bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
              <AlertCircle className="h-3 w-3" /> Issues
            </span>
          )}
        </div>

      </div>
    </div>
  );
};

// ── Desktop Table Row ─────────────────────────────────────────────────────────

const TableRow: React.FC<{ delivery: ClientDelivery; isEven: boolean }> = ({
  delivery, isEven,
}) => {
  const cfg        = STATUS_CFG[delivery.status];
  const scheduled  = getScheduledDate(delivery);
  const addressExt = delivery as ClientDelivery & { address_label?: string };

  return (
    <tr className={cn(
      'border-b last:border-0 transition-colors hover:bg-muted/40',
      isEven ? 'bg-muted/10' : 'bg-background',
    )}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg?.dot ?? 'bg-border')} />
          <span className="font-mono font-semibold text-sm">{delivery.order_number}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium">{delivery.customer_name ?? '—'}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm">{scheduled ? friendlyDate(scheduled) : '—'}</p>
        {delivery.scheduled_time_slot && (
          <p className="text-xs text-muted-foreground">{delivery.scheduled_time_slot}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <p className="text-sm truncate max-w-[160px]">{addressExt.address_label ?? '—'}</p>
      </td>
      <td className="px-4 py-3">
        {delivery.driver_info ? (
          <div>
            <p className="text-sm font-medium">{delivery.driver_info.name}</p>
            {delivery.driver_info.vehicle_number && (
              <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Car className="h-2.5 w-2.5" />{delivery.driver_info.vehicle_number}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Unassigned</p>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={delivery.status} size="sm" />
      </td>
      <td className="px-4 py-3">
        {delivery.has_issues ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-red-600 font-semibold bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
            <AlertCircle className="h-3 w-3" /> Issues
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {delivery.driver_info?.phone && (
              <DropdownMenuItem onClick={() => window.open(`tel:${delivery.driver_info!.phone}`)}>
                <Phone className="h-4 w-4 mr-2" /> Call Driver
              </DropdownMenuItem>
            )}
            <DropdownMenuItem>
              <Navigation className="h-4 w-4 mr-2" /> Navigate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
};

// ── Group header (desktop) ────────────────────────────────────────────────────

const GroupHeader: React.FC<{
  label: string; count: number; collapsed: boolean;
  onToggle: () => void; colSpan: number;
}> = ({ label, count, collapsed, onToggle, colSpan }) => (
  <tr
    className="bg-muted/40 border-b cursor-pointer select-none hover:bg-muted/60 transition-colors"
    onClick={onToggle}
  >
    <td colSpan={colSpan} className="px-4 py-2.5">
      <div className="flex items-center gap-2">
        {collapsed
          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown  className="h-3.5 w-3.5 text-muted-foreground" />
        }
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">({count})</span>
      </div>
    </td>
  </tr>
);

// ── Group header (mobile) ─────────────────────────────────────────────────────

const MobileGroupHeader: React.FC<{
  label: string; count: number; collapsed: boolean; onToggle: () => void;
}> = ({ label, count, collapsed, onToggle }) => (
  <button
    className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-xl border text-left hover:bg-muted/60 transition-colors"
    onClick={onToggle}
  >
    {collapsed
      ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      : <ChevronDown  className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    }
    <span className="text-xs font-semibold text-foreground flex-1">{label}</span>
    <span className="text-[10px] text-muted-foreground">{count} deliveries</span>
  </button>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

interface DeliveriesPageProps {
  layout?: 'dashboard' | 'manager';
}

export const DeliveriesPage: React.FC<DeliveriesPageProps> = ({ layout = 'dashboard' }) => {
  const [deliveries,    setDeliveries]    = useState<ClientDelivery[]>([]);
  const [stats,         setStats]         = useState<DeliveryStats | null>(null);
  const [drivers,       setDrivers]       = useState<Driver[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [driverFilter,  setDriverFilter]  = useState('all');
  const [groupBy,       setGroupBy]       = useState<GroupBy>('none');
  const [collapsed,     setCollapsed]     = useState<Set<string>>(new Set());
  const [makeDeliveryOpen, setMakeDeliveryOpen] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rawDeliveries, statsData, driversData] = await Promise.all([
        deliveryService.getClientDeliveries({
          status:    statusFilter !== 'all' ? statusFilter : undefined,
          driver_id: driverFilter !== 'all' ? driverFilter : undefined,
          search:    searchQuery  || undefined,
        }),
        deliveryService.getDeliveryStats(),
        deliveryService.getAvailableDrivers(),
      ]);
      setDeliveries(extractDeliveries(rawDeliveries));
      setStats(statsData);
      setDrivers(driversData);
    } catch {
      toast.error('Failed to load delivery data.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, driverFilter, searchQuery]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filtered + sorted list ────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return deliveries
      .filter(d =>
        d.order_number.toLowerCase().includes(q) ||
        (d.customer_name ?? '').toLowerCase().includes(q),
      )
      .sort(sortByScheduledDateDesc);  // latest scheduled first by default
  }, [deliveries, searchQuery]);

  // ── Status counts ─────────────────────────────────────────────────────────

  const statusCounts = useMemo(() =>
    deliveries.reduce<Record<string, number>>((acc, d) => {
      acc[d.status] = (acc[d.status] ?? 0) + 1;
      return acc;
    }, {}),
  [deliveries]);

  // ── Grouped data ──────────────────────────────────────────────────────────

  const grouped = useMemo((): Array<{
    key: string; label: string; items: ClientDelivery[];
  }> => {
    if (groupBy === 'none') return [{ key: '__all', label: '', items: filtered }];

    const map = new Map<string, ClientDelivery[]>();
    for (const d of filtered) {
      const key = groupBy === 'customer'
        ? (d.customer_name ?? 'Unknown Customer')
        : getScheduledDate(d) || 'No Date';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }

    const entries = Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: groupBy === 'date' ? friendlyDate(key) : key,
      items,
    }));

    // date groups: newest first; customer groups: A-Z
    if (groupBy === 'date') entries.sort((a, b) => b.key.localeCompare(a.key));
    else                    entries.sort((a, b) => a.key.localeCompare(b.key));

    return entries;
  }, [filtered, groupBy]);

  const toggleGroup = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  // ── Layout wrapper ────────────────────────────────────────────────────────

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    layout === 'manager'
      ? <ManagerLayout title="Deliveries" subtitle="Track and manage all active delivery runs">{children}</ManagerLayout>
      : <DashboardLayout title="Deliveries" subtitle="Track and manage all active delivery runs">{children}</DashboardLayout>;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Wrapper>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex-1" />
        <Button
          className="gap-2 h-10 rounded-xl font-semibold shadow-sm"
          onClick={() => setMakeDeliveryOpen(true)}
        >
          <Truck className="h-4 w-4" />
          Make Delivery
        </Button>
      </div>

      {/* ── Stats strip ── */}
      {stats && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-0.5 -mx-1 px-1">
          {[
            { label: "Today's Total", val: stats.total_today,                            cls: 'bg-muted/60 text-foreground border-border'         },
            { label: 'Completed',     val: stats.completed_today,                        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { label: 'In Progress',   val: stats.in_progress,                            cls: 'bg-blue-50 text-blue-700 border-blue-200'          },
            { label: 'Active Drivers',val: stats.active_drivers,                         cls: 'bg-violet-50 text-violet-700 border-violet-200'    },
            { label: 'Revenue Today', val: `KES ${stats.revenue_today.toLocaleString()}`, cls: 'bg-amber-50 text-amber-700 border-amber-200'      },
          ].map(({ label, val, cls }) => (
            <div
              key={label}
              className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold shrink-0', cls)}
            >
              <span className="text-base font-bold leading-none">{val}</span>
              <span className="opacity-60">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Status filter pills ── */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setStatusFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
            statusFilter === 'all'
              ? 'bg-foreground text-background border-foreground'
              : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border',
          )}
        >
          All ({deliveries.length})
        </button>
        {(['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
              statusFilter === s
                ? 'bg-foreground text-background border-foreground'
                : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border',
            )}
          >
            {STATUS_CFG[s]?.label ?? s} ({statusCounts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* ── Search + driver filter + group by + refresh ── */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by order number or customer…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchData()}
            className="pl-9 h-10 rounded-xl bg-muted/40 border-transparent focus:border-input"
          />
        </div>

        <Select value={driverFilter} onValueChange={setDriverFilter}>
          <SelectTrigger className="h-10 rounded-xl bg-muted/40 border-transparent text-sm w-full sm:w-44">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All drivers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Drivers</SelectItem>
            {drivers.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={groupBy}
          onValueChange={v => { setGroupBy(v as GroupBy); setCollapsed(new Set()); }}
        >
          <SelectTrigger className="h-10 rounded-xl bg-muted/40 border-transparent text-sm w-full sm:w-48">
            <Layers className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No grouping</SelectItem>
            <SelectItem value="date">Group by Date</SelectItem>
            <SelectItem value="customer">Group by Customer</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="h-10 rounded-xl gap-2 shrink-0"
          onClick={fetchData}
          disabled={isLoading}
        >
          {isLoading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RefreshCw className="h-4 w-4" />
          }
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin text-primary/50" />
          <p className="text-sm">Loading deliveries…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
            <InboxIcon className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="font-semibold mb-1">
            {deliveries.length === 0 ? 'No deliveries yet' : 'No results found'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {deliveries.length === 0
              ? 'Use Make Delivery to assign orders to drivers.'
              : 'Try adjusting your search or filters.'}
          </p>
          {deliveries.length === 0 && (
            <Button
              size="sm"
              className="gap-2 rounded-xl"
              onClick={() => setMakeDeliveryOpen(true)}
            >
              <Truck className="h-3.5 w-3.5" /> Make Delivery
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-2xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {['Order', 'Customer', 'Scheduled', 'Address', 'Driver', 'Status', 'Issues', ''].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map(group => (
                  <React.Fragment key={group.key}>
                    {groupBy !== 'none' && (
                      <GroupHeader
                        label={group.label}
                        count={group.items.length}
                        collapsed={collapsed.has(group.key)}
                        onToggle={() => toggleGroup(group.key)}
                        colSpan={8}
                      />
                    )}
                    {!collapsed.has(group.key) &&
                      group.items.map((delivery, i) => (
                        <TableRow
                          key={delivery.id}
                          delivery={delivery}
                          isEven={i % 2 === 0}
                        />
                      ))
                    }
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {grouped.map(group => (
              <React.Fragment key={group.key}>
                {groupBy !== 'none' && (
                  <MobileGroupHeader
                    label={group.label}
                    count={group.items.length}
                    collapsed={collapsed.has(group.key)}
                    onToggle={() => toggleGroup(group.key)}
                  />
                )}
                {!collapsed.has(group.key) && (
                  <div className={cn(
                    'space-y-3',
                    groupBy !== 'none' && 'pl-2 border-l-2 border-muted ml-1',
                  )}>
                    {group.items.map(delivery => (
                      <DeliveryCard key={delivery.id} delivery={delivery} />
                    ))}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-right mt-3">
            {filtered.length} {filtered.length === 1 ? 'delivery' : 'deliveries'}
          </p>
        </>
      )}

      {/* Make Delivery dialog */}
      <MakeDeliveryDialog
        open={makeDeliveryOpen}
        onClose={() => setMakeDeliveryOpen(false)}
        onDeliveryMade={() => {
          fetchData();
          setMakeDeliveryOpen(false);
        }}
      />

    </Wrapper>
  );
};
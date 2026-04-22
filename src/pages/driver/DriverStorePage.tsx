/**
 * src/pages/driver/DriverStorePage.tsx
 * Mobile-first van stock page
 *
 * UPDATE: "Request Top-up" button added to header bar and SummaryBanner
 * shortfall section. Opens StockRequestDialog instead of showing plain text.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DriverLayout } from '@/components/layout/DriverLayout';
import {
  Droplets, Package, Loader2, RefreshCw,
  AlertTriangle, CheckCircle2,
  ChevronDown, Clock, Layers, ArrowRightLeft,
  Truck, TrendingDown, PackagePlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import {
  driverStoreService,
  type DriverBottleStock,
  type DriverConsumableStock,
  type DeliveryRequirement,
  type DriverStockHistory,
} from '@/api/services/driver-store.service';
import { ProductImage } from '@/components/dialogs/shared';
import { StockRequestDialog } from '@/components/dialogs/StockRequestDialog';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const dateLabel = (s: string) => {
  const d = new Date(s);
  if (isToday(d))     return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd MMM yyyy');
};

function groupHistory(items: DriverStockHistory[]) {
  const g: Record<string, DriverStockHistory[]> = {};
  for (const item of items) {
    const k = dateLabel(item.movement_date);
    if (!g[k]) g[k] = [];
    g[k].push(item);
  }
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stock pill
// ─────────────────────────────────────────────────────────────────────────────

const StockPill: React.FC<{ have: number; need: number }> = ({ have, need }) => {
  if (need === 0) return null;
  const diff = have - need;
  if (diff >= 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full px-2 py-0.5">
      <CheckCircle2 className="h-2.5 w-2.5" />{diff === 0 ? 'Exact' : `+${diff}`}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20 rounded-full px-2 py-0.5">
      <AlertTriangle className="h-2.5 w-2.5" />Short {Math.abs(diff)}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Movement config
// ─────────────────────────────────────────────────────────────────────────────

const MV_CFG: Record<string, { bg: string; icon: React.ReactNode; label: string; qty: string }> = {
  DISTRIBUTE:    { bg: 'bg-violet-500/10 text-violet-600', icon: <Truck          className="h-3.5 w-3.5" />, label: 'Loaded onto van',  qty: 'text-violet-600' },
  DIRECT_SALE:   { bg: 'bg-amber-500/10  text-amber-600',  icon: <Truck          className="h-3.5 w-3.5" />, label: 'Direct sale',     qty: 'text-amber-600'  },
  DELIVERY_USE:  { bg: 'bg-blue-500/10   text-blue-600',   icon: <ArrowRightLeft className="h-3.5 w-3.5" />, label: 'Delivery use',   qty: 'text-blue-600'   },
  RECEIVE_EMPTY: { bg: 'bg-sky-500/10    text-sky-600',    icon: <TrendingDown   className="h-3.5 w-3.5" />, label: 'Returned empties', qty: 'text-sky-600'  },
};

// ─────────────────────────────────────────────────────────────────────────────
// History row
// ─────────────────────────────────────────────────────────────────────────────

const HistoryRow: React.FC<{ item: DriverStockHistory }> = ({ item }) => {
  const cfg = MV_CFG[item.movement_type] ?? {
    bg: 'bg-muted text-muted-foreground', icon: <Clock className="h-3.5 w-3.5" />,
    label: item.movement_type, qty: 'text-foreground',
  };
  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-border/30 last:border-0">
      <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', cfg.bg)}>
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{item.product_name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {cfg.label}
          {item.notes ? ` · ${item.notes}` : ''}
          {' · '}{format(new Date(item.movement_date), 'HH:mm')}
        </p>
      </div>
      <span className={cn('text-sm font-bold tabular-nums shrink-0', cfg.qty)}>×{item.quantity}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Bottle card
// ─────────────────────────────────────────────────────────────────────────────

const BottleCard: React.FC<{
  stock:        DriverBottleStock;
  requirement?: DeliveryRequirement;
}> = ({ stock, requirement }) => {
  const need       = requirement?.bottles_needed  ?? 0;
  const collectExp = requirement?.bottles_collect ?? 0;
  const { full, empty, damaged, missing } = stock.balance;
  const status = full <= 0 ? 'out' : full <= 5 ? 'low' : 'ok';

  return (
    <div className={cn(
      'rounded-2xl border bg-card overflow-hidden',
      status === 'out' ? 'border-destructive/40' :
      status === 'low' ? 'border-amber-400/40'   : 'border-border/60',
    )}>
      <div className={cn(
        'h-1 w-full',
        status === 'out' ? 'bg-destructive' : status === 'low' ? 'bg-amber-400' : 'bg-emerald-500',
      )} />
      <div className="p-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {stock.product_image
            ? <ProductImage url={stock.product_image} name={stock.product_name} />
            : (
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <Droplets className="h-6 w-6" />
              </div>
            )
          }
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-tight truncate">{stock.product_name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Returnable</span>
              <StockPill have={full} need={need} />
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={cn(
              'text-3xl font-black tabular-nums',
              status === 'out' ? 'text-destructive' : status === 'low' ? 'text-amber-600' : 'text-emerald-600',
            )}>{full}</p>
            <p className="text-[10px] text-muted-foreground">full</p>
          </div>
        </div>

        {/* Balance grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Empty',   val: empty,   color: 'text-amber-600',    bg: 'bg-amber-500/8'    },
            { label: 'Damaged', val: damaged,  color: 'text-orange-600',  bg: 'bg-orange-500/8'   },
            { label: 'Missing', val: missing,  color: 'text-destructive', bg: 'bg-destructive/5'  },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl px-3 py-3 text-center', s.bg)}>
              <p className={cn('text-xl font-black tabular-nums', s.color)}>{s.val}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Route requirement */}
        {need > 0 && (
          <div className={cn(
            'rounded-xl px-3.5 py-3 border text-xs',
            full < need
              ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300',
          )}>
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <Truck className="h-3 w-3 shrink-0" />Today's route needs
              </span>
              <div className="flex items-center gap-3 text-[11px]">
                <span>Deliver <strong>{need}</strong></span>
                {collectExp > 0 && <span>Collect <strong>{collectExp}</strong></span>}
              </div>
            </div>
            {full < need && (
              <p className="font-bold mt-1.5">⚠ You're short {need - full} bottles</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Consumable card
// ─────────────────────────────────────────────────────────────────────────────

const ConsumableCard: React.FC<{
  stock:        DriverConsumableStock;
  requirement?: DeliveryRequirement;
}> = ({ stock, requirement }) => {
  const need   = requirement?.units_needed ?? 0;
  const qty    = stock.balance.in_stock;
  const status = qty <= 0 ? 'out' : qty <= 10 ? 'low' : 'ok';
  const pct    = Math.min(100, (qty / Math.max(50, qty + 10)) * 100);

  return (
    <div className={cn(
      'rounded-2xl border bg-card overflow-hidden',
      status === 'out' ? 'border-destructive/40' :
      status === 'low' ? 'border-amber-400/40'   : 'border-border/60',
    )}>
      <div className={cn(
        'h-1 w-full',
        status === 'out' ? 'bg-destructive' : status === 'low' ? 'bg-amber-400' : 'bg-sky-500',
      )} />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          {stock.product_image
            ? <ProductImage url={stock.product_image} name={stock.product_name} />
            : (
              <div className="h-12 w-12 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
                <Package className="h-6 w-6" />
              </div>
            )
          }
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-tight truncate">{stock.product_name}</p>
            <div className="flex items-center gap-2 mt-1">
              {stock.unit && (
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {stock.unit}
                </span>
              )}
              <StockPill have={qty} need={need} />
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={cn(
              'text-3xl font-black tabular-nums',
              status === 'out' ? 'text-destructive' : status === 'low' ? 'text-amber-600' : 'text-sky-600',
            )}>{qty}</p>
            <p className="text-[10px] text-muted-foreground">in stock</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-3">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              status === 'out' ? 'bg-destructive' : status === 'low' ? 'bg-amber-500' : 'bg-sky-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        {need > 0 && (
          <div className={cn(
            'rounded-xl px-3.5 py-3 border text-xs',
            qty < need
              ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300',
          )}>
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <Truck className="h-3 w-3 shrink-0" />Today's route needs
              </span>
              <span><strong>{need}</strong> units</span>
            </div>
            {qty < need && <p className="font-bold mt-1.5">⚠ Short by {need - qty}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Summary banner
// ─────────────────────────────────────────────────────────────────────────────

const SummaryBanner: React.FC<{
  bottles:      DriverBottleStock[];
  consumables:  DriverConsumableStock[];
  requirements: DeliveryRequirement[];
  onRequestTopUp: () => void;
}> = ({ bottles, consumables, requirements, onRequestTopUp }) => {
  const issues = useMemo(() => {
    const out: string[] = [];
    for (const req of requirements) {
      if (req.product_type === 'bottle') {
        const b = bottles.find(x => x.product_id === req.product_id);
        if (b && b.balance.full < req.bottles_needed)
          out.push(`${req.product_name} — need ${req.bottles_needed - b.balance.full} more`);
      } else {
        const c = consumables.find(x => x.product_id === req.product_id);
        if (c && c.balance.in_stock < req.units_needed)
          out.push(`${req.product_name} — need ${req.units_needed - c.balance.in_stock} more`);
      }
    }
    return out;
  }, [bottles, consumables, requirements]);

  if (requirements.length === 0) return null;

  if (issues.length === 0) return (
    <div className="flex items-center gap-3 px-4 py-4 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl mb-5">
      <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
      <div>
        <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Van fully stocked ✓</p>
        <p className="text-xs text-emerald-700/80 dark:text-emerald-400 mt-0.5">
          Enough for all today's deliveries.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex items-start gap-3 px-4 py-4 bg-red-500/5 border border-red-500/20 rounded-2xl mb-5">
      <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-red-800 dark:text-red-300">Stock shortfall</p>
        <ul className="mt-1.5 space-y-1">
          {issues.map((d, i) => (
            <li key={i} className="text-xs text-red-700 dark:text-red-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />{d}
            </li>
          ))}
        </ul>
        <button
          onClick={onRequestTopUp}
          className="mt-2.5 flex items-center gap-1.5 text-[11px] font-bold text-red-700 dark:text-red-300 underline underline-offset-2 hover:no-underline transition-all"
        >
          <PackagePlus className="h-3.5 w-3.5 shrink-0" />
          Request a top-up →
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

const DriverStorePage: React.FC = () => {
  const [bottles,      setBottles]      = useState<DriverBottleStock[]>([]);
  const [consumables,  setConsumables]  = useState<DriverConsumableStock[]>([]);
  const [requirements, setRequirements] = useState<DeliveryRequirement[]>([]);
  const [history,      setHistory]      = useState<DriverStockHistory[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [activeTab,    setActiveTab]    = useState<'bottles' | 'consumables'>('bottles');
  const [histOpen,     setHistOpen]     = useState(false);
  const [topUpOpen,    setTopUpOpen]    = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [b, c, req, hist] = await Promise.all([
        driverStoreService.getBottleStock(),
        driverStoreService.getConsumableStock(),
        driverStoreService.getRequirements(),
        driverStoreService.getHistory(),
      ]);
      setBottles(b);
      setConsumables(c);
      setRequirements(req);
      setHistory(hist);
    } catch {
      toast.error('Failed to load van stock');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reqMap = useMemo(() => {
    const m: Record<string, DeliveryRequirement> = {};
    for (const r of requirements) m[r.product_id] = r;
    return m;
  }, [requirements]);

  const grouped = useMemo(() => groupHistory(history), [history]);

  const totalDeficits = requirements.filter(req => {
    if (req.product_type === 'bottle') {
      const b = bottles.find(x => x.product_id === req.product_id);
      return b && b.balance.full < req.bottles_needed;
    }
    const c = consumables.find(x => x.product_id === req.product_id);
    return c && c.balance.in_stock < req.units_needed;
  }).length;

  if (isLoading) return (
    <DriverLayout title="Van Stock" subtitle="Loading…">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </DriverLayout>
  );

  const totalProducts = bottles.length + consumables.length;

  return (
    <DriverLayout title="Van Stock" subtitle="Your loaded inventory">

      {/* Header bar — product count + shortfall badge + request top-up + refresh */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            {totalProducts} product{totalProducts !== 1 ? 's' : ''}
          </span>
          {totalDeficits > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20 rounded-full px-2.5 py-1">
              <AlertTriangle className="h-2.5 w-2.5" />
              {totalDeficits} shortfall{totalDeficits !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Request Top-up button in header */}
          <button
            onClick={() => setTopUpOpen(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors active:scale-[0.98]"
          >
            <PackagePlus className="h-4 w-4" />
            Request Top-up
          </button>
          <button
            onClick={load}
            className="h-10 w-10 flex items-center justify-center rounded-xl border border-border/60 bg-muted/30 hover:bg-muted transition-colors active:scale-[0.97]"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Summary banner — now includes "Request a top-up" link in shortfall state */}
      <SummaryBanner
        bottles={bottles}
        consumables={consumables}
        requirements={requirements}
        onRequestTopUp={() => setTopUpOpen(true)}
      />

      {/* Stock tabs */}
      <div className="flex gap-1.5 mb-4 bg-muted/40 p-1 rounded-2xl">
        {([
          { key: 'bottles'     as const, label: 'Bottles',     count: bottles.length,     icon: <Droplets className="h-3.5 w-3.5" /> },
          { key: 'consumables' as const, label: 'Consumables', count: consumables.length, icon: <Package  className="h-3.5 w-3.5" /> },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all',
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon}{tab.label}
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-black min-w-[18px] text-center',
              activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Stock cards */}
      {activeTab === 'bottles' ? (
        bottles.length === 0 ? (
          <div className="text-center py-16 border border-dashed rounded-2xl mb-4">
            <Droplets className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="font-semibold text-muted-foreground">No bottles on your van</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Ask the store to distribute stock to you.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-5">
            {bottles.map(b => (
              <BottleCard key={b.product_id} stock={b} requirement={reqMap[b.product_id]} />
            ))}
          </div>
        )
      ) : (
        consumables.length === 0 ? (
          <div className="text-center py-16 border border-dashed rounded-2xl mb-4">
            <Package className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="font-semibold text-muted-foreground">No consumables on your van</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Ask the store to distribute stock to you.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-5">
            {consumables.map(c => (
              <ConsumableCard key={c.product_id} stock={c} requirement={reqMap[c.product_id]} />
            ))}
          </div>
        )
      )}

      {/* Stock movement history — collapsible */}
      {history.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setHistOpen(o => !o)}
            className="w-full flex items-center gap-3 px-4 py-4 bg-muted/30 rounded-2xl border border-border/40 mb-2 hover:bg-muted/50 transition-colors active:scale-[0.98]"
          >
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground flex-1 text-left">Stock Movements</span>
            <span className="text-xs text-muted-foreground font-semibold">{history.length}</span>
            <ChevronDown className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              histOpen && 'rotate-180',
            )} />
          </button>

          {histOpen && (
            <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
              {Object.entries(grouped).map(([date, items]) => (
                <div key={date}>
                  <div className="px-4 py-2.5 bg-muted/30 border-b border-border/30">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {date}
                    </p>
                  </div>
                  <div className="px-4">
                    {items.map(item => <HistoryRow key={item.id} item={item} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stock request dialog — auto-populates with low/out items */}
      <StockRequestDialog
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
      />

    </DriverLayout>
  );
};

export default DriverStorePage;
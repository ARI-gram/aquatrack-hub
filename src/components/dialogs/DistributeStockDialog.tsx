/**
 * DistributeStockDialog — multi-product, mobile-first
 * src/components/dialogs/DistributeStockDialog.tsx
 *
 * Allows distributing multiple products to a single vehicle in one action.
 * Fires parallel POST /api/products/distribute/ requests (one per product)
 * since the backend handles one product per request.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Badge }   from '@/components/ui/badge';
import {
  Loader2, Truck, Package, ArrowRightLeft,
  AlertTriangle, CheckCircle2, Minus, Plus,
  Search, Droplets, ShoppingCart, X,
} from 'lucide-react';
import { useToast }            from '@/hooks/use-toast';
import { distributionService } from '@/api/services/products.service';
import { employeeService }     from '@/api/services/employee.service';
import type { Product, DistributeStockResponse } from '@/types/products.types';
import type { Employee } from '@/types/employee.types';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CartItem {
  product:  Product;
  quantity: number;
}

interface Props {
  open:          boolean;
  products:      Product[];
  preselected?:  string;
  onClose:       () => void;
  onDistributed: (results: Array<{ res: DistributeStockResponse; productId: string }>) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DistributeStockDialog: React.FC<Props> = ({
  open, products, preselected, onClose, onDistributed,
}) => {
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [isLoading,       setIsLoading]       = useState(false);
  const [drivers,         setDrivers]         = useState<Employee[]>([]);
  const [loadingDrivers,  setLoadingDrivers]  = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [notes,           setNotes]           = useState('');
  const [cart,            setCart]            = useState<CartItem[]>([]);
  const [productSearch,   setProductSearch]   = useState('');

  // ── Load drivers on open ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setLoadingDrivers(true);
    employeeService
      .getEmployees({ role: 'driver', status: 'active' })
      .then(d => setDrivers(d.data.filter((e: Employee) => e.numberPlate)))
      .catch(() => toast({ title: 'Warning', description: 'Could not load vehicles.', variant: 'destructive' }))
      .finally(() => setLoadingDrivers(false));
  }, [open, toast]);

  // ── Reset on open/close ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setCart([]);
      setSelectedVehicle('');
      setNotes('');
      setProductSearch('');
      return;
    }
    // Preselect a product if provided
    if (preselected) {
      const p = products.find(pr => pr.id === preselected);
      if (p && p.status === 'ACTIVE' && p.stock_available > 0) {
        setCart([{ product: p, quantity: 1 }]);
      }
    }
  }, [open, preselected, products]);

  // ── Cart helpers ───────────────────────────────────────────────────────────
  const cartQty = (productId: string) =>
    cart.find(c => c.product.id === productId)?.quantity ?? 0;

  const updateCart = (product: Product, delta: number) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (!existing) {
        if (delta > 0) return [...prev, { product, quantity: 1 }];
        return prev;
      }
      const newQty = existing.quantity + delta;
      if (newQty <= 0) return prev.filter(c => c.product.id !== product.id);
      const max = product.stock_available;
      return prev.map(c =>
        c.product.id === product.id
          ? { ...c, quantity: Math.min(newQty, max) }
          : c,
      );
    });
  };

  const removeFromCart = (productId: string) =>
    setCart(prev => prev.filter(c => c.product.id !== productId));

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeProducts = useMemo(
    () => products.filter(p => p.status === 'ACTIVE'),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return activeProducts.filter(p => p.name.toLowerCase().includes(q));
  }, [activeProducts, productSearch]);

  const totalItems    = cart.reduce((n, c) => n + c.quantity, 0);
  const hasOverStock  = cart.some(c => c.quantity > c.product.stock_available);
  const canSubmit     = cart.length > 0 && selectedVehicle && !hasOverStock && !isLoading;

  // ── Submit — parallel requests ─────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    try {
      const results = await Promise.all(
        cart.map(item =>
          distributionService
            .distribute({
              product:        item.product.id,
              vehicle_number: selectedVehicle,
              quantity:       item.quantity,
              notes,
            })
            .then(res => ({ res, productId: item.product.id })),
        ),
      );

      onDistributed(results);

      const driver = drivers.find(d => d.numberPlate === selectedVehicle);
      toast({
        title:       'Stock distributed ✓',
        description: `${cart.length} product${cart.length > 1 ? 's' : ''} → ${selectedVehicle}${driver ? ` (${driver.fullName})` : ''}`,
      });
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'One or more distributions failed. Please check stock levels.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(
        'p-0 gap-0 flex flex-col overflow-hidden border-0 shadow-2xl',
        'fixed inset-x-0 bottom-0 top-auto translate-x-0 translate-y-0',
        'max-h-[92dvh] rounded-t-3xl rounded-b-none',
        'md:relative md:inset-auto md:rounded-2xl md:max-w-lg md:max-h-[88vh]',
      )}>

        {/* Pull handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Header */}
        <DialogHeader className="px-5 pt-2 pb-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold">Distribute to Van</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Move warehouse stock onto a delivery vehicle
              </DialogDescription>
            </div>
            {cart.length > 0 && (
              <Badge variant="outline" className="shrink-0 text-xs gap-1.5">
                <ShoppingCart className="h-3 w-3" />
                {totalItems} unit{totalItems !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 overscroll-contain px-5 py-5 space-y-6">

          {/* ── Section: Vehicle ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Truck className="h-3.5 w-3.5" /> Vehicle
            </p>
            {loadingDrivers ? (
              <div className="flex items-center gap-2 h-12 px-4 rounded-xl border border-border/60 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading vehicles…
              </div>
            ) : drivers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 px-4 py-5 text-center text-sm text-muted-foreground space-y-0.5">
                <p className="font-medium">No vehicles found</p>
                <p className="text-xs">Assign a number plate to a driver first.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {drivers.map(d => {
                  const active = selectedVehicle === d.numberPlate;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedVehicle(d.numberPlate!)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl border px-4 py-3',
                        'text-left transition-all duration-150 active:scale-[0.985]',
                        active
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-border/70 hover:bg-muted/20',
                      )}
                    >
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl shrink-0',
                        active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                      )}>
                        <Truck className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono font-bold text-sm tracking-widest">{d.numberPlate}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.fullName}</p>
                      </div>
                      {active && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Section: Products ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Package className="h-3.5 w-3.5" /> Products
              {cart.length > 0 && (
                <span className="ml-auto text-[10px] font-bold text-primary normal-case tracking-normal">
                  {cart.length} selected
                </span>
              )}
            </p>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search products…"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-muted/40 border-transparent focus:border-input text-sm"
              />
            </div>

            {/* Product list */}
            <div className="space-y-2">
              {filteredProducts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6 italic">No products found.</p>
              )}
              {filteredProducts.map(product => {
                const qty      = cartQty(product.id);
                const inCart   = qty > 0;
                const overStock = qty > product.stock_available;
                const outOfStock = product.stock_available <= 0;

                return (
                  <div
                    key={product.id}
                    className={cn(
                      'flex items-center gap-3 p-3 border rounded-xl transition-colors',
                      inCart    && !overStock ? 'border-primary/40 bg-primary/5' : '',
                      overStock              ? 'border-destructive/40 bg-destructive/5' : '',
                      !inCart && !outOfStock  ? 'border-border' : '',
                      outOfStock && !inCart  ? 'border-border opacity-50' : '',
                    )}
                  >
                    {/* Icon */}
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {product.unit === 'LITRES'
                        ? <Droplets className="h-4 w-4 text-sky-500" />
                        : <Package  className="h-4 w-4 text-violet-500" />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{product.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge
                          variant={
                            product.stock_available <= 0  ? 'destructive' :
                            product.stock_available <= 10 ? 'warning'     : 'secondary'
                          }
                          className="text-[10px] px-1.5 py-0 h-4"
                        >
                          {product.stock_available} avail.
                        </Badge>
                        {overStock && (
                          <span className="text-[10px] text-destructive flex items-center gap-0.5 font-medium">
                            <AlertTriangle className="h-2.5 w-2.5" /> Over limit
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={qty === 0}
                        onClick={() => updateCart(product, -1)}
                        className={cn(
                          'h-8 w-8 rounded-lg border flex items-center justify-center transition-colors',
                          qty === 0
                            ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                            : 'border-border hover:bg-muted active:bg-muted/70',
                        )}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>

                      <span className={cn(
                        'w-8 text-center text-sm font-bold tabular-nums',
                        overStock ? 'text-destructive' : '',
                      )}>
                        {qty}
                      </span>

                      <button
                        type="button"
                        disabled={outOfStock || qty >= product.stock_available}
                        onClick={() => updateCart(product, 1)}
                        className={cn(
                          'h-8 w-8 rounded-lg border flex items-center justify-center transition-colors',
                          outOfStock || qty >= product.stock_available
                            ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                            : 'border-border hover:bg-muted active:bg-muted/70',
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Cart summary ── */}
          {cart.length > 0 && (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold">
                    {cart.length} product{cart.length !== 1 ? 's' : ''} · {totalItems} total units
                  </span>
                </div>
              </div>
              <div className="divide-y divide-border/40">
                {cart.map(c => (
                  <div key={c.product.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-xs text-muted-foreground flex-1 truncate">
                      {c.product.name}
                    </span>
                    <span className="text-xs font-bold tabular-nums shrink-0">
                      ×{c.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(c.product.id)}
                      className="h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          <div className="pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Notes <span className="font-normal normal-case tracking-normal">(optional)</span>
            </p>
            <Input
              placeholder="e.g. Morning load, Route A"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="h-12 rounded-xl text-sm"
            />
          </div>

        </div>

        {/* ── Sticky footer ── */}
        <div className="shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-sm
                        px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-3">
          <Button
            type="button" variant="outline" onClick={onClose} disabled={isLoading}
            className="h-12 flex-1 rounded-xl font-medium"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            variant="ocean"
            disabled={!canSubmit}
            className="h-12 flex-[2] rounded-xl font-semibold gap-2"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Distributing…</>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4" />
                Distribute{cart.length > 1 ? ` ${cart.length} Products` : ' Stock'}
              </>
            )}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};
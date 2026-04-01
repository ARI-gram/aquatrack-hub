/**
 * Products Page
 * Role: Client Admin
 * Route: /client/products
 * src/pages/client/ProductsPage.tsx
 *
 * Catalogue only — create, edit, hide/show, archive products.
 * Stock operations (Add Stock, Distribute) live in the Store page.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout }  from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button }           from '@/components/ui/button';
import { Input }            from '@/components/ui/input';
import { Badge }            from '@/components/ui/badge';
import { Switch }           from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus, Search, Package, MoreHorizontal, Eye, EyeOff,
  Pencil, Trash2, Loader2, Droplets, AlertTriangle,
  Grid3X3, LayoutGrid, List, AlignJustify, RotateCcw,
} from 'lucide-react';
import { useToast }            from '@/hooks/use-toast';
import { useAuth }             from '@/contexts/AuthContext';
import {
  productsService,
  type Product,
} from '@/api/services/products.service';
import { CreateProductDialog } from '@/components/dialogs/CreateProductDialog';
import { ConfirmDialog }       from '@/components/dialogs/ConfirmDialog';
import { cn }                  from '@/lib/utils';

// ── View mode ─────────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'list' | 'compact';

// ── Helpers ───────────────────────────────────────────────────────────────────

const unitIcon = (unit?: string, className = 'h-4 w-4') => {
  if (unit === 'LITRES')  return <Droplets className={cn(className, 'text-sky-500')}    />;
  if (unit === 'DOZENS')  return <Grid3X3  className={cn(className, 'text-amber-500')}  />;
  return                         <Package  className={cn(className, 'text-violet-500')} />;
};

const unitColor = (unit?: string) =>
  unit === 'LITRES'  ? 'bg-sky-500/10    text-sky-500'    :
  unit === 'DOZENS'  ? 'bg-amber-500/10  text-amber-500'  :
                       'bg-violet-500/10 text-violet-500';

const statusBadge = (product: Product) => {
  if (product.status === 'ARCHIVED') return <Badge variant="secondary">Archived</Badge>;
  if (!product.is_available)         return <Badge variant="warning">Hidden</Badge>;
  if (product.status === 'INACTIVE') return <Badge variant="secondary">Inactive</Badge>;
  return                                    <Badge variant="success">Active</Badge>;
};

// ── Action dropdown ───────────────────────────────────────────────────────────

interface ProductActionsProps {
  product:   Product;
  onEdit:    (p: Product) => void;
  onToggle:  (p: Product) => void;
  onArchive: (p: Product) => void;
}

const ProductActions: React.FC<ProductActionsProps> = ({
  product, onEdit, onToggle, onArchive,
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuItem onClick={() => onEdit(product)}>
        <Pencil className="mr-2 h-4 w-4" /> Edit Product
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onToggle(product)}>
        {product.is_available
          ? <><EyeOff className="mr-2 h-4 w-4" /> Hide from customers</>
          : <><Eye    className="mr-2 h-4 w-4" /> Show to customers</>}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={() => onArchive(product)}
      >
        <Trash2 className="mr-2 h-4 w-4" /> Archive
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// ── Grid card ─────────────────────────────────────────────────────────────────

interface CardRowProps extends ProductActionsProps {
  isAdmin: boolean;
}

const GridCard: React.FC<CardRowProps> = ({ product, isAdmin, ...actions }) => (
  <Card className={cn(
    'border-border/50 transition-opacity group',
    (!product.is_available || product.status !== 'ACTIVE') && 'opacity-60',
  )}>
    <CardContent className="p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-10 w-10 rounded-lg object-cover border border-border/50 shrink-0"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className={cn('p-2 rounded-lg shrink-0', unitColor(product.unit))}>
              {unitIcon(product.unit)}
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground leading-tight">{product.name}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {product.unit?.toLowerCase() ?? 'unit'}
              {product.is_returnable && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 text-blue-600">
                  <RotateCcw className="h-2.5 w-2.5" /> returnable
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {statusBadge(product)}
          <ProductActions product={product} {...actions} />
        </div>
      </div>

      {/* Pricing */}
      <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Selling price</p>
            <p className="text-xl font-bold text-foreground">
              KES {parseFloat(product.selling_price).toLocaleString()}
            </p>
            {isAdmin && product.buying_price && parseFloat(product.buying_price) > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Cost: KES {parseFloat(product.buying_price).toLocaleString()}
                <span className={cn(
                  'ml-1.5 font-medium',
                  parseFloat(product.selling_price) - parseFloat(product.buying_price) > 0
                    ? 'text-emerald-600' : 'text-destructive',
                )}>
                  ({Math.round(
                    ((parseFloat(product.selling_price) - parseFloat(product.buying_price))
                      / parseFloat(product.selling_price)) * 100,
                  )}% margin)
                </span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Visible</span>
            <Switch
              checked={product.is_available}
              onCheckedChange={() => actions.onToggle(product)}
              disabled={product.status !== 'ACTIVE'}
            />
          </div>
        </div>

        {product.delivery_fee !== undefined && parseFloat(product.delivery_fee ?? '0') > 0 && (
          <p className="text-xs text-muted-foreground">
            Delivery fee: KES {parseFloat(product.delivery_fee!).toLocaleString()}
          </p>
        )}
      </div>
    </CardContent>
  </Card>
);

// ── List row ──────────────────────────────────────────────────────────────────

const ListRow: React.FC<CardRowProps> = ({ product, isAdmin, ...actions }) => (
  <div className={cn(
    'flex items-center gap-4 px-4 py-3 rounded-lg border border-border/50 bg-card',
    'hover:bg-muted/30 transition-colors',
    (!product.is_available || product.status !== 'ACTIVE') && 'opacity-60',
  )}>
    {product.image_url ? (
      <img
        src={product.image_url}
        alt={product.name}
        className="h-9 w-9 rounded-lg object-cover border border-border/50 shrink-0"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    ) : (
      <div className={cn('p-2 rounded-lg shrink-0', unitColor(product.unit))}>
        {unitIcon(product.unit, 'h-4 w-4')}
      </div>
    )}

    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm leading-tight truncate">{product.name}</p>
      <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
        {product.unit?.toLowerCase()}
        {product.is_returnable && (
          <span className="inline-flex items-center gap-0.5 text-blue-600">
            · <RotateCcw className="h-2.5 w-2.5" /> returnable
          </span>
        )}
      </p>
    </div>

    <div className="hidden sm:block shrink-0">{statusBadge(product)}</div>

    <div className="hidden md:block text-right shrink-0 w-28">
      <p className="font-semibold text-sm">KES {parseFloat(product.selling_price).toLocaleString()}</p>
      {isAdmin && product.buying_price && parseFloat(product.buying_price) > 0 && (
        <p className="text-xs text-muted-foreground">
          Cost {parseFloat(product.buying_price).toLocaleString()}
        </p>
      )}
    </div>

    <Switch
      checked={product.is_available}
      onCheckedChange={() => actions.onToggle(product)}
      disabled={product.status !== 'ACTIVE'}
      className="shrink-0"
    />

    <div className="flex items-center gap-1 shrink-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => actions.onEdit(product)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <ProductActions product={product} {...actions} />
    </div>
  </div>
);

// ── Compact row ───────────────────────────────────────────────────────────────

const CompactRow: React.FC<CardRowProps> = ({ product, ...actions }) => (
  <div className={cn(
    'flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors',
    (!product.is_available || product.status !== 'ACTIVE') && 'opacity-60',
  )}>
    <div className={cn('p-1.5 rounded-md shrink-0', unitColor(product.unit))}>
      {unitIcon(product.unit, 'h-3.5 w-3.5')}
    </div>
    <p className="flex-1 text-sm font-medium truncate">{product.name}</p>
    <span className="text-xs text-muted-foreground hidden sm:block shrink-0">
      KES {parseFloat(product.selling_price).toLocaleString()}
    </span>
    <Switch
      checked={product.is_available}
      onCheckedChange={() => actions.onToggle(product)}
      disabled={product.status !== 'ACTIVE'}
      className="shrink-0 scale-90"
    />
    <ProductActions product={product} {...actions} />
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const ProductsPage: React.FC = () => {
  const { toast } = useToast();
  const { user }  = useAuth();
  const isAdmin   = user?.role === 'client_admin';

  const [products,      setProducts]      = useState<Product[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [viewMode,      setViewMode]      = useState<ViewMode>('grid');

  const [createOpen,    setCreateOpen]    = useState(false);
  const [editTarget,    setEditTarget]    = useState<Product | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await productsService.getProducts({
        status: statusFilter || undefined,
        search: search       || undefined,
      });
      setProducts(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load products.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, toast]);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300);
    return () => clearTimeout(t);
  }, [fetchProducts]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleProductSaved = (saved: Product) => {
    setProducts(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
  };

  const handleToggle = async (product: Product) => {
    try {
      const { product: updated } = await productsService.toggleProduct(product.id);
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      toast({
        title:       updated.is_available ? 'Product visible' : 'Product hidden',
        description: `"${updated.name}" is now ${updated.is_available ? 'visible to' : 'hidden from'} customers.`,
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle product.', variant: 'destructive' });
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setActionLoading(true);
    try {
      await productsService.archiveProduct(archiveTarget.id);
      setProducts(prev => prev.filter(p => p.id !== archiveTarget.id));
      toast({ title: `"${archiveTarget.name}" archived.` });
      setArchiveTarget(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to archive product.', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const openCreate  = ()           => { setEditTarget(null); setCreateOpen(true);  };
  const openEdit    = (p: Product) => { setEditTarget(p);    setCreateOpen(true);  };
  const closeCreate = ()           => { setCreateOpen(false); setEditTarget(null); };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const activeCount     = products.filter(p => p.status === 'ACTIVE' && p.is_available).length;
  const hiddenCount     = products.filter(p => !p.is_available && p.status !== 'ARCHIVED').length;
  const returnableCount = products.filter(p => p.is_returnable).length;
  const inactiveCount   = products.filter(p => p.status === 'INACTIVE').length;

  const actionProps = {
    onEdit:    openEdit,
    onToggle:  handleToggle,
    onArchive: setArchiveTarget,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout
      title="Product Catalogue"
      subtitle="Define your products — manage stock operations in Store"
    >

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Products', value: products.length,   icon: <Package       className="h-4 w-4 text-primary" />,          bg: 'bg-primary/10'  },
          { label: 'Active',         value: activeCount,        icon: <Eye           className="h-4 w-4 text-success" />,          bg: 'bg-success/10'  },
          { label: 'Hidden',         value: hiddenCount,        icon: <EyeOff        className="h-4 w-4 text-warning" />,          bg: 'bg-warning/10'  },
          { label: 'Returnable',     value: returnableCount,    icon: <RotateCcw     className="h-4 w-4 text-blue-500" />,         bg: 'bg-blue-500/10' },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bg}`}>{s.icon}</div>
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters + View toggle + New Product ── */}
      <Card className="mb-6 border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">

            <div className="flex flex-1 gap-3 w-full flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter || 'all'}
                onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              {/* View-mode toggle */}
              <div className="flex items-center rounded-lg border border-border/60 p-0.5 bg-muted/30 mr-1">
                {([
                  { mode: 'grid'    as ViewMode, icon: <LayoutGrid   className="h-3.5 w-3.5" />, label: 'Grid'    },
                  { mode: 'list'    as ViewMode, icon: <List          className="h-3.5 w-3.5" />, label: 'List'    },
                  { mode: 'compact' as ViewMode, icon: <AlignJustify  className="h-3.5 w-3.5" />, label: 'Compact' },
                ] as const).map(v => (
                  <TooltipProvider key={v.mode}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setViewMode(v.mode)}
                          className={cn(
                            'flex items-center justify-center h-7 w-7 rounded-md transition-colors',
                            viewMode === v.mode
                              ? 'bg-background shadow-sm text-foreground'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {v.icon}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{v.label}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>

              <Button variant="ocean" className="gap-2 flex-1 md:flex-none" onClick={openCreate}>
                <Plus className="h-4 w-4" /> New Product
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Product list / grid ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="p-4 rounded-full bg-muted/50">
              <Package className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">No products yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first product so customers can start placing orders.
              </p>
            </div>
            <Button variant="ocean" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Create First Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {products.map(p => (
                <GridCard key={p.id} product={p} isAdmin={isAdmin} {...actionProps} />
              ))}
            </div>
          )}

          {viewMode === 'list' && (
            <div className="space-y-2">
              {products.map(p => (
                <ListRow key={p.id} product={p} isAdmin={isAdmin} {...actionProps} />
              ))}
            </div>
          )}

          {viewMode === 'compact' && (
            <Card className="border-border/50">
              <CardContent className="p-2 divide-y divide-border/40">
                {products.map(p => (
                  <CompactRow key={p.id} product={p} isAdmin={isAdmin} {...actionProps} />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Dialogs ── */}
      <CreateProductDialog
        open={createOpen}
        product={editTarget}
        onClose={closeCreate}
        onSaved={handleProductSaved}
      />
      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive Product"
        description={`Archive "${archiveTarget?.name}"? It will be hidden from customers and removed from your catalogue.`}
        confirmLabel="Archive"
        confirmVariant="destructive"
        isLoading={actionLoading}
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </DashboardLayout>
  );
};

export default ProductsPage;
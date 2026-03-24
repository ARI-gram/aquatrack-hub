/**
 * Create Product Dialog
 * src/components/dialogs/CreateProductDialog.tsx
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Button }    from '@/components/ui/button';
import { Input }     from '@/components/ui/input';
import { Switch }    from '@/components/ui/switch';
import { Badge }     from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Package, Droplets, ImageIcon,
  Eye, EyeOff, Tag, Lock, Sparkles, Truck,
  Grid3X3, ChevronRight, BookmarkCheck, History, RotateCcw,
  Layers, Box, FlaskConical, ShoppingBag, Archive, Container,
} from 'lucide-react';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z }           from 'zod';
import { cn }          from '@/lib/utils';
import { useToast }    from '@/hooks/use-toast';
import { useAuth }     from '@/contexts/AuthContext';
import {
  productsService,
  type Product,
  type CreateProductRequest,
  type ProductUnit,
} from '@/api/services/products.service';

// ── Unit options config ───────────────────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export const UNIT_OPTIONS = [
  {
    value:   'BOTTLES',
    label:   'Bottles',
    icon:    <Package      className="h-4 w-4" />,
    color:   'text-violet-500 bg-violet-500/10',
    border:  'border-violet-500/30',
    description: 'Individual bottle units',
  },
  {
    value:   'LITRES',
    label:   'Litres',
    icon:    <Droplets     className="h-4 w-4" />,
    color:   'text-sky-500 bg-sky-500/10',
    border:  'border-sky-500/30',
    description: 'Volume in litres',
  },
  {
    value:   'DOZENS',
    label:   'Dozens',
    icon:    <Grid3X3      className="h-4 w-4" />,
    color:   'text-amber-500 bg-amber-500/10',
    border:  'border-amber-500/30',
    description: 'Grouped in dozens',
  },
  {
    value:   'PIECES',
    label:   'Pieces',
    icon:    <Layers       className="h-4 w-4" />,
    color:   'text-emerald-500 bg-emerald-500/10',
    border:  'border-emerald-500/30',
    description: 'Individual pieces / units',
  },
  {
    value:   'CRATES',
    label:   'Crates',
    icon:    <Box          className="h-4 w-4" />,
    color:   'text-orange-500 bg-orange-500/10',
    border:  'border-orange-500/30',
    description: 'Bulk crate units',
  },
  {
    value:   'JERRICANS',
    label:   'Jerricans',
    icon:    <Container    className="h-4 w-4" />,
    color:   'text-cyan-500 bg-cyan-500/10',
    border:  'border-cyan-500/30',
    description: 'Large jerricans',
  },
  {
    value:   'SACHETS',
    label:   'Sachets',
    icon:    <ShoppingBag  className="h-4 w-4" />,
    color:   'text-pink-500 bg-pink-500/10',
    border:  'border-pink-500/30',
    description: 'Small sachet packets',
  },
  {
    value:   'GALLONS',
    label:   'Gallons',
    icon:    <FlaskConical className="h-4 w-4" />,
    color:   'text-blue-500 bg-blue-500/10',
    border:  'border-blue-500/30',
    description: 'Volume in gallons',
  },
  {
    value:   'PACKS',
    label:   'Packs',
    icon:    <Archive      className="h-4 w-4" />,
    color:   'text-indigo-500 bg-indigo-500/10',
    border:  'border-indigo-500/30',
    description: 'Bundled packs',
  },
  {
    value:   'CARTONS',
    label:   'Cartons',
    icon:    <Box          className="h-4 w-4" />,
    color:   'text-rose-500 bg-rose-500/10',
    border:  'border-rose-500/30',
    description: 'Carton boxes',
  },
] as const;

export type UnitValue = typeof UNIT_OPTIONS[number]['value'];

// ── Dozen preset storage ──────────────────────────────────────────────────────

interface DozenPreset {
  size:  number;
  label: string;
}

const DOZEN_KEY = 'aquatrack_dozen_presets';

const loadPresets  = (): DozenPreset[] => {
  try { return JSON.parse(localStorage.getItem(DOZEN_KEY) ?? '[]'); }
  catch { return []; }
};
const savePresets = (p: DozenPreset[]) =>
  localStorage.setItem(DOZEN_KEY, JSON.stringify(p));

// ── Zod schema ────────────────────────────────────────────────────────────────

const UNIT_VALUES = UNIT_OPTIONS.map(u => u.value) as [UnitValue, ...UnitValue[]];

const schema = z.object({
  name:          z.string().min(2, 'Name is required').max(200),
  unit:          z.enum(UNIT_VALUES),
  dozen_size:    z.coerce.number().min(1).nullable().optional(),
  selling_price: z.coerce.number().min(1, 'Selling price must be at least KES 1'),
  buying_price:  z.coerce.number().min(0).default(0),
  delivery_fee:  z.coerce.number().min(0, 'Delivery fee cannot be negative').default(0),
  image_url:     z.string().url('Enter a valid URL').or(z.literal('')).optional(),
  status:        z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  is_available:  z.boolean().default(true),
  is_returnable: z.boolean().default(false),
});
type FormValues = z.infer<typeof schema>;

// ── SectionLabel ──────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="flex items-center justify-center h-6 w-6 rounded-md bg-muted text-muted-foreground">
      {icon}
    </div>
    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
  </div>
);

// ── DozenConfig popover ───────────────────────────────────────────────────────

interface DozenConfigProps {
  value:    number;
  onChange: (size: number) => void;
}

const DozenConfig: React.FC<DozenConfigProps> = ({ value, onChange }) => {
  const [open,     setOpen]     = useState(false);
  const [localVal, setLocalVal] = useState(value);
  const [presets,  setPresets]  = useState<DozenPreset[]>([]);
  const { toast } = useToast();

  useEffect(() => { if (open) setPresets(loadPresets()); }, [open]);
  useEffect(() => setLocalVal(value), [value]);

  const apply = () => { onChange(localVal); setOpen(false); };

  const savePreset = () => {
    const label = `${localVal} units per dozen`;
    const existing = loadPresets();
    if (existing.find(p => p.size === localVal)) {
      toast({ title: 'Already saved', description: label }); return;
    }
    const updated = [{ size: localVal, label }, ...existing].slice(0, 10);
    savePresets(updated);
    setPresets(updated);
    toast({ title: 'Preset saved', description: label });
  };

  const applyPreset = (p: DozenPreset) => { onChange(p.size); setOpen(false); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'mt-2 flex items-center gap-2 w-full rounded-lg border border-dashed px-3 py-2.5',
            'text-sm hover:border-primary/50 hover:text-foreground transition-colors',
            'bg-amber-500/5 border-amber-500/30 text-muted-foreground',
          )}
        >
          <Grid3X3 className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="flex-1 text-left font-medium">
            1 dozen = {value} unit{value !== 1 ? 's' : ''}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-4 border-b border-border/60 bg-muted/30">
          <p className="font-semibold text-sm">Configure Dozen Size</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            How many units make up 1 dozen?
          </p>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Units per dozen
            </label>
            <Input
              type="number"
              min={1}
              value={localVal}
              onChange={e => setLocalVal(Math.max(1, parseInt(e.target.value) || 1))}
              className="h-9"
            />
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-center text-muted-foreground">
            1 dozen ={' '}
            <span className="font-semibold text-foreground">
              {localVal} unit{localVal !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {presets.length > 0 && (
          <div className="border-t border-border/60 px-4 pt-3 pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <History className="h-3 w-3" /> Saved presets
            </p>
            <div className="space-y-0.5">
              {presets.map(p => (
                <button
                  key={p.size}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-muted transition-colors flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <BookmarkCheck className="h-3 w-3 text-primary shrink-0" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 border-t border-border/60 flex gap-2">
          <Button type="button" variant="ghost" size="sm" className="flex-1 gap-1.5 text-xs" onClick={savePreset}>
            <BookmarkCheck className="h-3.5 w-3.5" /> Save preset
          </Button>
          <Button type="button" size="sm" className="flex-1 text-xs" onClick={apply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ── Main dialog ───────────────────────────────────────────────────────────────

export interface CreateProductDialogProps {
  open:    boolean;
  product: Product | null;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

export const CreateProductDialog: React.FC<CreateProductDialogProps> = ({
  open, product, onClose, onSaved,
}) => {
  const [isLoading,       setIsLoading]       = useState(false);
  const [showBuyingPrice, setShowBuyingPrice] = useState(false);
  const { user }  = useAuth();
  const { toast } = useToast();
  const isEdit  = product !== null;
  const isAdmin = user?.role === 'client_admin';

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', unit: 'BOTTLES', dozen_size: 12,
      selling_price: 0, buying_price: 0, delivery_fee: 0,
      image_url: '', status: 'ACTIVE', is_available: true,
      is_returnable: false,
    },
  });

  useEffect(() => {
    if (open) {
      if (product) {
        form.reset({
          name:          product.name,
          unit:          product.unit as ProductUnit,
          dozen_size:    product.dozen_size ?? 12,
          selling_price: parseFloat(product.selling_price),
          buying_price:  parseFloat(product.buying_price ?? '0'),
          delivery_fee:  parseFloat(product.delivery_fee ?? '0'),
          image_url:     product.image_url ?? '',
          status:        product.status === 'ARCHIVED' ? 'ACTIVE' : product.status as 'ACTIVE' | 'INACTIVE',
          is_available:  product.is_available,
          is_returnable: product.is_returnable ?? false,
        });
      } else {
        form.reset();
      }
    }
  }, [open, product, form]);

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      const payload: CreateProductRequest = {
        name:          data.name,
        unit:          data.unit,
        selling_price: data.selling_price,
        buying_price:  isAdmin ? data.buying_price : undefined,
        delivery_fee:  data.delivery_fee,
        image_url:     data.image_url || undefined,
        status:        data.status,
        is_available:  data.is_available,
        is_returnable: data.is_returnable,
        dozen_size:    data.unit === 'DOZENS' ? (data.dozen_size ?? null) : null,
      };

      let saved: Product;
      if (isEdit) {
        saved = await productsService.updateProduct(product.id, payload);
        toast({ title: 'Product updated.' });
      } else {
        saved = await productsService.createProduct(payload);
        toast({ title: 'Product created.' });
      }
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Failed to save product.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const unit        = form.watch('unit');
  const isAvailable = form.watch('is_available');
  const deliveryFee = form.watch('delivery_fee');
  const dozenSize   = form.watch('dozen_size') ?? 12;

  // Derive icon + color from UNIT_OPTIONS map
  const activeUnit = UNIT_OPTIONS.find(u => u.value === unit) ?? UNIT_OPTIONS[0];

  const unitIconEl = React.cloneElement(activeUnit.icon as React.ReactElement, {
    className: 'h-5 w-5',
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">

        {/* ── Header ── */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5 border-b border-border/60">
          <div className="flex items-start gap-4">
            <div className={cn(
              'flex items-center justify-center h-12 w-12 rounded-xl shrink-0 border border-border/40',
              activeUnit.color,
            )}>
              {unitIconEl}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold">
                {isEdit ? 'Edit Product' : 'Create Product'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {isEdit
                  ? 'Update catalogue details. Visible to customers immediately.'
                  : 'Define a new product for your catalogue.'}
              </DialogDescription>
            </div>
            <Badge variant={isAvailable ? 'success' : 'secondary'} className="shrink-0 text-xs">
              {isAvailable ? '● Visible' : '○ Hidden'}
            </Badge>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <Form {...form}>
            <form id="create-product-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* ── PRODUCT INFO ── */}
              <div>
                <SectionLabel icon={<Sparkles className="h-3.5 w-3.5" />} label="Product Info" />
                <div className="space-y-4">

                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Mineral Water 500ml" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="unit" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {UNIT_OPTIONS.map(u => (
                              <SelectItem key={u.value} value={u.value}>
                                <div className="flex items-center gap-2">
                                  <span className={cn('shrink-0', u.color.split(' ')[0])}>
                                    {u.icon}
                                  </span>
                                  {u.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ACTIVE">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Active
                              </div>
                            </SelectItem>
                            <SelectItem value="INACTIVE">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-muted-foreground inline-block" /> Inactive
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* ── Unit description chip ── */}
                  {activeUnit.description && (
                    <div className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                      activeUnit.color,
                      activeUnit.border,
                    )}>
                      <span className="shrink-0">{activeUnit.icon}</span>
                      <span className="font-medium">{activeUnit.label}:</span>
                      <span className="text-muted-foreground">{activeUnit.description}</span>
                    </div>
                  )}

                  {/* ── Dozen configurator ── */}
                  {unit === 'DOZENS' && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Dozen definition
                        <span className="ml-1 text-muted-foreground/60">(click to configure)</span>
                      </p>
                      <DozenConfig
                        value={dozenSize}
                        onChange={size => form.setValue('dozen_size', size, { shouldValidate: true })}
                      />
                    </div>
                  )}

                  <FormField control={form.control} name="image_url" render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Product Image URL
                        <span className="text-muted-foreground font-normal ml-1 text-xs">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input type="url" placeholder="https://…" className="pl-9 h-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <Separator />

              {/* ── PRICING ── */}
              <div>
                <SectionLabel icon={<Tag className="h-3.5 w-3.5" />} label="Pricing" />
                <div className="space-y-3">

                  <FormField control={form.control} name="selling_price" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Selling Price
                        <Badge variant="outline" className="text-xs font-normal py-0 h-5">Visible to customers</Badge>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">KES</span>
                          <Input type="number" min={1} step={1} placeholder="150" className="pl-11 h-10" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {isAdmin && (
                    <FormField control={form.control} name="buying_price" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Buying Price
                          <Badge variant="secondary" className="text-xs font-normal py-0 h-5 gap-1">
                            <Lock className="h-3 w-3" /> Owner only
                          </Badge>
                          <button
                            type="button"
                            onClick={() => setShowBuyingPrice(v => !v)}
                            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showBuyingPrice ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">KES</span>
                            <Input
                              type={showBuyingPrice ? 'number' : 'password'}
                              min={0} step={1} placeholder="••••"
                              className="pl-11 h-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        {showBuyingPrice && field.value > 0 && form.watch('selling_price') > 0 && (
                          <div className="mt-1.5 flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground">Margin:</span>
                            <span className={cn(
                              'font-semibold',
                              form.watch('selling_price') - field.value > 0 ? 'text-emerald-600' : 'text-destructive',
                            )}>
                              KES {(form.watch('selling_price') - field.value).toLocaleString()}
                              {' '}({Math.round(((form.watch('selling_price') - field.value) / form.watch('selling_price')) * 100)}%)
                            </span>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  <FormField control={form.control} name="delivery_fee" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                        Delivery Fee
                        <Badge variant="outline" className="text-xs font-normal py-0 h-5">Visible to customers</Badge>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">KES</span>
                          <Input type="number" min={0} step={1} placeholder="0" className="pl-11 h-10" {...field} />
                        </div>
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        {deliveryFee === 0 || !deliveryFee
                          ? <><span className="text-emerald-600 font-medium">Free delivery</span> — 0 is allowed</>
                          : <>Customers pay KES {Number(deliveryFee).toLocaleString()} per delivery</>}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <Separator />

              {/* ── BEHAVIOUR ── */}
              <div>
                <SectionLabel icon={<Eye className="h-3.5 w-3.5" />} label="Behaviour" />
                <div className="space-y-3">

                  {/* Visibility toggle */}
                  <FormField control={form.control} name="is_available" render={({ field }) => (
                    <div className={cn(
                      'flex items-center justify-between rounded-xl border px-4 py-3 transition-colors duration-200',
                      field.value ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-muted/30',
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex items-center justify-center h-9 w-9 rounded-lg',
                          field.value ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground',
                        )}>
                          <Eye className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {field.value ? 'Visible to customers' : 'Hidden from customers'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {field.value
                              ? 'Customers can see and order this product'
                              : 'Temporarily hidden — stays in your catalogue'}
                          </p>
                        </div>
                      </div>
                      <Switch checked={field.value} onCheckedChange={field.onChange} className="shrink-0" />
                    </div>
                  )} />

                  {/* Returnable toggle */}
                  <FormField control={form.control} name="is_returnable" render={({ field }) => (
                    <div className={cn(
                      'flex items-center justify-between rounded-xl border px-4 py-3 transition-colors duration-200',
                      field.value ? 'border-blue-500/30 bg-blue-500/5' : 'border-border bg-muted/30',
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex items-center justify-center h-9 w-9 rounded-lg',
                          field.value ? 'bg-blue-500/10 text-blue-600' : 'bg-muted text-muted-foreground',
                        )}>
                          <RotateCcw className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {field.value ? 'Returnable bottle' : 'Consumable (not returned)'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {field.value
                              ? 'Customers swap this bottle — we expect it back'
                              : 'Sealed / single-use — gone after delivery'}
                          </p>
                        </div>
                      </div>
                      <Switch checked={field.value} onCheckedChange={field.onChange} className="shrink-0" />
                    </div>
                  )} />

                </div>
              </div>

            </form>
          </Form>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-border/60 bg-muted/30 px-6 py-4 flex items-center gap-3 shrink-0">
          <p className="text-xs text-muted-foreground flex-1 hidden sm:block">
            {isEdit ? 'Editing catalogue product' : 'You can add stock after creating'}
          </p>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading} className="min-w-20">
            Cancel
          </Button>
          <Button type="submit" form="create-product-form" variant="ocean" disabled={isLoading} className="min-w-32">
            {isLoading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEdit ? 'Saving…' : 'Creating…'}</>
              : isEdit ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};
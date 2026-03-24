/**
 * DistributeStockDialog — mobile-first
 * src/components/dialogs/DistributeStockDialog.tsx
 *
 * - Bottom sheet on phones, centred card on md+
 * - Large touch targets throughout (h-12/h-14)
 * - Stepper buttons for quantity (no keyboard needed)
 * - Vehicle card list (easier to tap than a dropdown)
 * - Sticky footer with safe-area padding for notched phones
 */

import React, { useEffect, useState } from 'react';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z }           from 'zod';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Badge }   from '@/components/ui/badge';
import {
  Loader2, Truck, Package, ArrowRightLeft,
  AlertTriangle, CheckCircle2, Minus, Plus,
} from 'lucide-react';
import { useToast }            from '@/hooks/use-toast';
import { distributionService } from '@/api/services/products.service';
import { employeeService }     from '@/api/services/employee.service';
import type { Product, DistributeStockResponse } from '@/types/products.types';
import type { Employee } from '@/types/employee.types';
import { cn } from '@/lib/utils';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  product_id:     z.string().min(1, 'Please select a product'),
  vehicle_number: z.string().min(1, 'Please select a vehicle'),
  quantity:       z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  notes:          z.string().max(200).optional(),
});
type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean;
  products:      Product[];
  preselected?:  string;
  onClose:       () => void;
  onDistributed: (res: DistributeStockResponse, productId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DistributeStockDialog: React.FC<Props> = ({
  open, products, preselected, onClose, onDistributed,
}) => {
  const { toast }                          = useToast();
  const [isLoading,      setIsLoading]     = useState(false);
  const [drivers,        setDrivers]       = useState<Employee[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingDrivers(true);
    employeeService
      .getEmployees({ role: 'driver', status: 'active' })
      .then(d => setDrivers(d.data.filter((e: Employee) => e.numberPlate)))
      .catch(() => toast({ title: 'Warning', description: 'Could not load vehicles.', variant: 'destructive' }))
      .finally(() => setLoadingDrivers(false));
  }, [open, toast]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { product_id: preselected ?? '', vehicle_number: '', quantity: 1, notes: '' },
  });

  useEffect(() => {
    if (!open) { form.reset(); return; }
    if (preselected) form.setValue('product_id', preselected);
  }, [open, preselected, form]);

  const watchedProductId = form.watch('product_id');
  const watchedVehicle   = form.watch('vehicle_number');
  const watchedQty       = form.watch('quantity') || 1;
  const selectedProduct  = products.find(p => p.id === watchedProductId);
  const selectedDriver   = drivers.find(d => d.numberPlate === watchedVehicle);
  const activeProducts   = products.filter(p => p.status === 'ACTIVE');
  const isOverStock      = selectedProduct ? watchedQty > selectedProduct.stock_available : false;

  const stepQty = (delta: number) =>
    form.setValue('quantity', Math.max(1, watchedQty + delta), { shouldValidate: true });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      const res = await distributionService.distribute({
        product: data.product_id, vehicle_number: data.vehicle_number,
        quantity: data.quantity,  notes: data.notes,
      });
      onDistributed(res, data.product_id);
      toast({
        title:       'Stock distributed ✓',
        description: `${data.quantity} ${selectedProduct?.unit.toLowerCase() ?? 'units'} → ${data.vehicle_number}`,
      });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to distribute stock.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(
        'p-0 gap-0 flex flex-col overflow-hidden border-0 shadow-2xl',
        // Mobile: bottom sheet
        'fixed inset-x-0 bottom-0 top-auto translate-x-0 translate-y-0',
        'max-h-[92dvh] rounded-t-3xl rounded-b-none',
        // md+: centred modal
        'md:relative md:inset-auto md:rounded-2xl md:max-w-md md:max-h-[88vh]',
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
            <div>
              <DialogTitle className="text-base font-semibold">Distribute to Van</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Move warehouse stock onto a delivery vehicle
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          <Form {...form}>
            <form id="distribute-form" onSubmit={form.handleSubmit(onSubmit)}
              className="px-5 py-5 space-y-5">

              {/* ── Product ── */}
              <FormField control={form.control} name="product_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Product</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12 text-sm rounded-xl">
                        <SelectValue placeholder="Choose a product…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeProducts.map(p => (
                        <SelectItem key={p.id} value={p.id} className="py-3">
                          <div className="flex items-center gap-2 w-full">
                            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium flex-1 truncate">{p.name}</span>
                            <Badge
                              variant={
                                p.stock_available <= 0  ? 'destructive' :
                                p.stock_available <= 10 ? 'warning'     : 'secondary'
                              }
                              className="text-[10px] px-1.5 py-0 ml-2 shrink-0"
                            >
                              {p.stock_available}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Stock status */}
              {selectedProduct && (
                <div className={cn(
                  'flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium',
                  selectedProduct.stock_available <= 0
                    ? 'border-destructive/40 bg-destructive/5 text-destructive'
                    : selectedProduct.stock_available <= 10
                      ? 'border-amber-400/40 bg-amber-400/5 text-amber-700 dark:text-amber-400'
                      : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400',
                )}>
                  {selectedProduct.stock_available <= 10
                    ? <AlertTriangle className="h-4 w-4 shrink-0" />
                    : <CheckCircle2  className="h-4 w-4 shrink-0" />}
                  <span>
                    <strong>{selectedProduct.stock_available}</strong>
                    {' '}{selectedProduct.unit.toLowerCase()} available in warehouse
                  </span>
                </div>
              )}

              {/* ── Vehicle cards ── */}
              <FormField control={form.control} name="vehicle_number" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Vehicle</FormLabel>

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
                        const active = field.value === d.numberPlate;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => field.onChange(d.numberPlate)}
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
                  <FormMessage />
                </FormItem>
              )} />

              {/* ── Quantity stepper ── */}
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <div className="flex items-baseline justify-between mb-1">
                    <FormLabel className="text-sm font-medium">Quantity</FormLabel>
                    {selectedProduct && (
                      <span className="text-xs text-muted-foreground">
                        max {selectedProduct.stock_available}
                      </span>
                    )}
                  </div>
                  <FormControl>
                    <div className={cn(
                      'flex items-stretch rounded-xl border overflow-hidden h-14',
                      isOverStock ? 'border-destructive' : 'border-border',
                    )}>
                      <button
                        type="button" onClick={() => stepQty(-1)}
                        className="w-14 flex items-center justify-center text-muted-foreground hover:bg-muted active:bg-muted/70 transition-colors border-r border-border shrink-0"
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                      <Input
                        type="number" min={1} max={selectedProduct?.stock_available}
                        className="flex-1 h-full border-0 text-center text-2xl font-bold rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        {...field}
                      />
                      <button
                        type="button" onClick={() => stepQty(1)}
                        className="w-14 flex items-center justify-center text-muted-foreground hover:bg-muted active:bg-muted/70 transition-colors border-l border-border shrink-0"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </FormControl>
                  {isOverStock && (
                    <p className="flex items-center gap-1 text-xs text-destructive mt-1.5">
                      <AlertTriangle className="h-3 w-3" />
                      Only {selectedProduct?.stock_available} available
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )} />

              {/* ── Notes ── */}
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Notes
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Morning load, Route A"
                      className="h-12 rounded-xl text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Bottom spacer so content clears the sticky footer */}
              <div className="h-1" />
            </form>
          </Form>
        </div>

        {/* ── Sticky footer — respects iPhone notch ── */}
        <div className="shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-sm
                        px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-3">
          <Button
            type="button" variant="outline" onClick={onClose} disabled={isLoading}
            className="h-12 flex-1 rounded-xl font-medium"
          >
            Cancel
          </Button>
          <Button
            type="submit" form="distribute-form" variant="ocean"
            disabled={isLoading || drivers.length === 0 || isOverStock || !watchedVehicle || !watchedProductId}
            className="h-12 flex-[2] rounded-xl font-semibold gap-2"
          >
            {isLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Distributing…</>
              : <><ArrowRightLeft className="h-4 w-4" />Distribute Stock</>}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};
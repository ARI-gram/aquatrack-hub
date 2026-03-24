/**
 * Add Stock Dialog — Scanning Session
 * src/components/dialogs/AddStockDialog.tsx
 *
 * Per-unit serial scanning session:
 *  1. Pick a product
 *  2. Scan / type serials one by one (or auto-generate)
 *  3. Each serial appears in a "scanned list"
 *  4. Submit all at once → POST /api/stock/batch/
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button }    from '@/components/ui/button';
import { Input }     from '@/components/ui/input';
import { Textarea }  from '@/components/ui/textarea';
import { Badge }     from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2, Package, Droplets, ScanLine, Wand2,
  CalendarClock, User, Hash, ClipboardList, Plus,
  X, CheckCircle2, AlertCircle, Trash2,
} from 'lucide-react';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z }           from 'zod';
import { cn }          from '@/lib/utils';
import { useToast }    from '@/hooks/use-toast';
import { useAuth }     from '@/contexts/AuthContext';
import { format }      from 'date-fns';
import {
  stockService,
  type Product,
  type StockEntry,
} from '@/api/services/products.service';

// ── Helpers ────────────────────────────────────────────────────────────────────

const generateBatchRef = (): string => {
  const date = format(new Date(), 'yyyyMMdd');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BATCH-${date}-${rand}`;
};

const generateSerial = (): string => {
  const date = format(new Date(), 'yyyyMMdd');
  const num  = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return `SN-${date}-${num}`;
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface ScannedSerial {
  id:     string;   // local key for React
  serial: string;
  auto:   boolean;  // was it auto-generated?
}

// ── Schema ─────────────────────────────────────────────────────────────────────

const schema = z.object({
  product_id: z.string().min(1, 'Select a product'),
  notes:      z.string().max(500).optional(),
});
type FormValues = z.infer<typeof schema>;

// ── Section label ──────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ icon: React.ReactNode; label: string; badge?: string }> = ({ icon, label, badge }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="flex items-center justify-center h-6 w-6 rounded-md bg-muted text-muted-foreground">
      {icon}
    </div>
    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">
      {label}
    </span>
    {badge && (
      <Badge variant="secondary" className="text-xs tabular-nums">{badge}</Badge>
    )}
  </div>
);

const AutoField: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-lg bg-muted/40 border border-border/50 px-3 py-2.5">
    <div className="text-muted-foreground shrink-0">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
    </div>
    <Badge variant="secondary" className="text-xs shrink-0">Auto</Badge>
  </div>
);

// ── Props ──────────────────────────────────────────────────────────────────────

export interface AddStockDialogProps {
  open:         boolean;
  products:     Product[];
  preselected?: string;
  onClose:      () => void;
  onSaved:      (entries: StockEntry[]) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const AddStockDialog: React.FC<AddStockDialogProps> = ({
  open, products, preselected, onClose, onSaved,
}) => {
  const [isLoading,     setIsLoading]     = useState(false);
  const [now,           setNow]           = useState(new Date());
  const [batchRef,      setBatchRef]      = useState('');
  const [scanned,       setScanned]       = useState<ScannedSerial[]>([]);
  const [inputSerial,   setInputSerial]   = useState('');
  const [dupError,      setDupError]      = useState('');
  const serialInputRef                    = useRef<HTMLInputElement>(null);
  const { user }  = useAuth();
  const { toast } = useToast();

  // Clock + reset on open
  useEffect(() => {
    if (!open) return;
    setBatchRef(generateBatchRef());
    setNow(new Date());
    setScanned([]);
    setInputSerial('');
    setDupError('');
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { product_id: preselected ?? '', notes: '' },
  });

  useEffect(() => {
    if (open) {
      form.reset({ product_id: preselected ?? '', notes: '' });
    }
  }, [open, preselected, form]);

  // ── Serial management ──────────────────────────────────────────────────────

  const addSerial = useCallback((serial: string, auto = false) => {
    const clean = serial.trim();
    if (!clean) return;

    if (scanned.some(s => s.serial === clean)) {
      setDupError(`"${clean}" is already in this batch.`);
      return;
    }
    setDupError('');
    setScanned(prev => [...prev, { id: crypto.randomUUID(), serial: clean, auto }]);
    setInputSerial('');
    serialInputRef.current?.focus();
  }, [scanned]);

  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSerial(inputSerial);
    }
  };

  const handleAutoGenerate = () => {
    addSerial(generateSerial(), true);
  };

  const removeSerial = (id: string) => {
    setScanned(prev => prev.filter(s => s.id !== id));
  };

  const clearAll = () => {
    setScanned([]);
    setDupError('');
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    if (scanned.length === 0) {
      toast({ title: 'No serials', description: 'Add at least one serial number.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const entries = await stockService.createBatch({
        product:     data.product_id,
        batch_ref:   batchRef,
        received_at: now.toISOString(),
        notes:       data.notes || '',
        serials:     scanned.map(s => s.serial),
      });

      toast({
        title:       `${entries.length} ${unitLabel.toLowerCase()} recorded.`,
        description: `Batch ${batchRef}`,
      });
      onSaved(entries);
      onClose();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const msg = (errData?.detail as string)
        || (errData?.serials as string[])?.join(', ')
        || 'Failed to record stock.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const productId      = form.watch('product_id');
  const selectedProduct = products.find(p => p.id === productId);
  const unitLabel      = selectedProduct?.unit === 'LITRES' ? 'Litres' : 'Bottles';
  const unitIcon       = selectedProduct?.unit === 'LITRES'
    ? <Droplets className="h-4 w-4 text-sky-500" />
    : <Package  className="h-4 w-4 text-violet-500" />;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">

        {/* ── Header ── */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent px-6 pt-6 pb-5 border-b border-border/60">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl shrink-0 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <ScanLine className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold">Add Stock</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                Scan each unit's serial — one entry per {selectedProduct ? unitLabel.toLowerCase().replace(/s$/, '') : 'unit'}.
              </DialogDescription>
            </div>
            {selectedProduct && (
              <Badge variant="outline" className="shrink-0 text-xs gap-1.5">
                {unitIcon} {unitLabel}
              </Badge>
            )}
          </div>
        </div>

        {/* ── Form body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <Form {...form}>
            <form id="add-stock-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* ── PRODUCT ── */}
              <div>
                <SectionLabel icon={<ClipboardList className="h-3.5 w-3.5" />} label="Product" />
                <FormField control={form.control} name="product_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Product</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Choose a product…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.filter(p => p.status === 'ACTIVE').map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2.5 py-0.5">
                              {p.unit === 'LITRES'
                                ? <Droplets className="h-4 w-4 text-sky-500 shrink-0" />
                                : <Package  className="h-4 w-4 text-violet-500 shrink-0" />}
                              <span className="font-medium">{p.name}</span>
                              <span className="text-xs text-muted-foreground ml-auto">
                                KES {parseFloat(p.selling_price).toLocaleString()}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <Separator />

              {/* ── SCAN SERIALS ── */}
              <div>
                <SectionLabel
                  icon={<Hash className="h-3.5 w-3.5" />}
                  label="Scan Serials"
                  badge={scanned.length > 0 ? `${scanned.length} added` : undefined}
                />

                {/* Input row */}
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      ref={serialInputRef}
                      value={inputSerial}
                      onChange={e => { setInputSerial(e.target.value); setDupError(''); }}
                      onKeyDown={handleScanKeyDown}
                      placeholder="Scan barcode or type serial…"
                      className={cn(
                        'pl-9 h-10 font-mono text-sm',
                        dupError && 'border-destructive focus-visible:ring-destructive',
                      )}
                      disabled={!productId}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 px-3 shrink-0"
                    onClick={() => addSerial(inputSerial)}
                    disabled={!productId || !inputSerial.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Helper row */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground">
                    {dupError
                      ? <span className="text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />{dupError}
                        </span>
                      : 'Press Enter or + to add each unit. Scan barcode for auto-fill.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleAutoGenerate}
                    disabled={!productId}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Wand2 className="h-3 w-3" />
                    Auto-generate
                  </button>
                </div>

                {/* Scanned list */}
                {scanned.length > 0 ? (
                  <div className="rounded-lg border border-border/60 overflow-hidden">
                    {/* List header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs font-semibold text-foreground">
                          {scanned.length} {unitLabel} queued
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={clearAll}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        Clear all
                      </button>
                    </div>

                    <ScrollArea className={cn(scanned.length > 5 ? 'h-44' : 'h-auto')}>
                      <div className="divide-y divide-border/40">
                        {scanned.map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors group"
                          >
                            <span className="text-xs text-muted-foreground w-6 shrink-0 tabular-nums text-right">
                              {idx + 1}
                            </span>
                            <code className="flex-1 text-xs font-mono text-foreground truncate">
                              {item.serial}
                            </code>
                            {item.auto && (
                              <Badge variant="secondary" className="text-xs py-0 h-4 shrink-0">
                                Auto
                              </Badge>
                            )}
                            <button
                              type="button"
                              onClick={() => removeSerial(item.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    {/* Footer count */}
                    <div className="px-3 py-2 bg-emerald-500/5 border-t border-emerald-500/20 flex items-center justify-between">
                      <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        Total: {scanned.length} {unitLabel.toLowerCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Batch: <code className="font-mono">{batchRef}</code>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    'rounded-lg border-2 border-dashed border-border/50 px-4 py-6 text-center transition-colors',
                    !productId && 'opacity-50',
                  )}>
                    <ScanLine className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {productId
                        ? 'Scan or type each unit\'s serial above'
                        : 'Select a product first'}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* ── NOTES ── */}
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Notes
                    <span className="text-muted-foreground font-normal ml-1 text-xs">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. Received from Supplier X, Invoice #1234…"
                      rows={2}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Separator />

              {/* ── SESSION INFO ── */}
              <div>
                <SectionLabel icon={<CalendarClock className="h-3.5 w-3.5" />} label="Session Info" />
                <div className="space-y-2">
                  <AutoField
                    icon={<CalendarClock className="h-4 w-4" />}
                    label="Date & Time In"
                    value={format(now, 'dd MMM yyyy  HH:mm:ss')}
                  />
                  <AutoField
                    icon={<User className="h-4 w-4" />}
                    label="Received By"
                    value={user ? `${user.firstName} ${user.lastName}` : '—'}
                  />
                  <AutoField
                    icon={<Hash className="h-4 w-4" />}
                    label="Batch Reference"
                    value={batchRef}
                  />
                </div>
              </div>

            </form>
          </Form>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-border/60 bg-muted/30 px-6 py-4 flex items-center gap-3 shrink-0">
          <div className="flex-1 hidden sm:block">
            {scanned.length > 0 ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {scanned.length} {unitLabel.toLowerCase()} ready to record
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add at least one serial to record stock
              </p>
            )}
          </div>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading} className="min-w-20">
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-stock-form"
            variant="ocean"
            disabled={isLoading || scanned.length === 0}
            className="min-w-40"
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording…</>
            ) : (
              <><Plus className="mr-2 h-4 w-4" />Record {scanned.length || ''} {scanned.length ? unitLabel : 'Stock'}</>
            )}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};
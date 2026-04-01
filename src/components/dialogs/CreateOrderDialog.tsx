/**
 * CreateOrderDialog
 * src/components/dialogs/CreateOrderDialog.tsx
 *
 * Allows a client_admin / site_manager to place an order on behalf
 * of any customer (phone / WhatsApp orders).
 *
 * POST /api/orders/admin-create/
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch }   from '@/components/ui/switch';
import { Badge }    from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Phone, User, Plus, Minus, Loader2, ShoppingCart,
  Truck, Calendar, Clock, MapPin, CreditCard,
  ChevronDown, Check, AlertCircle, Package, Droplets,
  Wallet, Banknote, Smartphone, FileText, Shield,
  ShieldOff, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import axiosInstance from '@/api/axios.config';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerOption {
  id:           string;
  full_name:    string;
  phone_number: string;
  email:        string | null;
  status:       string;
  addresses:    AddressOption[];
}

interface AddressOption {
  id:         string;
  label:      string;
  address:    string;
  is_default: boolean;
}

interface ProductOption {
  id:           string;
  name:         string;
  unit:         string;
  selling_price: string;
  delivery_fee: string;
  is_available: boolean;
  is_returnable?: boolean;
}

interface CartItem {
  product: ProductOption;
  quantity: number;
}

export interface CreateOrderDialogProps {
  open:      boolean;
  onClose:   () => void;
  onCreated: (order: { id: string; order_number: string; customer_name: string }) => void;
  /** Pre-select a customer (when opened from customer profile) */
  preselectedCustomerId?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIME_SLOTS = [
  '7:00 AM – 9:00 AM',
  '9:00 AM – 11:00 AM',
  '10:00 AM – 12:00 PM',
  '11:00 AM – 1:00 PM',
  '12:00 PM – 2:00 PM',
  '1:00 PM – 3:00 PM',
  '2:00 PM – 4:00 PM',
  '3:00 PM – 5:00 PM',
  '4:00 PM – 6:00 PM',
];

const PAYMENT_METHODS = [
  { value: 'CASH',   label: 'Cash on Delivery', icon: <Banknote   className="h-4 w-4 text-amber-600"  /> },
  { value: 'MPESA',  label: 'M-Pesa',           icon: <Smartphone className="h-4 w-4 text-green-600"  /> },
  { value: 'WALLET', label: 'Wallet',            icon: <Wallet     className="h-4 w-4 text-blue-600"   /> },
  { value: 'CREDIT', label: 'Invoice (Credit)',  icon: <FileText   className="h-4 w-4 text-purple-600" /> },
];

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ icon: React.ReactNode; label: string; step: number }> = ({
  icon, label, step,
}) => (
  <div className="flex items-center gap-2.5 mb-3">
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
      {step}
    </div>
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <p className="text-sm font-semibold">{label}</p>
    </div>
  </div>
);

// ── Main Dialog ───────────────────────────────────────────────────────────────

export const CreateOrderDialog: React.FC<CreateOrderDialogProps> = ({
  open, onClose, onCreated, preselectedCustomerId,
}) => {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [customers,     setCustomers]     = useState<CustomerOption[]>([]);
  const [products,      setProducts]      = useState<ProductOption[]>([]);
  const [loadingData,   setLoadingData]   = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [selectedCustomer,  setSelectedCustomer]  = useState<CustomerOption | null>(null);
  const [customerOpen,      setCustomerOpen]      = useState(false);
  const [customerSearch,    setCustomerSearch]    = useState('');

  const [cart,              setCart]              = useState<CartItem[]>([]);

  const [addressMode,       setAddressMode]       = useState<'saved' | 'new'>('saved');
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [newAddressText,    setNewAddressText]    = useState('');
  const [newAddressLabel,   setNewAddressLabel]   = useState('');

  const [scheduledDate,     setScheduledDate]     = useState(todayStr());
  const [timeSlot,          setTimeSlot]          = useState(TIME_SLOTS[2]);
  const [paymentMethod,     setPaymentMethod]     = useState('CASH');
  const [requireOtp,        setRequireOtp]        = useState(true);
  const [notes,             setNotes]             = useState('');

  const [isSubmitting,      setIsSubmitting]      = useState(false);
  const [errors,            setErrors]            = useState<Record<string, string>>({});

  // ── Load data on open ─────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [custRes, prodRes] = await Promise.all([
        axiosInstance.get('/customers/', { params: { limit: 200 } }),
        axiosInstance.get('/products/'),
      ]);
      const custList: CustomerOption[] = (custRes.data?.data ?? custRes.data ?? []).map(
        (c: Record<string, unknown>) => ({
          id:           c.id as string,
          full_name:    c.full_name as string,
          phone_number: c.phone_number as string,
          email:        (c.email ?? null) as string | null,
          status:       c.status as string,
          addresses:    [],
        }),
      );
      setCustomers(custList);
      setProducts(prodRes.data?.data ?? prodRes.data ?? []);
    } catch {
      toast.error('Could not load customers / products.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadData();
      // Reset form
      setSelectedCustomer(null);
      setCart([]);
      setAddressMode('saved');
      setSelectedAddressId('');
      setNewAddressText('');
      setNewAddressLabel('');
      setScheduledDate(todayStr());
      setTimeSlot(TIME_SLOTS[2]);
      setPaymentMethod('CASH');
      setRequireOtp(true);
      setNotes('');
      setErrors({});
    }
  }, [open, loadData]);

  // ── Load customer addresses when customer is selected ─────────────────────

  useEffect(() => {
    if (!selectedCustomer) return;
    axiosInstance
      .get(`/customers/${selectedCustomer.id}/`)
      .then(r => {
        const addrs: AddressOption[] = r.data.addresses ?? [];
        setSelectedCustomer(prev => prev ? { ...prev, addresses: addrs } : prev);
        const def = addrs.find(a => a.is_default) ?? addrs[0];
        if (def) {
          setSelectedAddressId(def.id);
          setAddressMode('saved');
        } else {
          setAddressMode('new');
        }
      })
      .catch(() => {});
  }, [selectedCustomer?.id]);

  // ── Preselect customer ────────────────────────────────────────────────────

  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0) {
      const found = customers.find(c => c.id === preselectedCustomerId);
      if (found) setSelectedCustomer(found);
    }
  }, [preselectedCustomerId, customers]);

  // ── Cart helpers ──────────────────────────────────────────────────────────

  const updateCart = (product: ProductOption, delta: number) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (!existing) {
        if (delta > 0) return [...prev, { product, quantity: delta }];
        return prev;
      }
      const newQty = existing.quantity + delta;
      if (newQty <= 0) return prev.filter(c => c.product.id !== product.id);
      return prev.map(c => c.product.id === product.id ? { ...c, quantity: newQty } : c);
    });
  };

  const cartQty = (productId: string) =>
    cart.find(c => c.product.id === productId)?.quantity ?? 0;

  const subtotal     = cart.reduce((s, c) => s + parseFloat(c.product.selling_price) * c.quantity, 0);
  const deliveryFee  = cart.reduce((max, c) => {
    const f = parseFloat(c.product.delivery_fee || '0');
    return f > max ? f : max;
  }, 0);
  const orderTotal   = subtotal + deliveryFee;

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!selectedCustomer)     e.customer = 'Select a customer';
    if (cart.length === 0)     e.cart     = 'Add at least one product';
    if (addressMode === 'saved' && !selectedAddressId)
      e.address = 'Select a delivery address';
    if (addressMode === 'new' && !newAddressText.trim())
      e.address = 'Enter a delivery address';
    if (!scheduledDate)        e.date     = 'Select a delivery date';
    if (!timeSlot)             e.slot     = 'Select a time slot';
    if (!paymentMethod)        e.payment  = 'Select a payment method';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const addressPayload = addressMode === 'saved'
        ? { delivery_address_id: selectedAddressId }
        : { delivery_address_text: newAddressText.trim(), delivery_address_label: newAddressLabel || 'Delivery address' };

      const payload = {
        customer_id:          selectedCustomer!.id,
        ...addressPayload,
        scheduled_date:       scheduledDate,
        scheduled_time_slot:  timeSlot,
        items:                cart.map(c => ({ product_id: c.product.id, quantity: c.quantity })),
        payment_method:       paymentMethod,
        require_otp:          requireOtp,
        special_instructions: notes,
      };

      const res = await axiosInstance.post('/orders/admin-create/', payload);
      const order = res.data;

      toast.success(`Order ${order.order_number} created for ${selectedCustomer!.full_name}`);
      onCreated({ id: order.id, order_number: order.order_number, customer_name: selectedCustomer!.full_name });
      onClose();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const msg =
        (errData?.non_field_errors as string[] | undefined)?.[0] ??
        (errData?.detail as string | undefined) ??
        'Failed to create order. Please try again.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Filtered customer list ────────────────────────────────────────────────

  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.phone_number.includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    );
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] mx-auto rounded-2xl max-h-[92vh] overflow-y-auto p-0 gap-0">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 rounded-t-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-bold text-base leading-tight">Create Order</p>
                <p className="text-xs text-muted-foreground font-normal">
                  Place an order on behalf of a customer
                </p>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Create a manual order on behalf of a customer
            </DialogDescription>
          </DialogHeader>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-6">

            {/* ── Manual order badge ── */}
            <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                This creates a <strong>manual order</strong> on behalf of the customer.
                It will appear in their order history and be assigned to a driver as normal.
              </p>
            </div>

            {/* ── Step 1: Customer ── */}
            <div>
              <SectionLabel step={1} icon={<User className="h-3.5 w-3.5" />} label="Customer" />

              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-3 rounded-xl border text-left transition-colors',
                      selectedCustomer
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border hover:border-primary/30',
                      errors.customer && 'border-destructive',
                    )}
                  >
                    {selectedCustomer ? (
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary text-sm">
                          {selectedCustomer.full_name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{selectedCustomer.full_name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" />{selectedCustomer.phone_number}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Search customer…</span>
                    )}
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 rounded-xl" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search by name or phone…"
                      value={customerSearch}
                      onValueChange={setCustomerSearch}
                    />
                    <CommandList className="max-h-64">
                      <CommandEmpty>No customers found.</CommandEmpty>
                      <CommandGroup>
                        {filteredCustomers.map(c => (
                          <CommandItem
                            key={c.id}
                            value={c.id}
                            onSelect={() => {
                              setSelectedCustomer(c);
                              setCustomerOpen(false);
                              setCustomerSearch('');
                            }}
                            className="flex items-center gap-3 px-3 py-2.5"
                          >
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 font-semibold text-sm">
                              {c.full_name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.full_name}</p>
                              <p className="text-xs text-muted-foreground">{c.phone_number}</p>
                            </div>
                            {selectedCustomer?.id === c.id && (
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.customer && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.customer}
                </p>
              )}
            </div>

            {/* ── Step 2: Products ── */}
            <div>
              <SectionLabel step={2} icon={<Package className="h-3.5 w-3.5" />} label="Products" />
              <div className="space-y-2">
                {products.filter(p => p.is_available).map(product => {
                  const qty = cartQty(product.id);
                  const fee = parseFloat(product.delivery_fee || '0');
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        'flex items-center gap-3 p-3.5 border rounded-xl transition-colors',
                        qty > 0 ? 'border-primary/40 bg-primary/5' : 'border-border',
                      )}
                    >
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        {product.unit === 'LITRES'
                          ? <Droplets className="h-4 w-4 text-sky-500" />
                          : <Package  className="h-4 w-4 text-violet-500" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs font-medium text-primary">
                            KES {parseFloat(product.selling_price).toLocaleString()}
                          </span>
                          {fee > 0
                            ? <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Truck className="h-2.5 w-2.5" />KES {fee.toLocaleString()} delivery</span>
                            : <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5"><Truck className="h-2.5 w-2.5" />Free delivery</span>
                          }
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline" size="icon" className="h-8 w-8 rounded-lg"
                          disabled={qty === 0}
                          onClick={() => updateCart(product, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-7 text-center text-sm font-bold tabular-nums">{qty}</span>
                        <Button
                          variant="outline" size="icon" className="h-8 w-8 rounded-lg"
                          onClick={() => updateCart(product, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {errors.cart && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.cart}
                </p>
              )}

              {/* Cart summary */}
              {cart.length > 0 && (
                <div className="mt-3 rounded-xl border bg-muted/30 p-3 space-y-1.5 text-sm">
                  {cart.map(c => (
                    <div key={c.product.id} className="flex justify-between">
                      <span className="text-muted-foreground">{c.product.name} ×{c.quantity}</span>
                      <span className="font-medium">KES {(parseFloat(c.product.selling_price) * c.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t pt-1.5 flex justify-between">
                    <span className="text-muted-foreground">Delivery</span>
                    <span>{deliveryFee > 0 ? `KES ${deliveryFee.toLocaleString()}` : 'Free'}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>KES {orderTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Step 3: Delivery Address ── */}
            <div>
              <SectionLabel step={3} icon={<MapPin className="h-3.5 w-3.5" />} label="Delivery Address" />

              {selectedCustomer && (selectedCustomer.addresses ?? []).length > 0 && (
                <div className="flex gap-2 mb-3">
                  {(['saved', 'new'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setAddressMode(m)}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors',
                        addressMode === m
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border',
                      )}
                    >
                      {m === 'saved' ? 'Saved addresses' : 'New address'}
                    </button>
                  ))}
                </div>
              )}

              {addressMode === 'saved' && (selectedCustomer?.addresses ?? []).length > 0 ? (
                <div className="space-y-2">
                  {selectedCustomer!.addresses.map(addr => (
                    <button
                      key={addr.id}
                      onClick={() => setSelectedAddressId(addr.id)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 border rounded-xl text-left transition-colors',
                        selectedAddressId === addr.id
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border hover:bg-muted/30',
                      )}
                    >
                      <MapPin className={cn(
                        'h-4 w-4 shrink-0 mt-0.5',
                        selectedAddressId === addr.id ? 'text-primary' : 'text-muted-foreground',
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{addr.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{addr.address}</p>
                      </div>
                      {addr.is_default && <Badge variant="secondary" className="text-[10px] shrink-0">Default</Badge>}
                      {selectedAddressId === addr.id && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Enter delivery address"
                    value={newAddressText}
                    onChange={e => setNewAddressText(e.target.value)}
                    className={cn('h-10', errors.address && 'border-destructive')}
                  />
                  <Input
                    placeholder='Label e.g. "Home", "Office" (optional)'
                    value={newAddressLabel}
                    onChange={e => setNewAddressLabel(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              )}
              {errors.address && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.address}
                </p>
              )}
              {!selectedCustomer && (
                <p className="text-xs text-muted-foreground italic mt-1">Select a customer first to see their saved addresses.</p>
              )}
            </div>

            {/* ── Step 4: Schedule ── */}
            <div>
              <SectionLabel step={4} icon={<Calendar className="h-3.5 w-3.5" />} label="Delivery Schedule" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />Date
                  </Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    min={todayStr()}
                    onChange={e => setScheduledDate(e.target.value)}
                    className={cn('h-10', errors.date && 'border-destructive')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />Time Slot
                  </Label>
                  <Select value={timeSlot} onValueChange={setTimeSlot}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map(slot => (
                        <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Step 5: Payment ── */}
            <div>
              <SectionLabel step={5} icon={<CreditCard className="h-3.5 w-3.5" />} label="Payment Method" />
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
                    className={cn(
                      'flex items-center gap-2.5 p-3 border rounded-xl text-left transition-colors',
                      paymentMethod === m.value
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border hover:bg-muted/30',
                    )}
                  >
                    {m.icon}
                    <span className="text-sm font-medium">{m.label}</span>
                    {paymentMethod === m.value && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Step 6: OTP setting ── */}
            <div className="rounded-xl border overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2.5">
                  {requireOtp
                    ? <Shield    className="h-4 w-4 text-emerald-600" />
                    : <ShieldOff className="h-4 w-4 text-muted-foreground" />
                  }
                  <div>
                    <p className="text-sm font-semibold">Delivery Verification (OTP)</p>
                    <p className="text-xs text-muted-foreground">
                      {requireOtp
                        ? 'Customer will receive a code to confirm receipt'
                        : 'Driver can complete delivery without customer code'
                      }
                    </p>
                  </div>
                </div>
                <Switch
                  checked={requireOtp}
                  onCheckedChange={setRequireOtp}
                />
              </div>
              {!requireOtp && (
                <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-100">
                  <p className="text-[11px] text-amber-700 flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    OTP disabled — suitable for phone/WhatsApp orders where customer has no app access.
                    Empty bottle collection will still be recorded.
                  </p>
                </div>
              )}
            </div>

            {/* ── Notes ── */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                Special Instructions
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="e.g. Call before arriving / leave at gate / 2 empties to collect"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
              />
            </div>

          </div>
        )}

        {/* Footer */}
        <DialogFooter className="sticky bottom-0 bg-background border-t px-6 py-4 rounded-b-2xl flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || loadingData}
            className="flex-1 gap-2"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Creating Order…</>
            ) : (
              <><ShoppingCart className="h-4 w-4" />Create Order</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
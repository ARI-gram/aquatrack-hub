/// <reference types="@types/google.maps" />
/**
 * Place Order Page — Customer Portal
 * src/pages/customer/PlaceOrderPage.tsx
 *
 * Delivery fee changes:
 *  - Removed hardcoded DELIVERY_FEE = 50
 *  - Each product contributes its own delivery_fee × qty to the order total
 *  - ProductCard shows the per-unit delivery fee (or "Free delivery")
 *  - Order Summary breaks out delivery per line item, then totals
 *  - Zero-fee products show a green "Free delivery" badge
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import {
  CalendarIcon, Plus, Minus, ShoppingCart, Wallet, Banknote,
  Smartphone, Clock, AlertCircle, ChevronRight, Lock,
  CreditCard, AlertTriangle, ArrowRight, FileText, Package,
  Loader2, Droplets, MapPin, Navigation, CheckCircle2, PencilLine,
  User, Phone, Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import axiosInstance from '@/api/axios.config';
import { CUSTOMER_API_ENDPOINTS } from '@/api/customerEndpoints';
import {
  CreditStatusBanner,
  type CreditStatus,
} from '@/components/customer/CreditStatusBanner';
import { type CustomerProduct } from '@/types/products.types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerProfile {
  id:           string;
  full_name:    string;
  phone_number: string;
  email:        string;
}

interface Address {
  id:         string;
  label:      string;
  address:    string;
  is_default: boolean;
}

interface PaymentProfile {
  preferred_payment_method: string;
  mpesa_phone:              string;
  has_credit:               boolean;
  credit_terms_display:     string;
  available_credit:         string;
  currency:                 string;
}

interface DRFErrorResponse {
  non_field_errors?: string[];
  detail?:           string;
  [key: string]:     string[] | string | undefined;
}

type AddressPayload =
  | { delivery_address_id: string }
  | { delivery_address_text: string; delivery_address_label: string };

const TIME_SLOTS = [
  '7:00 AM – 10:00 AM',
  '10:00 AM – 1:00 PM',
  '1:00 PM – 4:00 PM',
  '4:00 PM – 7:00 PM',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const paymentMethodIcon = (method: string): React.ReactNode => {
  switch (method) {
    case 'MPESA':  return <Smartphone className="h-4 w-4 text-green-600" />;
    case 'CASH':   return <Banknote   className="h-4 w-4 text-amber-600" />;
    case 'WALLET': return <Wallet     className="h-4 w-4 text-blue-600"  />;
    case 'CREDIT': return <Clock      className="h-4 w-4 text-purple-600"/>;
    default:       return <Wallet     className="h-4 w-4" />;
  }
};

const paymentMethodLabel = (method: string, mpesaPhone?: string): string => {
  switch (method) {
    case 'MPESA':  return `M-Pesa${mpesaPhone ? ` (…${mpesaPhone.slice(-4)})` : ''}`;
    case 'CASH':   return 'Cash on Delivery';
    case 'WALLET': return 'Wallet Balance';
    case 'CREDIT': return 'Pay Later (Invoice)';
    default:       return method;
  }
};

function extractErrorMessage(data: DRFErrorResponse): string {
  if (data.non_field_errors?.[0]) return data.non_field_errors[0];
  if (data.detail) return data.detail;
  const firstKey = Object.keys(data)[0];
  if (firstKey) {
    const val = data[firstKey];
    if (typeof val === 'string') return val;
    if (Array.isArray(val) && val.length > 0) return String(val[0]);
  }
  return 'Failed to place order. Please try again.';
}

// ── Delivery fee helpers ──────────────────────────────────────────────────────

/** Per-unit delivery fee for a product (0 if not set) */
const productDeliveryFee = (p: CustomerProduct): number =>
  parseFloat(p.delivery_fee ?? '0') || 0;

// ── Credit state ──────────────────────────────────────────────────────────────

type CreditState = 'active' | 'overdue' | 'frozen' | 'none';

function deriveCreditState(
  creditStatus:   CreditStatus | null,
  paymentProfile: PaymentProfile | null,
): CreditState {
  const isCreditCustomer =
    creditStatus?.credit_enabled === true || paymentProfile?.has_credit === true;
  if (!isCreditCustomer) return 'none';
  if (creditStatus?.account_frozen) return 'frozen';
  if (creditStatus?.is_in_grace_period) return 'overdue';
  return 'active';
}

// ── Google Maps loader ────────────────────────────────────────────────────────

declare global {
  interface Window { initGoogleMaps?: () => void; }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) { resolve(); return; }
    const existing = document.getElementById('google-maps-script');
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    window.initGoogleMaps = () => resolve();
    const script = document.createElement('script');
    script.id     = 'google-maps-script';
    script.src    = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
    script.async  = true;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ── Smart Address Input ───────────────────────────────────────────────────────

interface SmartAddressInputProps {
  savedAddresses:  Address[];
  onAddressChange: (payload: AddressPayload | null) => void;
}

const SmartAddressInput: React.FC<SmartAddressInputProps> = ({
  savedAddresses,
  onAddressChange,
}) => {
  const addrs: Address[] = Array.isArray(savedAddresses) ? savedAddresses : [];
  const MAPS_API_KEY     = import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '';

  const [mode,            setMode]            = useState<'saved' | 'new'>('saved');
  const [selectedId,      setSelectedId]      = useState<string | null>(null);
  const [newAddressText,  setNewAddressText]  = useState('');
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [mapsReady,       setMapsReady]       = useState(false);

  const inputRef        = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (addrs.length === 0) { setMode('new'); return; }
    const def = addrs.find(a => a.is_default) ?? addrs[0];
    setSelectedId(def.id);
    onAddressChange({ delivery_address_id: def.id });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAddresses]);

  useEffect(() => {
    if (!MAPS_API_KEY) return;
    loadGoogleMaps(MAPS_API_KEY)
      .then(() => setMapsReady(true))
      .catch(() => {});
  }, [MAPS_API_KEY]);

  useEffect(() => {
    if (mode !== 'new' || !mapsReady || !inputRef.current) return;
    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'ke' },
      fields: ['formatted_address', 'geometry', 'name'],
      types:  ['geocode', 'establishment'],
    });
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current!.getPlace();
      const text  = place.formatted_address ?? place.name ?? '';
      setNewAddressText(text);
      onAddressChange({
        delivery_address_text:  text,
        delivery_address_label: newAddressLabel || 'Delivery address',
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mapsReady]);

  const handleSavedSelect = (id: string) => {
    setSelectedId(id);
    onAddressChange({ delivery_address_id: id });
  };

  const handleNewTextChange = (value: string) => {
    setNewAddressText(value);
    onAddressChange(
      value.trim()
        ? { delivery_address_text: value.trim(), delivery_address_label: newAddressLabel || 'Delivery address' }
        : null,
    );
  };

  const handleLabelChange = (value: string) => {
    setNewAddressLabel(value);
    if (newAddressText.trim()) {
      onAddressChange({
        delivery_address_text:  newAddressText.trim(),
        delivery_address_label: value || 'Delivery address',
      });
    }
  };

  const switchToSaved = () => {
    const def = addrs.find(a => a.is_default) ?? addrs[0];
    setSelectedId(def.id);
    onAddressChange({ delivery_address_id: def.id });
    setMode('saved');
  };

  const switchToNew = () => {
    onAddressChange(null);
    setMode('new');
  };

  return (
    <div className="space-y-3">
      {addrs.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Delivery Address</Label>
            <button
              type="button"
              onClick={mode === 'saved' ? switchToNew : switchToSaved}
              className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              {mode === 'saved'
                ? <><PencilLine className="h-3 w-3" /> Use a different address</>
                : <><CheckCircle2 className="h-3 w-3" /> Use saved address</>
              }
            </button>
          </div>

          {mode === 'saved' && (
            <RadioGroup
              value={selectedId?.toString() ?? ''}
              onValueChange={v => handleSavedSelect(v)}
              className="space-y-2"
            >
              {addrs.map(addr => (
                <div
                  key={addr.id}
                  className={cn(
                    'flex items-center gap-3 p-3 border rounded-xl transition-colors cursor-pointer',
                    selectedId === addr.id
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border hover:bg-muted/30',
                  )}
                  onClick={() => handleSavedSelect(addr.id)}
                >
                  <RadioGroupItem value={addr.id.toString()} id={`addr-${addr.id}`} />
                  <MapPin className={cn(
                    'h-4 w-4 shrink-0',
                    selectedId === addr.id ? 'text-primary' : 'text-muted-foreground',
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{addr.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{addr.address}</p>
                  </div>
                  {addr.is_default && (
                    <Badge variant="secondary" className="text-xs shrink-0">Default</Badge>
                  )}
                </div>
              ))}
            </RadioGroup>
          )}
        </>
      )}

      {(mode === 'new' || addrs.length === 0) && (
        <div className="space-y-3">
          {addrs.length === 0 && <Label className="text-sm font-medium">Delivery Address</Label>}

          <div className="relative">
            {mapsReady
              ? <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
              : <MapPin     className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            }
            <Input
              ref={inputRef}
              placeholder={mapsReady ? 'Search for your location…' : 'Enter your delivery address'}
              value={newAddressText}
              onChange={e => handleNewTextChange(e.target.value)}
              className="pl-9 h-10"
            />
            {mapsReady && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                Maps
              </span>
            )}
          </div>

          <Input
            placeholder='Label e.g. "Home", "Office" (optional)'
            value={newAddressLabel}
            onChange={e => handleLabelChange(e.target.value)}
            className="h-9 text-sm"
          />

          {newAddressText && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              This address will be saved to your profile for next time.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Outstanding balance banner ────────────────────────────────────────────────

const OutstandingBalanceBanner: React.FC<{
  creditStatus:     CreditStatus;
  creditState:      CreditState;
  onPayOutstanding: () => void;
}> = ({ creditStatus, creditState, onPayOutstanding }) => {
  if (creditState === 'active') return null;
  const outstanding = parseFloat(creditStatus.outstanding_balance ?? '0');
  if (outstanding <= 0) return null;
  const isFrozen = creditState === 'frozen';

  return (
    <div className={cn(
      'rounded-xl border p-4 flex flex-col sm:flex-row sm:items-start gap-4',
      isFrozen ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200',
    )}>
      <div className="flex items-start gap-3 flex-1">
        {isFrozen
          ? <Lock          className="h-5 w-5 text-red-600   shrink-0 mt-0.5" />
          : <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        }
        <div>
          <p className={cn('font-semibold text-sm', isFrozen ? 'text-red-900' : 'text-amber-900')}>
            {isFrozen ? 'Account Frozen — Outstanding Balance' : 'Invoice Overdue — Grace Period Active'}
          </p>
          <p className={cn('text-xs mt-0.5', isFrozen ? 'text-red-700' : 'text-amber-700')}>
            {isFrozen
              ? `Your account is frozen due to an unpaid invoice of KES ${outstanding.toLocaleString()}.`
              : `You have an overdue invoice of KES ${outstanding.toLocaleString()}. ${creditStatus.grace_days_remaining ?? 0} grace day(s) remaining.`
            }
          </p>
        </div>
      </div>
      <Button
        variant={isFrozen ? 'destructive' : 'outline'} size="sm"
        className={cn('shrink-0 gap-1.5', !isFrozen && 'border-amber-400 text-amber-800 hover:bg-amber-100')}
        onClick={onPayOutstanding}
      >
        <FileText className="h-3.5 w-3.5" />
        {isFrozen ? 'Pay to Unfreeze' : 'Pay Outstanding'}
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

// ── Product card ──────────────────────────────────────────────────────────────

const ProductCard: React.FC<{
  product:  CustomerProduct;
  qty:      number;
  onAdd:    () => void;
  onRemove: () => void;
}> = ({ product, qty, onAdd, onRemove }) => {
  const price    = parseFloat(product.selling_price);
  const fee      = productDeliveryFee(product);
  const hasFee   = fee > 0;

  return (
    <div className={cn(
      'flex items-center justify-between p-4 border rounded-xl gap-3 transition-colors',
      qty > 0 && 'border-primary/40 bg-primary/5',
    )}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {product.image_url ? (
          <img
            src={product.image_url} alt={product.name}
            className="h-12 w-12 rounded-lg object-cover shrink-0 border"
          />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {product.unit === 'LITRES'
              ? <Droplets className="h-5 w-5 text-sky-500"    />
              : <Package  className="h-5 w-5 text-violet-500" />}
          </div>
        )}
        <div className="min-w-0">
          <h4 className="font-medium text-sm">{product.name}</h4>
          {product.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="font-semibold text-primary text-sm">KES {price.toLocaleString()}</p>
            {product.has_deposit && product.deposit_amount && (
              <p className="text-xs text-muted-foreground">
                + KES {parseFloat(product.deposit_amount).toLocaleString()} deposit
              </p>
            )}
            {/* ── Delivery fee badge ── */}
            {hasFee ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Truck className="h-3 w-3" />
                KES {fee.toLocaleString()} delivery
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Truck className="h-3 w-3" />
                Free delivery
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onRemove} disabled={!qty}>
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-7 text-center text-sm font-semibold">{qty}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onAdd}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const PlaceOrderPage: React.FC = () => {
  const navigate = useNavigate();

  const [profile,         setProfile]         = useState<CustomerProfile | null>(null);
  const [products,        setProducts]        = useState<CustomerProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [cart,            setCart]            = useState<Record<string, number>>({});
  const [addresses,       setAddresses]       = useState<Address[]>([]);
  const [addressPayload,  setAddressPayload]  = useState<AddressPayload | null>(null);
  const [deliveryDate,    setDeliveryDate]    = useState<Date | undefined>();
  const [timeSlot,        setTimeSlot]        = useState(TIME_SLOTS[0]);
  const [notes,           setNotes]           = useState('');
  const [paymentProfile,  setPaymentProfile]  = useState<PaymentProfile | null>(null);
  const [paymentMethod,   setPaymentMethod]   = useState<string>('');
  const [dataLoaded,      setDataLoaded]      = useState(false);
  const [creditStatus,    setCreditStatus]    = useState<CreditStatus | null>(null);
  const [isSubmitting,    setIsSubmitting]    = useState(false);

  const creditState = deriveCreditState(creditStatus, paymentProfile);

  // ── Load products ─────────────────────────────────────────────────────────

  useEffect(() => {
    axiosInstance
      .get<CustomerProduct[]>(CUSTOMER_API_ENDPOINTS.PRODUCTS.LIST)
      .then(res => setProducts(res.data))
      .catch(() => toast.error('Could not load products. Please refresh.'))
      .finally(() => setProductsLoading(false));
  }, []);

  // ── Load account data ─────────────────────────────────────────────────────

  const loadCreditStatus = async () => {
    try {
      const res = await axiosInstance.get<CreditStatus>(CUSTOMER_API_ENDPOINTS.CREDIT.STATUS);
      setCreditStatus(res.data);
    } catch { setCreditStatus(null); }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axiosInstance.get<CustomerProfile>(CUSTOMER_API_ENDPOINTS.PROFILE.GET);
        setProfile(res.data);
      } catch { /* non-fatal */ }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await axiosInstance.get<any>(CUSTOMER_API_ENDPOINTS.PROFILE.ADDRESSES);
        const data: Address[] = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.results) ? res.data.results : [];
        setAddresses(data);
      } catch { setAddresses([]); }

      let resolvedCreditStatus: CreditStatus | null = null;
      try {
        const r = await axiosInstance.get<CreditStatus>(CUSTOMER_API_ENDPOINTS.CREDIT.STATUS);
        resolvedCreditStatus = r.data;
        setCreditStatus(r.data);
      } catch { setCreditStatus(null); }

      let resolvedProfile: PaymentProfile | null = null;
      try {
        const r = await axiosInstance.get<PaymentProfile>(CUSTOMER_API_ENDPOINTS.PROFILE.PAYMENT_PROFILE);
        resolvedProfile = r.data;
        setPaymentProfile(r.data);
      } catch { /* credit customers won't have this */ }

      const state = deriveCreditState(resolvedCreditStatus, resolvedProfile);
      if (state === 'active') {
        setPaymentMethod('CREDIT');
      } else if (state === 'none' && resolvedProfile) {
        const preferred = resolvedProfile.preferred_payment_method;
        setPaymentMethod(preferred !== 'CREDIT' ? preferred : 'CASH');
      }

      setDataLoaded(true);
    };
    load();
  }, [navigate]);

  // ── Cart ──────────────────────────────────────────────────────────────────

  const updateCart = (productId: string, delta: number) => {
    setCart(prev => {
      const next = { ...prev };
      const qty  = (next[productId] ?? 0) + delta;
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  };

  /** Subtotal of product prices only (no delivery) */
  const cartSubtotal = () =>
    Object.entries(cart).reduce((sum, [id, qty]) => {
      const p = products.find(p => p.id === id);
      return sum + parseFloat(p?.selling_price ?? '0') * qty;
    }, 0);

  /** Total delivery fees across all cart items */
  const cartDeliveryTotal = () =>
    Object.entries(cart).reduce((sum, [id, qty]) => {
      const p = products.find(p => p.id === id);
      return sum + productDeliveryFee(p!) * qty;
    }, 0);

  const cartCount    = () => Object.values(cart).reduce((s, q) => s + q, 0);
  const orderTotal   = () => cartSubtotal() + cartDeliveryTotal();

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (cartCount() === 0) { toast.error('Add items to your cart'); return; }
    if (!addressPayload)   { toast.error('Please enter a delivery address'); return; }
    if (!deliveryDate)     { toast.error('Select a delivery date'); return; }
    if (creditState === 'frozen' && (!paymentMethod || paymentMethod === 'CREDIT')) {
      toast.error('Your credit account is frozen. Choose another payment method.');
      return;
    }
    if (!paymentMethod) { toast.error('Please select a payment method'); return; }

    setIsSubmitting(true);
    try {
      await axiosInstance.post(CUSTOMER_API_ENDPOINTS.ORDERS.CREATE, {
        ...addressPayload,
        scheduled_date:       format(deliveryDate, 'yyyy-MM-dd'),
        scheduled_time_slot:  timeSlot,
        items:                Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity })),
        payment_method:       paymentMethod,
        special_instructions: notes,
        ...(profile && {
          customer_name:  profile.full_name,
          customer_phone: profile.phone_number,
        }),
      });

      toast.success(
        paymentMethod === 'MPESA'  ? 'Order placed! Check your phone for the M-Pesa prompt.' :
        paymentMethod === 'CREDIT' ? 'Order placed! It will appear on your next invoice.'    :
                                     'Order placed successfully!',
      );
      navigate('/customer');
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: DRFErrorResponse } };
      const msg = errObj.response?.data
        ? extractErrorMessage(errObj.response.data)
        : 'Failed to place order. Please try again.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayOutstanding = () => navigate('/customer/wallet');

  const altPaymentMethods: string[] = (() => {
    if (creditState === 'none') {
      return [
        ...(paymentProfile ? [paymentProfile.preferred_payment_method] : []),
        'CASH',
      ].filter((v, i, a) => v !== 'CREDIT' && a.indexOf(v) === i);
    }
    if (creditState === 'active') return [];
    return [
      ...(paymentProfile && paymentProfile.preferred_payment_method !== 'CREDIT'
        ? [paymentProfile.preferred_payment_method] : []),
      'CASH', 'WALLET', 'MPESA',
    ].filter((v, i, a) => v !== 'CREDIT' && a.indexOf(v) === i);
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <CustomerLayout title="Place Order" showBackButton>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-6">

          {creditStatus && (creditState === 'overdue' || creditState === 'frozen') && (
            <OutstandingBalanceBanner
              creditStatus={creditStatus} creditState={creditState}
              onPayOutstanding={handlePayOutstanding}
            />
          )}

          {creditState === 'active' && (
            <CreditStatusBanner
              creditStatus={creditStatus}
              onRequestSubmitted={loadCreditStatus}
              variant="compact"
            />
          )}

          {dataLoaded && !paymentProfile && creditState === 'none' && (
            <div
              role="button" tabIndex={0}
              className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors"
              onClick={() => navigate('/customer/payment-profile')}
              onKeyDown={e => e.key === 'Enter' && navigate('/customer/payment-profile')}
            >
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 text-sm">Payment details not set up</p>
                <p className="text-xs text-amber-700">Register your M-Pesa or payment method to continue.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-amber-600" />
            </div>
          )}

          {/* ── Products ── */}
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Select Products</h3>
            {productsLoading ? (
              <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading products…</span>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                <Package className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">No products available</p>
                <p className="text-xs text-muted-foreground">
                  Your distributor hasn't set up any products yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    qty={cart[product.id] ?? 0}
                    onAdd={() => updateCart(product.id, 1)}
                    onRemove={() => updateCart(product.id, -1)}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* ── Delivery ── */}
          <Card className="p-5 space-y-5">
            <h3 className="font-semibold">Delivery Details</h3>

            <SmartAddressInput
              savedAddresses={addresses}
              onAddressChange={setAddressPayload}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delivery Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left font-normal', !deliveryDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deliveryDate ? format(deliveryDate, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single" selected={deliveryDate} onSelect={setDeliveryDate}
                      initialFocus disabled={(d: Date) => d < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Time Slot</Label>
                <RadioGroup value={timeSlot} onValueChange={setTimeSlot} className="space-y-1">
                  {TIME_SLOTS.map(slot => (
                    <div key={slot} className="flex items-center gap-2 p-2 border rounded-lg">
                      <RadioGroupItem value={slot} id={slot} />
                      <Label htmlFor={slot} className="text-xs cursor-pointer">{slot}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Special Instructions{' '}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </Label>
              <Textarea
                placeholder="e.g. Leave at the gate / call before arriving"
                value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              />
            </div>
          </Card>

          {/* ── Payment: active credit ── */}
          {creditState === 'active' && dataLoaded && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Payment Method</h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /><span>Managed by your distributor</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border-2 border-purple-200 bg-purple-50/50 rounded-xl">
                <div className="p-2 rounded-lg bg-purple-100"><Clock className="h-4 w-4 text-purple-600" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Pay Later (Credit Account)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This order will be added to your next invoice
                    {paymentProfile?.credit_terms_display ? ` — ${paymentProfile.credit_terms_display}` : ''}.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Available credit</p>
                  <p className="font-semibold text-sm text-purple-700">
                    KES {parseFloat(creditStatus?.available_credit ?? '0').toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* ── Payment: overdue / frozen ── */}
          {(creditState === 'overdue' || creditState === 'frozen') && dataLoaded && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Payment Method</h3>
                {creditState === 'frozen'
                  ? <Badge variant="destructive" className="gap-1 text-xs"><Lock className="h-3 w-3" /> Credit Paused</Badge>
                  : <Badge variant="warning"     className="gap-1 text-xs"><AlertTriangle className="h-3 w-3" /> Overdue</Badge>
                }
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {creditState === 'frozen'
                  ? 'Your credit account is frozen. Choose an alternative payment method.'
                  : 'Your account has an overdue invoice. You can continue on credit or pay now.'}
              </p>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
                {creditState === 'overdue' && (
                  <div className={cn('flex items-center gap-3 p-3 border rounded-xl transition-colors',
                    paymentMethod === 'CREDIT' ? 'border-purple-300 bg-purple-50/60' : 'border-border hover:bg-muted/30')}>
                    <RadioGroupItem value="CREDIT" id="pay-CREDIT" />
                    <Label htmlFor="pay-CREDIT" className="flex-1 flex items-center gap-3 cursor-pointer">
                      <div className="p-2 rounded-lg bg-purple-100"><Clock className="h-4 w-4 text-purple-600" /></div>
                      <div>
                        <p className="font-medium text-sm">Pay Later (Invoice)</p>
                        <p className="text-xs text-muted-foreground">Added to your current invoice</p>
                      </div>
                    </Label>
                  </div>
                )}
                {altPaymentMethods.map(method => (
                  <div key={method} className={cn('flex items-center gap-3 p-3 border rounded-xl transition-colors',
                    paymentMethod === method ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30')}>
                    <RadioGroupItem value={method} id={`pay-${method}`} />
                    <Label htmlFor={`pay-${method}`} className="flex-1 flex items-center gap-3 cursor-pointer">
                      <div className="p-2 rounded-lg bg-muted">{paymentMethodIcon(method)}</div>
                      <div>
                        <p className="font-medium text-sm">{paymentMethodLabel(method, paymentProfile?.mpesa_phone)}</p>
                        {method === 'MPESA'  && <p className="text-xs text-muted-foreground">STK push to your phone</p>}
                        {method === 'WALLET' && <p className="text-xs text-muted-foreground">Deducted from wallet balance</p>}
                        {method === 'CASH'   && <p className="text-xs text-muted-foreground">Pay the driver on delivery</p>}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Outstanding: KES {parseFloat(creditStatus?.outstanding_balance ?? '0').toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Paying this will {creditState === 'frozen' ? 'unfreeze your account' : 'clear your invoice'}.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handlePayOutstanding}>
                  <CreditCard className="h-3.5 w-3.5" /> Pay Invoice
                </Button>
              </div>
            </Card>
          )}

          {/* ── Payment: normal customer ── */}
          {creditState === 'none' && dataLoaded && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Payment Method</h3>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/customer/payment-profile')}>
                  Manage →
                </Button>
              </div>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
                {altPaymentMethods.map(method => (
                  <div key={method} className="flex items-center gap-3 p-3 border rounded-xl">
                    <RadioGroupItem value={method} id={`pay-${method}`} />
                    <Label htmlFor={`pay-${method}`} className="flex-1 flex items-center gap-3 cursor-pointer">
                      <div className="p-2 rounded-lg bg-muted">{paymentMethodIcon(method)}</div>
                      <div>
                        <p className="font-medium text-sm">{paymentMethodLabel(method, paymentProfile?.mpesa_phone)}</p>
                        {method === 'MPESA' && <p className="text-xs text-muted-foreground">STK push to your phone</p>}
                      </div>
                    </Label>
                  </div>
                ))}
                {altPaymentMethods.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 p-3 rounded-lg bg-amber-50">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>No payment method set up.{' '}
                      <button type="button" className="underline font-medium" onClick={() => navigate('/customer/payment-profile')}>
                        Set up now
                      </button>
                    </span>
                  </div>
                )}
              </RadioGroup>
            </Card>
          )}
        </div>

        {/* ── Order Summary ── */}
        <div className="lg:col-span-1">
          <Card className="p-5 lg:sticky lg:top-20">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> Order Summary
            </h3>

            {/* Placing order as… */}
            {profile && (
              <div className="mb-4 p-3 rounded-xl bg-muted/50 border border-border/60 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Placing order as
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <User  className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{profile.full_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{profile.phone_number}</span>
                </div>
              </div>
            )}

            {cartCount() === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">Your cart is empty</p>
            ) : (
              <>
                {/* Line items */}
                <div className="space-y-2 mb-4">
                  {Object.entries(cart).map(([productId, qty]) => {
                    const p = products.find(prod => prod.id === productId);
                    if (!p) return null;
                    const fee      = productDeliveryFee(p);
                    const lineFee  = fee * qty;
                    return (
                      <div key={productId} className="text-sm space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{p.name} ×{qty}</span>
                          <span className="font-medium">
                            KES {(parseFloat(p.selling_price) * qty).toLocaleString()}
                          </span>
                        </div>
                        {/* Per-product delivery fee line */}
                        <div className="flex justify-between text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground/70">
                            <Truck className="h-3 w-3" />
                            {fee > 0 ? `Delivery ×${qty}` : 'Free delivery'}
                          </span>
                          <span className={fee > 0 ? 'text-muted-foreground' : 'text-emerald-600 font-medium'}>
                            {fee > 0 ? `KES ${lineFee.toLocaleString()}` : 'Free'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="border-t pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>KES {cartSubtotal().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Truck className="h-3.5 w-3.5" /> Delivery
                    </span>
                    {cartDeliveryTotal() === 0
                      ? <span className="text-emerald-600 font-medium">Free</span>
                      : <span>KES {cartDeliveryTotal().toLocaleString()}</span>
                    }
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span className="text-lg">KES {orderTotal().toLocaleString()}</span>
                  </div>
                </div>

                {paymentMethod && (
                  <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-muted text-sm">
                    {paymentMethodIcon(paymentMethod)}
                    <span className="text-muted-foreground">
                      Pay via <strong className="text-foreground">
                        {paymentMethodLabel(paymentMethod, paymentProfile?.mpesa_phone)}
                      </strong>
                    </span>
                  </div>
                )}
              </>
            )}

            {creditState === 'frozen' && (!paymentMethod || paymentMethod === 'CREDIT') && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <Lock className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">Select a payment method above to place this order.</p>
              </div>
            )}

            {(creditState === 'overdue' || creditState === 'frozen') &&
              parseFloat(creditStatus?.outstanding_balance ?? '0') > 0 && (
              <div className={cn('mt-3 flex items-center justify-between p-2 rounded-lg text-xs',
                creditState === 'frozen'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200')}>
                <span>Outstanding: <strong>KES {parseFloat(creditStatus!.outstanding_balance).toLocaleString()}</strong></span>
                <button type="button" onClick={handlePayOutstanding} className="underline font-medium">Pay now</button>
              </div>
            )}

            <Button
              variant="ocean" className="w-full mt-5 h-12" onClick={handleSubmit}
              disabled={
                isSubmitting      ||
                cartCount() === 0 ||
                !addressPayload   ||
                !paymentMethod    ||
                (creditState === 'frozen' && paymentMethod === 'CREDIT')
              }
            >
              {isSubmitting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Placing Order…</>
                : creditState === 'frozen' && (!paymentMethod || paymentMethod === 'CREDIT')
                  ? <><Lock className="mr-2 h-4 w-4" />Select Payment Method</>
                  : paymentMethod === 'MPESA'  ? '📱 Place Order & Pay via M-Pesa'
                  : paymentMethod === 'CREDIT' ? '🧾 Place Order (Invoice Later)'
                  : 'Place Order'
              }
            </Button>
          </Card>
        </div>

      </div>
    </CustomerLayout>
  );
};

export default PlaceOrderPage;
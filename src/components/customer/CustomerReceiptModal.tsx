// src/components/customer/CustomerReceiptModal.tsx
//
// Receipt modal for the customer portal.
// Mirrors the driver's DeliveryReceiptModal UX exactly:
//   - Clean bottom-sheet card with customer summary
//   - Full InvoiceTemplate rendered off-screen for print/PDF
//   - WhatsApp, Print, Save PDF actions via useInvoicePrint
//   - Real accounting settings fetched from /customer/accounting-settings/
//
// Usage:
//   <CustomerReceiptModal
//     open={showReceipt}
//     onClose={() => setShowReceipt(false)}
//     order={order}
//   />

import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  X,
  Printer,
  Download,
  Share2,
  MapPin,
  Clock,
  Package,
  Droplets,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { InvoiceTemplate } from '@/pages/accounts/InvoiceTemplate';
import { useInvoicePrint } from '@/hooks/useInvoicePrint';
import axiosInstance from '@/api/axios.config';
import { CUSTOMER_API_ENDPOINTS } from '@/api/customerEndpoints';
import type { AccountingSettings } from '@/types/accounting.types';
import type { TemplateData } from '@/pages/accounts/InvoiceTemplate';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  id:           string;
  product_name: string;
  product_unit: string;
  quantity:     number;
  unit_price:   string;
  subtotal:     string;
}

interface OrderDelivery {
  scheduled_date:      string;
  scheduled_time_slot: string;
  address_label:       string;
  full_address:        string;
  driver_name:         string | null;
  actual_delivery_time: string | null;
}

export interface CustomerOrderForReceipt {
  id:             string;
  order_number:   string;
  status:         string;
  subtotal:       string;
  delivery_fee:   string;
  discount_amount: string;
  total_amount:   string;
  payment_status: string;
  payment_method: string;
  paid_at:        string | null;
  items:          OrderItem[];
  delivery:       OrderDelivery | null;
  created_at:     string;
}

interface CustomerReceiptModalProps {
  open:    boolean;
  onClose: () => void;
  order:   CustomerOrderForReceipt;
}

// ── Module-level cache (shared across all modal instances) ────────────────────

let _cachedSettings: AccountingSettings | null = null;
let _cachedProfile:  { name: string; phone?: string } | null = null;

// ── Default / fallback settings ───────────────────────────────────────────────

const DEFAULT_SETTINGS: AccountingSettings = {
  legalName:         'AquaTrack',
  kraPin:            '',
  vatRegistered:     false,
  vatNumber:         '',
  vatRate:           16,
  address:           '',
  city:              '',
  phone:             '',
  email:             '',
  invoicePrefix:     'RCP',
  invoiceFooterNote: 'Thank you for your business.',
  bankName:          '',
  bankAccountNumber: '',
  bankAccountName:   '',
  bankBranch:        '',
  mpesaPaybill:      '',
  mpesaAccountName:  '',
  mpesaTill:         '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PAYMENT_LABELS: Record<string, string> = {
  WALLET: 'Wallet',
  CASH:   'Cash on Delivery',
  MPESA:  'M-Pesa',
  CARD:   'Card',
  CREDIT: 'Invoice / Credit',
  CHEQUE: 'Cheque',
};

// ── Build TemplateData from order ─────────────────────────────────────────────

function buildTemplateData(
  order:        CustomerOrderForReceipt,
  customerName: string,
  customerPhone?: string,
): TemplateData {
  return {
    invoiceNumber: order.order_number,
    date:          order.created_at,
    status:        order.payment_status === 'PAID' ? 'PAID' : 'ISSUED',
    customerName,
    customerPhone,
    items: order.items.map(item => ({
      description: item.product_name,
      quantity:    item.quantity,
      unitPrice:   parseFloat(item.unit_price),
      subtotal:    parseFloat(item.subtotal),
    })),
    subtotal:      parseFloat(order.subtotal),
    deliveryFees:  parseFloat(order.delivery_fee),
    vatAmount:     0,   // set dynamically once settings load
    totalAmount:   parseFloat(order.total_amount),
    paymentMethod: order.payment_method as TemplateData['paymentMethod'],
    paidAt:        order.paid_at ?? undefined,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CustomerReceiptModal: React.FC<CustomerReceiptModalProps> = ({
  open,
  onClose,
  order,
}) => {
  const [settings,      setSettings]      = useState<AccountingSettings>(_cachedSettings ?? DEFAULT_SETTINGS);
  const [profile,       setProfile]       = useState(_cachedProfile ?? { name: 'Customer' });
  const [settingsError, setSettingsError] = useState(false);

  // ── Fetch settings + profile on open ──────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    setSettingsError(false);

    // Accounting settings
    if (_cachedSettings) {
      setSettings(_cachedSettings);
    } else {
      axiosInstance
        .get(CUSTOMER_API_ENDPOINTS.ACCOUNTING_SETTINGS)
        .then(r => {
          if (r.data?.legalName) {
            _cachedSettings = r.data;
            setSettings(r.data);
          }
        })
        .catch(() => setSettingsError(true));
    }

    // Customer profile (name + phone)
    if (_cachedProfile) {
      setProfile(_cachedProfile);
    } else {
      axiosInstance
        .get(CUSTOMER_API_ENDPOINTS.PROFILE.GET)
        .then(r => {
          const p = {
            name:  r.data.full_name ?? r.data.name ?? 'Customer',
            phone: r.data.phone     ?? r.data.phone_number ?? undefined,
          };
          _cachedProfile = p;
          setProfile(p);
        })
        .catch(() => { /* keep defaults */ });
    }
  }, [open]);

  // ── Derived values (computed unconditionally — hooks must not be after early return) ──

  const totalAmount  = parseFloat(order.total_amount);
  const subtotal     = parseFloat(order.subtotal);
  const vatAmount    = settings.vatRegistered
    ? parseFloat((subtotal * ((settings.vatRate ?? 16) / 100)).toFixed(2))
    : 0;

  const templateData: TemplateData = {
    ...buildTemplateData(order, profile.name, profile.phone),
    vatAmount,
  };

  const isPaid      = order.payment_status === 'PAID';
  const payLabel    = PAYMENT_LABELS[order.payment_method] ?? order.payment_method;
  const deliverTime = order.delivery?.actual_delivery_time;
  const deliverAddr = order.delivery?.full_address ?? order.delivery?.address_label ?? '';

  // ── All hooks must be called before any early return ──────────────────────

  const { printRef, handlePrint, handleDownloadPdf, handleWhatsApp, pdfLoading } =
    useInvoicePrint({
      invoiceNumber: order.order_number,
      customerPhone: profile.phone,
      totalAmount,
      businessName:  settings.legalName,
    });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="relative mt-auto w-full bg-background rounded-t-3xl shadow-2xl flex flex-col max-h-[95vh]">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* ── Header: mirrors DeliveryReceiptModal ── */}
        <div className="px-5 pt-2 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base">Order Receipt</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {order.order_number} · {fmtMoney(totalAmount)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors shrink-0"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* ── Settings-fetch warning ── */}
        {settingsError && (
          <div className="mx-5 mb-3 flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3.5 py-2.5 shrink-0">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Could not load business details — receipt will show placeholder info.
            </p>
          </div>
        )}

        {/* ── Order summary card — mirrors driver's delivery summary ── */}
        <div className="px-5 pb-4 shrink-0">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">

            {/* Customer row */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0 ring-2 ring-primary/10">
                <span className="text-sm font-black text-primary">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{profile.name}</p>
                {profile.phone && (
                  <p className="text-xs text-muted-foreground">{profile.phone}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-base tabular-nums text-primary">
                  {fmtMoney(totalAmount)}
                </p>
                <span className={cn(
                  'inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5',
                  isPaid
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200',
                )}>
                  {isPaid ? 'PAID' : 'UNPAID'}
                </span>
              </div>
            </div>

            {/* Delivery location + time */}
            {(deliverAddr || deliverTime) && (
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                {deliverAddr && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{deliverAddr}</span>
                  </div>
                )}
                {deliverTime && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {format(new Date(deliverTime), 'd MMM yyyy, HH:mm')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Items summary */}
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              {order.items.map(item => (
                <div key={item.id} className="flex items-center gap-2.5 text-xs">
                  <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {item.product_unit === 'LITRES'
                      ? <Droplets className="h-3.5 w-3.5 text-sky-500" />
                      : <Package  className="h-3.5 w-3.5 text-violet-500" />
                    }
                  </div>
                  <span className="flex-1 text-muted-foreground truncate">
                    {item.quantity} × {item.product_name}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {fmtMoney(parseFloat(item.subtotal))}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-border/40 pt-3 space-y-1.5">
              {parseFloat(order.delivery_fee) > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Delivery</span>
                  <span className="tabular-nums">{fmtMoney(parseFloat(order.delivery_fee))}</span>
                </div>
              )}
              {vatAmount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>VAT ({settings.vatRate}%)</span>
                  <span className="tabular-nums">{fmtMoney(vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-base">
                <span>Total</span>
                <span className="tabular-nums">{fmtMoney(totalAmount)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className="border-t border-border/40 pt-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Payment</span>
                <span className="font-semibold text-foreground">{payLabel}</span>
              </div>
              {order.paid_at && (
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Date</span>
                  <span className="font-semibold text-foreground">
                    {format(new Date(order.paid_at), 'd MMM yyyy')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Off-screen full InvoiceTemplate for print / PDF ── */}
        <div className="absolute -left-[9999px] -top-[9999px] w-[794px] pointer-events-none">
          <InvoiceTemplate
            settings={settings}
            data={templateData}
            mode="receipt"
            printRef={printRef}
          />
        </div>

        {/* ── Action buttons — identical layout to driver modal ── */}
        <div className="px-5 pb-5 shrink-0 space-y-2.5">

          {/* WhatsApp — primary CTA */}
          {profile.phone ? (
            <button
              onClick={() => handleWhatsApp(
                `Order: ${order.order_number}\nTotal: ${fmtMoney(totalAmount)}\nPayment: ${payLabel}`,
              )}
              className="w-full flex items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors active:scale-[0.98]"
              style={{ height: '52px' }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Send Receipt via WhatsApp
            </button>
          ) : (
            <button
              onClick={() => handleWhatsApp()}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors active:scale-[0.98]"
              style={{ height: '52px' }}
            >
              <Share2 className="h-5 w-5" />
              Share Receipt
            </button>
          )}

          {/* Print + PDF */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/30 font-bold text-sm hover:bg-muted transition-colors active:scale-[0.98]"
              style={{ height: '48px' }}
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 text-blue-700 font-bold text-sm hover:bg-blue-100 transition-colors active:scale-[0.98] dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 disabled:opacity-50"
              style={{ height: '48px' }}
            >
              <Download className="h-4 w-4" />
              {pdfLoading ? 'Generating…' : 'PDF'}
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full rounded-2xl border-2 border-border/60 font-bold text-sm text-muted-foreground hover:bg-muted/50 transition-colors active:scale-[0.98]"
            style={{ height: '48px' }}
          >
            Done
          </button>
        </div>

        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
};

export default CustomerReceiptModal;
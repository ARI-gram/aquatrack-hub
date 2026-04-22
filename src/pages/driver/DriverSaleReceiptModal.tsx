// src/components/driver/DriverSaleReceiptModal.tsx
import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  X, Printer, Download, Share2,
  CheckCircle, Droplets, Package, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceTemplate } from '@/pages/accounts/InvoiceTemplate';
import { useInvoicePrint } from '@/hooks/useInvoicePrint';
import { accountingService } from '@/api/services/accounting.service';
import type { AccountingSettings } from '@/types/accounting.types';
import type { TemplateData } from '@/pages/accounts/InvoiceTemplate';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DriverSaleData {
  productName:       string;
  productUnit:       string;
  isReturnable:      boolean;
  quantity:          number;
  unitPrice:         number;
  customerName:      string;
  customerPhone?:    string;
  isWalkIn:          boolean;
  paymentMethod:     string;
  paymentReference?: string;
  servedBy:          string;
  date?:             string;
}

interface DriverSaleReceiptModalProps {
  open:       boolean;
  onClose:    () => void;
  sale:       DriverSaleData;
  settings?:  AccountingSettings;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DEFAULT_SETTINGS: AccountingSettings = {
  legalName:         '',
  kraPin:            '',
  vatRegistered:     false,
  vatNumber:         '',
  vatRate:           16,
  address:           '',
  city:              '',
  phone:             '',
  email:             '',
  invoicePrefix:     'RCP',
  invoiceFooterNote: 'This is a computer-generated receipt.',
  bankName:          '',
  bankAccountNumber: '',
  bankAccountName:   '',
  bankBranch:        '',
  mpesaPaybill:      '',
  mpesaAccountName:  '',
  mpesaTill:         '',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const DriverSaleReceiptModal: React.FC<DriverSaleReceiptModalProps> = ({
  open,
  onClose,
  sale,
  settings: propSettings,
}) => {
  const [settings,      setSettings]      = useState<AccountingSettings>(propSettings ?? DEFAULT_SETTINGS);
  const [settingsError, setSettingsError] = useState(false);

  // Fetch accounting settings every time the modal opens (unless caller
  // already passed them in as props).
  useEffect(() => {
    if (propSettings) {
      setSettings(propSettings);
      return;
    }
    if (!open) return;

    setSettingsError(false);

    accountingService.getSettings()
      .then(s => {
        setSettings(s);
      })
      .catch(err => {
        // Surface the error so the developer can diagnose the endpoint
        console.error('[DriverSaleReceiptModal] Failed to load accounting settings:', err);
        setSettingsError(true);
        // Keep whatever we had (or defaults) — the receipt is still usable
      });
  }, [open, propSettings]);

  const subtotal  = sale.quantity * sale.unitPrice;
  const vatAmount = settings.vatRegistered
    ? parseFloat((subtotal * ((settings.vatRate ?? 16) / 100)).toFixed(2))
    : 0;
  const totalAmount   = subtotal + vatAmount;
  const receiptNumber = `${settings.invoicePrefix || 'RCP'}-${Date.now()}`;
  const saleDate      = sale.date ?? new Date().toISOString();

  const templateData: TemplateData = {
    invoiceNumber:    receiptNumber,
    date:             saleDate,
    status:           'PAID',
    customerName:     sale.customerName || 'Walk-in Customer',
    customerPhone:    sale.customerPhone,
    items: [{
      description: `${sale.productName} (${sale.productUnit})`,
      quantity:    sale.quantity,
      unitPrice:   sale.unitPrice,
      subtotal,
    }],
    subtotal,
    vatAmount,
    totalAmount,
    paymentMethod:    sale.paymentMethod as TemplateData['paymentMethod'],
    paymentReference: sale.paymentReference,
    paidAt:           saleDate,
    servedBy:         sale.servedBy,
  };

  const { printRef, handlePrint, handleDownloadPdf, handleWhatsApp, pdfLoading } =
    useInvoicePrint({
      invoiceNumber: receiptNumber,
      customerPhone: sale.customerPhone,
      totalAmount,
      businessName:  settings.legalName,
    });

  if (!open) return null;

  const hasPriceIssue = sale.unitPrice === 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative mt-auto w-full bg-background rounded-t-3xl shadow-2xl flex flex-col max-h-[95vh]">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Success header */}
        <div className="px-5 pt-2 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base">Sale Recorded!</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fmtMoney(totalAmount)} · {sale.paymentMethod}
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

        {/* ── Warning banners ── */}

        {/* Price = 0 warning */}
        {hasPriceIssue && (
          <div className="mx-5 mb-3 flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3.5 py-2.5 shrink-0">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Price not set</p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400 mt-0.5">
                No selling price was found for this product. Go to the product catalogue and set a selling price, then this receipt will show the correct amount.
              </p>
            </div>
          </div>
        )}

        {/* Settings fetch failed warning */}
        {settingsError && (
          <div className="mx-5 mb-3 flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-3.5 py-2.5 shrink-0">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Business details missing</p>
              <p className="text-[11px] text-rose-600/80 dark:text-rose-400 mt-0.5">
                Could not load your accounting settings. The receipt will show placeholder business info. Ask your admin to configure them in Settings → Accounting.
              </p>
            </div>
          </div>
        )}

        {/* Sale summary */}
        <div className="px-5 pb-4 shrink-0">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">

            {/* Product */}
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center shrink-0',
                sale.isReturnable
                  ? 'bg-blue-500/10 text-blue-600'
                  : 'bg-sky-500/10 text-sky-600',
              )}>
                {sale.isReturnable
                  ? <Droplets className="h-5 w-5" />
                  : <Package  className="h-5 w-5" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{sale.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {sale.quantity} × {fmtMoney(sale.unitPrice)}
                </p>
              </div>
              <p className="font-black text-sm tabular-nums shrink-0">
                {fmtMoney(subtotal)}
              </p>
            </div>

            {/* Totals */}
            <div className="border-t border-border/40 pt-3 space-y-1.5">
              {vatAmount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>VAT ({settings.vatRate}%)</span>
                  <span>{fmtMoney(vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-base">
                <span>Total</span>
                <span className={hasPriceIssue ? 'text-amber-600' : ''}>
                  {fmtMoney(totalAmount)}
                </span>
              </div>
            </div>

            {/* Customer + payment */}
            <div className="border-t border-border/40 pt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-semibold truncate ml-4 max-w-[160px]">
                  {sale.customerName || 'Walk-in'}
                </span>
              </div>
              {sale.customerPhone && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-semibold">{sale.customerPhone}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Payment</span>
                <span className="font-semibold">{sale.paymentMethod}</span>
              </div>
              {sale.paymentReference && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-semibold font-mono">{sale.paymentReference}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Served by</span>
                <span className="font-semibold">{sale.servedBy}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Date</span>
                <span className="font-semibold">
                  {format(new Date(saleDate), 'd MMM yyyy, HH:mm')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden full template for print/PDF */}
        <div className="hidden">
          <InvoiceTemplate
            settings={settings}
            data={templateData}
            mode="receipt"
            printRef={printRef}
          />
        </div>

        {/* Action buttons */}
        <div className="px-5 pb-5 shrink-0 space-y-2.5">

          {sale.customerPhone ? (
            <button
              onClick={() => handleWhatsApp(
                `Product: ${sale.productName} × ${sale.quantity}\nTotal: ${fmtMoney(totalAmount)}\nPayment: ${sale.paymentMethod}${sale.paymentReference ? ` (${sale.paymentReference})` : ''}`
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

export default DriverSaleReceiptModal;
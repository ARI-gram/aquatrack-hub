import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  X, CheckCircle, Printer, Download, Share2,
  MapPin, Phone, Clock,
} from 'lucide-react';
import { InvoiceTemplate } from '@/pages/accounts/InvoiceTemplate';
import { useInvoicePrint } from '@/hooks/useInvoicePrint';
import { accountingService } from '@/api/services/accounting.service';
import type { AccountingSettings } from '@/types/accounting.types';
import type { TemplateData } from '@/pages/accounts/InvoiceTemplate';
import type {
  DriverDelivery,
  DriverDeliveryDetail,
  OrderItem,
} from '@/api/services/delivery.service';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DeliveryReceiptModalProps {
  open:      boolean;
  onClose:   () => void;
  delivery:  DriverDelivery;
  detail?:   DriverDeliveryDetail;
  settings?: AccountingSettings;
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
  invoicePrefix:     'DLV',
  invoiceFooterNote: 'This is a computer-generated delivery receipt.',
  bankName:          '',
  bankAccountNumber: '',
  bankAccountName:   '',
  bankBranch:        '',
  mpesaPaybill:      '',
  mpesaAccountName:  '',
  mpesaTill:         '',
};

// ── Shared inner content (used by both mobile sheet and desktop dialog) ───────

const ReceiptContent: React.FC<{
  delivery:     DriverDelivery;
  detail?:      DriverDeliveryDetail;
  settings:     AccountingSettings;
  onClose:      () => void;
  templateData: TemplateData;
  items:        TemplateData['items'];
  totalAmount:  number;
  receiptNumber: string;
  printRef:     React.RefObject<HTMLDivElement>;
  pdfLoading:   boolean;
  handlePrint:       () => void;
  handleDownloadPdf: () => void;
  handleWhatsApp:    (extra?: string) => void;
}> = ({
  delivery, settings, onClose,
  templateData, items, totalAmount, receiptNumber,
  printRef, pdfLoading, handlePrint, handleDownloadPdf, handleWhatsApp,
}) => (
  <>
    {/* Success header */}
    <div className="px-5 pt-2 pb-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
          <CheckCircle className="h-6 w-6 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base">Delivery Receipt</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {delivery.order_number}
            {totalAmount > 0 && ` · ${fmtMoney(totalAmount)}`}
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

    {/* Delivery summary card */}
    <div className="px-5 pb-4 shrink-0">
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">

        {/* Customer */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 font-black text-base">
            {delivery.customer_name.trim()[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{delivery.customer_name}</p>
            {delivery.customer_phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" />{delivery.customer_phone}
              </p>
            )}
          </div>
          {totalAmount > 0 && (
            <p className="font-black text-sm tabular-nums shrink-0 text-emerald-600">
              {fmtMoney(totalAmount)}
            </p>
          )}
        </div>

        {/* Address + time */}
        <div className="space-y-1.5 border-t border-border/40 pt-3">
          {delivery.full_address && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{delivery.full_address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{format(new Date(), 'd MMM yyyy, HH:mm')}</span>
          </div>
        </div>

        {/* Items summary */}
        {items.length > 0 && items[0].unitPrice > 0 && (
          <div className="border-t border-border/40 pt-3 space-y-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate mr-3">
                  {item.quantity} × {item.description}
                </span>
                {item.subtotal > 0 && (
                  <span className="font-semibold shrink-0">
                    {fmtMoney(item.subtotal)}
                  </span>
                )}
              </div>
            ))}
            {totalAmount > 0 && (
              <div className="flex justify-between font-black text-sm border-t border-border/40 pt-1.5">
                <span>Total</span>
                <span>{fmtMoney(totalAmount)}</span>
              </div>
            )}
          </div>
        )}
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

    {/* Actions */}
    <div className="px-5 pb-5 shrink-0 space-y-2.5">

      {/* WhatsApp — primary CTA */}
      {delivery.customer_phone ? (
        <button
          onClick={() => handleWhatsApp(
            `Order: ${delivery.order_number}\nAddress: ${delivery.full_address}`
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
          className="flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 text-blue-700 font-bold text-sm hover:bg-blue-100 disabled:opacity-50 transition-colors active:scale-[0.98]"
          style={{ height: '48px' }}
        >
          <Download className="h-4 w-4" />
          {pdfLoading ? 'Generating…' : 'PDF'}
        </button>
      </div>

      {/* Done */}
      <button
        onClick={onClose}
        className="w-full rounded-2xl border-2 border-border/60 font-bold text-sm text-muted-foreground hover:bg-muted/50 transition-colors active:scale-[0.98]"
        style={{ height: '48px' }}
      >
        Done
      </button>
    </div>
  </>
);

// ── Main component ─────────────────────────────────────────────────────────────

export const DeliveryReceiptModal: React.FC<DeliveryReceiptModalProps> = ({
  open,
  onClose,
  delivery,
  detail,
  settings: propSettings,
}) => {
  const [settings, setSettings] = useState<AccountingSettings>(
    propSettings ?? DEFAULT_SETTINGS,
  );

  useEffect(() => {
    if (propSettings || !open) return;
    accountingService.getSettings()
      .then(s => setSettings(s))
      .catch(() => { /* keep defaults */ });
  }, [open, propSettings]);

  // ── Build receipt data ──────────────────────────────────────────────────────

  const receiptNumber = `DLV-${delivery.order_number}`;
  const now           = new Date().toISOString();

  const totalAmount = detail?.order?.total_amount
    ? parseFloat(String(detail.order.total_amount))
    : 0;

  const items: TemplateData['items'] = [];

  if (detail?.order?.items && detail.order.items.length > 0) {
    detail.order.items.forEach((item: OrderItem) => {
      const itemCount = detail.order.items!.length;
      const itemTotal = itemCount > 0 ? totalAmount / itemCount : 0;
      items.push({
        description: item.product_name,
        quantity:    item.quantity,
        unitPrice:   itemCount > 0 ? itemTotal / item.quantity : 0,
        subtotal:    itemTotal,
      });
    });
  } else if ((delivery.bottles_to_deliver ?? 0) > 0) {
    items.push({
      description: 'Water Bottles Delivered',
      quantity:    delivery.bottles_to_deliver ?? 0,
      unitPrice:   totalAmount > 0 ? totalAmount / (delivery.bottles_to_deliver ?? 1) : 0,
      subtotal:    totalAmount,
    });
  } else {
    items.push({
      description: `Delivery — ${delivery.order_number}`,
      quantity:    1,
      unitPrice:   totalAmount,
      subtotal:    totalAmount,
    });
  }

// Read real values from backend
const subtotal     = detail?.order?.subtotal
  ? parseFloat(String(detail.order.subtotal))
  : totalAmount;
const deliveryFee  = detail?.order?.delivery_fee
  ? parseFloat(String(detail.order.delivery_fee))
  : 0;
const discount     = detail?.order?.discount_amount
  ? parseFloat(String(detail.order.discount_amount))
  : 0;
const paymentMethod = detail?.order?.payment_method ?? delivery.order_payment_method ?? '';
const paymentStatus = detail?.order?.payment_status ?? '';

// Derive receipt status
const isCreditOrder = paymentMethod === 'CREDIT';
const isPaid        = paymentStatus === 'PAID';
const receiptStatus = isCreditOrder ? 'UNPAID' : (isPaid ? 'PAID' : 'UNPAID');

// VAT from settings
const vatAmount = settings.vatRegistered
  ? totalAmount - (totalAmount / (1 + settings.vatRate / 100))
  : 0;

const templateData: TemplateData = {
  invoiceNumber:   receiptNumber,
  date:            detail?.order?.scheduled_date
                     ? new Date(detail.order.scheduled_date).toISOString()
                     : now,
  status:          receiptStatus,
  customerName:    delivery.customer_name,
  customerPhone:   delivery.customer_phone,
  customerAddress: delivery.full_address,
  items,
  subtotal,
  deliveryFees: deliveryFee,   // ← was `deliveryFee:`, now `deliveryFees:`
  vatAmount,
  totalAmount,
  paidAt:          receiptStatus === 'PAID'
                     ? (detail?.timeline?.completed?.toString() ?? now)
                     : undefined,
  servedBy:        detail?.driver_name ?? 'Driver',
  notes:           delivery.driver_notes,
};

  const { printRef, pdfLoading, handlePrint, handleDownloadPdf, handleWhatsApp } =
    useInvoicePrint({
      invoiceNumber: receiptNumber,
      customerPhone: delivery.customer_phone,
      totalAmount,
      businessName:  settings.legalName,
    });

  if (!open) return null;

  const sharedProps = {
    delivery, detail, settings, onClose,
    templateData, items, totalAmount, receiptNumber,
    printRef, pdfLoading, handlePrint, handleDownloadPdf, handleWhatsApp,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      {/* Backdrop — closes modal on click */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* ── Mobile: full-width bottom sheet ── */}
      <div className="relative lg:hidden w-full bg-background rounded-t-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-y-auto">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>
        <ReceiptContent {...sharedProps} />
        <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>

      {/* ── Desktop: centered dialog ── */}
      <div className="relative hidden lg:flex flex-col bg-background rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Spacer top (replaces drag handle on desktop) */}
        <div className="h-3 shrink-0" />
        <ReceiptContent {...sharedProps} />
      </div>
    </div>
  );
};

export default DeliveryReceiptModal;
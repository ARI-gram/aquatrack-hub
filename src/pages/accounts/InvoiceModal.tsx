// src/pages/accounts/InvoiceModal.tsx
//
// Bottom sheet that wraps InvoiceTemplate with action buttons.
// Used by: InvoiceDetailPage, POSPage, DriverSalesPage.
//
// Usage:
//   <InvoiceModal
//     open={open}
//     onClose={() => setOpen(false)}
//     settings={accountingSettings}
//     data={templateData}
//     mode="invoice"          // or "receipt"
//     customerPhone="+254712345678"
//     customerEmail="john@example.com"
//   />

import React from 'react';
import { X, Printer, Download, Mail, Share2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceTemplate } from './InvoiceTemplate';
import { useInvoicePrint } from '@/hooks/useInvoicePrint';
import type { AccountingSettings } from '@/types/accounting.types';
import type { TemplateData } from './InvoiceTemplate';

interface InvoiceModalProps {
  open:           boolean;
  onClose:        () => void;
  settings:       AccountingSettings;
  data:           TemplateData;
  mode?:          'invoice' | 'receipt';
  customerPhone?: string;
  customerEmail?: string;
}

// ── Action button ─────────────────────────────────────────────────────────────

const ActionBtn: React.FC<{
  icon:      React.ReactNode;
  label:     string;
  onClick:   () => void | Promise<void>;
  disabled?: boolean;
  color?:    string;
}> = ({ icon, label, onClick, disabled, color = 'bg-muted/50 text-foreground hover:bg-muted' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'flex flex-col items-center gap-1.5 flex-1 py-3 rounded-2xl transition-all active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed',
      color,
    )}
  >
    <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-white/20">
      {icon}
    </div>
    <span className="text-[11px] font-semibold">{label}</span>
  </button>
);

// ── Modal ─────────────────────────────────────────────────────────────────────

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  open,
  onClose,
  settings,
  data,
  mode = 'invoice',
  customerPhone,
  customerEmail,
}) => {
  const { printRef, handlePrint, handleDownloadPdf, handleWhatsApp, handleEmail, pdfLoading } =
    useInvoicePrint({
      invoiceNumber: data.invoiceNumber,
      customerPhone: customerPhone ?? data.customerPhone,
      totalAmount:   data.totalAmount,
      businessName:  settings.legalName,
    });

  if (!open) return null;

  const phone = customerPhone ?? data.customerPhone;
  const email = customerEmail ?? data.customerEmail;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative mt-auto w-full max-w-2xl mx-auto bg-background rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 shrink-0">
          <div>
            <p className="font-bold text-base">
              {mode === 'receipt' ? 'Receipt' : 'Invoice'} #{data.invoiceNumber}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.customerName}
              {data.totalAmount > 0 && (
                <span className="ml-2 font-semibold text-foreground">
                  KES {data.totalAmount.toLocaleString('en-KE', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Invoice preview — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="rounded-2xl border border-border/60 overflow-hidden p-6 bg-white">
            <InvoiceTemplate
              settings={settings}
              data={data}
              mode={mode}
              printRef={printRef}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="shrink-0 px-4 pb-4 pt-3 border-t border-border/40">
          <div className="flex gap-2.5">
            <ActionBtn
              icon={<Printer className="h-5 w-5" />}
              label="Print"
              onClick={handlePrint}
              color="bg-muted/50 text-foreground hover:bg-muted"
            />
            <ActionBtn
              icon={pdfLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              label="PDF"
              onClick={handleDownloadPdf} disabled={pdfLoading}
              color="bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
            />
            {/* WhatsApp — only show if we have a phone */}
            {phone && (
              <ActionBtn
                icon={
                  // WhatsApp icon via SVG since lucide doesn't have it
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                }
                label="WhatsApp"
                onClick={() => handleWhatsApp()}
                color="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
              />
            )}
            {/* Email — only show if we have an email */}
            {email && (
              <ActionBtn
                icon={<Mail className="h-5 w-5" />}
                label="Email"
                onClick={() => handleEmail(email)}
                color="bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
              />
            )}
            {/* Share — fallback when no phone/email */}
            {!phone && !email && (
              <ActionBtn
                icon={<Share2 className="h-5 w-5" />}
                label="Share"
                onClick={() => handleWhatsApp()}
                color="bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              />
            )}
          </div>

          {/* Safe area */}
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
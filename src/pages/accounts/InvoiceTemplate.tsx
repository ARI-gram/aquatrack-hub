// src/pages/accounts/InvoiceTemplate.tsx
//
// Reusable legal Kenyan invoice layout.
// Used by: InvoiceDetailPage, POSPage receipt, DriverSales receipt.
//
// Props:
//   settings  — AccountingSettings (KRA PIN, VAT, bank, M-Pesa)
//   invoice   — the invoice or receipt data
//   mode      — 'invoice' | 'receipt'  (slight layout difference)

import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AccountingSettings } from '@/types/accounting.types';

// ── Types accepted by this template ──────────────────────────────────────────

export interface TemplateItem {
  description: string;
  quantity:    number;
  unitPrice:   number;
  subtotal:    number;
}

export interface TemplateData {
  // Document identity
  invoiceNumber: string;
  date:          string;   // ISO string
  dueDate?:      string;   // ISO string — optional for receipts
  status?:       string;

  // Customer / buyer
  customerName:  string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerKraPin?: string; // for B2B invoices

  // Line items
  items: TemplateItem[];

  // Totals
  subtotal:      number;
  deliveryFees?: number;
  vatAmount:     number;
  totalAmount:   number;

  // Payment
  paymentMethod?:    string;
  paymentReference?: string;
  paidAt?:           string;

  // Extra
  notes?:     string;
  servedBy?:  string;   // for receipts
  periodStart?: string;
  periodEnd?:   string;
}

interface InvoiceTemplateProps {
  settings: AccountingSettings;
  data:     TemplateData;
  mode?:    'invoice' | 'receipt';
  /** Pass ref if you need to print/PDF this element */
  printRef?: React.RefObject<HTMLDivElement>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  try { return format(new Date(iso), 'd MMM yyyy'); } catch { return iso; }
};

const STATUS_COLORS: Record<string, string> = {
  PAID:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  ISSUED:    'bg-blue-50    text-blue-700    border-blue-200',
  DRAFT:     'bg-muted/60   text-muted-foreground border-border',
  OVERDUE:   'bg-red-50     text-red-700     border-red-200',
  CANCELLED: 'bg-muted/60   text-muted-foreground border-border',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({
  settings,
  data,
  mode = 'invoice',
  printRef,
}) => {
  const isReceipt   = mode === 'receipt';
  const docLabel    = isReceipt ? 'RECEIPT' : (settings.vatRegistered ? 'TAX INVOICE' : 'INVOICE');
  const statusColor = data.status ? (STATUS_COLORS[data.status] ?? STATUS_COLORS.DRAFT) : '';

  const hasBank  = settings.bankName && settings.bankAccountNumber;
  const hasMpesa = settings.mpesaPaybill || settings.mpesaTill;

  return (
    <div
      ref={printRef}
      id="invoice-template"
      className="bg-white text-gray-900 font-sans text-sm leading-relaxed"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between pb-5 border-b-2 border-gray-800 mb-5">

        {/* Left — company info */}
        <div className="flex-1 min-w-0 pr-6">
          <p className="text-xl font-bold text-gray-900 leading-tight">
            {settings.legalName || 'Your Business Name'}
          </p>
          {settings.address && (
            <p className="text-xs text-gray-600 mt-1">{settings.address}{settings.city ? `, ${settings.city}` : ''}</p>
          )}
          {settings.phone && (
            <p className="text-xs text-gray-600">Tel: {settings.phone}</p>
          )}
          {settings.email && (
            <p className="text-xs text-gray-600">{settings.email}</p>
          )}
          <div className="mt-2 space-y-0.5">
            {settings.kraPin && (
              <p className="text-xs font-semibold text-gray-700">KRA PIN: {settings.kraPin}</p>
            )}
            {settings.vatRegistered && settings.vatNumber && (
              <p className="text-xs font-semibold text-gray-700">VAT Reg No: {settings.vatNumber}</p>
            )}
          </div>
        </div>

        {/* Right — document type + number */}
        <div className="text-right shrink-0">
          <p className="text-2xl font-black tracking-tight text-gray-900">{docLabel}</p>
          <p className="text-sm font-bold text-gray-700 mt-1">#{data.invoiceNumber}</p>
          <p className="text-xs text-gray-500 mt-1">Date: {fmtDate(data.date)}</p>
          {data.dueDate && !isReceipt && (
            <p className="text-xs text-gray-500">Due: {fmtDate(data.dueDate)}</p>
          )}
          {data.status && (
            <span className={cn(
              'inline-block mt-2 text-[11px] font-bold px-2.5 py-0.5 rounded-full border',
              statusColor,
            )}>
              {data.status}
            </span>
          )}
        </div>
      </div>

      {/* ── Bill To ───────────────────────────────────────────────── */}
      <div className="flex gap-8 mb-5">
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
            Bill To
          </p>
          <p className="font-bold text-gray-900">{data.customerName}</p>
          {data.customerPhone && (
            <p className="text-xs text-gray-600">{data.customerPhone}</p>
          )}
          {data.customerEmail && (
            <p className="text-xs text-gray-600">{data.customerEmail}</p>
          )}
          {data.customerAddress && (
            <p className="text-xs text-gray-600">{data.customerAddress}</p>
          )}
          {data.customerKraPin && (
            <p className="text-xs text-gray-600 font-semibold">PIN: {data.customerKraPin}</p>
          )}
        </div>

        {/* Billing period — only for cycle invoices */}
        {(data.periodStart || data.periodEnd) && (
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
              Billing Period
            </p>
            <p className="text-xs text-gray-700">
              {fmtDate(data.periodStart)} — {fmtDate(data.periodEnd)}
            </p>
          </div>
        )}

        {/* Served by — for receipts */}
        {isReceipt && data.servedBy && (
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
              Served By
            </p>
            <p className="text-xs text-gray-700">{data.servedBy}</p>
          </div>
        )}
      </div>

      {/* ── Line items table ──────────────────────────────────────── */}
      <table className="w-full mb-5 border-collapse">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="text-left py-2 px-3 text-[11px] font-bold uppercase tracking-wide w-8">#</th>
            <th className="text-left py-2 px-3 text-[11px] font-bold uppercase tracking-wide">Description</th>
            <th className="text-right py-2 px-3 text-[11px] font-bold uppercase tracking-wide w-16">Qty</th>
            <th className="text-right py-2 px-3 text-[11px] font-bold uppercase tracking-wide w-28">Unit Price</th>
            <th className="text-right py-2 px-3 text-[11px] font-bold uppercase tracking-wide w-28">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr
              key={i}
              className={cn(
                'border-b border-gray-200',
                i % 2 === 0 ? 'bg-white' : 'bg-gray-50',
              )}
            >
              <td className="py-2.5 px-3 text-gray-500 text-xs">{i + 1}</td>
              <td className="py-2.5 px-3 text-gray-900 text-xs font-medium">{item.description}</td>
              <td className="py-2.5 px-3 text-right text-gray-700 text-xs">{item.quantity}</td>
              <td className="py-2.5 px-3 text-right text-gray-700 text-xs">{fmt(item.unitPrice)}</td>
              <td className="py-2.5 px-3 text-right text-gray-900 text-xs font-semibold">{fmt(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals ────────────────────────────────────────────────── */}
      <div className="flex justify-end mb-5">
        <div className="w-64 space-y-1.5">
          {/* Subtotal */}
          <div className="flex justify-between text-xs text-gray-600">
            <span>Subtotal</span>
            <span>{fmt(data.subtotal)}</span>
          </div>

          {/* Delivery fee */}
          {!!data.deliveryFees && data.deliveryFees > 0 && (
            <div className="flex justify-between text-xs text-gray-600">
              <span>Delivery Fees</span>
              <span>{fmt(data.deliveryFees)}</span>
            </div>
          )}

          {/* VAT */}
          {settings.vatRegistered ? (
            <div className="flex justify-between text-xs text-gray-600">
              <span>VAT ({settings.vatRate}%)</span>
              <span>{fmt(data.vatAmount)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-xs text-gray-400 italic">
              <span>VAT</span>
              <span>Exempt</span>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between font-black text-sm text-gray-900 border-t-2 border-gray-800 pt-2 mt-1">
            <span>TOTAL</span>
            <span>{fmt(data.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* ── Payment info ──────────────────────────────────────────── */}
      {(data.paymentMethod || data.paidAt) && (
        <div className="mb-5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded text-xs">
          <p className="font-bold text-emerald-800 mb-1">Payment Received</p>
          <div className="flex flex-wrap gap-x-6 gap-y-0.5 text-emerald-700">
            {data.paymentMethod && (
              <span>Method: <strong>{data.paymentMethod}</strong></span>
            )}
            {data.paymentReference && (
              <span>Ref: <strong>{data.paymentReference}</strong></span>
            )}
            {data.paidAt && (
              <span>Date: <strong>{fmtDate(data.paidAt)}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* ── Payment instructions (for unpaid invoices) ────────────── */}
      {!data.paidAt && (hasBank || hasMpesa) && (
        <div className="mb-5 px-4 py-3 bg-gray-50 border border-gray-200 rounded text-xs">
          <p className="font-bold text-gray-700 mb-2">Payment Instructions</p>
          <div className="grid grid-cols-2 gap-4">
            {hasBank && (
              <div>
                <p className="font-semibold text-gray-600 mb-1">Bank Transfer</p>
                <p className="text-gray-600">Bank: {settings.bankName}</p>
                {settings.bankBranch && <p className="text-gray-600">Branch: {settings.bankBranch}</p>}
                <p className="text-gray-600">A/C: {settings.bankAccountNumber}</p>
                <p className="text-gray-600">Name: {settings.bankAccountName}</p>
              </div>
            )}
            {hasMpesa && (
              <div>
                <p className="font-semibold text-gray-600 mb-1">M-Pesa</p>
                {settings.mpesaPaybill && (
                  <>
                    <p className="text-gray-600">Paybill: <strong>{settings.mpesaPaybill}</strong></p>
                    <p className="text-gray-600">Account: {settings.mpesaAccountName}</p>
                  </>
                )}
                {settings.mpesaTill && (
                  <p className="text-gray-600">Till: <strong>{settings.mpesaTill}</strong></p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Notes ────────────────────────────────────────────────── */}
      {data.notes && (
        <div className="mb-4 text-xs text-gray-600">
          <p className="font-semibold mb-0.5">Notes:</p>
          <p>{data.notes}</p>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div className="border-t border-gray-300 pt-3 text-center">
        <p className="text-[11px] text-gray-500 italic">
          {settings.invoiceFooterNote || 'This is a computer-generated document.'}
        </p>
        {settings.kraPin && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            {settings.legalName} | KRA PIN: {settings.kraPin}
            {settings.vatRegistered && settings.vatNumber ? ` | VAT: ${settings.vatNumber}` : ''}
          </p>
        )}
      </div>
    </div>
  );
};

export default InvoiceTemplate;
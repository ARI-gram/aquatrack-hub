// src/hooks/useInvoicePrint.ts
//
// Handles print, PDF download, WhatsApp share, and email
// for InvoiceTemplate and DriverSaleReceiptModal.
//
// PDF generation now uses jsPDF + html2canvas (Phase 6).
// Falls back to browser print-to-PDF if jsPDF is unavailable.
//
// Usage:
//   const { printRef, handlePrint, handleDownloadPdf, handleWhatsApp, handleEmail }
//     = useInvoicePrint({ invoiceNumber, customerPhone, totalAmount, businessName });
//
//   <InvoiceTemplate printRef={printRef} ... />
//   <button onClick={handlePrint}>Print</button>
//   <button onClick={handleDownloadPdf}>Download PDF</button>
//   <button onClick={() => handleWhatsApp()}>WhatsApp</button>

import { useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { generatePdf } from '@/lib/generatePdf';

interface UseInvoicePrintOptions {
  invoiceNumber:  string;
  customerPhone?: string;
  totalAmount:    number;
  businessName?:  string;
}

export const useInvoicePrint = ({
  invoiceNumber,
  customerPhone,
  totalAmount,
  businessName = 'AquaTrack',
}: UseInvoicePrintOptions) => {
  const printRef       = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // ── Print ─────────────────────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    const el = printRef.current;
    if (!el) return;

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      toast.error('Pop-up blocked — please allow pop-ups for this site');
      return;
    }

    // Collect all CSS so the print window renders identically
    const styles = Array.from(document.styleSheets)
      .map(sheet => {
        try {
          return Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
        } catch {
          return sheet.href ? `@import url("${sheet.href}");` : '';
        }
      })
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${invoiceNumber}</title>
          <style>
            ${styles}
            @page  { margin: 20mm; size: A4; }
            body   { margin: 0; padding: 0; background: white; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>${el.outerHTML}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }, [invoiceNumber]);

  // ── PDF download — real jsPDF generation ─────────────────────────────────

  const handleDownloadPdf = useCallback(async () => {
    const el = printRef.current;
    if (!el) {
      toast.error('Nothing to export');
      return;
    }

    setPdfLoading(true);
    const toastId = toast.loading('Generating PDF…');

    try {
      await generatePdf(el, invoiceNumber, { quality: 2, padding: 10 });
      toast.success('PDF downloaded', { id: toastId });
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('PDF failed — using print dialog instead', { id: toastId });
      // Graceful fallback to browser print
      handlePrint();
    } finally {
      setPdfLoading(false);
    }
  }, [invoiceNumber, handlePrint]);

  // ── WhatsApp share ────────────────────────────────────────────────────────

  const handleWhatsApp = useCallback((extraMessage?: string) => {
    const amount = `KES ${totalAmount.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    const lines = [
      `*${businessName} — ${invoiceNumber}*`,
      `Amount: *${amount}*`,
      ...(extraMessage ? [extraMessage] : []),
      '',
      'Thank you for your business! 🙏',
    ];

    const encoded = encodeURIComponent(lines.join('\n'));
    const phone   = customerPhone ? customerPhone.replace(/[^0-9]/g, '') : '';
    const url     = phone
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(url, '_blank');
  }, [invoiceNumber, totalAmount, businessName, customerPhone]);

  // ── Email share ───────────────────────────────────────────────────────────

  const handleEmail = useCallback((
    customerEmail: string,
    subject?: string,
  ) => {
    const sub  = encodeURIComponent(subject ?? `Invoice ${invoiceNumber} — ${businessName}`);
    const body = encodeURIComponent(
      `Dear Customer,\n\nPlease find your invoice ${invoiceNumber} for KES ${totalAmount.toLocaleString()}.\n\nThank you for your business.\n\n${businessName}`
    );
    window.open(`mailto:${customerEmail}?subject=${sub}&body=${body}`);
  }, [invoiceNumber, totalAmount, businessName]);

  return {
    printRef,
    pdfLoading,
    handlePrint,
    handleDownloadPdf,
    handleWhatsApp,
    handleEmail,
  };
};

export default useInvoicePrint;
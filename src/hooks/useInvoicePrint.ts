// src/hooks/useInvoicePrint.ts
//
// Handles print, PDF download, WhatsApp share, and email
// for InvoiceTemplate and DriverSaleReceiptModal.
//
// WhatsApp + Email now share the actual PDF file via the Web Share API.
// Falls back to downloading the PDF + opening wa.me / mailto on desktop.
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

// ── Helper: build a PDF File blob from the live template element ──────────────
// Dynamic imports keep the bundle lean — only loaded when the user shares.

async function buildPdfFile(
  el: HTMLDivElement,
  invoiceNumber: string,
): Promise<File> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF }   = await import('jspdf');

  await new Promise(resolve => setTimeout(resolve, 300));

  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    position:   'fixed',
    top:        '0',
    left:       '-9999px',
    width:      '794px',
    background: '#ffffff',
    zIndex:     '-1',
  });
  const clone = el.cloneNode(true) as HTMLDivElement;
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, {
      scale:           2,
      useCORS:         true,
      backgroundColor: '#ffffff',
      logging:         false,
      width:           794,
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas has zero dimensions');
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdfW    = 210;
    const pdfH    = Math.max(1, (canvas.height * pdfW) / canvas.width);

    const pdf = new jsPDF({
      orientation: pdfH > pdfW ? 'portrait' : 'landscape',
      unit:        'mm',
      format:      [pdfW, pdfH],
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);

    const blob = pdf.output('blob');
    return new File([blob], `Invoice-${invoiceNumber}.pdf`, { type: 'application/pdf' });
  } finally {
    document.body.removeChild(wrapper);
  }
}

// ── Helper: save a File blob to disk ─────────────────────────────────────────

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a   = Object.assign(document.createElement('a'), { href: url, download: file.name });
  a.click();
  URL.revokeObjectURL(url);
}

// ── Helper: does this browser support native file sharing? ────────────────────

function canShareFiles(data: ShareData): boolean {
  return (
    typeof navigator.share    === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare(data)
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export const useInvoicePrint = ({
  invoiceNumber,
  customerPhone,
  totalAmount,
  businessName = 'AquaTrack',
}: UseInvoicePrintOptions) => {
  const printRef                    = useRef<HTMLDivElement>(null);
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
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  }, [invoiceNumber]);

  // ── PDF download ──────────────────────────────────────────────────────────

  const handleDownloadPdf = useCallback(async () => {
    const el = printRef.current;
    if (!el) { toast.error('Nothing to export'); return; }

    setPdfLoading(true);
    const toastId = toast.loading('Generating PDF…');

    try {
      await generatePdf(el, invoiceNumber, { quality: 2, padding: 10 });
      toast.success('PDF downloaded', { id: toastId });
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('PDF failed — using print dialog instead', { id: toastId });
      handlePrint();
    } finally {
      setPdfLoading(false);
    }
  }, [invoiceNumber, handlePrint]);

  // ── WhatsApp share ────────────────────────────────────────────────────────
  //
  // Mobile  → Web Share API opens the native share sheet; user picks WhatsApp
  //           and the PDF lands as a real file attachment.
  // Desktop → PDF is downloaded automatically, wa.me opens with a text message
  //           instructing the user to attach the saved file.

  const handleWhatsApp = useCallback(async (extraMessage?: string) => {
    const el = printRef.current;
    if (!el) { toast.error('Nothing to share'); return; }

    setPdfLoading(true);
    const toastId = toast.loading('Preparing invoice…');

    const amountStr = `KES ${totalAmount.toLocaleString('en-KE', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`;

    const messageText = [
      `*${businessName} — ${invoiceNumber}*`,
      `Amount: *${amountStr}*`,
      ...(extraMessage ? [extraMessage] : []),
      '',
      'Thank you for your business! 🙏',
    ].join('\n');

    try {
      const file      = await buildPdfFile(el, invoiceNumber);
      const shareData = { title: `Invoice #${invoiceNumber}`, text: messageText, files: [file] };

      if (canShareFiles(shareData)) {
        toast.dismiss(toastId);
        await navigator.share(shareData);               // opens native share sheet
      } else {
        // Desktop fallback
        downloadFile(file);
        const phone   = customerPhone?.replace(/[^0-9]/g, '') ?? '';
        const waUrl   = `https://wa.me/${phone}?text=${encodeURIComponent(messageText + '\n\n_(PDF saved to your device)_')}`;
        toast.success('PDF saved — attach it in WhatsApp', { id: toastId });
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.dismiss(toastId);                         // user cancelled — not an error
      } else {
        console.error('WhatsApp share failed:', err);
        toast.error('Could not share — try downloading the PDF instead', { id: toastId });
      }
    } finally {
      setPdfLoading(false);
    }
  }, [invoiceNumber, totalAmount, businessName, customerPhone]);

  // ── Email share ───────────────────────────────────────────────────────────
  //
  // Mobile  → Web Share API opens the native share sheet; user picks Gmail /
  //           Mail and the PDF is included as an attachment.
  // Desktop → PDF is downloaded, mailto opens with a pre-filled body reminding
  //           the user to attach the saved file.

  const handleEmail = useCallback(async (
    customerEmail: string,
    subject?: string,
  ) => {
    const el = printRef.current;
    if (!el) { toast.error('Nothing to share'); return; }

    setPdfLoading(true);
    const toastId = toast.loading('Preparing invoice…');

    const emailSubject = subject ?? `Invoice ${invoiceNumber} — ${businessName}`;
    const emailBody    = `Dear Customer,\n\nPlease find your invoice ${invoiceNumber} for KES ${totalAmount.toLocaleString()} attached.\n\nThank you for your business.\n\n${businessName}`;

    try {
      const file      = await buildPdfFile(el, invoiceNumber);
      const shareData = { title: emailSubject, text: emailBody, files: [file] };

      if (canShareFiles(shareData)) {
        toast.dismiss(toastId);
        await navigator.share(shareData);               // opens native share sheet
      } else {
        // Desktop fallback
        downloadFile(file);
        const mailUrl = `mailto:${customerEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody + '\n\n(PDF saved to your device — please attach before sending)')}`;
        window.location.href = mailUrl;
        toast.success('PDF saved — attach it to your email', { id: toastId });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.dismiss(toastId);
      } else {
        console.error('Email share failed:', err);
        toast.error('Could not share — try downloading the PDF instead', { id: toastId });
      }
    } finally {
      setPdfLoading(false);
    }
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
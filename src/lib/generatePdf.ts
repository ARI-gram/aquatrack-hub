// src/lib/generatePdf.ts
//
// Converts the InvoiceTemplate DOM element to a proper PDF download.
// Uses html2canvas to snapshot the rendered HTML, then jsPDF to wrap
// it into an A4 PDF and trigger a browser download.

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface GeneratePdfOptions {
  filename?:   string;
  padding?:    number;   // mm padding inside the PDF, default 10
  quality?:    number;   // canvas scale, 1–3, default 2
}

/**
 * Generates and downloads a PDF from a DOM element.
 * Handles elements that are inside a `hidden` parent by temporarily
 * cloning and positioning the element off-screen for capture.
 */
export async function generatePdf(
  element:   HTMLElement | null,
  docNumber: string,
  options:   GeneratePdfOptions = {},
): Promise<void> {
  if (!element) {
    console.warn('generatePdf: element is null — nothing to render');
    return;
  }

  const {
    filename = `${docNumber}.pdf`,
    padding  = 10,
    quality  = 2,
  } = options;

  // ── 1. Clone element off-screen so hidden parents don't affect capture ────
  //
  // The InvoiceTemplate is rendered inside a `className="hidden"` div
  // (so it's not visible on screen but exists in the DOM for printing).
  // html2canvas captures hidden elements as blank. Fix: clone the element
  // into a temporary off-screen container that is fully visible.

  const clone = element.cloneNode(true) as HTMLElement;

  const offscreen = document.createElement('div');
  offscreen.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: -9999px',
    'width: 794px',          // ~A4 width at 96dpi
    'background: white',
    'z-index: -1',
    'visibility: visible',
    'display: block',
    'pointer-events: none',
  ].join('; ');

  offscreen.appendChild(clone);
  document.body.appendChild(offscreen);

  try {
    // ── 2. Snapshot ───────────────────────────────────────────────────────

    const canvas = await html2canvas(clone, {
      scale:           quality,
      useCORS:         true,
      allowTaint:      true,
      backgroundColor: '#ffffff',
      logging:         false,
      windowWidth:     794,
      windowHeight:    clone.scrollHeight,
    });

    // ── 3. Calculate dimensions ───────────────────────────────────────────

    const A4_WIDTH_MM  = 210;
    const A4_HEIGHT_MM = 297;
    const imgWidth     = A4_WIDTH_MM - padding * 2;
    const imgHeight    = (canvas.height / canvas.width) * imgWidth;
    const imgData      = canvas.toDataURL('image/png');

    // ── 4. Build PDF ──────────────────────────────────────────────────────

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageContentHeight = A4_HEIGHT_MM - padding * 2;

    if (imgHeight <= pageContentHeight) {
      // Single page
      pdf.addImage(imgData, 'PNG', padding, padding, imgWidth, imgHeight);
    } else {
      // Multi-page
      let yOffset = 0;
      while (yOffset < imgHeight) {
        if (yOffset > 0) pdf.addPage();
        const sliceHeight = Math.min(pageContentHeight, imgHeight - yOffset);
        pdf.addImage(imgData, 'PNG', padding, padding - yOffset, imgWidth, imgHeight);
        // White mask over overflow
        if (yOffset + sliceHeight < imgHeight) {
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, padding + sliceHeight, A4_WIDTH_MM, A4_HEIGHT_MM, 'F');
        }
        yOffset += sliceHeight;
      }
    }

    // ── 5. Download ───────────────────────────────────────────────────────
    pdf.save(filename);

  } finally {
    // Always remove the off-screen clone
    document.body.removeChild(offscreen);
  }
}

/**
 * Opens the PDF in a new browser tab instead of downloading.
 * Uses a blob URL so it works correctly (no file:// security errors).
 */
export async function previewPdf(
  element:   HTMLElement | null,
  docNumber: string,
  options:   GeneratePdfOptions = {},
): Promise<void> {
  if (!element) return;

  const { quality = 2, padding = 10 } = options;

  const clone = element.cloneNode(true) as HTMLElement;
  const offscreen = document.createElement('div');
  offscreen.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: -9999px',
    'width: 794px',
    'background: white',
    'z-index: -1',
    'visibility: visible',
    'display: block',
    'pointer-events: none',
  ].join('; ');
  offscreen.appendChild(clone);
  document.body.appendChild(offscreen);

  try {
    const canvas = await html2canvas(clone, {
      scale:           quality,
      useCORS:         true,
      allowTaint:      true,
      backgroundColor: '#ffffff',
      logging:         false,
      windowWidth:     794,
      windowHeight:    clone.scrollHeight,
    });

    const A4_WIDTH_MM  = 210;
    const A4_HEIGHT_MM = 297;
    const imgWidth     = A4_WIDTH_MM  - padding * 2;
    const imgHeight    = (canvas.height / canvas.width) * imgWidth;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      padding,
      padding,
      imgWidth,
      Math.min(imgHeight, A4_HEIGHT_MM - padding * 2),
    );

    // Use blob URL — avoids the file:// security error entirely
    const blob    = pdf.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);

  } finally {
    document.body.removeChild(offscreen);
  }
}
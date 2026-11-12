"use client";

export default function SaveQuotationPdf() {
  return (
    <button type="button" className="quote-pdf-button" onClick={() => window.print()}>
      <span className="quote-pdf-icon" aria-hidden="true">PDF</span>
      Save as PDF
    </button>
  );
}

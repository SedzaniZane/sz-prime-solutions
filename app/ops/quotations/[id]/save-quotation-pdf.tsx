"use client";

export default function SaveQuotationPdf({ reference }: { reference: string }) {
  function printDocument() {
    const title = document.title;
    document.title = reference;
    try {
      window.print();
    } finally {
      document.title = title;
    }
  }

  return (
    <button type="button" className="quote-pdf-button" onClick={printDocument}>
      <span className="quote-pdf-icon" aria-hidden="true">PDF</span>
      Save as PDF
    </button>
  );
}

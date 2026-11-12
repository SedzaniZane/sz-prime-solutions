export default function BillingPdfLink({ href }: { href: string }) {
  return (
    <a className="quote-pdf-button" href={href}>
      <span className="quote-pdf-icon" aria-hidden="true">PDF</span>
      Save as PDF
    </a>
  );
}

import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { unitLabels } from "@/lib/business-unit-labels";
import BillingPdfLink from "../../billing-pdf-link";
import { loadInvoice } from "@/lib/billing-documents";
import "../../ops.css";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { invoice, paidCents, balanceCents, payment, methodLabel, date, dateTime, formatMoney, items } =
    await loadInvoice(supabase, id);

  return (
    <main className="quote-document-page">
      <section className="quote-toolbar no-print">
        <strong>{invoice.invoice_number}</strong>
        <div className="quote-toolbar-actions">
          <Link href={`/ops/quotations/${invoice.quotation_id}`} className="button-link secondary-action">Back to quotation</Link>
          <BillingPdfLink href={`/ops/invoices/${id}/pdf`} />
        </div>
      </section>

      <article className="quote-document">
        <header className="quote-brand-header">
          <div>
            <Image src="/brand/sz-shield.webp" width={48} height={52} className="billing-shield" alt="" />
            <p className="eyebrow">SZ PRIME SOLUTIONS (PTY) LTD</p>
            <h1>Invoice</h1>
            <p className="quote-tagline">{unitLabels[invoice.unit] ?? invoice.unit}</p>
            {invoice.mode === "test" && <p className="eyebrow">SANDBOX INVOICE</p>}
          </div>
          <div className="quote-meta">
            <div><span>Invoice no.</span><strong>{invoice.invoice_number}</strong></div>
            <div><span>Issued</span><strong>{date.format(new Date(invoice.issued_at))}</strong></div>
            <div><span>Quotation</span><strong>{invoice.quotation_number}</strong></div>
          </div>
        </header>

        <section className="quote-customer-grid">
          <div>
            <p className="eyebrow">BILL TO</p>
            <h2>{invoice.customer_name}</h2>
            {invoice.customer_email && <p>{invoice.customer_email}</p>}
            {invoice.customer_location && <p>{invoice.customer_location}</p>}
          </div>
          <div>
            <p className="eyebrow">SERVICE</p>
            <h2>{invoice.service_type}</h2>
          </div>
        </section>

        <section className="quote-items-section">
          <table className="quote-items-table">
            <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
            <tbody>{items.map((item, index) => (
              <tr key={index}>
                <td>{item.description}</td><td>{Number(item.quantity).toFixed(2)}</td>
                <td>{formatMoney(item.unit_price)}</td><td>{formatMoney(item.line_total)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>

        <section className="quote-totals">
          <div><span>Subtotal</span><strong>{formatMoney(invoice.subtotal)}</strong></div>
          <div><span>Additional fees</span><strong>{formatMoney(invoice.fees)}</strong></div>
          <div><span>Invoice total</span><strong>{formatMoney(invoice.total)}</strong></div>
          <div><span>Amount paid</span><strong>{formatMoney(paidCents / 100)}</strong></div>
          <div className="quote-grand-total"><span>Balance due</span><strong>{formatMoney(balanceCents / 100)}</strong></div>
        </section>

        {payment?.paid_at && (
          <footer className="quote-footer invoice-payment-summary">
            <strong>{balanceCents === 0 ? "Paid" : "Payment received"}</strong>
            {methodLabel && <span> · {methodLabel}</span>}
            <span> · <time dateTime={payment.paid_at}>{dateTime.format(new Date(payment.paid_at))} SAST</time></span>
          </footer>
        )}
      </article>
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { unitLabels } from "@/lib/business-unit-labels";
import SaveQuotationPdf from "../../quotations/[id]/save-quotation-pdf";
import "../../ops.css";

type InvoiceItem = {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (error || !invoice) notFound();

  const { data: payments, error: paymentError } = await supabase.from("payments")
    .select("amount, paid_at, payment_method")
    .eq("quotation_id", invoice.quotation_id)
    .eq("currency", invoice.currency)
    .eq("status", "paid")
    .eq("metadata->>processing_mode", invoice.mode)
    .order("paid_at", { ascending: false });
  if (paymentError) throw new Error("Unable to verify invoice settlement.");

  const paidCents = (payments ?? []).reduce((sum, payment) =>
    sum + Math.round(Number(payment.amount) * 100), 0);
  const balanceCents = Math.max(Math.round(Number(invoice.total) * 100) - paidCents, 0);
  const payment = payments?.[0];
  const method = payment?.payment_method;
  const methodLabel = method === "apple_pay" ? "Apple Pay" : method === "google_pay" ? "Google Pay" : method === "card" ? "Card" : null;
  const date = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium", timeZone: "Africa/Johannesburg",
  });
  const dateTime = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium", timeStyle: "medium", timeZone: "Africa/Johannesburg", hour12: false,
  });
  const money = new Intl.NumberFormat("en-ZA", { style: "currency", currency: invoice.currency });
  const formatMoney = (value: number | string) => money.format(Number(value));
  const items = invoice.items as InvoiceItem[];

  return (
    <main className="quote-document-page">
      <section className="quote-toolbar no-print">
        <strong>{invoice.invoice_number}</strong>
        <div className="quote-toolbar-actions">
          <Link href={`/ops/quotations/${invoice.quotation_id}`} className="button-link secondary-action">Back to quotation</Link>
          <SaveQuotationPdf reference={invoice.invoice_number} />
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

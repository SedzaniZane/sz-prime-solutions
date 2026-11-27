import { paymentMethodLabel } from "@/lib/billing-settlement";
import { invoicePaymentOptions } from "@/lib/invoice-payment-options";
import { payInvoice, recordEft, discardTestCheckout } from "./actions";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { unitLabels } from "@/lib/business-unit-labels";
import { billingPdfFilename } from "@/lib/billing-pdf-filename";
import BillingPdfLink from "../../billing-pdf-link";
import BillingEnquiries from "../../billing-enquiries";
import { loadInvoice } from "@/lib/billing-documents";
import "../../ops.css";

export default async function InvoicePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; payment_return?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { invoice, paidCents, balanceCents, date, dateTime, formatMoney, items, payments, checkoutUrl, hasPendingCheckout, settlementStatus } =
    await loadInvoice(supabase, id);

  const options = invoicePaymentOptions(invoice.invoice_number);

  return (
    <main className="quote-document-page">
      <section className="quote-toolbar no-print">
        <div><strong>Invoice No: {invoice.invoice_number}</strong><span className="quote-toolbar-status">{settlementStatus}</span></div>
        <div className="quote-toolbar-actions">
          <Link href={`/ops/quotations/${invoice.quotation_id}`} className="button-link secondary-action">Back to quotation</Link>
          <BillingPdfLink href={`/ops/invoices/${id}/pdf/${billingPdfFilename(invoice.invoice_number)}`} />
        </div>
      </section>

      {query.error && <p className="form-error" role="alert">{query.error}</p>}
      {query.saved === "eft" && <p className="form-success" role="status">EFT payment recorded.</p>}
      {query.payment_return === "success" && balanceCents > 0 && <p className="quote-payment-notice" role="status">Waiting for Yoco confirmation. Refresh to check the balance.</p>}
      {query.payment_return === "cancelled" && <p role="status">Checkout was cancelled. No payment has been confirmed.</p>}
      {query.payment_return === "failed" && <p className="form-error">Payment was unsuccessful.</p>}
      {query.saved === "discarded" && <p className="form-success" role="status">Test checkout discarded. You can now record the sandbox EFT.</p>}
      {hasPendingCheckout && balanceCents > 0 && <section className="approval-panel no-print">
        <div><p className="eyebrow">PENDING YOCO CHECKOUT</p>
        <p>{invoice.mode === "test" ? "A test checkout is open. Discard it before recording a test EFT. Its old link will no longer credit this invoice." : "A Yoco checkout is open. Complete it or confirm its final status with Yoco before recording EFT."}</p></div>
        {invoice.mode === "test" && <form action={discardTestCheckout.bind(null, id)}>
          <button type="submit">Discard test checkout</button>
        </form>}
      </section>}
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
            <div><span>Invoice No:</span><strong>{invoice.invoice_number}</strong></div>
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

        {(payments ?? []).length > 0 && <section className="quote-footer invoice-payment-summary" aria-label="Payment breakdown">
          <h2>{settlementStatus === "Paid" ? "Paid in full" : "Payment received"}</h2>
          <ul className="invoice-payment-list">{payments!.map((entry) => <li key={entry.id}>
            <div><strong>{paymentMethodLabel(entry.payment_method, entry.provider)}</strong><strong>{formatMoney(entry.amount)}</strong></div>
            {entry.paid_at && <time dateTime={entry.paid_at}>{dateTime.format(new Date(entry.paid_at))} SAST</time>}
            {entry.metadata?.bank_reference && <p>Reference: {entry.metadata.bank_reference}</p>}
          </li>)}</ul>
        </section>}
        {balanceCents > 0 && (
          <section className="quote-footer" aria-label="Payment options">
            <strong>Payment options</strong>
            {invoice.mode === "test" && <p>Sandbox checkout: test payments only.</p>}
            <form action={payInvoice.bind(null, id)}>
              <button type="submit" className="quote-yoco-button">{invoice.mode === "test" ? "Test payment with Yoco" : "Pay with Yoco"}</button>
            </form>
            {checkoutUrl && <p><a href={checkoutUrl}>Open secure Yoco payment link</a> — this link is also included in the PDF.</p>}
            <p><strong>{invoice.mode === "test" ? "EFT details are available on live invoices" : "EFT"}</strong></p>
            {invoice.mode === "live" && <dl>{options.eft.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}</dl>}
          </section>
        )}
        <BillingEnquiries />
      </article>
      {balanceCents > 0 && !hasPendingCheckout && <section className="approval-panel no-print">
        <div><p className="eyebrow">{invoice.mode === "test" ? "SANDBOX EFT" : "EFT CONFIRMATION"}</p>
        <h2>{invoice.mode === "test" ? "Record a test EFT" : "Record EFT received"}</h2>
        <p>{invoice.mode === "test" ? "This records a sandbox payment only." : "Record an EFT after checking that the funds have reached the company bank account."} Partial payments reduce the balance.</p></div>
        <form action={recordEft.bind(null, id)} className="invoice-eft-form">
          <label>Amount received (ZAR)<input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" max={balanceCents / 100} required /></label>
          <label>Bank transaction reference<input name="reference" minLength={3} maxLength={120} required /></label>
          <label>Received date and time (SAST)<input name="received_at" type="datetime-local" required /></label>
          <label className="invoice-eft-confirm"><input name="confirmed" type="checkbox" value="yes" required />{invoice.mode === "test" ? "I am recording a sandbox EFT for testing." : "I checked the bank account and confirm these funds were received."}</label>
          <button type="submit">{invoice.mode === "test" ? "Record test EFT" : "Record EFT payment"}</button>
        </form>
      </section>}
    </main>
  );
}

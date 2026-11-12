import Link from "next/link";
import Image from "next/image";
import { unitLabels } from "@/lib/business-unit-labels";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createYocoCheckout } from "@/lib/yoco";
import { headers } from "next/headers";
import BillingPdfLink from "../../billing-pdf-link";
import { loadQuotation } from "@/lib/billing-documents";
import "../../ops.css";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ saved?: string; error?: string; payment_return?: string }>;

function fail(id: string, message: string): never {
  redirect(`/ops/quotations/${id}?error=${encodeURIComponent(message)}`);
}

async function updateApproval(id: string, formData: FormData) {
  "use server";

  const approvalStatus = String(formData.get("approval_status") ?? "");
  if (!["pending", "accepted", "declined"].includes(approvalStatus)) {
    fail(id, "Select a valid customer approval status.");
  }

  const supabase = await createClient();

  const { data: quote, error: quoteError } = await supabase
    .from("quotations")
    .select("id, service_request_id, approval_status")
    .eq("id", id)
    .single();

  if (quoteError || !quote) fail(id, "Unable to load this quotation.");

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("quotations")
    .update({
      approval_status: approvalStatus,
      approved_at: approvalStatus === "accepted" ? now : null,
      declined_at: approvalStatus === "declined" ? now : null,
    })
    .eq("id", id);

  if (updateError) fail(id, updateError.message);

  if (approvalStatus === "accepted") {
    const { error: requestError } = await supabase
      .from("service_requests")
      .update({
        status: "awaiting_payment",
        updated_at: now,
      })
      .eq("id", quote.service_request_id);

    if (requestError) fail(id, requestError.message);
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { error: eventError } = await supabase.from("request_events").insert({
    service_request_id: quote.service_request_id,
    event_type: `quotation_${approvalStatus}`,
    to_status: approvalStatus === "accepted" ? "awaiting_payment" : null,
    detail: {
      quotation_id: id,
      previous_approval_status: quote.approval_status,
      approval_status: approvalStatus,
    },
    created_by: user?.id ?? null,
  });

  if (eventError) fail(id, eventError.message);

  redirect(`/ops/quotations/${id}?saved=1`);
}


async function issueInvoice(id: string) {
  "use server";

  const key = process.env.YOCO_SECRET_KEY;
  const mode = key?.startsWith("sk_test_") ? "test" : key?.startsWith("sk_live_") ? "live" : null;
  if (!mode) fail(id, "Unable to determine the billing environment.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_invoice", {
    p_quotation_id: id,
    p_mode: mode,
  });
  if (error || !data) fail(id, error?.message ?? "Unable to issue the invoice.");
  redirect(`/ops/invoices/${data}`);
}

async function createCheckout(id: string) {
  "use server";

  const supabase = await createClient();

  const { data: quote, error: quoteError } = await supabase
    .from("quotations")
    .select("id, quotation_number, service_request_id, total, currency, approval_status")
    .eq("id", id)
    .single();

  if (quoteError || !quote) fail(id, "Unable to load this quotation.");
  if (quote.approval_status !== "accepted") {
    fail(id, "The quotation must be accepted before requesting payment.");
  }

  const { data: existing } = await supabase
    .from("payments")
    .select("id, checkout_url, status")
    .eq("quotation_id", id)
    .eq("provider", "yoco")
    .in("status", ["pending", "paid"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.status === "paid") {
    fail(id, "This quotation has already been paid.");
  }

  if (existing?.checkout_url) {
    redirect(existing.checkout_url);
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") || "https";
  if (!host) fail(id, "Unable to determine the application URL.");

  const origin = `${proto}://${host}`;
  const amountCents = Math.round(Number(quote.total) * 100);

  const checkout = await createYocoCheckout({
    amountCents,
    quotationId: quote.id,
    quotationNumber: quote.quotation_number,
    serviceRequestId: quote.service_request_id,
    successUrl: `${origin}/ops/quotations/${id}?payment_return=success`,
    cancelUrl: `${origin}/ops/quotations/${id}?payment_return=cancelled`,
    failureUrl: `${origin}/ops/quotations/${id}?payment_return=failed`,
  });

  const { error: paymentError } = await supabase.rpc("create_pending_payment", {
    p_service_request_id: quote.service_request_id,
    p_quotation_id: quote.id,
    p_provider: "yoco",
    p_provider_reference: checkout.id,
    p_checkout_url: checkout.redirectUrl,
    p_amount: Number(quote.total),
    p_currency: quote.currency ?? "ZAR",
    p_checkout_status: checkout.status,
    p_metadata: {
      quotation_number: quote.quotation_number,
      processing_mode: checkout.processingMode ?? null,
    },
  });

  if (paymentError) fail(id, paymentError.message);

  redirect(checkout.redirectUrl);
}

export default async function QuotationPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { saved, error, payment_return } = await searchParams;
  const supabase = await createClient();

  const { quote, request, customer, items } = await loadQuotation(supabase, id);

  const approvalAction = updateApproval.bind(null, id);
  const checkoutAction = createCheckout.bind(null, id);

  const { data: payments } = await supabase
    .from("payments")
    .select("provider, amount, status, paid_at, payment_method, metadata")
    .eq("quotation_id", id)
    .order("created_at", { ascending: false });
  const paidPayment = payments?.find((payment) => payment.status === "paid");
  const isSandboxPayment = paidPayment?.metadata?.processing_mode === "test";
  const paidAt = paidPayment?.paid_at;
  const paidTime = paidAt && new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Africa/Johannesburg",
    hour12: false,
  }).format(new Date(paidAt));
  const paymentMethods: Record<string, string> = {
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    card: "Card",
  };
  const paidMethod = paidPayment?.payment_method;
  const paidMethodLabel = paidMethod && paymentMethods[paidMethod];
  const { data: invoice } = await supabase.from("invoices").select("id, invoice_number")
    .eq("quotation_id", id).maybeSingle();
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "Africa/Johannesburg" })
      .format(new Date(value));
  const quoteStatus = paidPayment ? "Paid" : quote.approval_status === "accepted" ? "Awaiting payment"
    : quote.approval_status === "declined" ? "Declined"
    : quote.status === "sent" || quote.approval_status === "pending" ? "Awaiting approval" : "Draft";
  const money = (value: number | string | null) =>
    new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: quote.currency ?? "ZAR",
    }).format(Number(value ?? 0));

  return (
    <main className="quote-document-page">
      <section className="quote-toolbar no-print">
        <div>
          <p className="eyebrow">QUOTATION</p>
          <strong>{quote.quotation_number}</strong>
          <span className="quote-toolbar-status">{quoteStatus}</span>
        </div>
        <div className="quote-toolbar-actions">
          <Link href={`/ops/requests/${quote.service_request_id}`} className="button-link secondary-action">
            Back to request
          </Link>
          {invoice ? (
            <Link href={`/ops/invoices/${invoice.id}`} className="button-link secondary-action">View invoice</Link>
          ) : quote.approval_status === "accepted" && (
            <form action={issueInvoice.bind(null, id)}>
              <button type="submit" className="button-link secondary-action">Issue invoice</button>
            </form>
          )}
          <BillingPdfLink href={`/ops/quotations/${id}/pdf`} />
        </div>
      </section>

      {error && <div className="form-error no-print">{error}</div>}
      {saved && <div className="form-success no-print">Customer approval status updated.</div>}
      {paidPayment ? (
        <section className="quote-payment-confirmation no-print" aria-label="Payment confirmation">
          <span className="quote-payment-check" aria-hidden="true">✓</span>
          <div>
            <p className="eyebrow">{isSandboxPayment ? "YOCO SANDBOX PAYMENT" : "PAYMENT CONFIRMED"}</p>
            <h2>Paid</h2>
            <p>
              {paidMethodLabel && <strong>{paidMethodLabel}</strong>}
              {paidMethodLabel && paidTime && " · "}
              {paidTime && <time dateTime={paidAt}>{paidTime} SAST</time>}
            </p>
          </div>
          <strong className="quote-paid-amount">{money(paidPayment.amount)}</strong>
        </section>
      ) : (
        <>
          {payment_return === "success" && (
            <div className="quote-payment-notice no-print" role="status">
              Waiting for Yoco to confirm payment. Refresh this page to check again.
            </div>
          )}
          {payment_return === "cancelled" && (
            <div className="form-error no-print">Payment was cancelled before completion.</div>
          )}
          {payment_return === "failed" && (
            <div className="form-error no-print">Payment did not complete successfully.</div>
          )}
        </>
      )}

      <article className="quote-document">
        <header className="quote-brand-header">
          <div>
            <Image src="/brand/sz-shield.webp" width={48} height={52} className="billing-shield" alt="" />
            <p className="eyebrow">SZ PRIME SOLUTIONS (PTY) LTD</p>
            <h1>Quotation</h1>
            <p className="quote-tagline">{unitLabels[quote.issuing_unit ?? request.unit] ?? request.unit}</p>
          </div>
          <div className="quote-meta">
            <div><span>Quote no.</span><strong>{quote.quotation_number}</strong></div>
            <div><span>Date</span><strong>{formatDate(quote.created_at)}</strong></div>
            <div><span>Valid until</span><strong>{quote.valid_until ? formatDate(quote.valid_until) : "Not specified"}</strong></div>
          </div>
        </header>

        <section className="quote-customer-grid">
          <div>
            <p className="eyebrow">PREPARED FOR</p>
            <h2>{customer?.full_name ?? "Customer"}</h2>
            {customer?.phone && <p>{customer.phone}</p>}
            {customer?.email && <p>{customer.email}</p>}
            {customer?.location_text && <p>{customer.location_text}</p>}
          </div>
          <div>
            <p className="eyebrow">SERVICE REQUEST</p>
            <h2>{request.service_type}</h2>
            {request.description && <p>{request.description}</p>}
          </div>
        </section>

        <section className="quote-items-section">
          <table className="quote-items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td>{Number(item.quantity).toFixed(2)}</td>
                  <td>{money(item.unit_price)}</td>
                  <td>{money(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="quote-totals">
          <div><span>Subtotal</span><strong>{money(quote.subtotal)}</strong></div>
          <div><span>Additional fees</span><strong>{money(quote.fees)}</strong></div>
          <div className="quote-grand-total"><span>Total</span><strong>{money(quote.total)}</strong></div>
        </section>

        <footer className="quote-footer">
          <p>
            This quotation is issued by SZ Prime Solutions (Pty) Ltd. Final scheduling is confirmed after
            customer approval and any required payment.
          </p>
        </footer>
      </article>


      {!paidPayment && <section className="approval-panel no-print">
        <div>
          <p className="eyebrow">PAYMENT</p>
          <h2>Payment request</h2>
          <p>
            {quote.approval_status === "accepted"
              ? "Create or reopen a secure Yoco checkout for this accepted quotation."
              : "Customer acceptance is required before requesting payment."}
          </p>
          {(payments ?? []).length > 0 && (
            <p>
              Latest status: <strong>{String(payments?.[0]?.status ?? "pending").replaceAll("_", " ")}</strong>
            </p>
          )}
        </div>

        {quote.approval_status === "accepted" && (
          <form action={checkoutAction}>
            <button type="submit" className="quote-yoco-button">
              Pay with <span>Yoco</span> <span aria-hidden="true">↗</span>
            </button>
          </form>
        )}
      </section>}


      <section className="approval-panel no-print">
        <div>
          <p className="eyebrow">CUSTOMER APPROVAL</p>
          <h2>Record the customer response</h2>
          <p>Current status: <strong>{String(quote.approval_status).replaceAll("_", " ")}</strong></p>
        </div>

        <form action={approvalAction} className="approval-form">
          <select name="approval_status" defaultValue={quote.approval_status === "not_requested" ? "pending" : quote.approval_status}>
            <option value="pending">Pending customer response</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
          </select>
          <button type="submit">Save response</button>
        </form>
      </section>
    </main>
  );
}

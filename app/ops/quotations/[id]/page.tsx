import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createYocoCheckout } from "@/lib/yoco";
import { headers } from "next/headers";
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

  const { data: quote, error: quoteError } = await supabase
    .from("quotations")
    .select(`
      id,
      quotation_number,
      service_request_id,
      currency,
      subtotal,
      fees,
      total,
      status,
      approval_status,
      approved_at,
      declined_at,
      valid_until,
      created_at,
      service_requests(
        id,
        service_type,
        unit,
        description,
        customers(
          full_name,
          phone,
          email,
          location_text
        )
      )
    `)
    .eq("id", id)
    .single();

  if (quoteError || !quote) notFound();

  const request = Array.isArray(quote.service_requests)
    ? quote.service_requests[0]
    : quote.service_requests;

  if (!request) notFound();

  const customer = Array.isArray(request.customers)
    ? request.customers[0]
    : request.customers;

  const { data: items, error: itemsError } = await supabase
    .from("quotation_items")
    .select("id, description, quantity, unit_price, line_total, sort_order")
    .eq("quotation_id", id)
    .order("sort_order", { ascending: true });

  if (itemsError) notFound();

  const approvalAction = updateApproval.bind(null, id);
  const checkoutAction = createCheckout.bind(null, id);

  const { data: payments } = await supabase
    .from("payments")
    .select("id, provider, provider_reference, amount, currency, status, checkout_status, checkout_url, paid_at, created_at")
    .eq("quotation_id", id)
    .order("created_at", { ascending: false });
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
        </div>
        <div className="quote-toolbar-actions">
          <Link href={`/ops/requests/${quote.service_request_id}`} className="button-link secondary-action">
            Back to request
          </Link>
          <span className="print-hint">Use browser Print → Save as PDF</span>
        </div>
      </section>

      {error && <div className="form-error no-print">{error}</div>}
      {saved && <div className="form-success no-print">Customer approval status updated.</div>}
      {payment_return === "success" && (
        <div className="form-success no-print">
          Payment page completed. Final payment confirmation is verified by Yoco webhook.
        </div>
      )}
      {payment_return === "cancelled" && (
        <div className="form-error no-print">Payment was cancelled before completion.</div>
      )}
      {payment_return === "failed" && (
        <div className="form-error no-print">Payment did not complete successfully.</div>
      )}

      <article className="quote-document">
        <header className="quote-brand-header">
          <div>
            <p className="eyebrow">SZ PRIME SOLUTIONS (PTY) LTD</p>
            <h1>Quotation</h1>
            <p className="quote-tagline">Structured. Reliable. Prime.</p>
          </div>
          <div className="quote-meta">
            <div><span>Quote no.</span><strong>{quote.quotation_number}</strong></div>
            <div><span>Date</span><strong>{new Date(quote.created_at).toLocaleDateString("en-ZA")}</strong></div>
            <div><span>Valid until</span><strong>{quote.valid_until ?? "Not specified"}</strong></div>
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


      <section className="approval-panel no-print">
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
              {payments?.[0]?.paid_at ? ` · Paid ${new Date(payments[0].paid_at).toLocaleString("en-ZA")}` : ""}
            </p>
          )}
        </div>

        {quote.approval_status === "accepted" && payments?.[0]?.status !== "paid" && (
          <form action={checkoutAction}>
            <button type="submit">Pay with Yoco</button>
          </form>
        )}
      </section>


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

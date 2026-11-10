import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import "../../ops.css";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ saved?: string; error?: string }>;

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

export default async function QuotationPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { saved, error } = await searchParams;
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

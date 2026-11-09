import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import "../../../../ops.css";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

function fail(id: string, message: string): never {
  redirect(`/ops/requests/${id}/quotation/new?error=${encodeURIComponent(message)}`);
}

function parseMoney(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : NaN;
}

async function createQuotation(id: string, formData: FormData) {
  "use server";

  const subtotal = parseMoney(formData.get("subtotal"));
  const fees = parseMoney(formData.get("fees"));
  const status = String(formData.get("status") ?? "draft");
  const validUntil = String(formData.get("valid_until") ?? "").trim();

  if (!Number.isFinite(subtotal) || subtotal < 0) {
    fail(id, "Enter a valid quotation subtotal.");
  }

  if (!Number.isFinite(fees) || fees < 0) {
    fail(id, "Enter valid additional fees. Use 0 if there are none.");
  }

  if (!["draft", "sent"].includes(status)) {
    fail(id, "Select a valid quotation status.");
  }

  if (validUntil) {
    const parsed = new Date(validUntil + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) {
      fail(id, "Enter a valid quotation expiry date.");
    }
  }

  const supabase = await createClient();

  const { data: request, error: requestError } = await supabase
    .from("service_requests")
    .select("id, status")
    .eq("id", id)
    .single();

  if (requestError || !request) {
    fail(id, "Unable to load the service request.");
  }

  const { data: quotation, error: quoteError } = await supabase
    .from("quotations")
    .insert({
      service_request_id: id,
      currency: "ZAR",
      subtotal,
      fees,
      status,
      valid_until: validUntil || null,
    })
    .select("id")
    .single();

  if (quoteError || !quotation) {
    fail(id, quoteError?.message || "Unable to create the quotation.");
  }

  if (status === "sent") {
    const { error: requestUpdateError } = await supabase
      .from("service_requests")
      .update({
        status: "quoted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (requestUpdateError) fail(id, requestUpdateError.message);

    const { data: { user } } = await supabase.auth.getUser();

    const { error: eventError } = await supabase.from("request_events").insert({
      service_request_id: id,
      event_type: "quotation_sent",
      from_status: request.status,
      to_status: "quoted",
      detail: {
        quotation_id: quotation.id,
        subtotal,
        fees,
        total: subtotal + fees,
        currency: "ZAR",
      },
      created_by: user?.id ?? null,
    });

    if (eventError) fail(id, eventError.message);
  }

  redirect(`/ops/requests/${id}?quote_created=1`);
}

export default async function NewQuotationPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: request, error: requestError } = await supabase
    .from("service_requests")
    .select("id, service_type, unit, customers(full_name)")
    .eq("id", id)
    .single();

  if (requestError || !request) notFound();

  const customer = Array.isArray(request.customers) ? request.customers[0] : request.customers;

  const createAction = createQuotation.bind(null, id);

  return (
    <main className="ops-form-page">
      <section className="ops-form-shell">
        <div className="form-topbar">
          <div>
            <p className="eyebrow">COMMERCIAL</p>
            <h1>Create quotation</h1>
            <p>
              {customer?.full_name ?? "Customer"} · {request.service_type}
            </p>
          </div>
          <Link href={`/ops/requests/${id}`} className="button-link">
            Back to request
          </Link>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form action={createAction} className="request-form">
          <fieldset>
            <legend>Quotation pricing</legend>
            <p className="fieldset-help">
              This first version captures the quotation totals. Detailed line items and PDF generation
              will be added in the next commercial iteration.
            </p>

            <div className="form-grid">
              <label>
                Service subtotal (R) *
                <input
                  name="subtotal"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 850.00"
                  required
                />
              </label>

              <label>
                Additional fees (R) *
                <input
                  name="fees"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue="0"
                  required
                />
                <span className="field-hint">
                  Use for travel, call-out, coordination or other agreed fees.
                </span>
              </label>

              <label>
                Valid until
                <input name="valid_until" type="date" />
              </label>

              <label>
                Quotation status *
                <select name="status" defaultValue="draft" required>
                  <option value="draft">Draft — internal only</option>
                  <option value="sent">Sent — mark request as quoted</option>
                </select>
              </label>
            </div>
          </fieldset>

          <div className="quote-total-note">
            <strong>Total calculation:</strong> subtotal + additional fees. Currency is ZAR.
          </div>

          <div className="form-actions">
            <Link href={`/ops/requests/${id}`} className="button-link secondary-action">
              Cancel
            </Link>
            <button type="submit">Create quotation</button>
          </div>
        </form>
      </section>
    </main>
  );
}

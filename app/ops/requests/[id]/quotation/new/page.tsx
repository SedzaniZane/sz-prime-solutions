import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import "../../../../ops.css";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

function fail(id: string, message: string): never {
  redirect(`/ops/requests/${id}/quotation/new?error=${encodeURIComponent(message)}`);
}

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : NaN;
}

async function createQuotation(id: string, formData: FormData) {
  "use server";

  const descriptions = formData.getAll("item_description").map((v) => String(v).trim());
  const quantities = formData.getAll("item_quantity").map((v) => Number(String(v)));
  const prices = formData.getAll("item_unit_price").map((v) => Number(String(v)));

  const items = descriptions
    .map((description, index) => ({
      description,
      quantity: quantities[index],
      unit_price: prices[index],
    }))
    .filter((item) => item.description || Number.isFinite(item.quantity) || Number.isFinite(item.unit_price))
    .filter((item) => item.description);

  if (items.length === 0) {
    fail(id, "Add at least one quotation line item.");
  }

  for (const item of items) {
    if (!item.description) fail(id, "Every quotation item needs a description.");
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      fail(id, "Each quotation item needs a quantity greater than zero.");
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      fail(id, "Each quotation item needs a valid unit price.");
    }
  }

  const fees = numberValue(formData.get("fees"));
  if (!Number.isFinite(fees) || fees < 0) {
    fail(id, "Enter valid additional fees. Use 0 if there are none.");
  }

  const status = String(formData.get("status") ?? "draft");
  if (!["draft", "sent"].includes(status)) {
    fail(id, "Select a valid quotation status.");
  }

  const validUntil = String(formData.get("valid_until") ?? "").trim();
  if (validUntil) {
    const parsed = new Date(validUntil + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) fail(id, "Enter a valid quotation expiry date.");
  }

  const supabase = await createClient();

  const { data: quotationId, error } = await supabase.rpc("create_quotation_with_items", {
    p_service_request_id: id,
    p_items: items,
    p_fees: fees,
    p_status: status,
    p_valid_until: validUntil || null,
  });

  if (error || !quotationId) {
    fail(id, error?.message || "Unable to create the quotation.");
  }

  redirect(`/ops/quotations/${quotationId}`);
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
            <p>{customer?.full_name ?? "Customer"} · {request.service_type}</p>
          </div>
          <Link href={`/ops/requests/${id}`} className="button-link">Back to request</Link>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form action={createAction} className="request-form">
          <fieldset>
            <legend>Quotation line items</legend>
            <p className="fieldset-help">
              Add the actual products or services being quoted. Leave unused rows blank.
            </p>

            <div className="quote-lines">
              {[0, 1, 2, 3, 4].map((index) => (
                <div className="quote-line" key={index}>
                  <label>
                    Description
                    <input
                      name="item_description"
                      placeholder={index === 0 ? "e.g. Move-out cleaning" : "Optional item"}
                    />
                  </label>
                  <label>
                    Qty
                    <input
                      name="item_quantity"
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      defaultValue={index === 0 ? "1" : ""}
                    />
                  </label>
                  <label>
                    Unit price (R)
                    <input
                      name="item_unit_price"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                    />
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Quotation terms</legend>
            <div className="form-grid">
              <label>
                Additional fees (R) *
                <input name="fees" type="number" min="0" step="0.01" defaultValue="0" required />
                <span className="field-hint">
                  Travel, call-out or coordination fees. Use 0 if none apply.
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
                  <option value="sent">Sent — awaiting customer response</option>
                </select>
              </label>
            </div>
          </fieldset>

          <div className="quote-total-note">
            <strong>Total calculation:</strong> line-item subtotal + additional fees. Currency is ZAR.
          </div>

          <div className="form-actions">
            <Link href={`/ops/requests/${id}`} className="button-link secondary-action">Cancel</Link>
            <button type="submit">Create quotation</button>
          </div>
        </form>
      </section>
    </main>
  );
}

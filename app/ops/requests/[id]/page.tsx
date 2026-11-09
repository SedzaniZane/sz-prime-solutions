import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { validateCustomerContacts } from "@/lib/customer-validation";
import "../../ops.css";

const units = [
  ["prime_living", "SZ Prime Living Accommodations"],
  ["prime_relocations", "SZ Prime Relocations"],
  ["pristine_cleaning", "SZ Pristine Cleaning"],
  ["prime_plug_connect", "SZ Prime Plug-Connect"],
  ["prime_facilities", "SZ Prime Facilities"],
  ["prime_tech_hub", "SZ Prime Tech Hub"],
  ["prime_business_solutions", "SZ Prime Business Solutions"],
] as const;

const statuses = [
  ["new", "New"],
  ["qualified", "Qualified"],
  ["quoted", "Quoted"],
  ["awaiting_payment", "Awaiting payment"],
  ["scheduled", "Scheduled"],
  ["in_progress", "In progress"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
] as const;

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string; saved?: string }>;

function fail(id: string, message: string): never {
  redirect(`/ops/requests/${id}?error=${encodeURIComponent(message)}`);
}

async function updateRequest(id: string, formData: FormData) {
  "use server";

  const supabase = await createClient();

  const { data: current, error: currentError } = await supabase
    .from("service_requests")
    .select("id, customer_id, status, unit")
    .eq("id", id)
    .single();

  if (currentError || !current) fail(id, "Unable to load the current request.");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const phoneInput = String(formData.get("phone") ?? "");
  const emailInput = String(formData.get("email") ?? "");
  const unit = String(formData.get("unit") ?? "");
  const status = String(formData.get("status") ?? "");
  const serviceType = String(formData.get("service_type") ?? "").trim();
  const preferredDate = String(formData.get("preferred_date") ?? "").trim();

  if (!fullName) fail(id, "Customer name is required.");
  if (!serviceType) fail(id, "Service requested is required.");
  if (!units.some(([value]) => value === unit)) fail(id, "Select a valid business unit.");
  if (!statuses.some(([value]) => value === status)) fail(id, "Select a valid request status.");

  const contacts = validateCustomerContacts(phoneInput, emailInput);
  if (!contacts.ok) fail(id, contacts.message);

  let preferredDateIso: string | null = null;
  if (preferredDate) {
    const parsed = new Date(preferredDate);
    if (Number.isNaN(parsed.getTime())) fail(id, "Enter a valid service date and time.");
    preferredDateIso = parsed.toISOString();
  }

  const { error: customerError } = await supabase
    .from("customers")
    .update({
      full_name: fullName,
      phone: contacts.phone,
      email: contacts.email,
      preferred_language: String(formData.get("preferred_language") ?? "English"),
      location_text: String(formData.get("location_text") ?? "").trim() || null,
    })
    .eq("id", current.customer_id);

  if (customerError) fail(id, customerError.message);

  const { error: requestError } = await supabase
    .from("service_requests")
    .update({
      unit,
      status,
      service_type: serviceType,
      description: String(formData.get("description") ?? "").trim() || null,
      preferred_date: preferredDateIso,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (requestError) fail(id, requestError.message);

  if (current.status !== status || current.unit !== unit) {
    const { error: eventError } = await supabase.from("request_events").insert({
      service_request_id: id,
      event_type: current.status !== status ? "status_updated" : "unit_reassigned",
      from_status: current.status,
      to_status: status,
      detail: {
        previous_unit: current.unit,
        new_unit: unit,
      },
    });

    if (eventError) fail(id, eventError.message);
  }

  redirect(`/ops/requests/${id}?saved=1`);
}

async function addNote(id: string, customerId: string, formData: FormData) {
  "use server";

  const note = String(formData.get("note") ?? "").trim();
  if (!note) fail(id, "Enter a note before saving.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("customer_notes").insert({
    customer_id: customerId,
    note,
    created_by: user?.id ?? null,
  });

  if (error) fail(id, error.message);

  redirect(`/ops/requests/${id}?saved=1`);
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function labelForUnit(value: string) {
  return units.find(([key]) => key === value)?.[1] ?? value;
}

function labelForStatus(value: string) {
  return statuses.find(([key]) => key === value)?.[1] ?? value;
}

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const supabase = await createClient();

  const { data: request, error: requestError } = await supabase
    .from("service_requests")
    .select(`
      id,
      customer_id,
      unit,
      service_type,
      description,
      status,
      preferred_date,
      source,
      created_at,
      updated_at,
      customers(
        id,
        full_name,
        phone,
        email,
        preferred_language,
        location_text,
        created_at
      )
    `)
    .eq("id", id)
    .single();

  if (requestError || !request) notFound();

  const customer = Array.isArray(request.customers) ? request.customers[0] : request.customers;
  if (!customer) notFound();

  const [{ data: notes }, { data: events }] = await Promise.all([
    supabase
      .from("customer_notes")
      .select("id, note, created_by, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("request_events")
      .select("id, event_type, from_status, to_status, detail, created_by, created_at")
      .eq("service_request_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const addNoteAction = addNote.bind(null, id, customer.id);
  const updateAction = updateRequest.bind(null, id);

  return (
    <main className="ops-form-page">
      <section className="request-detail-shell">
        <div className="form-topbar">
          <div>
            <p className="eyebrow">SERVICE REQUEST</p>
            <h1>{request.service_type}</h1>
            <p>
              {customer.full_name} · {labelForUnit(request.unit)} · {labelForStatus(request.status)}
            </p>
          </div>
          <Link href="/ops" className="button-link">Back to Operations</Link>
        </div>

        {error && <div className="form-error">{error}</div>}
        {saved && <div className="form-success">Changes saved successfully.</div>}

        <div className="detail-grid">
          <section className="detail-main">
            <form action={updateAction} className="request-form">
              <fieldset>
                <legend>Customer profile</legend>
                <div className="form-grid">
                  <label>
                    Customer full name *
                    <input name="full_name" defaultValue={customer.full_name ?? ""} required />
                  </label>

                  <label>
                    Customer mobile number
                    <input name="phone" type="tel" defaultValue={customer.phone ?? ""} />
                  </label>

                  <label>
                    Customer email address
                    <input name="email" type="email" defaultValue={customer.email ?? ""} />
                  </label>

                  <label>
                    Preferred language
                    <select name="preferred_language" defaultValue={customer.preferred_language ?? "English"}>
                      <option>English</option>
                      <option>Tshivenda</option>
                      <option>Sepedi</option>
                      <option>isiZulu</option>
                      <option>Setswana</option>
                      <option>Sesotho</option>
                      <option>isiXhosa</option>
                      <option>Afrikaans</option>
                    </select>
                  </label>

                  <label className="form-span-2">
                    Customer suburb / area
                    <input name="location_text" defaultValue={customer.location_text ?? ""} />
                  </label>
                </div>
              </fieldset>

              <fieldset>
                <legend>Request management</legend>
                <div className="form-grid">
                  <label>
                    Assigned business unit *
                    <select name="unit" defaultValue={request.unit} required>
                      {units.map(([value, label]) => (
                        <option value={value} key={value}>{label}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Request status *
                    <select name="status" defaultValue={request.status} required>
                      {statuses.map(([value, label]) => (
                        <option value={value} key={value}>{label}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Service requested *
                    <input name="service_type" defaultValue={request.service_type} required />
                  </label>

                  <label>
                    Requested service date / time
                    <input
                      name="preferred_date"
                      type="datetime-local"
                      defaultValue={toLocalInput(request.preferred_date)}
                    />
                  </label>

                  <label className="form-span-2">
                    Customer request notes
                    <textarea name="description" rows={5} defaultValue={request.description ?? ""} />
                  </label>
                </div>
              </fieldset>

              <div className="form-actions">
                <button type="submit">Save changes</button>
              </div>
            </form>
          </section>

          <aside className="detail-side">
            <section className="detail-card">
              <p className="eyebrow">REQUEST SNAPSHOT</p>
              <dl>
                <div><dt>Status</dt><dd>{labelForStatus(request.status)}</dd></div>
                <div><dt>Source</dt><dd>{request.source ?? "Unknown"}</dd></div>
                <div><dt>Created</dt><dd>{new Date(request.created_at).toLocaleString("en-ZA")}</dd></div>
                <div><dt>Updated</dt><dd>{new Date(request.updated_at).toLocaleString("en-ZA")}</dd></div>
              </dl>
            </section>

            <section className="detail-card">
              <p className="eyebrow">INTERNAL NOTES</p>
              <form action={addNoteAction} className="note-form">
                <textarea name="note" rows={4} placeholder="Add an internal customer note..." />
                <button type="submit">Add note</button>
              </form>

              <div className="timeline-list">
                {(notes ?? []).length === 0 ? (
                  <p className="empty-copy">No internal notes yet.</p>
                ) : (
                  (notes ?? []).map((note) => (
                    <article key={note.id}>
                      <p>{note.note}</p>
                      <small>{new Date(note.created_at).toLocaleString("en-ZA")}</small>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="detail-card">
              <p className="eyebrow">REQUEST HISTORY</p>
              <div className="timeline-list">
                {(events ?? []).length === 0 ? (
                  <p className="empty-copy">No request history yet.</p>
                ) : (
                  (events ?? []).map((event) => (
                    <article key={event.id}>
                      <strong>{event.event_type.replaceAll("_", " ")}</strong>
                      <p>
                        {event.from_status ? `${labelForStatus(event.from_status)} → ` : ""}
                        {event.to_status ? labelForStatus(event.to_status) : ""}
                      </p>
                      <small>{new Date(event.created_at).toLocaleString("en-ZA")}</small>
                    </article>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import "../../../ops.css";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

function fail(id: string, message: string): never {
  redirect(`/ops/requests/${id}/schedule?error=${encodeURIComponent(message)}`);
}

async function scheduleJob(id: string, formData: FormData) {
  "use server";

  const fulfilmentType = String(formData.get("fulfilment_type") ?? "internal");
  const startRaw = String(formData.get("scheduled_start") ?? "").trim();
  const endRaw = String(formData.get("scheduled_end") ?? "").trim();
  const partnerId = String(formData.get("partner_id") ?? "").trim();
  const assignedStaffUserId = String(formData.get("assigned_staff_user_id") ?? "").trim();

  if (!startRaw) fail(id, "Select the scheduled start date and time.");

  const start = new Date(startRaw);
  if (Number.isNaN(start.getTime())) fail(id, "Enter a valid scheduled start date and time.");

  let endIso: string | null = null;
  if (endRaw) {
    const end = new Date(endRaw);
    if (Number.isNaN(end.getTime())) fail(id, "Enter a valid scheduled end date and time.");
    if (end <= start) fail(id, "Scheduled end must be after the start time.");
    endIso = end.toISOString();
  }

  if (!["internal", "partner"].includes(fulfilmentType)) {
    fail(id, "Select a valid fulfilment type.");
  }

  if (fulfilmentType === "partner" && !partnerId) {
    fail(id, "Select a Plug-Connect partner for partner fulfilment.");
  }

  const supabase = await createClient();

  const { data: jobId, error } = await supabase.rpc("schedule_service_job", {
    p_service_request_id: id,
    p_scheduled_start: start.toISOString(),
    p_scheduled_end: endIso,
    p_fulfilment_type: fulfilmentType,
    p_assigned_staff_user_id: fulfilmentType === "internal" && assignedStaffUserId ? assignedStaffUserId : null,
    p_partner_id: fulfilmentType === "partner" ? partnerId : null,
    p_operational_notes: String(formData.get("operational_notes") ?? ""),
  });

  if (error || !jobId) fail(id, error?.message || "Unable to schedule this job.");

  redirect(`/ops/jobs/${jobId}?scheduled=1`);
}

export default async function ScheduleJobPage({
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
    .select("id, status, service_type, customers(full_name, location_text)")
    .eq("id", id)
    .single();

  if (requestError || !request) notFound();

  const customer = Array.isArray(request.customers) ? request.customers[0] : request.customers;

  const [{ data: partners }, { data: staff }] = await Promise.all([
    supabase
      .from("partners")
      .select("id, business_name, contact_name, verification_status")
      .eq("active", true)
      .order("business_name"),
    supabase
      .from("staff_profiles")
      .select("user_id, full_name, role, active")
      .eq("active", true)
      .order("full_name"),
  ]);

  const action = scheduleJob.bind(null, id);

  return (
    <main className="ops-form-page">
      <section className="ops-form-shell">
        <div className="form-topbar">
          <div>
            <p className="eyebrow">JOB SCHEDULING</p>
            <h1>Schedule fulfilment</h1>
            <p>
              {customer?.full_name ?? "Customer"} · {request.service_type}
              {customer?.location_text ? ` · ${customer.location_text}` : ""}
            </p>
          </div>
          <Link href={`/ops/requests/${id}`} className="button-link">Back to request</Link>
        </div>

        {error && <div className="form-error">{error}</div>}

        {request.status !== "paid" && request.status !== "scheduled" && (
          <div className="form-error">
            This request is currently <strong>{String(request.status).replaceAll("_", " ")}</strong>.
            Only paid requests can be scheduled.
          </div>
        )}

        <form action={action} className="request-form">
          <fieldset>
            <legend>Schedule</legend>
            <div className="form-grid">
              <label>
                Scheduled start *
                <input name="scheduled_start" type="datetime-local" required />
              </label>

              <label>
                Scheduled end
                <input name="scheduled_end" type="datetime-local" />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Fulfilment</legend>
            <p className="fieldset-help">
              Choose whether SZ Prime handles the job internally or assigns it through SZ Prime Plug-Connect.
            </p>

            <div className="form-grid">
              <label>
                Fulfilment type *
                <select name="fulfilment_type" defaultValue="internal">
                  <option value="internal">Internal SZ Prime team</option>
                  <option value="partner">Plug-Connect partner</option>
                </select>
              </label>

              <label>
                Internal staff member
                <select name="assigned_staff_user_id" defaultValue="">
                  <option value="">Not assigned yet</option>
                  {(staff ?? []).map((member) => (
                    <option value={member.user_id} key={member.user_id}>
                      {member.full_name || member.role || member.user_id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-span-2">
                Plug-Connect partner
                <select name="partner_id" defaultValue="">
                  <option value="">Select only for partner fulfilment</option>
                  {(partners ?? []).map((partner) => (
                    <option value={partner.id} key={partner.id}>
                      {partner.business_name}
                      {partner.contact_name ? ` — ${partner.contact_name}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-span-2">
                Operational notes
                <textarea
                  name="operational_notes"
                  rows={5}
                  placeholder="Access instructions, items/equipment required, team notes, customer timing requirements, etc."
                />
              </label>
            </div>
          </fieldset>

          <div className="form-actions">
            <Link href={`/ops/requests/${id}`} className="button-link secondary-action">Cancel</Link>
            <button type="submit" disabled={request.status !== "paid" && request.status !== "scheduled"}>
              Schedule job
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

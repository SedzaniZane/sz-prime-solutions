import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import "../../ops.css";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string; saved?: string; scheduled?: string }>;

function fail(id: string, message: string): never {
  redirect(`/ops/jobs/${id}?error=${encodeURIComponent(message)}`);
}

async function updateJob(id: string, formData: FormData) {
  "use server";

  const nextStatus = String(formData.get("status") ?? "");
  if (!["scheduled", "in_progress", "completed", "cancelled"].includes(nextStatus)) {
    fail(id, "Select a valid job status.");
  }

  const supabase = await createClient();

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, service_request_id, status")
    .eq("id", id)
    .single();

  if (jobError || !job) fail(id, "Unable to load this job.");

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("jobs")
    .update({
      status: nextStatus,
      operational_notes: String(formData.get("operational_notes") ?? "").trim() || null,
      started_at: nextStatus === "in_progress" ? now : undefined,
      completed_at: nextStatus === "completed" ? now : undefined,
      updated_at: now,
    })
    .eq("id", id);

  if (updateError) fail(id, updateError.message);

  const mappedRequestStatus =
    nextStatus === "in_progress"
      ? "in_progress"
      : nextStatus === "completed"
        ? "completed"
        : nextStatus === "cancelled"
          ? "cancelled"
          : "scheduled";

  const { error: requestError } = await supabase
    .from("service_requests")
    .update({
      status: mappedRequestStatus,
      updated_at: now,
    })
    .eq("id", job.service_request_id);

  if (requestError) fail(id, requestError.message);

  const { data: { user } } = await supabase.auth.getUser();

  const { error: eventError } = await supabase.from("request_events").insert({
    service_request_id: job.service_request_id,
    event_type: `job_${nextStatus}`,
    from_status: job.status === "scheduled" ? "scheduled" : job.status,
    to_status: mappedRequestStatus,
    detail: { job_id: id },
    created_by: user?.id ?? null,
  });

  if (eventError) fail(id, eventError.message);

  redirect(`/ops/jobs/${id}?saved=1`);
}

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { error, saved, scheduled } = await searchParams;
  const supabase = await createClient();

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(`
      id,
      service_request_id,
      fulfilment_type,
      assigned_staff_user_id,
      partner_id,
      scheduled_start,
      scheduled_end,
      operational_notes,
      status,
      started_at,
      completed_at,
      created_at,
      updated_at,
      service_requests(
        service_type,
        status,
        customers(full_name, phone, email, location_text)
      ),
      partners(business_name, contact_name, phone)
    `)
    .eq("id", id)
    .single();

  if (jobError || !job) notFound();

  const request = Array.isArray(job.service_requests) ? job.service_requests[0] : job.service_requests;
  const customer = request && (Array.isArray(request.customers) ? request.customers[0] : request.customers);
  const partner = Array.isArray(job.partners) ? job.partners[0] : job.partners;

  let staffName: string | null = null;
  if (job.assigned_staff_user_id) {
    const { data: staff } = await supabase
      .from("staff_profiles")
      .select("full_name, role")
      .eq("user_id", job.assigned_staff_user_id)
      .maybeSingle();
    staffName = staff?.full_name || staff?.role || job.assigned_staff_user_id;
  }

  const action = updateJob.bind(null, id);

  return (
    <main className="ops-form-page">
      <section className="request-detail-shell">
        <div className="form-topbar">
          <div>
            <p className="eyebrow">JOB MANAGEMENT</p>
            <h1>{request?.service_type ?? "Scheduled job"}</h1>
            <p>{customer?.full_name ?? "Customer"} · {String(job.status).replaceAll("_", " ")}</p>
          </div>
          <Link href={`/ops/requests/${job.service_request_id}`} className="button-link">View request</Link>
        </div>

        {error && <div className="form-error">{error}</div>}
        {scheduled && <div className="form-success">Job scheduled successfully.</div>}
        {saved && <div className="form-success">Job updated successfully.</div>}

        <div className="detail-grid">
          <section className="detail-main">
            <section className="detail-card">
              <p className="eyebrow">SCHEDULE</p>
              <dl>
                <div><dt>Start</dt><dd>{new Date(job.scheduled_start).toLocaleString("en-ZA")}</dd></div>
                <div><dt>End</dt><dd>{job.scheduled_end ? new Date(job.scheduled_end).toLocaleString("en-ZA") : "Not set"}</dd></div>
                <div><dt>Location</dt><dd>{customer?.location_text ?? "Not captured"}</dd></div>
                <div><dt>Fulfilment</dt><dd>{job.fulfilment_type === "partner" ? "Plug-Connect partner" : "Internal team"}</dd></div>
                <div><dt>Assigned to</dt><dd>{job.fulfilment_type === "partner" ? partner?.business_name ?? "Partner" : staffName ?? "Not assigned"}</dd></div>
              </dl>
            </section>

            <form action={action} className="request-form job-status-form">
              <fieldset>
                <legend>Job progress</legend>
                <div className="form-grid">
                  <label>
                    Job status *
                    <select name="status" defaultValue={job.status}>
                      <option value="scheduled">Scheduled</option>
                      <option value="in_progress">In progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>

                  <label className="form-span-2">
                    Operational notes
                    <textarea name="operational_notes" rows={6} defaultValue={job.operational_notes ?? ""} />
                  </label>
                </div>
              </fieldset>

              <div className="form-actions">
                <button type="submit">Save job update</button>
              </div>
            </form>
          </section>

          <aside className="detail-side">
            <section className="detail-card">
              <p className="eyebrow">CUSTOMER</p>
              <h3>{customer?.full_name ?? "Customer"}</h3>
              {customer?.phone && <p>{customer.phone}</p>}
              {customer?.email && <p>{customer.email}</p>}
              {customer?.location_text && <p>{customer.location_text}</p>}
            </section>

            <section className="detail-card">
              <p className="eyebrow">TIMESTAMPS</p>
              <dl>
                <div><dt>Created</dt><dd>{new Date(job.created_at).toLocaleString("en-ZA")}</dd></div>
                <div><dt>Started</dt><dd>{job.started_at ? new Date(job.started_at).toLocaleString("en-ZA") : "Not started"}</dd></div>
                <div><dt>Completed</dt><dd>{job.completed_at ? new Date(job.completed_at).toLocaleString("en-ZA") : "Not completed"}</dd></div>
              </dl>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

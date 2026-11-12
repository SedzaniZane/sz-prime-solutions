import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import "../ops.css";

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function JobsPage() {
  const supabase = await createClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select(`
      id,
      service_request_id,
      fulfilment_type,
      scheduled_start,
      scheduled_end,
      status,
      assigned_staff_user_id,
      partners(business_name),
      service_requests(
        service_type,
        customers(full_name, location_text)
      )
    `)
    .order("scheduled_start", { ascending: true });

  return (
    <main className="ops-form-page">
      <section className="request-detail-shell">
        <div className="form-topbar">
          <div>
            <p className="eyebrow">JOB OPERATIONS</p>
            <h1>Scheduled work</h1>
            <p>Track paid requests from scheduling through fulfilment and completion.</p>
          </div>
          <Link href="/ops" className="button-link">Back to Operations</Link>
        </div>

        <section className="ops-panel jobs-panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Scheduled</th>
                  <th>Fulfilment</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(jobs ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6}>No scheduled jobs yet.</td>
                  </tr>
                ) : (
                  (jobs ?? []).map((job: any) => {
                    const request = Array.isArray(job.service_requests)
                      ? job.service_requests[0]
                      : job.service_requests;
                    const customer = request && (
                      Array.isArray(request.customers) ? request.customers[0] : request.customers
                    );
                    const partner = Array.isArray(job.partners) ? job.partners[0] : job.partners;

                    return (
                      <tr key={job.id}>
                        <td>
                          <Link className="table-link" href={`/ops/jobs/${job.id}`}>
                            {customer?.full_name ?? "Customer"}
                          </Link>
                        </td>
                        <td>{request?.service_type ?? "Service"}</td>
                        <td>{new Date(job.scheduled_start).toLocaleString("en-ZA")}</td>
                        <td>
                          {job.fulfilment_type === "partner"
                            ? partner?.business_name ?? "Plug-Connect partner"
                            : "Internal SZ Prime"}
                        </td>
                        <td>{customer?.location_text ?? "Not captured"}</td>
                        <td><span className="status">{titleCase(job.status)}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

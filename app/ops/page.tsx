import "./ops.css";
import { createClient } from "@/utils/supabase/server";

const unitLabels: Record<string, string> = {
  pristine_cleaning: "SZ Pristine Cleaning",
  prime_living: "SZ Prime Living Accommodations",
  prime_relocations: "SZ Prime Relocations",
  prime_plug_connect: "SZ Prime Plug-Connect",
  prime_facilities: "SZ Prime Facilities",
  prime_business_solutions: "SZ Prime Business Solutions",
  prime_tech_hub: "SZ Prime Tech Hub",
};

const unitCategories: Record<string, string> = {
  pristine_cleaning: "Cleaning",
  prime_living: "Accommodation",
  prime_relocations: "Moving & setup",
  prime_plug_connect: "Service brokerage",
  prime_facilities: "B2B facilities",
  prime_business_solutions: "Business enablement",
  prime_tech_hub: "Technology engine",
};

const unitKeys = Object.keys(unitLabels);

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function OperationsPage() {
  const supabase = await createClient();

  const [
    { data: profile },
    { count: openLeads },
    { count: awaitingQuotes },
    { count: activeJobs },
    { count: pendingPayments },
    { data: recentRequests },
    { data: unitRows },
  ] = await Promise.all([
    supabase.from("staff_profiles").select("full_name, role").maybeSingle(),
    supabase
      .from("service_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["new", "qualified"]),
    supabase
      .from("service_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "qualified"),
    supabase
      .from("service_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["scheduled", "in_progress"]),
    supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("service_requests")
      .select("id, unit, service_type, status, source, created_at, customers(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("service_requests")
      .select("unit, status"),
  ]);

  const metrics = [
    { label: "Open leads", value: openLeads ?? 0, detail: "New or qualified opportunities" },
    { label: "Awaiting quotes", value: awaitingQuotes ?? 0, detail: "Qualified requests needing commercial action" },
    { label: "Active jobs", value: activeJobs ?? 0, detail: "Scheduled or currently in progress" },
    { label: "Payments pending", value: pendingPayments ?? 0, detail: "Outstanding payment records" },
  ];

  const unitActivity = unitKeys.map((key) => {
    const active = (unitRows ?? []).filter(
      (row) =>
        row.unit === key &&
        !["completed", "cancelled"].includes(row.status),
    ).length;

    return {
      key,
      name: unitLabels[key],
      category: unitCategories[key],
      activity: `${active} active`,
    };
  });

  const isStaff = Boolean(profile);

  return (
    <main className="ops-shell">
      <aside className="sidebar">
        <div>
          <p className="brand-kicker">SZ PRIME SOLUTIONS</p>
          <h1>Operations</h1>
        </div>

        <nav>
          <a className="active" href="#overview">Overview</a>
          <a href="#requests">Service requests</a>
          <a href="#units">Business units</a>
          <a href="#partners">Partners</a>
          <a href="#quotes">Quotations</a>
          <a href="#payments">Payments</a>
        </nav>

        <div className="sidebar-note">
          <strong>{profile?.full_name || "Authenticated user"}</strong>
          <p>{profile ? `${titleCase(profile.role)} access` : "Staff profile setup required"}</p>
        </div>
      </aside>

      <section className="ops-content">
        <header className="ops-header" id="overview">
          <div>
            <p className="eyebrow">MASTER CONTROL</p>
            <h2>Here is the live SZ Prime operating picture.</h2>
          </div>
          <a className="new-request" href="/">Public site</a>
        </header>

        {!isStaff && (
          <section className="ops-panel">
            <p className="eyebrow">ACCESS SETUP</p>
            <h3>Your login works, but this account is not yet registered as SZ Prime staff.</h3>
            <p>
              Add this authenticated user to the <code>staff_profiles</code> table before CRM data
              will be visible. Row Level Security is intentionally blocking access until then.
            </p>
          </section>
        )}

        <section className="metric-grid">
          {metrics.map((metric) => (
            <article key={metric.label} className="metric-card">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.detail}</p>
            </article>
          ))}
        </section>

        <section className="ops-panel" id="requests">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CUSTOMER FLOW</p>
              <h3>Recent service requests</h3>
            </div>
            <button type="button">Add request</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Business unit</th>
                  <th>Service</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(recentRequests ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5}>No visible service requests yet.</td>
                  </tr>
                ) : (
                  (recentRequests ?? []).map((request: any) => (
                    <tr key={request.id}>
                      <td>{request.customers?.full_name ?? "Unknown customer"}</td>
                      <td>{unitLabels[request.unit] ?? titleCase(request.unit)}</td>
                      <td>{request.service_type}</td>
                      <td>{titleCase(request.source ?? "unknown")}</td>
                      <td><span className="status">{titleCase(request.status)}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ops-panel" id="units">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ECOSYSTEM</p>
              <h3>Business-unit pulse</h3>
            </div>
          </div>
          <div className="unit-grid">
            {unitActivity.map((unit) => (
              <article className="unit-card" key={unit.key}>
                <span>{unit.category}</span>
                <h4>{unit.name}</h4>
                <p>{unit.activity}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ops-panel roadmap-panel">
          <div>
            <p className="eyebrow">LIVE FOUNDATION</p>
            <h3>The CRM is now reading from the production database.</h3>
          </div>
          <div className="next-grid">
            <div><strong>01</strong><span>Staff authentication and RLS</span></div>
            <div><strong>02</strong><span>Live customers and requests</span></div>
            <div><strong>03</strong><span>Next: create/edit workflows</span></div>
            <div><strong>04</strong><span>Next: WhatsApp lead ingestion</span></div>
            <div><strong>05</strong><span>Next: Yoco payment states</span></div>
            <div><strong>06</strong><span>Next: revenue and cross-sell reporting</span></div>
          </div>
        </section>
      </section>
    </main>
  );
}

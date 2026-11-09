import "./ops.css";

const metrics = [
  { label: "Open leads", value: "18", detail: "Across all business units" },
  { label: "Awaiting quotes", value: "7", detail: "Needs pricing or approval" },
  { label: "Active jobs", value: "11", detail: "Scheduled or in progress" },
  { label: "Payments pending", value: "5", detail: "Follow-up required" },
];

const requests = [
  { customer: "Lerato M.", unit: "SZ Pristine", service: "Move-out clean", status: "Quoted", source: "WhatsApp" },
  { customer: "Thabo K.", unit: "ZaNdou Relocations", service: "Student move", status: "New", source: "Website" },
  { customer: "Maseko Properties", unit: "SZ Prime Facilities", service: "Turnover support", status: "Scheduled", source: "Referral" },
  { customer: "Naledi Tech", unit: "SZ Business Solutions", service: "WhatsApp automation", status: "Qualified", source: "Website" },
  { customer: "Anonymous lead", unit: "ZaNdou Living", service: "Accommodation enquiry", status: "New", source: "WhatsApp" },
];

const units = [
  ["SZ Pristine Solutions", "Cleaning", "4 active"],
  ["ZaNdou Living", "Accommodation", "3 active"],
  ["ZaNdou Relocations", "Moving & setup", "4 active"],
  ["ZaNdou Connect", "Service brokerage", "2 active"],
  ["SZ Prime Facilities", "B2B facilities", "5 active"],
  ["SZ Business Solutions", "Business enablement", "6 active"],
  ["SZ Tech Hub", "Technology engine", "5 active"],
];

export default function OperationsPage() {
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
          <strong>Foundation mode</strong>
          <p>This dashboard currently uses sample data while Supabase, authentication and live workflows are connected.</p>
        </div>
      </aside>

      <section className="ops-content">
        <header className="ops-header" id="overview">
          <div>
            <p className="eyebrow">MASTER CONTROL</p>
            <h2>Good morning. Here is the SZ Prime operating picture.</h2>
          </div>
          <a className="new-request" href="/">Public site</a>
        </header>

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
                {requests.map((request) => (
                  <tr key={request.customer + request.service}>
                    <td>{request.customer}</td>
                    <td>{request.unit}</td>
                    <td>{request.service}</td>
                    <td>{request.source}</td>
                    <td><span className="status">{request.status}</span></td>
                  </tr>
                ))}
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
            {units.map(([name, category, activity]) => (
              <article className="unit-card" key={name}>
                <span>{category}</span>
                <h4>{name}</h4>
                <p>{activity}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ops-panel roadmap-panel">
          <div>
            <p className="eyebrow">NEXT CONNECTIONS</p>
            <h3>What this dashboard becomes next</h3>
          </div>
          <div className="next-grid">
            <div><strong>01</strong><span>Supabase live CRM data</span></div>
            <div><strong>02</strong><span>Staff authentication and roles</span></div>
            <div><strong>03</strong><span>WhatsApp lead ingestion</span></div>
            <div><strong>04</strong><span>Quotes and Yoco payment states</span></div>
            <div><strong>05</strong><span>Partner matching and assignments</span></div>
            <div><strong>06</strong><span>Revenue and cross-sell reporting</span></div>
          </div>
        </section>
      </section>
    </main>
  );
}

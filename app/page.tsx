const units = [
  {
    name: "SZ Pristine Solutions",
    category: "Cleaning",
    description: "Residential, move-in, move-out, turnover and commercial cleaning services.",
  },
  {
    name: "ZaNdou Living",
    category: "Accommodation",
    description: "Accommodation discovery, rental support, landlord connections and property services.",
  },
  {
    name: "ZaNdou Relocations",
    category: "Moving & Setup",
    description: "Moving, transport coordination, relocation support and move-in setup.",
  },
  {
    name: "ZaNdou Connect",
    category: "Service Brokerage",
    description: "A trusted-provider coordination layer for practical household and business needs.",
  },
  {
    name: "SZ Prime Facilities",
    category: "B2B Services",
    description: "Recurring facilities, property and vendor-coordination support for businesses and property clients.",
  },
  {
    name: "SZ Business Solutions",
    category: "Business Enablement",
    description: "Customer-facing AI, automation, digital transformation and business support solutions.",
  },
  {
    name: "SZ Tech Hub",
    category: "Technology Engine",
    description: "Websites, applications, dashboards, automations, AI agents and internal platforms.",
  },
];

const journey = [
  "Customer enters through WhatsApp, website or a business unit",
  "SZ Prime identifies the need and customer type",
  "A central customer record is created or matched",
  "The request is routed to the right unit or vetted partner",
  "Quote, approval and payment are coordinated",
  "Service delivery is tracked centrally",
  "Feedback, repeat service and cross-sell opportunities are retained",
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">SZ PRIME SOLUTIONS (PTY) LTD</p>
        <h1>One company. Multiple specialised solutions. One coordinated customer experience.</h1>
        <p className="lead">
          SZ Prime Solutions is building an integrated South African service ecosystem connecting
          living, moving, cleaning, facilities, trusted providers, business support and technology.
        </p>
        <div className="actions">
          <a href="#ecosystem" className="button primary">Explore the ecosystem</a>
          <a href="#platform" className="button secondary">See the platform vision</a>
        </div>
      </section>

      <section id="ecosystem" className="section">
        <div className="section-heading">
          <p className="eyebrow">ECOSYSTEM</p>
          <h2>Specialised units, shared infrastructure</h2>
          <p>
            Every unit has a clear role, while SZ Prime Solutions provides governance, finance,
            customer data, operations, technology and growth coordination.
          </p>
        </div>
        <div className="grid">
          {units.map((unit) => (
            <article className="card" key={unit.name}>
              <span>{unit.category}</span>
              <h3>{unit.name}</h3>
              <p>{unit.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="platform" className="section panel">
        <div className="section-heading">
          <p className="eyebrow">MASTER PLATFORM</p>
          <h2>From enquiry to repeat customer</h2>
        </div>
        <ol className="journey">
          {journey.map((step, index) => (
            <li key={step}>
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="section split">
        <div>
          <p className="eyebrow">BUILD FIRST, PRODUCTISE LATER</p>
          <h2>SZ Tech Hub becomes the internal technology engine.</h2>
        </div>
        <p>
          The first systems are built for SZ Prime itself: CRM, WhatsApp assistant, quotations,
          payments, operations dashboards, partner management and tender intelligence. Proven
          systems can later be packaged and sold to SMEs as SZ Tech Hub products.
        </p>
      </section>

      <footer>
        <strong>SZ Prime Solutions</strong>
        <span>Structured. Reliable. Prime.</span>
      </footer>
    </main>
  );
}

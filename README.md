# SZ Prime Solutions

SZ Prime Solutions (Pty) Ltd is the parent company and operating backbone for an integrated South African service ecosystem.

## Final brand architecture

- **SZ Prime Solutions (Pty) Ltd** — parent company / master brand
- **SZ Prime Living Accommodations** — accommodation, rentals and living support
- **SZ Prime Relocations** — moving, transport and relocation services
- **SZ Pristine Cleaning** — residential, commercial and move-related cleaning
- **SZ Prime Plug-Connect** — trusted service-provider connections and brokerage
- **SZ Prime Facilities** — facilities management and B2B operational services
- **SZ Prime Tech Hub** — technology, AI, automation, websites and digital systems
- **SZ Prime Business Solutions** — SME support, consulting and business enablement

These names are the canonical operating names for the ecosystem.

## Platform direction

The core operating flow is:

```
Website / WhatsApp
        ↓
Customer identity
        ↓
Service request
        ↓
Business-unit routing
        ↓
Quotation
        ↓
Payment
        ↓
Partner / operator assignment
        ↓
Service delivery
        ↓
Feedback + repeat / cross-sell
```

## Current foundation

- Next.js + TypeScript application shell
- ecosystem landing page
- internal Operations / CRM dashboard at `/ops`
- Supabase/PostgreSQL production schema
- staff authentication and Row Level Security
- customer notes and request audit history
- quotation, payment and partner-assignment models
- Vercel production deployment
- platform architecture documentation
- phased product roadmap

## Planned integrations

- WhatsApp Business Platform
- Make or n8n
- Yoco
- AI provider/API
- multilingual customer routing
- partner management
- tender intelligence
- analytics and revenue reporting

## Documentation

- [Project memory / source of truth](docs/project-memory.md)
- [Canonical brand architecture](docs/brand-architecture.md)
- [Platform architecture](docs/architecture.md)
- [Product roadmap](docs/roadmap.md)
- [CRM operating model](docs/crm-operating-model.md)
- [Core data dictionary](docs/data-dictionary.md)

## Development principle

Build for SZ Prime internally first, validate operational value, standardise the workflow, then package proven capabilities through SZ Prime Tech Hub for external clients.

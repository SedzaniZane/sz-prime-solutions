# SZ Prime Solutions

SZ Prime Solutions (Pty) Ltd is the parent company and operating backbone for an integrated South African service ecosystem.

## Ecosystem

- **SZ Pristine Solutions** — cleaning and space preparation
- **ZaNdou Living** — accommodation and property support
- **ZaNdou Relocations** — moving, transport and setup
- **ZaNdou Connect** — trusted-provider coordination
- **SZ Prime Facilities** — B2B facilities and property support
- **SZ Business Solutions** — AI, automation and business enablement
- **SZ Tech Hub** — technology, software, dashboards, chatbots and internal platforms

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

This branch contains:

- Next.js + TypeScript application shell
- ecosystem landing page
- internal Operations / CRM dashboard at `/ops`
- Supabase/PostgreSQL starter schema
- customer notes and request audit history
- quotation, payment and partner-assignment models
- platform architecture documentation
- phased product roadmap

The Operations dashboard currently uses representative sample data while live Supabase connections, authentication and automations are introduced.

## Planned integrations

- Supabase / PostgreSQL
- WhatsApp Business Platform
- Make or n8n
- Yoco
- AI provider/API
- multilingual customer routing
- partner management
- tender intelligence
- analytics and revenue reporting

## Local development

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` and add only development credentials.

## Documentation

- [Platform architecture](docs/architecture.md)
- [Product roadmap](docs/roadmap.md)
- [CRM operating model](docs/crm-operating-model.md)
- [Core data dictionary](docs/data-dictionary.md)

## Development principle

Build for SZ Prime internally first, validate operational value, standardise the workflow, then package proven capabilities through SZ Tech Hub for external clients.

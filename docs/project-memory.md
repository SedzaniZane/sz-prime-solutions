# SZ Prime Solutions — Project Memory

## Canonical company structure

**Parent company:** SZ Prime Solutions (Pty) Ltd

**Final operating units:**
1. SZ Prime Living Accommodations
2. SZ Prime Relocations
3. SZ Pristine Cleaning
4. SZ Prime Plug-Connect
5. SZ Prime Facilities
6. SZ Prime Tech Hub
7. SZ Prime Business Solutions

These names are final for active platform development and should be used consistently across the website, CRM, database, WhatsApp flows, quotations, invoices, dashboards, documentation and future automations.

Legacy ZaNdou names are retired from the active architecture and should only appear in archived historical material where necessary.

## Canonical internal identifiers

- prime_living
- prime_relocations
- pristine_cleaning
- prime_plug_connect
- prime_facilities
- prime_tech_hub
- prime_business_solutions

## Current platform stack

- GitHub: SedzaniZane/sz-prime-solutions
- Frontend: Next.js + TypeScript
- Hosting: Vercel
- Database/Auth: Supabase PostgreSQL + Supabase Auth
- Security: Row Level Security + staff_profiles
- Production operations route: /ops
- Staff login route: /login

## Current platform status

- Production website deployed on Vercel
- Supabase production database connected through GitHub migrations
- Staff authentication operational
- First administrator profile operational
- Operations dashboard reads live CRM data
- Customer/service data currently at initial/empty state
- First CRM write workflow implemented: staff-facing Customer + Service Request intake
- Intake wording explicitly distinguishes customer data from staff/admin data
- South African mobile numbers and customer emails are validated server-side and mobile numbers are normalised to +27 format
- Submit state prevents accidental repeated request creation
- Intake operation creates customer, service request and initial audit event atomically
- Request detail/customer profile workspace implemented
- Staff can edit customer contacts, reassign business units, change request status and service details
- Internal customer notes and request event history are visible per request
- Quotation workflow supports priced line items, additional fees, calculated totals, validity dates and draft/sent states
- Each quotation receives an SZQ reference number and has a printable SZ Prime-branded document view suitable for browser Print → Save as PDF
- Customer approval is tracked as pending, accepted or declined; accepted quotations advance the request to awaiting_payment
- Sent quotations move requests into the quoted stage and create audit events
- Planned location enhancement: customer/service addresses should later support map pin capture and geocoding (e.g. Google Maps or equivalent), while keeping a human-readable suburb/address field
- Next build priority: Yoco payment links/status, dedicated generated PDF files, test-data cleanup controls and customer history across multiple requests

## Operating principle

One company, one customer relationship, multiple specialised solutions.

## Product development principle

Build internal SZ Prime systems first, validate them operationally, then package proven capabilities through SZ Prime Tech Hub for external clients.

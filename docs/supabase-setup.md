# Supabase Setup

## Project
Use the SZ Prime Solutions Supabase project.

## Required public environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

The publishable key is safe for browser use when Row Level Security is correctly configured.

## Secret variables

```env
SUPABASE_SERVICE_ROLE_KEY=...
```

Never expose the service role key in client code, screenshots, commits or `NEXT_PUBLIC_*` variables.

## Database initialization

Run `supabase/schema.sql` in the Supabase SQL Editor.

Before production use, apply Row Level Security policies and staff authentication.

## Immediate validation

After the schema runs, confirm these tables exist:

- customers
- service_requests
- partners
- quotations
- payments
- partner_assignments
- customer_notes
- request_events

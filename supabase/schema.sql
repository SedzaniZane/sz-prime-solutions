create extension if not exists "pgcrypto";

create type business_unit as enum (
  'pristine_cleaning',
  'prime_living',
  'prime_relocations',
  'prime_plug_connect',
  'prime_facilities',
  'prime_business_solutions',
  'prime_tech_hub'
);

create type request_status as enum (
  'new',
  'qualified',
  'quoted',
  'awaiting_payment',
  'paid',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  preferred_language text default 'English',
  location_text text,
  created_at timestamptz not null default now()
);

create table service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  unit business_unit not null,
  service_type text not null,
  description text,
  status request_status not null default 'new',
  preferred_date timestamptz,
  source text default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table partners (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  phone text,
  email text,
  service_categories text[] not null default '{}',
  service_areas text[] not null default '{}',
  verification_status text not null default 'pending',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table quotations (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references service_requests(id) on delete cascade,
  quotation_number text not null unique,
  currency text not null default 'ZAR',
  subtotal numeric(12,2) not null default 0,
  fees numeric(12,2) not null default 0,
  total numeric(12,2) generated always as (subtotal + fees) stored,
  status text not null default 'draft',
  approval_status text not null default 'not_requested'
    check (approval_status in ('not_requested', 'pending', 'accepted', 'declined')),
  approved_at timestamptz,
  declined_at timestamptz,
  valid_until date,
  created_at timestamptz not null default now()
);

create table quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) generated always as (quantity * unit_price) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references service_requests(id) on delete cascade,
  quotation_id uuid references quotations(id) on delete set null,
  provider text not null default 'yoco',
  provider_reference text,
  checkout_url text,
  checkout_status text,
  payment_method text,
  amount numeric(12,2) not null,
  currency text not null default 'ZAR',
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table partner_assignments (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references service_requests(id) on delete cascade,
  partner_id uuid not null references partners(id),
  assignment_status text not null default 'proposed',
  agreed_amount numeric(12,2),
  created_at timestamptz not null default now(),
  unique(service_request_id, partner_id)
);


create table jobs (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null unique references service_requests(id) on delete cascade,
  fulfilment_type text not null default 'internal'
    check (fulfilment_type in ('internal', 'partner')),
  assigned_staff_user_id uuid,
  partner_id uuid references partners(id) on delete set null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz,
  operational_notes text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (fulfilment_type = 'internal' and partner_id is null)
    or
    (fulfilment_type = 'partner' and partner_id is not null)
  ),
  check (scheduled_end is null or scheduled_end > scheduled_start)
);

create table customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  note text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table request_events (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references service_requests(id) on delete cascade,
  event_type text not null,
  from_status request_status,
  to_status request_status,
  detail jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create index idx_service_requests_customer on service_requests(customer_id);
create index idx_service_requests_unit_status on service_requests(unit, status);
create index idx_request_events_request on request_events(service_request_id, created_at desc);
create index idx_payments_request on payments(service_request_id);
create index idx_payments_quotation on payments(quotation_id);
create unique index idx_payments_provider_reference on payments(provider, provider_reference) where provider_reference is not null;
create index idx_quotation_items_quote on quotation_items(quotation_id, sort_order);
create index idx_jobs_schedule on jobs(scheduled_start, status);
create index idx_jobs_partner on jobs(partner_id) where partner_id is not null;
create unique index idx_quotations_number on quotations(quotation_number);

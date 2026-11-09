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
  currency text not null default 'ZAR',
  subtotal numeric(12,2) not null default 0,
  fees numeric(12,2) not null default 0,
  total numeric(12,2) generated always as (subtotal + fees) stored,
  status text not null default 'draft',
  valid_until date,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references service_requests(id) on delete cascade,
  provider text not null default 'yoco',
  provider_reference text,
  amount numeric(12,2) not null,
  currency text not null default 'ZAR',
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
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

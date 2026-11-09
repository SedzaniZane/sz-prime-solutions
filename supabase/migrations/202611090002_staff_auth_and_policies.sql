-- Staff authentication and least-privilege CRM access.

create table staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'manager', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table staff_profiles enable row level security;

create or replace function is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from staff_profiles
    where user_id = auth.uid()
      and active = true
  );
$$;

create or replace function is_admin_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from staff_profiles
    where user_id = auth.uid()
      and active = true
      and role = 'admin'
  );
$$;

create policy "staff can read own profile"
on staff_profiles
for select
to authenticated
using (user_id = auth.uid() or is_admin_staff());

create policy "admins can manage staff profiles"
on staff_profiles
for all
to authenticated
using (is_admin_staff())
with check (is_admin_staff());

create policy "active staff can read customers"
on customers for select to authenticated
using (is_active_staff());

create policy "active staff can manage customers"
on customers for all to authenticated
using (is_active_staff())
with check (is_active_staff());

create policy "active staff can manage service requests"
on service_requests for all to authenticated
using (is_active_staff())
with check (is_active_staff());

create policy "active staff can manage partners"
on partners for all to authenticated
using (is_active_staff())
with check (is_active_staff());

create policy "active staff can manage quotations"
on quotations for all to authenticated
using (is_active_staff())
with check (is_active_staff());

create policy "active staff can manage payments"
on payments for all to authenticated
using (is_active_staff())
with check (is_active_staff());

create policy "active staff can manage partner assignments"
on partner_assignments for all to authenticated
using (is_active_staff())
with check (is_active_staff());

create policy "active staff can manage customer notes"
on customer_notes for all to authenticated
using (is_active_staff())
with check (is_active_staff());

create policy "active staff can manage request events"
on request_events for all to authenticated
using (is_active_staff())
with check (is_active_staff());

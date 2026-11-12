-- Job scheduling and fulfilment management.

create table if not exists jobs (
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
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (fulfilment_type = 'internal' and partner_id is null)
    or
    (fulfilment_type = 'partner' and partner_id is not null)
  ),
  check (scheduled_end is null or scheduled_end > scheduled_start)
);

create index if not exists idx_jobs_schedule
  on jobs(scheduled_start, status);

create index if not exists idx_jobs_partner
  on jobs(partner_id)
  where partner_id is not null;

alter table jobs enable row level security;

create policy "active staff can manage jobs"
on jobs for all to authenticated
using (is_active_staff())
with check (is_active_staff());

create or replace function schedule_service_job(
  p_service_request_id uuid,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz default null,
  p_fulfilment_type text default 'internal',
  p_assigned_staff_user_id uuid default null,
  p_partner_id uuid default null,
  p_operational_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_job_id uuid;
  v_request_status request_status;
begin
  if not is_active_staff() then
    raise exception 'Active SZ Prime staff access required';
  end if;

  if p_fulfilment_type not in ('internal', 'partner') then
    raise exception 'Invalid fulfilment type';
  end if;

  if p_fulfilment_type = 'partner' and p_partner_id is null then
    raise exception 'Select a partner for partner fulfilment';
  end if;

  if p_fulfilment_type = 'internal' and p_partner_id is not null then
    raise exception 'Internal fulfilment cannot have a partner';
  end if;

  if p_scheduled_end is not null and p_scheduled_end <= p_scheduled_start then
    raise exception 'Scheduled end must be after scheduled start';
  end if;

  select status into v_request_status
  from service_requests
  where id = p_service_request_id;

  if v_request_status is null then
    raise exception 'Service request not found';
  end if;

  if v_request_status not in ('paid', 'scheduled') then
    raise exception 'Only paid requests can be scheduled';
  end if;

  insert into jobs (
    service_request_id,
    fulfilment_type,
    assigned_staff_user_id,
    partner_id,
    scheduled_start,
    scheduled_end,
    operational_notes,
    status
  )
  values (
    p_service_request_id,
    p_fulfilment_type,
    p_assigned_staff_user_id,
    p_partner_id,
    p_scheduled_start,
    p_scheduled_end,
    nullif(trim(p_operational_notes), ''),
    'scheduled'
  )
  on conflict (service_request_id)
  do update set
    fulfilment_type = excluded.fulfilment_type,
    assigned_staff_user_id = excluded.assigned_staff_user_id,
    partner_id = excluded.partner_id,
    scheduled_start = excluded.scheduled_start,
    scheduled_end = excluded.scheduled_end,
    operational_notes = excluded.operational_notes,
    status = 'scheduled',
    updated_at = now()
  returning id into v_job_id;

  update service_requests
  set status = 'scheduled',
      updated_at = now()
  where id = p_service_request_id;

  insert into request_events (
    service_request_id,
    event_type,
    from_status,
    to_status,
    detail,
    created_by
  )
  values (
    p_service_request_id,
    'job_scheduled',
    v_request_status,
    'scheduled',
    jsonb_build_object(
      'job_id', v_job_id,
      'scheduled_start', p_scheduled_start,
      'scheduled_end', p_scheduled_end,
      'fulfilment_type', p_fulfilment_type,
      'partner_id', p_partner_id,
      'assigned_staff_user_id', p_assigned_staff_user_id
    ),
    auth.uid()::text
  );

  return v_job_id;
end;
$$;

grant execute on function schedule_service_job(
  uuid, timestamptz, timestamptz, text, uuid, uuid, text
) to authenticated;

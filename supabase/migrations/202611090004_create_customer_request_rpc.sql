-- Atomic CRM intake: create a customer, service request and initial audit event together.

create or replace function create_customer_service_request(
  p_full_name text,
  p_phone text default null,
  p_email text default null,
  p_preferred_language text default 'English',
  p_location_text text default null,
  p_unit business_unit default 'prime_business_solutions',
  p_service_type text default '',
  p_description text default null,
  p_preferred_date timestamptz default null,
  p_source text default 'staff'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_request_id uuid;
begin
  if not is_active_staff() then
    raise exception 'Active SZ Prime staff access required';
  end if;

  if nullif(trim(p_full_name), '') is null then
    raise exception 'Customer name is required';
  end if;

  if nullif(trim(p_service_type), '') is null then
    raise exception 'Service type is required';
  end if;

  insert into customers (
    full_name,
    phone,
    email,
    preferred_language,
    location_text
  )
  values (
    trim(p_full_name),
    nullif(trim(p_phone), ''),
    nullif(trim(p_email), ''),
    coalesce(nullif(trim(p_preferred_language), ''), 'English'),
    nullif(trim(p_location_text), '')
  )
  returning id into v_customer_id;

  insert into service_requests (
    customer_id,
    unit,
    service_type,
    description,
    preferred_date,
    source
  )
  values (
    v_customer_id,
    p_unit,
    trim(p_service_type),
    nullif(trim(p_description), ''),
    p_preferred_date,
    coalesce(nullif(trim(p_source), ''), 'staff')
  )
  returning id into v_request_id;

  insert into request_events (
    service_request_id,
    event_type,
    to_status,
    detail,
    created_by
  )
  values (
    v_request_id,
    'request_created',
    'new',
    jsonb_build_object(
      'source', coalesce(nullif(trim(p_source), ''), 'staff'),
      'customer_id', v_customer_id
    ),
    auth.uid()::text
  );

  return v_request_id;
end;
$$;

grant execute on function create_customer_service_request(
  text, text, text, text, text, business_unit, text, text, timestamptz, text
) to authenticated;

-- Allocate quotation numbers by South African calendar month and business unit.
alter table public.quotations add column issuing_unit public.business_unit;
create table public.quotation_number_counters (
  month_key text not null,
  unit public.business_unit not null,
  last_number bigint not null,
  primary key (month_key, unit)
);

alter table public.quotation_number_counters enable row level security;
revoke all on public.quotation_number_counters from anon, authenticated;
grant select, insert, update on public.quotation_number_counters to authenticated;
create policy "Staff allocate quotation numbers" on public.quotation_number_counters
  for all to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

create or replace function create_quotation_with_items(
  p_service_request_id uuid,
  p_items jsonb,
  p_fees numeric default 0,
  p_status text default 'draft',
  p_valid_until date default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quotation_id uuid;
  v_unit business_unit;
  v_unit_code text;
  v_month text;
  v_sequence bigint;
  v_subtotal numeric(12,2);
  v_request_status request_status;
  v_item jsonb;
  v_description text;
  v_quantity numeric(10,2);
  v_unit_price numeric(12,2);
  v_sort integer := 0;
begin
  if not is_active_staff() then
    raise exception 'Active SZ Prime staff access required';
  end if;

  if p_status not in ('draft', 'sent') then
    raise exception 'Invalid quotation status';
  end if;

  if coalesce(p_fees, 0) < 0 then
    raise exception 'Fees cannot be negative';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one quotation line item is required';
  end if;

  select status, unit into v_request_status, v_unit
  from service_requests
  where id = p_service_request_id;

  if v_request_status is null then
    raise exception 'Service request not found';
  end if;

  select coalesce(sum(
    (item->>'quantity')::numeric * (item->>'unit_price')::numeric
  ), 0)
  into v_subtotal
  from jsonb_array_elements(p_items) as item;

  v_quotation_id := gen_random_uuid();
  v_month := to_char(now() at time zone 'Africa/Johannesburg', 'YYYYMM');
  v_unit_code := case v_unit::text
    when 'pristine_cleaning' then 'PC'
    when 'prime_living' then 'LA'
    when 'prime_relocations' then 'RE'
    when 'prime_plug_connect' then 'PL'
    when 'prime_facilities' then 'FA'
    when 'prime_business_solutions' then 'BS'
    when 'prime_tech_hub' then 'TH'
  end;

  insert into quotation_number_counters (month_key, unit, last_number)
  values (v_month, v_unit, 1)
  on conflict (month_key, unit) do update
    set last_number = quotation_number_counters.last_number + 1
  returning last_number into v_sequence;


  insert into quotations (
    id,
    quotation_number,
    issuing_unit,
    service_request_id,
    currency,
    subtotal,
    fees,
    status,
    valid_until,
    approval_status
  )
  values (
    v_quotation_id,
    'SZQ-' || v_month || '-' || v_unit_code || '-' || lpad(v_sequence::text, greatest(4, length(v_sequence::text)), '0'),
    v_unit,
    p_service_request_id,
    'ZAR',
    v_subtotal,
    coalesce(p_fees, 0),
    p_status,
    p_valid_until,
    case when p_status = 'sent' then 'pending' else 'not_requested' end
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_description := trim(v_item->>'description');
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;

    if nullif(v_description, '') is null then
      raise exception 'Line-item description is required';
    end if;

    if v_quantity <= 0 or v_unit_price < 0 then
      raise exception 'Invalid line-item quantity or price';
    end if;

    insert into quotation_items (
      quotation_id,
      description,
      quantity,
      unit_price,
      sort_order
    )
    values (
      v_quotation_id,
      v_description,
      v_quantity,
      v_unit_price,
      v_sort
    );

    v_sort := v_sort + 1;
  end loop;

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
    case when p_status = 'sent' then 'quotation_sent' else 'quotation_created' end,
    v_request_status,
    case when p_status = 'sent' then 'quoted'::request_status else v_request_status end,
    jsonb_build_object(
      'quotation_id', v_quotation_id,
      'subtotal', v_subtotal,
      'fees', coalesce(p_fees, 0),
      'total', v_subtotal + coalesce(p_fees, 0),
      'currency', 'ZAR'
    ),
    auth.uid()::text
  );

  if p_status = 'sent' then
    update service_requests
    set status = 'quoted',
        updated_at = now()
    where id = p_service_request_id;
  end if;

  return v_quotation_id;
end;
$$;

-- Issue one immutable document per accepted quote. Settlement is read separately.
create sequence public.invoice_number_sequence;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null unique references public.quotations(id) on delete restrict,
  invoice_number text not null unique,
  issued_at timestamptz not null default now(),
  mode text not null check (mode in ('test', 'live')),
  quotation_number text not null,
  unit public.business_unit not null,
  service_type text not null,
  customer_name text not null,
  customer_email text,
  customer_location text,
  currency text not null,
  subtotal numeric(12,2) not null,
  fees numeric(12,2) not null,
  total numeric(12,2) not null,
  items jsonb not null
);

alter table public.invoices enable row level security;
revoke all on public.invoices from anon, authenticated;
grant select on public.invoices to authenticated;
create policy "Staff read invoices" on public.invoices
  for select to authenticated using (public.is_active_staff());

create function public.issue_invoice(p_quotation_id uuid, p_mode text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.quotations%rowtype;
  v_request public.service_requests%rowtype;
  v_customer public.customers%rowtype;
  v_invoice_id uuid;
  v_number text;
  v_items jsonb;
begin
  if not coalesce(public.is_active_staff(), false) then
    raise exception 'Active SZ Prime staff access required';
  end if;
  if p_mode is null or p_mode not in ('test', 'live') then
    raise exception 'Invoice mode is unavailable';
  end if;

  select * into strict v_quote
    from public.quotations where id = p_quotation_id for update;

  select id into v_invoice_id from public.invoices where quotation_id = p_quotation_id;
  if found then
    return v_invoice_id;
  end if;
  if v_quote.approval_status <> 'accepted' then
    raise exception 'Accept the quotation before issuing an invoice';
  end if;
  if p_mode = 'live' and exists (
    select 1 from public.payments
    where quotation_id = p_quotation_id and metadata->>'processing_mode' = 'test'
  ) then
    raise exception 'Create a fresh quotation for live billing after sandbox checkout';
  end if;

  select * into strict v_request from public.service_requests where id = v_quote.service_request_id;
  select * into strict v_customer from public.customers where id = v_request.customer_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'description', description, 'quantity', quantity, 'unit_price', unit_price, 'line_total', line_total
  ) order by sort_order, id), '[]'::jsonb) into v_items
  from public.quotation_items where quotation_id = p_quotation_id;

  v_number := nextval('public.invoice_number_sequence'::regclass)::text;
  insert into public.invoices (
    quotation_id, invoice_number, mode, quotation_number, unit, service_type,
    customer_name, customer_email, customer_location, currency, subtotal, fees, total, items
  ) values (
    v_quote.id, 'SZI-' || to_char(now() at time zone 'Africa/Johannesburg', 'YYYYMM')
      || '-' || lpad(v_number, greatest(4, length(v_number)), '0'),
    p_mode, v_quote.quotation_number, coalesce(v_quote.issuing_unit, v_request.unit), v_request.service_type,
    v_customer.full_name, v_customer.email, v_customer.location_text,
    v_quote.currency, v_quote.subtotal, v_quote.fees, v_quote.total, v_items
  ) returning id into v_invoice_id;

  return v_invoice_id;
end;
$$;

revoke all on function public.issue_invoice(uuid, text) from public, anon, authenticated;
grant execute on function public.issue_invoice(uuid, text) to authenticated;

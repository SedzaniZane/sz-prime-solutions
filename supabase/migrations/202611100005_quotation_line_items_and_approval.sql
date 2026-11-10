-- Quotation line items, numbering and customer approval tracking.

alter table quotations
  add column if not exists quotation_number text,
  add column if not exists approval_status text not null default 'not_requested'
    check (approval_status in ('not_requested', 'pending', 'accepted', 'declined')),
  add column if not exists approved_at timestamptz,
  add column if not exists declined_at timestamptz;

update quotations
set quotation_number = 'SZQ-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where quotation_number is null;

alter table quotations
  alter column quotation_number set not null;

create unique index if not exists idx_quotations_number
  on quotations(quotation_number);

create table if not exists quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references quotations(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) generated always as (quantity * unit_price) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_quotation_items_quote
  on quotation_items(quotation_id, sort_order);

alter table quotation_items enable row level security;

create policy "active staff can manage quotation items"
on quotation_items for all to authenticated
using (is_active_staff())
with check (is_active_staff());

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

  select status into v_request_status
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

  insert into quotations (
    service_request_id,
    currency,
    subtotal,
    fees,
    status,
    valid_until,
    approval_status
  )
  values (
    p_service_request_id,
    'ZAR',
    v_subtotal,
    coalesce(p_fees, 0),
    p_status,
    p_valid_until,
    case when p_status = 'sent' then 'pending' else 'not_requested' end
  )
  returning id into v_quotation_id;

  update quotations
  set quotation_number = 'SZQ-' || upper(substr(replace(v_quotation_id::text, '-', ''), 1, 8))
  where id = v_quotation_id;

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

grant execute on function create_quotation_with_items(
  uuid, jsonb, numeric, text, date
) to authenticated;

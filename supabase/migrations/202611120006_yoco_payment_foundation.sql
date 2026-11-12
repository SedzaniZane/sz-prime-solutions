-- Yoco checkout/payment foundation.

alter table payments
  add column if not exists quotation_id uuid references quotations(id) on delete set null,
  add column if not exists checkout_url text,
  add column if not exists checkout_status text,
  add column if not exists payment_method text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_payments_quotation on payments(quotation_id);
create unique index if not exists idx_payments_provider_reference
  on payments(provider, provider_reference)
  where provider_reference is not null;

create or replace function create_pending_payment(
  p_service_request_id uuid,
  p_quotation_id uuid,
  p_provider text,
  p_provider_reference text,
  p_checkout_url text,
  p_amount numeric,
  p_currency text default 'ZAR',
  p_checkout_status text default 'created',
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment_id uuid;
begin
  if not is_active_staff() then
    raise exception 'Active SZ Prime staff access required';
  end if;

  insert into payments (
    service_request_id,
    quotation_id,
    provider,
    provider_reference,
    checkout_url,
    amount,
    currency,
    status,
    checkout_status,
    metadata
  )
  values (
    p_service_request_id,
    p_quotation_id,
    p_provider,
    p_provider_reference,
    p_checkout_url,
    p_amount,
    p_currency,
    'pending',
    p_checkout_status,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (provider, provider_reference)
  where provider_reference is not null
  do update set
    checkout_url = excluded.checkout_url,
    checkout_status = excluded.checkout_status,
    updated_at = now()
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

grant execute on function create_pending_payment(
  uuid, uuid, text, text, text, numeric, text, text, jsonb
) to authenticated;

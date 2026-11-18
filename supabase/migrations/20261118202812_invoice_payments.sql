-- Serialize all invoice payment operations on the quotation row.
create function public.record_invoice_eft(p_invoice_id uuid, p_amount numeric, p_reference text, p_received_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  i public.invoices%rowtype;
  q public.quotations%rowtype;
  existing public.payments%rowtype;
  payment_id uuid;
  paid numeric;
  ref text;
begin
  if not coalesce(public.is_active_staff(), false) then raise exception 'Active staff access required'; end if;
  select * into strict i from public.invoices where id = p_invoice_id;
  select * into strict q from public.quotations where id = i.quotation_id for update;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) or p_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Enter a positive amount with at most two decimal places';
  end if;
  if length(trim(coalesce(p_reference, ''))) < 3 or length(p_reference) > 120 then raise exception 'Enter the bank transaction reference (3–120 characters)'; end if;
  if p_received_at is null or p_received_at > now() then raise exception 'The received date cannot be in the future'; end if;
  ref := i.id::text || ':' || lower(trim(p_reference));
  select * into existing from public.payments where provider = 'eft' and provider_reference = ref;
  if found then
    if existing.amount <> p_amount or existing.paid_at <> p_received_at then raise exception 'This bank reference has already been recorded with different details'; end if;
    return existing.id;
  end if;
  if exists (select 1 from public.payments where quotation_id = i.quotation_id and provider = 'yoco' and status = 'pending'
    and (metadata->>'processing_mode' = i.mode or metadata->>'processing_mode' is null)) then
    raise exception 'A Yoco checkout is pending. Resolve it before recording EFT to avoid collecting the same balance twice';
  end if;
  select coalesce(sum(amount), 0) into paid from public.payments
    where quotation_id = i.quotation_id and currency = i.currency and status = 'paid' and metadata->>'processing_mode' = i.mode;
  if p_amount > i.total - paid then raise exception 'Payment exceeds the outstanding invoice balance'; end if;
  insert into public.payments(service_request_id, quotation_id, provider, provider_reference, amount, currency, status, paid_at, payment_method, metadata)
  values (q.service_request_id, q.id, 'eft', ref, p_amount, i.currency, 'paid', p_received_at, 'eft',
    jsonb_build_object('processing_mode', i.mode, 'invoice_id', i.id, 'bank_reference', trim(p_reference), 'recorded_by', auth.uid(), 'recorded_at', now()))
  returning id into payment_id;
  if paid + p_amount >= i.total then
    update public.service_requests set status = 'paid', updated_at = now() where id = q.service_request_id
      and status in ('new', 'qualified', 'quoted', 'awaiting_payment');
  end if;
  insert into public.request_events(service_request_id, event_type, detail, created_by)
    values(q.service_request_id, 'eft_payment_recorded', jsonb_build_object('payment_id', payment_id, 'invoice_id', i.id,
      'amount', p_amount, 'bank_reference', trim(p_reference), 'processing_mode', i.mode), auth.uid()::text);
  return payment_id;
end;
$$;
revoke all on function public.record_invoice_eft(uuid,numeric,text,timestamptz) from public, anon;
grant execute on function public.record_invoice_eft(uuid,numeric,text,timestamptz) to authenticated;

-- Reserve before contacting Yoco; retries reuse the same payment and idempotency key.
create function public.reserve_invoice_checkout(p_invoice_id uuid, p_mode text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare i public.invoices%rowtype; q public.quotations%rowtype; paid numeric; payment_id uuid;
begin
  if not coalesce(public.is_active_staff(), false) then raise exception 'Active staff access required'; end if;
  select * into strict i from public.invoices where id = p_invoice_id;
  select * into strict q from public.quotations where id = i.quotation_id for update;
  if p_mode is null or p_mode <> i.mode then raise exception 'Invoice and Yoco environments do not match'; end if;
  if i.currency <> 'ZAR' then raise exception 'Yoco requires ZAR'; end if;
  select coalesce(sum(amount), 0) into paid from public.payments where quotation_id = i.quotation_id
    and currency = i.currency and status = 'paid' and metadata->>'processing_mode' = i.mode;
  if i.total - paid < 2 then raise exception 'Yoco requires at least R2.00 outstanding. Use EFT for a smaller balance'; end if;
  select id into payment_id from public.payments where quotation_id = i.quotation_id and provider = 'yoco' and status = 'pending'
    and metadata->>'processing_mode' = i.mode and currency = i.currency and amount = i.total - paid
    order by created_at desc limit 1;
  if found then return payment_id; end if;
  if exists(select 1 from public.payments where quotation_id = i.quotation_id and provider = 'yoco' and status = 'pending') then
    raise exception 'An existing Yoco checkout has a different balance or environment. Resolve it before creating another';
  end if;
  insert into public.payments(service_request_id, quotation_id, provider, amount, currency, status, checkout_status, metadata)
  values(q.service_request_id, q.id, 'yoco', i.total - paid, i.currency, 'pending', 'reserved',
    jsonb_build_object('processing_mode', i.mode, 'invoice_id', i.id, 'quotation_number', i.quotation_number)) returning id into payment_id;
  return payment_id;
end;
$$;
revoke all on function public.reserve_invoice_checkout(uuid,text) from public, anon;
grant execute on function public.reserve_invoice_checkout(uuid,text) to authenticated;

create function public.attach_invoice_checkout(p_payment_id uuid, p_reference text, p_url text, p_mode text, p_amount_cents bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.payments%rowtype;
begin
  if not coalesce(public.is_active_staff(), false) then raise exception 'Active staff access required'; end if;
  select * into strict p from public.payments where id = p_payment_id for update;
  if p.provider <> 'yoco' or p.metadata->>'invoice_id' is null or p.metadata->>'processing_mode' <> p_mode
    or round(p.amount * 100) <> p_amount_cents then raise exception 'Checkout does not match the reserved invoice balance'; end if;
  if p.provider_reference is not null and p.provider_reference <> p_reference then raise exception 'A different checkout is already attached'; end if;
  if p_url !~ '^https://' or nullif(p_reference, '') is null then raise exception 'Invalid checkout response'; end if;
  update public.payments set provider_reference = p_reference, checkout_url = p_url, checkout_status = 'created', updated_at = now() where id = p.id;
end;
$$;
revoke all on function public.attach_invoice_checkout(uuid,text,text,text,bigint) from public, anon;
grant execute on function public.attach_invoice_checkout(uuid,text,text,text,bigint) to authenticated;

-- Only the signature-verified webhook may settle a Yoco reservation.
create function public.settle_yoco_checkout(p_reference text, p_mode text, p_method text, p_payment_reference text, p_event_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.payments%rowtype; q public.quotations%rowtype; paid numeric;
begin
  select * into strict p from public.payments where provider = 'yoco' and provider_reference = p_reference;
  select * into strict q from public.quotations where id = p.quotation_id for update;
  select * into strict p from public.payments where id = p.id for update;
  if p.status = 'paid' then return; end if;
  if p_mode is null or p_mode not in ('test','live') or p.metadata->>'processing_mode' is distinct from p_mode then
    raise exception 'Webhook and checkout environments do not match';
  end if;
  update public.payments set status = 'paid', checkout_status = 'succeeded', paid_at = now(), payment_method = p_method,
    metadata = metadata || jsonb_build_object('yoco_payment_id', p_payment_reference, 'webhook_event_id', p_event_id), updated_at = now() where id = p.id;
  select coalesce(sum(amount),0) into paid from public.payments where quotation_id = q.id and currency = p.currency
    and status = 'paid' and metadata->>'processing_mode' = p_mode;
  if paid >= coalesce((select total from public.invoices where quotation_id = q.id and mode = p_mode), q.total) then
    update public.service_requests set status = 'paid', updated_at = now() where id = q.service_request_id
      and status in ('new', 'qualified', 'quoted', 'awaiting_payment');
  end if;
  insert into public.request_events(service_request_id,event_type,detail,created_by) values(q.service_request_id, 'payment_succeeded',
    jsonb_build_object('payment_id',p.id,'yoco_checkout_id',p_reference,'yoco_payment_id',p_payment_reference), 'yoco_webhook');
end;
$$;
revoke all on function public.settle_yoco_checkout(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.settle_yoco_checkout(text,text,text,text,text) to service_role;

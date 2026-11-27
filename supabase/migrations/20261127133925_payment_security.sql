-- Payment ledger writes are restricted to checked RPCs and the verified server webhook.
-- Staff keep read access; EFT recording continues through record_invoice_eft.
revoke insert, update, delete, truncate, references, trigger on public.payments from anon, authenticated;
drop policy if exists "active staff can manage payments" on public.payments;
create policy "active staff can read payments" on public.payments for select to authenticated using (public.is_active_staff());
-- Remove obsolete paths which could attach unverified checkout references or skip amount checks.
revoke all on function public.create_pending_payment(uuid,uuid,text,text,text,numeric,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.settle_yoco_checkout(text,text,text,text,text) from public,anon,authenticated,service_role;

create or replace function public.attach_invoice_checkout(p_payment_id uuid, p_reference text, p_url text, p_mode text, p_amount_cents bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.payments%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Server access required'; end if;
  select * into strict p from public.payments where id = p_payment_id for update;
  if p.status <> 'pending' then raise exception 'Checkout is no longer pending'; end if;
  if p.provider <> 'yoco' or p.metadata->>'invoice_id' is null or p.metadata->>'processing_mode' is distinct from p_mode
    or round(p.amount * 100) is distinct from p_amount_cents then raise exception 'Checkout does not match the reserved invoice balance'; end if;
  if p.provider_reference is not null and p.provider_reference <> p_reference then raise exception 'A different checkout is already attached'; end if;
  if p_url is null or p_url !~ '^https://c[.]yoco[.]com/' or nullif(p_reference, '') is null then raise exception 'Invalid checkout response'; end if;
  update public.payments set provider_reference = p_reference, checkout_url = p_url, checkout_status = 'created', updated_at = now() where id = p.id;
end;
$$;
revoke all on function public.attach_invoice_checkout(uuid,text,text,text,bigint) from public, anon, authenticated;
grant execute on function public.attach_invoice_checkout(uuid,text,text,text,bigint) to service_role;



create or replace function public.settle_yoco_checkout_verified(p_reference text, p_mode text, p_method text, p_payment_reference text, p_event_id text, p_amount_cents bigint, p_currency text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.payments%rowtype; q public.quotations%rowtype; paid numeric;
begin
  select * into strict p from public.payments where provider = 'yoco' and provider_reference = p_reference;
  select * into strict q from public.quotations where id = p.quotation_id for update;
  select * into strict p from public.payments where id = p.id for update;
  if p_amount_cents is null or p_amount_cents <= 0 or round(p.amount * 100) is distinct from p_amount_cents
    or p_currency is distinct from p.currency or p_currency <> 'ZAR' then
    raise exception 'Webhook amount or currency does not match checkout';
  end if;
  if nullif(p_payment_reference, '') is null or nullif(p_event_id, '') is null then raise exception 'Missing provider event references'; end if;
  if p_mode is null or p_mode not in ('test','live') or p.metadata->>'processing_mode' is distinct from p_mode then raise exception 'Webhook and checkout environments do not match'; end if;
  if p.status = 'paid' then
    if p.metadata->>'yoco_payment_id' is distinct from p_payment_reference then raise exception 'Conflicting provider payment'; end if;
    return;
  end if;
  if p.status = 'voided' and p.metadata->>'processing_mode' = 'test' then return; end if;
  if p_mode is null or p_mode not in ('test','live') or p.metadata->>'processing_mode' is distinct from p_mode then
    raise exception 'Webhook and checkout environments do not match';
  end if;
  if p.status <> 'pending' then raise exception 'Checkout is not pending'; end if;
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
revoke all on function public.settle_yoco_checkout_verified(text,text,text,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.settle_yoco_checkout_verified(text,text,text,text,text,bigint,text) to service_role;


revoke all on function public.create_customer_service_request(text,text,text,text,text,public.business_unit,text,text,timestamptz,text) from public,anon;
revoke all on function public.schedule_service_job(uuid,timestamptz,timestamptz,text,uuid,uuid,text) from public,anon;
revoke all on function public.create_quotation_with_items(uuid,jsonb,numeric,text,date) from public,anon;

-- Preserve the event history; staff actions may append their own events only.
revoke update, delete, truncate on public.request_events from anon, authenticated;
drop policy if exists "active staff can manage request events" on public.request_events;
create policy "active staff can read request events" on public.request_events for select to authenticated using (public.is_active_staff());
create policy "active staff append own request events" on public.request_events for insert to authenticated
  with check (public.is_active_staff() and created_by = auth.uid()::text);

-- A verified factor makes MFA mandatory at the database boundary, not only in the UI.
-- Staff without a factor can still sign in to complete enrollment.
create or replace function public.is_active_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.staff_profiles where user_id=auth.uid() and active=true)
    and (not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified')
      or auth.jwt()->>'aal'='aal2');
$$;
create or replace function public.is_admin_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_staff() and exists(select 1 from public.staff_profiles where user_id=auth.uid() and active=true and role='admin');
$$;

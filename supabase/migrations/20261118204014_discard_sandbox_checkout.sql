-- Staff may abandon simulated checkouts without changing live payment records.
create function public.discard_sandbox_checkout(p_invoice_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare i public.invoices%rowtype; q public.quotations%rowtype; p public.payments%rowtype; discarded integer := 0;
begin
  if not coalesce(public.is_active_staff(),false) then raise exception 'Active staff access required'; end if;
  select * into strict i from public.invoices where id = p_invoice_id;
  if i.mode <> 'test' then raise exception 'Only sandbox checkouts can be discarded'; end if;
  select * into strict q from public.quotations where id = i.quotation_id for update;
  for p in select * from public.payments where quotation_id=i.quotation_id and provider='yoco'
    and status='pending' and metadata->>'processing_mode'='test' for update loop
    update public.payments set status='voided', checkout_status='sandbox_discarded', updated_at=now(),
      metadata=metadata || jsonb_build_object('discarded_by',auth.uid(),'discarded_at',now()) where id=p.id;
    insert into public.request_events(service_request_id,event_type,detail,created_by)
      values(q.service_request_id,'sandbox_checkout_discarded',jsonb_build_object('invoice_id',i.id,'payment_id',p.id,
        'checkout_reference',p.provider_reference),auth.uid()::text);
    discarded := discarded + 1;
  end loop;
  return discarded;
end;
$$;
revoke all on function public.discard_sandbox_checkout(uuid) from public,anon;
grant execute on function public.discard_sandbox_checkout(uuid) to authenticated;

create or replace function public.attach_invoice_checkout(p_payment_id uuid, p_reference text, p_url text, p_mode text, p_amount_cents bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.payments%rowtype;
begin
  if not coalesce(public.is_active_staff(), false) then raise exception 'Active staff access required'; end if;
  select * into strict p from public.payments where id = p_payment_id for update;
  if p.status <> 'pending' then raise exception 'Checkout is no longer pending'; end if;
  if p.provider <> 'yoco' or p.metadata->>'invoice_id' is null or p.metadata->>'processing_mode' <> p_mode
    or round(p.amount * 100) <> p_amount_cents then raise exception 'Checkout does not match the reserved invoice balance'; end if;
  if p.provider_reference is not null and p.provider_reference <> p_reference then raise exception 'A different checkout is already attached'; end if;
  if p_url !~ '^https://' or nullif(p_reference, '') is null then raise exception 'Invalid checkout response'; end if;
  update public.payments set provider_reference = p_reference, checkout_url = p_url, checkout_status = 'created', updated_at = now() where id = p.id;
end;
$$;
revoke all on function public.attach_invoice_checkout(uuid,text,text,text,bigint) from public, anon;
grant execute on function public.attach_invoice_checkout(uuid,text,text,text,bigint) to authenticated;


create or replace function public.settle_yoco_checkout(p_reference text, p_mode text, p_method text, p_payment_reference text, p_event_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.payments%rowtype; q public.quotations%rowtype; paid numeric;
begin
  select * into strict p from public.payments where provider = 'yoco' and provider_reference = p_reference;
  select * into strict q from public.quotations where id = p.quotation_id for update;
  select * into strict p from public.payments where id = p.id for update;
  if p.status = 'paid' then return; end if;
  if p.status = 'voided' and p.metadata->>'processing_mode' = 'test' then return; end if;
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

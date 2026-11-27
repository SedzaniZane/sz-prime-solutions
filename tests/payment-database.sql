-- Run through a privileged SQL session. Every write is rolled back.
begin;
do $$
declare p public.payments%rowtype; rejected boolean; before_count bigint;
begin
  select * into strict p from public.payments where provider='yoco' and status='paid'
    and metadata->>'processing_mode'='test' and metadata->>'yoco_payment_id' is not null limit 1;
  select count(*) into before_count from public.payments;
  rejected := false;
  begin
    perform public.settle_yoco_checkout_verified(p.provider_reference,'test','card',p.metadata->>'yoco_payment_id','security-test',round(p.amount*100)::bigint+1,p.currency);
  exception when raise_exception then rejected := true; end;
  if not rejected then raise exception 'Amount mismatch was accepted'; end if;
  rejected := false;
  begin
    perform public.settle_yoco_checkout_verified(p.provider_reference,'test','card',p.metadata->>'yoco_payment_id','security-test',round(p.amount*100)::bigint,'USD');
  exception when raise_exception then rejected := true; end;
  if not rejected then raise exception 'Currency mismatch was accepted'; end if;
  rejected := false;
  begin
    perform public.settle_yoco_checkout_verified(p.provider_reference,'live','card',p.metadata->>'yoco_payment_id','security-test',round(p.amount*100)::bigint,p.currency);
  exception when raise_exception then rejected := true; end;
  if not rejected then raise exception 'Mode mismatch was accepted'; end if;
  -- A real duplicate delivery must be a no-op, not another credit.
  perform public.settle_yoco_checkout_verified(p.provider_reference,'test','card',p.metadata->>'yoco_payment_id','security-test',round(p.amount*100)::bigint,p.currency);
  if (select count(*) from public.payments) <> before_count then raise exception 'Duplicate created another payment'; end if;
end;
$$;
set local role anon;
do $$ declare t text; n bigint; begin
  foreach t in array array['customers','service_requests','partners','partner_assignments','customer_notes','request_events','staff_profiles','quotations','payments','quotation_items','jobs','invoices','quotation_number_counters'] loop
    begin
      execute format('select count(*) from public.%I',t) into n;
      if n <> 0 then raise exception 'Anonymous data exposure on %',t; end if;
    exception when insufficient_privilege then null; -- Explicit denial is also a pass.
    end;
  end loop;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
do $$ begin
  if public.is_active_staff() then raise exception 'Non-staff authorised'; end if;
  if (select count(*) from public.customers) <> 0 or (select count(*) from public.invoices) <> 0 then raise exception 'Non-staff data exposure'; end if;
  if has_table_privilege(current_user,'public.payments','UPDATE') or has_table_privilege(current_user,'public.payments','INSERT') then raise exception 'Direct ledger write allowed'; end if;
  if has_table_privilege(current_user,'public.request_events','DELETE') then raise exception 'Audit deletion allowed'; end if;
  if has_function_privilege(current_user,'public.settle_yoco_checkout_verified(text,text,text,text,text,bigint,text)','EXECUTE') then raise exception 'Client settlement allowed'; end if;
end $$;
reset role;
rollback;
select 'passed: amount, currency, mode, duplicate, anonymous, non-staff, ledger and audit guards' as security_checks;

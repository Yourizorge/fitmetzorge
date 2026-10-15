begin;
-- Additive, owner-only preview/confirm API. No historical rows are migrated.
create function fmz_accounting.bank_repair_plan(oid uuid, action text, payload jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare r fmz_accounting.records; b fmz_accounting.records; account fmz_accounting.records;
 a fmz_accounting.records; item jsonb; inv fmz_accounting.records; ids jsonb:='[]'; invoices jsonb:='[]';
 amount bigint; d date; delta bigint:=0; reason text; token text; current_balance bigint;
begin
 if jsonb_typeof(payload) is distinct from 'object' or pg_column_size(payload)>30000 then raise exception 'Ongeldig herstelverzoek' using errcode='22023';end if;
 reason:=trim(coalesce(payload->>'reason',''));
 if length(reason)<10 or length(reason)>1000 then raise exception 'Beschrijf in minimaal 10 tekens welke invoer onjuist is' using errcode='22023';end if;
 select * into r from fmz_accounting.records where org_id=oid and id=(payload->>'record_id')::uuid;
 if r.id is null or r.status='reversed' then raise exception 'De invoer ontbreekt of is al gecorrigeerd. Ververs het overzicht.' using errcode='PT409';end if;
 if action='unlink_allocation' then
  if r.kind<>'allocation' then raise exception 'Kies een factuurkoppeling' using errcode='22023';end if;
  select * into b from fmz_accounting.records where org_id=oid and id=(r.data->>'bank_id')::uuid and kind='bank' and status<>'reversed';
 elsif action='reverse_bank' then
  if r.kind<>'bank' then raise exception 'Kies een bank- of kasmutatie' using errcode='22023';end if;b:=r;
  if b.data ? 'import_id' or b.data ? 'bank_evidence_id' then raise exception 'Deze mutatie heeft een bankbron. Controleer de import; een echte banktransactie wordt niet als foutieve handmatige invoer teruggedraaid.' using errcode='22023';end if;
 elsif action='replace_opening' then
  if r.kind<>'account' then raise exception 'Kies de rekening met de onjuiste beginstand' using errcode='22023';end if;account:=r;
  select * into r from fmz_accounting.records where org_id=oid and kind='opening' and status<>'reversed' and data->>'account_id'=account.id::text;
  if r.id is null or (select count(*) from fmz_accounting.records where org_id=oid and kind='opening' and status<>'reversed' and data->>'account_id'=account.id::text)<>1 then raise exception 'Geen eenduidige beginstand. Laat de historische aansluiting controleren.' using errcode='22023';end if;
  amount:=(payload->>'new_cents')::bigint;d:=(payload->>'new_date')::date;
  if amount is null or abs(amount)>900000000000 or d is null or d>(now() at time zone 'Europe/Amsterdam')::date then raise exception 'Vul een gecontroleerde beginstand en datum in; geen toekomstige datum.' using errcode='22023';end if;
  if exists(select 1 from fmz_accounting.records where org_id=oid and kind='bank' and data->>'account_id'=account.id::text and date<d and status<>'reversed') then raise exception 'De beginstand mag niet na bestaande bankmutaties liggen' using errcode='22023';end if;
  if amount=(r.data->>'cents')::bigint and d=r.date then raise exception 'Bedrag en datum zijn gelijk; er is geen correctie nodig' using errcode='22023';end if;
  perform fmz_accounting.open_date(oid,r.date);perform fmz_accounting.open_date(oid,d);
  delta:=amount-(r.data->>'cents')::bigint;
  ids:=jsonb_build_array(r.id);
 else raise exception 'Onbekende herstelhandeling' using errcode='22023';end if;
 if action in ('reverse_bank','unlink_allocation') then
  if b.id is null then raise exception 'De gekoppelde bankmutatie is gewijzigd' using errcode='PT409';end if;
  select * into account from fmz_accounting.records where org_id=oid and id=(b.data->>'account_id')::uuid and kind='account';
  perform fmz_accounting.open_date(oid,b.date);
  if exists(select 1 from fmz_accounting.records t where t.org_id=oid and t.kind='transfer' and t.status<>'reversed' and (t.data->>'from_id'=b.id::text or t.data->>'to_id'=b.id::text)) then raise exception 'Deze mutatie hoort bij een eigen overboeking. Laat beide kanten samen controleren.' using errcode='22023';end if;
  for a in select * from fmz_accounting.records where org_id=oid and kind='allocation' and status<>'reversed' and (case when action='unlink_allocation' then id=r.id else data->>'bank_id'=b.id::text end) order by id loop
   perform fmz_accounting.open_date(oid,a.date);
   if jsonb_typeof(a.data->'parts') is distinct from 'array' or jsonb_array_length(a.data->'parts')=0 then raise exception 'De historische verdeling is onvolledig' using errcode='22023';end if;
   for item in select value from jsonb_array_elements(a.data->'parts') loop
    if item->>'type' is distinct from 'invoice' or (b.data->>'cents')::bigint<=0 then raise exception 'Alleen ontvangstkoppelingen aan facturen kunnen hier worden hersteld. Andere verdelingen vereisen afzonderlijke controle.' using errcode='22023';end if;
    select * into inv from fmz_accounting.records where org_id=oid and id=(item->>'target_id')::uuid and kind='invoice';
    if inv.id is null then raise exception 'De gekoppelde factuur ontbreekt' using errcode='22023';end if;
    invoices:=invoices||jsonb_build_array(jsonb_build_object('id',inv.id,'number',inv.number,'customer',inv.data#>>'{document,customer,name}','increase_cents',(item->>'cents')::bigint,'before_cents',fmz_accounting.balance(oid,'1100',inv.id)));
   end loop;
   ids:=ids||jsonb_build_array(a.id);
  end loop;
  if action='reverse_bank' then ids:=ids||jsonb_build_array(b.id);delta:=-(b.data->>'cents')::bigint;end if;
 end if;
 if account.id is null then raise exception 'Rekening ontbreekt' using errcode='22023';end if;
 if exists(select 1 from fmz_accounting.records where org_id=oid and kind='reconciliation' and status='reconciled' and parent_id=account.id and date>=coalesce(b.date,least(r.date,d))) then raise exception 'Deze rekening is over deze datum al afgestemd. Laat de aansluiting eerst controleren; er wordt niets stilzwijgend gewijzigd.' using errcode='PT409';end if;
 current_balance:=fmz_accounting.balance(oid,account.data->>'code');
 -- Organization lock during confirmation serializes all existing finance writers.
 -- Bind both records and append-only ledger, including intervening allocations.
 select md5(jsonb_build_object('records',(select jsonb_agg(jsonb_build_array(id,version,status) order by id) from fmz_accounting.records where org_id=oid),'lines',(select jsonb_agg(jsonb_build_array(journal_id,line_no,account_code,cents,reference_id) order by journal_id,line_no) from fmz_accounting.lines where org_id=oid))::text) into token;
 return jsonb_build_object('action',action,'record_id',payload->>'record_id','reason',reason,'token',token,'reverse_ids',ids,'account_id',account.id,'account_name',account.data->>'name','date',coalesce(b.date,r.date),'before_cents',current_balance,'delta_cents',delta,'after_cents',current_balance+delta,'invoices',invoices,'old_opening_cents',case when action='replace_opening' then (r.data->>'cents')::bigint end,'new_opening_cents',amount,'new_opening_date',d,'keeps_bank',action='unlink_allocation','no_actual_refund',true,'revenue_delta_cents',0);
end $$;
revoke all on function fmz_accounting.bank_repair_plan(uuid,text,jsonb) from public,anon,authenticated;

create function fmz_accounting.bank_repair_preview(action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare oid uuid;
begin oid:=fmz_accounting.owner_org();return fmz_accounting.bank_repair_plan(oid,action,payload);end $$;
revoke all on function fmz_accounting.bank_repair_preview(text,jsonb) from public,anon,authenticated;
grant execute on function fmz_accounting.bank_repair_preview(text,jsonb) to authenticated;

create function fmz_accounting.bank_repair_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare oid uuid; plan jsonb; rec fmz_accounting.records; receipt fmz_accounting.receipts; bank fmz_accounting.records;
 rid uuid; cid uuid; nid uuid; original_id uuid; part jsonb; items jsonb; hash text; result jsonb; amount bigint;
begin
 oid:=fmz_accounting.owner_org();
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or pg_column_size(payload)>60000 then raise exception 'Ongeldig herstelverzoek' using errcode='22023';end if;
 perform 1 from fmz_accounting.organizations where id=oid for update;
 hash:=md5('bank-repair:'||action||':'||payload::text);
 select * into receipt from fmz_accounting.receipts where org_id=oid and receipts.request_id=bank_repair_command.request_id;
 if found then if receipt.payload_hash<>hash then raise exception 'Verzoeknummer hoort bij andere invoer' using errcode='PT409';end if;return receipt.result;end if;
 perform fmz_accounting.check_numbers(payload);
 plan:=fmz_accounting.bank_repair_plan(oid,action,payload->'data');
 if payload->'expected' is distinct from plan then raise exception 'De administratie is sinds het voorstel gewijzigd. Laad opnieuw en beoordeel een nieuw voorstel.' using errcode='PT409';end if;
 if payload->>'confirmed' is distinct from 'true' then raise exception 'Bevestig eerst de getoonde correctie en gevolgen' using errcode='22023';end if;
 rid:=(payload->>'id')::uuid;if rid is null then raise exception 'Herstelidentiteit ontbreekt' using errcode='22023';end if;
 select * into bank from fmz_accounting.records where org_id=oid and id=(payload#>>'{data,record_id}')::uuid and kind='bank';
 for original_id in select value::text::uuid from jsonb_array_elements_text(plan->'reverse_ids') loop
  select * into rec from fmz_accounting.records where org_id=oid and id=original_id;
  cid:=gen_random_uuid();amount:=0;
  if rec.kind='allocation' then
   select coalesce(sum((value->>'cents')::bigint),0) into amount from jsonb_array_elements(rec.data->'parts');
   perform fmz_accounting.add_record(oid,cid,'correction',rec.date,jsonb_build_object('payment_reversal',true,'payment_id',rec.id,'bank_id',rec.data->>'bank_id','cents',amount,'reason',plan->>'reason','cleared_bank',false,'effective_date',(select date from fmz_accounting.records where org_id=oid and id=(rec.data->>'bank_id')::uuid),'repair_id',rid),'posted',rec.id);
  else
   perform fmz_accounting.add_record(oid,cid,'correction',rec.date,jsonb_build_object('bank_reversal',rec.kind='bank','opening_reversal',rec.kind='opening','bank_id',case when rec.kind='bank' then rec.id end,'cents',(rec.data->>'cents')::bigint,'reason',plan->>'reason','repair_id',rid),'posted',rec.id);
  end if;
  select jsonb_agg(jsonb_build_array(l.account_code,-l.cents,l.reference_id) order by l.journal_id,l.line_no) into items from fmz_accounting.lines l join fmz_accounting.journals j on j.org_id=l.org_id and j.id=l.journal_id where l.org_id=oid and j.record_id=rec.id;
  if items is null then raise exception 'Oorspronkelijke boekingen ontbreken' using errcode='22023';end if;
  perform fmz_accounting.post(oid,cid,rec.date,'Invoerherstel: '||(plan->>'reason'),items);
  update fmz_accounting.records set status='reversed',version=version+1,data=data||jsonb_build_object('payment_correction_id',cid,'repair_id',rid) where org_id=oid and id=rec.id;
 end loop;
 if action='replace_opening' then
  nid:=gen_random_uuid();
  perform fmz_accounting.add_record(oid,nid,'opening',(plan->>'new_opening_date')::date,jsonb_build_object('account_id',plan->>'account_id','cents',(plan->>'new_opening_cents')::bigint,'date',plan->>'new_opening_date','description',plan->>'reason','repair_id',rid),'posted',(plan->>'account_id')::uuid);
  perform fmz_accounting.post(oid,nid,(plan->>'new_opening_date')::date,'Gecorrigeerde beginstand: '||(plan->>'reason'),jsonb_build_array(jsonb_build_array((select data->>'code' from fmz_accounting.records where org_id=oid and id=(plan->>'account_id')::uuid),(plan->>'new_opening_cents')::bigint,plan->>'account_id'),jsonb_build_array('2000',-(plan->>'new_opening_cents')::bigint,plan->>'account_id')));
  update fmz_accounting.records set data=data||jsonb_build_object('opening_cents',(plan->>'new_opening_cents')::bigint,'opening_date',plan->>'new_opening_date'),version=version+1 where org_id=oid and id=(plan->>'account_id')::uuid;
 end if;
 result:=jsonb_build_object('repair_id',rid,'action',action,'record_id',plan->>'record_id','account_id',plan->>'account_id','reversed_ids',plan->'reverse_ids','new_opening_id',nid,'no_actual_refund',true);
 insert into fmz_accounting.audit(org_id,actor_id,action,request_id,detail) values(oid,auth.uid(),'bank_repair_'||action,bank_repair_command.request_id,jsonb_build_object('approved_plan',plan,'result',result));
 insert into fmz_accounting.receipts values(oid,bank_repair_command.request_id,hash,result,now());
 return result;
end $$;
revoke all on function fmz_accounting.bank_repair_command(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function fmz_accounting.bank_repair_command(text,jsonb,uuid) to authenticated;

create function public.fmz_bank_repair_preview(action text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select fmz_accounting.bank_repair_preview(action,payload)$$;
revoke all on function public.fmz_bank_repair_preview(text,jsonb) from public,anon;
grant execute on function public.fmz_bank_repair_preview(text,jsonb) to authenticated;
create function public.fmz_bank_repair_command(action text,payload jsonb,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_accounting.bank_repair_command(action,payload,request_id)$$;
revoke all on function public.fmz_bank_repair_command(text,jsonb,uuid) from public,anon;
grant execute on function public.fmz_bank_repair_command(text,jsonb,uuid) to authenticated;
commit;

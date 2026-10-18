begin;
-- Additive owner-only VAT declaration/settlement API. No existing rows are rewritten.
alter table fmz_accounting.records drop constraint records_kind_check;
alter table fmz_accounting.records add constraint records_kind_check check(kind in ('invoice','expense','bank','allocation','transfer','private','asset','loan','depreciation','correction','opening','account','settings','period','import','reconciliation','legacy','vat_period','vat_settlement'));

create function fmz_accounting.vat_basis(oid uuid,first_day date,last_day date) returns jsonb
language sql stable set search_path='' as $$
 with r as (select * from fmz_accounting.records where org_id=oid),
 payments as (
  select a.id,a.created_at,b.date,p->>'target_id' invoice_id,(p->>'cents')::bigint*sign((b.data->>'cents')::bigint) amount
  from r a join r b on b.id=(a.data->>'bank_id')::uuid cross join lateral jsonb_array_elements(a.data->'parts') p where a.kind='allocation' and p->>'type'='invoice'
  union all
  select c.id,c.created_at,coalesce((c.data->>'effective_date')::date,b.date),p->>'target_id',-(p->>'cents')::bigint*sign((b.data->>'cents')::bigint)
  from r c join r a on a.id=(c.data->>'payment_id')::uuid join r b on b.id=(a.data->>'bank_id')::uuid cross join lateral jsonb_array_elements(a.data->'parts') p where c.kind='correction' and c.data->>'payment_reversal'='true' and p->>'type'='invoice'
 ), running as (
  select p.*,sum(amount) over(partition by invoice_id order by date,created_at,id rows unbounded preceding) cumulative from payments p
 ), sources as (
  select id,date,number label,(data#>>'{document,vatCents}')::bigint output,0::bigint input,(data#>>'{document,netCents}')::bigint revenue,parent_id is not null correction from r where kind='invoice' and status='posted' and data#>>'{document,vatMethod}'='invoice'
  union all select id,date,data->>'supplier',coalesce((data->>'charge_vat_cents')::bigint,0),coalesce((data->>'input_vat_cents')::bigint,0),0,false from r where kind='expense'
  union all select c.id,c.date,'Tegenboeking '||(e.data->>'supplier'),-coalesce((e.data->>'charge_vat_cents')::bigint,0),-coalesce((e.data->>'input_vat_cents')::bigint,0),0,true from r c join r e on e.id=c.parent_id where c.kind='correction' and c.data->>'expense_reversal'='true'
  union all select c.id,c.date,'Annulering '||i.number,-(i.data#>>'{document,vatCents}')::bigint,0,-(i.data#>>'{document,netCents}')::bigint,true from r c join r i on i.id=c.parent_id where c.kind='correction' and c.data->>'invoice_cancellation'='true' and i.data#>>'{document,vatMethod}'='invoice'
  union all select p.id,p.date,'Ontvangst/terugbetaling '||i.number,
   (round(p.cumulative*(i.data#>>'{document,vatCents}')::numeric/nullif((i.data#>>'{document,totalCents}')::numeric,0))-round((p.cumulative-p.amount)*(i.data#>>'{document,vatCents}')::numeric/nullif((i.data#>>'{document,totalCents}')::numeric,0)))::bigint,
   0,(p.amount-(round(p.cumulative*(i.data#>>'{document,vatCents}')::numeric/nullif((i.data#>>'{document,totalCents}')::numeric,0))-round((p.cumulative-p.amount)*(i.data#>>'{document,vatCents}')::numeric/nullif((i.data#>>'{document,totalCents}')::numeric,0))))::bigint,p.amount<0
  from running p join r i on i.id=p.invoice_id::uuid where i.data#>>'{document,vatMethod}'='cash'
 ), selected as (select * from sources where date between first_day and last_day)
 select jsonb_build_object('from',first_day,'to',last_day,'output_cents',coalesce(sum(output),0),'input_cents',coalesce(sum(input),0),'net_cents',coalesce(sum(output-input),0),'revenue_cents',coalesce(sum(revenue),0),'sources',coalesce(jsonb_agg(to_jsonb(selected) order by date,id),'[]')) from selected
$$;
revoke all on function fmz_accounting.vat_basis(uuid,date,date) from public,anon,authenticated;

create function fmz_accounting.vat_plan(oid uuid,action text,body jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare p fmz_accounting.records;b fmz_accounting.records;a fmz_accounting.records;s fmz_accounting.records;
 first_day date;last_day date;d date;amount bigint;bank_amount bigint;paid bigint;declared bigint;available bigint;remaining bigint;token text;basis jsonb;result jsonb;reason text;bid uuid;clear_bank boolean;
begin
 if jsonb_typeof(body) is distinct from 'object' or pg_column_size(body)>30000 then raise exception 'Ongeldig btw-verzoek' using errcode='22023';end if;
 perform fmz_accounting.check_numbers(body);
 reason:=trim(coalesce(body->>'reason',''));
 if action='period' then
  first_day:=(body->>'from')::date;last_day:=(body->>'to')::date;
  if first_day is null or last_day is null or first_day>last_day or last_day-first_day>365 then raise exception 'Kies een geldige btw-periode van maximaal een jaar' using errcode='22023';end if;
  if nullif(body->>'period_id','') is not null then select * into p from fmz_accounting.records where org_id=oid and id=(body->>'period_id')::uuid and kind='vat_period';if p.id is null then raise exception 'Btw-periode ontbreekt' using errcode='42501';end if;end if;
  if p.id is not null and ((p.data->>'from')::date<>first_day or (p.data->>'to')::date<>last_day) then raise exception 'Een vastgelegde periode blijft behouden. Corrigeer een betaling en koppel deze aan de juiste periode.' using errcode='22023';end if;
  if exists(select 1 from fmz_accounting.records where org_id=oid and kind='vat_period' and id is distinct from p.id and daterange((data->>'from')::date,(data->>'to')::date,'[]')&&daterange(first_day,last_day,'[]')) then raise exception 'Deze periode overlapt een bestaande btw-periode. Open die periode om dubbel tellen te voorkomen.' using errcode='PT409';end if;
  basis:=fmz_accounting.vat_basis(oid,first_day,last_day);declared:=(body->>'declared_cents')::bigint;
  if p.status='filed' and body->>'filed' is distinct from 'true' then raise exception 'Een gedane aangifte kan niet als concept worden verborgen' using errcode='22023';end if;
  if body->>'filed'='true' then
   d:=(body->>'filed_date')::date;
   if declared is null or d is null or d<last_day or d>(now() at time zone 'Europe/Amsterdam')::date or body->>'reviewed' is distinct from 'true' then raise exception 'Controleer de berekening en vul het werkelijk aangegeven bedrag en de aangiftedatum in. APPFMZ dient geen aangifte in.' using errcode='22023';end if;
   if (declared<>(basis->>'net_cents')::bigint or p.status='filed') and length(reason)<10 then raise exception 'Beschrijf het verschil met de berekening of de correctie van de vastgelegde aangifte' using errcode='22023';end if;
  end if;
  result:=jsonb_build_object('period_id',p.id,'basis',basis,'declared_cents',declared,'difference_cents',declared-(basis->>'net_cents')::bigint,'bank_delta_cents',0,'profit_delta_cents',0);
 elsif action='settle' then
  select * into p from fmz_accounting.records where org_id=oid and id=(body->>'period_id')::uuid and kind='vat_period';
  if p.id is null or p.status<>'filed' then raise exception 'Leg eerst de gecontroleerde aangifte vast. Een concept is geen bewezen belastingschuld.' using errcode='22023';end if;
  amount:=(body->>'cents')::bigint;d:=(body->>'date')::date;
  if amount is null or amount<=0 or d is null or d>(now() at time zone 'Europe/Amsterdam')::date or coalesce(body->>'direction','') not in ('payment','refund') then raise exception 'Vul het werkelijk betaalde of ontvangen bedrag en de juiste datum in' using errcode='22023';end if;
  select * into a from fmz_accounting.records where org_id=oid and id=(body->>'account_id')::uuid and kind='account' and coalesce(data->>'hidden','false')<>'true';if a.id is null then raise exception 'Kies een actieve Bank- of Kasrekening' using errcode='22023';end if;
  if length(trim(coalesce(body->>'reference','')))<1 or length(coalesce(body->>'reference',''))>200 or length(coalesce(body->>'description',''))>1000 then raise exception 'Vul het betalingskenmerk of de teruggaafreferentie in' using errcode='22023';end if;
  perform fmz_accounting.open_date(oid,d);bank_amount:=case when body->>'direction'='payment' then -amount else amount end;
  select coalesce(sum((data->>'signed_cents')::bigint),0) into paid from fmz_accounting.records where org_id=oid and kind='vat_settlement' and parent_id=p.id and status='posted';
  remaining:=(p.data->>'declared_cents')::bigint-paid;
  if (bank_amount<0 and (remaining<=0 or amount>remaining) or bank_amount>0 and (remaining>=0 or amount> -remaining)) and length(trim(coalesce(body->>'difference_reason','')))<10 then raise exception 'Deze betaling wijkt af van wat nog openstaat. Controleer de periode en leg het werkelijke betalingsverschil uit.' using errcode='22023';end if;
  if nullif(body->>'bank_id','') is not null then
   select * into b from fmz_accounting.records where org_id=oid and id=(body->>'bank_id')::uuid and kind='bank' and status='posted';
   if b.id is null or b.data->>'account_id'<>a.id::text or b.date<>d or sign((b.data->>'cents')::bigint)<>sign(bank_amount) then raise exception 'Controleer datum, richting en rekening van de bestaande bankmutatie' using errcode='22023';end if;
   available:=-fmz_accounting.balance(oid,'1400',b.id);if sign(available)<>sign(bank_amount) or abs(available)<amount then raise exception 'Deze bankmutatie is al gekoppeld of heeft onvoldoende beschikbaar bedrag' using errcode='PT409';end if;
  else
   if exists(select 1 from fmz_accounting.records where org_id=oid and kind='vat_settlement' and status='posted' and parent_id=p.id and date=d and data->>'account_id'=a.id::text and (data->>'signed_cents')::bigint=-bank_amount) then raise exception 'Deze btw-betaling staat al geregistreerd. Open de bestaande betaling.' using errcode='PT409';end if;
   if exists(select 1 from fmz_accounting.records where org_id=oid and kind='bank' and status='posted' and date=d and data->>'account_id'=a.id::text and (data->>'cents')::bigint=bank_amount) and length(trim(coalesce(body->>'distinct_receipt_reason','')))<10 then raise exception 'Er bestaat al een mogelijke bankmutatie. Koppel die of beschrijf waarom dit een andere transactie is.' using errcode='PT409';end if;
  end if;
  result:=jsonb_build_object('period_id',p.id,'bank_id',b.id,'account_id',a.id,'account_name',a.data->>'name','signed_cents',-bank_amount,'bank_delta_cents',case when b.id is null then bank_amount else 0 end,'before_cents',remaining,'after_cents',remaining+bank_amount,'profit_delta_cents',0,'vat_calculation_delta_cents',0);
 elsif action='correct' then
  select * into s from fmz_accounting.records where org_id=oid and id=(body->>'settlement_id')::uuid and kind='vat_settlement' and status='posted';if s.id is null then raise exception 'Btw-betaling ontbreekt of is al gecorrigeerd' using errcode='PT409';end if;
  if length(reason)<10 or length(reason)>1000 or coalesce(body->>'mode','') not in ('unlink','reverse') then raise exception 'Kies alleen koppeling herstellen of volledige foutieve invoer, en beschrijf de reden' using errcode='22023';end if;
  select * into b from fmz_accounting.records where org_id=oid and id=(s.data->>'bank_id')::uuid and kind='bank' and status='posted';if b.id is null then raise exception 'Bankbron is gewijzigd' using errcode='PT409';end if;
  select * into a from fmz_accounting.records where org_id=oid and id=(b.data->>'account_id')::uuid and kind='account';
  perform fmz_accounting.open_date(oid,s.date);perform fmz_accounting.open_date(oid,b.date);
  if exists(select 1 from fmz_accounting.records where org_id=oid and kind='reconciliation' and status='reconciled' and parent_id=a.id and date>=b.date) then raise exception 'Deze rekening is al afgestemd. Laat de aansluiting eerst controleren.' using errcode='PT409';end if;
  clear_bank:=body->>'mode'='reverse';
  if clear_bank and (b.data->>'entry_origin' is distinct from 'vat_payment' or b.data ? 'bank_evidence_id' or b.data ? 'import_id' or exists(select 1 from fmz_accounting.records where org_id=oid and status='posted' and id<>s.id and (kind='vat_settlement' or kind='allocation') and data->>'bank_id'=b.id::text)) then raise exception 'De bankbron of andere verdelingen moeten behouden blijven. Herstel alleen deze koppeling.' using errcode='22023';end if;
  result:=jsonb_build_object('settlement_id',s.id,'period_id',s.parent_id,'bank_id',b.id,'account_name',a.data->>'name','signed_cents',(s.data->>'signed_cents')::bigint,'bank_delta_cents',case when clear_bank then -(b.data->>'cents')::bigint else 0 end,'keeps_bank',not clear_bank,'profit_delta_cents',0,'vat_calculation_delta_cents',0);
 elsif action='attach_source' then
  select * into b from fmz_accounting.records where org_id=oid and id=(body->>'bank_id')::uuid and kind='bank' and status='posted';
  if b.id is null or b.data->>'entry_origin' is distinct from 'vat_payment' or b.version is distinct from (body->>'version')::bigint then raise exception 'Deze btw-bankmutatie is gewijzigd. Ververs eerst.' using errcode='PT409';end if;
  if body->>'source_key' is null or body->>'source_key' !~ '^[a-f0-9]{64}$' or b.data->>'account_id' is distinct from body->>'account_id' or b.date is distinct from (body->>'date')::date or (b.data->>'cents')::bigint is distinct from (body->>'cents')::bigint then raise exception 'Bankbron en btw-mutatie komen niet overeen. Controleer rekening, datum en bedrag.' using errcode='22023';end if;
  if b.data ? 'bank_evidence_id' or exists(select 1 from fmz_accounting.records where org_id=oid and kind='bank' and source_key=body->>'source_key') then raise exception 'Deze bankbron of mutatie is al gekoppeld' using errcode='PT409';end if;
  if not exists(select 1 from fmz_accounting.files where org_id=oid and id=(body->>'file_id')::uuid and status='ready' and kind='bank_import') then raise exception 'Bewaar eerst het originele CSV-bestand' using errcode='22023';end if;
  result:=jsonb_build_object('bank_id',b.id,'file_id',body->>'file_id','source_key',body->>'source_key','bank_delta_cents',0,'profit_delta_cents',0,'vat_calculation_delta_cents',0,'no_new_receipt',true);
 else raise exception 'Onbekende btw-handeling' using errcode='22023';end if;
 select md5(jsonb_build_object('records',(select jsonb_agg(jsonb_build_array(id,version,status) order by id) from fmz_accounting.records where org_id=oid),'lines',(select jsonb_agg(jsonb_build_array(journal_id,line_no,cents,reference_id) order by journal_id,line_no) from fmz_accounting.lines where org_id=oid))::text) into token;
 return result||jsonb_build_object('action',action,'token',token);
end $$;
revoke all on function fmz_accounting.vat_plan(uuid,text,jsonb) from public,anon,authenticated;

create function fmz_accounting.vat_preview(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin return fmz_accounting.vat_plan(fmz_accounting.owner_org(),action,payload);end $$;
revoke all on function fmz_accounting.vat_preview(text,jsonb) from public,anon;
grant execute on function fmz_accounting.vat_preview(text,jsonb) to authenticated;
create function public.fmz_vat_preview(action text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select fmz_accounting.vat_preview(action,payload)$$;
revoke all on function public.fmz_vat_preview(text,jsonb) from public,anon;
grant execute on function public.fmz_vat_preview(text,jsonb) to authenticated;

create function fmz_accounting.vat_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare oid uuid;rid uuid;bid uuid;hash text;body jsonb;plan jsonb;result jsonb;items jsonb;before_value jsonb;receipt fmz_accounting.receipts;p fmz_accounting.records;s fmz_accounting.records;b fmz_accounting.records;r fmz_accounting.records;
begin
 oid:=fmz_accounting.owner_org();if request_id is null or jsonb_typeof(payload) is distinct from 'object' or pg_column_size(payload)>2000000 then raise exception 'Ongeldig btw-verzoek' using errcode='22023';end if;
 perform 1 from fmz_accounting.organizations where id=oid for update;
 hash:=md5('vat:'||action||':'||payload::text);select * into receipt from fmz_accounting.receipts where org_id=oid and receipts.request_id=vat_command.request_id;
 if found then if receipt.payload_hash<>hash then raise exception 'Verzoeknummer hoort bij andere invoer' using errcode='PT409';end if;return receipt.result;end if;
 body:=payload->'data';plan:=fmz_accounting.vat_plan(oid,action,body);
 if payload->'expected' is distinct from plan then raise exception 'De administratie is gewijzigd. Ververs en controleer het voorstel opnieuw.' using errcode='PT409';end if;
 if payload->>'confirmed' is distinct from 'true' then raise exception 'Bevestig eerst het getoonde effect' using errcode='22023';end if;
 rid:=(payload->>'id')::uuid;if rid is null then raise exception 'Aanvraagidentiteit ontbreekt' using errcode='22023';end if;
 if action='period' then
  if plan->>'period_id' is null then r:=fmz_accounting.add_record(oid,rid,'vat_period',(body->>'to')::date,body||jsonb_build_object('basis',plan->'basis'),case when body->>'filed'='true' then 'filed' else 'draft' end);
  else
   select * into p from fmz_accounting.records where org_id=oid and id=(plan->>'period_id')::uuid;before_value:=to_jsonb(p);
   update fmz_accounting.records set version=version+1,status=case when body->>'filed'='true' then 'filed' else 'draft' end,data=body||jsonb_build_object('basis',plan->'basis','history',coalesce(p.data->'history','[]')||jsonb_build_array(jsonb_build_object('at',now(),'previous',p.data-'history','status',p.status))) where org_id=oid and id=p.id returning * into r;
  end if;result:=jsonb_build_object('period_id',r.id,'version',r.version);
 elsif action='settle' then
  bid:=(body->>'bank_id')::uuid;
  if bid is null then bid:=gen_random_uuid();perform fmz_accounting.bank(oid,bid,jsonb_build_object('account_id',body->>'account_id','date',body->>'date','cents',-(plan->>'signed_cents')::bigint,'description','Btw '||(body->>'reference')||' — '||coalesce(body->>'description',''),'entry_origin','vat_payment','vat_settlement_id',rid,'distinct_receipt_reason',body->>'distinct_receipt_reason','cash_negative_confirmed',body->'cash_negative_confirmed'));end if;
  insert into fmz_accounting.accounts(org_id,code,name,category) values(oid,'1850','Betalingen en teruggaven omzetbelasting','liability') on conflict(org_id,code) do nothing;
  if not exists(select 1 from fmz_accounting.accounts where org_id=oid and code='1850' and category='liability') then raise exception 'Btw-tussenrekening heeft een afwijkende inrichting' using errcode='22023';end if;
  r:=fmz_accounting.add_record(oid,rid,'vat_settlement',(body->>'date')::date,body||jsonb_build_object('bank_id',bid,'signed_cents',plan->'signed_cents'),'posted',(body->>'period_id')::uuid);
  perform fmz_accounting.post(oid,rid,r.date,'Btw-betaling of teruggaaf: '||(body->>'reference'),jsonb_build_array(jsonb_build_array('1400',-(plan->>'signed_cents')::bigint,bid),jsonb_build_array('1850',(plan->>'signed_cents')::bigint,r.parent_id)));
  result:=jsonb_build_object('settlement_id',rid,'bank_id',bid,'period_id',r.parent_id);
 elsif action='correct' then
  select * into s from fmz_accounting.records where org_id=oid and id=(plan->>'settlement_id')::uuid;before_value:=to_jsonb(s);select * into b from fmz_accounting.records where org_id=oid and id=(plan->>'bank_id')::uuid;
  r:=fmz_accounting.add_record(oid,rid,'correction',s.date,jsonb_build_object('vat_reversal',true,'settlement_id',s.id,'period_id',s.parent_id,'bank_id',b.id,'reason',body->>'reason','cleared_bank',body->>'mode'='reverse','signed_cents',s.data->'signed_cents'),'posted',s.id);
  select jsonb_agg(jsonb_build_array(l.account_code,-l.cents,l.reference_id) order by j.id,l.line_no) into items from fmz_accounting.lines l join fmz_accounting.journals j on j.org_id=l.org_id and j.id=l.journal_id where l.org_id=oid and j.record_id=s.id;
  perform fmz_accounting.post(oid,rid,s.date,'Correctie btw-koppeling: '||(body->>'reason'),items);
  update fmz_accounting.records set status='reversed',version=version+1,data=data||jsonb_build_object('correction_id',rid) where org_id=oid and id=s.id;
  if body->>'mode'='reverse' then
   select jsonb_agg(jsonb_build_array(l.account_code,-l.cents,l.reference_id) order by j.id,l.line_no) into items from fmz_accounting.lines l join fmz_accounting.journals j on j.org_id=l.org_id and j.id=l.journal_id where l.org_id=oid and j.record_id=b.id;
   perform fmz_accounting.post(oid,rid,b.date,'Correctie foutief ingevoerde btw-bankmutatie',items);
   update fmz_accounting.records set status='reversed',version=version+1,data=data||jsonb_build_object('vat_correction_id',rid) where org_id=oid and id=b.id;
  end if;result:=jsonb_build_object('correction_id',rid,'settlement_id',s.id,'bank_id',b.id,'period_id',s.parent_id,'keeps_bank',plan->'keeps_bank');
 elsif action='attach_source' then
  select * into b from fmz_accounting.records where org_id=oid and id=(body->>'bank_id')::uuid;before_value:=to_jsonb(b);
  update fmz_accounting.records set source_key=body->>'source_key',version=version+1,data=data||jsonb_build_object('previous_source_key',b.source_key,'bank_evidence_id',body->>'file_id','external_reference',body->>'external_reference') where org_id=oid and id=b.id;
  result:=jsonb_build_object('bank_id',b.id,'file_id',body->>'file_id','source_attached',true,'no_new_receipt',true);
 end if;
 insert into fmz_accounting.audit(org_id,actor_id,action,request_id,detail) values(oid,auth.uid(),'vat_'||action,vat_command.request_id,jsonb_build_object('before',before_value,'after',result,'proposal',plan));
 insert into fmz_accounting.receipts values(oid,vat_command.request_id,hash,result,now());return result;
end $$;
revoke all on function fmz_accounting.vat_command(text,jsonb,uuid) from public,anon;
grant execute on function fmz_accounting.vat_command(text,jsonb,uuid) to authenticated;
create function public.fmz_vat_command(action text,payload jsonb,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_accounting.vat_command(action,payload,request_id)$$;
revoke all on function public.fmz_vat_command(text,jsonb,uuid) from public,anon;
grant execute on function public.fmz_vat_command(text,jsonb,uuid) to authenticated;

create function fmz_accounting.guard_vat_bank() returns trigger language plpgsql set search_path='' as $$
begin
 if new.kind='bank' then
  if tg_op='UPDATE' and new.status='reversed' and exists(select 1 from fmz_accounting.records where org_id=new.org_id and kind='vat_settlement' and status='posted' and data->>'bank_id'=new.id::text) then raise exception 'Deze bankmutatie hoort bij een btw-betaling. Herstel eerst die koppeling via Btw.' using errcode='PT409';end if;
  if tg_op='INSERT' and new.data->>'entry_origin' is distinct from 'vat_payment' and exists(select 1 from fmz_accounting.records where org_id=new.org_id and kind='bank' and status='posted' and data->>'entry_origin'='vat_payment' and date=new.date and data->>'account_id'=new.data->>'account_id' and (data->>'cents')::bigint=(new.data->>'cents')::bigint) and length(trim(coalesce(new.data->>'distinct_receipt_reason','')))<10 then raise exception 'Er staat al een mogelijke btw-bankmutatie. Controleer de bestaande ontvangst/uitgave; maak geen dubbele invoer.' using errcode='PT409';end if;
 end if;return new;
end $$;
revoke all on function fmz_accounting.guard_vat_bank() from public,anon,authenticated;
create trigger fmz_accounting_vat_bank before insert or update on fmz_accounting.records for each row execute function fmz_accounting.guard_vat_bank();
commit;

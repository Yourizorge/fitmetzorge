-- Additive billing agreements. No historical invoice, workspace, number or PDF is changed.
begin;
create table fmz_accounting.agreement_versions (
 org_id uuid not null references fmz_accounting.organizations(id), id uuid not null default gen_random_uuid(),
 client_id text not null, version integer not null check(version>0), previous_id uuid,
 effective_from date not null, cycle text not null check(cycle in ('calendar_month','four_weeks','none')),
 package_id text not null, package_label text not null, amount_cents bigint not null check(amount_cents between 0 and 900000000000),
 sessions integer not null default 0 check(sessions>=0), enabled boolean not null, origin text not null,
 reason text not null, created_at timestamptz not null default now(), created_by uuid not null references auth.users(id),
 primary key(org_id,id), unique(org_id,client_id,version), foreign key(org_id,previous_id) references fmz_accounting.agreement_versions(org_id,id),
 check(cycle<>'calendar_month' or extract(day from effective_from)=1)
);
create index agreement_versions_client_date on fmz_accounting.agreement_versions(org_id,client_id,effective_from desc,version desc);
alter table fmz_accounting.agreement_versions enable row level security;
revoke all on fmz_accounting.agreement_versions from public,anon,authenticated;

create function fmz_accounting.billing_catalog(pid text) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',id,'label',label,'cents',cents,'sessions',sessions,'recurring',recurring) from (values
 ('pt-basis','Personal training Basis',20000,4,true),('pt-progressie','Personal training Progressie',38000,8,true),
 ('pt-transformatie','Personal training Transformatie',48000,12,true),('online-coaching','Online coaching',20000,0,true),
 ('duo-basis','Duo Basis',26000,4,true),('duo-progressie','Duo Progressie',52000,8,true),('duo-transformatie','Duo Transformatie',78000,12,true),
 ('single-session','Losse training',5500,1,false),('ten-sessions','Strippenkaart 10 trainingen',52000,10,false)
 ) as p(id,label,cents,sessions,recurring) where id=pid
$$;
create function fmz_accounting.billing_period(v fmz_accounting.agreement_versions, at_date date) returns jsonb language plpgsql immutable set search_path='' as $$
declare first_date date; last_date date;
begin
 if at_date is null or at_date<v.effective_from then raise exception 'De overeenkomst is nog niet ingegaan';end if;
 if v.cycle='calendar_month' then first_date:=date_trunc('month',at_date)::date;last_date:=(first_date+interval '1 month - 1 day')::date;
 elsif v.cycle='four_weeks' then first_date:=v.effective_from+((at_date-v.effective_from)/28)*28;last_date:=first_date+27;
 else first_date:=v.effective_from;last_date:=first_date;end if;
 return jsonb_build_object('start',first_date,'end',last_date,'invoiceDate',last_date,'nextStart',case when v.cycle<>'none' then last_date+1 end);
end $$;
create function fmz_accounting.billing_metadata(v fmz_accounting.agreement_versions, p jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('agreementVersionId',v.id,'agreementVersion',v.version,'clientId',v.client_id,'packageId',v.package_id,'packageLabel',v.package_label,
 'cycle',v.cycle,'effectiveFrom',v.effective_from,'start',p->>'start','end',p->>'end','invoiceDate',p->>'invoiceDate','amountCents',v.amount_cents)
$$;

-- Registration is an administrator-only step with a separately reviewed client mapping.
-- No inference of payment cycle from a package label, and no backdating of invoices.
create function fmz_accounting.billing_register_legacy(oid uuid,cid text,invoice_enabled boolean,from_date date) returns jsonb language plpgsql set search_path='' as $$
declare c jsonb;p jsonb;v fmz_accounting.agreement_versions;owner_user uuid;pid text;
begin
 select owner_id into owner_user from fmz_accounting.organizations where id=oid for update;
 if owner_user is null or invoice_enabled is null or from_date is null or extract(day from from_date)<>1 then raise exception 'Controleer bestaande afspraak';end if;
 if exists(select 1 from fmz_accounting.agreement_versions where org_id=oid and client_id=cid) then raise exception 'Afspraak is al geregistreerd';end if;
 select item into c from public.coach_workspaces w cross join lateral jsonb_array_elements(w.state->'clients') item where w.trainer_id=owner_user and item->>'id'=cid;
 pid:=coalesce(nullif(c#>>'{profile,package}',''),c->>'package');p:=fmz_accounting.billing_catalog(pid);
 if p is null or not (p->>'recurring')::boolean then raise exception 'Bestaand pakket moet afzonderlijk worden gecontroleerd';end if;
 insert into fmz_accounting.agreement_versions(org_id,client_id,version,effective_from,cycle,package_id,package_label,amount_cents,sessions,enabled,origin,reason,created_by)
 values(oid,cid,1,from_date,'calendar_month',pid,p->>'label',(p->>'cents')::bigint,(p->>'sessions')::integer,invoice_enabled,'legacy_registration','Bestaande afspraak bevestigd door owner; oorspronkelijke klant en factuurhistorie blijven ongewijzigd',owner_user) returning * into v;
 insert into fmz_accounting.audit(org_id,actor_id,action,detail) values(oid,owner_user,'billing_legacy_registration',jsonb_build_object('agreement',to_jsonb(v)));
 return to_jsonb(v);
end $$;

create function fmz_accounting.billing_guard_invoice() returns trigger language plpgsql security definer set search_path='' as $$
declare v fmz_accounting.agreement_versions;chosen uuid;p jsonb;b jsonb;orig jsonb;first_date date;last_date date;
begin
 if new.kind<>'invoice' then return new;end if;
 -- Historic document snapshots, including their original layout, are never rewritten.
 if tg_op='UPDATE' and old.status='posted' then
  if new.data->'document' is distinct from old.data->'document' then raise exception 'Definitieve factuur is onveranderlijk' using errcode='PT409';end if;
  return new;
 end if;
 if nullif(new.data->>'credit_of','') is not null then
  select data#>'{document,billing}' into orig from fmz_accounting.records where org_id=new.org_id and id=(new.data->>'credit_of')::uuid and status='posted';
  if orig is not null then new.data:=new.data||jsonb_build_object('billing',orig);if new.status='posted' then new.data:=jsonb_set(new.data,'{document,billing}',orig);end if;end if;
  return new;
 end if;
 b:=new.data->'billing';
 if b is null then
  if tg_op='UPDATE' and old.data ? 'billing' then raise exception 'Serviceperiode mag niet worden verwijderd' using errcode='PT409';end if;
  return new;
 end if;
 perform 1 from fmz_accounting.organizations where id=new.org_id for update;
 select * into v from fmz_accounting.agreement_versions where org_id=new.org_id and id=(b->>'agreementVersionId')::uuid;
 if v.id is null or not v.enabled or v.client_id is distinct from new.data->>'client_id' then raise exception 'Geen actieve factureerbare afspraak voor deze klant' using errcode='PT409';end if;
 first_date:=(b->>'start')::date;last_date:=(b->>'end')::date;p:=fmz_accounting.billing_period(v,first_date);
 select id into chosen from fmz_accounting.agreement_versions where org_id=new.org_id and client_id=v.client_id and effective_from<=first_date order by effective_from desc,version desc limit 1;
 if chosen is distinct from v.id or first_date is distinct from (p->>'start')::date or last_date is distinct from (p->>'end')::date or exists(select 1 from fmz_accounting.agreement_versions where org_id=new.org_id and client_id=v.client_id and effective_from>first_date and effective_from<=last_date) then
  raise exception 'Overeenkomst of serviceperiode is gewijzigd. Open het juiste periodeconcept.' using errcode='PT409';end if;
 if tg_op='UPDATE' and old.data ? 'billing' and (old.data->'billing') is distinct from fmz_accounting.billing_metadata(v,p) then raise exception 'Open voor een andere periode een afzonderlijk concept' using errcode='PT409';end if;
 if exists(select 1 from fmz_accounting.records r where r.org_id=new.org_id and r.kind='invoice' and r.id<>new.id and r.parent_id is null and nullif(r.data->>'credit_of','') is null and r.data#>>'{billing,clientId}'=v.client_id and (r.data#>>'{billing,start}')::date<=last_date and (r.data#>>'{billing,end}')::date>=first_date) then
  raise exception 'Er bestaat al een factuur of concept voor deze serviceperiode' using errcode='PT409';end if;
 b:=fmz_accounting.billing_metadata(v,p);new.source_key:='billing:'||v.client_id||':'||first_date||':'||last_date;
 new.data:=new.data||jsonb_build_object('billing',b,'packageLabel',v.package_label);
 if new.status='posted' then new.data:=jsonb_set(new.data,'{document,billing}',b);new.data:=jsonb_set(new.data,'{document,packageLabel}',to_jsonb(v.package_label));end if;
 return new;
end $$;
create trigger billing_invoice_guard before insert or update on fmz_accounting.records for each row execute function fmz_accounting.billing_guard_invoice();

create function fmz_accounting.billing_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid;body jsonb;cid text;v fmz_accounting.agreement_versions;previous fmz_accounting.agreement_versions;p jsonb;catalog jsonb;chosen_date date;
 receipt fmz_accounting.receipts;hash text;result jsonb;r fmz_accounting.records;source_client jsonb;settings jsonb;raw jsonb;rid uuid;description_text text;
begin
 oid:=fmz_accounting.owner_org();
 if request_id is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>100000 then raise exception 'Ongeldige aanvraag';end if;
 perform 1 from fmz_accounting.organizations where id=oid for update;
 hash:=md5('billing:'||action||':'||payload::text);
 select * into receipt from fmz_accounting.receipts where org_id=oid and receipts.request_id=billing_command.request_id;
 if found then if receipt.payload_hash<>hash then raise exception 'Aanvraag-ID is al gebruikt' using errcode='PT409';end if;return receipt.result;end if;
 perform fmz_accounting.check_numbers(payload);cid:=payload->>'client_id';
 select c into source_client from public.coach_workspaces w cross join lateral jsonb_array_elements(w.state->'clients') c where w.trainer_id=auth.uid() and c->>'id'=cid;
 if source_client is null then raise exception 'Klant behoort niet tot jouw administratie' using errcode='42501';end if;
 if action='save_agreement' then
  select * into previous from fmz_accounting.agreement_versions where org_id=oid and client_id=cid order by version desc limit 1;
  if coalesce(previous.version,0) is distinct from (payload->>'expected_version')::integer then raise exception 'Afspraak elders gewijzigd. Ververs en controleer opnieuw.' using errcode='PT409';end if;
  chosen_date:=(payload->>'effective_from')::date;catalog:=fmz_accounting.billing_catalog(payload->>'package_id');
  if chosen_date is null or chosen_date<current_date or catalog is null or payload->>'cycle' not in ('calendar_month','four_weeks','none') or payload->>'cycle' is null or payload->>'confirmed' is distinct from 'true' or jsonb_typeof(payload->'enabled') is distinct from 'boolean' then raise exception 'Controleer pakket, betaalperiode, ingangsdatum en samenvatting';end if;
  if ((catalog->>'recurring')::boolean and payload->>'cycle'='none') or (not (catalog->>'recurring')::boolean and payload->>'cycle'<>'none') then raise exception 'Losse training en strippenkaart hebben geen terugkerende betaalperiode';end if;
  if payload->>'cycle'='calendar_month' and extract(day from chosen_date)<>1 then raise exception 'Een kalendermaand begint op de eerste dag van de maand';end if;
  if previous.id is not null then
   if chosen_date<=previous.effective_from then raise exception 'Kies een ingangsdatum na de vorige afspraak' using errcode='PT409';end if;
   if previous.enabled and previous.cycle<>'none' then p:=fmz_accounting.billing_period(previous,chosen_date-1);if (p->>'end')::date<>chosen_date-1 then raise exception 'Kies een aansluitende periodegrens; geen halve periodes of overlap' using errcode='PT409';end if;end if;
   if exists(select 1 from fmz_accounting.records where org_id=oid and kind='invoice' and data#>>'{billing,clientId}'=cid and (data#>>'{billing,end}')::date>=chosen_date) then raise exception 'Vanaf deze datum bestaat al een concept of factuur. Kies een latere vrije periode.' using errcode='PT409';end if;
  end if;
  insert into fmz_accounting.agreement_versions(org_id,client_id,version,previous_id,effective_from,cycle,package_id,package_label,amount_cents,sessions,enabled,origin,reason,created_by)
  values(oid,cid,coalesce(previous.version,0)+1,previous.id,chosen_date,payload->>'cycle',catalog->>'id',catalog->>'label',(catalog->>'cents')::bigint,(catalog->>'sessions')::integer,(payload->>'enabled')::boolean,'owner_confirmation',coalesce(payload->>'reason',''),auth.uid()) returning * into v;
  result:=to_jsonb(v);
 elsif action='prepare_invoice' then
  chosen_date:=(payload->>'at_date')::date;
  select * into v from fmz_accounting.agreement_versions where org_id=oid and client_id=cid and effective_from<=chosen_date order by effective_from desc,version desc limit 1;
  if v.id is null or not v.enabled then raise exception 'Voor deze datum is geen factureerbare klantafspraak vastgelegd';end if;
  p:=fmz_accounting.billing_period(v,chosen_date);
  select * into r from fmz_accounting.records where org_id=oid and kind='invoice' and source_key='billing:'||cid||':'||(p->>'start')||':'||(p->>'end');
  if r.id is not null then result:=to_jsonb(r);
  else
   if nullif(payload->>'adopt_draft','') is not null then
    select * into r from fmz_accounting.records where org_id=oid and id=(payload->>'adopt_draft')::uuid and kind='invoice' and status='draft' and data->>'client_id'=cid and not(data ? 'billing') and nullif(data->>'credit_of','') is null;
    if r.id is null then raise exception 'Het gekozen concept is niet meer beschikbaar' using errcode='PT409';end if;
    if exists(select 1 from fmz_accounting.records other where other.org_id=oid and other.id<>r.id and other.kind='invoice' and other.parent_id is null and nullif(other.data->>'credit_of','') is null and other.data->>'client_id'=cid and not(other.data ? 'billing') and other.date between (p->>'start')::date and (p->>'end')::date) then raise exception 'Er is nog een bestaande factuur in deze periode. Controleer deze eerst.' using errcode='PT409';end if;
    update fmz_accounting.records set data=data||jsonb_build_object('billing',fmz_accounting.billing_metadata(v,p)),version=version+1 where org_id=oid and id=r.id returning * into r;
    result:=to_jsonb(r);
   else
   if exists(select 1 from fmz_accounting.records where org_id=oid and kind='invoice' and parent_id is null and nullif(data->>'credit_of','') is null and data->>'client_id'=cid and not(data ? 'billing') and date between (p->>'start')::date and (p->>'end')::date) then raise exception 'Bestaand concept of factuur zonder vastgelegde serviceperiode gevonden. Controleer dit eerst om dubbel factureren te voorkomen.' using errcode='PT409';end if;
   select data into settings from fmz_accounting.records where org_id=oid and kind='settings' and status='confirmed' and date<=(p->>'invoiceDate')::date order by date desc,created_at desc limit 1;
   description_text:=v.package_label||case when v.cycle='four_weeks' then ' - periode van '||to_char((p->>'start')::date,'DD-MM-YYYY')||' t/m '||to_char((p->>'end')::date,'DD-MM-YYYY')||' - per 4 weken' when v.cycle='calendar_month' then ' - kalendermaand '||(array['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'])[extract(month from (p->>'start')::date)::integer]||' '||extract(year from (p->>'start')::date)::integer else '' end;
   raw:=jsonb_build_object('description',description_text,'amount',v.amount_cents::numeric/100,'unitPrice',v.amount_cents::numeric/100,'quantity','1','discount','0','discountNote','','discountMode','fixed','discountPercent','0','priceMode','inclusive','extraLines','[]'::jsonb,
   'date',p->>'invoiceDate','term',coalesce(settings->>'paymentTermDays','14'),'serviceDate',p->>'end','serviceExtent',case when v.sessions>0 then v.sessions||' trainingen' else 'Coaching' end,'period',(p->>'start')||' t/m '||(p->>'end'),'reference','',
   'customerName',source_client->>'name','customerEmail',source_client->>'email','customerAddress',concat_ws(', ',nullif(source_client#>>'{profile,address}',''),nullif(source_client#>>'{profile,postalCode}',''),nullif(source_client#>>'{profile,city}','')));
   body:=jsonb_build_object('raw',raw,'date',p->>'invoiceDate','client_id',cid,'packageLabel',v.package_label,'billing',fmz_accounting.billing_metadata(v,p),'customer',jsonb_build_object('name',raw->>'customerName','email',raw->>'customerEmail','address',raw->>'customerAddress'),'description',description_text,'service_date',p->>'end','service_extent',raw->>'serviceExtent','quantity',1,'gross_cents',v.amount_cents,'discount_cents',0,'term_days',(raw->>'term')::integer);
   r:=fmz_accounting.add_record(oid,gen_random_uuid(),'invoice',(p->>'invoiceDate')::date,body,'draft');result:=to_jsonb(r);
   end if;
  end if;
 else raise exception 'Onbekende afspraakhandeling';end if;
 insert into fmz_accounting.audit(org_id,actor_id,action,request_id,detail) values(oid,auth.uid(),'billing_'||action,request_id,jsonb_build_object('before',to_jsonb(previous),'after',result));
 insert into fmz_accounting.receipts values(oid,request_id,hash,result,now());return result;
end $$;

create or replace function fmz_accounting.snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid;
begin
 oid:=fmz_accounting.owner_org();
 return jsonb_build_object(
 'organization',(select to_jsonb(o)-'test_marker' from fmz_accounting.organizations o where id=oid),
 'accounts',(select coalesce(jsonb_agg(to_jsonb(a) order by code),'[]') from fmz_accounting.accounts a where org_id=oid),
 'records',(select coalesce(jsonb_agg(to_jsonb(r) order by date,created_at,id),'[]') from fmz_accounting.records r where org_id=oid),
 'journals',(select coalesce(jsonb_agg(to_jsonb(j) order by date,created_at,id),'[]') from fmz_accounting.journals j where org_id=oid),
 'lines',(select coalesce(jsonb_agg(to_jsonb(l) order by journal_id,line_no),'[]') from fmz_accounting.lines l where org_id=oid),
 'files',(select coalesce(jsonb_agg(to_jsonb(f) order by created_at,id),'[]') from fmz_accounting.files f where org_id=oid),
 'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from fmz_accounting.audit a where org_id=oid),
 'agreements',(select coalesce(jsonb_agg(to_jsonb(v) order by client_id,version),'[]') from fmz_accounting.agreement_versions v where org_id=oid));
end $$;
create function public.fmz_billing_command(action text,payload jsonb,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_accounting.billing_command(action,payload,request_id)$$;
revoke all on function fmz_accounting.billing_catalog(text),fmz_accounting.billing_period(fmz_accounting.agreement_versions,date),fmz_accounting.billing_metadata(fmz_accounting.agreement_versions,jsonb),fmz_accounting.billing_register_legacy(uuid,text,boolean,date),fmz_accounting.billing_guard_invoice(),fmz_accounting.billing_command(text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.fmz_billing_command(text,jsonb,uuid) from public,anon;
grant execute on function fmz_accounting.billing_command(text,jsonb,uuid),public.fmz_billing_command(text,jsonb,uuid) to authenticated;
commit;

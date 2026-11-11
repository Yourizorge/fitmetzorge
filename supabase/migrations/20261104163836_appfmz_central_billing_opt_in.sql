-- Additive, explicitly enabled central cycle. No anchor and no member backfill are seeded.
-- Existing invoices, agreements, ledger lines and files are untouched.
begin;
create table fmz_accounting.central_cycle_versions (
 org_id uuid not null references fmz_accounting.organizations(id), id uuid not null default gen_random_uuid(),
 version integer not null check(version>0), enabled boolean not null default false,
 base_date date, time_zone text not null default 'Europe/Amsterdam' check(time_zone='Europe/Amsterdam'),
 credit_policy text, invoice_policy text not null default 'arrears_only' check(invoice_policy='arrears_only'),
 reason text not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 primary key(org_id,id),unique(org_id,version),
 check(not enabled or (base_date is not null and length(btrim(credit_policy)) between 3 and 1000))
);
create table fmz_accounting.central_agreement_snapshots (
 org_id uuid not null, agreement_id uuid not null, config_id uuid not null, client_id text not null,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'), created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(org_id,agreement_id),
 foreign key(org_id,agreement_id) references fmz_accounting.agreement_versions(org_id,id),
 foreign key(org_id,config_id) references fmz_accounting.central_cycle_versions(org_id,id)
);
create index central_agreement_client on fmz_accounting.central_agreement_snapshots(org_id,client_id);
create table fmz_accounting.central_task_completions (
 org_id uuid not null,config_id uuid not null,period_index integer not null check(period_index>=0),
 kind text not null check(kind in ('billing_prepare','billing_due')),version integer not null default 1 check(version>0),
 completed_at timestamptz not null default now(),completed_by uuid not null references auth.users(id),
 primary key(org_id,config_id,period_index,kind),foreign key(org_id,config_id) references fmz_accounting.central_cycle_versions(org_id,id)
);
create function fmz_accounting.central_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Vastgelegde cyclus en eerste periode blijven onveranderlijk' using errcode='PT409';end$$;
create trigger central_config_immutable before update or delete on fmz_accounting.central_cycle_versions for each row execute function fmz_accounting.central_immutable();
create trigger central_snapshot_immutable before update or delete on fmz_accounting.central_agreement_snapshots for each row execute function fmz_accounting.central_immutable();
create trigger central_completion_immutable before update or delete on fmz_accounting.central_task_completions for each row execute function fmz_accounting.central_immutable();
do $$declare t text;begin foreach t in array array['central_cycle_versions','central_agreement_snapshots','central_task_completions'] loop execute format('alter table fmz_accounting.%I enable row level security',t);execute format('revoke all on fmz_accounting.%I from public,anon,authenticated',t);end loop;end$$;

create function fmz_accounting.central_quote(oid uuid,start_date date,full_cents bigint,full_sessions integer default null) returns jsonb language plpgsql stable set search_path='' as $$
declare c fmz_accounting.central_cycle_versions;first_date date;boundary date;days_left integer;amount bigint;
begin
 select * into c from fmz_accounting.central_cycle_versions where org_id=oid order by version desc limit 1;
 if c.id is null or not c.enabled then return jsonb_build_object('enabled',false,'reason','Gezamenlijke basisdatum en beleid voor trainingen in een deelperiode zijn nog niet actief vastgelegd.');end if;
 if start_date is null or start_date<c.base_date or full_cents is null or full_cents<0 or full_cents>900000000000 then raise exception 'Controleer startdatum en pakketbedrag' using errcode='22023';end if;
 first_date:=c.base_date+((start_date-c.base_date)/28)*28;boundary:=first_date+28;days_left:=boundary-start_date;
 amount:=floor((full_cents::numeric*days_left+14)/28)::bigint;
 return jsonb_build_object('enabled',true,'configId',c.id,'configVersion',c.version,'baseDate',c.base_date,'timeZone',c.time_zone,'days',28,'startDate',start_date,
 'currentCycle',jsonb_build_object('start',first_date,'end',boundary-1,'endExclusive',boundary,'invoiceDate',boundary),
 'remainingDays',days_left,'firstPartial',days_left<28,'firstAmountCents',amount,'fullAmountCents',full_cents,'firstInvoiceDate',boundary,'nextPeriodStart',boundary,'nextInvoiceDate',boundary+28,
 'fullSessions',full_sessions,'creditsResolved',full_sessions is not null and mod(full_sessions*days_left,28)=0,'firstSessions',case when full_sessions is not null and mod(full_sessions*days_left,28)=0 then full_sessions*days_left/28 end,'creditPolicy',c.credit_policy,'invoicePolicy',c.invoice_policy,'rounding','half_up_final_cents');
end$$;
create function fmz_accounting.attach_central_agreement(oid uuid,agreement_uuid uuid,expected_quote jsonb) returns jsonb language plpgsql set search_path='' as $$
declare v fmz_accounting.agreement_versions;q jsonb;old jsonb;
begin
 if oid is distinct from fmz_accounting.owner_org() then raise exception 'Owner vereist' using errcode='42501';end if;
 perform 1 from fmz_accounting.organizations where id=oid for update;
 select snapshot into old from fmz_accounting.central_agreement_snapshots where org_id=oid and agreement_id=agreement_uuid;
 if old is not null then if old is distinct from expected_quote then raise exception 'Eerste periode is al anders vastgelegd' using errcode='PT409';end if;return old;end if;
 select * into v from fmz_accounting.agreement_versions where org_id=oid and id=agreement_uuid;
 if v.id is null or v.cycle<>'four_weeks' or v.origin<>'signed_enrollment' or not v.enabled then raise exception 'Alleen een nieuwe ondertekende vierwekenovereenkomst kan aansluiten' using errcode='22023';end if;
 if exists(select 1 from fmz_accounting.records where org_id=oid and kind='invoice' and data->>'client_id'=v.client_id) or exists(select 1 from fmz_accounting.agreement_versions where org_id=oid and client_id=v.client_id and id<>v.id) then raise exception 'Bestaande betaalafspraken worden niet automatisch omgezet' using errcode='PT409';end if;
 q:=fmz_accounting.central_quote(oid,v.effective_from,v.amount_cents,v.sessions);
 if q->>'enabled' is distinct from 'true' then raise exception 'Gezamenlijke cyclus nog niet vrijgegeven' using errcode='PT409';end if;
 if q->>'creditsResolved' is distinct from 'true' then raise exception 'Afronding van het aantal trainingen vereist eerst een expliciete afspraak' using errcode='PT409';end if;
 if q is distinct from expected_quote then raise exception 'Cyclus of prijs gewijzigd; controleer en onderteken opnieuw' using errcode='PT409';end if;
 insert into fmz_accounting.central_agreement_snapshots(org_id,agreement_id,config_id,client_id,snapshot,created_by) values(oid,v.id,(q->>'configId')::uuid,v.client_id,q,auth.uid());
 return q;
end$$;
create function fmz_accounting.central_task_read(from_date date,to_date date) returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid;c fmz_accounting.central_cycle_versions;rows jsonb;now_date date:=(current_timestamp at time zone 'Europe/Amsterdam')::date;
begin
 oid:=fmz_accounting.owner_org();
 select * into c from fmz_accounting.central_cycle_versions where org_id=oid order by version desc limit 1;
 if c.id is null or not c.enabled then return jsonb_build_object('enabled',false,'config',null,'tasks','[]'::jsonb,'reason','Gezamenlijke basisdatum en beleid voor trainingen in een deelperiode zijn nog niet actief vastgelegd.');end if;
 if from_date is null or to_date is null or to_date<from_date or to_date-from_date>3660 or to_date>c.base_date+3660 then raise exception 'Kies maximaal tien kalenderjaren vanaf de cyclusbasis' using errcode='22023';end if;
 with periods as(select n,c.base_date+n*28 start,c.base_date+(n+1)*28 boundary from generate_series(0,greatest(0,(to_date-c.base_date)/28)) n),
 tasks as(select p.*,kind,case when kind='billing_prepare' then boundary-7 else boundary end task_date from periods p cross join (values('billing_prepare'),('billing_due')) k(kind)),
 eligible as(select t.*,done.completed_at,done.version,case when done.completed_at is not null then 'done' when t.task_date<now_date then 'overdue' else 'open' end status
 from tasks t left join fmz_accounting.central_task_completions done on done.org_id=oid and done.config_id=c.id and done.period_index=t.n and done.kind=t.kind
 where t.task_date<=to_date and (t.task_date>=from_date or (done.completed_at is null and t.task_date<now_date)))
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id::text||':'||t.n||':'||t.kind,'configId',c.id,'configVersion',c.version,'periodIndex',t.n,'version',coalesce(t.version,0),'date',t.task_date,'kind',t.kind,
 'text',case when t.kind='billing_prepare' then 'Facturen maken' else 'Facturen versturen' end,'cycleStart',t.start,'cycleEnd',t.boundary-1,'invoiceDate',t.boundary,'timeZone','Europe/Amsterdam','status',t.status,'completedAt',t.completed_at,
 'items',coalesce((select jsonb_agg(jsonb_build_object('clientId',v.client_id,'packageLabel',v.package_label,'agreementId',v.id,'start',greatest(v.effective_from,t.start),'end',t.boundary-1,
 'amountCents',case when v.effective_from>=t.start then (s.snapshot->>'firstAmountCents')::bigint else v.amount_cents end,'firstPartial',v.effective_from>t.start,'prorataDays',t.boundary-greatest(v.effective_from,t.start)))
 from fmz_accounting.central_agreement_snapshots s join fmz_accounting.agreement_versions v on v.org_id=s.org_id and v.id=s.agreement_id
 where s.org_id=oid and s.config_id=c.id and v.enabled and v.effective_from<t.boundary and not exists(select 1 from fmz_accounting.agreement_versions next where next.org_id=oid and next.client_id=v.client_id and next.effective_from>v.effective_from and next.effective_from<t.boundary)),'[]'::jsonb)) order by t.task_date,t.kind),'[]'::jsonb) into rows from eligible t;
 return jsonb_build_object('enabled',true,'config',jsonb_build_object('id',c.id,'version',c.version,'baseDate',c.base_date,'timeZone',c.time_zone,'creditPolicy',c.credit_policy,'invoicePolicy',c.invoice_policy),'tasks',rows);
end$$;
create function fmz_accounting.central_task_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid;c fmz_accounting.central_cycle_versions;r fmz_accounting.receipts;result jsonb;fingerprint text;current_version integer;task_index integer;task_kind text;done fmz_accounting.central_task_completions;
begin
 oid:=fmz_accounting.owner_org();if request_id is null or jsonb_typeof(payload) is distinct from 'object' or pg_column_size(payload)>10000 then raise exception 'Ongeldig verzoek' using errcode='22023';end if;
 perform 1 from fmz_accounting.organizations where id=oid for update;fingerprint:=md5('central-cycle:'||action||':'||payload::text);
 select * into r from fmz_accounting.receipts where org_id=oid and receipts.request_id=central_task_command.request_id;
 if found then if r.payload_hash is distinct from fingerprint then raise exception 'Verzoek-ID hergebruikt voor andere inhoud' using errcode='PT409';end if;return r.result;end if;
 select * into c from fmz_accounting.central_cycle_versions where org_id=oid order by version desc limit 1;current_version:=coalesce(c.version,0);
 if action='configure' then
  if (payload->>'expected_version')::integer is distinct from current_version then raise exception 'Cyclusconfiguratie is gewijzigd; ververs' using errcode='PT409';end if;
  if payload->>'confirmed' is distinct from 'true' or payload->>'enabled' is distinct from 'true' or payload->>'invoice_policy' is distinct from 'arrears_only' or payload->>'credit_policy' is distinct from 'pro_rata_exact' or length(btrim(coalesce(payload->>'reason','')))<3 or nullif(payload->>'base_date','') is null then raise exception 'Expliciete goedkeuring van basisdatum, achteraffacturatie en trainingsbeleid ontbreekt' using errcode='22023';end if;
  if exists(select 1 from fmz_accounting.central_agreement_snapshots where org_id=oid) then raise exception 'Cyclus al vastgelegd in overeenkomsten; geen automatische omzetting' using errcode='PT409';end if;
  insert into fmz_accounting.central_cycle_versions(org_id,version,enabled,base_date,credit_policy,reason,created_by) values(oid,current_version+1,true,(payload->>'base_date')::date,payload->>'credit_policy',payload->>'reason',auth.uid()) returning * into c;
  result:=jsonb_build_object('id',c.id,'version',c.version,'enabled',true,'baseDate',c.base_date);
 elsif action='complete' then
  if c.id is null or not c.enabled or (payload->>'config_id')::uuid is distinct from c.id or (payload->>'config_version')::integer is distinct from c.version then raise exception 'Cyclus niet actief of gewijzigd' using errcode='PT409';end if;
  task_index:=(payload->>'period_index')::integer;task_kind:=payload->>'kind';
  if task_index is null or task_index<0 or task_index>130 or task_kind is null or task_kind not in ('billing_prepare','billing_due') then raise exception 'Ongeldige agendataak' using errcode='22023';end if;
  select * into done from fmz_accounting.central_task_completions where org_id=oid and config_id=c.id and period_index=task_index and kind=task_kind;
  if (payload->>'expected_version')::integer is distinct from coalesce(done.version,0) then raise exception 'Taak is elders gewijzigd; ververs' using errcode='PT409';end if;
  if done.completed_at is null then insert into fmz_accounting.central_task_completions(org_id,config_id,period_index,kind,completed_by) values(oid,c.id,task_index,task_kind,auth.uid()) returning * into done;end if;
  result:=jsonb_build_object('id',c.id::text||':'||task_index||':'||task_kind,'status','done','version',done.version,'completedAt',done.completed_at);
 else raise exception 'Onbekende cyclusactie' using errcode='22023';end if;
 insert into fmz_accounting.audit(org_id,actor_id,action,request_id,detail) values(oid,auth.uid(),'central_'||action,request_id,result);
 insert into fmz_accounting.receipts values(oid,request_id,fingerprint,result,now());return result;
end$$;

-- Legacy branches remain unchanged; only explicitly attached new agreements use the common boundary.
create or replace function fmz_accounting.billing_period(v fmz_accounting.agreement_versions, at_date date) returns jsonb language plpgsql stable set search_path='' as $$
declare first_date date; last_date date;s jsonb;boundary date;
begin
 if at_date is null or at_date<v.effective_from then raise exception 'De overeenkomst is nog niet ingegaan';end if;
 select snapshot into s from fmz_accounting.central_agreement_snapshots where org_id=v.org_id and agreement_id=v.id;
 if s is not null then
 boundary:=(s->>'firstInvoiceDate')::date;
 if at_date<boundary then first_date:=v.effective_from;last_date:=boundary-1;else first_date:=boundary+((at_date-boundary)/28)*28;last_date:=first_date+27;end if;
 return jsonb_build_object('start',first_date,'end',last_date,'invoiceDate',last_date+1,'nextStart',last_date+1);
 end if;
 if v.cycle='calendar_month' then first_date:=date_trunc('month',at_date)::date;last_date:=(first_date+interval '1 month - 1 day')::date;
 elsif v.cycle='four_weeks' then first_date:=v.effective_from+((at_date-v.effective_from)/28)*28;last_date:=first_date+27;
 else first_date:=v.effective_from;last_date:=first_date;end if;
 return jsonb_build_object('start',first_date,'end',last_date,'invoiceDate',last_date,'nextStart',case when v.cycle<>'none' then last_date+1 end);
end $$;
create function fmz_accounting.billing_amount(v fmz_accounting.agreement_versions,p jsonb) returns bigint language sql stable set search_path='' as $$
 select coalesce((select case when p->>'start'=snapshot->>'startDate' and p->>'end'=snapshot#>>'{currentCycle,end}' then (snapshot->>'firstAmountCents')::bigint else v.amount_cents end from fmz_accounting.central_agreement_snapshots where org_id=v.org_id and agreement_id=v.id),v.amount_cents)
$$;
create or replace function fmz_accounting.billing_metadata(v fmz_accounting.agreement_versions, p jsonb) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('agreementVersionId',v.id,'agreementVersion',v.version,'clientId',v.client_id,'packageId',v.package_id,'packageLabel',v.package_label,
 'cycle',v.cycle,'effectiveFrom',v.effective_from,'start',p->>'start','end',p->>'end','invoiceDate',p->>'invoiceDate','amountCents',fmz_accounting.billing_amount(v,p)) || coalesce((select jsonb_build_object('centralConfigId',config_id,'centralConfigVersion',snapshot->'configVersion','firstPartial',p->>'start'=snapshot->>'startDate' and (snapshot->>'firstPartial')::boolean,'creditPolicy',snapshot->>'creditPolicy','sessions',case when p->>'start'=snapshot->>'startDate' then (snapshot->>'firstSessions')::integer else v.sessions end) from fmz_accounting.central_agreement_snapshots where org_id=v.org_id and agreement_id=v.id),'{}'::jsonb)
$$;
create or replace function fmz_accounting.billing_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
   raw:=jsonb_build_object('description',description_text,'amount',fmz_accounting.billing_amount(v,p)::numeric/100,'unitPrice',fmz_accounting.billing_amount(v,p)::numeric/100,'quantity','1','discount','0','discountNote','','discountMode','fixed','discountPercent','0','priceMode','inclusive','extraLines','[]'::jsonb,
   'date',p->>'invoiceDate','term',coalesce(settings->>'paymentTermDays','14'),'serviceDate',p->>'end','serviceExtent',case when coalesce((fmz_accounting.billing_metadata(v,p)->>'sessions')::integer,v.sessions)>0 then coalesce((fmz_accounting.billing_metadata(v,p)->>'sessions')::integer,v.sessions)||' trainingen' else 'Coaching' end,'period',(p->>'start')||' t/m '||(p->>'end'),'reference','',
   'customerName',source_client->>'name','customerEmail',source_client->>'email','customerAddress',concat_ws(', ',nullif(source_client#>>'{profile,address}',''),nullif(source_client#>>'{profile,postalCode}',''),nullif(source_client#>>'{profile,city}','')));
   body:=jsonb_build_object('raw',raw,'date',p->>'invoiceDate','client_id',cid,'packageLabel',v.package_label,'billing',fmz_accounting.billing_metadata(v,p),'customer',jsonb_build_object('name',raw->>'customerName','email',raw->>'customerEmail','address',raw->>'customerAddress'),'description',description_text,'service_date',p->>'end','service_extent',raw->>'serviceExtent','quantity',1,'gross_cents',fmz_accounting.billing_amount(v,p),'discount_cents',0,'term_days',(raw->>'term')::integer);
   r:=fmz_accounting.add_record(oid,gen_random_uuid(),'invoice',(p->>'invoiceDate')::date,body,'draft');result:=to_jsonb(r);
   end if;
  end if;
 else raise exception 'Onbekende afspraakhandeling';end if;
 insert into fmz_accounting.audit(org_id,actor_id,action,request_id,detail) values(oid,auth.uid(),'billing_'||action,request_id,jsonb_build_object('before',to_jsonb(previous),'after',result));
 insert into fmz_accounting.receipts values(oid,request_id,hash,result,now());return result;
end $$;
-- Read-only proposal. Start at the oldest agreement, never skip an unbilled first period.
create function fmz_accounting.billing_proposal(client_id text,at_date date default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid;v fmz_accounting.agreement_versions;p jsonb;r fmz_accounting.records;cursor_date date;steps integer:=0;legacy jsonb;
begin
 oid:=fmz_accounting.owner_org();
 if not exists(select 1 from public.coach_workspaces w cross join lateral jsonb_array_elements(w.state->'clients') c where w.trainer_id=auth.uid() and c->>'id'=client_id) then raise exception 'Klant niet bevoegd' using errcode='42501';end if;
 if at_date is null then select min(effective_from) into cursor_date from fmz_accounting.agreement_versions where org_id=oid and agreement_versions.client_id=billing_proposal.client_id;else cursor_date:=at_date;end if;
 loop
  steps:=steps+1;if cursor_date is null or steps>520 then return jsonb_build_object('available',false,'reason','Geen vrije factureerbare periode gevonden.');end if;
  select * into v from fmz_accounting.agreement_versions where org_id=oid and agreement_versions.client_id=billing_proposal.client_id and effective_from<=cursor_date order by effective_from desc,version desc limit 1;
  if v.id is null or not v.enabled then
   if at_date is not null then return jsonb_build_object('available',false,'reason','Deze afspraak is niet factureerbaar.');end if;
   select min(effective_from) into cursor_date from fmz_accounting.agreement_versions where org_id=oid and agreement_versions.client_id=billing_proposal.client_id and effective_from>cursor_date;continue;
  end if;
  p:=fmz_accounting.billing_period(v,cursor_date);
  if exists(select 1 from fmz_accounting.agreement_versions where org_id=oid and agreement_versions.client_id=billing_proposal.client_id and effective_from>(p->>'start')::date and effective_from<=(p->>'end')::date) then raise exception 'Afspraakversies overlappen deze periode; controleer vóór factureren' using errcode='PT409';end if;
  select * into r from fmz_accounting.records where org_id=oid and kind='invoice' and source_key='billing:'||client_id||':'||(p->>'start')||':'||(p->>'end');
  if r.status='posted' and at_date is null then
   if v.cycle='none' then select min(effective_from) into cursor_date from fmz_accounting.agreement_versions where org_id=oid and agreement_versions.client_id=billing_proposal.client_id and effective_from>cursor_date;else cursor_date:=(p->>'nextStart')::date;end if;continue;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'description',data->>'description')),'[]'::jsonb) into legacy from fmz_accounting.records where org_id=oid and kind='invoice' and parent_id is null and nullif(data->>'credit_of','') is null and data->>'client_id'=client_id and not(data ? 'billing') and date between (p->>'start')::date and (p->>'end')::date;
  return jsonb_build_object('available',true,'agreement',to_jsonb(v),'period',p,'billing',fmz_accounting.billing_metadata(v,p),'record',case when r.id is not null then to_jsonb(r) end,'legacy',legacy);
 end loop;
end$$;
create function public.fmz_central_billing_read(from_date date,to_date date) returns jsonb language sql security invoker set search_path='' as $$select fmz_accounting.central_task_read(from_date,to_date)$$;
create function public.fmz_central_billing_command(action text,payload jsonb,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_accounting.central_task_command(action,payload,request_id)$$;
create function public.fmz_billing_proposal(client_id text,at_date date default null) returns jsonb language sql security invoker set search_path='' as $$select fmz_accounting.billing_proposal(client_id,at_date)$$;
revoke all on function fmz_accounting.central_immutable(),fmz_accounting.central_quote(uuid,date,bigint,integer),fmz_accounting.attach_central_agreement(uuid,uuid,jsonb),fmz_accounting.billing_amount(fmz_accounting.agreement_versions,jsonb) from public,anon,authenticated;
revoke all on function fmz_accounting.central_task_read(date,date),fmz_accounting.central_task_command(text,jsonb,uuid),fmz_accounting.billing_proposal(text,date),public.fmz_central_billing_read(date,date),public.fmz_central_billing_command(text,jsonb,uuid),public.fmz_billing_proposal(text,date) from public,anon,authenticated;
grant execute on function fmz_accounting.central_task_read(date,date),fmz_accounting.central_task_command(text,jsonb,uuid),fmz_accounting.billing_proposal(text,date),public.fmz_central_billing_read(date,date),public.fmz_central_billing_command(text,jsonb,uuid),public.fmz_billing_proposal(text,date) to authenticated;
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
 'agreements',(select coalesce(jsonb_agg(to_jsonb(v)||coalesce((select jsonb_build_object('central_snapshot',s.snapshot) from fmz_accounting.central_agreement_snapshots s where s.org_id=v.org_id and s.agreement_id=v.id),'{}'::jsonb) order by client_id,version),'[]') from fmz_accounting.agreement_versions v where org_id=oid));
end $$;
commit;

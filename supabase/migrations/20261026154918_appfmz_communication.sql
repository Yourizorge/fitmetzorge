-- APPFMZ communication outbox. No historical documents, payment records or messages are rewritten.
begin;
create schema fmz_communication;
revoke all on schema fmz_communication from public,anon,authenticated;
grant usage on schema fmz_communication to authenticated,service_role;
create table fmz_communication.documents(
 org_id uuid not null references fmz_accounting.organizations(id),id uuid not null,kind text not null check(kind in('invoice','agreement')),
 client_id text,recipient text not null,bucket text not null,path text not null,sha256 text not null check(sha256~'^[a-f0-9]{64}$'),bytes bigint not null check(bytes between 5 and 12000000),name text not null,metadata jsonb not null,
 primary key(org_id,id,kind)
);
create table fmz_communication.messages(
 org_id uuid not null references fmz_accounting.organizations(id),id uuid not null default gen_random_uuid(),document_id uuid not null,kind text not null,version bigint not null default 1,
 automatic_invoice boolean not null default false,manual_review_required boolean not null default false,sender text not null default '',purpose text not null default 'document' check(purpose in('document','test')),contact_at_approval text,recipient text not null,subject text not null,body text not null,status text not null default 'draft' check(status in('draft','approved','scheduled','sending','sent','archive_pending','temporary_failure','permanent_failure','delivery_unknown','cancelled')),
 approved_by uuid references auth.users(id),approved_at timestamptz,approved_hash text,scheduled_at timestamptz,message_date timestamptz not null default now(),
 acceptance jsonb,archive jsonb,last_code text,attempts integer not null default 0,attempt_limit integer not null default 8 check(attempt_limit between 8 and 1000),lease uuid,lease_until timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(org_id,id),foreign key(org_id,document_id,kind) references fmz_communication.documents(org_id,id,kind)
);
create unique index communication_document_once on fmz_communication.messages(org_id,document_id,kind) where purpose='document';
create index communication_due on fmz_communication.messages(scheduled_at) where status in('scheduled','archive_pending');
create table fmz_communication.audit(id bigint generated always as identity primary key,org_id uuid not null references fmz_accounting.organizations(id),message_id uuid,actor uuid,at timestamptz not null default now(),action text not null,detail jsonb not null);
create table fmz_communication.receipts(org_id uuid not null,request_id uuid not null,body jsonb not null,result jsonb not null,primary key(org_id,request_id));
create table fmz_communication.preliminary(org_id uuid not null,id uuid not null,version bigint not null default 1,recipient text not null,subject text not null,body text not null,primary key(org_id,id),foreign key(org_id,id) references fmz_accounting.records(org_id,id));
alter table fmz_communication.preliminary enable row level security;revoke all on fmz_communication.preliminary from public,anon,authenticated;
create table fmz_communication.config(id boolean primary key default true check(id),scheduler_enabled boolean not null default false,enabled boolean not null default false,sender text not null default '',test_recipient text not null default '',daily_limit integer not null default 100 check(daily_limit between 1 and 180));
insert into fmz_communication.config(id) values(true);
do $$declare t text;begin foreach t in array array['documents','messages','audit','receipts','config'] loop execute format('alter table fmz_communication.%I enable row level security',t);execute format('revoke all on fmz_communication.%I from public,anon,authenticated',t);end loop;end$$;
create function fmz_communication.message_hash(m fmz_communication.messages) returns text language sql immutable set search_path='' as $$select encode(sha256(convert_to(jsonb_build_array(m.document_id,m.kind,m.sender,m.recipient,m.subject,m.body)::text,'UTF8')),'hex')$$;
create function fmz_communication.validate(recipient text,subject text,body text) returns void language plpgsql immutable set search_path='' as $$begin
 if coalesce(recipient,'')!~'^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' or length(recipient)>254 then raise exception 'Vul één volledig e-mailadres in';end if;
 if length(trim(coalesce(subject,''))) not between 1 and 200 or subject~E'[\r\n]' then raise exception 'Controleer het onderwerp';end if;
 if length(trim(coalesce(body,''))) not between 1 and 30000 then raise exception 'Controleer de berichttekst';end if;
end$$;
create function fmz_communication.money(cents bigint) returns text language sql immutable set search_path='' as $$select '€'||replace(to_char(cents::numeric/100,'FM999999999990.00'),'.',',')$$;
create function fmz_communication.invoice_period(doc jsonb) returns text language sql immutable set search_path='' as $$
 select case when nullif(doc#>>'{billing,start}','') is not null and nullif(doc#>>'{billing,end}','') is not null then (doc#>>'{billing,start}')||' t/m '||(doc#>>'{billing,end}')
 else coalesce(nullif(doc->>'period',''),case when nullif(doc->>'serviceDate','') is not null then 'Prestatiedatum '||(doc->>'serviceDate') end,'Controleer de prestatieomschrijving in de PDF') end
$$;
create function fmz_communication.invoice_payment(doc jsonb) returns text language plpgsql immutable set search_path='' as $$declare holder text;begin
 if nullif(doc->>'creditOf','') is not null then return 'Deze creditfactuur corrigeert '||(doc->>'creditOf')||'. Een terugbetaling is een afzonderlijke handeling.';end if;
 holder:=coalesce(nullif(doc#>>'{settings,accountHolder}',''),nullif(doc#>>'{settings,ownerName}',''),nullif(doc#>>'{settings,businessName}',''));
 if nullif(doc#>>'{settings,iban}','') is null or holder is null then return 'De vastgelegde factuur bevat geen volledige bankinstructie. Neem contact op met FitMetZorge voordat je betaalt.';end if;
 return 'Maak het nog openstaande bedrag uiterlijk op '||coalesce(doc->>'dueDate','de factuurvervaldatum')||' over naar '||(doc#>>'{settings,iban}')||' ten name van '||holder||', onder vermelding van factuurnummer '||(doc->>'invoiceNo')||'. Reeds verwerkte betalingen hoef je niet opnieuw te betalen.';
end$$;
create function fmz_communication.contact(company jsonb,verified_sender text default '') returns text language sql immutable set search_path='' as $$
 select concat_ws(E'\n',nullif(company->>'businessName',''),nullif(coalesce(nullif(company->>'email',''),verified_sender),''),nullif(company->>'phone',''),nullif(company->>'address',''),nullif(concat_ws(' ',nullif(company->>'postalCity',''),nullif(company->>'country','')),''))
$$;
create function fmz_communication.invoice_body(doc jsonb) returns text language sql immutable set search_path='' as $$
 select 'Beste '||coalesce(doc#>>'{customer,name}','')||E',\n\nBijgevoegd vind je factuur '||(doc->>'invoiceNo')||E'.\nPeriode: '||fmz_communication.invoice_period(doc)||E'\n'||coalesce(doc->>'description','')||E'\nTotaal factuur: '||fmz_communication.money((doc->>'totalCents')::bigint)||E'\nBetaaltermijn: '||coalesce(doc->>'paymentTermDays','zie PDF')||E' dagen\nBetaal uiterlijk: '||coalesce(doc->>'dueDate','zie PDF')||E'\n'||fmz_communication.invoice_payment(doc)||E'\n\nMet vriendelijke groet,\n'||fmz_communication.contact(doc->'settings')
$$;
create function fmz_communication.agreement_body(snapshot jsonb,number text,verified_sender text default '') returns text language plpgsql immutable set search_path='' as $$
declare person jsonb:=snapshot->'person';pkg jsonb:=snapshot->'package';payment jsonb:=snapshot->'payment';body text;cycle text;begin
 cycle:=case when pkg->>'cycle'='calendar_month' then ' per kalendermaand' when pkg->>'cycle'='four_weeks' then ' per vier weken (28 dagen)' else ' volgens de overeenkomst' end;
 body:='Beste '||coalesce(person->>'firstName','')||E',\n\nJe inschrijving bij FitMetZorge is voltooid.\nOvereenkomst: '||number||E'\nPakket: '||coalesce(pkg->>'label','')||E'\nStartdatum: '||coalesce(person->>'startDate','')||E'\nBasisbedrag: '||fmz_communication.money(coalesce((payment->>'baseCents')::bigint,(pkg->>'cents')::bigint))||cycle;
 if coalesce((payment->>'discountCents')::bigint,0)>0 then body:=body||E'\nKorting: '||fmz_communication.money((payment->>'discountCents')::bigint)||' per periode, gedurende de eerste '||(payment->>'discountPeriods')||' perioden (inclusief de eerste). Reden: '||coalesce(payment->>'discountReason','zie overeenkomst')||'. Daarna geldt het vastgelegde basisbedrag.';end if;
 if payment is not null and payment<>'null'::jsonb then
  body:=body||E'\nEerste periode: '||(payment->>'firstPeriodStart')||' t/m '||(payment->>'firstPeriodEnd')||E'\nEerste betaling na korting: '||fmz_communication.money((payment->>'firstPeriodNetCents')::bigint);
  if coalesce((payment->>'firstPeriodCustom')::boolean,false) then body:=body||E'\nAfwijkende eerste periode: '||coalesce(payment->>'firstPeriodReason','zie overeenkomst')||' (vóór korting '||fmz_communication.money((payment->>'firstPeriodCents')::bigint)||').';end if;
  body:=body||E'\nVolgende periode begint: '||(payment->>'nextPeriodStart')||E'\nBedrag volgende volledige periode: '||fmz_communication.money(case when coalesce((payment->>'discountPeriods')::integer,0)>1 then (payment->>'regularCents')::bigint else (payment->>'baseCents')::bigint end)||cycle;
 end if;
 return body||E'\nJe ondertekende overeenkomst is als PDF bijgevoegd en staat in APPFMZ onder Documenten.\nhttps://appfmz.nl\n\nMet vriendelijke groet,\n'||fmz_communication.contact(snapshot->'company',verified_sender);
end$$;
-- Internal only: callers must first establish finalized immutable PDF and correct recipient.
create function fmz_communication.register_document(oid uuid,did uuid,k text,recipient text,cid text,bucket text,path text,sha text,bytes bigint,name text,metadata jsonb) returns void language plpgsql set search_path='' as $$
declare old fmz_communication.documents;
begin
 select * into old from fmz_communication.documents where org_id=oid and id=did and kind=k;
 if found then if old.sha256<>sha or old.path<>path or old.bucket<>bucket or old.bytes<>bytes then raise exception 'Definitief document mag niet worden vervangen';end if;return;end if;
 insert into fmz_communication.documents values(oid,did,k,cid,recipient,bucket,path,sha,bytes,name,metadata);
end$$;
create function fmz_communication.current_contact(oid uuid,did uuid,k text) returns text language sql stable set search_path='' as $$
 select coalesce((select c->>'email' from fmz_communication.documents d join fmz_accounting.organizations o on o.id=d.org_id join public.coach_workspaces w on w.trainer_id=o.owner_id cross join lateral jsonb_array_elements(coalesce(w.state->'clients','[]')) c where d.org_id=oid and d.id=did and d.kind=k and c->>'id'=d.client_id),'')
$$;
create function fmz_communication.send_allowed(m fmz_communication.messages) returns boolean language plpgsql stable set search_path='' as $$
declare mode text;state text;
begin
 if m.kind<>'invoice' or m.purpose='test' then return true;end if;
 if to_regclass('fmz_accounting.billing_plan_rules') is null then return not m.automatic_invoice;end if;
 select r.send_mode,r.state into mode,state from fmz_accounting.billing_plan_rules r join fmz_communication.documents d on d.org_id=r.org_id and d.client_id=r.client_id where d.org_id=m.org_id and d.id=m.document_id and d.kind=m.kind;
 return coalesce(mode,'manual')<>'disabled' and (not m.automatic_invoice or(mode='automatic' and state='active' and exists(select 1 from fmz_accounting.billing_plan_tasks t where t.org_id=m.org_id and t.invoice_id=m.document_id and t.status='active')));
end$$;
create function fmz_communication.read() returns jsonb language plpgsql security definer set search_path='' as $$declare oid uuid;begin oid:=fmz_accounting.owner_org();return jsonb_build_object('messages',(select coalesce(jsonb_agg(to_jsonb(m)-'lease'-'lease_until'),'[]') from fmz_communication.messages m where org_id=oid)||(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('document_id',p.id,'preliminary',true,'kind','invoice','purpose','preliminary','status','draft')),'[]') from fmz_communication.preliminary p where p.org_id=oid and not exists(select 1 from fmz_communication.messages m where m.org_id=p.org_id and m.document_id=p.id and m.kind='invoice' and m.purpose='document')),'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from fmz_communication.audit a where org_id=oid),'configured',(select enabled and sender<>'' from fmz_communication.config where id),'sender',(select sender from fmz_communication.config where id),'testRecipient',(select test_recipient from fmz_communication.config where id));end$$;
create function fmz_communication.prepare_invoice(oid uuid,invoice_id uuid) returns fmz_communication.messages language plpgsql set search_path='' as $$
declare r fmz_accounting.records;f fmz_accounting.files;m fmz_communication.messages;recipient text;subject text;body text;
begin
  select * into r from fmz_accounting.records where org_id=oid and id=invoice_id and kind='invoice' and status='posted' and not data?'cancellation_id';
  if not found then raise exception 'Maak eerst de juiste factuur definitief';end if;
  select * into f from fmz_accounting.files where org_id=oid and record_id=r.id and kind='invoice_pdf' and status='ready';if not found then raise exception 'Sla eerst de definitieve PDF op';end if;
  recipient:=coalesce(nullif(r.data#>>'{document,customer,email}',''),'','');
  perform fmz_communication.register_document(oid,r.id,'invoice',recipient,coalesce(r.data#>>'{document,billing,clientId}',r.data#>>'{billing,clientId}'),'fmz-finance',f.path,f.sha256,f.bytes,f.original_name,r.data->'document');
  subject:='Factuur '||r.number||' — FitMetZorge';
  body:=fmz_communication.invoice_body(r.data->'document');
  if exists(select 1 from fmz_communication.preliminary where org_id=oid and id=r.id) then
   select p.recipient,replace(p.subject,'{{factuurnummer}}',r.number),replace(replace(replace(p.body,'{{factuurnummer}}',r.number),'{{totaal}}','€'||replace(to_char((r.data#>>'{document,totalCents}')::numeric/100,'FM999999999990.00'),'.',',')),'{{betaaldatum}}',coalesce(r.data#>>'{document,dueDate}','zie PDF')) into recipient,subject,body from fmz_communication.preliminary p where p.org_id=oid and p.id=r.id;
   body:=replace(replace(replace(replace(body,'{{periode}}',fmz_communication.invoice_period(r.data->'document')),'{{betaaltermijn}}',coalesce(r.data#>>'{document,paymentTermDays}','zie PDF')),'{{betaalinstructies}}',fmz_communication.invoice_payment(r.data->'document')),'{{contact}}',fmz_communication.contact(r.data#>'{document,settings}'));
  end if;
  insert into fmz_communication.messages(org_id,document_id,kind,recipient,subject,body) values(oid,r.id,'invoice',recipient,subject,body) on conflict(org_id,document_id,kind) where purpose='document' do nothing;
  select * into m from fmz_communication.messages where org_id=oid and document_id=r.id and kind='invoice' and purpose='document';
 return m;end$$;
create function fmz_communication.command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid; m fmz_communication.messages;old fmz_communication.messages;r fmz_accounting.records;f fmz_accounting.files;d fmz_communication.documents;result jsonb;req jsonb;prior fmz_communication.receipts;recipient text;subject text;body text;pre fmz_communication.preliminary;
begin
 oid:=fmz_accounting.owner_org();if request_id is null then raise exception 'Verzoek-ID ontbreekt';end if;
 perform 1 from fmz_accounting.organizations where id=oid for update;
 req:=jsonb_build_object('action',action,'payload',payload);select * into prior from fmz_communication.receipts where org_id=oid and fmz_communication.receipts.request_id=command.request_id;
 if found then if prior.body<>req then raise exception 'Verzoek-ID is al gebruikt' using errcode='PT409';end if;return prior.result;end if;
 if action='prepare' then
  select * into r from fmz_accounting.records where org_id=oid and id=(payload->>'invoiceId')::uuid and kind='invoice';
  if r.status='draft' then
   insert into fmz_communication.preliminary(org_id,id,recipient,subject,body) values(oid,r.id,coalesce(r.data#>>'{customer,email}',''),'Factuur {{factuurnummer}} — FitMetZorge','Beste '||coalesce(r.data#>>'{customer,name}','')||E',\n\nBijgevoegd vind je factuur {{factuurnummer}}.\nTotaal: {{totaal}}\nBetaal uiterlijk: {{betaaldatum}}\nPeriode: {{periode}}\nBetaaltermijn: {{betaaltermijn}} dagen\n{{betaalinstructies}}\n\nMet vriendelijke groet,\n{{contact}}') on conflict(org_id,id) do nothing;
   select * into pre from fmz_communication.preliminary where org_id=oid and id=r.id;
   result:=to_jsonb(pre)||jsonb_build_object('document_id',pre.id,'preliminary',true,'kind','invoice','status','draft');
   insert into fmz_communication.receipts values(oid,request_id,req,result);return result;
  end if;
  select * into r from fmz_accounting.records where org_id=oid and id=(payload->>'invoiceId')::uuid and kind='invoice' and status='posted' and not data?'cancellation_id';
  if not found then raise exception 'Maak eerst de juiste factuur definitief';end if;
  select * into f from fmz_accounting.files where org_id=oid and record_id=r.id and kind='invoice_pdf' and status='ready';if not found then raise exception 'Sla eerst de definitieve PDF op';end if;
  recipient:=coalesce(nullif(r.data#>>'{document,customer,email}',''),payload->>'recipient','');
  perform fmz_communication.register_document(oid,r.id,'invoice',recipient,coalesce(r.data#>>'{document,billing,clientId}',r.data#>>'{billing,clientId}'),'fmz-finance',f.path,f.sha256,f.bytes,f.original_name,r.data->'document');
  subject:='Factuur '||r.number||' — FitMetZorge';
  body:=fmz_communication.invoice_body(r.data->'document');
  if exists(select 1 from fmz_communication.preliminary where org_id=oid and id=r.id) then
   select p.recipient,replace(p.subject,'{{factuurnummer}}',r.number),replace(replace(replace(p.body,'{{factuurnummer}}',r.number),'{{totaal}}','€'||replace(to_char((r.data#>>'{document,totalCents}')::numeric/100,'FM999999999990.00'),'.',',')),'{{betaaldatum}}',coalesce(r.data#>>'{document,dueDate}','zie PDF')) into recipient,subject,body from fmz_communication.preliminary p where p.org_id=oid and p.id=r.id;
   body:=replace(replace(replace(replace(body,'{{periode}}',fmz_communication.invoice_period(r.data->'document')),'{{betaaltermijn}}',coalesce(r.data#>>'{document,paymentTermDays}','zie PDF')),'{{betaalinstructies}}',fmz_communication.invoice_payment(r.data->'document')),'{{contact}}',fmz_communication.contact(r.data#>'{document,settings}'));
  end if;
  insert into fmz_communication.messages(org_id,document_id,kind,recipient,subject,body) values(oid,r.id,'invoice',recipient,subject,body) on conflict(org_id,document_id,kind) where purpose='document' do nothing;
  select * into m from fmz_communication.messages where org_id=oid and document_id=r.id and kind='invoice' and purpose='document';
 else
  select * into m from fmz_communication.messages where org_id=oid and id=(payload->>'id')::uuid for update;
  if not found then
   select * into pre from fmz_communication.preliminary where org_id=oid and id=(payload->>'id')::uuid for update;
   if pre.id is null then raise exception 'E-mailconcept niet gevonden' using errcode='42501';end if;
   if action<>'save' then raise exception 'Maak eerst factuur en definitieve PDF af';end if;
   if pre.version<>coalesce((payload->>'version')::bigint,0) then raise exception 'E-mailconcept gewijzigd' using errcode='PT409';end if;
   perform fmz_communication.validate(payload->>'recipient',payload->>'subject',payload->>'body');
   if length(trim(coalesce(payload->>'reason','')))<3 then raise exception 'Reden ontbreekt';end if;
   if exists(select 1 from fmz_communication.messages where org_id=oid and document_id=pre.id and kind='invoice' and purpose='document') then raise exception 'Factuur is inmiddels definitief; open het nieuwe e-mailconcept' using errcode='PT409';end if;
   result:=to_jsonb(pre);update fmz_communication.preliminary set recipient=payload->>'recipient',subject=payload->>'subject',body=payload->>'body',version=version+1 where org_id=oid and id=pre.id returning * into pre;
   insert into fmz_communication.audit(org_id,message_id,actor,action,detail) values(oid,pre.id,auth.uid(),'save_preliminary',jsonb_build_object('before',result,'after',to_jsonb(pre),'reason',payload->>'reason'));
   result:=to_jsonb(pre)||jsonb_build_object('document_id',pre.id,'preliminary',true,'kind','invoice','status','draft');insert into fmz_communication.receipts values(oid,request_id,req,result);return result;
  end if;
  if m.version<>coalesce((payload->>'version')::bigint,0) then raise exception 'E-mail gewijzigd: ververs en controleer opnieuw' using errcode='PT409';end if;old:=m;
  if action='save' then
   if m.acceptance is not null or m.status in('sending','delivery_unknown','sent') then raise exception 'Verzonden of onzekere e-mail kan niet worden overschreven';end if;
   perform fmz_communication.validate(payload->>'recipient',payload->>'subject',payload->>'body');
   if length(trim(coalesce(payload->>'reason','')))<3 then raise exception 'Geef een reden voor de wijziging';end if;
   update fmz_communication.messages set recipient=trim(payload->>'recipient'),subject=payload->>'subject',body=payload->>'body',status='draft',approved_by=null,approved_at=null,approved_hash=null,scheduled_at=null,version=version+1,updated_at=now() where org_id=oid and id=m.id returning * into m;
  elsif action='test' then
   if not(select enabled and test_recipient<>'' from fmz_communication.config where id) then raise exception 'Veilige mailbox en expliciet testadres ontbreken';end if;
   if payload->>'confirmed' is distinct from 'true' then raise exception 'Controleer testontvanger en PDF';end if;
   insert into fmz_communication.messages(org_id,document_id,kind,purpose,sender,recipient,subject,body,status,approved_by,approved_at,scheduled_at)
   select oid,m.document_id,m.kind,'test',sender,test_recipient,'TEST — '||left(m.subject,190),m.body,'scheduled',auth.uid(),now(),now() from fmz_communication.config where id returning * into m;
   update fmz_communication.messages set approved_hash=fmz_communication.message_hash(m) where org_id=oid and id=m.id returning * into m;
  elsif action in('approve','send','schedule') then
   if m.status not in('draft','approved','scheduled','temporary_failure','permanent_failure','cancelled') or m.acceptance is not null then raise exception 'Deze e-mail kan niet opnieuw worden verstuurd';end if;
   perform fmz_communication.validate(m.recipient,m.subject,m.body);
   if not fmz_communication.send_allowed(m) then raise exception 'E-mailverzending staat voor dit lid uit';end if;
   select * into d from fmz_communication.documents where org_id=oid and id=m.document_id and kind=m.kind;
   if m.kind='invoice' and not exists(select 1 from fmz_accounting.records ri where ri.org_id=oid and ri.id=m.document_id and ri.status='posted' and not ri.data?'cancellation_id') then raise exception 'Factuur is niet meer geldig';end if;
   if action<>'approve' and not(select enabled and sender<>'' from fmz_communication.config where id) then raise exception 'Zakelijke mailbox is nog niet veilig gekoppeld';end if;
   if payload->>'confirmed' is distinct from 'true' then raise exception 'Controleer ontvanger, tekst en PDF vóór goedkeuring';end if;
   select sender into m.sender from fmz_communication.config where id;
   update fmz_communication.messages set automatic_invoice=false,manual_review_required=false,sender=m.sender,status=case when action='approve' then 'approved' else 'scheduled' end,approved_by=auth.uid(),approved_at=now(),approved_hash=fmz_communication.message_hash(m),contact_at_approval=fmz_communication.current_contact(oid,m.document_id,m.kind),scheduled_at=case when action='schedule' then (payload->>'scheduledAt')::timestamptz when action='send' then now() end,version=version+1,updated_at=now() where org_id=oid and id=m.id returning * into m;
   if action='schedule' and (m.scheduled_at is null or m.scheduled_at<now()) then raise exception 'Kies een toekomstig verzendmoment';end if;
  elsif action='cancel' then
   if m.acceptance is not null or m.status in('sending','delivery_unknown','sent') then raise exception 'Verzending is gestart of voltooid; annuleren is niet veilig';end if;
   update fmz_communication.messages set status='cancelled',scheduled_at=null,version=version+1,updated_at=now() where org_id=oid and id=m.id returning * into m;
  elsif action='resolve_unknown' then
   if m.status<>'delivery_unknown' or m.acceptance is not null then raise exception 'Alleen een onbevestigde verzenduitkomst kan zo worden gecontroleerd';end if;
   if payload->>'confirmed' is distinct from 'true' or length(trim(coalesce(payload->>'reason','')))<10 or length(trim(coalesce(payload->>'evidence',''))) not between 20 and 5000 or length(trim(coalesce(payload->>'reference',''))) not between 8 and 500 then raise exception 'Expliciet bronbewijs, referentie en reden zijn verplicht; ontbreken in Verzonden is geen bewijs';end if;
   if payload->>'messageId' is distinct from '<fmz.'||m.id||'@appfmz.nl>' then raise exception 'Bewijs hoort niet bij dit exacte Message-ID';end if;
   if payload->>'outcome'='accepted' then
    if coalesce(payload->>'source','') not in('provider_log','recipient_original_message') then raise exception 'Alleen providerbewijs of het originele ontvangen bericht bewijst acceptatie';end if;
    if nullif(payload->>'sentAt','') is null or (payload->>'sentAt')::timestamptz>now()+interval '5 minutes' or (payload->>'sentAt')::timestamptz<m.created_at-interval '1 day' then raise exception 'Controleer de aantoonbare verzendtijd';end if;
    update fmz_communication.messages set acceptance=jsonb_build_object('method','owner-verified-evidence','from',m.sender,'providerId',payload->>'reference','source',payload->>'source','evidence',payload->>'evidence','messageId',payload->>'messageId','sentAt',payload->>'sentAt','verifiedBy',auth.uid(),'verifiedAt',now()),status='archive_pending',lease=null,lease_until=null,version=version+1,updated_at=now() where org_id=oid and id=m.id returning * into m;
    if m.kind='invoice' and m.purpose='document' then update fmz_accounting.records set data=data||jsonb_build_object('shared_at',coalesce(data->'shared_at',to_jsonb((payload->>'sentAt')::timestamptz)),'email_verified_at',now()),version=version+1 where org_id=oid and id=m.document_id;end if;
   elsif payload->>'outcome'='not_sent' then
    if payload->>'source' is distinct from 'provider_log' then raise exception 'Niet verstuurd vereist expliciet providerbewijs van niet-acceptatie, geen ontbrekende mailboxkopie';end if;
    update fmz_communication.messages set automatic_invoice=false,manual_review_required=true,status='draft',approved_by=null,approved_at=null,approved_hash=null,scheduled_at=null,lease=null,lease_until=null,version=version+1,updated_at=now() where org_id=oid and id=m.id returning * into m;
   else raise exception 'Kies de bewezen uitkomst';end if;
  elsif action='extend_attempts' then
   if m.attempts<m.attempt_limit or m.status not in('temporary_failure','permanent_failure','archive_pending','draft','approved','scheduled') then raise exception 'Controleer eerst de uitgeputte pogingen en eventuele onzekere verzending';end if;
   if payload->>'confirmed' is distinct from 'true' or length(trim(coalesce(payload->>'reason','')))<10 or coalesce((payload->>'extraAttempts')::integer,0) not between 1 and 3 or m.attempt_limit+(payload->>'extraAttempts')::integer>1000 then raise exception 'Bevestig één tot drie extra pogingen met reden';end if;
   update fmz_communication.messages set attempt_limit=attempt_limit+(payload->>'extraAttempts')::integer,automatic_invoice=false,manual_review_required=case when acceptance is null then true else manual_review_required end,status=case when acceptance is null then 'draft' else 'archive_pending' end,approved_by=case when acceptance is null then null else approved_by end,approved_at=case when acceptance is null then null else approved_at end,approved_hash=case when acceptance is null then null else approved_hash end,scheduled_at=case when acceptance is null then null else now() end,version=version+1,updated_at=now() where org_id=oid and id=m.id returning * into m;
  elsif action='retry' then
   if m.attempts>=m.attempt_limit then raise exception 'Pogingen uitgeput: controleer en verruim eerst bewust het pogingbudget';end if;
   if m.status not in('temporary_failure','archive_pending') then raise exception 'Deze uitkomst moet eerst afzonderlijk worden gecontroleerd';end if;
   update fmz_communication.messages set status=case when acceptance is not null then 'archive_pending' else 'scheduled' end,scheduled_at=now(),version=version+1,updated_at=now() where org_id=oid and id=m.id returning * into m;
  else raise exception 'Onbekende communicatieactie';end if;
 end if;
 result:=to_jsonb(m)-'lease'-'lease_until';insert into fmz_communication.audit(org_id,message_id,actor,action,detail) values(oid,m.id,auth.uid(),action,jsonb_build_object('before',to_jsonb(old)-'lease'-'lease_until','after',result,'reason',payload->>'reason','evidence',case when action='resolve_unknown' then payload else null end));
 insert into fmz_communication.receipts values(oid,request_id,req,result);return result;
end$$;
create function fmz_communication.worker(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m fmz_communication.messages;result jsonb;limit_today integer;
begin
 if action='claim' then
  -- Expired SMTP leases are uncertain, never automatic retry. Accepted mail retries archive only.
  update fmz_communication.messages set status=case when acceptance is null then 'delivery_unknown' else 'archive_pending' end,lease=null,lease_until=null where status='sending' and lease_until<now();
  if not(select enabled from fmz_communication.config where id) then return '[]';end if;
  select greatest(0,c.daily_limit-(select count(*) from fmz_communication.audit quota where quota.action='claim_smtp' and quota.at>=((now() at time zone 'Europe/Amsterdam')::date)::timestamp at time zone 'Europe/Amsterdam')) into limit_today from fmz_communication.config c where id;
  with picked as(select q.org_id,q.id from fmz_communication.messages q where (q.status='archive_pending' or(q.status='scheduled' and q.scheduled_at<=now() and limit_today>0)) and q.approved_hash=fmz_communication.message_hash(q) and q.approved_by is not null and q.attempts<q.attempt_limit order by q.scheduled_at nulls last limit 1 for update skip locked),claimed as(update fmz_communication.messages q set status='sending',lease=gen_random_uuid(),lease_until=now()+interval '3 minutes',message_date=case when q.attempts=0 then now() else q.message_date end,attempts=attempts+1 from picked p where p.org_id=q.org_id and p.id=q.id returning q.*)
  select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('messageId','<fmz.'||c.id||'@appfmz.nl>','messageDate',c.message_date,'attachment',jsonb_build_object('bucket',d.bucket,'path',d.path,'sha256',d.sha256,'bytes',d.bytes,'name',d.name,'ownerPrefix',coalesce(d.metadata->>'storagePrefix',d.org_id::text)))),'[]') into result from claimed c join fmz_communication.documents d on d.org_id=c.org_id and d.id=c.document_id and d.kind=c.kind;insert into fmz_communication.audit(org_id,message_id,action,detail) select (j->>'org_id')::uuid,(j->>'id')::uuid,'claim_smtp',jsonb_build_object('attempt',j->'attempts') from jsonb_array_elements(result) j where j->'acceptance'='null'::jsonb;return result;
 end if;
 select * into m from fmz_communication.messages where id=(payload->>'id')::uuid and lease=(payload->>'lease')::uuid and status='sending' for update;if not found then return '{"ok":false}';end if;
 -- Already accepted mail is archived verbatim; later recipient/rule changes cannot resend or prevent its Sent copy.
 if action='check' then
  if not coalesce((select enabled from fmz_communication.config where id),false) or m.sender is distinct from (select sender from fmz_communication.config where id) or m.approved_hash is distinct from fmz_communication.message_hash(m) then return '{"ok":false}';end if;
  if m.acceptance is not null then return '{"ok":true}';end if;
  return jsonb_build_object('ok',fmz_communication.send_allowed(m) and (m.purpose='test' or coalesce(m.contact_at_approval,'')=fmz_communication.current_contact(m.org_id,m.document_id,m.kind)) and (m.kind<>'invoice' or exists(select 1 from fmz_accounting.records r where r.org_id=m.org_id and r.id=m.document_id and r.status='posted' and not r.data?'cancellation_id')));
 elsif action='accepted' then
  if payload#>>'{acceptance,from}' is distinct from m.sender or payload#>>'{acceptance,code}' is distinct from '250' then raise exception 'Afzender of SMTP-bevestiging wijkt af';end if;
  update fmz_communication.messages set acceptance=payload->'acceptance' where org_id=m.org_id and id=m.id;
  if m.kind='invoice' and m.purpose='document' then update fmz_accounting.records set data=data||jsonb_build_object('shared_at',coalesce(data->'shared_at',to_jsonb(now())),'email_accepted_at',now()),version=version+1 where org_id=m.org_id and id=m.document_id;end if;
 elsif action='finish' then
  if payload->>'status' not in('sent','archive_pending','temporary_failure','permanent_failure','delivery_unknown') then raise exception 'Ongeldige transportuitkomst';end if;
  if payload->>'status' in('sent','archive_pending') and m.acceptance is null then raise exception 'SMTP-bevestiging ontbreekt';end if;
  update fmz_communication.messages set status=payload->>'status',archive=coalesce(payload->'archive',archive),last_code=left(payload->>'code',80),lease=null,lease_until=null,updated_at=now(),version=version+1 where org_id=m.org_id and id=m.id;
 else raise exception 'Onbekende workeractie';end if;
 insert into fmz_communication.audit(org_id,message_id,action,detail) values(m.org_id,m.id,action,jsonb_build_object('status',payload->>'status','code',payload->>'code','attempt',m.attempts));return '{"ok":true}';
end$$;
create function public.fmz_communication_read() returns jsonb language sql security invoker set search_path='' as $$select fmz_communication.read()$$;
create function public.fmz_communication_command(action text,payload jsonb,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_communication.command(action,payload,request_id)$$;
create function public.fmz_communication_worker(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select fmz_communication.worker(action,payload)$$;
revoke all on all functions in schema fmz_communication from public,anon,authenticated,service_role;
grant execute on function fmz_communication.read(),fmz_communication.command(text,jsonb,uuid) to authenticated;
grant execute on function fmz_communication.worker(text,jsonb) to service_role;
revoke all on function public.fmz_communication_read(),public.fmz_communication_command(text,jsonb,uuid),public.fmz_communication_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.fmz_communication_read(),public.fmz_communication_command(text,jsonb,uuid) to authenticated;
grant execute on function public.fmz_communication_worker(text,jsonb) to service_role;
create function fmz_communication.prepare_scheduled(asof timestamptz default now()) returns void language plpgsql security definer set search_path='' as $$
declare task record;m fmz_communication.messages;
begin
 for task in select t.*,r.send_mode,r.send_mode_approved_by,r.send_mode_approved_at from fmz_accounting.billing_plan_tasks t join fmz_accounting.records i on i.org_id=t.org_id and i.id=t.invoice_id and i.kind='invoice' and i.status='posted' and not i.data?'cancellation_id' left join fmz_accounting.billing_plan_rules r on r.org_id=t.org_id and r.client_id=t.client_id where t.status='active' and exists(select 1 from fmz_accounting.files f where f.org_id=t.org_id and f.record_id=t.invoice_id and f.kind='invoice_pdf' and f.status='ready') loop
  begin
   m:=fmz_communication.prepare_invoice(task.org_id,task.invoice_id);
   if task.send_mode='automatic' and task.send_mode_approved_by is not null and task.send_mode_approved_at is not null and m.status='draft' and not m.manual_review_required and nullif(task.warning,'') is null then
    -- A profile address changed before automatic approval also requires a new owner review.
    -- Immutable invoice contact, saved recipient and current verified profile must agree.
    if nullif(btrim(fmz_communication.current_contact(m.org_id,m.document_id,m.kind)),'') is null
       or lower(btrim(m.recipient)) is distinct from lower(btrim(fmz_communication.current_contact(m.org_id,m.document_id,m.kind)))
       or exists(select 1 from fmz_communication.documents d where d.org_id=m.org_id and d.id=m.document_id and d.kind=m.kind and lower(btrim(d.recipient)) is distinct from lower(btrim(fmz_communication.current_contact(m.org_id,m.document_id,m.kind)))) then
     update fmz_accounting.billing_plan_tasks set warning='E-mailadres wijkt af van de definitieve factuur. Controleer en keur de e-mail handmatig opnieuw goed.' where org_id=task.org_id and id=task.id;
     continue;
    end if;
    perform fmz_communication.validate(m.recipient,m.subject,m.body);
   if not fmz_communication.send_allowed(m) then raise exception 'E-mailverzending staat voor dit lid uit';end if;
    select sender into m.sender from fmz_communication.config where id;
    update fmz_communication.messages set automatic_invoice=true,sender=m.sender,status='scheduled',approved_by=task.send_mode_approved_by,approved_at=asof,approved_hash=fmz_communication.message_hash(m),contact_at_approval=fmz_communication.current_contact(m.org_id,m.document_id,m.kind),scheduled_at=(task.send_date::text||' 09:00')::timestamp at time zone 'Europe/Amsterdam',version=version+1 where org_id=m.org_id and id=m.id;
    insert into fmz_communication.audit(org_id,message_id,actor,action,detail) values(m.org_id,m.id,task.send_mode_approved_by,'automatic_rule',jsonb_build_object('ruleApprovedAt',task.send_mode_approved_at));
   end if;
  exception when others then
   -- Isolated bad document: visible task warning; remaining tasks still proceed.
   update fmz_accounting.billing_plan_tasks set warning='E-mailconcept vereist controle van ontvanger en PDF' where org_id=task.org_id and id=task.id;
  end;
 end loop;
end$$;
-- Durable owner reminders do not depend on an open browser or configured mail transport.
create table fmz_communication.preferences(org_id uuid primary key references fmz_accounting.organizations(id),push boolean not null default false,updated_at timestamptz not null default now());
create table fmz_communication.reminders(id uuid primary key default gen_random_uuid(),org_id uuid not null references fmz_accounting.organizations(id),task_id uuid not null,kind text not null check(kind in('billing_prepare','billing_due','billing_test')),period_start date not null,period_end date not null,due_at timestamptz not null,read_at timestamptz,unique(org_id,task_id,kind));
create table fmz_communication.push_deliveries(id uuid primary key default gen_random_uuid(),reminder_id uuid not null references fmz_communication.reminders(id),subscription_id uuid not null,status text not null default 'pending',lease uuid,lease_until timestamptz,attempts integer not null default 0,unique(reminder_id,subscription_id));
alter table fmz_communication.preferences enable row level security;alter table fmz_communication.reminders enable row level security;alter table fmz_communication.push_deliveries enable row level security;
revoke all on fmz_communication.preferences,fmz_communication.reminders,fmz_communication.push_deliveries from public,anon,authenticated;
create function fmz_communication.reminder_tick(asof timestamptz default now()) returns void language plpgsql security definer set search_path='' as $$
begin
 if to_regclass('fmz_accounting.billing_plan_tasks') is null then return;end if;
 perform fmz_accounting.planning_tick((asof at time zone 'Europe/Amsterdam')::date);
 perform fmz_communication.prepare_scheduled(asof);
 insert into fmz_communication.reminders(org_id,task_id,kind,period_start,period_end,due_at)
 select t.org_id,t.id,v.kind,t.start_date,t.end_date,((t.send_date-v.days)::text||' 09:00')::timestamp at time zone 'Europe/Amsterdam'
 from fmz_accounting.billing_plan_tasks t cross join(values('billing_prepare',7),('billing_due',0))v(kind,days)
 where t.status='active' and t.send_date>=(asof at time zone 'Europe/Amsterdam')::date
 and not exists(select 1 from fmz_communication.messages m where m.org_id=t.org_id and m.document_id=t.invoice_id and m.acceptance is not null)
 on conflict do nothing;
 update fmz_communication.reminders r set period_start=t.start_date,period_end=t.end_date,due_at=((t.send_date-case when r.kind='billing_prepare' then 7 else 0 end)::text||' 09:00')::timestamp at time zone 'Europe/Amsterdam' from fmz_accounting.billing_plan_tasks t where t.org_id=r.org_id and t.id=r.task_id and r.kind<>'billing_test' and not exists(select 1 from fmz_communication.push_deliveries d where d.reminder_id=r.id and d.status in('sending','sent'));
 if to_regclass('fmz_agenda.subscriptions') is null then return;end if;
 insert into fmz_communication.push_deliveries(reminder_id,subscription_id)
 select r.id,s.id from fmz_communication.reminders r join fmz_accounting.organizations o on o.id=r.org_id join fmz_communication.preferences p on p.org_id=o.id and p.push
 join fmz_agenda.subscriptions s on s.user_id=o.owner_id join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id
 where (r.kind='billing_test' or exists(select 1 from fmz_accounting.billing_plan_tasks t where t.org_id=r.org_id and t.id=r.task_id and t.status='active')) and s.created_at<=r.due_at and r.due_at<=asof and r.due_at>asof-interval '1 day' on conflict do nothing;
end$$;
create function fmz_communication.reminder_read() returns jsonb language plpgsql security definer set search_path='' as $$declare oid uuid;begin oid:=fmz_accounting.owner_org();return jsonb_build_object('push',coalesce((select push from fmz_communication.preferences where org_id=oid),false),'reminders',(select coalesce(jsonb_agg(to_jsonb(r) order by due_at desc),'[]') from fmz_communication.reminders r where org_id=oid and due_at<=now()));end$$;
create function fmz_communication.reminder_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare oid uuid;rid uuid;begin oid:=fmz_accounting.owner_org();
 if action='preferences' then insert into fmz_communication.preferences(org_id,push) values(oid,coalesce((payload->>'push')::boolean,false)) on conflict(org_id) do update set push=excluded.push,updated_at=now();
 elsif action='read' then update fmz_communication.reminders set read_at=now() where org_id=oid and id=(payload->>'id')::uuid;
 elsif action='test' then
  if request_id is null then raise exception 'Verzoek-ID ontbreekt';end if;
  insert into fmz_communication.reminders(org_id,task_id,kind,period_start,period_end,due_at) values(oid,request_id,'billing_test',current_date,current_date,now()) on conflict do nothing;
 else raise exception 'Onbekende meldingsactie';end if;return fmz_communication.reminder_read();end$$;
create function fmz_communication.push_worker(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 if action='claim' then
  if coalesce((select scheduler_enabled from fmz_communication.config where id),false) then perform fmz_communication.reminder_tick();end if;
  with picked as(select d.id from fmz_communication.push_deliveries d join fmz_communication.reminders r on r.id=d.reminder_id join fmz_accounting.organizations o on o.id=r.org_id join fmz_communication.preferences p on p.org_id=o.id and p.push join fmz_agenda.subscriptions s on s.id=d.subscription_id and s.user_id=o.owner_id join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id where (d.status='pending' or(d.status='sending' and d.lease_until<now())) and d.attempts<3 and r.due_at<=now() and r.due_at>now()-interval '1 day' and (r.kind='billing_test' or exists(select 1 from fmz_accounting.billing_plan_tasks t where t.org_id=r.org_id and t.id=r.task_id and t.status='active' and not exists(select 1 from fmz_communication.messages sent where sent.org_id=t.org_id and sent.document_id=t.invoice_id and sent.purpose='document' and sent.acceptance is not null))) limit 10 for update of d skip locked),claimed as(update fmz_communication.push_deliveries d set status='sending',lease=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1 from picked p where p.id=d.id returning d.*)
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'lease',c.lease,'subscription',s.subscription,'eventId',r.id,'taskId',r.task_id,'kind',r.kind,'period',r.period_start||' t/m '||r.period_end,'expiresAt',r.due_at+interval '1 day')),'[]') into result from claimed c join fmz_agenda.subscriptions s on s.id=c.subscription_id join fmz_communication.reminders r on r.id=c.reminder_id;return result;
 elsif action='check' then return jsonb_build_object('ok',exists(select 1 from fmz_communication.push_deliveries d join fmz_communication.reminders r on r.id=d.reminder_id join fmz_accounting.organizations o on o.id=r.org_id join fmz_communication.preferences p on p.org_id=o.id and p.push join fmz_agenda.subscriptions s on s.id=d.subscription_id and s.user_id=o.owner_id join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id where d.id=(payload->>'id')::uuid and d.lease=(payload->>'lease')::uuid and d.status='sending' and r.due_at<=now() and r.due_at>now()-interval '1 day' and (r.kind='billing_test' or exists(select 1 from fmz_accounting.billing_plan_tasks t where t.org_id=r.org_id and t.id=r.task_id and t.status='active' and not exists(select 1 from fmz_communication.messages sent where sent.org_id=t.org_id and sent.document_id=t.invoice_id and sent.purpose='document' and sent.acceptance is not null)))));
 elsif action='finish' then update fmz_communication.push_deliveries set status=case when (payload->>'code')::int between 200 and 299 then 'sent' else 'failed' end,lease=null,lease_until=null where id=(payload->>'id')::uuid and lease=(payload->>'lease')::uuid;return '{"ok":true}';
 else raise exception 'Onbekende pushactie';end if;
end$$;
create function fmz_communication.dispatch() returns void language plpgsql security definer set search_path='' as $$declare token text;begin
 -- Release gate precedes ALL automatic planning writes and every outbound request.
 if not coalesce((select scheduler_enabled from fmz_communication.config where id),false) then return;end if;
 perform fmz_communication.reminder_tick();
 select decrypted_secret into token from vault.decrypted_secrets where name='appfmz_mail_worker_token';if token is null then return;end if;
 if not exists(select 1 from fmz_communication.messages where status in('scheduled','archive_pending')) and not exists(select 1 from fmz_communication.push_deliveries where status='pending' or(status='sending' and lease_until<now())) then return;end if;
 perform net.http_post(url:='https://hgoygcviutmynaihcvpd.supabase.co/functions/v1/appfmz-mail',headers:=jsonb_build_object('Authorization','Bearer '||token,'Content-Type','application/json'),body:='{}',timeout_milliseconds:=10000);
end$$;
create function public.fmz_billing_reminders_read() returns jsonb language sql security invoker set search_path='' as $$select fmz_communication.reminder_read()$$;
create function public.fmz_billing_reminders_command(action text,payload jsonb,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_communication.reminder_command(action,payload,request_id)$$;
create function public.fmz_communication_push_worker(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select fmz_communication.push_worker(action,payload)$$;
revoke all on all functions in schema fmz_communication from public,anon,authenticated,service_role;
grant execute on function fmz_communication.read(),fmz_communication.command(text,jsonb,uuid),fmz_communication.reminder_read(),fmz_communication.reminder_command(text,jsonb,uuid) to authenticated;
grant execute on function fmz_communication.worker(text,jsonb),fmz_communication.push_worker(text,jsonb) to service_role;
revoke all on function public.fmz_billing_reminders_read(),public.fmz_billing_reminders_command(text,jsonb,uuid),public.fmz_communication_push_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.fmz_billing_reminders_read(),public.fmz_billing_reminders_command(text,jsonb,uuid) to authenticated;
grant execute on function public.fmz_communication_push_worker(text,jsonb) to service_role;
do $$begin if exists(select 1 from pg_available_extensions where name='pg_cron') then perform cron.schedule('appfmz-communication','* * * * *','select fmz_communication.dispatch()');end if;end$$;
-- Contracts appear only after finalization verifies the immutable, signed PDF.
create function fmz_communication.contract_ready() returns trigger language plpgsql security definer set search_path='' as $$
declare a fmz_members.assets;person jsonb;pkg jsonb;mailrow fmz_communication.messages;body text;
begin
 select * into a from fmz_members.assets where id=new.document_id and status='ready' and kind='agreement' and sha256=new.document_hash;
 if not found then raise exception 'Ondertekende overeenkomst-PDF is nog niet bevestigd';end if;
 person:=new.snapshot->'person';pkg:=new.snapshot->'package';
 perform fmz_communication.register_document(new.org_id,new.id,'agreement',person->>'email',new.client_id,'fmz-members',a.path,a.sha256,a.bytes,new.number||'.pdf',new.snapshot||jsonb_build_object('storagePrefix',new.trainer_id::text));
 body:=fmz_communication.agreement_body(new.snapshot,new.number,(select sender from fmz_communication.config where id));
 perform fmz_communication.validate(person->>'email','Je FitMetZorge-overeenkomst '||new.number,body);
 insert into fmz_communication.messages(org_id,document_id,kind,sender,recipient,subject,body,status,approved_by,approved_at,scheduled_at) values(new.org_id,new.id,'agreement',(select sender from fmz_communication.config where id),person->>'email','Je FitMetZorge-overeenkomst '||new.number,body,'scheduled',new.trainer_id,now(),now()) on conflict(org_id,document_id,kind) where purpose='document' do nothing returning * into mailrow;
 if mailrow.id is not null then update fmz_communication.messages set approved_hash=fmz_communication.message_hash(mailrow),contact_at_approval=fmz_communication.current_contact(new.org_id,new.id,'agreement') where org_id=mailrow.org_id and id=mailrow.id;insert into fmz_communication.audit(org_id,message_id,actor,action,detail) values(new.org_id,mailrow.id,new.trainer_id,'agreement_finalized',jsonb_build_object('agreementId',new.id,'documentHash',new.document_hash));end if;
 return new;
end$$;
revoke all on function fmz_communication.contract_ready() from public,anon,authenticated,service_role;
create trigger appfmz_contract_communication after insert on fmz_members.contracts for each row execute function fmz_communication.contract_ready();

create or replace function fmz_members.document_communication(tid uuid,cid text,document_id uuid) returns jsonb language plpgsql set search_path='' as $$
declare m fmz_communication.messages;p public.profiles;
begin
 if not fmz_members.allowed(tid,cid) then raise exception 'Documenttoegang geweigerd' using errcode='42501';end if;
 p:=fmz_private.actor();
 select msg.* into m from fmz_members.contracts c join fmz_communication.messages msg on msg.org_id=c.org_id and msg.document_id=c.id and msg.kind='agreement' and msg.purpose='document' where c.trainer_id=tid and c.client_id=cid and c.id=document_communication.document_id;
 if m.id is null then return null;end if;
 return jsonb_build_object('status',m.status,'messageId',case when p.role='trainer' then m.id else null end,'sentAt',(select max(a.at) from fmz_communication.audit a where a.org_id=m.org_id and a.message_id=m.id and a.action='accepted'),'archived',m.archive is not null);
end$$;
revoke all on function fmz_members.document_communication(uuid,text,uuid) from public,anon,authenticated,service_role;

commit;

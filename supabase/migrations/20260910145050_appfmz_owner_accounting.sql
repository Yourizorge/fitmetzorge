-- Additive owner-only accounting. Existing workspaces, invoices and access boundaries stay intact.
begin;
create schema fmz_accounting;
revoke all on schema fmz_accounting from public,anon,authenticated;
grant usage on schema fmz_accounting to authenticated;

create table fmz_accounting.organizations (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references auth.users(id) on delete restrict,
 name text not null, created_at timestamptz not null default now(), test_marker text,
 next_number bigint not null default 1 check(next_number>0), number_prefix text not null default 'FMZ',
 legacy_reviewed boolean not null default false
);
create table fmz_accounting.accounts (
 org_id uuid not null references fmz_accounting.organizations(id), code text not null,
 name text not null, category text not null check(category in ('asset','liability','equity','income','expense')),
 primary key(org_id,code)
);
create table fmz_accounting.records (
 org_id uuid not null references fmz_accounting.organizations(id), id uuid not null,
 kind text not null check(kind in ('invoice','expense','bank','allocation','transfer','private','asset','loan','depreciation','correction','opening','account','settings','period','import','reconciliation','legacy')),
 date date not null, status text not null default 'draft', version bigint not null default 1,
 data jsonb not null, parent_id uuid, source_key text, number text,
 created_at timestamptz not null default now(), created_by uuid not null references auth.users(id) on delete restrict,
 primary key(org_id,id), foreign key(org_id,parent_id) references fmz_accounting.records(org_id,id),
 unique(org_id,number), unique(org_id,kind,source_key)
);
create index acc_records_date_kind on fmz_accounting.records(org_id,date,kind);
create table fmz_accounting.journals (
 org_id uuid not null, id uuid not null default gen_random_uuid(), record_id uuid not null,
 date date not null, description text not null, created_at timestamptz not null default now(),
 primary key(org_id,id), foreign key(org_id,record_id) references fmz_accounting.records(org_id,id)
);
create index acc_journals_period on fmz_accounting.journals(org_id,date);
create table fmz_accounting.lines (
 org_id uuid not null, journal_id uuid not null, line_no integer not null,
 account_code text not null, cents bigint not null check(abs(cents)<=900000000000), reference_id uuid,
 primary key(org_id,journal_id,line_no), foreign key(org_id,journal_id) references fmz_accounting.journals(org_id,id),
 foreign key(org_id,account_code) references fmz_accounting.accounts(org_id,code)
);
create index acc_lines_account on fmz_accounting.lines(org_id,account_code);
create index acc_lines_reference on fmz_accounting.lines(org_id,reference_id);
create table fmz_accounting.files (
 org_id uuid not null references fmz_accounting.organizations(id), id uuid not null,
 record_id uuid, kind text not null, original_name text not null, mime text not null, bytes bigint not null check(bytes between 1 and 12000000),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), path text not null unique, status text not null default 'reserved',
 retention_class text not null default 'basis' check(retention_class in ('basis','onroerend','oss','contract','overig')),
 active_until date, keep_until date, created_at timestamptz not null default now(),
 primary key(org_id,id), foreign key(org_id,record_id) references fmz_accounting.records(org_id,id)
);
create index acc_files_record on fmz_accounting.files(org_id,record_id);
create table fmz_accounting.audit (
 id bigint generated always as identity primary key, org_id uuid not null references fmz_accounting.organizations(id),
 actor_id uuid not null references auth.users(id) on delete restrict, at timestamptz not null default now(),
 action text not null, request_id uuid, detail jsonb not null
);
create index acc_audit_org on fmz_accounting.audit(org_id,id);
create table fmz_accounting.receipts (
 org_id uuid not null references fmz_accounting.organizations(id), request_id uuid not null, payload_hash text not null,
 result jsonb not null, at timestamptz not null default now(), primary key(org_id,request_id)
);

do $$declare t text;begin
 foreach t in array array['organizations','accounts','records','journals','lines','files','audit','receipts'] loop
  execute format('alter table fmz_accounting.%I enable row level security',t);
  execute format('revoke all on fmz_accounting.%I from public,anon,authenticated',t);
 end loop;
end $$;

-- Reject fractional cents before PostgreSQL can round a numeric cast to bigint.
create function fmz_accounting.check_numbers(body jsonb) returns void language plpgsql set search_path='' as $$
declare k text; v jsonb;
begin
 if jsonb_typeof(body)='object' then
  for k,v in select * from jsonb_each(body) loop
   if k ~ '(cents|Cents|_bp|_points)$' and v<>'null'::jsonb then
    if jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric<>trunc((v#>>'{}')::numeric) or abs((v#>>'{}')::numeric)>900000000000 then raise exception 'Geld en percentages vereisen gehele centen/basispunten';end if;
   end if;
   perform fmz_accounting.check_numbers(v);
  end loop;
 elsif jsonb_typeof(body)='array' then
  for v in select value from jsonb_array_elements(body) loop perform fmz_accounting.check_numbers(v);end loop;
 end if;
end $$;

create function fmz_accounting.owner_org() returns uuid language plpgsql security definer set search_path='' as $$
declare p public.profiles; oid uuid;
begin
 p:=fmz_private.actor();
 if p.role<>'trainer' or not exists(select 1 from auth.users where id=p.id and email_confirmed_at is not null) then
  raise exception 'Verified owner required' using errcode='42501';
 end if;
 select id into oid from fmz_accounting.organizations where owner_id=p.id;
 if oid is null then raise exception 'Owner administration denied' using errcode='42501';end if;
 return oid;
end $$;

-- Only an administrator can provision the verified owner, or an explicitly marked isolated test owner.
create function fmz_accounting.provision(owner_user uuid, business_name text, marker text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare oid uuid; item jsonb; legacy jsonb; n bigint;
begin
 if not exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=owner_user and u.email_confirmed_at is not null and p.role='trainer') then raise exception 'Verified owner missing';end if;
 if marker is not null and not exists(select 1 from auth.users where id=owner_user and raw_user_meta_data->>'fmz_release'=marker) then raise exception 'Test marker mismatch';end if;
 select id into oid from fmz_accounting.organizations where owner_id=owner_user;if found then return oid;end if;
 select coalesce(state->'trainerFinance','{}') into legacy from public.coach_workspaces where trainer_id=owner_user;
 select greatest(coalesce((legacy->>'invoiceSequenceNext')::bigint,1),coalesce(max((substring(v->>'invoiceNo' from '^FMZ-[0-9]{4}-([0-9]+)$'))::bigint)+1,1)) into n from jsonb_array_elements(coalesce(legacy->'adminItems','[]')) v;
 insert into fmz_accounting.organizations(owner_id,name,test_marker,next_number) values(owner_user,business_name,marker,n) returning id into oid;
 for item in select value from jsonb_array_elements('[
 ["1000","Zakelijke bank","asset"],["1010","Kas","asset"],["1100","Debiteuren","asset"],["1200","Voorbelasting","asset"],
 ["1300","Bedrijfsmiddelen","asset"],["1390","Cumulatieve afschrijving","asset"],["1400","Ongekoppelde bankmutaties","asset"],
 ["1600","Crediteuren","liability"],["1700","Leningen en schulden","liability"],["1800","Btw verkopen / verlegd","liability"],["1900","Vooruitbetaald door privé","liability"],
 ["2000","Beginvermogen / correctie eigen vermogen","equity"],["2010","Privéstortingen","equity"],["2020","Privéopnames / privédeel","equity"],
 ["4000","Omzet dienstverlening","income"],["5000","Overige zakelijke kosten","expense"],["5010","Bankkosten","expense"],["5020","Reiskosten","expense"],["5030","Huisvesting","expense"],["5040","Materiaal en apparatuur","expense"],["5800","Afschrijvingskosten","expense"]]'::jsonb) loop
  insert into fmz_accounting.accounts values(oid,item->>0,item->>1,item->>2);
 end loop;
 insert into fmz_accounting.records(org_id,id,kind,date,status,data,created_by) values(oid,gen_random_uuid(),'legacy',current_date,'unreviewed',jsonb_build_object('finance',coalesce(legacy,'{}'),'note','Historische bron; nog niet als grootboek geboekt'),owner_user);
 insert into fmz_accounting.records(org_id,id,kind,date,status,data,created_by) values(oid,gen_random_uuid(),'settings',current_date,'unconfirmed',coalesce(legacy->'invoiceSettings','{}')||jsonb_build_object('confirmed',false,'vat_status','unknown','vat_method','unknown','vat_period','unknown'),owner_user);
 insert into fmz_accounting.audit(org_id,actor_id,action,detail) values(oid,owner_user,'provision',jsonb_build_object('verified_owner',true,'legacy_posted',false));
 return oid;
end $$;

create function fmz_accounting.open_date(oid uuid, d date) returns void language plpgsql set search_path='' as $$
begin
 if exists(select 1 from fmz_accounting.records where org_id=oid and kind='period' and status='closed' and d between (data->>'from')::date and (data->>'to')::date) then
  raise exception 'Periode is afgesloten. Heropen met reden of boek een correctie in een open periode.' using errcode='PT409';
 end if;
end $$;
create function fmz_accounting.post(oid uuid,rid uuid,d date,memo text,items jsonb) returns uuid language plpgsql set search_path='' as $$
declare jid uuid; item jsonb; i integer:=0; total numeric;
begin
 perform fmz_accounting.open_date(oid,d);
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)<2 then raise exception 'Minimaal twee boekingsregels vereist';end if;
 select sum((v->>1)::bigint) into total from jsonb_array_elements(items) v;
 if total is distinct from 0 then raise exception 'Debet en credit sluiten niet aan';end if;
 insert into fmz_accounting.journals(org_id,record_id,date,description) values(oid,rid,d,memo) returning id into jid;
 for item in select value from jsonb_array_elements(items) loop
  i:=i+1;
  if jsonb_typeof(item->1)<>'number' or (item->>1)::numeric<>trunc((item->>1)::numeric) then raise exception 'Gehele centen vereist';end if;
  insert into fmz_accounting.lines values(oid,jid,i,item->>0,(item->>1)::bigint,nullif(item->>2,'')::uuid);
 end loop;
 return jid;
end $$;

create function fmz_accounting.balance(oid uuid,code text,rid uuid default null) returns bigint language sql stable set search_path='' as $$
 select coalesce(sum(cents),0)::bigint from fmz_accounting.lines where org_id=oid and account_code=code and (rid is null or reference_id=rid)
$$;

create function fmz_accounting.snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
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
 'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from fmz_accounting.audit a where org_id=oid)
 );
end $$;

create function fmz_accounting.storage_allowed(object_name text, writing boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare oid uuid;
begin
 oid:=fmz_accounting.owner_org();
 return exists(select 1 from fmz_accounting.files where org_id=oid and path=object_name and (not writing or status='reserved'));
exception when insufficient_privilege or invalid_authorization_specification then return false;
end $$;

-- Storage buckets are private; original objects have INSERT/SELECT only, no overwrite/delete policy.
insert into storage.buckets(id,name,public,file_size_limit) values('fmz-finance','fmz-finance',false,12000000);
create policy fmz_finance_owner_read on storage.objects for select to authenticated using(bucket_id='fmz-finance' and fmz_accounting.storage_allowed(name,false));
create policy fmz_finance_owner_insert on storage.objects for insert to authenticated with check(bucket_id='fmz-finance' and fmz_accounting.storage_allowed(name,true));

-- Commands are added below before grants/commit.
create function fmz_accounting.add_record(oid uuid,rid uuid,k text,d date,body jsonb,st text default 'posted',parent uuid default null,source text default null)
returns fmz_accounting.records language plpgsql set search_path='' as $$
declare r fmz_accounting.records;
begin
 insert into fmz_accounting.records(org_id,id,kind,date,status,data,parent_id,source_key,created_by)
 values(oid,rid,k,d,st,body,parent,source,auth.uid()) returning * into r;
 return r;
end $$;

create function fmz_accounting.final_invoice(oid uuid,rid uuid,expected bigint) returns jsonb language plpgsql set search_path='' as $$
declare r fmz_accounting.records; original fmz_accounting.records; s fmz_accounting.records; body jsonb; doc jsonb;
 gross bigint; discount bigint; total bigint; net bigint; vat bigint; rate bigint; term integer; qty numeric; no text; nextno bigint;
 credit boolean; remaining bigint; credited_before bigint:=0; factor integer:=1; d date;
begin
 select * into r from fmz_accounting.records where org_id=oid and id=rid and kind='invoice' for update;
 if r.id is null then raise exception 'Concept ontbreekt';end if;
 if r.status='posted' then return to_jsonb(r);end if;
 if r.version is distinct from expected then raise exception 'Concept elders gewijzigd' using errcode='PT409';end if;
 body:=r.data;d:=(body->>'date')::date;perform fmz_accounting.open_date(oid,d);
 credit:=nullif(body->>'credit_of','') is not null;
 if credit then
  select * into original from fmz_accounting.records where org_id=oid and id=(body->>'credit_of')::uuid and kind='invoice' and status='posted' and parent_id is null;
  if original.id is null then raise exception 'Oorspronkelijke factuur ontbreekt';end if;
  doc:=original.data->'document';s.data:=doc->'settings';factor:=-1;
  gross:=(body->>'gross_cents')::bigint;discount:=0;
  select (doc->>'totalCents')::bigint+coalesce(sum((data#>>'{document,totalCents}')::bigint),0) into remaining from fmz_accounting.records where org_id=oid and parent_id=original.id and kind='invoice' and status='posted';
  credited_before:=(doc->>'totalCents')::bigint-remaining;
  if gross<=0 or gross>remaining then raise exception 'Creditbedrag hoger dan nog te corrigeren bedrag';end if;
  if length(trim(coalesce(body->>'description','')))<3 then raise exception 'Reden creditfactuur vereist';end if;
  rate:=(doc->>'vatBasisPoints')::bigint;
  body:=body||jsonb_build_object('customer',doc->'customer','service_date',doc->>'serviceDate','service_extent',doc->>'serviceExtent','quantity',1,'packageLabel',doc->>'packageLabel');
 else
  select * into s from fmz_accounting.records where org_id=oid and kind='settings' and status='confirmed' and date<=d order by date desc,created_at desc limit 1;
  if s.id is null or coalesce((s.data->>'confirmed')::boolean,false)=false then raise exception 'Controleer eerst bedrijfs- en fiscale instellingen met ingangsdatum';end if;
  gross:=(body->>'gross_cents')::bigint;discount:=(body->>'discount_cents')::bigint;
  if gross is null or discount is null or gross<0 or discount<0 or discount>gross or gross>900000000000 then raise exception 'Ongeldig bedrag of korting';end if;
  rate:=case when s.data->>'vat_status' in ('kor','exempt') then 0 else (s.data->>'vat_basis_points')::bigint end;
  if rate is null or rate not in (0,900,2100) then raise exception 'Bevestigd btw-tarief ontbreekt';end if;
 end if;
 if trim(coalesce(s.data->>'businessName',''))='' or trim(coalesce(s.data->>'address',''))='' or trim(coalesce(s.data->>'postalCity',''))='' then raise exception 'Bedrijfsnaam en volledig bedrijfsadres ontbreken';end if;
 if coalesce((s.data->>'kvk_registered')::boolean,true) and trim(coalesce(s.data->>'chamberNumber',''))='' then raise exception 'KVK-nummer ontbreekt';end if;
 if s.data->>'vat_status'='standard' and trim(coalesce(s.data->>'vatNumber',''))='' then raise exception 'Btw-identificatienummer ontbreekt';end if;
 if trim(coalesce(body#>>'{customer,name}',''))='' or trim(coalesce(body#>>'{customer,address}',''))='' then raise exception 'Klantnaam en volledig klantadres ontbreken';end if;
 if trim(coalesce(body->>'description',''))='' or trim(coalesce(body->>'service_extent',''))='' or nullif(body->>'service_date','') is null then raise exception 'Omschrijving, omvang en leverdatum/vooruitbetalingsdatum vereist';end if;
 perform (body->>'service_date')::date;
 qty:=(body->>'quantity')::numeric;if qty is null or qty<=0 then raise exception 'Positieve hoeveelheid vereist';end if;
 term:=(body->>'term_days')::integer;if term is null or term not between 0 and 3650 then raise exception 'Ongeldige betaaltermijn';end if;
 total:=gross-discount;net:=round((credited_before+total)::numeric*10000/(10000+rate))-round(credited_before::numeric*10000/(10000+rate));vat:=total-net;
 select next_number into nextno from fmz_accounting.organizations where id=oid for update;
 no:='FMZ-'||extract(year from d)::integer::text||'-'||lpad(nextno::text,greatest(4,length(nextno::text)),'0');
 update fmz_accounting.organizations set next_number=next_number+1 where id=oid;
 doc:=jsonb_build_object('version',2,'invoiceNo',no,'description',body->>'description','discountNote',coalesce(body->>'discountNote',''),
 'date',d,'dueDate',d+term,'paymentTermDays',term,'settings',s.data,'settingsId',s.id,'customer',body->'customer','packageLabel',coalesce(body->>'packageLabel',''),
 'serviceDate',body->>'service_date','serviceExtent',body->>'service_extent','quantity',qty,'grossCents',gross*factor,'discountCents',discount*factor,
 'netCents',net*factor,'vatCents',vat*factor,'totalCents',total*factor,'vatBasisPoints',rate,'creditOf',original.number,
 'vatStatus',s.data->>'vat_status','vatMethod',s.data->>'vat_method','logo',body->'logo');
 update fmz_accounting.records set status='posted',date=d,number=no,parent_id=original.id,version=version+1,data=body||jsonb_build_object('document',doc) where org_id=oid and id=rid returning * into r;
 perform fmz_accounting.post(oid,rid,d,no,jsonb_build_array(jsonb_build_array('1100',total*factor,coalesce(original.id,rid)),jsonb_build_array('4000',-net*factor,rid),jsonb_build_array('1800',-vat*factor,rid)));
 return to_jsonb(r);
end $$;

create function fmz_accounting.expense(oid uuid,rid uuid,body jsonb) returns jsonb language plpgsql set search_path='' as $$
declare gross bigint; business bigint; input_tax bigint:=0; charge_tax bigint:=0; cost bigint; private_part bigint; claim bigint;
 share integer; deduct integer; treatment text; code text; control text; d date; proof boolean; flags jsonb:='[]'; r fmz_accounting.records;
begin
 d:=(body->>'date')::date;gross:=(body->>'gross_cents')::bigint;share:=(body->>'business_bp')::integer;deduct:=coalesce((body->>'deductible_bp')::integer,0);
 if gross is null or gross<=0 or gross>900000000000 or share is null or share not between 0 and 10000 or deduct not between 0 and 10000 then raise exception 'Ongeldige uitgave/zakelijk aandeel';end if;
 if trim(coalesce(body->>'supplier',''))='' or trim(coalesce(body->>'description',''))='' then raise exception 'Leverancier en omschrijving vereist';end if;
 treatment:=body->>'vat_treatment';
 if treatment is null or treatment not in ('21','9','zero','exempt','kor','non_deductible','reverse','unknown') then raise exception 'Kies btw-behandeling';end if;
 code:=coalesce(body->>'category','5000');if not exists(select 1 from fmz_accounting.accounts where org_id=oid and accounts.code=coalesce(body->>'category','5000') and category='expense') then raise exception 'Ongeldige kostencategorie';end if;
 proof:=exists(select 1 from fmz_accounting.files where org_id=oid and id=nullif(body->>'file_id','')::uuid and status='ready');
 if not proof then flags:=flags||'"Bewijs ontbreekt"'::jsonb;end if;
 if treatment='unknown' then flags:=flags||'"Btw-behandeling onbekend"'::jsonb;end if;
 business:=round(gross::numeric*share/10000);private_part:=gross-business;
 if treatment in ('21','9') then
  claim:=(body->>'vat_cents')::bigint;
  if claim is null or claim<0 or claim>gross then raise exception 'Controleer btw-bedrag op het bewijs';end if;
  if proof then input_tax:=round(round(claim::numeric*share/10000)*deduct/10000);end if;
 elsif treatment='reverse' then
  charge_tax:=(body->>'charge_vat_cents')::bigint;claim:=(body->>'vat_cents')::bigint;
  if charge_tax is null or charge_tax<0 or claim is null or claim<0 or claim>charge_tax then raise exception 'Controleer verschuldigde en aftrekbare verlegde btw';end if;
  charge_tax:=round(charge_tax::numeric*share/10000);
  if proof then input_tax:=round(round(claim::numeric*share/10000)*deduct/10000);end if;
  if not coalesce((body->>'reverse_confirmed')::boolean,false) then flags:=flags||'"Verlegde btw fiscaal controleren"'::jsonb;end if;
 end if;
 if exists(select 1 from fmz_accounting.records where org_id=oid and kind='settings' and date<=d and status='confirmed' and data->>'vat_status'='kor' and id=(select id from fmz_accounting.records where org_id=oid and kind='settings' and date<=d and status='confirmed' order by date desc,created_at desc limit 1)) then input_tax:=0;end if;
 if not exists(select 1 from fmz_accounting.records where org_id=oid and kind='settings' and date<=d and status='confirmed') then input_tax:=0;flags:=flags||'"Fiscale instellingen ontbreken"'::jsonb;end if;
 cost:=business+charge_tax-input_tax;
 control:=case when body->>'paid_privately'='true' then '1900' else '1600' end;
 if control='1900' then private_part:=0;end if;
 r:=fmz_accounting.add_record(oid,rid,'expense',d,body||jsonb_build_object('business_cents',business,'input_vat_cents',input_tax,'charge_vat_cents',charge_tax,'cost_cents',cost,'payable_cents',business+private_part,'control',control,'flags',flags));
 perform fmz_accounting.post(oid,rid,d,body->>'description',jsonb_build_array(jsonb_build_array(code,cost,rid),jsonb_build_array('1200',input_tax,rid),jsonb_build_array('1800',-charge_tax,rid),jsonb_build_array('2020',private_part,rid),jsonb_build_array(control,-business-private_part,rid)));
 if proof then update fmz_accounting.files set record_id=rid where org_id=oid and id=(body->>'file_id')::uuid and record_id is null;end if;
 return to_jsonb(r);
end $$;

create function fmz_accounting.bank(oid uuid,rid uuid,body jsonb,source text default null) returns jsonb language plpgsql set search_path='' as $$
declare account fmz_accounting.records; r fmz_accounting.records; amount bigint; d date;
begin
 select * into account from fmz_accounting.records where org_id=oid and id=(body->>'account_id')::uuid and kind='account';
 if account.id is null then raise exception 'Kies bank- of kasrekening';end if;
 d:=(body->>'date')::date;amount:=(body->>'cents')::bigint;if amount is null or amount=0 or abs(amount)>900000000000 then raise exception 'Ongeldige bankmutatie';end if;
 if account.data->>'opening_date' is not null and d<(account.data->>'opening_date')::date then raise exception 'Mutatie valt voor de ingevoerde beginstand';end if;
 r:=fmz_accounting.add_record(oid,rid,'bank',d,body||jsonb_build_object('account_code',account.data->>'code'),'posted',null,source);
 perform fmz_accounting.post(oid,rid,d,coalesce(body->>'description','Bankmutatie'),jsonb_build_array(jsonb_build_array(account.data->>'code',amount,rid),jsonb_build_array('1400',-amount,rid)));
 return to_jsonb(r);
end $$;

create function fmz_accounting.allocate(oid uuid,rid uuid,body jsonb) returns jsonb language plpgsql set search_path='' as $$
declare bank fmz_accounting.records; target fmz_accounting.records; r fmz_accounting.records; part jsonb; items jsonb:='[]'; total bigint:=0; amount bigint; available bigint; outstanding bigint; sign integer; code text; d date; typ text;
begin
 select * into bank from fmz_accounting.records where org_id=oid and id=(body->>'bank_id')::uuid and kind='bank';if bank.id is null then raise exception 'Bankmutatie ontbreekt';end if;
 d:=(body->>'date')::date;if d<bank.date then raise exception 'Koppeldatum ligt voor bankmutatie';end if;
 sign:=case when (bank.data->>'cents')::bigint>0 then 1 else -1 end;
 available:=abs(fmz_accounting.balance(oid,'1400',bank.id));
 if jsonb_typeof(body->'parts')<>'array' or jsonb_array_length(body->'parts') not between 1 and 50 then raise exception 'Kies verdeling';end if;
 for part in select value from jsonb_array_elements(body->'parts') loop
  amount:=(part->>'cents')::bigint;typ:=part->>'type';
  if amount is null or amount<=0 then raise exception 'Positief deelbedrag vereist';end if;
  total:=total+amount;if total>available then raise exception 'Meer gekoppeld dan beschikbaar' using errcode='PT409';end if;
  target:=null;
  if typ='invoice' then
   select * into target from fmz_accounting.records where org_id=oid and id=(part->>'target_id')::uuid and kind='invoice' and status='posted' and parent_id is null;
   if target.id is null then raise exception 'Definitieve verkoopfactuur ontbreekt';end if;
   code:='1100';outstanding:=fmz_accounting.balance(oid,code,target.id);
   if (sign=1 and amount>outstanding) or (sign=-1 and amount> -outstanding) then raise exception 'Betaling hoger dan openstaand/terug te betalen bedrag' using errcode='PT409';end if;
  elsif typ='expense' then
   select * into target from fmz_accounting.records where org_id=oid and id=(part->>'target_id')::uuid and kind='expense';
   if target.id is null then raise exception 'Kies een uitgave';end if;
   code:=target.data->>'control';outstanding:=-fmz_accounting.balance(oid,code,target.id);
   if (sign=-1 and amount>outstanding) or (sign=1 and amount> -outstanding) then raise exception 'Uitgave/privévoorschot reeds vergoed of terugbetaling te hoog' using errcode='PT409';end if;
  elsif typ='deposit' then
   if sign<>1 then raise exception 'Privéstorting is een ontvangst';end if;code:='2010';
  elsif typ='withdrawal' then
   if sign<>-1 then raise exception 'Privéopname is een uitgave';end if;code:='2020';
  elsif typ='loan' then
   select * into target from fmz_accounting.records where org_id=oid and id=(part->>'target_id')::uuid and kind='loan';if target.id is null then raise exception 'Lening ontbreekt';end if;
   code:='1700';if sign=-1 and amount> -fmz_accounting.balance(oid,code,target.id) then raise exception 'Aflossing hoger dan schuld';end if;
  else raise exception 'Onbekende koppeling';end if;
  -- Posting each part immediately also prevents duplicate targets exceeding their balance in one split.
  if r.id is null then r:=fmz_accounting.add_record(oid,rid,'allocation',d,body,'posted',bank.id);end if;
  perform fmz_accounting.post(oid,rid,d,coalesce(body->>'description','Betaling koppelen'),jsonb_build_array(jsonb_build_array('1400',amount*sign,bank.id),jsonb_build_array(code,-amount*sign,coalesce(target.id,rid))));
 end loop;
 return to_jsonb(r);
end $$;

create function fmz_accounting.command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare oid uuid; rid uuid; r fmz_accounting.records; other fmz_accounting.records; f fmz_accounting.files;
 before_value jsonb; result jsonb; receipt fmz_accounting.receipts; hash text; body jsonb; item jsonb;
 amount bigint; available bigint; code text; d date; n integer; lines jsonb; ids jsonb:='[]'; skipped integer:=0;
begin
 oid:=fmz_accounting.owner_org();
 if request_id is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>10000000 then raise exception 'Ongeldige aanvraag';end if;
 perform 1 from fmz_accounting.organizations where id=oid for update;
 hash:=md5(action||':'||payload::text);
 select * into receipt from fmz_accounting.receipts where org_id=oid and receipts.request_id=command.request_id;
 if found then
  if receipt.payload_hash<>hash then raise exception 'Aanvraag-ID is reeds voor andere gegevens gebruikt' using errcode='PT409';end if;
  return receipt.result;
 end if;
 perform fmz_accounting.check_numbers(payload);
 rid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());body:=coalesce(payload->'data',payload);d:=coalesce(nullif(body->>'date','')::date,current_date);
 select * into r from fmz_accounting.records where org_id=oid and id=rid;
 before_value:=to_jsonb(r);
 if action='draft' then
  if r.id is null then
   if coalesce((payload->>'version')::bigint,0)<>0 then raise exception 'Concept ontbreekt' using errcode='PT409';end if;
   r:=fmz_accounting.add_record(oid,rid,'invoice',d,body-'document','draft');
  else
   if r.kind<>'invoice' or r.status<>'draft' then raise exception 'Definitieve factuur is onveranderlijk. Maak een creditfactuur.' using errcode='PT409';end if;
   if r.version is distinct from (payload->>'version')::bigint then raise exception 'Concept elders gewijzigd. Ververs en vergelijk je invoer.' using errcode='PT409';end if;
   update fmz_accounting.records set data=body-'document',date=d,version=version+1 where org_id=oid and id=rid returning * into r;
  end if;
  result:=to_jsonb(r);
 elsif action='final_invoice' then
  result:=fmz_accounting.final_invoice(oid,rid,(payload->>'version')::bigint);
 elsif action='settings' then
  if coalesce(body->>'vat_status','') not in ('standard','kor','exempt') or coalesce(body->>'vat_method','') not in ('invoice','cash') or coalesce(body->>'vat_period','') not in ('month','quarter','year','none') or body->>'confirmed' is distinct from 'true' then raise exception 'Bevestig btw/KOR, methode, periode en ingangsdatum';end if;
  if nullif(body->>'date','') is null or nullif(trim(body->>'businessName'),'') is null then raise exception 'Bedrijfsnaam en ingangsdatum vereist';end if;
  if coalesce((body->>'vat_basis_points')::integer,-1) not in (0,900,2100) then raise exception 'Controleer btw-tarief';end if;
  perform fmz_accounting.open_date(oid,d);
  -- Dated settings never modify already issued documents or previously confirmed settings.
  r:=fmz_accounting.add_record(oid,rid,'settings',d,body,'confirmed');result:=to_jsonb(r);
 elsif action='expense' then result:=fmz_accounting.expense(oid,rid,body);
 elsif action='bank' then result:=fmz_accounting.bank(oid,rid,body);
 elsif action='allocate' then result:=fmz_accounting.allocate(oid,rid,body);
 elsif action='private' then
  if body->>'direction' not in ('deposit','withdrawal') then raise exception 'Kies privéstorting of privéopname';end if;
  amount:=(body->>'cents')::bigint;if amount is null or amount<=0 then raise exception 'Positief bedrag vereist';end if;
  result:=fmz_accounting.bank(oid,rid,body||jsonb_build_object('cents',case when body->>'direction'='deposit' then amount else -amount end));
  perform fmz_accounting.allocate(oid,gen_random_uuid(),jsonb_build_object('bank_id',rid,'date',d,'description',body->>'description','parts',jsonb_build_array(jsonb_build_object('type',body->>'direction','cents',amount))));
 elsif action='account' then
  if trim(coalesce(body->>'name',''))='' or coalesce(body->>'type','') not in ('bank','cash') then raise exception 'Naam en rekeningtype vereist';end if;
  select 1000+count(*) into n from fmz_accounting.records where org_id=oid and kind='account';code:=(10000+n)::text;
  insert into fmz_accounting.accounts values(oid,code,body->>'name','asset');
  r:=fmz_accounting.add_record(oid,rid,'account',d,body||jsonb_build_object('code',code,'opening_cents',null,'opening_date',null));result:=to_jsonb(r);
 elsif action='opening' then
  select * into other from fmz_accounting.records where org_id=oid and id=(body->>'account_id')::uuid and kind='account';
  if other.id is null then raise exception 'Rekening ontbreekt';end if;
  if other.data->>'opening_date' is not null then raise exception 'Beginstand bestaat; gebruik een traceerbare correctie' using errcode='PT409';end if;
  amount:=(body->>'cents')::bigint;if amount is null or nullif(body->>'date','') is null then raise exception 'Bevestig bedrag en datum beginstand';end if;
  if exists(select 1 from fmz_accounting.records where org_id=oid and kind='bank' and data->>'account_id'=other.id::text and date<d) then raise exception 'Beginstand valt na bestaande mutaties';end if;
  r:=fmz_accounting.add_record(oid,rid,'opening',d,body,'posted',other.id);
  perform fmz_accounting.post(oid,rid,d,'Beginstand '||(other.data->>'name'),jsonb_build_array(jsonb_build_array(other.data->>'code',amount,other.id),jsonb_build_array('2000',-amount,other.id)));
  update fmz_accounting.records set data=data||jsonb_build_object('opening_cents',amount,'opening_date',d),version=version+1 where org_id=oid and id=other.id;
  result:=to_jsonb(r);
 elsif action='import' then
  select * into f from fmz_accounting.files where org_id=oid and id=(body->>'file_id')::uuid and status='ready';if f.id is null then raise exception 'Origineel importbestand ontbreekt';end if;
  if jsonb_typeof(body->'rows')<>'array' or jsonb_array_length(body->'rows') not between 1 and 2000 then raise exception 'Importeer 1 tot 2000 regels per bestand';end if;
  r:=fmz_accounting.add_record(oid,rid,'import',d,body-'rows'||jsonb_build_object('row_count',jsonb_array_length(body->'rows')));
  for item in select value from jsonb_array_elements(body->'rows') loop
   if nullif(item->>'source_key','') is null then raise exception 'Transactieherkenning ontbreekt';end if;
   if exists(select 1 from fmz_accounting.records where org_id=oid and kind='bank' and source_key=item->>'source_key') then skipped:=skipped+1;
   else
    result:=fmz_accounting.bank(oid,(item->>'id')::uuid,item||jsonb_build_object('import_id',rid,'file_id',f.id),item->>'source_key');ids:=ids||jsonb_build_array(result->>'id');
   end if;
  end loop;
  update fmz_accounting.files set record_id=rid where org_id=oid and id=f.id and record_id is null;
  update fmz_accounting.records set data=data||jsonb_build_object('imported_ids',ids,'skipped',skipped) where org_id=oid and id=rid returning * into r;result:=to_jsonb(r);
 elsif action='transfer' then
  select * into r from fmz_accounting.records where org_id=oid and id=(body->>'from_id')::uuid and kind='bank';
  select * into other from fmz_accounting.records where org_id=oid and id=(body->>'to_id')::uuid and kind='bank';
  if r.id is null or other.id is null or r.data->>'account_id'=other.data->>'account_id' or (r.data->>'cents')::bigint>=0 or (other.data->>'cents')::bigint<=0 then raise exception 'Kies uitgaande en inkomende mutatie op verschillende eigen rekeningen';end if;
  amount:=(body->>'cents')::bigint;
  if amount is null or amount<=0 or amount>fmz_accounting.balance(oid,'1400',r.id) or amount> -fmz_accounting.balance(oid,'1400',other.id) then raise exception 'Bedrag niet beschikbaar voor overboeking' using errcode='PT409';end if;
  if d<greatest(r.date,other.date) then raise exception 'Koppeldatum ligt voor de bankmutaties';end if;
  perform fmz_accounting.add_record(oid,rid,'transfer',d,body);
  perform fmz_accounting.post(oid,rid,d,'Overboeking eigen rekeningen',jsonb_build_array(jsonb_build_array('1400',-amount,r.id),jsonb_build_array('1400',amount,other.id)));
  select to_jsonb(x) into result from fmz_accounting.records x where org_id=oid and id=rid;
 elsif action in ('asset','loan') then
  amount:=(body->>'cents')::bigint;
  if trim(coalesce(body->>'description',''))='' or amount is null or amount<=0 then raise exception 'Omschrijving en positief bedrag vereist';end if;
  r:=fmz_accounting.add_record(oid,rid,action,d,body);
  if action='asset' then
   if coalesce((body->>'residual_cents')::bigint,-1) not between 0 and amount then raise exception 'Bevestig restwaarde';end if;
   if nullif(body->>'expense_id','') is not null then
    select * into other from fmz_accounting.records where org_id=oid and id=(body->>'expense_id')::uuid and kind='expense';
    select coalesce(sum((data->>'cents')::bigint),0) into available from fmz_accounting.records where org_id=oid and kind='asset' and id<>rid and data->>'expense_id'=other.id::text;
    if other.id is null or amount+available>(other.data->>'cost_cents')::bigint then raise exception 'Bedrijfsmiddel hoger dan beschikbare aanschafkosten';end if;
    code:=other.data->>'category';
   else
    if body->>'opening_confirmed' is distinct from 'true' then raise exception 'Bevestig dat dit een bestaande bezitting op de beginbalans is';end if;code:='2000';
   end if;
   perform fmz_accounting.post(oid,rid,d,'Activering: '||(body->>'description'),jsonb_build_array(jsonb_build_array('1300',amount,rid),jsonb_build_array(code,-amount,coalesce(other.id,rid))));
  elsif body->>'opening_confirmed'='true' then
   perform fmz_accounting.post(oid,rid,d,'Bestaande schuld: '||(body->>'description'),jsonb_build_array(jsonb_build_array('2000',amount,rid),jsonb_build_array('1700',-amount,rid)));
  end if;result:=to_jsonb(r);
 elsif action='depreciation' then
  select * into other from fmz_accounting.records where org_id=oid and id=(body->>'asset_id')::uuid and kind='asset';amount:=(body->>'cents')::bigint;
  available:=fmz_accounting.balance(oid,'1300',other.id)+fmz_accounting.balance(oid,'1390',other.id)-coalesce((other.data->>'residual_cents')::bigint,0);
  if other.id is null or amount is null or amount<=0 or amount>available or d<other.date or length(trim(coalesce(body->>'description','')))<3 then raise exception 'Controleer bedrijfsmiddel, bedrag, datum en afschrijvingsgrondslag';end if;
  r:=fmz_accounting.add_record(oid,rid,'depreciation',d,body,'posted',other.id);
  perform fmz_accounting.post(oid,rid,d,body->>'description',jsonb_build_array(jsonb_build_array('5800',amount,other.id),jsonb_build_array('1390',-amount,other.id)));result:=to_jsonb(r);
 elsif action='correction' then
  if length(trim(coalesce(body->>'description','')))<5 then raise exception 'Leg de correctiereden vast';end if;
  -- Explicit balanced adjustment, append-only. It cannot edit invoices or their snapshots.
  if jsonb_typeof(body->'lines')<>'array' then raise exception 'Boekingsregels vereist';end if;
  for item in select value from jsonb_array_elements(body->'lines') loop
   if item->>0 in ('1100','1600','1900','1800','1200','4000') then raise exception 'Corrigeer facturen via creditfactuur en uitgaven via broncorrectie';end if;
   if nullif(item->>2,'') is not null and not exists(select 1 from fmz_accounting.records where org_id=oid and id=(item->>2)::uuid) then raise exception 'Correctiebron ontbreekt';end if;
  end loop;
  r:=fmz_accounting.add_record(oid,rid,'correction',d,body);
  perform fmz_accounting.post(oid,rid,d,body->>'description',body->'lines');result:=to_jsonb(r);
 elsif action='expense_correction' then
  select * into other from fmz_accounting.records where org_id=oid and id=(body->>'expense_id')::uuid and kind='expense';
  if other.id is null or length(trim(coalesce(body->>'description','')))<5 then raise exception 'Uitgave en correctiereden vereist';end if;
  if exists(select 1 from fmz_accounting.records where org_id=oid and kind='correction' and parent_id=other.id) then raise exception 'Uitgave is al tegengeboekt' using errcode='PT409';end if;
  if exists(select 1 from fmz_accounting.records where org_id=oid and kind='asset' and data->>'expense_id'=other.id::text) then raise exception 'Corrigeer eerst het gekoppelde bedrijfsmiddel';end if;
  r:=fmz_accounting.add_record(oid,rid,'correction',d,body||jsonb_build_object('expense_reversal',true),'posted',other.id);
  select jsonb_agg(jsonb_build_array(l.account_code,-l.cents,l.reference_id) order by l.line_no) into lines from fmz_accounting.lines l join fmz_accounting.journals j on j.org_id=l.org_id and j.id=l.journal_id where j.org_id=oid and j.record_id=other.id;
  perform fmz_accounting.post(oid,rid,d,body->>'description',lines);result:=to_jsonb(r);
 elsif action in ('close_period','reopen_period') then
  if length(trim(coalesce(body->>'reason','')))<5 then raise exception 'Reden van afsluiten/heropenen vereist';end if;
  if action='close_period' then
   if nullif(body->>'from','') is null or nullif(body->>'to','') is null or (body->>'from')::date>(body->>'to')::date then raise exception 'Kies geldige periode';end if;
   r:=fmz_accounting.add_record(oid,rid,'period',(body->>'to')::date,body,'closed');
  else
   if r.id is null or r.kind<>'period' or r.status<>'closed' then raise exception 'Afgesloten periode ontbreekt';end if;
   update fmz_accounting.records set status='reopened',version=version+1,data=data||jsonb_build_object('reopen_reason',body->>'reason','reopened_at',now()) where org_id=oid and id=rid returning * into r;
  end if;result:=to_jsonb(r);
 elsif action='reconcile' then
  select * into other from fmz_accounting.records where org_id=oid and id=(body->>'account_id')::uuid and kind='account';
  if other.id is null or other.data->>'opening_date' is null then raise exception 'Bevestig eerst de beginstand';end if;
  if d<(other.data->>'opening_date')::date then raise exception 'Afstemdatum ligt voor beginstand';end if;
  amount:=(body->>'closing_cents')::bigint;if amount is null then raise exception 'Eindstand bankafschrift vereist';end if;
  select coalesce(sum(l.cents),0) into available from fmz_accounting.lines l join fmz_accounting.journals j on j.org_id=l.org_id and j.id=l.journal_id where l.org_id=oid and l.account_code=other.data->>'code' and j.date<=d;
  if amount<>available then raise exception 'Eindstand wijkt % cent af van beginstand en mutaties',amount-available using errcode='PT409';end if;
  r:=fmz_accounting.add_record(oid,rid,'reconciliation',d,body||jsonb_build_object('ledger_cents',available),'reconciled',other.id);result:=to_jsonb(r);
 elsif action='legacy_review' then
  if length(trim(coalesce(body->>'reason','')))<10 then raise exception 'Leg vast hoe de historie is aangesloten en welke periodes ontbreken';end if;
  update fmz_accounting.organizations set legacy_reviewed=true where id=oid;
  r:=fmz_accounting.add_record(oid,rid,'legacy',d,body,'reviewed');result:=to_jsonb(r);
 elsif action='file_reserve' then
  if body->>'mime' not in ('application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','text/csv','application/vnd.ms-excel','text/plain') or length(coalesce(body->>'original_name','')) not between 1 and 240 then raise exception 'Kies een originele foto, PDF of CSV (maximaal 12 MB)';end if;
  if nullif(body->>'record_id','') is not null and not exists(select 1 from fmz_accounting.records where org_id=oid and id=(body->>'record_id')::uuid) then raise exception 'Bestandskoppeling bestaat niet';end if;
  if body->>'kind'='invoice_pdf' then
   select * into other from fmz_accounting.records where org_id=oid and id=(body->>'record_id')::uuid and kind='invoice' and status='posted';
   if other.id is null or body->>'mime'<>'application/pdf' then raise exception 'Definitieve factuur vereist';end if;
   select * into f from fmz_accounting.files where org_id=oid and record_id=other.id and kind='invoice_pdf';
   if f.id is not null then result:=to_jsonb(f);end if;
  end if;
  if result is null then
   insert into fmz_accounting.files(org_id,id,record_id,kind,original_name,mime,bytes,sha256,path)
   values(oid,rid,nullif(body->>'record_id','')::uuid,coalesce(body->>'kind','evidence'),body->>'original_name',body->>'mime',(body->>'bytes')::bigint,body->>'sha256',oid::text||'/'||rid::text) returning * into f;
   result:=to_jsonb(f);
  end if;
 elsif action='file_finish' then
  select * into f from fmz_accounting.files where org_id=oid and id=rid;
  if f.id is null or not exists(select 1 from storage.objects where bucket_id='fmz-finance' and name=f.path and coalesce((metadata->>'size')::bigint,0)=f.bytes) then raise exception 'Upload nog niet bevestigd of bestandsgrootte wijkt af';end if;
  update fmz_accounting.files set status='ready' where org_id=oid and id=rid returning * into f;result:=to_jsonb(f);
 elsif action='retention' then
  select * into f from fmz_accounting.files where org_id=oid and id=rid;
  if f.id is null or length(trim(coalesce(body->>'reason','')))<10 or body->>'class' not in ('basis','onroerend','oss','contract','overig') then raise exception 'Documentsoort en grondslag bewaartermijn vereist';end if;
  d:=nullif(body->>'active_until','')::date;
  update fmz_accounting.files set retention_class=body->>'class',active_until=d,keep_until=case when d is null then null else (d+make_interval(years=>case when body->>'class' in ('onroerend','oss') then 10 else 7 end))::date end where org_id=oid and id=rid returning * into f;result:=to_jsonb(f);
 elsif action='export' then result:=jsonb_build_object('confirmed_at',now(),'files',(select count(*) from fmz_accounting.files where org_id=oid and status='ready'));
 else raise exception 'Onbekende administratieactie';end if;
 insert into fmz_accounting.audit(org_id,actor_id,action,request_id,detail) values(oid,auth.uid(),action,command.request_id,jsonb_build_object('before',before_value,'after',result));
 insert into fmz_accounting.receipts values(oid,command.request_id,hash,result,now());
 return result;
end $$;

-- Once provisioned, an older cached frontend cannot continue the old invoice number series.
-- Other workspace paths (including client autosave) retain their existing storage behavior.
create function fmz_accounting.guard_legacy_invoice() returns trigger language plpgsql security definer set search_path='' as $$
declare old_docs jsonb; new_docs jsonb;
begin
 if not exists(select 1 from fmz_accounting.organizations where owner_id=new.trainer_id) then return new;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v->'id','number',v->'invoiceNo','amount',v->'amount','description',v->'description','date',v->'date','dueDate',v->'dueDate') order by v->>'id'),'[]') into old_docs from jsonb_array_elements(coalesce(old.state#>'{trainerFinance,adminItems}','[]')) v where v->>'type'='invoice' and coalesce(v->>'draft','false')<>'true';
 select coalesce(jsonb_agg(jsonb_build_object('id',v->'id','number',v->'invoiceNo','amount',v->'amount','description',v->'description','date',v->'date','dueDate',v->'dueDate') order by v->>'id'),'[]') into new_docs from jsonb_array_elements(coalesce(new.state#>'{trainerFinance,adminItems}','[]')) v where v->>'type'='invoice' and coalesce(v->>'draft','false')<>'true';
 if old_docs is distinct from new_docs or old.state#>'{trainerFinance,invoiceSequenceNext}' is distinct from new.state#>'{trainerFinance,invoiceSequenceNext}' then
  raise exception 'Vernieuw APPFMZ. Facturen en nummering worden beheerd in de beveiligde Administratie; invoer is niet overschreven.' using errcode='PT409';
 end if;
 return new;
end $$;
create trigger fmz_accounting_guard_legacy before update on public.coach_workspaces for each row execute function fmz_accounting.guard_legacy_invoice();

create function public.fmz_accounting_read() returns jsonb language sql security invoker set search_path='' as $$select fmz_accounting.snapshot()$$;
create function public.fmz_accounting_command(action text,payload jsonb,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_accounting.command(action,payload,request_id)$$;
revoke all on all functions in schema fmz_accounting from public,anon,authenticated;
revoke all on function public.fmz_accounting_read(),public.fmz_accounting_command(text,jsonb,uuid) from public,anon;
grant execute on function fmz_accounting.snapshot(),fmz_accounting.command(text,jsonb,uuid),fmz_accounting.storage_allowed(text,boolean) to authenticated;
grant execute on function public.fmz_accounting_read(),public.fmz_accounting_command(text,jsonb,uuid) to authenticated;
revoke all on all sequences in schema fmz_accounting from public,anon,authenticated;
commit;

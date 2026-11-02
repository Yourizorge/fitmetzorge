-- APPFMZ additive enrollment. Existing workspace data, monthly agreements and financial documents are not rewritten.
begin;
create schema fmz_members;
revoke all on schema fmz_members from public,anon;
grant usage on schema fmz_members to authenticated;
create function fmz_members.clean(value text) returns text language sql immutable set search_path='' as $$select lower(regexp_replace(trim(coalesce(value,'')),'\s+',' ','g'))$$;
create function fmz_members.phone(value text) returns text language sql immutable set search_path='' as $$select regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(value,''),'\D','','g'),'^0031','31'),'^310([0-9]{9})$','31\1'),'^0([1-9][0-9]{2,})$','31\1')$$;
create table fmz_members.directory(
 trainer_id uuid not null references public.profiles(id),client_id text not null,member_number bigint generated always as identity unique,
 name text not null,email text not null,phone text not null default '',search_text text not null,package_id text not null default '',status text not null default 'active' check(status in ('active','paused','ended','archived')),
 version bigint not null default 1,photo_id uuid,created_at timestamptz not null default now(),primary key(trainer_id,client_id)
);
create index members_directory_email on fmz_members.directory(trainer_id,email);
create index members_directory_phone on fmz_members.directory(trainer_id,phone);
create function fmz_members.search_grams(value text) returns text[] language sql immutable set search_path='' as $$select coalesce(array_agg(distinct substr(token,i,3)),'{}') from unnest(string_to_array(fmz_members.clean(value),' ')) token cross join lateral generate_series(1,length(token)-2) i$$;
create index members_directory_search on fmz_members.directory using gin(fmz_members.search_grams(search_text));
create table fmz_members.catalog_versions(
 id uuid primary key default gen_random_uuid(),package_id text not null,version integer not null check(version>0),snapshot jsonb not null,
 active boolean not null default true,enrollable boolean not null default true,created_at timestamptz not null default now(),unique(package_id,version)
);
create unique index members_catalog_active on fmz_members.catalog_versions(package_id) where active;
insert into fmz_members.catalog_versions(package_id,version,snapshot,enrollable)
 select id,1,fmz_accounting.billing_catalog(id)||jsonb_build_object('cents',case when id='duo-progressie' then 50000 when id='duo-transformatie' then 66000 else (fmz_accounting.billing_catalog(id)->>'cents')::bigint end,'cycle',case when id in ('single-session','ten-sessions') then 'none' else 'four_weeks' end,'durationMinutes',case when id like 'pt-%' or id in ('single-session','ten-sessions') then 60 else null end,'priceBasis',case when id like 'duo-%' then 'duo' else 'person' end,'mode',case when id like 'duo-%' then 'duo' when id='online-coaching' then 'online' else 'individual' end),id not in ('single-session','ten-sessions')
 from unnest(array['pt-basis','pt-progressie','pt-transformatie','online-coaching','duo-basis','duo-progressie','duo-transformatie','single-session','ten-sessions']) id;
-- Included features transcribed from the read-only official 2026-10-26 tariff snapshot.
update fmz_members.catalog_versions set snapshot=snapshot||jsonb_build_object('included',case when package_id like 'pt-%' then '["Warming-up en techniekcoaching","Kracht- of conditietraining en persoonlijke feedback"]'::jsonb when package_id like 'duo-%' then '["Samen trainen met dezelfde coaching"]'::jsonb when package_id='online-coaching' then '["Persoonlijk trainingsschema per week","Voedingsschema en dagelijks voedingslog","Wekelijkse check-ins en persoonlijke bijsturing"]'::jsonb else '[]'::jsonb end);
create table fmz_members.terms_versions(
 id uuid primary key default gen_random_uuid(),version text not null unique,terms_text text not null,privacy_text text not null,
 summary jsonb not null,source jsonb not null,sha256 text not null check(sha256~'^[a-f0-9]{64}$'),active boolean not null default false,
 verified_at timestamptz,created_at timestamptz not null default now(),check(not active or (verified_at is not null and length(terms_text)>100 and length(privacy_text)>100 and summary ?& array['notice','lateCancellation']))
);
create unique index members_one_active_terms on fmz_members.terms_versions((true)) where active;
-- No active purpose or legal text is seeded. Approval and collection remain separate.
create table fmz_members.consent_policies(id uuid primary key default gen_random_uuid(),purpose text not null,version text not null,text text not null,sha256 text not null check(sha256~'^[a-f0-9]{64}$'),terms_id uuid not null references fmz_members.terms_versions(id),active boolean not null default false,approved_at timestamptz,unique(purpose,version),check(not active or (approved_at is not null and length(text)>50)));
create unique index members_active_consent_policy on fmz_members.consent_policies(purpose) where active;
create table fmz_members.consent_events(id bigint generated always as identity primary key,trainer_id uuid not null references public.profiles(id),client_id text not null,policy_id uuid not null references fmz_members.consent_policies(id),actor_id uuid not null references public.profiles(id),decision text not null check(decision in ('grant','withdraw')),subject_name text not null,route text not null,created_at timestamptz not null default now());
create index members_consent_subject on fmz_members.consent_events(trainer_id,client_id,policy_id,id desc);
alter table fmz_members.consent_policies enable row level security;
alter table fmz_members.consent_events enable row level security;
create function fmz_members.consent_allowed(tid uuid,cid text,purpose_name text) returns boolean language sql volatile security definer set search_path='' as $$select coalesce((select e.decision='grant' from fmz_members.consent_policies p join fmz_members.terms_versions t on t.id=p.terms_id and t.active join fmz_members.consent_events e on e.policy_id=p.id where p.active and p.purpose=purpose_name and e.trainer_id=tid and e.client_id=cid order by e.id desc limit 1),false)$$;
create function fmz_members.guard_health(tid uuid,cid text,old_person jsonb,new_person jsonb,enrollment boolean default false) returns void language plpgsql security definer set search_path='' as $$begin
 if not enrollment and not exists(select 1 from fmz_members.contracts where trainer_id=tid and client_id=cid) then return;end if;
 if coalesce(new_person->>'injuries','') is distinct from coalesce(old_person->>'injuries','') and length(trim(coalesce(new_person->>'injuries','')))>0 then
  perform pg_advisory_xact_lock(hashtextextended(tid::text||cid||'health_coaching',0));
  if not fmz_members.consent_allowed(tid,cid,'health_coaching') then raise exception 'Gezondheidsinvoer is niet beschikbaar: actieve privacyvoorwaarden en afzonderlijke toestemming ontbreken' using errcode='42501';end if;
 end if;
end$$;
create table fmz_members.drafts(
 id uuid primary key,trainer_id uuid not null references public.profiles(id),version bigint not null default 1,
 data jsonb not null default '{}',catalog_id uuid references fmz_members.catalog_versions(id),terms_id uuid references fmz_members.terms_versions(id),
 snapshot jsonb,status text not null default 'draft' check(status in ('draft','review','completed','discarded')),
 client_id text not null unique,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index members_drafts_trainer on fmz_members.drafts(trainer_id,status,updated_at desc);
create table fmz_members.assets(
 id uuid primary key,trainer_id uuid not null references public.profiles(id),client_id text,draft_id uuid references fmz_members.drafts(id),
 kind text not null check(kind in ('agreement','photo')),mime text not null,bytes bigint not null check(bytes between 1 and 12000000),
 sha256 text not null check(sha256~'^[a-f0-9]{64}$'),snapshot_hash text,path text not null unique,status text not null default 'reserved' check(status in ('reserved','ready','retired','deleted')),
 created_at timestamptz not null default now(),check((kind='agreement' and mime='application/pdf' and draft_id is not null) or (kind='photo' and mime in ('image/jpeg','image/png','image/webp') and client_id is not null))
);
alter table fmz_members.directory add constraint members_photo_fk foreign key(photo_id) references fmz_members.assets(id);
create index members_assets_member on fmz_members.assets(trainer_id,client_id,status);
create table fmz_members.contracts(
 id uuid primary key references fmz_members.drafts(id),trainer_id uuid not null,client_id text not null,number text not null unique,
 org_id uuid not null,agreement_id uuid not null,snapshot jsonb not null,document_id uuid not null unique references fmz_members.assets(id),
 document_hash text not null,created_at timestamptz not null default now(),
 foreign key(trainer_id,client_id) references fmz_members.directory(trainer_id,client_id),foreign key(org_id,agreement_id) references fmz_accounting.agreement_versions(org_id,id)
);
create table fmz_members.events(
 id bigint generated always as identity primary key,trainer_id uuid not null references public.profiles(id),client_id text,draft_id uuid,
 actor_id uuid not null references auth.users(id),action text not null,before_data jsonb,after_data jsonb,reason text not null default '',created_at timestamptz not null default now()
);
create index members_events_member on fmz_members.events(trainer_id,client_id,id desc);
create function fmz_members.health_value(value jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare child jsonb;k text;begin
 if value is null or value='null'::jsonb then return false;end if;
 if jsonb_typeof(value)='object' then for k,child in select * from jsonb_each(value) loop if k not in ('id','day','date','week','created_at','updated_at','unit','mealType','planMealId') and fmz_members.health_value(child) then return true;end if;end loop;return false;end if;
 if jsonb_typeof(value)='array' then for child in select * from jsonb_array_elements(value) loop if fmz_members.health_value(child) then return true;end if;end loop;return false;end if;
 return value not in ('""'::jsonb,'0'::jsonb,'false'::jsonb);
end$$;
create function fmz_members.require_health_if_managed(tid uuid,cid text) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from fmz_members.contracts where trainer_id=tid and client_id=cid) then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(tid::text||cid||'health_coaching',0));
 if not fmz_members.consent_allowed(tid,cid,'health_coaching') then raise exception 'Nieuwe gezondheidsregistratie vereist de afzonderlijke toestemming van het lid' using errcode='42501';end if;
end$$;
create function fmz_members.guard_tracker_health(tid uuid,cid text,previous jsonb,current_data jsonb) returns void language plpgsql security definer set search_path='' as $$declare k text;begin
 if not exists(select 1 from fmz_members.contracts where trainer_id=tid and client_id=cid) then return;end if;
 foreach k in array array['foodLog','nutritionPlan','dailyWeight','dailyWeightByWeek','measurements','sleep','sleepByWeek','wellbeing','wellbeingByWeek','steps','stepsByWeek','water','waterByWeek'] loop
  if previous->k is distinct from current_data->k and fmz_members.health_value(current_data->k) then perform fmz_members.require_health_if_managed(tid,cid);return;end if;
 end loop;
end$$;
create function fmz_members.guard_annotations() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (new.draft is distinct from old.draft or new.shared is distinct from old.shared) and (fmz_members.health_value(new.draft) or fmz_members.health_value(new.shared)) then perform fmz_members.require_health_if_managed(new.trainer_id,new.client_id);end if;return new;
end$$;
create trigger fmz_members_annotation_consent before insert or update on fmz_private.photo_annotations for each row execute function fmz_members.guard_annotations();
create table fmz_members.receipts(actor_id uuid not null references public.profiles(id),request_id uuid not null,payload_hash text not null,result jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,request_id));
do $$declare t text;begin foreach t in array array['directory','catalog_versions','terms_versions','consent_policies','consent_events','drafts','assets','contracts','events','receipts'] loop execute format('alter table fmz_members.%I enable row level security',t);execute format('revoke all on fmz_members.%I from public,anon,authenticated',t);end loop;end$$;

-- Directory is an index of existing identities, never a replacement for the coaching workspace.
create function fmz_members.index_client(tid uuid,c jsonb) returns void language plpgsql set search_path='' as $$
begin
 insert into fmz_members.directory(trainer_id,client_id,name,email,phone,search_text,package_id)
 values(tid,c->>'id',coalesce(c->>'name',''),fmz_members.clean(c->>'email'),fmz_members.phone(c#>>'{profile,phone}'),fmz_members.clean(concat_ws(' ',c->>'name',c->>'email',c#>>'{profile,phone}',c->>'id')),coalesce(c#>>'{profile,package}',''))
 on conflict(trainer_id,client_id) do update set name=excluded.name,email=excluded.email,phone=excluded.phone,search_text=excluded.search_text,package_id=excluded.package_id;
end $$;
do $$declare w record;c jsonb;begin for w in select trainer_id,state from public.coach_workspaces loop for c in select value from jsonb_array_elements(coalesce(w.state->'clients','[]')) loop perform fmz_members.index_client(w.trainer_id,c);end loop;end loop;end$$;
create function fmz_members.workspace_index() returns trigger language plpgsql security definer set search_path='' as $$
declare c jsonb;old_c jsonb;
begin
 for c in select value from jsonb_array_elements(coalesce(new.state->'clients','[]')) loop
  select value into old_c from jsonb_array_elements(coalesce(old.state->'clients','[]')) where value->>'id'=c->>'id';
  perform fmz_members.guard_health(new.trainer_id,c->>'id',old_c->'profile',c->'profile');
  perform fmz_members.guard_tracker_health(new.trainer_id,c->>'id',old_c,c);
  if old_c is null or (old_c->>'name',old_c->>'email',old_c->'profile') is distinct from (c->>'name',c->>'email',c->'profile') then
   perform fmz_members.index_client(new.trainer_id,c);
   if old_c is not null then
    update fmz_members.directory set version=version+1 where trainer_id=new.trainer_id and client_id=c->>'id';
    insert into fmz_members.events(trainer_id,client_id,actor_id,action,before_data,after_data) values(new.trainer_id,c->>'id',coalesce(auth.uid(),new.trainer_id),'profile_updated',jsonb_build_object('name',old_c->'name','email',old_c->'email','profile',old_c->'profile'),jsonb_build_object('name',c->'name','email',c->'email','profile',c->'profile'));
   end if;
  end if;
 end loop;
 update fmz_members.directory d set status='archived' where d.trainer_id=new.trainer_id and not exists(select 1 from jsonb_array_elements(coalesce(new.state->'clients','[]')) item where item->>'id'=d.client_id);
 return new;
end $$;
create trigger fmz_members_workspace_index after insert or update of state on public.coach_workspaces for each row execute function fmz_members.workspace_index();

create function fmz_members.allowed(tid uuid,cid text) returns boolean language plpgsql security definer set search_path='' as $$
declare p public.profiles;begin p:=fmz_private.actor();return ((p.role='trainer' and p.id=tid) or (p.role='client' and p.trainer_id=tid and p.client_id=cid)) and exists(select 1 from public.coach_workspaces w cross join lateral jsonb_array_elements(w.state->'clients') c where w.trainer_id=tid and c->>'id'=cid);end$$;
-- Infrastructure only: no approved purpose is created and no consent is inferred from a contract.
create function fmz_members.record_consent(policy_id uuid,client_id text,decision text,policy_hash text,confirmed boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles;policy fmz_members.consent_policies;tid uuid;subject text;event_id bigint;begin
 p:=fmz_private.actor();tid:=case when p.role='trainer' then p.id else p.trainer_id end;
 if not fmz_members.allowed(tid,client_id) or decision not in ('grant','withdraw') then raise exception 'Toestemming niet toegankelijk' using errcode='42501';end if;
 select * into policy from fmz_members.consent_policies c where c.id=policy_id;
 if policy.id is null then raise exception 'Toestemmingsversie ontbreekt';end if;
 if decision='grant' and (p.role<>'client' or p.client_id<>client_id or not policy.active or not exists(select 1 from fmz_members.terms_versions where id=policy.terms_id and active) or policy.sha256 is distinct from policy_hash or confirmed is distinct from true) then raise exception 'Alleen het ingelogde lid kan de actieve afzonderlijke toestemming bevestigen' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(tid::text||client_id||policy.purpose,0));
 select name into subject from fmz_members.directory where trainer_id=tid and directory.client_id=record_consent.client_id;
 if (select e.decision from fmz_members.consent_events e where e.trainer_id=tid and e.client_id=record_consent.client_id and e.policy_id=policy.id order by e.id desc limit 1) is distinct from decision then
  insert into fmz_members.consent_events(trainer_id,client_id,policy_id,actor_id,decision,subject_name,route) values(tid,client_id,policy.id,p.id,decision,subject,case when p.role='client' then 'authenticated-member' else 'trainer-assisted-withdrawal' end) returning id into event_id;
 end if;
 return jsonb_build_object('ok',true,'decision',decision,'event_id',event_id);
end$$;
create function fmz_members.storage_allowed(object_name text,writing boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare p public.profiles;a fmz_members.assets;begin p:=fmz_private.actor();select * into a from fmz_members.assets where path=object_name;if a.id is null then return false;end if;
 if writing then return p.role='trainer' and p.id=a.trainer_id and a.status='reserved';end if;
 if p.role='trainer' and p.id=a.trainer_id then return a.status in ('reserved','ready');end if;
 return a.status='ready' and fmz_members.allowed(a.trainer_id,a.client_id) and ((a.kind='photo' and exists(select 1 from fmz_members.directory where photo_id=a.id)) or (a.kind='agreement' and exists(select 1 from fmz_members.contracts where document_id=a.id)));
end$$;
insert into storage.buckets(id,name,public,file_size_limit) values('fmz-members','fmz-members',false,12000000);
create policy fmz_members_read on storage.objects for select to authenticated using(bucket_id='fmz-members' and fmz_members.storage_allowed(name,false));
create policy fmz_members_insert on storage.objects for insert to authenticated with check(bucket_id='fmz-members' and fmz_members.storage_allowed(name,true));
-- No overwrite policy. Old agreements and photo originals cannot be silently replaced.
-- The following communication migration supplies the guarded outbox projection.
create function fmz_members.document_communication(tid uuid,cid text,document_id uuid) returns jsonb language sql stable set search_path='' as $$select null::jsonb$$;

create function fmz_members.read(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles;tid uuid;cid text;memberrow fmz_members.directory;c jsonb;q text;result jsonb;
begin
 p:=fmz_private.actor();tid:=case when p.role='trainer' then p.id else p.trainer_id end;
 if action='bootstrap' and p.role='trainer' then return jsonb_build_object('catalog',(select coalesce(jsonb_agg(to_jsonb(v)),'[]') from fmz_members.catalog_versions v where active and enrollable),'terms',(select to_jsonb(t) from fmz_members.terms_versions t where active),'cleanup',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select a.id,a.draft_id from fmz_members.assets a join fmz_members.drafts d on d.id=a.draft_id where a.trainer_id=p.id and a.kind='agreement' and a.status='retired' and d.status='discarded' and not exists(select 1 from fmz_members.contracts k where k.document_id=a.id) limit 100) x),'drafts',(select coalesce(jsonb_agg(to_jsonb(d) order by updated_at desc),'[]') from fmz_members.drafts d where trainer_id=p.id and status in ('draft','review')));end if;
 if action in ('search','duplicates') then
  if p.role<>'trainer' then raise exception 'Alleen een bevoegde trainer kan leden zoeken' using errcode='42501';end if;
   q:=left(fmz_members.clean(payload->>'query'),200);
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into result from (select d.client_id,d.name,d.member_number,d.status,d.package_id,(select cv.snapshot->>'label' from fmz_members.catalog_versions cv where cv.package_id=d.package_id and cv.active limit 1) as package_label,d.photo_id from fmz_members.directory d where d.trainer_id=tid and d.status<>'archived' and
   ((action='search' and (q='' or (fmz_members.search_grams(d.search_text) @> fmz_members.search_grams(q) and not exists(select 1 from unnest(string_to_array(q,' ')) token where position(token in d.search_text)=0)) or d.member_number::text=q or (length(fmz_members.phone(q))>=4 and position(fmz_members.phone(q) in d.phone)>0))) or
    (action='duplicates' and (d.email=fmz_members.clean(payload->>'email') or (length(fmz_members.phone(payload->>'phone'))>=9 and d.phone=fmz_members.phone(payload->>'phone'))))) order by d.name,d.member_number limit 100) r;
  return result;
 end if;
 if action='cleanup_asset' and p.role='trainer' then return (select to_jsonb(a) from fmz_members.assets a join fmz_members.drafts d on d.id=a.draft_id where a.id=(payload->>'id')::uuid and a.trainer_id=p.id and d.trainer_id=p.id and a.kind='agreement' and a.status in ('retired','deleted') and d.status='discarded' and not exists(select 1 from fmz_members.contracts k where k.document_id=a.id));end if;
 if action='asset' and p.role='trainer' then return (select to_jsonb(a) from fmz_members.assets a where a.id=(payload->>'id')::uuid and a.trainer_id=p.id);end if;
 if action='document_snapshot' and p.role='trainer' then return (select snapshot from fmz_members.drafts where id=(payload->>'id')::uuid and trainer_id=p.id and status in ('review','completed'));end if;
 if action='profile' then
  cid:=case when p.role='client' then p.client_id else payload->>'client_id' end;
  if (p.role='client' and payload ? 'client_id' and payload->>'client_id'<>p.client_id) or not fmz_members.allowed(tid,cid) then raise exception 'Lid niet toegankelijk' using errcode='42501';end if;
  select * into memberrow from fmz_members.directory where trainer_id=tid and client_id=cid;
  select value into c from public.coach_workspaces w cross join lateral jsonb_array_elements(w.state->'clients') where w.trainer_id=tid and value->>'id'=cid;
  return jsonb_build_object('member',to_jsonb(memberrow),'personal',case when p.role='trainer' then c->'profile' else (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(coalesce(c->'profile','{}')) where key=any(array['firstName','insertion','lastName','phone','birthDate','street','houseNumber','address','postalCode','city','country','emergencyName','emergencyRelation','emergencyPhone','experience','preferences','injuries','marketing'])) end,'goal',c->'goal','startDate',c->'startDate',
   'photo',(select to_jsonb(a) from fmz_members.assets a where id=memberrow.photo_id and status='ready'),
   'healthConsent',jsonb_build_object('managed',exists(select 1 from fmz_members.contracts where trainer_id=tid and client_id=cid),'allowed',fmz_members.consent_allowed(tid,cid,'health_coaching'),'policy',(select jsonb_build_object('id',cp.id,'version',cp.version,'text',cp.text,'sha256',cp.sha256,'privacy',tv.privacy_text,'privacyVersion',tv.version) from fmz_members.consent_policies cp join fmz_members.terms_versions tv on tv.id=cp.terms_id and tv.active where cp.active and cp.purpose='health_coaching' limit 1)),
   'documents',(select coalesce(jsonb_agg(jsonb_build_object('id',k.id,'number',k.number,'snapshot',k.snapshot-'signature','created_at',k.created_at,'asset',to_jsonb(a),'communication',fmz_members.document_communication(tid,cid,k.id)) order by k.created_at desc),'[]') from fmz_members.contracts k join fmz_members.assets a on a.id=k.document_id where k.trainer_id=tid and k.client_id=cid),
   'billing',(select jsonb_build_object('package_label',v.package_label,'amount_cents',v.amount_cents,'cycle',v.cycle,'sessions',v.sessions,'effective_from',v.effective_from,'enabled',v.enabled) from fmz_accounting.agreement_versions v join fmz_accounting.organizations o on o.id=v.org_id where o.owner_id=tid and v.client_id=cid order by v.effective_from desc,v.version desc limit 1),
   'events',case when p.role='trainer' then (select coalesce(jsonb_agg(to_jsonb(e) order by id desc),'[]') from (select * from fmz_members.events where trainer_id=tid and client_id=cid order by id desc limit 100) e) else '[]'::jsonb end,
   'retiredPhotos',case when p.role='trainer' then (select coalesce(jsonb_agg(jsonb_build_object('id',a.id)),'[]') from fmz_members.assets a where a.trainer_id=tid and a.client_id=cid and a.kind='photo' and a.status='retired') else '[]'::jsonb end,
   'account',(select jsonb_build_object('registered',true) from public.profiles where trainer_id=tid and client_id=cid),
   'invitation',(select jsonb_build_object('status',status,'created_at',created_at,'accepted_at',accepted_at) from public.client_invites where trainer_id=tid and client_id=cid order by created_at desc limit 1));
 end if;
 raise exception 'Onbekende ledenroute';
end$$;

create function fmz_members.validate_profile(person jsonb) returns void language plpgsql set search_path='' as $$
declare k text;v text;dob date;today date:=(now() at time zone 'Europe/Amsterdam')::date;begin
 if jsonb_typeof(person) is distinct from 'object' then raise exception 'Controleer de persoonsgegevens';end if;
 foreach k in array array['firstName','lastName','phone','birthDate','street','houseNumber','postalCode','city','country'] loop if length(trim(coalesce(person->>k,'')))=0 then raise exception 'Verplicht profielveld ontbreekt: %',k;end if;end loop;
 for k,v in select * from jsonb_each_text(person) loop if length(v)>(case when k in ('goal','experience','preferences','injuries','trainerNote') then 4000 else 300 end) then raise exception 'Profielveld te lang: %',k;end if;end loop;
 if fmz_members.phone(person->>'phone') !~ '^[0-9]{9,15}$' then raise exception 'Controleer telefoonnummer';end if;
 if length(trim(coalesce(person->>'emergencyPhone','')))>0 and fmz_members.phone(person->>'emergencyPhone') !~ '^[0-9]{9,15}$' then raise exception 'Controleer noodcontactnummer';end if;
 begin if person->>'birthDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise invalid_datetime_format;end if;dob:=(person->>'birthDate')::date;exception when invalid_datetime_format or datetime_field_overflow then raise exception 'Controleer geboortedatum';end;
 if dob>today-interval '18 years' or dob<today-interval '120 years' then raise exception 'Geboortedatum: deze route ondersteunt uitsluitend volwassenen tot 120 jaar';end if;
end$$;
create function fmz_members.validate_person(person jsonb) returns void language plpgsql set search_path='' as $$
declare k text;v text;today date:=(now() at time zone 'Europe/Amsterdam')::date;begin
 if jsonb_typeof(person) is distinct from 'object' then raise exception 'Controleer de persoonsgegevens';end if;
 perform fmz_members.validate_profile(person);
 foreach k in array array['firstName','lastName','email','phone','birthDate','startDate','street','houseNumber','postalCode','city','country'] loop if length(trim(coalesce(person->>k,'')))=0 then raise exception 'Verplichte persoonsgegevens ontbreken';end if;end loop;
 for k,v in select * from jsonb_each_text(person) loop if length(v)>4000 then raise exception 'Persoonsgegevens zijn te lang';end if;end loop;
 if person->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(person->>'email')>300 or fmz_members.phone(person->>'phone') !~ '^[0-9]{9,15}$' then raise exception 'Controleer e-mail en telefoonnummer';end if;
 if (person->>'birthDate')::date>today-interval '18 years' then raise exception 'Deze route ondersteunt uitsluitend meerderjarigen';end if;
 if (person->>'birthDate')::date<today-interval '120 years' or (person->>'startDate')::date<today then raise exception 'Controleer de geboorte- en startdatum';end if;
end$$;
create function fmz_members.amount_cents(value text) returns bigint language plpgsql immutable set search_path='' as $$begin
 if value is null or value !~ '^\d+([.,]\d{1,2})?$' then raise exception 'Vul een geldig bedrag in met maximaal twee decimalen';end if;
 if replace(value,',','.')::numeric>10000000 then raise exception 'Bedrag te groot';end if;
 return (replace(value,',','.')::numeric*100)::bigint;
end$$;
create function fmz_members.payment_snapshot(pkg jsonb,start_date date,input jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare base bigint:=(pkg->>'cents')::bigint;discount bigint:=fmz_members.amount_cents(coalesce(input->>'discountAmount','0'));periods integer:=0;custom boolean:=coalesce((input->>'firstPeriodCustom')::boolean,false);normal_end date;first_end date;first_cents bigint;reason text:=trim(coalesce(input->>'discountReason',''));first_reason text:=trim(coalesce(input->>'firstPeriodReason',''));begin
 normal_end:=case when pkg->>'cycle'='calendar_month' then (date_trunc('month',start_date)+interval '1 month - 1 day')::date when pkg->>'cycle'='none' then start_date else start_date+27 end;
 if pkg->>'cycle'='calendar_month' and extract(day from start_date)<>1 then raise exception 'Een kalendermaand begint op de eerste';end if;
 if discount>base then raise exception 'Korting is hoger dan het pakketbedrag';end if;
 if discount>0 then if coalesce(input->>'discountPeriods','') !~ '^\d{1,3}$' then raise exception 'Kies de geldigheidsduur van de korting';end if;periods:=(input->>'discountPeriods')::integer;if periods not between 1 and 130 or length(reason) not between 1 and 500 then raise exception 'Korting vereist een reden en 1 tot 130 betaalperiodes';end if;end if;
 first_end:=normal_end;first_cents:=base;
 if custom then first_end:=(input->>'firstPeriodEnd')::date;first_cents:=fmz_members.amount_cents(input->>'firstPeriodAmount');if first_end is null or first_end<start_date or first_end>normal_end or (pkg->>'cycle'='calendar_month' and first_end<>normal_end) then raise exception 'Controleer de eerste periode: behoud de kalendermaandgrens of maximaal 28 dagen';end if;if first_cents<discount or first_cents>base or length(first_reason) not between 1 and 500 then raise exception 'Controleer het eerste bedrag, de korting en de berekeningsreden';end if;end if;
 return jsonb_build_object('baseCents',base,'discountCents',discount,'discountPeriods',periods,'discountReason',case when discount>0 then reason else '' end,'regularCents',base-discount,'firstPeriodCustom',custom,'firstPeriodStart',start_date,'firstPeriodEnd',first_end,'firstPeriodCents',first_cents,'firstPeriodNetCents',first_cents-discount,'firstPeriodReason',case when custom then first_reason else '' end,'nextPeriodStart',case when pkg->>'cycle'='none' then null else first_end+1 end);
end$$;
-- The subsequent billing migration installs the transactional attachment implementation.
create function fmz_members.attach_payment(oid uuid,aid uuid,payment jsonb,actor uuid) returns void language plpgsql set search_path='' as $$begin
 if coalesce((payment->>'discountCents')::bigint,0)>0 or coalesce((payment->>'firstPeriodCustom')::boolean,false) then raise exception 'De uitgebreide betalingsplanning is nog niet beschikbaar';end if;
end$$;
create function fmz_members.check_signature(lines jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare line jsonb;point jsonb;previous jsonb;drawn boolean:=false;begin
 if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 100 then return false;end if;
 for line in select value from jsonb_array_elements(lines) loop
  if jsonb_typeof(line)<>'array' or jsonb_array_length(line) not between 1 and 5000 then return false;end if;previous:=null;
  for point in select value from jsonb_array_elements(line) loop
   if jsonb_typeof(point)<>'array' or jsonb_array_length(point)<>2 or jsonb_typeof(point->0)<>'number' or jsonb_typeof(point->1)<>'number' or (point->>0)::numeric not between 0 and 1 or (point->>1)::numeric not between 0 and 1 then return false;end if;
   if previous is not null and (abs((point->>0)::numeric-(previous->>0)::numeric)+abs((point->>1)::numeric-(previous->>1)::numeric))>.005 then drawn:=true;end if;previous:=point;
  end loop;
 end loop;return drawn;
end$$;

create function fmz_members.command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles;receipt fmz_members.receipts;h text;result jsonb;d fmz_members.drafts;catalog fmz_members.catalog_versions;t fmz_members.terms_versions;a fmz_members.assets;member fmz_members.directory;
 cid text;oid uuid;agreement uuid;person jsonb;w jsonb;c jsonb;idx integer;settings jsonb;file_id uuid;draft_uuid uuid;
begin
 p:=fmz_private.actor();if p.role<>'trainer' and action<>'consent' then raise exception 'Alleen de bevoegde trainer kan deze handeling uitvoeren' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' or pg_column_size(payload)>1500000 then raise exception 'Ongeldige aanvraag';end if;
 h:=encode(sha256(convert_to(action||':'||payload::text,'UTF8')),'hex');perform pg_advisory_xact_lock(hashtextextended(p.id::text||request_id::text,0));
 select * into receipt from fmz_members.receipts r where r.actor_id=p.id and r.request_id=command.request_id;
 if found then if receipt.payload_hash<>h then raise exception 'Aanvraag gewijzigd' using errcode='PT409';end if;return receipt.result;end if;
 if action='consent' then
  result:=fmz_members.record_consent((payload->>'policy_id')::uuid,payload->>'client_id',payload->>'decision',payload->>'policy_hash',coalesce((payload->>'confirmed')::boolean,false));
 elsif action in ('save_draft','discard_draft','review','finalize','reserve_agreement') then
  draft_uuid:=(payload->>'id')::uuid;select * into d from fmz_members.drafts where id=draft_uuid for update;
  if d.id is not null and d.trainer_id<>p.id then raise exception 'Concept niet toegankelijk' using errcode='42501';end if;
  if action='finalize' and d.status='completed' then select jsonb_build_object('ok',true,'client_id',k.client_id,'contract_id',k.id,'number',k.number) into result from fmz_members.contracts k where id=d.id;
  else
   if coalesce(d.version,0) is distinct from (payload->>'expected_version')::bigint then raise exception 'Concept gewijzigd; ververs en controleer' using errcode='PT409';end if;
   if d.status in ('completed','discarded') then raise exception 'Concept is afgesloten' using errcode='PT409';end if;
   if action='save_draft' then
    select * into catalog from fmz_members.catalog_versions where id=(payload->>'catalog_id')::uuid and active and enrollable;
    if catalog.id is null or jsonb_typeof(payload->'data') is distinct from 'object' then raise exception 'Kies een actief pakket';end if;
    perform fmz_members.guard_health(p.id,coalesce(d.client_id,'m-'||draft_uuid::text),d.data->'person',payload#>'{data,person}',true);
    if d.id is null then insert into fmz_members.drafts(id,trainer_id,client_id,data,catalog_id) values(draft_uuid,p.id,'m-'||draft_uuid::text,payload->'data',catalog.id) returning * into d;
    else update fmz_members.drafts set data=payload->'data',catalog_id=catalog.id,terms_id=null,snapshot=null,status='draft',version=version+1,updated_at=now() where id=d.id returning * into d;end if;result:=to_jsonb(d);
   elsif action='discard_draft' then
    update fmz_members.drafts set status='discarded',data='{}',snapshot=null,version=version+1,updated_at=now() where id=d.id returning * into d;
    update fmz_members.assets unused_asset set status='retired' where unused_asset.draft_id=d.id and unused_asset.trainer_id=p.id and unused_asset.kind='agreement' and unused_asset.status in ('reserved','ready') and not exists(select 1 from fmz_members.contracts k where k.document_id=unused_asset.id);
    update fmz_members.receipts r set result=jsonb_build_object('id',d.id,'status','discarded','version',d.version,'data','{}'::jsonb,'snapshot',null) where r.actor_id=p.id and r.result->>'id'=d.id::text;
    insert into fmz_members.events(trainer_id,draft_id,actor_id,action) values(p.id,d.id,p.id,'discard_draft');
    result:=jsonb_build_object('ok',true,'id',d.id);
   elsif action='review' then
    oid:=fmz_accounting.owner_org();person:=d.data->'person';perform fmz_members.validate_person(person);
    select * into catalog from fmz_members.catalog_versions where id=d.catalog_id and active and enrollable;select * into t from fmz_members.terms_versions where active;
    if catalog.id is null then raise exception 'Pakketprijs gewijzigd; selecteer en controleer opnieuw' using errcode='PT409';end if;
    if t.id is null then raise exception 'Geverifieerde algemene voorwaarden en privacyvoorwaarden ontbreken';end if;
    if payload->>'confirmed' is distinct from 'true' or length(trim(coalesce(payload->>'signer','')))<2 or not fmz_members.check_signature(payload->'signature') then raise exception 'Controleer de gegevens, voorwaarden en handtekening';end if;
    perform pg_advisory_xact_lock(hashtextextended(fmz_members.clean(person->>'email'),0));
    if exists(select 1 from fmz_members.directory where email=fmz_members.clean(person->>'email') or (trainer_id=p.id and phone=fmz_members.phone(person->>'phone'))) or exists(select 1 from auth.users where lower(email)=fmz_members.clean(person->>'email')) then raise exception 'Mogelijk bestaand account; controleer het bestaande profiel' using errcode='23505';end if;
    select data into settings from fmz_accounting.records where org_id=oid and kind='settings' and status='confirmed' and date<=(person->>'startDate')::date order by date desc,created_at desc limit 1;
    if settings is null then raise exception 'Bevestigde bedrijfs- en btw-instellingen ontbreken';end if;
    update fmz_members.drafts set terms_id=t.id,status='review',version=version+1,updated_at=now(),snapshot=jsonb_build_object('version',1,'number','FMZ-OV-'||upper(replace(d.id::text,'-','')),'client_id',d.client_id,'person',person-'trainerNote'-'injuries','package',catalog.snapshot||jsonb_build_object('versionId',catalog.id,'version',catalog.version),'payment',fmz_members.payment_snapshot(catalog.snapshot,(person->>'startDate')::date,d.data->'payment'),'terms',to_jsonb(t)-'active','company',settings,'signedAt',now(),'signer',trim(payload->>'signer'),'signature',payload->'signature','route','appfmz-trainer-enrollment-v1') where id=d.id returning * into d;result:=to_jsonb(d);
   elsif action='reserve_agreement' then
    if d.status<>'review' then raise exception 'Controleer en onderteken eerst';end if;
    file_id:=(payload->>'file_id')::uuid;
    insert into fmz_members.assets(id,trainer_id,client_id,draft_id,kind,mime,bytes,sha256,snapshot_hash,path) values(file_id,p.id,d.client_id,d.id,'agreement','application/pdf',(payload->>'bytes')::bigint,payload->>'sha256',encode(sha256(convert_to(d.snapshot::text,'UTF8')),'hex'),p.id::text||'/agreements/'||file_id::text||'.pdf') returning * into a;result:=to_jsonb(a);
   elsif action='finalize' then
    oid:=fmz_accounting.owner_org();person:=d.data->'person';perform fmz_members.validate_person(person);
    perform fmz_members.guard_health(p.id,d.client_id,'{}',person,true);
    if d.status<>'review' or d.snapshot is null then raise exception 'Ondertekening ontbreekt';end if;
    if not exists(select 1 from fmz_members.catalog_versions where id=d.catalog_id and active) or not exists(select 1 from fmz_members.terms_versions where id=d.terms_id and active) then raise exception 'Pakket of voorwaarden gewijzigd; controleer opnieuw' using errcode='PT409';end if;
    select * into a from fmz_members.assets where id=(payload->>'file_id')::uuid and draft_id=d.id and kind='agreement' and status='ready';
    if a.id is null or a.snapshot_hash is distinct from encode(sha256(convert_to(d.snapshot::text,'UTF8')),'hex') then raise exception 'Definitieve PDF is nog niet bevestigd voor deze ondertekende versie';end if;
    perform pg_advisory_xact_lock(hashtextextended(fmz_members.clean(person->>'email'),0));
    if exists(select 1 from fmz_members.directory where email=fmz_members.clean(person->>'email') or (trainer_id=p.id and phone=fmz_members.phone(person->>'phone'))) or exists(select 1 from auth.users where lower(email)=fmz_members.clean(person->>'email')) then raise exception 'Mogelijk bestaand account; controleer het bestaande profiel' using errcode='23505';end if;
    select state into w from public.coach_workspaces where trainer_id=p.id for update;if w is null then raise exception 'Trainerwerkruimte ontbreekt';end if;
    c:=jsonb_build_object('id',d.client_id,'name',concat_ws(' ',person->>'firstName',nullif(person->>'insertion',''),person->>'lastName'),'email',fmz_members.clean(person->>'email'),'startDate',person->>'startDate','goal',coalesce(person->>'goal',''),'profile',person||jsonb_build_object('package',d.snapshot#>>'{package,id}','address',concat_ws(' ',person->>'street',person->>'houseNumber')),'goals','{}'::jsonb,'trainingPlan','[]'::jsonb,'nutritionPlan','[]'::jsonb,'foodLog','[]'::jsonb,'appointments','[]'::jsonb);
    update public.coach_workspaces set state=jsonb_set(w,'{clients}',coalesce(w->'clients','[]')||jsonb_build_array(c)),updated_at=clock_timestamp() where trainer_id=p.id;
    insert into fmz_accounting.agreement_versions(org_id,client_id,version,effective_from,cycle,package_id,package_label,amount_cents,sessions,enabled,origin,reason,created_by)
     values(oid,d.client_id,1,(person->>'startDate')::date,d.snapshot#>>'{package,cycle}',d.snapshot#>>'{package,id}',d.snapshot#>>'{package,label}',(d.snapshot#>>'{package,cents}')::bigint,(d.snapshot#>>'{package,sessions}')::integer,true,'signed_enrollment','Ondertekende inschrijving '||(d.snapshot->>'number'),p.id) returning id into agreement;
    perform fmz_members.attach_payment(oid,agreement,d.snapshot->'payment',p.id);
    insert into fmz_members.contracts(id,trainer_id,client_id,number,org_id,agreement_id,snapshot,document_id,document_hash) values(d.id,p.id,d.client_id,d.snapshot->>'number',oid,agreement,d.snapshot,a.id,a.sha256);
    perform fmz_private.prepare_invite(d.client_id,c->>'email',c->>'name');
    update fmz_members.drafts set status='completed',version=version+1,updated_at=now() where id=d.id;
    insert into fmz_members.events(trainer_id,client_id,draft_id,actor_id,action,after_data) values(p.id,d.client_id,d.id,p.id,'enrollment_completed',jsonb_build_object('contract_id',d.id,'hash',a.sha256,'agreement_id',agreement));
    result:=jsonb_build_object('ok',true,'client_id',d.client_id,'contract_id',d.id,'number',d.snapshot->>'number');
   end if;
  end if;
 elsif action in ('edit_profile','reserve_photo','set_photo','remove_photo') then
  cid:=payload->>'client_id';if not fmz_members.allowed(p.id,cid) then raise exception 'Lid niet toegankelijk' using errcode='42501';end if;
  select * into member from fmz_members.directory where trainer_id=p.id and client_id=cid for update;
  if member.version is distinct from (payload->>'expected_version')::bigint then raise exception 'Profiel gewijzigd; ververs en controleer' using errcode='PT409';end if;
   if action='reserve_photo' then
   if (select count(*) from fmz_members.assets where trainer_id=p.id and created_at>now()-interval '1 minute')>=30 then raise exception 'Even wachten voordat je opnieuw een foto uploadt';end if;
   file_id:=(payload->>'id')::uuid;insert into fmz_members.assets(id,trainer_id,client_id,kind,mime,bytes,sha256,path) values(file_id,p.id,cid,'photo',payload->>'mime',(payload->>'bytes')::bigint,payload->>'sha256',p.id::text||'/photos/'||file_id::text) returning * into a;result:=to_jsonb(a);
  elsif action='edit_profile' then
   person:=payload->'personal';if jsonb_typeof(person) is distinct from 'object' or pg_column_size(person)>30000 or exists(select 1 from jsonb_object_keys(person) k where k not in ('firstName','insertion','lastName','phone','birthDate','street','houseNumber','address','postalCode','city','country','emergencyName','emergencyRelation','emergencyPhone','goal','experience','preferences','injuries','trainerNote','marketing')) then raise exception 'Onjuist profielveld';end if;
   perform fmz_members.validate_profile(person);
   select state into w from public.coach_workspaces where trainer_id=p.id for update;select ordinality::int-1,value into idx,c from jsonb_array_elements(w->'clients') with ordinality where value->>'id'=cid;
   c:=c||jsonb_build_object('name',concat_ws(' ',person->>'firstName',nullif(person->>'insertion',''),person->>'lastName'),'goal',coalesce(person->>'goal',c->>'goal',''),'profile',coalesce(c->'profile','{}')||person);
   update public.coach_workspaces set state=jsonb_set(w,array['clients',idx::text],c),updated_at=clock_timestamp() where trainer_id=p.id;result:=fmz_members.read('profile',jsonb_build_object('client_id',cid));
  else
   if action='set_photo' then select * into a from fmz_members.assets where id=(payload->>'photo_id')::uuid and trainer_id=p.id and client_id=cid and kind='photo' and status='ready';if a.id is null then raise exception 'Foto nog niet opgeslagen';end if;end if;
   update fmz_members.directory set photo_id=case when action='set_photo' then a.id else null end,version=version+1 where trainer_id=p.id and client_id=cid;
   if member.photo_id is not null and member.photo_id is distinct from a.id then update fmz_members.assets set status='retired' where id=member.photo_id and kind='photo';end if;
   insert into fmz_members.events(trainer_id,client_id,actor_id,action,before_data,after_data) values(p.id,cid,p.id,action,jsonb_build_object('photo_id',member.photo_id),jsonb_build_object('photo_id',case when action='set_photo' then a.id else null end));result:=fmz_members.read('profile',jsonb_build_object('client_id',cid));
  end if;
 else raise exception 'Onbekende ledenhandeling';end if;
 if result is null then raise exception 'Handeling niet uitgevoerd';end if;
 insert into fmz_members.receipts(actor_id,request_id,payload_hash,result) values(p.id,request_id,h,result);return result;
end$$;
-- Only the verified asset Edge worker can confirm actual downloaded bytes. Browser metadata is insufficient.
create function fmz_members.verify_asset(asset_id uuid,actual_sha256 text,actual_bytes bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare a fmz_members.assets;begin
 select * into a from fmz_members.assets where id=asset_id for update;
 if a.id is null or a.sha256 is distinct from actual_sha256 or a.bytes is distinct from actual_bytes or a.status in ('retired','deleted') then raise exception 'Bestandscontrole mislukt';end if;
 if not exists(select 1 from storage.objects where bucket_id='fmz-members' and name=a.path and (metadata->>'size')::bigint=a.bytes and metadata->>'mimetype'=a.mime) then raise exception 'Bestandsupload nog niet bevestigd';end if;
 update fmz_members.assets set status='ready' where id=a.id returning * into a;return to_jsonb(a);
end$$;
create function fmz_members.photo_deleted(asset_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a fmz_members.assets;begin select * into a from fmz_members.assets where id=asset_id for update;
 if a.id is null or a.kind<>'photo' or a.status not in ('retired','deleted') or exists(select 1 from fmz_members.directory where photo_id=a.id) then raise exception 'Alleen een ingetrokken profielfoto mag worden opgeruimd';end if;
 if exists(select 1 from storage.objects where bucket_id='fmz-members' and name=a.path) then raise exception 'Opslagverwijdering niet bevestigd';end if;
 update fmz_members.assets set status='deleted' where id=a.id;return jsonb_build_object('ok',true,'id',a.id);
end$$;

create function fmz_members.draft_asset_deleted(asset_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a fmz_members.assets;begin select * into a from fmz_members.assets where id=asset_id for update;
 if a.id is null or a.kind<>'agreement' or a.status not in ('retired','deleted') or not exists(select 1 from fmz_members.drafts d where d.id=a.draft_id and d.trainer_id=a.trainer_id and d.status='discarded') or exists(select 1 from fmz_members.contracts k where k.document_id=a.id) then raise exception 'Alleen een verwijderd ongebruikt conceptbestand mag worden opgeruimd';end if;
 if exists(select 1 from storage.objects where bucket_id='fmz-members' and name=a.path) then raise exception 'Opslagverwijdering niet bevestigd';end if;
 update fmz_members.assets set status='deleted' where id=a.id;return jsonb_build_object('ok',true,'id',a.id);
end$$;
create function public.fmz_member_draft_asset_deleted(asset_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_members.draft_asset_deleted(asset_id)$$;

create function public.fmz_member_photo_deleted(asset_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_members.photo_deleted(asset_id)$$;
create function public.fmz_member_verify_asset(asset_id uuid,actual_sha256 text,actual_bytes bigint) returns jsonb language sql security invoker set search_path='' as $$select fmz_members.verify_asset(asset_id,actual_sha256,actual_bytes)$$;
create function public.fmz_members_read(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select fmz_members.read(action,payload)$$;
create function public.fmz_members_command(action text,payload jsonb,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_members.command(action,payload,request_id)$$;
revoke all on all functions in schema fmz_members from public,anon,authenticated;
grant execute on function fmz_members.read(text,jsonb),fmz_members.command(text,jsonb,uuid),fmz_members.storage_allowed(text,boolean) to authenticated;
revoke all on function public.fmz_members_read(text,jsonb),public.fmz_members_command(text,jsonb,uuid) from public,anon;
grant execute on function public.fmz_members_read(text,jsonb),public.fmz_members_command(text,jsonb,uuid) to authenticated;
revoke all on function public.fmz_member_verify_asset(uuid,text,bigint) from public,anon,authenticated;
grant usage on schema fmz_members to service_role;
grant execute on function fmz_members.verify_asset(uuid,text,bigint),public.fmz_member_verify_asset(uuid,text,bigint) to service_role;
revoke all on function public.fmz_member_photo_deleted(uuid) from public,anon,authenticated;
grant execute on function fmz_members.photo_deleted(uuid),public.fmz_member_photo_deleted(uuid) to service_role;
revoke all on function public.fmz_member_draft_asset_deleted(uuid) from public,anon,authenticated;
grant execute on function fmz_members.draft_asset_deleted(uuid),public.fmz_member_draft_asset_deleted(uuid) to service_role;
commit;

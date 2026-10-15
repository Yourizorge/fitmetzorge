-- APPFMZ only. Additive agenda commands; existing appointments remain in coach_workspaces.
-- No financial data, historical appointments, Storage or Auth records are rewritten.
begin;
create schema fmz_agenda;
revoke all on schema fmz_agenda from public,anon,authenticated;
grant usage on schema fmz_agenda to authenticated,service_role;

create table fmz_agenda.requests(actor uuid not null,request_id uuid not null,payload jsonb not null,response jsonb not null,created_at timestamptz not null default now(),primary key(actor,request_id));
create table fmz_agenda.preferences(user_id uuid primary key references public.profiles(id) on delete cascade,reminder_minutes integer check(reminder_minutes in(15,30,60,1440)),changes boolean not null default true,push boolean not null default false,updated_at timestamptz not null default now());
create table fmz_agenda.events(id uuid primary key default gen_random_uuid(),trainer_id uuid not null references public.profiles(id) on delete cascade,recipient uuid not null references public.profiles(id) on delete cascade,appointment_key text not null,revision text not null,kind text not null check(kind in('created','changed','cancelled','reminder','test')),due_at timestamptz not null,expires_at timestamptz not null,status text not null default 'pending' check(status in('pending','ready','obsolete')),read_at timestamptz,created_at timestamptz not null default now(),unique(recipient,trainer_id,appointment_key,revision,kind));
create index agenda_events_due on fmz_agenda.events(due_at) where status='pending';
create index agenda_events_recipient on fmz_agenda.events(recipient,created_at desc);
create index agenda_events_appointment on fmz_agenda.events(trainer_id,appointment_key);
create table fmz_agenda.subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,session_id uuid not null,endpoint text not null unique,subscription jsonb not null,created_at timestamptz not null default now());
create index agenda_subscriptions_user on fmz_agenda.subscriptions(user_id);
create table fmz_agenda.deliveries(id uuid primary key default gen_random_uuid(),event_id uuid not null references fmz_agenda.events(id) on delete cascade,subscription_id uuid not null references fmz_agenda.subscriptions(id) on delete cascade,status text not null default 'pending' check(status in('pending','sending','sent','retry','dead')),attempts integer not null default 0,next_attempt timestamptz not null default now(),lease uuid,lease_until timestamptz,last_code integer,unique(event_id,subscription_id));
create index agenda_deliveries_due on fmz_agenda.deliveries(next_attempt) where status in('pending','retry','sending');
create table fmz_agenda.config(id boolean primary key default true check(id),public_key text not null default '',enabled boolean not null default false);
insert into fmz_agenda.config(id) values(true);
alter table fmz_agenda.requests enable row level security;
alter table fmz_agenda.preferences enable row level security;
alter table fmz_agenda.events enable row level security;
alter table fmz_agenda.subscriptions enable row level security;
alter table fmz_agenda.deliveries enable row level security;
alter table fmz_agenda.config enable row level security;
revoke all on all tables in schema fmz_agenda from public,anon,authenticated;

create function fmz_agenda.rows(w jsonb) returns table(key text,cid text,appointment jsonb)
language sql immutable set search_path='' as $$
 select distinct on(c->>'id',coalesce(nullif(a->>'occurrenceId',''),(c->>'id')||':'||(a->>'id')))
 coalesce(nullif(a->>'occurrenceId',''),(c->>'id')||':'||(a->>'id')),c->>'id',a
 from jsonb_array_elements(coalesce(w->'clients','[]')) c cross join lateral jsonb_array_elements(coalesce(c->'appointments','[]')) a
 where nullif(a->>'id','') is not null
 order by c->>'id',coalesce(nullif(a->>'occurrenceId',''),(c->>'id')||':'||(a->>'id'))
$$;
create function fmz_agenda.revision(w jsonb,k text) returns text language sql immutable set search_path='' as $$
 select md5(coalesce(jsonb_agg(jsonb_build_object('client',cid,'appointment',appointment) order by cid)::text,'null')) from fmz_agenda.rows(w) where key=k
$$;
create function fmz_agenda.project(w jsonb,member_id text default null) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg((item-'notes'-'sharedNotes')||jsonb_build_object('notes',item->>'sharedNotes')||case when member_id is null then jsonb_build_object('legacyTrainerNote',item->>'notes') else '{}'::jsonb end order by item->>'date',item->>'time',item->>'key'),'[]') from (
 select (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each((array_agg(r.appointment order by r.cid))[1]) where key=any(array['id','date','day','time','endTime','type','appointmentTypeId','duration','location','color','seriesId','repeat','repeatRule','status','notes','sharedNotes','trainerReminder']) and (member_id is null or key not in('notes','trainerReminder') )) || jsonb_build_object(
 'key',r.key,'revision',fmz_agenda.revision(w,r.key),'clientId',min(r.cid),
 'participants',jsonb_agg(jsonb_build_object('id',r.cid,'name',(select c->>'name' from jsonb_array_elements(w->'clients') c where c->>'id'=r.cid),'status',r.appointment->>'status') order by r.cid)) as item
 from fmz_agenda.rows(w) r where member_id is null or r.cid=member_id group by r.key
 ) q
$$;
create function fmz_agenda.start_at(a jsonb) returns timestamptz language plpgsql stable set search_path='' as $$
declare local_time timestamp; resolved timestamptz;
begin
 if a->>'date' !~ '^\d{4}-\d{2}-\d{2}$' or a->>'time' !~ '^([01]\d|2[0-3]):[0-5]\d$' then return null;end if;
 local_time:=((a->>'date')||' '||(a->>'time'))::timestamp;resolved:=local_time at time zone 'Europe/Amsterdam';
 if resolved at time zone 'Europe/Amsterdam'<>local_time then raise exception 'Dit tijdstip bestaat niet door de zomertijd. Kies een ander tijdstip.' using errcode='22023';end if;
 return resolved;
end $$;

create function fmz_agenda.enqueue(tid uuid,w jsonb,k text,event_kind text,target_user uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare rev text:=fmz_agenda.revision(w,k);r record; ap jsonb; starts timestamptz; pref fmz_agenda.preferences; mins integer;
begin
 update fmz_agenda.events set status='obsolete' where trainer_id=tid and appointment_key=k and kind='reminder' and status='pending' and (target_user is null or recipient=target_user);
 for r in select p.id,p.role,p.client_id from public.profiles p where (target_user is null or p.id=target_user) and (p.id=tid or (p.role='client' and p.trainer_id=tid and p.client_id in(select cid from fmz_agenda.rows(w) where key=k))) loop
  select appointment into ap from fmz_agenda.rows(w) where key=k and (r.role='trainer' or cid=r.client_id) order by cid limit 1;
  if ap is null then continue;end if;
  select * into pref from fmz_agenda.preferences where user_id=r.id;
  if event_kind in('created','changed','cancelled') and coalesce(pref.changes,true) then
   insert into fmz_agenda.events(trainer_id,recipient,appointment_key,revision,kind,due_at,expires_at) values(tid,r.id,k,rev,event_kind,now(),now()+interval '1 day') on conflict do nothing;
  end if;
  mins:=case when r.role='trainer' and ap ? 'trainerReminder' then nullif(ap->>'trainerReminder','')::int else pref.reminder_minutes end;
  begin starts:=fmz_agenda.start_at(ap);exception when invalid_datetime_format or datetime_field_overflow or invalid_parameter_value then starts:=null;end;
  if mins is not null and coalesce(ap->>'status','planned') not in('cancelled','attended','completed','no_show') and starts-make_interval(mins=>mins)>now() then
   insert into fmz_agenda.events(trainer_id,recipient,appointment_key,revision,kind,due_at,expires_at) values(tid,r.id,k,rev,'reminder',starts-make_interval(mins=>mins),starts) on conflict(recipient,trainer_id,appointment_key,revision,kind) do update set due_at=excluded.due_at,status='pending' where fmz_agenda.events.status='obsolete';
  end if;
 end loop;
end $$;

create function fmz_agenda.read() returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles:=fmz_private.actor();tid uuid;w jsonb; result jsonb;
begin
 tid:=case when p.role='trainer' then p.id else p.trainer_id end;
 if not exists(select 1 from public.profiles where id=tid and role='trainer') then raise exception 'Geen geldige trainerkoppeling' using errcode='42501';end if;
 select state into w from public.coach_workspaces where trainer_id=tid;
 if p.role='client' and not exists(select 1 from jsonb_array_elements(w->'clients') c where c->>'id'=p.client_id) then raise exception 'Geen klantkoppeling' using errcode='42501';end if;
 return jsonb_build_object('appointments',fmz_agenda.project(w,case when p.role='client' then p.client_id end),'timezone','Europe/Amsterdam',
 'preferences',coalesce((select to_jsonb(f)-'user_id' from fmz_agenda.preferences f where user_id=p.id),'{"reminder_minutes":null,"changes":true,"push":false}'::jsonb),
 'publicKey',(select public_key from fmz_agenda.config where id),'pushReady',(select enabled from fmz_agenda.config where id),
 'inbox',(select coalesce(jsonb_agg(x order by created_at desc),'[]') from(select e.id,e.kind,e.appointment_key,e.created_at,e.read_at from fmz_agenda.events e where recipient=p.id and trainer_id=tid and status='ready' and fmz_agenda.authorized(e) and (kind='test' or exists(select 1 from fmz_agenda.rows(w) r where r.key=e.appointment_key and(p.role='trainer' or r.cid=p.client_id))) order by created_at desc limit 100)x));
end $$;

create function fmz_agenda.command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
<<cmd>>
declare p public.profiles:=fmz_private.actor();w jsonb;tid uuid;old jsonb;ap jsonb;patch jsonb;part jsonb;parts jsonb;k text;rev text;result jsonb;cached fmz_agenda.requests;idx integer;arr jsonb;cid text;repeat_rule text;cnt integer;occ integer;d date;firstdate date;newkey text;mins integer;starts timestamptz;existing jsonb;
begin
 if request_id is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>64000 then raise exception 'Ongeldig verzoek' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p.id::text||request_id::text,0));
 select * into cached from fmz_agenda.requests q where q.actor=p.id and q.request_id=command.request_id;
 if found then if cached.payload<>jsonb_build_object('action',action,'payload',payload) then raise exception 'Verzoeknummer al gebruikt' using errcode='22023';end if;return cached.response;end if;
 tid:=case when p.role='trainer' then p.id else p.trainer_id end;
 if not exists(select 1 from public.profiles where id=tid and role='trainer') then raise exception 'Geen trainerkoppeling' using errcode='42501';end if;
 select state into w from public.coach_workspaces where trainer_id=tid for update;
 if w is null then raise exception 'Workspace ontbreekt' using errcode='42501';end if;
 if action='preferences' then
  mins:=nullif(payload->>'reminder_minutes','')::int;
  insert into fmz_agenda.preferences(user_id,reminder_minutes,changes,push) values(p.id,mins,coalesce((payload->>'changes')::boolean,true),coalesce((payload->>'push')::boolean,false)) on conflict(user_id) do update set reminder_minutes=excluded.reminder_minutes,changes=excluded.changes,push=excluded.push,updated_at=now();
  update fmz_agenda.events set status='obsolete' where recipient=p.id and kind='reminder' and status='pending';
  -- Only future, not-yet-due reminders are created when the user opts in.
  for k in select distinct key from fmz_agenda.rows(w) where p.role='trainer' or cid=p.client_id loop perform fmz_agenda.enqueue(tid,w,k,'settings',p.id);end loop;
 elsif action='read-message' then
  select e.appointment_key into k from fmz_agenda.events e where e.id=(payload->>'id')::uuid and e.recipient=p.id and fmz_agenda.authorized(e);
  if k is null then raise exception 'Bericht niet beschikbaar' using errcode='42501';end if;
  update fmz_agenda.events set read_at=coalesce(read_at,now()) where id=(payload->>'id')::uuid and recipient=p.id;
 elsif action='unsubscribe' then
  delete from fmz_agenda.subscriptions where user_id=p.id and session_id::text=auth.jwt()->>'session_id';
 elsif action='subscribe' then
  if not (select enabled from fmz_agenda.config where id) then raise exception 'Push is nog niet beschikbaar';end if;
  if payload->>'endpoint' !~ '^https://([a-z0-9-]+\.)*(push\.apple\.com|notify\.windows\.com|push\.services\.mozilla\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)/' or octet_length(payload::text)>6000 or payload#>>'{keys,p256dh}' !~ '^[A-Za-z0-9_=-]{80,100}$' or payload#>>'{keys,auth}' !~ '^[A-Za-z0-9_=-]{20,30}$' then raise exception 'Ongeldig pushabonnement' using errcode='22023';end if;
  if (select count(*) from fmz_agenda.subscriptions where user_id=p.id)>=10 and not exists(select 1 from fmz_agenda.subscriptions where endpoint=payload->>'endpoint' and user_id=p.id) then raise exception 'Te veel apparaten';end if;
  insert into fmz_agenda.subscriptions(user_id,session_id,endpoint,subscription) values(p.id,(auth.jwt()->>'session_id')::uuid,payload->>'endpoint',payload) on conflict(endpoint) do update set user_id=excluded.user_id,session_id=excluded.session_id,subscription=excluded.subscription,created_at=now();
 elsif action='test-push' then
  -- A test is always explicitly requested by the recipient on their own device.
  if not exists(select 1 from fmz_agenda.subscriptions where user_id=p.id and session_id::text=auth.jwt()->>'session_id') then raise exception 'Schakel meldingen eerst op dit toestel in';end if;
  insert into fmz_agenda.events(trainer_id,recipient,appointment_key,revision,kind,due_at,expires_at) values(tid,p.id,'test',request_id::text,'test',now(),now()+interval '10 minutes');
 elsif action in('create','edit','attendance','cancel','expand') then
  if p.role<>'trainer' then raise exception 'Alleen de eigen trainer mag afspraken wijzigen' using errcode='42501';end if;
  k:=payload->>'key';
  if action<>'create' then
   select appointment into old from fmz_agenda.rows(w) where key=k order by cid limit 1;
   if old is null then raise exception 'Afspraak niet beschikbaar' using errcode='42501';end if;
   rev:=fmz_agenda.revision(w,k);
   if payload->>'revision' is distinct from rev then raise exception 'Afspraak gewijzigd. Ververs en controleer je invoer.' using errcode='PT409';end if;
   select jsonb_agg(jsonb_build_object('id',cid,'status',appointment->>'status') order by cid) into parts from fmz_agenda.rows(w) where key=k;
  else k:='ag-'||request_id::text;parts:=payload->'participants';old:='{}';end if;
  if action='edit' and payload ? 'participants' then
   -- Membership is retained on edit; cancel/recreate explicitly to change participants.
   if (select jsonb_agg(value->>'id' order by value->>'id') from jsonb_array_elements(parts)) is distinct from (select jsonb_agg(value->>'id' order by value->>'id') from jsonb_array_elements(payload->'participants')) then raise exception 'Deelnemers wijzigen: annuleer deze afspraak en plan een nieuwe.' using errcode='22023';end if;
  end if;
  if jsonb_typeof(parts) is distinct from 'array' or jsonb_array_length(parts) not between 1 and 20 or (select count(distinct value->>'id') from jsonb_array_elements(parts))<>jsonb_array_length(parts) then raise exception 'Kies unieke deelnemers' using errcode='22023';end if;
  for part in select value from jsonb_array_elements(parts) loop if not exists(select 1 from jsonb_array_elements(w->'clients') c where c->>'id'=part->>'id') then raise exception 'Deelnemer hoort niet bij deze trainer' using errcode='42501';end if;end loop;
  patch:=coalesce(payload->'appointment','{}');
  if exists(select 1 from jsonb_object_keys(patch) f where f<>all(array['date','time','duration','type','appointmentTypeId','location','notes','color','repeat','trainerReminder'])) then raise exception 'Agenda bevat een niet-toegestaan veld' using errcode='22023';end if;
  if patch ? 'notes' then patch:=(patch-'notes')||jsonb_build_object('sharedNotes',patch->'notes');end if;
  ap:=old||patch;
  if action in('create','edit','expand') then
   begin starts:=fmz_agenda.start_at(ap);exception when invalid_datetime_format or datetime_field_overflow or invalid_parameter_value then starts:=null;end;
   if starts is null or length(coalesce(ap->>'type','')) not between 1 and 250 or length(coalesce(ap->>'location',''))>300 or length(coalesce(ap->>'sharedNotes',''))>2000 or (ap->>'duration')::int not between 5 and 720 or (ap->>'duration') is null or (ap->>'duration')::int+extract(hour from (ap->>'time')::time)*60+extract(minute from(ap->>'time')::time)>1440 then raise exception 'Controleer datum, tijd, duur en omschrijving' using errcode='22023';end if;
   if nullif(ap->>'trainerReminder','') is not null and (ap->>'trainerReminder')::int not in(15,30,60,1440) then raise exception 'Ongeldige herinnering';end if;
  end if;
  repeat_rule:=case when action in('create','expand') then coalesce(nullif(patch->>'repeat',''),old->>'repeat','') else '' end;
  if repeat_rule not in('','weekly','biweekly','monthly') then raise exception 'Ongeldige herhaling';end if;
  cnt:=case when repeat_rule<>'' then 12 else 1 end;
  firstdate:=(ap->>'date')::date;
  for occ in 0..cnt-1 loop
   newkey:=case when occ=0 then k else k||'-r'||occ end;
   d:=case when repeat_rule='monthly' then (firstdate+make_interval(months=>occ))::date else firstdate+occ*case when repeat_rule='biweekly' then 14 else 7 end end;
   if occ>0 and exists(select 1 from fmz_agenda.rows(w) where key=newkey or appointment->>'id'=(old->>'id')||'-r'||occ) then continue;end if;
   for part in select value from jsonb_array_elements(parts) loop
    cid:=part->>'id';select ordinality::int-1 into idx from jsonb_array_elements(w->'clients') with ordinality where value->>'id'=cid;
    select appointment into existing from fmz_agenda.rows(w) where key=k and rows.cid=cmd.cid;
    if occ=0 and action<>'create' then ap:=coalesce(existing,old)||patch;else ap:=patch||jsonb_build_object('id',newkey,'occurrenceId',newkey,'status','planned');end if;
    if action='expand' and occ>0 then ap:=(old - array['amount','rateId','rateName','paymentStatus','adminItemId','adminItemSuppressed','monthSequence'])||patch||jsonb_build_object('id',newkey,'occurrenceId',newkey,'status','planned');end if;
    if action='cancel' then ap:=ap||'{"status":"cancelled"}'::jsonb;end if;
    if action='attendance' then
     if payload->>'clientId'<>cid then null;
     else
      if payload->>'status' not in('attended','planned','cancelled','no_show','unknown') or payload->>'status' is null then raise exception 'Ongeldige aanwezigheid';end if;
      ap:=ap||jsonb_build_object('status',payload->>'status','attendanceRecordedAt',now(),'attendanceRecordedBy',p.id);
     end if;
    end if;
    if action='attendance' and not exists(select 1 from jsonb_array_elements(parts) v where v->>'id'=payload->>'clientId') then raise exception 'Geen deelnemer';end if;
    if action in('create','edit','expand') then ap:=ap||jsonb_build_object('date',d::text,'endTime',to_char((ap->>'time')::time+make_interval(mins=>(ap->>'duration')::int),'HH24:MI'),'repeat','');end if;
    if cnt>1 then ap:=ap||jsonb_build_object('seriesId',k,'repeatRule',repeat_rule);end if;
    select coalesce(jsonb_agg(value),'[]') into arr from jsonb_array_elements(coalesce(w#>array['clients',idx::text,'appointments'],'[]')) where coalesce(nullif(value->>'occurrenceId',''),cid||':'||(value->>'id'))<>newkey;
    arr:=arr||jsonb_build_array(ap);w:=jsonb_set(w,array['clients',idx::text,'appointments'],arr);
   end loop;
   perform fmz_agenda.enqueue(tid,w,newkey,case when action='cancel' then 'cancelled' when action in('create','expand') then 'created' when action='attendance' then 'attendance' else 'changed' end);
  end loop;
  update public.coach_workspaces set state=w,updated_at=clock_timestamp() where trainer_id=tid;
 else raise exception 'Onbekende agendahandeling' using errcode='22023';end if;
 result:=jsonb_build_object('ok',true,'key',k);
 insert into fmz_agenda.requests(actor,request_id,payload,response) values(p.id,request_id,jsonb_build_object('action',action,'payload',payload),result);
 return result;
end $$;

create function public.fmz_agenda_read() returns jsonb language sql security invoker set search_path='' as $$select fmz_agenda.read()$$;
create function public.fmz_agenda_command(action text,payload jsonb,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_agenda.command(action,payload,request_id)$$;
revoke all on all functions in schema fmz_agenda from public,anon,authenticated;
grant execute on function fmz_agenda.read(),fmz_agenda.command(text,jsonb,uuid) to authenticated;
revoke all on function public.fmz_agenda_read(),public.fmz_agenda_command(text,jsonb,uuid) from public,anon;
grant execute on function public.fmz_agenda_read(),public.fmz_agenda_command(text,jsonb,uuid) to authenticated;
-- Background delivery only uses a derived queue. Calendar contents remain in the workspace.
create function fmz_agenda.authorized(e fmz_agenda.events) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.coach_workspaces w on w.trainer_id=e.trainer_id
 where p.id=e.recipient and ((p.id=e.trainer_id and p.role='trainer') or (p.role='client' and p.trainer_id=e.trainer_id and exists(select 1 from jsonb_array_elements(w.state->'clients') c where c->>'id'=p.client_id)))
 and (e.kind='test' or exists(select 1 from fmz_agenda.rows(w.state) r where r.key=e.appointment_key and(p.role='trainer' or r.cid=p.client_id)))
 and (e.kind<>'reminder' or e.revision=fmz_agenda.revision(w.state,e.appointment_key)))
$$;
create function fmz_agenda.tick() returns void language plpgsql security definer set search_path='' as $$
begin
 update fmz_agenda.events e set status='obsolete' where e.status='pending' and (e.expires_at<=now() or not fmz_agenda.authorized(e));
 update fmz_agenda.events e set status='ready' where e.status='pending' and e.due_at<=now() and e.expires_at>now();
 insert into fmz_agenda.deliveries(event_id,subscription_id)
 select e.id,s.id from fmz_agenda.events e join fmz_agenda.preferences p on p.user_id=e.recipient and p.push
 join fmz_agenda.subscriptions s on s.user_id=e.recipient join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id
 where e.status='ready' and e.expires_at>now() and (e.kind in('test','reminder') or p.changes) and s.created_at<=e.due_at and fmz_agenda.authorized(e)
 on conflict do nothing;
 update fmz_agenda.deliveries d set status='dead',lease=null,lease_until=null where status in('pending','retry','sending') and exists(select 1 from fmz_agenda.events e where e.id=d.event_id and(e.expires_at<=now() or not fmz_agenda.authorized(e)));
end $$;
create function fmz_agenda.worker(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; token uuid;delivery fmz_agenda.deliveries;code integer;
begin
 if action='claim' then
  perform fmz_agenda.tick();
  update fmz_agenda.deliveries set status='dead',lease=null,lease_until=null where status='sending' and lease_until<now() and attempts>=4;
  with picked as(select d.id from fmz_agenda.deliveries d join fmz_agenda.events e on e.id=d.event_id
   join fmz_agenda.subscriptions s on s.id=d.subscription_id join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id
   join fmz_agenda.preferences p on p.user_id=s.user_id and p.push
   where (d.status in('pending','retry') or(d.status='sending' and d.lease_until<now())) and d.next_attempt<=now() and d.attempts<4 and (e.kind in('test','reminder') or p.changes) and e.expires_at>now() and fmz_agenda.authorized(e)
   order by d.next_attempt limit 20 for update of d skip locked),
  claimed as(update fmz_agenda.deliveries d set status='sending',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '2 minutes' from picked where d.id=picked.id returning d.*)
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'lease',d.lease,'subscription',s.subscription,'eventId',e.id,'kind',e.kind,'key',e.appointment_key,'expiresAt',e.expires_at)),'[]') into result from claimed d join fmz_agenda.events e on e.id=d.event_id join fmz_agenda.subscriptions s on s.id=d.subscription_id;
  return result;
 elsif action='check' then
  return jsonb_build_object('ok',exists(select 1 from fmz_agenda.deliveries d join fmz_agenda.events e on e.id=d.event_id join fmz_agenda.subscriptions s on s.id=d.subscription_id join auth.sessions a on a.id=s.session_id and a.user_id=s.user_id join fmz_agenda.preferences p on p.user_id=s.user_id and p.push where d.id=(payload->>'id')::uuid and d.lease=(payload->>'lease')::uuid and d.status='sending' and (e.kind in('test','reminder') or p.changes) and e.expires_at>now() and fmz_agenda.authorized(e)));
 elsif action='finish' then
  select * into delivery from fmz_agenda.deliveries d where d.id=(payload->>'id')::uuid and d.lease=(payload->>'lease')::uuid and d.status='sending' for update;
  if not found then return '{"ok":false}'::jsonb;end if;
  code:=coalesce((payload->>'code')::int,0);
  if code in(404,410) then delete from fmz_agenda.subscriptions where id=delivery.subscription_id;
  else update fmz_agenda.deliveries set status=case when code between 200 and 299 then 'sent' when delivery.attempts>=4 or(code between 400 and 499 and code<>429) then 'dead' else 'retry' end,last_code=code,next_attempt=now()+make_interval(secs=>least(900,30*power(2,delivery.attempts)::int)),lease=null,lease_until=null where id=delivery.id;end if;
  return '{"ok":true}'::jsonb;
 else raise exception 'Unknown worker action';end if;
end $$;
create function public.fmz_agenda_worker(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select fmz_agenda.worker(action,payload)$$;
revoke all on function fmz_agenda.authorized(fmz_agenda.events),fmz_agenda.tick(),fmz_agenda.worker(text,jsonb),public.fmz_agenda_worker(text,jsonb) from public,anon,authenticated;
grant execute on function fmz_agenda.worker(text,jsonb),public.fmz_agenda_worker(text,jsonb) to service_role;

-- The cron callback sends no private records. Its bearer secret is kept in Vault.
create function fmz_agenda.dispatch() returns void language plpgsql security definer set search_path='' as $$
declare worker_token text;
begin
 perform fmz_agenda.tick();
 if not(select enabled from fmz_agenda.config where id) then return;end if;
 if not exists(select 1 from fmz_agenda.deliveries where (status in('pending','retry') or(status='sending' and lease_until<now())) and next_attempt<=now() and attempts<4) then return;end if;
 select decrypted_secret into worker_token from vault.decrypted_secrets where name='appfmz_agenda_worker_token';
 if worker_token is null then return;end if;
 perform net.http_post(url:='https://hgoygcviutmynaihcvpd.supabase.co/functions/v1/agenda-reminders',headers:=jsonb_build_object('Authorization','Bearer '||worker_token,'Content-Type','application/json'),body:='{}',timeout_milliseconds:=10000);
end $$;
revoke all on function fmz_agenda.dispatch() from public,anon,authenticated,service_role;
-- PGlite tests do not provide network/cron extensions; hosted Postgres does.
do $$begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.schedule('appfmz-agenda-reminders','* * * * *','select fmz_agenda.dispatch()');
 end if;
end $$;
commit;

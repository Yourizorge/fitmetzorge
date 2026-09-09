begin;
-- Give only legacy plan entries without an ID a stable identity. All other values stay intact.
create function fmz_private.ensure_plan_ids(w jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare c record; e record; collection text; result jsonb:=w;
begin
 for c in select value,ordinality from jsonb_array_elements(coalesce(w->'clients','[]')) with ordinality loop
  foreach collection in array array['trainingPlan','nutritionPlan'] loop
   for e in select value,ordinality from jsonb_array_elements(coalesce(c.value->collection,'[]')) with ordinality loop
    if coalesce(e.value->>'id','')='' then result:=jsonb_set(result,array['clients',(c.ordinality-1)::text,collection,(e.ordinality-1)::text,'id'],to_jsonb('legacy-'||collection||'-'||(c.value->>'id')||'-'||e.ordinality::text),true);end if;
   end loop;
  end loop;
 end loop;
 return result;
end $$;
revoke all on function fmz_private.ensure_plan_ids(jsonb) from public,anon,authenticated;
update public.coach_workspaces set state=fmz_private.ensure_plan_ids(state) where state is distinct from fmz_private.ensure_plan_ids(state);
create table fmz_private.write_receipts (
 actor_id uuid not null references public.profiles(id) on delete cascade,
 request_id uuid not null, payload_hash text not null, response jsonb not null,
 created_at timestamptz not null default now(), primary key(actor_id,request_id)
);
alter table fmz_private.write_receipts enable row level security;
revoke all on fmz_private.write_receipts from public,anon,authenticated;
create function fmz_private.save_once(changes jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; receipt fmz_private.write_receipts; result jsonb; h text;
begin
 p:=fmz_private.actor();
 if request_id is null then raise exception 'Request required'; end if;
 h:=md5(changes::text);
 perform pg_advisory_xact_lock(hashtextextended(p.id::text||request_id::text,0));
 select * into receipt from fmz_private.write_receipts r where r.actor_id=p.id and r.request_id=save_once.request_id;
 if found then
  if receipt.payload_hash<>h then raise exception 'Request changed' using errcode='PT409'; end if;
  return receipt.response;
 end if;
 result:=fmz_private.save_changes(changes);
 insert into fmz_private.write_receipts values(p.id,request_id,h,result,now());
 return result;
end $$;
create function public.fmz_save_changes_once(changes jsonb,request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select fmz_private.save_once(changes,request_id)$$;
revoke all on function fmz_private.save_once(jsonb,uuid),public.fmz_save_changes_once(jsonb,uuid) from public,anon;
grant execute on function fmz_private.save_once(jsonb,uuid),public.fmz_save_changes_once(jsonb,uuid) to authenticated;

create table fmz_private.photo_annotations (
 trainer_id uuid not null references public.profiles(id) on delete cascade,
 client_id text not null, week text not null, day integer not null, slot text not null,
 source_hash text not null, draft jsonb not null default '[]', shared jsonb not null default '[]',
 version bigint not null default 0, shared_at timestamptz,
 primary key(trainer_id,client_id,week,day,slot,source_hash)
);
alter table fmz_private.photo_annotations enable row level security;
revoke all on fmz_private.photo_annotations from public,anon,authenticated;
create function fmz_private.annotation(client_id text,week text,day integer,slot text,source_hash text default null,action text default 'read',strokes jsonb default '[]',expected_version bigint default 0,request_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; tid uuid; photo text; actual_hash text; a fmz_private.photo_annotations; result jsonb; receipt fmz_private.write_receipts; h text; stroke jsonb; point jsonb;
begin
 p:=fmz_private.actor();tid:=case when p.role='trainer' then p.id else p.trainer_id end;
 if p.role='client' and (p.client_id is distinct from client_id or action<>'read') then raise exception 'Photo denied' using errcode='42501'; end if;
 if week !~ '^\d{4}-\d{2}-\d{2}$' or day not between 0 and 6 or slot not in ('photoFront','photoSide','photoBack','photoExtra') then raise exception 'Invalid photo';end if;
 select c #>> array['dailyWeightByWeek',week,day::text,slot] into photo from public.coach_workspaces w cross join lateral jsonb_array_elements(w.state->'clients') c where w.trainer_id=tid and c->>'id'=client_id;
 if photo is null or photo !~ '^data:image/(jpeg|png|webp|gif);base64,' then raise exception 'Private photo missing' using errcode='42501'; end if;
 actual_hash:=encode(sha256(convert_to(photo,'UTF8')),'hex');
 if source_hash is not null and source_hash<>actual_hash then raise exception 'Photo replaced' using errcode='PT409'; end if;
 perform pg_advisory_xact_lock(hashtextextended(tid::text||client_id||week||day::text||slot||actual_hash,0));
 select * into a from fmz_private.photo_annotations x where x.trainer_id=tid and x.client_id=annotation.client_id and x.week=annotation.week and x.day=annotation.day and x.slot=annotation.slot and x.source_hash=actual_hash;
 if action<>'read' then
  if p.role<>'trainer' or action not in ('save','share') or request_id is null then raise exception 'Trainer required' using errcode='42501';end if;
  h:=md5(jsonb_build_array('annotation',client_id,week,day,slot,actual_hash,action,strokes,expected_version)::text);
  perform pg_advisory_xact_lock(hashtextextended(p.id::text||request_id::text,0));
  select * into receipt from fmz_private.write_receipts r where r.actor_id=p.id and r.request_id=annotation.request_id;
  if found then
   if receipt.payload_hash<>h then raise exception 'Request changed' using errcode='PT409';end if;
   return receipt.response;
  end if;
  if coalesce(a.version,0)<>expected_version then raise exception 'Annotation changed' using errcode='PT409';end if;
  if jsonb_typeof(strokes)<>'array' or jsonb_array_length(strokes)>500 or octet_length(strokes::text)>2000000 then raise exception 'Invalid drawing';end if;
  for stroke in select value from jsonb_array_elements(strokes) loop
   if not(stroke ?& array['tool','color','width','points']) or stroke->>'tool' is null or stroke->>'color' is null or stroke->>'width' is null or stroke->>'tool' not in ('draw','erase') or stroke->>'color' !~ '^#[0-9a-fA-F]{6}$' or (stroke->>'width')::numeric not between 0.001 and 0.1 or jsonb_typeof(stroke->'points') is distinct from 'array' or jsonb_array_length(stroke->'points') not between 1 and 20000 then raise exception 'Invalid stroke';end if;
   for point in select value from jsonb_array_elements(stroke->'points') loop
    if jsonb_array_length(point)<>2 or (point->>0)::numeric not between 0 and 1 or (point->>1)::numeric not between 0 and 1 then raise exception 'Invalid point';end if;
   end loop;
  end loop;
  insert into fmz_private.photo_annotations(trainer_id,client_id,week,day,slot,source_hash) values(tid,client_id,week,day,slot,actual_hash) on conflict do nothing;
  update fmz_private.photo_annotations x set draft=strokes,shared=case when action='share' then strokes else x.shared end,shared_at=case when action='share' then now() else x.shared_at end,version=x.version+1 where x.trainer_id=tid and x.client_id=annotation.client_id and x.week=annotation.week and x.day=annotation.day and x.slot=annotation.slot and x.source_hash=actual_hash returning * into a;
 end if;
 result:=jsonb_build_object('source_hash',actual_hash,'version',coalesce(a.version,0),'strokes',case when p.role='trainer' then coalesce(a.draft,'[]') else coalesce(a.shared,'[]') end,'shared_at',a.shared_at);
 if action<>'read' then insert into fmz_private.write_receipts values(p.id,request_id,h,result,now());end if;
 return result;
end $$;
create function public.fmz_photo_annotation(client_id text,week text,day integer,slot text,source_hash text default null,action text default 'read',strokes jsonb default '[]',expected_version bigint default 0,request_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$select fmz_private.annotation(client_id,week,day,slot,source_hash,action,strokes,expected_version,request_id)$$;
revoke all on function fmz_private.annotation(text,text,integer,text,text,text,jsonb,bigint,uuid),public.fmz_photo_annotation(text,text,integer,text,text,text,jsonb,bigint,uuid) from public,anon;
grant execute on function fmz_private.annotation(text,text,integer,text,text,text,jsonb,bigint,uuid),public.fmz_photo_annotation(text,text,integer,text,text,text,jsonb,bigint,uuid) to authenticated;
commit;

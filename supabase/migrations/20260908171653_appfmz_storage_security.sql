-- Target: hgoygcviutmynaihcvpd. Apply only after explicit production approval.
-- Existing profiles and client links are retained. No customer state is rewritten.
begin;
create schema if not exists fmz_private;
revoke all on schema fmz_private from public, anon;
grant usage on schema fmz_private to authenticated;

alter table public.profiles enable row level security;
alter table public.coach_workspaces enable row level security;
alter table public.client_invites enable row level security;
revoke all on public.profiles, public.coach_workspaces, public.client_invites from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update(name) on public.profiles to authenticated;
-- A profile's authority and linkage can only be provisioned by an administrator
-- or by the checked invitation operation below, never by self-service INSERT.
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "workspace read trainer or linked client" on public.coach_workspaces;
drop policy if exists "workspace update trainer or linked client" on public.coach_workspaces;
drop policy if exists "workspace insert trainer" on public.coach_workspaces;
drop policy if exists "workspace delete trainer" on public.coach_workspaces;
drop policy if exists "invites trainer manage" on public.client_invites;
drop policy if exists "invites client read own email" on public.client_invites;

alter table public.client_invites add column if not exists expires_at timestamptz;
-- Old outstanding invitations expire seven days after their original creation.
-- No UPDATE/backfill required, and a resend may explicitly issue a fresh expiry.
alter table public.client_invites alter column expires_at set default (now()+interval '7 days');
create index if not exists fmz_invites_pending_email on public.client_invites(lower(email)) where status='invited' and accepted_at is null;
create index if not exists fmz_profiles_client_link on public.profiles(trainer_id,client_id) where role='client';

create or replace function fmz_private.actor() returns public.profiles
language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid()) then
    raise exception 'Session ended' using errcode='28000';
  end if;
  select * into p from public.profiles where id=auth.uid();
  if p.id is null or p.role not in ('trainer','client') then raise exception 'Profile required' using errcode='42501'; end if;
  return p;
end $$;

create or replace function fmz_private.read_workspace() returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; w jsonb; c jsonb; projected jsonb; tid uuid;
begin
  p:=fmz_private.actor();
  tid:=case when p.role='trainer' then p.id else p.trainer_id end;
  if tid is null or not exists(select 1 from public.profiles where id=tid and role='trainer') then raise exception 'Invalid trainer link' using errcode='42501'; end if;
  select state into w from public.coach_workspaces where trainer_id=tid;
  if w is null then
    if p.role<>'trainer' then raise exception 'Workspace missing'; end if;
    w:='{"clients":[]}'::jsonb;
  end if;
  if p.role='client' then
    select value into c from jsonb_array_elements(coalesce(w->'clients','[]')) where value->>'id'=p.client_id;
    if c is null then raise exception 'Client missing' using errcode='42501'; end if;
    select coalesce(jsonb_object_agg(key,value),'{}') into projected from jsonb_each(c)
    where key=any(array['id','name','email','goal','goals','planSummary','startDate','foodLog','stepsByWeek','dailyWeightByWeek','wellbeingByWeek','sleepByWeek','waterByWeek','trainingAttendanceByWeek']);
    -- Draft plans, passwords, trainer notes, invoices, client contact administration
    -- and all other clients are excluded before serialization to the browser.
    projected:=projected || jsonb_build_object(
      'trainingPlan',(select coalesce(jsonb_agg(value),'[]') from jsonb_array_elements(coalesce(c->'trainingPlan','[]')) where value->>'published' is distinct from 'false'),
      'nutritionPlan',(select coalesce(jsonb_agg(value),'[]') from jsonb_array_elements(coalesce(c->'nutritionPlan','[]')) where value->>'published' is distinct from 'false'),
      'appointments',(select coalesce(jsonb_agg((select jsonb_object_agg(key,value) from jsonb_each(a.value) where key=any(array['id','date','day','time','type','duration','location','color','seriesId']))),'[]') from jsonb_array_elements(coalesce(c->'appointments','[]')) a));
    w:=jsonb_build_object('clients',jsonb_build_array(projected));
  else
    w:=w-'trainerAccount';
    w:=jsonb_set(w,'{clients}',coalesce((select jsonb_agg(value-'password') from jsonb_array_elements(coalesce(w->'clients','[]'))),'[]'));
  end if;
  return jsonb_build_object('state',w,'profile_id',p.id);
end $$;

-- Creates missing object parents without silently ignoring a jsonb_set operation.
create or replace function fmz_private.put(document jsonb,path text[],value jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb:=document; i integer;
begin
  if cardinality(path)=0 then return value; end if;
  for i in 1..cardinality(path)-1 loop
    if result #> path[1:i] is null then result:=jsonb_set(result,path[1:i],'{}',true); end if;
  end loop;
  return jsonb_set(result,path,value,true);
end $$;

create or replace function fmz_private.save_changes(changes jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; tid uuid; w jsonb; op jsonb; path text[]; fullpath text[]; idx integer; entityidx integer; current_value jsonb; n integer:=0; affected integer;
begin
  p:=fmz_private.actor();
  tid:=case when p.role='trainer' then p.id else p.trainer_id end;
  if tid is null or not exists(select 1 from public.profiles where id=tid and role='trainer') then raise exception 'Invalid trainer link' using errcode='42501'; end if;
  if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes) not between 1 and 500 or octet_length(changes::text)>12000000 then raise exception 'Invalid changes'; end if;
  if p.role='trainer' then insert into public.coach_workspaces(trainer_id,state) values(tid,'{"clients":[]}') on conflict do nothing; end if;
  select state into w from public.coach_workspaces where trainer_id=tid for update;
  if w is null then raise exception 'Workspace missing' using errcode='42501'; end if;
  for op in select value from jsonb_array_elements(changes) loop
    if jsonb_typeof(op->'path') is distinct from 'array' or not(op ?& array['before','after','before_exists','after_exists']) then raise exception 'Invalid change'; end if;
    select coalesce(array_agg(value),'{}') into path from jsonb_array_elements_text(op->'path');
    if cardinality(path)>12 or path && array['__proto__','prototype','constructor','password'] then raise exception 'Invalid path'; end if;
    if p.role='client' then
      if op->>'client_id' is distinct from p.client_id or cardinality(path)=0 then raise exception 'Client access denied' using errcode='42501'; end if;
      if op->>'collection' in ('trainingPlan','nutritionPlan') then
        if path[1]<>'logsByWeek' or cardinality(path)<2 or path[2] !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Only own logs allowed' using errcode='42501'; end if;
      elsif op ? 'collection' or path[1]<>all(array['foodLog','stepsByWeek','dailyWeightByWeek','wellbeingByWeek','sleepByWeek','waterByWeek','trainingAttendanceByWeek']) then
        raise exception 'Field denied' using errcode='42501';
      end if;
    end if;
    if op->>'client_id' is not null then
      select ordinality::int-1 into idx from jsonb_array_elements(coalesce(w->'clients','[]')) with ordinality where value->>'id'=op->>'client_id';
      if cardinality(path)=0 then
        if p.role<>'trainer' then raise exception 'Denied' using errcode='42501'; end if;
        current_value:=case when idx is null then null else (w->'clients'->idx)-'password' end;
        fullpath:=array['clients',coalesce(idx,jsonb_array_length(coalesce(w->'clients','[]')))::text];
        if (op->>'after_exists')::boolean and (op->'after'->>'id' is distinct from op->>'client_id' or jsonb_typeof(op->'after') is distinct from 'object') then raise exception 'Invalid client'; end if;
      else
        if idx is null then raise exception 'Client removed' using errcode='40001'; end if;
        fullpath:=array['clients',idx::text];
        if op ? 'collection' then
          if op->>'collection' not in ('trainingPlan','nutritionPlan') then raise exception 'Invalid collection'; end if;
          select ordinality::int-1 into entityidx from jsonb_array_elements(coalesce(w #> (fullpath||array[op->>'collection']),'[]')) with ordinality where value->>'id'=op->>'entity_id' and (p.role='trainer' or value->>'published' is distinct from 'false');
          if entityidx is null then raise exception 'Plan changed' using errcode='40001'; end if;
          fullpath:=fullpath||array[op->>'collection',entityidx::text];
        end if;
        fullpath:=fullpath||path;
        current_value:=w #> fullpath;
      end if;
    else
      if p.role<>'trainer' or cardinality(path)=0 or path[1]=any(array['clients','ui','trainerAccount']) then raise exception 'Scope denied' using errcode='42501'; end if;
      fullpath:=path; current_value:=w #> fullpath;
    end if;
    if (current_value is not null) is distinct from (op->>'before_exists')::boolean or (current_value is not null and current_value is distinct from op->'before') then
      raise exception 'Concurrent change; refresh required' using errcode='40001';
    end if;
    if (op->>'after_exists')::boolean then w:=fmz_private.put(w,fullpath,op->'after'); else w:=w #- fullpath; end if;
    if (w #> fullpath) is distinct from (case when (op->>'after_exists')::boolean then op->'after' else null end) and (op->>'after_exists')::boolean then raise exception 'Change not applied'; end if;
    n:=n+1;
  end loop;
  update public.coach_workspaces set state=w,updated_at=clock_timestamp() where trainer_id=tid;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'No workspace updated'; end if;
  return jsonb_build_object('ok',true,'changed',n);
end $$;

create or replace function fmz_private.accept_invite(display_name text) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); mail text; invitation public.client_invites; p public.profiles; matches integer;
begin
  if uid is null or not exists(select 1 from auth.sessions where user_id=uid and id::text=auth.jwt()->>'session_id') then raise exception 'Authentication required' using errcode='42501'; end if;
  select lower(email) into mail from auth.users where id=uid and email_confirmed_at is not null;
  if mail is null then raise exception 'Verified email required' using errcode='42501'; end if;
  -- Serialize both same-account and same-mail acceptances, including absent profiles.
  perform pg_advisory_xact_lock(hashtextextended(mail,0));
  select * into p from public.profiles where id=uid for update;
  if p.id is not null then raise exception 'Account already linked; administrator required' using errcode='23505'; end if;
  select count(*) into matches from public.client_invites where lower(email)=mail and status='invited' and accepted_at is null and coalesce(expires_at,created_at+interval '7 days')>now();
  if matches<>1 then raise exception 'No unique valid invitation' using errcode='42501'; end if;
  select * into invitation from public.client_invites where lower(email)=mail and status='invited' and accepted_at is null and coalesce(expires_at,created_at+interval '7 days')>now() for update;
  if not exists(select 1 from public.profiles where id=invitation.trainer_id and role='trainer') or not exists(select 1 from public.coach_workspaces w cross join lateral jsonb_array_elements(w.state->'clients') c where w.trainer_id=invitation.trainer_id and c->>'id'=invitation.client_id and lower(c->>'email')=mail) then raise exception 'Invalid saved client link' using errcode='42501'; end if;
  if exists(select 1 from public.profiles where trainer_id=invitation.trainer_id and client_id=invitation.client_id) then raise exception 'Client already linked' using errcode='23505'; end if;
  insert into public.profiles(id,role,name,email,trainer_id,client_id) values(uid,'client',coalesce(nullif(display_name,''),invitation.name),mail,invitation.trainer_id,invitation.client_id) returning * into p;
  update public.client_invites set status='accepted',accepted_at=now() where id=invitation.id;
  return p;
end $$;

create or replace function public.fmz_read_workspace() returns jsonb language sql security invoker set search_path='' as $$ select fmz_private.read_workspace() $$;
create or replace function public.fmz_save_changes(changes jsonb) returns jsonb language sql security invoker set search_path='' as $$ select fmz_private.save_changes(changes) $$;
create or replace function public.accept_client_invite(display_name text default null) returns public.profiles language sql security invoker set search_path='' as $$ select fmz_private.accept_invite(display_name) $$;
revoke all on all functions in schema fmz_private from public,anon,authenticated;
grant execute on function fmz_private.read_workspace(),fmz_private.save_changes(jsonb),fmz_private.accept_invite(text) to authenticated;
revoke all on function public.fmz_read_workspace(), public.fmz_save_changes(jsonb), public.accept_client_invite(text) from public,anon;
grant execute on function public.fmz_read_workspace(),public.fmz_save_changes(jsonb),public.accept_client_invite(text) to authenticated;
-- The Edge Function uses this checked operation before invoking the mail provider.
create or replace function fmz_private.prepare_invite(client_id text,email text,display_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; mail text:=lower(trim(email)); existing public.client_invites; linked public.profiles;
begin
  p:=fmz_private.actor();
  if p.role<>'trainer' then raise exception 'Trainer required' using errcode='42501'; end if;
  if not exists(select 1 from public.coach_workspaces w cross join lateral jsonb_array_elements(w.state->'clients') c where w.trainer_id=p.id and c->>'id'=prepare_invite.client_id and lower(c->>'email')=mail) then raise exception 'Save client before invitation' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(mail,0));
  select * into linked from public.profiles where lower(profiles.email)=mail limit 1;
  if linked.id is not null then
    if linked.role<>'client' or linked.trainer_id is distinct from p.id or linked.client_id is distinct from prepare_invite.client_id then raise exception 'Account already linked elsewhere' using errcode='23505'; end if;
    return jsonb_build_object('ok',true,'alreadyRegistered',true);
  end if;
  if exists(select 1 from public.client_invites i where lower(i.email)=mail and i.trainer_id<>p.id and i.status='invited' and i.accepted_at is null and coalesce(i.expires_at,i.created_at+interval '7 days')>now()) then raise exception 'Another active invitation exists' using errcode='23505'; end if;
  select * into existing from public.client_invites i where i.trainer_id=p.id and lower(i.email)=mail for update;
  if existing.id is null then
    insert into public.client_invites(trainer_id,client_id,email,name,expires_at) values(p.id,prepare_invite.client_id,mail,display_name,now()+interval '7 days');
  else
    if existing.accepted_at is not null or existing.status='accepted' then raise exception 'Invitation already consumed' using errcode='23505'; end if;
    update public.client_invites set client_id=prepare_invite.client_id,name=display_name,expires_at=now()+interval '7 days' where id=existing.id;
  end if;
  return jsonb_build_object('ok',true,'alreadyRegistered',false);
end $$;
create or replace function public.fmz_prepare_invite(client_id text,email text,display_name text) returns jsonb language sql security invoker set search_path='' as $$select fmz_private.prepare_invite(client_id,email,display_name)$$;
revoke all on function fmz_private.prepare_invite(text,text,text),public.fmz_prepare_invite(text,text,text) from public,anon;
grant execute on function fmz_private.prepare_invite(text,text,text),public.fmz_prepare_invite(text,text,text) to authenticated;
commit;

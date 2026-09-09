-- Correct application conflicts without PostgREST serialization retries.
-- Requires separate approval; changes no customer data, ACLs, or RLS.
begin;
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
        if idx is null then raise exception 'Client removed' using errcode='PT409'; end if;
        fullpath:=array['clients',idx::text];
        if op ? 'collection' then
          if op->>'collection' not in ('trainingPlan','nutritionPlan') then raise exception 'Invalid collection'; end if;
          select ordinality::int-1 into entityidx from jsonb_array_elements(coalesce(w #> (fullpath||array[op->>'collection']),'[]')) with ordinality where value->>'id'=op->>'entity_id' and (p.role='trainer' or value->>'published' is distinct from 'false');
          if entityidx is null then raise exception 'Plan changed' using errcode='PT409'; end if;
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
      raise exception 'Concurrent change; refresh required' using errcode='PT409';
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
commit;

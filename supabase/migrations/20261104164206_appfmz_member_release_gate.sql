-- Prepared enrollment exists, but signing is deliberately NOT released.
-- No legal text or owner approval is invented or seeded by this migration.
begin;
create table fmz_members.release_control(
 singleton boolean primary key default true check(singleton),
 enrollment_enabled boolean not null default false,
 approved_terms_id uuid references fmz_members.terms_versions(id),
 approved_terms_sha256 text,
 approved_at timestamptz,
 check(not enrollment_enabled or (approved_terms_id is not null and approved_at is not null and approved_terms_sha256 ~ '^[a-f0-9]{64}$'))
);
insert into fmz_members.release_control(singleton,enrollment_enabled) values(true,false);
alter table fmz_members.release_control enable row level security;
revoke all on fmz_members.release_control from public,anon,authenticated,service_role;
create function fmz_members.enrollment_released() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select r.enrollment_enabled and t.active and t.verified_at is not null
 and t.sha256=r.approved_terms_sha256
 and not (t.source ?| array['test','synthetic','owner_test'])
 and (t.version||' '||t.terms_text||' '||t.privacy_text) !~* '(synthetic|synthetisch|test only|concept|placeholder)'
 from fmz_members.release_control r join fmz_members.terms_versions t on t.id=r.approved_terms_id where r.singleton),false)
$$;
revoke all on function fmz_members.enrollment_released() from public,anon,authenticated;
alter function fmz_members.read(text,jsonb) rename to read_before_release_gate;
revoke all on function fmz_members.read_before_release_gate(text,jsonb) from public,anon,authenticated;
create function fmz_members.read(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 result:=fmz_members.read_before_release_gate(action,payload);
 if action='bootstrap' then
  result:=result||jsonb_build_object('enrollment_available',fmz_members.enrollment_released(),'enrollment_reason','Ondertekenen is nog niet vrijgegeven: de definitieve privacyverklaring moet eerst worden goedgekeurd. Concepten en bestaande documenten blijven beschikbaar.');
  if not fmz_members.enrollment_released() then result:=jsonb_set(result,'{terms}','null');end if;
 end if;
 return result;
end$$;
alter function fmz_members.command(text,jsonb,uuid) rename to command_before_release_gate;
-- PL/pgSQL implicit parameter labels follow the function name after rename.
do $$begin execute replace(pg_get_functiondef('fmz_members.command_before_release_gate(text,jsonb,uuid)'::regprocedure),'command.request_id','command_before_release_gate.request_id');end$$;
revoke all on function fmz_members.command_before_release_gate(text,jsonb,uuid) from public,anon,authenticated;
create function fmz_members.command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;draft fmz_members.drafts;org uuid;quote jsonb;approved uuid;contract fmz_members.contracts;begin
 perform fmz_private.actor();
 if action in ('review','reserve_agreement','finalize') and not fmz_members.enrollment_released() then
  raise exception 'Ondertekenen en afronden zijn nog niet vrijgegeven: definitieve privacygoedkeuring ontbreekt' using errcode='42501';
 end if;
 if action='review' then
  select * into draft from fmz_members.drafts where id=(payload->>'id')::uuid;
  if coalesce((draft.data#>>'{payment,firstPeriodCustom}')::boolean,false) or coalesce(draft.data#>>'{payment,discountAmount}','') not in ('','0','0.00','0,00') then raise exception 'Afwijkende bedragen vereisen een afzonderlijke beoordeling';end if;
 end if;
 result:=fmz_members.command_before_release_gate(action,payload,request_id);
 if action='review' then
  select * into draft from fmz_members.drafts where id=(payload->>'id')::uuid for update;
  if draft.snapshot->>'document_layout'='agreement-a4-v1' then return result;end if;
  select approved_terms_id into approved from fmz_members.release_control where singleton;
  if draft.terms_id is distinct from approved then raise exception 'Voorwaarden gewijzigd; controleer opnieuw' using errcode='PT409';end if;
  if draft.snapshot#>>'{package,cycle}'='four_weeks' then
   org:=fmz_accounting.owner_org();quote:=fmz_accounting.central_quote(org,(draft.snapshot#>>'{person,startDate}')::date,(draft.snapshot#>>'{package,cents}')::bigint,(draft.snapshot#>>'{package,sessions}')::integer);
   if quote->>'enabled' is distinct from 'true' then raise exception 'Gezamenlijke factuurcyclus is nog niet vrijgegeven';end if;
  end if;
  update fmz_members.drafts set snapshot=snapshot||jsonb_build_object('document_layout','agreement-a4-v1','central_billing',quote) where id=draft.id returning * into draft;
  result:=to_jsonb(draft);
  update fmz_members.receipts set result=command.result where actor_id=draft.trainer_id and receipts.request_id=command.request_id;
 elsif action='finalize' then
  select * into contract from fmz_members.contracts where id=(payload->>'id')::uuid;
  if contract.snapshot#>>'{central_billing,enabled}'='true' then
   if contract.snapshot#>>'{central_billing,creditsResolved}' is distinct from 'true' then raise exception 'Trainingsaantal voor de deelperiode vereist een expliciete afspraak';end if;
   perform fmz_accounting.attach_central_agreement(contract.org_id,contract.agreement_id,contract.snapshot->'central_billing');
  end if;
 end if;
 return result;
end$$;
grant execute on function fmz_members.read(text,jsonb),fmz_members.command(text,jsonb,uuid) to authenticated;
revoke all on function fmz_members.read(text,jsonb),fmz_members.command(text,jsonb,uuid) from public,anon;
-- Rebind SQL wrappers explicitly after rename; no direct pre-gate function is reachable.
create or replace function public.fmz_members_read(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select fmz_members.read(action,payload)$$;
create or replace function public.fmz_members_command(action text,payload jsonb,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_members.command(action,payload,request_id)$$;
commit;

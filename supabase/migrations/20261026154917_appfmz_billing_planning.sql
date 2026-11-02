-- Additive planning: never converts agreements, posts invoices or records payments.
begin;
-- Prospective choices read the versioned catalog; agreement snapshots are never repriced.
create or replace function fmz_accounting.billing_catalog(pid text) returns jsonb language sql stable set search_path='' as $$
 select snapshot from fmz_members.catalog_versions where package_id=pid and active
$$;
create table fmz_accounting.billing_plan_rules(
 org_id uuid not null references fmz_accounting.organizations(id),client_id text not null,
 version bigint not null default 1, state text not null default 'active' check(state in('active','paused','ended')),
 pause_from date,pause_until date,end_date date,
 send_mode text not null default 'manual' check(send_mode in('manual','automatic','disabled')),
 send_mode_approved_by uuid references auth.users(id),send_mode_approved_at timestamptz,
 reason text not null,updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 primary key(org_id,client_id),check(pause_until is null or pause_from is not null and pause_until>=pause_from),
 check(state<>'ended' or end_date is not null),check(send_mode<>'automatic' or send_mode_approved_by is not null and send_mode_approved_at is not null)
);
create table fmz_accounting.billing_plan_tasks(
 org_id uuid not null references fmz_accounting.organizations(id),id uuid not null default gen_random_uuid(),client_id text not null,
 agreement_id uuid,start_date date not null,end_date date not null,send_date date not null,
 invoice_id uuid,version bigint not null default 1,status text not null default 'active' check(status in('active','paused','cancelled')),
 manual_date boolean not null default false,reason text not null default '',warning text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(org_id,id),foreign key(org_id,agreement_id) references fmz_accounting.agreement_versions(org_id,id),
 foreign key(org_id,invoice_id) references fmz_accounting.records(org_id,id),check(end_date>=start_date)
);
create unique index billing_plan_tasks_period on fmz_accounting.billing_plan_tasks(org_id,client_id,start_date,end_date) where agreement_id is not null;
create index billing_plan_tasks_due on fmz_accounting.billing_plan_tasks(send_date,org_id) where status='active';
create unique index billing_plan_tasks_invoice on fmz_accounting.billing_plan_tasks(org_id,invoice_id) where invoice_id is not null;
alter table fmz_accounting.billing_plan_rules enable row level security;
alter table fmz_accounting.billing_plan_tasks enable row level security;
revoke all on fmz_accounting.billing_plan_rules,fmz_accounting.billing_plan_tasks from public,anon,authenticated;
create table fmz_accounting.billing_plan_reviews(
 org_id uuid not null,task_id uuid not null,invoice_id uuid not null,invoice_version bigint not null,decision text not null check(decision in('other_period','use_existing')),
 reason text not null,actor_id uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(org_id,task_id,invoice_id),foreign key(org_id,task_id) references fmz_accounting.billing_plan_tasks(org_id,id),foreign key(org_id,invoice_id) references fmz_accounting.records(org_id,id)
);
alter table fmz_accounting.billing_plan_reviews enable row level security;
revoke all on fmz_accounting.billing_plan_reviews from public,anon,authenticated;

-- Explicit first-period pricing, only before billing or signing. No implicit prorating.
create table fmz_accounting.billing_first_periods(
 org_id uuid not null,agreement_id uuid not null,first_end date not null,amount_cents bigint not null check(amount_cents between 0 and 900000000000),
 reason text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(org_id,agreement_id),foreign key(org_id,agreement_id) references fmz_accounting.agreement_versions(org_id,id)
);
alter table fmz_accounting.billing_first_periods enable row level security;
revoke all on fmz_accounting.billing_first_periods from public,anon,authenticated;
-- Signed enrollment payment terms are immutable, separate from the catalog snapshot.
create table fmz_accounting.billing_agreement_discounts(
 org_id uuid not null,agreement_id uuid not null,discount_cents bigint not null check(discount_cents>0),periods integer not null check(periods between 1 and 130),
 reason text not null check(length(trim(reason))>=3),created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 primary key(org_id,agreement_id),foreign key(org_id,agreement_id) references fmz_accounting.agreement_versions(org_id,id)
);
alter table fmz_accounting.billing_agreement_discounts enable row level security;
revoke all on fmz_accounting.billing_agreement_discounts from public,anon,authenticated;
create or replace function fmz_members.attach_payment(oid uuid,aid uuid,payment jsonb,actor uuid) returns void language plpgsql set search_path='' as $$
declare v fmz_accounting.agreement_versions;discount bigint;periods integer;first_end date;first_amount bigint;normal_end date;custom boolean;
begin
 select * into v from fmz_accounting.agreement_versions where org_id=oid and id=aid;
 if v.id is null or actor is distinct from auth.uid() or not exists(select 1 from fmz_accounting.organizations where id=oid and owner_id=actor) then raise exception 'Betaalafspraak niet bevoegd' using errcode='42501';end if;
 if exists(select 1 from fmz_members.contracts where agreement_id=aid) or exists(select 1 from fmz_accounting.billing_plan_tasks where org_id=oid and agreement_id=aid) or exists(select 1 from fmz_accounting.records where org_id=oid and data#>>'{billing,agreementVersionId}'=aid::text) then raise exception 'Vastgelegde betaalafspraak blijft onveranderlijk' using errcode='PT409';end if;
 discount:=coalesce((payment->>'discountCents')::bigint,0);periods:=coalesce((payment->>'discountPeriods')::integer,0);custom:=coalesce((payment->>'firstPeriodCustom')::boolean,false);
 normal_end:=case when v.cycle='four_weeks' then v.effective_from+27 when v.cycle='calendar_month' then (date_trunc('month',v.effective_from)+interval '1 month - 1 day')::date else v.effective_from end;
 first_end:=case when custom then (payment->>'firstPeriodEnd')::date else normal_end end;first_amount:=case when custom then (payment->>'firstPeriodCents')::bigint else v.amount_cents end;
 if (v.cycle='calendar_month' and first_end is distinct from normal_end) or first_end is null or first_end<v.effective_from or first_end>normal_end or first_amount is null or first_amount<0 or first_amount>900000000000 or discount<0 or discount>least(v.amount_cents,first_amount) or (discount>0 and (periods not between 1 and 130 or length(trim(coalesce(payment->>'discountReason','')))<3)) or (discount=0 and periods<>0) then raise exception 'Controleer korting, geldigheidsduur en expliciete eersteperiode' using errcode='22023';end if;
 if custom and length(trim(coalesce(payment->>'firstPeriodReason','')))<3 then raise exception 'Licht de afwijkende eersteperiode toe' using errcode='22023';end if;
 if payment ? 'baseCents' and (payment->>'baseCents')::bigint is distinct from v.amount_cents or payment ? 'firstPeriodNetCents' and (payment->>'firstPeriodNetCents')::bigint is distinct from first_amount-discount then raise exception 'Betaalsnapshot wijkt af' using errcode='PT409';end if;
 if custom then insert into fmz_accounting.billing_first_periods(org_id,agreement_id,first_end,amount_cents,reason,created_by) values(oid,aid,first_end,first_amount,payment->>'firstPeriodReason',actor);end if;
 if discount>0 then insert into fmz_accounting.billing_agreement_discounts(org_id,agreement_id,discount_cents,periods,reason,created_by) values(oid,aid,discount,periods,payment->>'discountReason',actor);end if;
end $$;
revoke all on function fmz_members.attach_payment(uuid,uuid,jsonb,uuid) from public,anon,authenticated;
create or replace function fmz_accounting.billing_period(v fmz_accounting.agreement_versions,at_date date) returns jsonb language plpgsql stable set search_path='' as $$
declare first_date date;last_date date;exception fmz_accounting.billing_first_periods;anchor date;
begin
 if at_date is null or at_date<v.effective_from then raise exception 'De overeenkomst is nog niet ingegaan';end if;
 select * into exception from fmz_accounting.billing_first_periods where org_id=v.org_id and agreement_id=v.id;
 if exception.agreement_id is not null and at_date<=exception.first_end then first_date:=v.effective_from;last_date:=exception.first_end;
 elsif v.cycle='calendar_month' then first_date:=date_trunc('month',at_date)::date;last_date:=(first_date+interval '1 month - 1 day')::date;
 elsif v.cycle='four_weeks' then anchor:=coalesce(exception.first_end+1,v.effective_from);first_date:=anchor+((at_date-anchor)/28)*28;last_date:=first_date+27;
 else first_date:=v.effective_from;last_date:=first_date;end if;
 return jsonb_build_object('start',first_date,'end',last_date,'invoiceDate',last_date,'nextStart',case when v.cycle<>'none' then last_date+1 end);
end $$;
create function fmz_accounting.billing_amount(v fmz_accounting.agreement_versions,p jsonb) returns bigint language sql stable set search_path='' as $$
 select coalesce((select amount_cents from fmz_accounting.billing_first_periods where org_id=v.org_id and agreement_id=v.id and v.effective_from=(p->>'start')::date and first_end=(p->>'end')::date),v.amount_cents)
$$;
create function fmz_accounting.billing_discount(v fmz_accounting.agreement_versions,p jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare d fmz_accounting.billing_agreement_discounts;f fmz_accounting.billing_first_periods;n integer;start_date date;anchor date;
begin
 select * into d from fmz_accounting.billing_agreement_discounts where org_id=v.org_id and agreement_id=v.id;
 if d.agreement_id is null then return jsonb_build_object('cents',0,'reason','');end if;
 select * into f from fmz_accounting.billing_first_periods where org_id=v.org_id and agreement_id=v.id;start_date:=(p->>'start')::date;
 if start_date=v.effective_from then n:=1;
 elsif v.cycle='four_weeks' then anchor:=coalesce(f.first_end+1,v.effective_from);n:=(start_date-anchor)/28+case when f.agreement_id is null then 1 else 2 end;
 elsif v.cycle='calendar_month' then n:=(extract(year from start_date)::integer-extract(year from v.effective_from)::integer)*12+extract(month from start_date)::integer-extract(month from v.effective_from)::integer+1;
 else n:=1;end if;
 return jsonb_build_object('cents',case when n between 1 and d.periods then d.discount_cents else 0 end,'reason',case when n between 1 and d.periods then d.reason else '' end,'period',n,'validPeriods',d.periods);
end $$;
revoke all on function fmz_accounting.billing_discount(fmz_accounting.agreement_versions,jsonb) from public,anon,authenticated;
create or replace function fmz_accounting.billing_metadata(v fmz_accounting.agreement_versions,p jsonb) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('agreementVersionId',v.id,'agreementVersion',v.version,'clientId',v.client_id,'packageId',v.package_id,'packageLabel',v.package_label,
 'cycle',v.cycle,'effectiveFrom',v.effective_from,'start',p->>'start','end',p->>'end','invoiceDate',p->>'invoiceDate','amountCents',fmz_accounting.billing_amount(v,p),'discount',fmz_accounting.billing_discount(v,p),'netCents',fmz_accounting.billing_amount(v,p)-(fmz_accounting.billing_discount(v,p)->>'cents')::bigint)
$$;

-- Server-only helper. Receives a locked task; has no user impersonation or finalization path.
create function fmz_accounting.planning_prepare(oid uuid,tid uuid) returns jsonb language plpgsql set search_path='' as $$
declare t fmz_accounting.billing_plan_tasks;v fmz_accounting.agreement_versions;r fmz_accounting.records;
 owner_id uuid;c jsonb;p jsonb;s jsonb;raw jsonb;body jsonb;description_text text;price bigint;
begin
 select o.owner_id into owner_id from fmz_accounting.organizations o join public.profiles pr on pr.id=o.owner_id and pr.role='trainer' join auth.users u on u.id=o.owner_id and u.email_confirmed_at is not null where o.id=oid for update of o;
 if owner_id is null then raise exception 'Bevoegde owner ontbreekt' using errcode='42501';end if;
 select * into t from fmz_accounting.billing_plan_tasks where org_id=oid and id=tid for update;
 if t.id is null or t.status<>'active' then raise exception 'Planning is niet actief' using errcode='PT409';end if;
 if t.invoice_id is not null then select * into r from fmz_accounting.records where org_id=oid and id=t.invoice_id;if r.id is not null then return to_jsonb(r);end if;end if;
 select * into v from fmz_accounting.agreement_versions where org_id=oid and id=t.agreement_id;
 if v.id is null or not v.enabled then raise exception 'Actieve afspraak ontbreekt' using errcode='PT409';end if;
 p:=fmz_accounting.billing_period(v,t.start_date);
 if p->>'start'<>t.start_date::text or p->>'end'<>t.end_date::text then raise exception 'Afspraakperiode is gewijzigd' using errcode='PT409';end if;
 select * into r from fmz_accounting.records where org_id=oid and kind='invoice' and source_key='billing:'||t.client_id||':'||t.start_date||':'||t.end_date;
 if r.id is null then
  if exists(select 1 from fmz_accounting.records inv where inv.org_id=oid and inv.kind='invoice' and inv.parent_id is null and nullif(inv.data->>'credit_of','') is null and inv.data->>'client_id'=t.client_id and not(inv.data ? 'billing') and not exists(select 1 from fmz_accounting.billing_plan_reviews review where review.org_id=oid and review.task_id=t.id and review.invoice_id=inv.id and review.invoice_version=inv.version and review.decision='other_period')) then raise exception 'Bestaande factuur zonder bewezen serviceperiode: controleer deze eerst; de factuurdatum bewijst de periode niet' using errcode='PT409';end if;
  select item into c from public.coach_workspaces w cross join lateral jsonb_array_elements(w.state->'clients') item where w.trainer_id=owner_id and item->>'id'=t.client_id;
  if c is null then raise exception 'Klant ontbreekt in de owneradministratie' using errcode='PT409';end if;
  select data into s from fmz_accounting.records where org_id=oid and kind='settings' and status='confirmed' and date<=t.send_date order by date desc,created_at desc limit 1;
  description_text:=v.package_label||' - '||to_char(t.start_date,'DD-MM-YYYY')||' t/m '||to_char(t.end_date,'DD-MM-YYYY')||case v.cycle when 'four_weeks' then ' - per 4 weken' when 'calendar_month' then ' - per kalendermaand' else ' - eenmalig' end;
  price:=fmz_accounting.billing_amount(v,p);
  raw:=jsonb_build_object('description',description_text,'amount',price::numeric/100,'unitPrice',price::numeric/100,'quantity','1','discount',(fmz_accounting.billing_discount(v,p)->>'cents')::numeric/100,'discountNote',fmz_accounting.billing_discount(v,p)->>'reason','discountMode','fixed','discountPercent','0','priceMode','inclusive','extraLines','[]'::jsonb,
   'date',t.send_date,'term',coalesce(s->>'paymentTermDays','14'),'serviceDate',t.end_date,'serviceExtent',case when v.sessions>0 then v.sessions||' trainingen' else 'Coaching' end,'period',t.start_date||' t/m '||t.end_date,'reference','',
   'customerName',c->>'name','customerEmail',c->>'email','customerAddress',concat_ws(', ',nullif(c#>>'{profile,address}',''),nullif(c#>>'{profile,postalCode}',''),nullif(c#>>'{profile,city}','')));
  body:=jsonb_build_object('raw',raw,'date',t.send_date,'client_id',t.client_id,'packageLabel',v.package_label,'billing',fmz_accounting.billing_metadata(v,p),'customer',jsonb_build_object('name',raw->>'customerName','email',raw->>'customerEmail','address',raw->>'customerAddress'),'description',description_text,'service_date',t.end_date,'service_extent',raw->>'serviceExtent','quantity',1,'gross_cents',price,'discount_cents',(fmz_accounting.billing_discount(v,p)->>'cents')::bigint,'discount_input_cents',(fmz_accounting.billing_discount(v,p)->>'cents')::bigint,'discount_mode','fixed','discountNote',fmz_accounting.billing_discount(v,p)->>'reason','term_days',(raw->>'term')::integer,'planning',jsonb_build_object('task_id',t.id,'origin','server_draft'));
  body:=body||jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('description',description_text,'quantity_milli',1000,'unit_cents',(body->>'gross_cents')::bigint)),'price_mode','inclusive','discount_bp',0,'period',raw->>'period','reference',coalesce(raw->>'reference',''));
  insert into fmz_accounting.records(org_id,id,kind,date,status,data,created_by) values(oid,gen_random_uuid(),'invoice',t.send_date,'draft',body,owner_id) returning * into r;
  insert into fmz_accounting.audit(org_id,actor_id,action,detail) values(oid,owner_id,'planning_prepare',jsonb_build_object('actor_kind','system','task_id',t.id,'after',to_jsonb(r)));
 end if;
 update fmz_accounting.billing_plan_tasks set invoice_id=r.id,version=version+1,warning=null,updated_at=now() where org_id=oid and id=tid;
 return to_jsonb(r);
end $$;

-- Cron invokes this directly; user RPC scopes to its verified owner organization.
create function fmz_accounting.planning_tick(asof date default (now() at time zone 'Europe/Amsterdam')::date,only_org uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare o fmz_accounting.organizations;v fmz_accounting.agreement_versions;rules fmz_accounting.billing_plan_rules;t fmz_accounting.billing_plan_tasks;p jsonb;d date;stop date;chosen uuid;n integer:=0;bad integer:=0;task_status text;err text;
begin
 if asof is null then raise exception 'Plandatum ontbreekt';end if;
 for o in select * from fmz_accounting.organizations where (only_org is null or id=only_org) order by id loop
  perform 1 from fmz_accounting.organizations where id=o.id for update;
  for v in select * from fmz_accounting.agreement_versions where org_id=o.id and effective_from<=asof+63 order by client_id,effective_from,version loop
   continue when v.cycle='none' and v.effective_from<asof;
   select * into rules from fmz_accounting.billing_plan_rules where org_id=o.id and client_id=v.client_id;
   d:=greatest(v.effective_from,asof);stop:=asof+63;
   loop
    exit when d>stop;
    p:=fmz_accounting.billing_period(v,d);
    select id into chosen from fmz_accounting.agreement_versions where org_id=o.id and client_id=v.client_id and effective_from<=(p->>'start')::date order by effective_from desc,version desc limit 1;
    if chosen=v.id and v.enabled and not exists(select 1 from fmz_accounting.agreement_versions where org_id=o.id and client_id=v.client_id and effective_from>(p->>'start')::date and effective_from<=(p->>'end')::date) then
     task_status:=case when rules.state='ended' and (p->>'end')::date>=rules.end_date then 'cancelled' when rules.state='paused' and ((rules.pause_from is null or (p->>'end')::date>=rules.pause_from) and (rules.pause_until is null or (p->>'start')::date<=rules.pause_until)) then 'paused' else 'active' end;
     insert into fmz_accounting.billing_plan_tasks(org_id,client_id,agreement_id,start_date,end_date,send_date,status) values(o.id,v.client_id,v.id,(p->>'start')::date,(p->>'end')::date,(p->>'invoiceDate')::date,task_status)
      on conflict(org_id,client_id,start_date,end_date) where agreement_id is not null do nothing;
    end if;
    exit when v.cycle='none';d:=(p->>'end')::date+1;
   end loop;
  end loop;
  -- Keep owner cancellations; only rule-driven pauses are refreshed. Existing posted invoices never change.
  for t in select * from fmz_accounting.billing_plan_tasks where org_id=o.id order by send_date,id loop
   select * into rules from fmz_accounting.billing_plan_rules where org_id=o.id and client_id=t.client_id;
   task_status:=case when t.status='cancelled' then 'cancelled' when rules.state='ended' and t.end_date>=rules.end_date then 'cancelled' when rules.state='paused' and (rules.pause_from is null or t.end_date>=rules.pause_from) and (rules.pause_until is null or t.start_date<=rules.pause_until) then 'paused' else 'active' end;
   if task_status<>t.status then update fmz_accounting.billing_plan_tasks set status=task_status,version=version+1,updated_at=now() where org_id=o.id and id=t.id;t.status:=task_status;end if;
   if t.status='active' and t.send_date<=asof+7 and t.invoice_id is null then
    begin perform fmz_accounting.planning_prepare(o.id,t.id);n:=n+1;
    exception when others then
     err:=case when sqlstate='PT409' then sqlerrm else 'Concept niet voorbereid. Controleer afspraak, klantgegevens en factuurinstellingen.' end;
     update fmz_accounting.billing_plan_tasks set warning=err,updated_at=now() where org_id=o.id and id=t.id;bad:=bad+1;
    end;
   end if;
  end loop;
 end loop;
 return jsonb_build_object('prepared',n,'needs_review',bad,'date',asof);
end $$;

-- Readiness is a read-only validation. It never reserves a number or issues a document.
create function fmz_accounting.planning_ready(r fmz_accounting.records) returns boolean language plpgsql stable set search_path='' as $$
declare s fmz_accounting.records;b jsonb:=r.data;rate bigint;totals jsonb;gross bigint;discount bigint;term integer;
begin
 if r.id is null or r.kind<>'invoice' or r.status<>'draft' then return false;end if;
 select * into s from fmz_accounting.records where org_id=r.org_id and kind='settings' and status='confirmed' and date<=r.date order by date desc,created_at desc limit 1;
 if s.id is null or coalesce((s.data->>'confirmed')::boolean,false)=false or trim(coalesce(s.data->>'businessName',''))='' or trim(coalesce(s.data->>'address',''))='' or trim(coalesce(s.data->>'postalCity',''))='' then return false;end if;
 if coalesce((s.data->>'kvk_registered')::boolean,true) and trim(coalesce(s.data->>'chamberNumber',''))='' or s.data->>'vat_status'='standard' and trim(coalesce(s.data->>'vatNumber',''))='' then return false;end if;
 rate:=case when s.data->>'vat_status' in('kor','exempt') then 0 else (s.data->>'vat_basis_points')::bigint end;
 if rate is null or rate not in(0,900,2100) or b ? 'settings_id' and b->>'settings_id' is distinct from s.id::text then return false;end if;
 if b ? 'lines' then totals:=fmz_accounting.invoice_totals(b,rate);gross:=(totals->>'grossCents')::bigint;discount:=(totals->>'discountCents')::bigint;else gross:=(b->>'gross_cents')::bigint;discount:=(b->>'discount_cents')::bigint;end if;
 term:=(b->>'term_days')::integer;
 return coalesce(gross between 0 and 900000000000 and discount between 0 and gross and term between 0 and 3650 and trim(coalesce(b#>>'{customer,name}',''))<>'' and trim(coalesce(b#>>'{customer,address}',''))<>'' and trim(coalesce(b->>'description',''))<>'' and trim(coalesce(b->>'service_extent',''))<>'' and nullif(b->>'service_date','')::date is not null,false);
 exception when others then return false;
end $$;
revoke all on function fmz_accounting.planning_ready(fmz_accounting.records) from public,anon,authenticated;

create function fmz_accounting.planning_read() returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid;
begin
 oid:=fmz_accounting.owner_org();
 return jsonb_build_object('rules',coalesce((select jsonb_agg(to_jsonb(r) order by client_id) from fmz_accounting.billing_plan_rules r where org_id=oid),'[]'),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('candidates',coalesce((select jsonb_agg(jsonb_build_object('id',inv.id,'version',inv.version,'number',inv.number,'date',inv.date,'description',inv.data->>'description','cents',coalesce(inv.data#>'{document,totalCents}',inv.data->'gross_cents'))) from fmz_accounting.records inv where inv.org_id=t.org_id and inv.kind='invoice' and inv.parent_id is null and nullif(inv.data->>'credit_of','') is null and inv.data->>'client_id'=t.client_id and not(inv.data ? 'billing') and not exists(select 1 from fmz_accounting.billing_plan_reviews review where review.org_id=t.org_id and review.task_id=t.id and review.invoice_id=inv.id and review.invoice_version=inv.version)),'[]'),'client_name',coalesce(c->>'name',r.data#>>'{customer,name}','Klant'),'cycle',coalesce(v.cycle,'none'),'package_id',v.package_id,'package_label',v.package_label,'amount_cents',coalesce((r.data->>'gross_cents')::bigint,fmz_accounting.billing_amount(v,jsonb_build_object('start',t.start_date,'end',t.end_date))),'discount_cents',coalesce((r.data->>'discount_cents')::bigint,case when v.id is not null then (fmz_accounting.billing_discount(v,jsonb_build_object('start',t.start_date,'end',t.end_date))->>'cents')::bigint else 0 end),'number',r.number,'ready',fmz_accounting.planning_ready(r)) order by t.send_date,t.id)
 from fmz_accounting.billing_plan_tasks t left join fmz_accounting.agreement_versions v on v.org_id=t.org_id and v.id=t.agreement_id left join fmz_accounting.records r on r.org_id=t.org_id and r.id=t.invoice_id
 left join lateral(select item c from public.coach_workspaces w cross join lateral jsonb_array_elements(w.state->'clients') item where w.trainer_id=auth.uid() and item->>'id'=t.client_id) c on true where t.org_id=oid),'[]'));
end $$;

create function fmz_accounting.planning_recalculation(oid uuid,tid uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare t fmz_accounting.billing_plan_tasks;r fmz_accounting.records;v fmz_accounting.agreement_versions;s fmz_accounting.records;body jsonb;raw jsonb;price bigint;totals jsonb;rate bigint;
begin
 select * into t from fmz_accounting.billing_plan_tasks where org_id=oid and id=tid;
 select * into r from fmz_accounting.records where org_id=oid and id=t.invoice_id and kind='invoice' and status='draft';
 select * into v from fmz_accounting.agreement_versions where org_id=oid and id=t.agreement_id;
 if r.id is null or v.id is null or t.status<>'active' then raise exception 'Kies een actief pakketconcept; definitieve facturen blijven onveranderlijk' using errcode='PT409';end if;
 if (select id from fmz_accounting.agreement_versions where org_id=oid and client_id=t.client_id and effective_from<=t.start_date order by effective_from desc,version desc limit 1) is distinct from v.id then raise exception 'Open de periode van de nieuwe afspraak; het oude concept wordt niet stilzwijgend omgezet' using errcode='PT409';end if;
 select * into s from fmz_accounting.records where org_id=oid and kind='settings' and status='confirmed' and date<=r.date order by date desc,created_at desc limit 1;
 if s.id is null then raise exception 'Bevestigde btw-instellingen ontbreken' using errcode='22023';end if;
 price:=fmz_accounting.billing_amount(v,jsonb_build_object('start',t.start_date,'end',t.end_date));body:=r.data;raw:=coalesce(body->'raw','{}');
 raw:=raw||jsonb_build_object('unitPrice',price::numeric/100,'amount',price::numeric/100,'quantity','1','priceMode','inclusive');
 body:=body||jsonb_build_object('raw',raw,'price_mode','inclusive','settings_id',s.id,'discount_mode',coalesce(body->>'discount_mode','fixed'),'discount_input_cents',coalesce(body->'discount_input_cents',body->'discount_cents','0'::jsonb),'discount_bp',coalesce(body->'discount_bp','0'::jsonb));
 if jsonb_typeof(body->'lines')='array' and jsonb_array_length(body->'lines')>0 then body:=jsonb_set(body,'{lines,0}',body#>'{lines,0}'||jsonb_build_object('unit_cents',price,'quantity_milli',1000));
 else body:=body||jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('description',body->>'description','unit_cents',price,'quantity_milli',1000)));end if;
 rate:=case when s.data->>'vat_status' in('kor','exempt') then 0 else (s.data->>'vat_basis_points')::bigint end;
 totals:=fmz_accounting.invoice_totals(body,rate);body:=body||jsonb_build_object('gross_cents',totals->'grossCents','discount_cents',totals->'discountCents','quantity',1);
 return jsonb_build_object('task_id',tid,'invoice_id',r.id,'version',r.version,'before',r.data,'after',body,'totals',totals,'token',md5(body::text));
end $$;
create function fmz_accounting.planning_command(action text,payload jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid;receipt fmz_accounting.receipts;hash text;result jsonb;rules fmz_accounting.billing_plan_rules;t fmz_accounting.billing_plan_tasks;before_value jsonb;cid text;reason text;mode text;v fmz_accounting.agreement_versions;first_end date;signed_contract boolean:=false;r fmz_accounting.records;
begin
 oid:=fmz_accounting.owner_org();
 if request_id is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>50000 then raise exception 'Ongeldige planningsaanvraag' using errcode='22023';end if;
 perform 1 from fmz_accounting.organizations where id=oid for update;
 hash:=md5('planning:'||action||':'||payload::text);select * into receipt from fmz_accounting.receipts where org_id=oid and receipts.request_id=planning_command.request_id;
 if found then if receipt.payload_hash<>hash then raise exception 'Aanvraag-ID gebruikt voor andere gegevens' using errcode='PT409';end if;return receipt.result;end if;
 reason:=trim(coalesce(payload->>'reason',''));
 if action='refresh' then result:=fmz_accounting.planning_tick((now() at time zone 'Europe/Amsterdam')::date,oid);
 elsif action='rule' then
  cid:=payload->>'client_id';
  if not exists(select 1 from public.coach_workspaces w cross join lateral jsonb_array_elements(w.state->'clients') c where w.trainer_id=auth.uid() and c->>'id'=cid) then raise exception 'Klant niet bevoegd' using errcode='42501';end if;
  select * into rules from fmz_accounting.billing_plan_rules where org_id=oid and client_id=cid;before_value:=to_jsonb(rules);
  if coalesce(rules.version,0) is distinct from (payload->>'version')::bigint then raise exception 'Planning elders gewijzigd. Ververs en vergelijk.' using errcode='PT409';end if;
  mode:=coalesce(payload->>'send_mode','manual');
  if length(reason) not between 5 and 1000 or payload->>'state' not in('active','paused','ended') or payload->>'state' is null or mode not in('manual','automatic','disabled') then raise exception 'Controleer status, verzendinstelling en reden' using errcode='22023';end if;
  if mode='automatic' and payload->>'automatic_confirmed' is distinct from 'true' then raise exception 'Automatisch verzenden vereist uitdrukkelijke ownerbevestiging' using errcode='42501';end if;
  insert into fmz_accounting.billing_plan_rules(org_id,client_id,state,pause_from,pause_until,end_date,send_mode,send_mode_approved_by,send_mode_approved_at,reason,updated_by)
  values(oid,cid,payload->>'state',nullif(payload->>'pause_from','')::date,nullif(payload->>'pause_until','')::date,nullif(payload->>'end_date','')::date,mode,case when mode='automatic' then auth.uid() end,case when mode='automatic' then now() end,reason,auth.uid())
  on conflict(org_id,client_id) do update set state=excluded.state,pause_from=excluded.pause_from,pause_until=excluded.pause_until,end_date=excluded.end_date,send_mode=excluded.send_mode,send_mode_approved_by=excluded.send_mode_approved_by,send_mode_approved_at=excluded.send_mode_approved_at,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=now(),version=billing_plan_rules.version+1 returning to_jsonb(billing_plan_rules.*) into result;
  perform fmz_accounting.planning_tick((now() at time zone 'Europe/Amsterdam')::date,oid);
 elsif action in('preview_recalculate','recalculate') then
  result:=fmz_accounting.planning_recalculation(oid,(payload->>'id')::uuid);
  if action='recalculate' then
   if length(reason) not between 5 and 1000 or result->>'token' is distinct from payload->>'token' or result->>'version' is distinct from payload->>'version' then raise exception 'Voorbeeld gewijzigd of reden ontbreekt; controleer opnieuw' using errcode='PT409';end if;
   before_value:=result->'before';
   update fmz_accounting.records set data=result->'after',version=version+1 where org_id=oid and id=(result->>'invoice_id')::uuid returning to_jsonb(records.*) into result;
  end if;
 elsif action='review_invoice' then
  select * into t from fmz_accounting.billing_plan_tasks where org_id=oid and id=(payload->>'id')::uuid;
  before_value:=jsonb_build_object('task',to_jsonb(t),'review',(select to_jsonb(review) from fmz_accounting.billing_plan_reviews review where review.org_id=oid and review.task_id=t.id and review.invoice_id=(payload->>'invoice_id')::uuid));
  select * into r from fmz_accounting.records where org_id=oid and id=(payload->>'invoice_id')::uuid and kind='invoice' and parent_id is null and nullif(data->>'credit_of','') is null and not(data ? 'billing');
  if t.id is null or r.id is null or r.data->>'client_id' is distinct from t.client_id or r.version is distinct from (payload->>'invoice_version')::bigint or t.version is distinct from (payload->>'version')::bigint or t.invoice_id is not null then raise exception 'Planning of bestaande factuur gewijzigd; controleer opnieuw' using errcode='PT409';end if;
  if length(reason) not between 5 and 1000 or payload->>'decision' not in('other_period','use_existing') or payload->>'decision' is null then raise exception 'Kies een gecontroleerde beslissing met reden' using errcode='22023';end if;
  if payload->>'decision'='use_existing' and r.data ? 'cancellation_id' then raise exception 'Geannuleerde factuur kan deze periode niet factureren' using errcode='PT409';end if;
  insert into fmz_accounting.billing_plan_reviews(org_id,task_id,invoice_id,invoice_version,decision,reason,actor_id) values(oid,t.id,r.id,r.version,payload->>'decision',reason,auth.uid()) on conflict(org_id,task_id,invoice_id) do update set invoice_version=excluded.invoice_version,decision=excluded.decision,reason=excluded.reason,actor_id=excluded.actor_id,created_at=now() where billing_plan_reviews.invoice_version<>excluded.invoice_version;
  update fmz_accounting.billing_plan_tasks set invoice_id=case when payload->>'decision'='use_existing' then r.id else invoice_id end,warning=null,version=version+1,updated_at=now() where org_id=oid and id=t.id returning to_jsonb(billing_plan_tasks.*) into result;
 elsif action='schedule_invoice' then
  select * into r from fmz_accounting.records where org_id=oid and id=(payload->>'invoice_id')::uuid and kind='invoice' and parent_id is null and nullif(data->>'credit_of','') is null;
  if r.id is null or r.version is distinct from (payload->>'version')::bigint or r.data ? 'cancellation_id' then raise exception 'Factuur ontbreekt of is gewijzigd; ververs eerst' using errcode='PT409';end if;
  if length(reason) not between 5 and 1000 or nullif(payload->>'send_date','') is null then raise exception 'Verzenddatum en reden vereist' using errcode='22023';end if;
  if exists(select 1 from fmz_accounting.billing_plan_tasks where org_id=oid and invoice_id=r.id) then select to_jsonb(existing) into result from fmz_accounting.billing_plan_tasks existing where org_id=oid and invoice_id=r.id;
  else
   insert into fmz_accounting.billing_plan_tasks(org_id,client_id,agreement_id,start_date,end_date,send_date,invoice_id,manual_date,reason)
   values(oid,coalesce(r.data->>'client_id','invoice:'||r.id),nullif(r.data#>>'{billing,agreementVersionId}','')::uuid,coalesce(nullif(r.data#>>'{billing,start}','')::date,r.date),coalesce(nullif(r.data#>>'{billing,end}','')::date,r.date),(payload->>'send_date')::date,r.id,true,reason) returning to_jsonb(billing_plan_tasks.*) into result;
  end if;
 elsif action='first_period' then
  perform fmz_accounting.check_numbers(payload);
  select * into v from fmz_accounting.agreement_versions where org_id=oid and id=(payload->>'agreement_id')::uuid;
  first_end:=(payload->>'first_end')::date;
  if v.id is null or v.cycle='none' or not v.enabled or v.effective_from<(now() at time zone 'Europe/Amsterdam')::date or length(reason) not between 5 and 1000 or first_end is null or first_end<v.effective_from or (payload->>'amount_cents')::bigint is null then raise exception 'Controleer de toekomstige eerste periode, het exacte bedrag en de reden' using errcode='22023';end if;
  if (v.cycle='four_weeks' and first_end>v.effective_from+27) or (v.cycle='calendar_month' and first_end<>(date_trunc('month',v.effective_from)+interval '1 month - 1 day')::date) then raise exception 'De eerste vierweekse periode kan maximaal 28 dagen bevatten; een maandafspraak behoudt de kalendermaandgrens' using errcode='22023';end if;
  if to_regclass('fmz_members.contracts') is not null then execute 'select exists(select 1 from fmz_members.contracts where org_id=$1 and agreement_id=$2)' into signed_contract using oid,v.id;end if;
  if signed_contract then raise exception 'Ondertekende afspraak is onveranderlijk; leg eerst een nieuwe overeenkomst of aanvulling vast' using errcode='PT409';end if;
  if exists(select 1 from fmz_accounting.records where org_id=oid and kind='invoice' and data#>>'{billing,agreementVersionId}'=v.id::text) or exists(select 1 from fmz_accounting.billing_plan_tasks where org_id=oid and agreement_id=v.id) then raise exception 'Er bestaat al een planning, concept of factuur; de eerste periode kan niet worden herschreven' using errcode='PT409';end if;
  insert into fmz_accounting.billing_first_periods(org_id,agreement_id,first_end,amount_cents,reason,created_by) values(oid,v.id,first_end,(payload->>'amount_cents')::bigint,reason,auth.uid()) returning to_jsonb(billing_first_periods.*) into result;
 elsif action in('task','prepare') then
  select * into t from fmz_accounting.billing_plan_tasks where org_id=oid and id=(payload->>'id')::uuid;before_value:=to_jsonb(t);
  if t.id is null or t.version is distinct from (payload->>'version')::bigint then raise exception 'Factuurplanning elders gewijzigd. Ververs en vergelijk.' using errcode='PT409';end if;
  if action='prepare' then result:=fmz_accounting.planning_prepare(oid,t.id);
  else
   if length(reason) not between 5 and 1000 or nullif(payload->>'send_date','') is null then raise exception 'Verzenddatum en duidelijke reden vereist' using errcode='22023';end if;
   if t.invoice_id is not null and exists(select 1 from fmz_accounting.records where org_id=oid and id=t.invoice_id and status='posted') then raise exception 'Definitieve factuur blijft ongewijzigd. Plan alleen de e-mail via Verzending.' using errcode='PT409';end if;
   update fmz_accounting.billing_plan_tasks set send_date=(payload->>'send_date')::date,manual_date=true,reason=trim(payload->>'reason'),version=version+1,updated_at=now() where org_id=oid and id=t.id returning to_jsonb(billing_plan_tasks.*) into result;
  end if;
 else raise exception 'Onbekende planningshandeling' using errcode='22023';end if;
 insert into fmz_accounting.audit(org_id,actor_id,action,request_id,detail) values(oid,auth.uid(),'planning_'||action,request_id,jsonb_build_object('before',before_value,'after',result,'reason',reason,'request',payload));
 insert into fmz_accounting.receipts values(oid,request_id,hash,result,now());return result;
end $$;
create function public.fmz_billing_planning_read() returns jsonb language sql security invoker set search_path='' as $$select fmz_accounting.planning_read()$$;
create function public.fmz_billing_planning_command(action text,payload jsonb,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_accounting.planning_command(action,payload,request_id)$$;
revoke all on function fmz_accounting.billing_amount(fmz_accounting.agreement_versions,jsonb),fmz_accounting.planning_recalculation(uuid,uuid),fmz_accounting.planning_prepare(uuid,uuid),fmz_accounting.planning_tick(date,uuid),fmz_accounting.planning_read(),fmz_accounting.planning_command(text,jsonb,uuid),public.fmz_billing_planning_read(),public.fmz_billing_planning_command(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function fmz_accounting.planning_read(),fmz_accounting.planning_command(text,jsonb,uuid),public.fmz_billing_planning_read(),public.fmz_billing_planning_command(text,jsonb,uuid) to authenticated;
-- Existing owner command kept verbatim except shared first-period amount source.
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
   raw:=jsonb_build_object('description',description_text,'amount',fmz_accounting.billing_amount(v,p)::numeric/100,'unitPrice',fmz_accounting.billing_amount(v,p)::numeric/100,'quantity','1','discount',(fmz_accounting.billing_discount(v,p)->>'cents')::numeric/100,'discountNote',fmz_accounting.billing_discount(v,p)->>'reason','discountMode','fixed','discountPercent','0','priceMode','inclusive','extraLines','[]'::jsonb,
   'date',p->>'invoiceDate','term',coalesce(settings->>'paymentTermDays','14'),'serviceDate',p->>'end','serviceExtent',case when v.sessions>0 then v.sessions||' trainingen' else 'Coaching' end,'period',(p->>'start')||' t/m '||(p->>'end'),'reference','',
   'customerName',source_client->>'name','customerEmail',source_client->>'email','customerAddress',concat_ws(', ',nullif(source_client#>>'{profile,address}',''),nullif(source_client#>>'{profile,postalCode}',''),nullif(source_client#>>'{profile,city}','')));
   body:=jsonb_build_object('raw',raw,'date',p->>'invoiceDate','client_id',cid,'packageLabel',v.package_label,'billing',fmz_accounting.billing_metadata(v,p),'customer',jsonb_build_object('name',raw->>'customerName','email',raw->>'customerEmail','address',raw->>'customerAddress'),'description',description_text,'service_date',p->>'end','service_extent',raw->>'serviceExtent','quantity',1,'gross_cents',fmz_accounting.billing_amount(v,p),'discount_cents',(fmz_accounting.billing_discount(v,p)->>'cents')::bigint,'discount_input_cents',(fmz_accounting.billing_discount(v,p)->>'cents')::bigint,'discount_mode','fixed','discountNote',fmz_accounting.billing_discount(v,p)->>'reason','term_days',(raw->>'term')::integer);
  body:=body||jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('description',description_text,'quantity_milli',1000,'unit_cents',(body->>'gross_cents')::bigint)),'price_mode','inclusive','discount_bp',0,'period',raw->>'period','reference',coalesce(raw->>'reference',''));
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
 'agreements',(select coalesce(jsonb_agg(to_jsonb(v)||jsonb_build_object('first_period',(select to_jsonb(f) from fmz_accounting.billing_first_periods f where f.org_id=v.org_id and f.agreement_id=v.id),'discount',(select to_jsonb(d) from fmz_accounting.billing_agreement_discounts d where d.org_id=v.org_id and d.agreement_id=v.id)) order by client_id,version),'[]') from fmz_accounting.agreement_versions v where org_id=oid));
end $$;

commit;

begin;
-- Additive API over the existing ledger. No historical data is rewritten.
create function fmz_accounting.payment_revision(oid uuid,invoice_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('version',r.version,'lines',(select count(*) from fmz_accounting.lines where org_id=oid and account_code='1100' and reference_id=invoice_id),'outstanding',fmz_accounting.balance(oid,'1100',invoice_id))
 from fmz_accounting.records r where r.org_id=oid and r.id=invoice_id and r.kind='invoice'
$$;
revoke all on function fmz_accounting.payment_revision(uuid,uuid) from public,anon,authenticated;

-- Older manual/import screens must not silently duplicate a newly registered receipt.
create function fmz_accounting.guard_payment_receipt() returns trigger language plpgsql set search_path='' as $$
begin
 if new.kind='bank' and (new.data->>'cents')::bigint>0 and new.data->>'entry_origin' is distinct from 'invoice_payment' and exists(
  select 1 from fmz_accounting.records b where b.org_id=new.org_id and b.kind='bank' and b.status<>'reversed'
   and b.data->>'entry_origin'='invoice_payment' and b.date=new.date and b.data->>'account_id'=new.data->>'account_id'
   and (b.data->>'cents')::bigint=(new.data->>'cents')::bigint
 ) and length(trim(coalesce(new.data->>'distinct_receipt_reason','')))<10 then raise exception 'Er is al een factuurontvangst met deze rekening, datum en dit bedrag. Controleer die betaling en koppel de bankbron; maak niet nogmaals een ontvangst.' using errcode='PT409';end if;
 return new;
end $$;
revoke all on function fmz_accounting.guard_payment_receipt() from public,anon,authenticated;
create trigger fmz_accounting_payment_receipt before insert on fmz_accounting.records for each row execute function fmz_accounting.guard_payment_receipt();

create function fmz_accounting.payment_command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare oid uuid; rid uuid; invoice_id uuid; bank_id uuid; amount bigint; available bigint; d date;
 inv fmz_accounting.records; b fmz_accounting.records; a fmz_accounting.records; rec fmz_accounting.records; account fmz_accounting.records;
 receipt fmz_accounting.receipts; proof fmz_accounting.files; body jsonb; result jsonb; before_value jsonb; hash text; items jsonb;
 clear_bank boolean; reason text; actual_revision jsonb; source text; part jsonb;
begin
 oid:=fmz_accounting.owner_org();
 if request_id is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>30000 then raise exception 'Ongeldig betalingsverzoek' using errcode='22023';end if;
 perform 1 from fmz_accounting.organizations where id=oid for update;
 hash:=md5('payment:'||action||':'||payload::text);
 select * into receipt from fmz_accounting.receipts where org_id=oid and receipts.request_id=payment_command.request_id;
 if found then
  if receipt.payload_hash<>hash then raise exception 'Dit verzoeknummer hoort bij andere invoer' using errcode='PT409';end if;
  return receipt.result;
 end if;
 perform fmz_accounting.check_numbers(payload);
 rid:=coalesce((payload->>'id')::uuid,gen_random_uuid());body:=coalesce(payload->'data',payload);
 if action='register' then
  invoice_id:=(body->>'invoice_id')::uuid;
  select * into inv from fmz_accounting.records where org_id=oid and id=invoice_id and kind='invoice' and status='posted' and parent_id is null;
  if inv.id is null or inv.data ? 'cancellation_id' then raise exception 'Kies een definitieve, niet-geannuleerde factuur' using errcode='22023';end if;
  actual_revision:=fmz_accounting.payment_revision(oid,invoice_id);
  if payload->'expected' is distinct from actual_revision then raise exception 'Deze factuur of betaling is intussen gewijzigd. Ververs en controleer het resterende bedrag.' using errcode='PT409';end if;
  amount:=(body->>'cents')::bigint;d:=(body->>'date')::date;
  if amount is null or amount<=0 or amount>900000000000 or d is null or d>(now() at time zone 'Europe/Amsterdam')::date then raise exception 'Vul een positief ontvangen bedrag en de werkelijke betaaldatum in; geen toekomstige datum.' using errcode='22023';end if;
  if (actual_revision->>'outstanding')::bigint<=0 then raise exception 'Deze factuur heeft geen openstaand bedrag. Een terugbetaling is een aparte handeling.' using errcode='PT409';end if;
  if amount>(actual_revision->>'outstanding')::bigint then raise exception 'Dit is meer dan nog openstaat. Controleer de ontvangst; het verschil wordt niet automatisch geboekt.' using errcode='22023';end if;
  select * into account from fmz_accounting.records where org_id=oid and id=(body->>'account_id')::uuid and kind='account' and data->>'hidden' is distinct from 'true';
  if account.id is null then raise exception 'Kies een actieve bank- of kasrekening' using errcode='22023';end if;
  if length(coalesce(body->>'description',''))>1000 then raise exception 'Omschrijving is te lang' using errcode='22023';end if;
  bank_id:=nullif(body->>'bank_id','')::uuid;
  if bank_id is null then
   if exists(select 1 from fmz_accounting.records x join fmz_accounting.records oldbank on oldbank.org_id=x.org_id and oldbank.id=(x.data->>'bank_id')::uuid
    where x.org_id=oid and x.kind='allocation' and x.status<>'reversed' and oldbank.date=d and oldbank.data->>'account_id'=account.id::text
     and exists(select 1 from jsonb_array_elements(x.data->'parts') p where p->>'type'='invoice' and p->>'target_id'=invoice_id::text and (p->>'cents')::bigint=amount))
    then raise exception 'Deze ontvangst staat al bij de factuur. Controleer de betaling; koppel alleen een aantoonbaar andere bestaande bankmutatie.' using errcode='PT409';end if;
   if exists(select 1 from fmz_accounting.records x where x.org_id=oid and x.kind='bank' and x.status<>'reversed' and x.date=d and x.data->>'account_id'=account.id::text and (x.data->>'cents')::bigint=amount)
    and length(trim(coalesce(body->>'distinct_receipt_reason','')))<10 then raise exception 'Er bestaat een mogelijke bankontvangst. Kies die mutatie of leg uit waarom dit aantoonbaar een andere ontvangst is.' using errcode='PT409';end if;
   bank_id:=gen_random_uuid();
   perform fmz_accounting.bank(oid,bank_id,jsonb_build_object('date',d,'account_id',account.id,'cents',amount,'description',coalesce(nullif(trim(body->>'description'),''),'Ontvangst '||inv.number),'entry_origin','invoice_payment','payment_id',rid,'payment_invoice_id',invoice_id,'payment_method',case when account.data->>'type'='cash' then 'cash' else 'bank' end,'distinct_receipt_reason',body->>'distinct_receipt_reason'),'invoice-payment:'||rid::text);
  else
   select * into b from fmz_accounting.records where org_id=oid and id=bank_id and kind='bank' and status<>'reversed';
   available:=-fmz_accounting.balance(oid,'1400',bank_id);
   if b.id is null or b.data->>'account_id'<>account.id::text or b.date<>d or (b.data->>'cents')::bigint<=0 then raise exception 'De gekozen ontvangst hoort niet bij deze rekening/datum' using errcode='22023';end if;
   if payload->'bank_expected' is distinct from jsonb_build_object('version',b.version,'available',available) or amount>available then raise exception 'Deze bankontvangst is intussen gekoppeld. Ververs en controleer.' using errcode='PT409';end if;
  end if;
  result:=fmz_accounting.allocate(oid,rid,jsonb_build_object('bank_id',bank_id,'date',d,'description','Ontvangst '||inv.number,'entry_origin','invoice_payment','parts',jsonb_build_array(jsonb_build_object('type','invoice','target_id',invoice_id,'cents',amount))));
  result:=jsonb_build_object('payment_id',rid,'bank_id',bank_id,'invoice_id',invoice_id,'outstanding',fmz_accounting.balance(oid,'1100',invoice_id));
 elsif action='correct' then
  select * into a from fmz_accounting.records where org_id=oid and id=(body->>'payment_id')::uuid and kind='allocation';
  if a.id is null or a.status='reversed' or a.version is distinct from (payload->>'version')::bigint then raise exception 'Deze betaling is gewijzigd of al gecorrigeerd' using errcode='PT409';end if;
  if jsonb_array_length(a.data->'parts')<>1 or a.data#>>'{parts,0,type}'<>'invoice' then raise exception 'Deze historische betaling bevat meerdere verdelingen. Laat de volledige verdeling controleren; er wordt niets automatisch teruggedraaid.' using errcode='22023';end if;
  part:=a.data#>'{parts,0}';invoice_id:=(part->>'target_id')::uuid;amount:=(part->>'cents')::bigint;
  if payload->'expected' is distinct from fmz_accounting.payment_revision(oid,invoice_id) then raise exception 'De factuur is intussen gewijzigd. Ververs vóór correctie.' using errcode='PT409';end if;
  select * into b from fmz_accounting.records where org_id=oid and id=(a.data->>'bank_id')::uuid and kind='bank';
  if b.id is null or (b.data->>'cents')::bigint<=0 then raise exception 'Deze handeling corrigeert alleen een ontvangst, geen terugbetaling' using errcode='22023';end if;
  reason:=trim(coalesce(body->>'reason',''));if length(reason)<10 or length(reason)>1000 then raise exception 'Beschrijf de invoerfout in ten minste tien tekens' using errcode='22023';end if;
  perform fmz_accounting.open_date(oid,b.date);perform fmz_accounting.open_date(oid,a.date);
  clear_bank:=coalesce(b.data->>'entry_origin'='invoice_payment' and b.data->>'payment_id'=a.id::text and not(b.data ? 'bank_evidence_id'),false);
  if clear_bank and (select count(*) from fmz_accounting.records x where x.org_id=oid and x.kind='allocation' and x.data->>'bank_id'=b.id::text)<>1 then raise exception 'Deze ontvangst heeft meer koppelingen. Controleer eerst de volledige verdeling.' using errcode='PT409';end if;
  before_value:=to_jsonb(a);
  rec:=fmz_accounting.add_record(oid,rid,'correction',b.date,jsonb_build_object('payment_reversal',true,'payment_id',a.id,'invoice_id',invoice_id,'bank_id',b.id,'cents',amount,'reason',reason,'cleared_bank',clear_bank,'effective_date',b.date),'posted',a.id);
  select jsonb_agg(jsonb_build_array(l.account_code,-l.cents,l.reference_id) order by l.journal_id,l.line_no) into items from fmz_accounting.lines l join fmz_accounting.journals j on j.org_id=l.org_id and j.id=l.journal_id where l.org_id=oid and j.record_id=a.id;
  perform fmz_accounting.post(oid,rid,a.date,'Correctie factuurkoppeling: '||reason,items);
  if clear_bank then
   select jsonb_agg(jsonb_build_array(l.account_code,-l.cents,l.reference_id) order by l.journal_id,l.line_no) into items from fmz_accounting.lines l join fmz_accounting.journals j on j.org_id=l.org_id and j.id=l.journal_id where l.org_id=oid and j.record_id=b.id;
   perform fmz_accounting.post(oid,rid,b.date,'Correctie ingevoerde ontvangst: '||reason,items);
   update fmz_accounting.records set status='reversed',version=version+1,data=data||jsonb_build_object('payment_correction_id',rid) where org_id=oid and id=b.id;
  end if;
  update fmz_accounting.records set status='reversed',version=version+1,data=data||jsonb_build_object('payment_correction_id',rid) where org_id=oid and id=a.id;
  result:=jsonb_build_object('correction_id',rid,'payment_id',a.id,'bank_id',b.id,'invoice_id',invoice_id,'cleared_bank',clear_bank,'outstanding',fmz_accounting.balance(oid,'1100',invoice_id));
 elsif action='attach_source' then
  select * into b from fmz_accounting.records where org_id=oid and id=(body->>'bank_id')::uuid and kind='bank' and status<>'reversed';
  if b.id is null or b.data->>'entry_origin' is distinct from 'invoice_payment' or b.version is distinct from (payload->>'version')::bigint then raise exception 'Deze handmatige ontvangst is gewijzigd. Ververs eerst.' using errcode='PT409';end if;
  source:=body->>'source_key';
  if source is null or source !~ '^[a-f0-9]{64}$' or b.data->>'account_id' is distinct from body->>'account_id' or b.date is distinct from (body->>'date')::date or (b.data->>'cents')::bigint is distinct from (body->>'cents')::bigint then raise exception 'Bankbron en ontvangst komen niet overeen; controleer rekening, datum en bedrag.' using errcode='22023';end if;
  if b.data ? 'bank_evidence_id' or exists(select 1 from fmz_accounting.records where org_id=oid and kind='bank' and source_key=source) then raise exception 'Deze bankbron of ontvangst is al gekoppeld' using errcode='PT409';end if;
  select * into proof from fmz_accounting.files where org_id=oid and id=(body->>'file_id')::uuid and status='ready';if proof.id is null then raise exception 'Bewaar eerst het originele CSV-bestand' using errcode='22023';end if;
  before_value:=to_jsonb(b);
  update fmz_accounting.records set source_key=source,version=version+1,data=data||jsonb_build_object('previous_source_key',b.source_key,'bank_evidence_id',proof.id,'external_reference',body->>'external_reference') where org_id=oid and id=b.id returning * into rec;
  result:=jsonb_build_object('bank_id',b.id,'file_id',proof.id,'source_attached',true,'no_new_receipt',true);
 else raise exception 'Onbekende betaalhandeling' using errcode='22023';end if;
 insert into fmz_accounting.audit(org_id,actor_id,action,request_id,detail) values(oid,auth.uid(),'payment_'||action,payment_command.request_id,jsonb_build_object('before',before_value,'after',result));
 insert into fmz_accounting.receipts values(oid,payment_command.request_id,hash,result,now());
 return result;
end $$;
revoke all on function fmz_accounting.payment_command(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function fmz_accounting.payment_command(text,jsonb,uuid) to authenticated;
create function public.fmz_payment_command(action text,payload jsonb,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select fmz_accounting.payment_command(action,payload,request_id)$$;
revoke all on function public.fmz_payment_command(text,jsonb,uuid) from public,anon;
grant execute on function public.fmz_payment_command(text,jsonb,uuid) to authenticated;
commit;

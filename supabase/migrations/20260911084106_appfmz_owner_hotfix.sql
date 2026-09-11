-- Targeted function update only. No existing rows or private objects are changed on deployment.
begin;
create function fmz_accounting.invoice_totals(body jsonb, rate bigint) returns jsonb language plpgsql immutable set search_path='' as $$
declare item jsonb; result_lines jsonb:='[]'; subtotal bigint:=0; unit bigint; qty numeric; line_amount bigint; discount bigint; net bigint; tax bigint; total bigint; gross bigint; bp bigint;
begin
 if rate is null or rate not in (0,900,2100) then raise exception 'Bevestigd btw-tarief ontbreekt';end if;
 if jsonb_typeof(body->'lines') is distinct from 'array' or jsonb_array_length(body->'lines') not between 1 and 200 then raise exception 'Gebruik 1 tot 200 factuurregels';end if;
 if body->>'price_mode' is null or body->>'price_mode' not in ('inclusive','exclusive') then raise exception 'Kies inclusief of exclusief btw';end if;
 for item in select value from jsonb_array_elements(body->'lines') loop
  unit:=(item->>'unit_cents')::bigint;qty:=(item->>'quantity_milli')::numeric;
  if unit is null or unit<0 or qty is null or qty<=0 or qty<>trunc(qty) or qty>1000000000 or length(trim(coalesce(item->>'description','')))=0 then raise exception 'Controleer aantal, eenheidsprijs en omschrijving';end if;
  line_amount:=round(unit::numeric*qty/1000);subtotal:=subtotal+line_amount;
  if subtotal>900000000000 then raise exception 'Factuurbedrag is te groot';end if;
  result_lines:=result_lines||jsonb_build_array(jsonb_build_object('description',item->>'description','quantity',qty/1000,'unitCents',unit,'amountCents',line_amount));
 end loop;
 if body->>'discount_mode'='percent' then
  bp:=(body->>'discount_bp')::bigint;if bp is null or bp not between 0 and 10000 then raise exception 'Korting moet tussen 0 en 100 procent liggen';end if;
  discount:=round(subtotal::numeric*bp/10000);
 elsif body->>'discount_mode'='fixed' then discount:=(body->>'discount_input_cents')::bigint;
 else raise exception 'Kies vaste korting of kortingspercentage';end if;
 if discount is null or discount<0 or discount>subtotal then raise exception 'Korting is ongeldig of hoger dan het factuurbedrag';end if;
 if body->>'price_mode'='exclusive' then
  net:=subtotal-discount;tax:=round(net::numeric*rate/10000);total:=net+tax;gross:=subtotal+round(subtotal::numeric*rate/10000);
 else
  gross:=subtotal;total:=subtotal-discount;net:=round(total::numeric*10000/(10000+rate));tax:=total-net;
 end if;
 return jsonb_build_object('lines',result_lines,'subtotalCents',subtotal,'discountInputCents',discount,'grossCents',gross,'discountCents',gross-total,'netCents',net,'vatCents',tax,'totalCents',total);
end $$;

create or replace function fmz_accounting.final_invoice(oid uuid,rid uuid,expected bigint) returns jsonb language plpgsql set search_path='' as $$
declare r fmz_accounting.records; original fmz_accounting.records; s fmz_accounting.records; body jsonb; doc jsonb;
 gross bigint; discount bigint; total bigint; net bigint; vat bigint; rate bigint; term integer; qty numeric; no text; nextno bigint;
 calculated jsonb; credit boolean; remaining bigint; credited_before bigint:=0; factor integer:=1; d date;
begin
 select * into r from fmz_accounting.records where org_id=oid and id=rid and kind='invoice' for update;
 if r.id is null then raise exception 'Concept ontbreekt';end if;
 if r.status='posted' then return to_jsonb(r);end if;
 if r.version is distinct from expected then raise exception 'Concept elders gewijzigd' using errcode='PT409';end if;
 body:=r.data;d:=(body->>'date')::date;perform fmz_accounting.open_date(oid,d);
 credit:=nullif(body->>'credit_of','') is not null;
 if credit then
  select * into original from fmz_accounting.records where org_id=oid and id=(body->>'credit_of')::uuid and kind='invoice' and status='posted' and parent_id is null;
  if original.data ? 'cancellation_id' then raise exception 'Geannuleerde factuur kan niet nogmaals worden gecrediteerd' using errcode='PT409';end if;
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
  if body ? 'settings_id' and body->>'settings_id' is distinct from s.id::text then raise exception 'Bedrijfs- of btw-instellingen gewijzigd. Ververs het concept en controleer het nieuwe voorbeeld.' using errcode='PT409';end if;
  if body ? 'lines' then
   rate:=case when s.data->>'vat_status' in ('kor','exempt') then 0 else (s.data->>'vat_basis_points')::bigint end;
   calculated:=fmz_accounting.invoice_totals(body,rate);
   body:=body||jsonb_build_object('gross_cents',calculated->'grossCents','discount_cents',calculated->'discountCents');
  end if;
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
 if calculated is not null then net:=(calculated->>'netCents')::bigint;vat:=(calculated->>'vatCents')::bigint;end if;
 select next_number into nextno from fmz_accounting.organizations where id=oid for update;
 no:='FMZ-'||extract(year from d)::integer::text||'-'||lpad(nextno::text,greatest(4,length(nextno::text)),'0');
 update fmz_accounting.organizations set next_number=next_number+1 where id=oid;
 doc:=jsonb_build_object('version',2,'invoiceNo',no,'description',body->>'description','discountNote',coalesce(body->>'discountNote',''),
 'date',d,'dueDate',d+term,'paymentTermDays',term,'settings',s.data,'settingsId',s.id,'customer',body->'customer','packageLabel',coalesce(body->>'packageLabel',''),
 'serviceDate',body->>'service_date','serviceExtent',body->>'service_extent','quantity',qty,'grossCents',gross*factor,'discountCents',discount*factor,
 'netCents',net*factor,'vatCents',vat*factor,'totalCents',total*factor,'vatBasisPoints',rate,'creditOf',original.number,
 'layoutVersion',3,'lines',calculated->'lines','priceMode',coalesce(body->>'price_mode','inclusive'),'subtotalCents',calculated->'subtotalCents','discountInputCents',calculated->'discountInputCents','discountMode',body->>'discount_mode','discountBasisPoints',body->'discount_bp','period',body->>'period','reference',body->>'reference','paidCents',0,'outstandingCents',total*factor,
 'vatStatus',s.data->>'vat_status','vatMethod',s.data->>'vat_method','logo',body->'logo');
 update fmz_accounting.records set status='posted',date=d,number=no,parent_id=original.id,version=version+1,data=body||jsonb_build_object('document',doc) where org_id=oid and id=rid returning * into r;
 perform fmz_accounting.post(oid,rid,d,no,jsonb_build_array(jsonb_build_array('1100',total*factor,coalesce(original.id,rid)),jsonb_build_array('4000',-net*factor,rid),jsonb_build_array('1800',-vat*factor,rid)));
 return to_jsonb(r);
end $$;
create or replace function fmz_accounting.bank(oid uuid,rid uuid,body jsonb,source text default null) returns jsonb language plpgsql set search_path='' as $$
declare account fmz_accounting.records; r fmz_accounting.records; amount bigint; d date;
begin
 select * into account from fmz_accounting.records where org_id=oid and id=(body->>'account_id')::uuid and kind='account';
 if account.id is null then raise exception 'Kies bank- of kasrekening';end if;
 d:=(body->>'date')::date;amount:=(body->>'cents')::bigint;if amount is null or amount=0 or abs(amount)>900000000000 then raise exception 'Ongeldige bankmutatie';end if;
 if account.data->>'opening_date' is not null and d<(account.data->>'opening_date')::date then raise exception 'Mutatie valt voor de ingevoerde beginstand';end if;
 if account.data->>'hidden'='true' then raise exception 'Rekening is verborgen. Schakel deze eerst weer in.';end if;
 if account.data->>'type'='cash' and fmz_accounting.balance(oid,account.data->>'code')+amount<0 and body->>'cash_negative_confirmed' is distinct from 'true' then raise exception 'Deze boeking geeft een negatief kassaldo. Controleer contant geld en bevestig de waarschuwing.';end if;
 r:=fmz_accounting.add_record(oid,rid,'bank',d,body||jsonb_build_object('account_code',account.data->>'code'),'posted',null,source);
 perform fmz_accounting.post(oid,rid,d,coalesce(body->>'description','Bankmutatie'),jsonb_build_array(jsonb_build_array(account.data->>'code',amount,rid),jsonb_build_array('1400',-amount,rid)));
 return to_jsonb(r);
end $$;
create or replace function fmz_accounting.command(action text,payload jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare oid uuid; rid uuid; r fmz_accounting.records; other fmz_accounting.records; f fmz_accounting.files;
 before_value jsonb; result jsonb; receipt fmz_accounting.receipts; hash text; body jsonb; item jsonb; items jsonb;
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
   if exists(select 1 from fmz_accounting.audit where org_id=oid and audit.action='draft_delete' and detail->>'record_id'=rid::text) then raise exception 'Concept is verwijderd' using errcode='PT409';end if;
   if coalesce((payload->>'version')::bigint,0)<>0 then raise exception 'Concept ontbreekt' using errcode='PT409';end if;
   r:=fmz_accounting.add_record(oid,rid,'invoice',d,body-'document','draft');
  else
   if r.kind<>'invoice' or r.status<>'draft' then raise exception 'Definitieve factuur is onveranderlijk. Maak een creditfactuur.' using errcode='PT409';end if;
   if r.version is distinct from (payload->>'version')::bigint then raise exception 'Concept elders gewijzigd. Ververs en vergelijk je invoer.' using errcode='PT409';end if;
   update fmz_accounting.records set data=body-'document',date=d,version=version+1 where org_id=oid and id=rid returning * into r;
  end if;
  result:=to_jsonb(r);
  elsif action='draft_delete' then
  if r.id is null or r.kind<>'invoice' or r.status<>'draft' or r.version is distinct from (payload->>'version')::bigint then raise exception 'Concept ontbreekt of is gewijzigd. Ververs eerst.' using errcode='PT409';end if;
  if body->>'confirmed' is distinct from 'true' then raise exception 'Bevestig concept verwijderen';end if;
  if exists(select 1 from fmz_accounting.journals where org_id=oid and record_id=rid) or exists(select 1 from fmz_accounting.files where org_id=oid and record_id=rid) or exists(select 1 from fmz_accounting.records where org_id=oid and parent_id=rid) then raise exception 'Concept heeft definitieve koppelingen en kan niet worden verwijderd';end if;
  delete from fmz_accounting.records where org_id=oid and id=rid;
  result:=jsonb_build_object('id',rid,'deleted',true);
 elsif action='invoice_sent' then
  if r.id is null or r.kind<>'invoice' or r.status<>'posted' then raise exception 'Definitieve factuur ontbreekt';end if;
  if not r.data ? 'shared_at' then update fmz_accounting.records set data=data||jsonb_build_object('shared_at',now()),version=version+1 where org_id=oid and id=rid returning * into r;end if;
  result:=to_jsonb(r);
 elsif action='invoice_cancel' then
  if r.id is null or r.kind<>'invoice' or r.status<>'posted' or r.parent_id is not null then raise exception 'Oorspronkelijke definitieve factuur ontbreekt';end if;
  if r.data ? 'cancellation_id' then raise exception 'Factuur is al geannuleerd' using errcode='PT409';end if;
  if r.version is distinct from (payload->>'version')::bigint then raise exception 'Factuur gewijzigd. Ververs en controleer opnieuw.' using errcode='PT409';end if;
  if body->>'unpaid_unsent_confirmed' is distinct from 'true' or length(trim(coalesce(body->>'reason','')))<5 then raise exception 'Bevestig onbetaald en niet verzonden, met een reden';end if;
  if r.data ? 'shared_at' or exists(select 1 from fmz_accounting.records x where x.org_id=oid and ((x.kind='invoice' and x.parent_id=rid) or (x.kind='allocation' and exists(select 1 from jsonb_array_elements(x.data->'parts') p where p->>'target_id'=rid::text)))) or fmz_accounting.balance(oid,'1100',rid)<>(r.data#>>'{document,totalCents}')::bigint then raise exception 'Factuur is verzonden, betaald of verwerkt. Maak een creditfactuur.' using errcode='PT409';end if;
  perform fmz_accounting.open_date(oid,r.date);
  other:=fmz_accounting.add_record(oid,gen_random_uuid(),'correction',r.date,jsonb_build_object('invoice_cancellation',true,'reason',body->>'reason'),'posted',rid);
  select jsonb_agg(jsonb_build_array(l.account_code,-l.cents,l.reference_id) order by l.line_no) into items from fmz_accounting.lines l join fmz_accounting.journals j on j.org_id=l.org_id and j.id=l.journal_id where l.org_id=oid and j.record_id=rid;
  perform fmz_accounting.post(oid,other.id,r.date,'Annulering '||r.number,items);
  update fmz_accounting.records set data=data||jsonb_build_object('cancellation_id',other.id,'cancellation_date',r.date,'cancellation_reason',body->>'reason'),version=version+1 where org_id=oid and id=rid returning * into r;
  result:=to_jsonb(r);
 elsif action='account_visibility' then
  if r.id is null or r.kind<>'account' or r.version is distinct from (payload->>'version')::bigint then raise exception 'Rekening is gewijzigd' using errcode='PT409';end if;
  if body->>'hidden' not in ('true','false') or body->>'hidden' is null then raise exception 'Kies tonen of verbergen';end if;
  update fmz_accounting.records set data=data||jsonb_build_object('hidden',(body->>'hidden')::boolean),version=version+1 where org_id=oid and id=rid returning * into r;result:=to_jsonb(r);
 elsif action='import_undo' then
  if r.id is null or r.kind<>'import' or r.status<>'posted' or r.version is distinct from (payload->>'version')::bigint then raise exception 'Import ontbreekt, is gewijzigd of is al teruggedraaid' using errcode='PT409';end if;
  if length(trim(coalesce(body->>'reason','')))<5 then raise exception 'Reden voor terugdraaien vereist';end if;
  for other in select * from fmz_accounting.records where org_id=oid and kind='bank' and data->>'import_id'=rid::text loop
   perform fmz_accounting.open_date(oid,other.date);
   if fmz_accounting.balance(oid,'1400',other.id)<> -(other.data->>'cents')::bigint or exists(select 1 from fmz_accounting.records x where x.org_id=oid and (x.data->>'bank_id'=other.id::text or x.data->>'from_id'=other.id::text or x.data->>'to_id'=other.id::text or (x.kind='reconciliation' and x.parent_id=(other.data->>'account_id')::uuid and x.date>=other.date))) then raise exception 'Import is gekoppeld of afgestemd en kan niet worden teruggedraaid' using errcode='PT409';end if;
   select jsonb_agg(jsonb_build_array(l.account_code,-l.cents,l.reference_id) order by l.line_no) into items from fmz_accounting.lines l join fmz_accounting.journals j on j.org_id=l.org_id and j.id=l.journal_id where l.org_id=oid and j.record_id=other.id;
   item:=to_jsonb(fmz_accounting.add_record(oid,gen_random_uuid(),'correction',other.date,jsonb_build_object('import_reversal',true,'reason',body->>'reason'),'posted',other.id));
   perform fmz_accounting.post(oid,(item->>'id')::uuid,other.date,'Import teruggedraaid',items);
   update fmz_accounting.records set status='reversed',version=version+1,data=data||jsonb_build_object('original_source_key',source_key),source_key=source_key||':reversed:'||id::text where org_id=oid and id=other.id;
  end loop;
  update fmz_accounting.records set status='reversed',version=version+1,data=data||jsonb_build_object('undo_reason',body->>'reason','undone_at',now()) where org_id=oid and id=rid returning * into r;result:=to_jsonb(r);

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
  if body ? 'opening_cents' or body ? 'opening_date' then
   amount:=(body->>'opening_cents')::bigint;d:=nullif(body->>'opening_date','')::date;
   if amount is null or d is null then raise exception 'Vul zowel begindatum als openingssaldo in, of laat beide leeg';end if;
   other:=fmz_accounting.add_record(oid,gen_random_uuid(),'opening',d,jsonb_build_object('account_id',rid,'date',d,'cents',amount),'posted',rid);
   perform fmz_accounting.post(oid,other.id,d,'Beginstand '||(body->>'name'),jsonb_build_array(jsonb_build_array(code,amount,rid),jsonb_build_array('2000',-amount,rid)));
   update fmz_accounting.records set data=data||jsonb_build_object('opening_cents',amount,'opening_date',d),version=version+1 where org_id=oid and id=rid returning * into r;result:=to_jsonb(r);
  end if;
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
  if exists(select 1 from jsonb_array_elements(body->'rows') v where v->>'account_id' is distinct from body->>'account_id') then raise exception 'Importregels horen bij een andere rekening';end if;
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
 insert into fmz_accounting.audit(org_id,actor_id,action,request_id,detail) values(oid,auth.uid(),action,command.request_id,case when action='draft_delete' then jsonb_build_object('record_id',rid,'version',payload->'version','deleted',true) else jsonb_build_object('before',before_value,'after',result) end);
 insert into fmz_accounting.receipts values(oid,command.request_id,hash,result,now());
 return result;
end $$;
revoke all on function fmz_accounting.invoice_totals(jsonb,bigint) from public,anon,authenticated;
commit;

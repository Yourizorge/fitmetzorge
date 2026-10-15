-- Execute as an administrator in one transaction. No real account is used.
-- This is native PostgreSQL/RPC testing, NOT a password-login or HTTP Auth test.
begin;
do $proof$
declare u uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();oid uuid;bank jsonb;i1 jsonb;i2 jsonb;draft jsonb;b jsonb;p jsonb;plan jsonb;req uuid;first_result jsonb;account_id uuid;rec uuid;inv_before jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(u,'bank-repair-'||u::text||'@example.invalid',now(),jsonb_build_object('fmz_release','bank-repair-rollback-only'));
 insert into public.profiles(id,role,name,email) values(u,'trainer','Synthetic bank repair proof','bank-repair-'||u::text||'@example.invalid');
 insert into auth.sessions(id,user_id,created_at,updated_at) values(sid,u,now(),now());
 oid:=fmz_accounting.provision(u,'Synthetic rollback proof','bank-repair-rollback-only');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'session_id',sid)::text,true);
 perform public.fmz_accounting_command('settings',jsonb_build_object('data',jsonb_build_object('date','2026-01-01','confirmed',true,'businessName','Synthetic proof','address','Example 1','postalCity','1000 AA Example','country','Nederland','kvk_registered',false,'vatNumber','NL000000000B00','vat_status','standard','vat_method','invoice','vat_period','quarter','vat_basis_points',2100)),gen_random_uuid());
 bank:=public.fmz_accounting_command('account',jsonb_build_object('data',jsonb_build_object('name','Synthetic bank','type','bank','iban','SYNTHETIC')),gen_random_uuid());account_id:=(bank->>'id')::uuid;
 perform public.fmz_accounting_command('opening',jsonb_build_object('data',jsonb_build_object('account_id',account_id,'date','2026-01-01','cents',0)),gen_random_uuid());
 for rec in select gen_random_uuid() from generate_series(1,2) loop
  draft:=public.fmz_accounting_command('draft',jsonb_build_object('id',rec,'version',0,'data',jsonb_build_object('date','2026-09-01','description','Synthetic PT','gross_cents',case when i1 is null then 19000 else 20000 end,'discount_cents',0,'customer',jsonb_build_object('name','Example client','address','Example 1','postalCity','1000 AA Example','country','Nederland'),'service_date','2026-09-01','service_extent','Synthetic sessions','quantity',1,'term_days',14)),gen_random_uuid());
  b:=public.fmz_accounting_command('final_invoice',jsonb_build_object('id',rec,'version',(draft->>'version')::bigint),gen_random_uuid());if i1 is null then i1:=b;else i2:=b;end if;
 end loop;
 select jsonb_agg(to_jsonb(r) order by id) into inv_before from fmz_accounting.records r where org_id=oid and kind='invoice';
 b:=public.fmz_accounting_command('bank',jsonb_build_object('data',jsonb_build_object('account_id',account_id,'date','2026-09-15','cents',39000,'description','Synthetic combined receipt')),gen_random_uuid());
 perform public.fmz_accounting_command('allocate',jsonb_build_object('data',jsonb_build_object('bank_id',b->>'id','date','2026-09-15','parts',jsonb_build_array(jsonb_build_object('type','invoice','target_id',i1->>'id','cents',19000)))),gen_random_uuid());
 perform public.fmz_accounting_command('allocate',jsonb_build_object('data',jsonb_build_object('bank_id',b->>'id','date','2026-09-15','parts',jsonb_build_array(jsonb_build_object('type','invoice','target_id',i2->>'id','cents',20000)))),gen_random_uuid());
 p:=jsonb_build_object('record_id',b->>'id','reason','Synthetic false receipt checked against example');plan:=public.fmz_bank_repair_preview('reverse_bank',p);
 if jsonb_array_length(plan->'invoices')<>2 or (plan->>'delta_cents')::bigint<>-39000 then raise exception 'Unexpected preview';end if;
 p:=jsonb_build_object('id',gen_random_uuid(),'data',p,'expected',plan,'confirmed',true);req:=gen_random_uuid();first_result:=public.fmz_bank_repair_command('reverse_bank',p,req);
 if public.fmz_bank_repair_command('reverse_bank',p,req)<>first_result then raise exception 'Idempotency failed';end if;
 if fmz_accounting.balance(oid,'1100',(i1->>'id')::uuid)<>19000 or fmz_accounting.balance(oid,'1100',(i2->>'id')::uuid)<>20000 then raise exception 'Invoice balances incorrect';end if;
 if (select jsonb_agg(to_jsonb(r) order by id) from fmz_accounting.records r where org_id=oid and kind='invoice') is distinct from inv_before then raise exception 'Invoice modified';end if;
 if fmz_accounting.balance(oid,bank#>>'{data,code}')<>0 then raise exception 'Bank not reversed';end if;
 p:=jsonb_build_object('record_id',account_id,'reason','Synthetic opening corrected against example','new_cents',20,'new_date','2026-01-01');plan:=public.fmz_bank_repair_preview('replace_opening',p);
 perform public.fmz_bank_repair_command('replace_opening',jsonb_build_object('id',gen_random_uuid(),'data',p,'expected',plan,'confirmed',true),gen_random_uuid());
 if fmz_accounting.balance(oid,bank#>>'{data,code}')<>20 then raise exception 'Opening not corrected';end if;
 if has_function_privilege('anon','public.fmz_bank_repair_command(text,jsonb,uuid)','EXECUTE') or has_function_privilege('authenticated','fmz_accounting.bank_repair_plan(uuid,text,jsonb)','EXECUTE') then raise exception 'Unexpected public helper privilege';end if;
 perform set_config('fmz.bank_repair_proof',jsonb_build_object('native_postgres',version(),'synthetic_only',true,'rollback_only',true,'combined_receipt_two_invoices',true,'preview',true,'explicit_confirm',true,'idempotent',true,'invoices_unchanged',true,'opening_replacement',true,'bank_cents',20,'anon_and_helper_denied',true)::text,true);
end $proof$;
select current_setting('fmz.bank_repair_proof')::jsonb as proof;
rollback;

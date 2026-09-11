const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {setup}=require('./database.cjs');
test('owner ledger: invoice, VAT, payments, bank, private, audit, conflicts and archive protection',async()=>{
 const {db,as,ids}=await setup();
 try{
 await db.exec(`alter table auth.users add column raw_user_meta_data jsonb default '{}';create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260910145050_appfmz_owner_accounting.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260910171432_appfmz_accounting_closed_bank_period.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260911084106_appfmz_owner_hotfix.sql'),'utf8'));
 const oid=(await db.query('select fmz_accounting.provision($1,$2) id',[ids.trainer,'Synthetic owner'])).rows[0].id;
 const cmd=async(action,payload={},req=randomUUID())=>(await as('trainer','select public.fmz_accounting_command($1,$2,$3) result',[action,JSON.stringify(payload),req])).rows[0].result;
 const snapshot=async()=>(await as('trainer','select public.fmz_accounting_read() result')).rows[0].result;
 const bal=async(code,ref=null)=>(await db.query('select fmz_accounting.balance($1,$2,$3) amount',[oid,code,ref])).rows[0].amount;
 await assert.rejects(as('a','select public.fmz_accounting_read()'),/owner|Owner/);
 await db.query("insert into public.profiles(id,role,name,email) values($1,'trainer','Other trainer','other@example.test')",[ids.new]);
 await assert.rejects(as('new','select public.fmz_accounting_read()'),/Owner/);
 await assert.rejects(as('trainer','select * from fmz_accounting.records'),/permission denied/);
 await assert.rejects(as('new','select fmz_accounting.provision($1,$2)',[ids.new,'Attempt']),/permission denied/);
 await cmd('settings',{data:{date:'2026-09-01',confirmed:true,businessName:'Synthetic FitMetZorge',address:'Teststraat 1',postalCity:'1000 AA Teststad',kvk_registered:true,chamberNumber:'00000000',vatNumber:'NL000000000B00',vat_status:'standard',vat_method:'invoice',vat_period:'quarter',vat_basis_points:2100}});
 const invoice=async(gross,discount=0,extra={})=>{
  const id=randomUUID();const payload={id,version:0,data:{date:'2026-09-10',description:'PT maandpakket',gross_cents:gross,discount_cents:discount,discountNote:discount?'Testkorting':'',customer:{name:'Test lid',address:'Testweg 2, Teststad'},service_date:'2026-09-10',service_extent:'Maandpakket 8 trainingen',quantity:8,term_days:14,logo:'test',...extra}};
  const draft=await cmd('draft',payload);assert.equal(draft.number,null);
  return cmd('final_invoice',{id,version:draft.version});
 };
 const inv=await invoice(38000,3000);assert.equal(inv.data.document.totalCents,35000);assert.equal(inv.data.document.vatCents,6074);assert.equal(await bal('1100',inv.id),35000);
 const basis=await invoice(20000),trans=await invoice(48000);assert.equal(basis.data.document.totalCents,20000);assert.equal(trans.data.document.totalCents,48000);
 await assert.rejects(cmd('draft',{id:inv.id,version:inv.version,data:{date:'2026-09-10',description:'Overwrite'}}),/onveranderlijk/);
 const bank=await cmd('account',{data:{name:'ING test',type:'bank',iban:'TEST-IBAN'}});assert.equal(bank.data.opening_cents,null);
 await assert.rejects(cmd('reconcile',{data:{account_id:bank.id,date:'2026-09-10',closing_cents:0}}),/beginstand/);
 await cmd('opening',{data:{account_id:bank.id,date:'2026-09-01',cents:0}});
 const payment=async(amount,target,type='invoice')=>{const b=await cmd('bank',{data:{account_id:bank.id,date:'2026-09-10',cents:amount,description:'Synthetic bank'}});await cmd('allocate',{data:{bank_id:b.id,date:b.date,parts:[{type,target_id:target,cents:Math.abs(amount)}]}});return b;};
 await payment(10000,inv.id);assert.equal(await bal('1100',inv.id),25000);
 await payment(25000,inv.id);assert.equal(await bal('1100',inv.id),0);assert.equal(await bal('4000'),-85124); // 28926 + 16529 + 39669
 const request=randomUUID(),payload={id:randomUUID(),data:{account_id:bank.id,date:'2026-09-10',cents:20,direction:'deposit',description:'Privéstorting twintig cent'}};
 const first=await cmd('private',payload,request),again=await cmd('private',payload,request);assert.deepEqual(first,again);assert.equal(await bal('2010'),-20);
 await assert.rejects(cmd('private',{...payload,data:{...payload.data,cents:21}},request),e=>e.code==='PT409');
 await assert.rejects(cmd('private',{data:{...payload.data,cents:0.2}}),/gehele/);
 await cmd('reconcile',{data:{account_id:bank.id,date:'2026-09-10',closing_cents:35020}});
 const file=await cmd('file_reserve',{id:randomUUID(),data:{original_name:'bewijs.pdf',mime:'application/pdf',bytes:10,sha256:'a'.repeat(64),kind:'evidence'}});
 await as('trainer','insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['fmz-finance',file.path,JSON.stringify({size:10})]);
 await cmd('file_finish',{id:file.id});
 assert.equal((await as('a','select * from storage.objects')).rows.length,0);assert.equal((await as('new','select * from storage.objects')).rows.length,0);
 assert.equal((await as('trainer','update storage.objects set name=$1 returning *',['overwrite'])).rows.length,0);
 await assert.rejects(as('a','insert into storage.objects(bucket_id,name) values($1,$2)',['fmz-finance',file.path]),/row-level security/);
 const expense=await cmd('expense',{data:{date:'2026-09-10',supplier:'Test winkel',description:'Materiaal',category:'5040',gross_cents:12100,business_bp:10000,deductible_bp:10000,vat_treatment:'21',vat_cents:2100,paid_privately:true,file_id:file.id}});
 assert.equal(await bal('5040'),10000);assert.equal(await bal('1200'),2100);assert.equal(await bal('1900',expense.id),-12100);
 await payment(-12100,expense.id,'expense');assert.equal(await bal('1900',expense.id),0);assert.equal(await bal('5040'),10000);
 const fee=await cmd('expense',{data:{date:'2026-09-10',supplier:'Bank',description:'Afzonderlijke bankkosten',category:'5010',gross_cents:20,business_bp:10000,deductible_bp:0,vat_treatment:'exempt',paid_privately:false}});await payment(-20,fee.id,'expense');assert.equal(await bal('5010'),20);
 const credit=await invoice(5000,0,{credit_of:inv.id,description:'Deelcredit na controle'});assert.equal(credit.parent_id,inv.id);assert.equal(credit.data.document.totalCents,-5000);assert.equal(await bal('1100',inv.id),-5000);await payment(-5000,inv.id);assert.equal(await bal('1100',inv.id),0);
 const draftID=randomUUID(),draft=await cmd('draft',{id:draftID,version:0,data:{date:'2026-09-10',description:'Eerste'}});await cmd('draft',{id:draftID,version:draft.version,data:{date:'2026-09-10',description:'Tweede'}});
 const before=await snapshot();await assert.rejects(cmd('draft',{id:draftID,version:draft.version,data:{date:'2026-09-10',description:'Conflict'}}),e=>e.code==='PT409');assert.deepEqual(await snapshot(),before);
 const period=await cmd('close_period',{data:{from:'2026-09-01',to:'2026-09-30',reason:'Synthetische afsluitcontrole'}});
 await assert.rejects(cmd('private',{data:{...payload.data,cents:20}}),e=>e.code==='PT409');await cmd('reopen_period',{id:period.id,data:{reason:'Heropenen voor gerichte test'}});
 await cmd('retention',{id:file.id,data:{class:'onroerend',active_until:'2028-12-31',reason:'Einde actualiteitswaarde synthetisch document'}});
 const snap=await snapshot();assert.equal(snap.files[0].keep_until,'2038-12-31');assert.ok(snap.audit.length>20);
 // Partial allocation failure must roll back earlier parts and its receipt/audit.
 const splitBank=await cmd('bank',{data:{account_id:bank.id,date:'2026-09-10',cents:100,description:'Split rollback'}}),beforeSplit=await snapshot();
 await assert.rejects(cmd('allocate',{data:{bank_id:splitBank.id,date:'2026-09-10',parts:[{type:'deposit',cents:50},{type:'invoice',target_id:inv.id,cents:50}]}}),e=>e.code==='PT409');assert.deepEqual(await snapshot(),beforeSplit);
 await cmd('allocate',{data:{bank_id:splitBank.id,date:'2026-09-10',parts:[{type:'deposit',cents:50},{type:'invoice',target_id:basis.id,cents:50}]}});
 // Server de-duplication across different import request IDs.
 const source='synthetic-canonical-bank-reference',row={id:randomUUID(),source_key:source,account_id:bank.id,date:'2026-09-10',cents:20,description:'Import'};
 const imported=await cmd('import',{data:{date:'2026-09-10',account_id:bank.id,file_id:file.id,rows:[row]}});assert.equal(imported.data.imported_ids.length,1);
 const repeated=await cmd('import',{data:{date:'2026-09-10',account_id:bank.id,file_id:file.id,rows:[{...row,id:randomUUID()}]}});assert.equal(repeated.data.skipped,1);assert.equal(repeated.data.imported_ids.length,0);
 // Paid expense reversal creates a supplier refund; repayment never doubles costs.
 await cmd('expense_correction',{data:{date:'2026-09-10',expense_id:expense.id,description:'Goederen retour aan leverancier'}});assert.equal(await bal('5040'),0);assert.equal(await bal('1900',expense.id),12100);await payment(12100,expense.id,'expense');assert.equal(await bal('1900',expense.id),0);
 const partial=await cmd('expense',{data:{date:'2026-09-10',supplier:'Partial',description:'Half zakelijk',category:'5000',gross_cents:12100,business_bp:5000,deductible_bp:5000,vat_treatment:'21',vat_cents:2100,file_id:file.id}});assert.equal(partial.data.input_vat_cents,525);assert.equal(partial.data.cost_cents,5525);assert.equal(partial.data.payable_cents,12100);
 const unknown=await cmd('expense',{data:{date:'2026-09-10',supplier:'Unknown',description:'Onbekende bon',gross_cents:10000,business_bp:10000,deductible_bp:10000,vat_treatment:'unknown'}});assert.equal(unknown.data.input_vat_cents,0);assert(unknown.data.flags.includes('Bewijs ontbreekt'));
 const reverse=await cmd('expense',{data:{date:'2026-09-10',supplier:'Reverse',description:'Verlegd',gross_cents:10000,business_bp:10000,deductible_bp:10000,vat_treatment:'reverse',vat_cents:2100,charge_vat_cents:2100,reverse_confirmed:true,file_id:file.id}});assert.equal(reverse.data.input_vat_cents,2100);assert.equal(reverse.data.charge_vat_cents,2100);assert.equal(reverse.data.cost_cents,10000);
 const asset=await cmd('asset',{data:{date:'2026-09-10',description:'Bestaande apparatuur',cents:10000,residual_cents:1000,opening_confirmed:true}});await cmd('depreciation',{data:{date:'2026-09-10',asset_id:asset.id,cents:1000,description:'Gecontroleerde afschrijving'}});assert.equal(await bal('1300',asset.id)+await bal('1390',asset.id),9000);await assert.rejects(cmd('depreciation',{data:{date:'2026-09-10',asset_id:asset.id,cents:8001,description:'Boven restwaarde'}}),/Controleer/);
 const loan=await cmd('loan',{data:{date:'2026-09-10',description:'Bestaande lening',cents:50000,opening_confirmed:true}});assert.equal(await bal('1700',loan.id),-50000);
 const cash=await cmd('account',{data:{name:'Kas',type:'cash'}});await cmd('opening',{data:{account_id:cash.id,date:'2026-09-01',cents:0}});
 const out=await cmd('bank',{data:{account_id:bank.id,date:'2026-09-10',cents:-1000,description:'Naar kas'}}),incoming=await cmd('bank',{data:{account_id:cash.id,date:'2026-09-10',cents:1000,description:'Van bank'}}),revBefore=await bal('4000');await cmd('transfer',{data:{date:'2026-09-10',from_id:out.id,to_id:incoming.id,cents:1000}});assert.equal(await bal('1400',out.id),0);assert.equal(await bal('1400',incoming.id),0);assert.equal(await bal('4000'),revBefore);
 await cmd('settings',{data:{date:'2026-09-10',confirmed:true,businessName:'Synthetic KOR',address:'Teststraat 1',postalCity:'1000 AA Teststad',kvk_registered:false,vat_status:'kor',vat_method:'cash',vat_period:'none',vat_basis_points:0}});
 const kor=await invoice(20000);assert.equal(kor.data.document.vatCents,0);assert.equal(kor.data.document.vatStatus,'kor');assert.equal((await snapshot()).records.find(r=>r.id===inv.id).data.document.vatCents,6074);
 const korCost=await cmd('expense',{data:{date:'2026-09-10',supplier:'KOR cost',description:'Geen vooraftrek',gross_cents:12100,business_bp:10000,deductible_bp:10000,vat_treatment:'21',vat_cents:2100,file_id:file.id}});assert.equal(korCost.data.input_vat_cents,0);
 await db.query('update fmz_accounting.organizations set next_number=10000 where id=$1',[oid]);assert.equal((await invoice(100)).number,'FMZ-2026-10000');
 for(const j of snap.journals)assert.equal(snap.lines.filter(l=>l.journal_id===j.id).reduce((n,l)=>n+l.cents,0),0);
 const unassigned=await cmd('bank',{data:{account_id:bank.id,date:'2026-09-10',cents:20,description:'Afgesloten periode'}});
 await cmd('close_period',{data:{from:'2026-09-01',to:'2026-09-30',reason:'Definitieve synthetische periode'}});
 const closedSnapshot=await snapshot();await assert.rejects(cmd('allocate',{data:{bank_id:unassigned.id,date:'2026-10-01',parts:[{type:'deposit',cents:20}]}}),e=>e.code==='PT409');assert.deepEqual(await snapshot(),closedSnapshot);
 await assert.rejects(db.query('delete from auth.users where id=$1',[ids.trainer]),/foreign key/);
 }finally{await db.close();}
});

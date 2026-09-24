const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const B=require('../billing-periods.js'),{setup}=require('./database.cjs'),{extend}=require('./accounting-database.cjs');
const migration=()=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',fs.readdirSync(path.join(__dirname,'../supabase/migrations')).find(f=>f.endsWith('_appfmz_billing_periods.sql'))),'utf8');
test('calendar months, leap days and exact consecutive 28-day cycles',()=>{
 for(const [month,end]of [['2026-02','28'],['2028-02','29'],['2026-04','30'],['2026-12','31']]){const p=B.period({cycle:'calendar_month',effective_from:'2026-01-01'},month+'-14');assert.equal(p.start,month+'-01');assert.equal(p.end,month+'-'+end);}
 const v={cycle:'four_weeks',effective_from:'2026-09-28',package_label:'Personal training Basis'};let at=v.effective_from;
 for(let n=0;n<28;n++){const p=B.period(v,at);assert.equal((B.date(p.end)-B.date(p.start))/86400000,27);assert.equal(p.start,at);at=p.nextStart;}
 assert.deepEqual(B.period(v,'2026-10-25'),{start:'2026-09-28',end:'2026-10-25',invoiceDate:'2026-10-25',nextStart:'2026-10-26'});
 assert.equal(B.period(v,'2026-10-26').start,'2026-10-26');assert.match(B.text(v,B.period(v,v.effective_from)),/28-09-2026 t\/m 25-10-2026 - per 4 weken/);
 assert.equal(B.catalog.find(p=>p.id==='online-coaching').cents,20000);assert.equal(B.catalog.find(p=>p.id==='single-session').recurring,false);assert.equal(B.catalog.find(p=>p.id==='ten-sessions').cents,52000);
 assert.throws(()=>B.date('2026-02-29'));assert.throws(()=>B.period(v,'2026-09-27'));
});
test('agreement migration preserves records; owner-only immutable versions and unique invoice periods',{timeout:120000},async()=>{
 const x=await setup(),{db,as,ids}=x;try{const oid=await extend(x);
 if(!(await db.query("select to_regclass('fmz_accounting.agreement_versions') t")).rows[0].t)await db.exec(migration());
 const rpc=(action,payload,request=randomUUID(),who='trainer')=>as(who,'select public.fmz_billing_command($1,$2,$3) r',[action,JSON.stringify(payload),request]).then(r=>r.rows[0].r),cmd=(action,payload,request=randomUUID())=>as('trainer','select public.fmz_accounting_command($1,$2,$3) r',[action,JSON.stringify(payload),request]).then(r=>r.rows[0].r);
 const now=(await db.query('select current_date::text d')).rows[0].d,start=B.add(now,8),month=start.slice(0,7)+'-01',nextMonth=(()=>{let d=B.date(month);d.setUTCMonth(d.getUTCMonth()+1);return d.toISOString().slice(0,10)})();
 await cmd('settings',{data:{date:'2020-01-01',confirmed:true,businessName:'Synthetic billing',address:'Teststraat 1',postalCity:'1000 AA Test',chamberNumber:'00000000',vatNumber:'NLTEST',vat_status:'standard',vat_method:'invoice',vat_period:'quarter',vat_basis_points:2100}});
 const before=(await as('trainer','select public.fmz_accounting_read() r')).rows[0].r;
 const base={client_id:'a',expected_version:0,effective_from:start,cycle:'four_weeks',package_id:'pt-progressie',enabled:true,confirmed:true,reason:'Synthetic agreement'};
 const request=randomUUID(),v=await rpc('save_agreement',base,request);assert.deepEqual(await rpc('save_agreement',base,request),v);assert.equal(v.amount_cents,38000);
 await assert.rejects(rpc('save_agreement',{...base,client_id:'foreign'}),e=>e.code==='42501');for(const who of ['a','b'])await assert.rejects(rpc('save_agreement',base,randomUUID(),who),e=>e.code==='42501');
 await assert.rejects(as('a','select * from fmz_accounting.agreement_versions'),e=>e.code==='42501');
 await assert.rejects(rpc('save_agreement',{...base,expected_version:1,effective_from:B.add(start,3)}),e=>e.code==='PT409');
 const m=await rpc('save_agreement',{...base,client_id:'b',cycle:'calendar_month',effective_from:nextMonth,package_id:'pt-basis'});assert.equal(m.cycle,'calendar_month');
 const first=await rpc('prepare_invoice',{client_id:'a',at_date:start});assert.equal(first.status,'draft');assert.equal(first.data.billing.end,B.add(start,27));
 const twice=await rpc('prepare_invoice',{client_id:'a',at_date:B.add(start,20)});assert.equal(twice.id,first.id);
 await assert.rejects(cmd('draft',{id:randomUUID(),version:0,data:first.data}),e=>e.code==='PT409');
 await assert.rejects(cmd('draft',{id:first.id,version:first.version,data:{...first.data,billing:{...first.data.billing,end:B.add(start,28)}}}),e=>e.code==='PT409');
 let edit=await cmd('draft',{id:first.id,version:first.version,data:{...first.data,customer:{name:'Synthetic',address:'Teststraat 2'},description:'Progressie per 4 weken',gross_cents:38000,discount_cents:3000}});
 const final=await cmd('final_invoice',{id:edit.id,version:edit.version});assert.equal(final.data.document.totalCents,35000);assert.equal(final.data.document.vatCents,6074);assert.deepEqual(final.data.document.billing,first.data.billing);
 assert.equal((await rpc('prepare_invoice',{client_id:'a',at_date:start})).id,final.id);
 const version2=await rpc('save_agreement',{...base,expected_version:1,effective_from:B.add(start,28),package_id:'pt-basis'});assert.equal(version2.previous_id,v.id);assert.equal(version2.version,2);
 await assert.rejects(rpc('save_agreement',{...base,expected_version:1,effective_from:B.add(start,56)}),e=>e.code==='PT409');
 const newer=await rpc('prepare_invoice',{client_id:'a',at_date:B.add(start,28)});assert.equal(newer.data.gross_cents,20000);assert.equal(newer.data.billing.agreementVersion,2);
 const legacy=await cmd('draft',{id:randomUUID(),version:0,data:{date:nextMonth,client_id:'b',description:'Bestaand synthetisch concept behouden',gross_cents:20000,discount_cents:2300,term_days:21,raw:{description:'Eigen invoer',unitPrice:'200',discount:'23'}}});
 await assert.rejects(rpc('prepare_invoice',{client_id:'b',at_date:nextMonth}),e=>e.code==='PT409');
 const monthly=await rpc('prepare_invoice',{client_id:'b',at_date:nextMonth,adopt_draft:legacy.id});assert.equal(monthly.id,legacy.id);assert.deepEqual(monthly.data.raw,legacy.data.raw);assert.equal(monthly.data.discount_cents,2300);assert.equal(monthly.data.billing.start,nextMonth);assert.equal(monthly.data.billing.end,B.period(m,nextMonth).end);
 assert.equal((await rpc('prepare_invoice',{client_id:'b',at_date:nextMonth})).id,legacy.id);
 const after=(await as('trainer','select public.fmz_accounting_read() r')).rows[0].r;for(const r of before.records)assert.deepEqual(after.records.find(a=>a.id===r.id),r);
 assert.deepEqual(after.records.find(r=>r.id===final.id).data.document,final.data.document);assert.equal(after.agreements.length,3);
 // Existing prices/rows are untouched by explicit legacy registration, including no-invoice clients.
 await db.query("update public.coach_workspaces set state=jsonb_set(state,'{clients,2,profile,package}','\"pt-basis\"') where trainer_id=$1",[ids.trainer]);
 const reg=(await db.query('select fmz_accounting.billing_register_legacy($1,$2,$3,$4) r',[oid,'new',false,now.slice(0,7)+'-01'])).rows[0].r;assert.equal(reg.enabled,false);assert.equal(reg.cycle,'calendar_month');assert.equal(reg.amount_cents,20000);await assert.rejects(rpc('prepare_invoice',{client_id:'new',at_date:now}),/geen factureerbare/);
 // Both cycles keep discounts, cancellation, partial/full credits and the original snapshot.
 for(const draft of [newer,monthly]){
  const edited=await cmd('draft',{id:draft.id,version:draft.version,data:{...draft.data,customer:{name:'Synthetic correction',address:'Teststraat 3'},discount_cents:1000,service_date:draft.data.billing.end,service_extent:'Synthetische trainingen',quantity:1}});
  const original=await cmd('final_invoice',{id:edited.id,version:edited.version});assert.equal(original.data.document.totalCents,19000);
  const creditDraft=await cmd('draft',{id:randomUUID(),version:0,data:{date:draft.date,credit_of:original.id,description:'Synthetische deelcredit',gross_cents:3000,discount_cents:0,term_days:14,quantity:1}});
  const credit=await cmd('final_invoice',{id:creditDraft.id,version:creditDraft.version});assert.equal(credit.data.document.totalCents,-3000);assert.deepEqual(credit.data.document.billing,original.data.document.billing);
  const rest=await cmd('draft',{id:randomUUID(),version:0,data:{...creditDraft.data,gross_cents:16000,description:'Synthetische restcredit'}});const full=await cmd('final_invoice',{id:rest.id,version:rest.version});assert.equal(full.data.document.vatCents+credit.data.document.vatCents,-original.data.document.vatCents);
  const next=await rpc('prepare_invoice',{client_id:draft.data.client_id,at_date:B.add(draft.data.billing.end,1)});const clean=await cmd('draft',{id:next.id,version:next.version,data:{...next.data,customer:{name:'Synthetic cancel',address:'Teststraat 4'}}});const cancelled=await cmd('final_invoice',{id:clean.id,version:clean.version});await cmd('invoice_cancel',{id:cancelled.id,version:cancelled.version,data:{reason:'Synthetische annulering',unpaid_unsent_confirmed:true}});
  const preserved=(await as('trainer','select public.fmz_accounting_read() r')).rows[0].r.records.find(r=>r.id===original.id).data.document;assert.deepEqual(preserved,original.data.document);
 }
 }finally{await db.close();}
});

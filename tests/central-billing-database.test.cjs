const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto'),{setup}=require('./database.cjs'),{extend}=require('./accounting-database.cjs');
test('central cycles: owner, exact snapshots, independent tasks, retry and legacy preservation',async()=>{
 const x=await setup(),{db,as,ids}=x;try{
 const oid=await extend(x);await db.exec(fs.readFileSync('supabase/migrations/20261104163836_appfmz_central_billing_opt_in.sql','utf8'));
 const read=()=>as('trainer',"select public.fmz_central_billing_read('2026-10-30','2029-01-26') r").then(r=>r.rows[0].r);
 const command=(action,payload,id=randomUUID())=>as('trainer','select public.fmz_central_billing_command($1,$2,$3) r',[action,payload,id]).then(r=>r.rows[0].r);
 a.equal((await read()).enabled,false);await a.rejects(as('a',"select public.fmz_central_billing_read('2026-10-30','2028-12-31')"),{code:'42501'});
 await a.rejects(as('trainer','select * from fmz_accounting.central_cycle_versions'),{code:'42501'});
 const before=(await db.query("select (select count(*) from fmz_accounting.records) records,(select count(*) from fmz_accounting.agreement_versions) agreements")).rows;
 const config=await command('configure',{expected_version:0,enabled:true,confirmed:true,base_date:'2026-10-30',credit_policy:'pro_rata_exact',invoice_policy:'arrears_only',reason:'Synthetic confirmed configuration'});
 const list=await read();a.equal(list.tasks.length,58);a.equal(list.tasks[0].date,'2026-11-20');a.equal(list.tasks[1].date,'2026-11-27');
 const t=list.tasks[0],request=randomUUID(),payload={config_id:config.id,config_version:config.version,period_index:t.periodIndex,kind:t.kind,expected_version:0};
 const completed=await command('complete',payload,request);a.deepEqual(await command('complete',payload,request),completed);await a.rejects(command('complete',payload),{code:'PT409'});
 a.equal((await read()).tasks.find(r=>r.id===list.tasks[1].id).status==='done',false);
 a.deepEqual((await db.query("select (select count(*) from fmz_accounting.records) records,(select count(*) from fmz_accounting.agreement_versions) agreements")).rows,before);
 const q=(await db.query("select fmz_accounting.central_quote($1,'2026-11-13',38000,8) q",[oid])).rows[0].q;a.equal(q.firstAmountCents,19000);a.equal(q.firstSessions,4);a.equal(q.creditsResolved,true);a.equal(q.firstInvoiceDate,'2026-11-27');
 a.equal((await db.query("select fmz_accounting.central_quote($1,'2026-11-14',38000,8) q",[oid])).rows[0].q.creditsResolved,false);
 const v=(await db.query("insert into fmz_accounting.agreement_versions(org_id,client_id,version,effective_from,cycle,package_id,package_label,amount_cents,sessions,enabled,origin,reason,created_by) values($1,'new',1,'2026-11-13','four_weeks','pt-progressie','Progressie',38000,8,true,'signed_enrollment','Synthetic',$2) returning id",[oid,ids.trainer])).rows[0].id;
 await as('trainer','select public.fmz_central_billing_read($1,$2)',['2026-11-01','2026-12-31']);await db.query('select fmz_accounting.attach_central_agreement($1,$2,$3)',[oid,v,q]);
 const proposal=(await as('trainer',"select public.fmz_billing_proposal('new') r")).rows[0].r;a.equal(proposal.billing.amountCents,19000);a.equal(proposal.billing.sessions,4);a.equal(proposal.period.start,'2026-11-13');
 const prepareid=randomUUID(),args=['prepare_invoice',{client_id:'new',at_date:'2026-11-13'},prepareid];
 const r=(await as('trainer','select public.fmz_billing_command($1,$2,$3) r',args)).rows[0].r;a.equal(r.data.gross_cents,19000);a.equal(r.status,'draft');a.deepEqual((await as('trainer','select public.fmz_billing_command($1,$2,$3) r',args)).rows[0].r,r);a.equal((await as('trainer',"select public.fmz_billing_proposal('new') r")).rows[0].r.record.id,r.id);
 const snap=(await as('trainer','select public.fmz_accounting_read() r')).rows[0].r;a.equal(snap.agreements.find(a=>a.id===v).central_snapshot.firstAmountCents,19000);
 const cmd=(action,payload)=>as('trainer','select public.fmz_accounting_command($1,$2,$3) r',[action,payload,randomUUID()]).then(x=>x.rows[0].r);
 await cmd('settings',{data:{date:'2020-01-01',confirmed:true,businessName:'Synthetic billing',address:'Teststraat 1',postalCity:'1000 AA Test',chamberNumber:'00000000',vatNumber:'NLTEST',vat_status:'standard',vat_method:'invoice',vat_period:'quarter',vat_basis_points:2100}});
 const edited=await cmd('draft',{id:r.id,version:r.version,data:{...r.data,customer:{name:'Synthetic',address:'Teststraat 2'}}});
 const final=await cmd('final_invoice',{id:edited.id,version:edited.version});a.equal(final.data.document.totalCents,19000);
 const next=(await as('trainer',"select public.fmz_billing_proposal('new') r")).rows[0].r;a.equal(next.period.start,'2026-11-27');a.equal(next.period.invoiceDate,'2026-12-25');a.equal(next.billing.amountCents,38000);
 a.equal((await as('trainer',"select public.fmz_billing_proposal('new','2026-11-13') r")).rows[0].r.record.id,final.id);
 const B=require('../billing-periods.js');a.deepEqual(B.period(snap.agreements.find(a=>a.id===v),'2026-11-14'),proposal.period);a.deepEqual(B.period(snap.agreements.find(a=>a.id===v),'2026-11-27'),next.period);
 const legacy=(await db.query("insert into fmz_accounting.agreement_versions(org_id,client_id,version,effective_from,cycle,package_id,package_label,amount_cents,sessions,enabled,origin,reason,created_by) values($1,'a',1,'2026-10-01','calendar_month','pt-progressie','Progressie',38000,8,true,'legacy_registration','Synthetic',$2) returning *",[oid,ids.trainer])).rows[0];
 const old=(await as('trainer',"select public.fmz_billing_proposal('a') r")).rows[0].r;a.equal(old.period.start,'2026-10-01');a.equal(old.period.end,'2026-10-31');a.equal(old.billing.amountCents,38000);a.equal('centralConfigId' in old.billing,false);
 await db.query('delete from auth.sessions where user_id=$1',[ids.trainer]);await a.rejects(read(),{code:'28000'});
 }finally{await db.close();}
});

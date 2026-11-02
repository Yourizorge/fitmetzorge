const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const P=require('../billing-planning-model.js'),B=require('../billing-periods.js'),{setup}=require('./database.cjs'),{extend}=require('./accounting-database.cjs');
test('planning civil dates, DST, filters and payment versus mail state',()=>{
 assert.equal(P.today(new Date('2026-03-28T23:30:00Z')),'2026-03-29');assert.equal(P.today(new Date('2026-10-25T23:30:00Z')),'2026-10-26');
 assert.equal(P.reminder({send_date:'2026-03-30'},'2026-03-23'),'prepare');assert.equal(P.reminder({send_date:'2026-10-25'},'2026-10-25'),'due');
 assert.equal(P.state({status:'active'}, {status:'posted',data:{document:{totalCents:35000}}},{outstanding:15000,paidCents:20000},{status:'sent'}),'partial');
 assert.equal(P.filter([{client_name:'Test  Persoon',cycle:'four_weeks'},{client_name:'Ander',cycle:'calendar_month'}],{query:'test persoon'}).length,1);
 assert.throws(()=>P.validateOverride({send_date:'2026-02-30',reason:'Geldige reden'}));assert.throws(()=>P.validateOverride({send_date:'2026-02-28',reason:'x'}));
 const lessons=require('../tutorial/planning-lessons.js');assert.equal(lessons.steps.length,15);assert.equal(new Set(lessons.steps.map(s=>s.id)).size,15);for(const step of lessons.steps){for(const key of ['what','why','action','result','check'])assert(step[key].length>20);assert(step.videoChapter===null||(Number.isInteger(step.videoChapter)&&step.videoChapter>=1&&step.videoChapter<=12));}assert.equal(lessons.videoStatus,'recorded-awaiting-media-verification');assert.equal(lessons.steps.find(s=>s.id.endsWith('eerste-periode')).videoChapter,null);
});
test('new duo agreement versions share active member catalogue while historical prices stay immutable',{timeout:120000},async()=>{
 const x=await setup();try{await extend(x);const {db,as}=x,now=(await db.query('select current_date::text d')).rows[0].d;
 const bill=(payload)=>as('trainer','select public.fmz_billing_command($1,$2,$3) r',['save_agreement',JSON.stringify(payload),randomUUID()]).then(r=>r.rows[0].r);
 const old=[];for(const [client,pack,cents] of [['a','duo-progressie',52000],['b','duo-transformatie',78000]]){const v=await bill({client_id:client,expected_version:0,effective_from:now,cycle:'four_weeks',package_id:pack,enabled:true,confirmed:true,reason:'Historische synthetische overeenkomst'});assert.equal(v.amount_cents,cents);old.push(v);}
 const before=(await db.query('select to_jsonb(v) j from fmz_accounting.agreement_versions v order by client_id')).rows;
 await db.exec('create role service_role');await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261026154916_appfmz_members.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261026154917_appfmz_billing_planning.sql'),'utf8'));
 for(const [i,cents]of [50000,66000].entries()){const prior=old[i],catalog=(await db.query('select fmz_accounting.billing_catalog($1) c',[prior.package_id])).rows[0].c;assert.equal(catalog.cents,cents);const next=await bill({client_id:prior.client_id,expected_version:1,effective_from:B.add(now,28),cycle:'four_weeks',package_id:prior.package_id,enabled:true,confirmed:true,reason:'Nieuwe versie met expliciet actuele catalogus'});assert.equal(next.amount_cents,cents);assert.equal(next.previous_id,prior.id);assert.equal(next.package_id,prior.package_id);assert.equal(next.version,2);}
 assert.deepEqual((await db.query('select to_jsonb(v) j from fmz_accounting.agreement_versions v where version=1 order by client_id')).rows,before);
 }finally{await x.db.close();}
});
test('server planning preserves monthly agreements, prepares one draft without numbering/ledger, scopes owner and recovers', {timeout:120000},async()=>{
 const x=await setup(),{db,as,ids}=x;try{
 const oid=await extend(x);await db.exec('create role service_role');await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261026154916_appfmz_members.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261026154917_appfmz_billing_planning.sql'),'utf8'));
 const bill=(a,p)=>as('trainer','select public.fmz_billing_command($1,$2,$3) r',[a,JSON.stringify(p),randomUUID()]).then(r=>r.rows[0].r),call=(a,p={},id=randomUUID(),who='trainer')=>as(who,'select public.fmz_billing_planning_command($1,$2,$3) r',[a,JSON.stringify(p),id]).then(r=>r.rows[0].r),read=()=>as('trainer','select public.fmz_billing_planning_read() r').then(r=>r.rows[0].r);
 const now=(await db.query("select (now() at time zone 'Europe/Amsterdam')::date::text d")).rows[0].d;
 await as('trainer','select public.fmz_accounting_command($1,$2,$3)', ['settings',JSON.stringify({data:{date:'2020-01-01',confirmed:true,businessName:'Synthetic planning',address:'Voorbeeldstraat 1',postalCity:'1000 AA Teststad',kvk_registered:false,vatNumber:'NLTEST',vat_status:'standard',vat_method:'invoice',vat_period:'quarter',vat_basis_points:2100}}),randomUUID()]);
 await db.query("update public.coach_workspaces set state=jsonb_set(state,'{clients,1,profile,package}','\"pt-basis\"') where trainer_id=$1",[ids.trainer]);
 await db.query('select fmz_accounting.billing_register_legacy($1,$2,true,$3)',[oid,'b',now.slice(0,7)+'-01']);
 const v=await bill('save_agreement',{client_id:'a',expected_version:0,effective_from:now,cycle:'four_weeks',package_id:'pt-progressie',enabled:true,confirmed:true});
 const before=(await db.query('select to_jsonb(v) j from fmz_accounting.agreement_versions v order by id')).rows;
 const no=(await db.query('select next_number from fmz_accounting.organizations where id=$1',[oid])).rows[0].next_number;
 const repeat=randomUUID(),r=await call('refresh',{},repeat);assert.deepEqual(await call('refresh',{},repeat),r);
 let snap=await read();assert(snap.tasks.some(t=>t.cycle==='calendar_month'));assert(snap.tasks.some(t=>t.cycle==='four_weeks'));
 const task=snap.tasks.find(t=>t.client_id==='a'),rid=await call('prepare',{id:task.id,version:task.version});assert.equal(rid.status,'draft');assert.equal(rid.number,null);assert.equal(rid.data.gross_cents,38000);
 await as('trainer','select public.fmz_accounting_command($1,$2,$3)', ['draft',JSON.stringify({id:rid.id,version:rid.version,data:{...rid.data,gross_cents:32000,discount_cents:3000,discount_input_cents:3000,discount_mode:'fixed',raw:{...rid.data.raw,discount:'30',unitPrice:'320'}}}),randomUUID()]);
 const editedCard=(await read()).tasks.find(t=>t.id===task.id);assert.equal(editedCard.amount_cents,32000);assert.equal(editedCard.discount_cents,3000);
 const proposal=await call('preview_recalculate',{id:task.id});assert.equal(proposal.totals.totalCents,35000);assert.equal(proposal.totals.vatCents,6074);
 await assert.rejects(call('recalculate',{id:task.id,version:proposal.version,token:'stale',reason:'Synthetische herberekening'}),e=>e.code==='PT409');
 const recalculated=await call('recalculate',{id:task.id,version:proposal.version,token:proposal.token,reason:'Pakketbedrag opnieuw gecontroleerd'});assert.equal(recalculated.data.gross_cents,38000);assert.equal(recalculated.data.discount_cents,3000);
 await db.query('select fmz_accounting.planning_tick($1,$2)',[B.add(now,25),oid]);
 assert.equal((await db.query('select count(*)::int n from fmz_accounting.records where id=$1',[rid.id])).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from fmz_accounting.journals')).rows[0].n,0);
 assert.equal((await db.query('select next_number from fmz_accounting.organizations where id=$1',[oid])).rows[0].next_number,no);
 assert.deepEqual((await db.query('select to_jsonb(v) j from fmz_accounting.agreement_versions v order by id')).rows,before);
 for(const who of ['a','b']){await assert.rejects(call('refresh',{},randomUUID(),who),e=>e.code==='42501');await assert.rejects(as(who,'select public.fmz_billing_planning_read()'),e=>e.code==='42501');await assert.rejects(as(who,'select * from fmz_accounting.billing_plan_tasks'),e=>e.code==='42501');await assert.rejects(as(who,'select fmz_accounting.planning_tick()'),e=>e.code==='42501');}
 await assert.rejects(call('rule',{client_id:'a',version:0,state:'active',send_mode:'automatic',reason:'Test automatische toestemming'}),e=>e.code==='42501');
 const rule=await call('rule',{client_id:'a',version:0,state:'paused',send_mode:'manual',reason:'Tijdelijke synthetische pauze'});assert.equal(rule.send_mode,'manual');snap=await read();assert(snap.tasks.filter(t=>t.client_id==='a').every(t=>t.status==='paused'));
 await assert.rejects(call('rule',{client_id:'a',version:0,state:'active',reason:'Oude versie'}),e=>e.code==='PT409');
 await call('rule',{client_id:'a',version:rule.version,state:'active',send_mode:'manual',reason:'Synthetische pauze voorbij'});
 snap=await read();const next=snap.tasks.find(t=>t.client_id==='a'&&!t.invoice_id);const moved=await call('task',{id:next.id,version:next.version,send_date:B.add(now,5),reason:'Handmatige testdatum'});assert.equal(moved.send_date,B.add(now,5));await call('refresh');snap=await read();assert(snap.tasks.find(t=>t.id===next.id).invoice_id);
 await assert.rejects(call('task',{id:next.id,version:next.version,send_date:now,reason:'Verouderde poging'}),e=>e.code==='PT409');
 const future=B.add(now,100),special=await bill('save_agreement',{client_id:'new',expected_version:0,effective_from:future,cycle:'four_weeks',package_id:'duo-progressie',enabled:true,confirmed:true});assert.equal(special.amount_cents,50000);
 const exception=await call('first_period',{agreement_id:special.id,first_end:B.add(future,13),amount_cents:25000,reason:'Expliciete synthetische eerste twee weken'});
 const period=(await db.query('select fmz_accounting.billing_period(v,$2) p from fmz_accounting.agreement_versions v where id=$1',[special.id,future])).rows[0].p;assert.equal(period.end,B.add(future,13));
 assert.deepEqual(B.period({...special,first_period:exception},future),period);assert.equal(B.period({...special,first_period:exception},B.add(future,14)).end,B.add(future,41));
 // The existing invoice chooser route uses exactly the same period and price helper.
 const exceptionalInvoice=await bill('prepare_invoice',{client_id:'new',at_date:future});assert.equal(exceptionalInvoice.data.gross_cents,25000);assert.equal(exceptionalInvoice.data.raw.unitPrice,250);assert.equal(exceptionalInvoice.data.billing.amountCents,25000);
 assert.equal((await bill('prepare_invoice',{client_id:'new',at_date:B.add(future,14)})).data.gross_cents,50000);
 await assert.rejects(call('first_period',{agreement_id:special.id,first_end:B.add(future,10),amount_cents:20000,reason:'Mag niet na voorbereiding'}),e=>e.code==='PT409');
 const ownerSnapshot=(await as('trainer','select public.fmz_accounting_read() r')).rows[0].r;assert.equal(ownerSnapshot.agreements.find(v=>v.id===special.id).first_period.amount_cents,25000);
 const signed=await bill('save_agreement',{client_id:'new',expected_version:1,effective_from:B.add(future,42),cycle:'four_weeks',package_id:'pt-basis',enabled:true,confirmed:true});
 const contract=randomUUID(),asset=randomUUID();await db.query("insert into fmz_members.drafts(id,trainer_id,client_id) values($1,$2,'new')",[contract,ids.trainer]);await db.query("insert into fmz_members.assets(id,trainer_id,client_id,draft_id,kind,mime,bytes,sha256,path,status) values($1,$2,'new',$3,'agreement','application/pdf',10,repeat('a',64),'synthetic-signed-contract.pdf','ready')",[asset,ids.trainer,contract]);await db.query("insert into fmz_members.contracts(id,trainer_id,client_id,number,org_id,agreement_id,snapshot,document_id,document_hash) values($1,$2,'new','SYNTHETIC-CONTRACT',$3,$4,'{}',$5,repeat('a',64))",[contract,ids.trainer,oid,signed.id,asset]);
 await assert.rejects(call('first_period',{agreement_id:signed.id,first_end:B.add(future,50),amount_cents:10000,reason:'Ondertekende afspraak mag niet wijzigen'}),e=>e.code==='PT409');
 const oneoff=[];for(let i=0;i<2;i++){const invoice=(await as('trainer','select public.fmz_accounting_command($1,$2,$3) r',['draft',JSON.stringify({id:randomUUID(),version:0,data:{date:now,client_id:'a',description:'Afzonderlijke synthetische losse factuur '+i,gross_cents:i===0?5000:null,discount_cents:0,customer:{name:'Synthetisch Voorbeeld',address:'Voorbeeldstraat 1'},term_days:14,service_date:now,service_extent:'Een synthetische dienst'}}),randomUUID()])).rows[0].r;
  const plan=await call('schedule_invoice',{invoice_id:invoice.id,version:invoice.version,send_date:now,reason:'Afzonderlijke eenmalige planning'});assert.equal((await call('schedule_invoice',{invoice_id:invoice.id,version:invoice.version,send_date:now,reason:'Afzonderlijke eenmalige planning'})).id,plan.id);oneoff.push(plan.id);assert.equal(Boolean((await read()).tasks.find(t=>t.id===plan.id).ready),i===0);}
 assert.notEqual(oneoff[0],oneoff[1]);assert.equal((await read()).tasks.filter(t=>oneoff.includes(t.id)&&t.cycle==='none').length,2);
 const ambiguousTask=(await read()).tasks.find(t=>t.client_id==='a'&&!t.invoice_id);assert(ambiguousTask.candidates.length>=2);
 await assert.rejects(call('prepare',{id:ambiguousTask.id,version:ambiguousTask.version}),e=>e.code==='PT409'&&/factuurdatum bewijst/.test(e.message));
 for(const candidate of ambiguousTask.candidates){const fresh=(await read()).tasks.find(t=>t.id===ambiguousTask.id);await call('review_invoice',{id:fresh.id,version:fresh.version,invoice_id:candidate.id,invoice_version:candidate.version,decision:'other_period',reason:'Synthetische bron hoort aantoonbaar bij andere prestatie'});}
 const reviewedTask=(await read()).tasks.find(t=>t.id===ambiguousTask.id);assert.equal((await call('prepare',{id:reviewedTask.id,version:reviewedTask.version})).status,'draft');
 await db.exec('set role anon');try{await assert.rejects(db.query('select public.fmz_billing_planning_read()'),e=>e.code==='42501');}finally{await db.exec('reset role');}
 }finally{await db.close();}
});

test('signed discount and explicit first period produce exact cents in manual and automatic drafts',{timeout:120000},async()=>{
 const x=await setup();try{const {db,as,ids}=x,oid=await extend(x);await db.exec('create role service_role');for(const file of ['20261026154916_appfmz_members.sql','20261026154917_appfmz_billing_planning.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8'));
 const now=(await db.query('select current_date::text d')).rows[0].d,bill=(a,p)=>as('trainer','select public.fmz_billing_command($1,$2,$3) r',[a,JSON.stringify(p),randomUUID()]).then(r=>r.rows[0].r);
 const v=await bill('save_agreement',{client_id:'a',expected_version:0,effective_from:now,cycle:'four_weeks',package_id:'pt-progressie',enabled:true,confirmed:true});
 const payment={baseCents:38000,discountCents:3001,discountPeriods:2,discountReason:'Synthetische startkorting',firstPeriodCustom:true,firstPeriodEnd:B.add(now,13),firstPeriodCents:19001,firstPeriodNetCents:16000,firstPeriodReason:'Expliciet overeengekomen eerste twee weken'};
 await assert.rejects(as('a','select fmz_members.attach_payment($1,$2,$3,$4)',[oid,v.id,JSON.stringify(payment),ids.a]),e=>e.code==='42501');
 await as('trainer','select 1');await assert.rejects(db.query('select fmz_members.attach_payment($1,$2,$3,$4)',[oid,v.id,JSON.stringify({...payment,discountCents:19002}),ids.trainer]),e=>e.code==='22023');
 for(const override of [{discountCents:-1},{discountPeriods:0},{discountPeriods:131},{firstPeriodEnd:B.add(now,28)},{firstPeriodCents:-1},{discountReason:''}])await assert.rejects(db.query('select fmz_members.attach_payment($1,$2,$3,$4)',[oid,v.id,JSON.stringify({...payment,...override}),ids.trainer]),e=>e.code==='22023');
 await assert.rejects(db.query('select fmz_members.attach_payment($1,$2,$3,$4)',[oid,v.id,JSON.stringify({...payment,firstPeriodNetCents:15999}),ids.trainer]),e=>e.code==='PT409');
 assert.equal((await db.query('select count(*)::int n from fmz_accounting.billing_first_periods')).rows[0].n,0);
 await db.query('select fmz_members.attach_payment($1,$2,$3,$4)',[oid,v.id,JSON.stringify(payment),ids.trainer]);
 const a=await bill('prepare_invoice',{client_id:'a',at_date:now});assert.equal(a.data.gross_cents,19001);assert.equal(a.data.discount_cents,3001);assert.equal(a.data.billing.netCents,16000);assert.equal(a.data.raw.discount,30.01);assert.equal(a.data.raw.discountNote,payment.discountReason);assert.equal(a.data.discountNote,payment.discountReason);assert.equal((await bill('prepare_invoice',{client_id:'a',at_date:now})).id,a.id);
 await assert.rejects(db.query('select fmz_members.attach_payment($1,$2,$3,$4)',[oid,v.id,JSON.stringify(payment),ids.trainer]),e=>e.code==='PT409');
 await db.query('select fmz_accounting.planning_tick($1,$2)',[B.add(now,39),oid]);
 const rows=(await db.query("select data from fmz_accounting.records where kind='invoice' and data->>'client_id'='a' order by data#>>'{billing,start}'")).rows;const second=rows.find(r=>r.data.billing.start===B.add(now,14));assert(second);assert.equal(second.data.gross_cents,38000);assert.equal(second.data.discount_cents,3001);assert.equal(second.data.discountNote,payment.discountReason);assert.equal(second.data.billing.netCents,34999);
 await db.query('select fmz_accounting.planning_tick($1,$2)',[B.add(now,67),oid]);const third=(await db.query("select data from fmz_accounting.records where data#>>'{billing,start}'=$1",[B.add(now,42)])).rows[0].data;assert.equal(third.discount_cents,0);assert.equal(third.billing.netCents,38000);
 assert.equal((await db.query('select count(*)::int n from fmz_accounting.journals')).rows[0].n,0);assert.equal((await db.query('select amount_cents from fmz_accounting.agreement_versions where id=$1',[v.id])).rows[0].amount_cents,38000);
 const month=B.add(now.slice(0,7)+'-01',32).slice(0,7)+'-01',monthly=await bill('save_agreement',{client_id:'b',expected_version:0,effective_from:month,cycle:'calendar_month',package_id:'pt-basis',enabled:true,confirmed:true});
 await db.query('select fmz_members.attach_payment($1,$2,$3,$4)',[oid,monthly.id,JSON.stringify({baseCents:20000,discountCents:1000,discountPeriods:1,discountReason:'Eerste kalendermaand korting'}),ids.trainer]);
 const one=await bill('prepare_invoice',{client_id:'b',at_date:month}),two=await bill('prepare_invoice',{client_id:'b',at_date:B.add(month,32).slice(0,7)+'-01'});assert.equal(one.data.billing.cycle,'calendar_month');assert.equal(one.data.discount_cents,1000);assert.equal(two.data.discount_cents,0);assert.equal(two.data.gross_cents,20000);
 for(const table of ['billing_agreement_discounts','billing_first_periods'])await assert.rejects(as('a','select * from fmz_accounting.'+table),e=>e.code==='42501');
 }finally{await x.db.close();}
});

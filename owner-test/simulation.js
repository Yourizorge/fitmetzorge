/* Synthetic reminders only. No network, financial commands, mail or push transport. */
window.OwnerTestSimulation=(()=>{
 'use strict';
 const fail=(message,code='P0001')=>{throw Object.assign(Error(message),{code});};
 const copy=value=>structuredClone(value);
 const day=value=>typeof value?.toISOString==='function'?value.toISOString().slice(0,10):String(value).slice(0,10);
 function amsterdamDay(value=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
 function addDays(value,n){const d=new Date(day(value)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
 async function organization({db,actor}){
  if(!db?.query||!actor?.id||actor.role!=='trainer')fail('Alleen de geïsoleerde trainerstest mag herinneringen bekijken.','42501');
  const org=(await db.query('select id from fmz_accounting.organizations where owner_id=$1',[actor.id])).rows[0]?.id;if(!org)fail('Geen eigenaar van deze oefenadministratie.','42501');return org;
 }
 async function readPeriods(context,asOf=amsterdamDay(),options={}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf)))fail('Ongeldige testdatum.');
  const org=await organization(context);
  const result=await context.db.query(`
   with periods as (
    select distinct v.id agreement_id,v.client_id,v.cycle,v.package_label,v.version,p.value period,
     coalesce(d.name,v.client_id) client_name,d.member_number,r.state,r.pause_from,r.pause_until,r.end_date,
     fmz_accounting.billing_amount(v,p.value)-(fmz_accounting.billing_discount(v,p.value)->>'cents')::bigint amount_cents
    from fmz_accounting.agreement_versions v
    cross join lateral generate_series(greatest(v.effective_from,$3::date),$4::date,interval '1 day') x(at_date)
    cross join lateral (select fmz_accounting.billing_period(v,x.at_date::date) value) p
    left join fmz_members.directory d on d.client_id=v.client_id and d.trainer_id=$2
    left join fmz_accounting.billing_plan_rules r on r.org_id=v.org_id and r.client_id=v.client_id
    where v.org_id=$1 and v.enabled and v.cycle in ('four_weeks','calendar_month')
    and v.id=(select z.id from fmz_accounting.agreement_versions z where z.org_id=v.org_id and z.client_id=v.client_id and z.effective_from<=(p.value->>'start')::date order by z.effective_from desc,z.version desc limit 1)
    and not exists(select 1 from fmz_accounting.agreement_versions z where z.org_id=v.org_id and z.client_id=v.client_id and z.effective_from>(p.value->>'start')::date and z.effective_from<=(p.value->>'end')::date)
   ) select * from periods where
    (state is distinct from 'ended' or (period->>'invoiceDate')::date<end_date)
    and (state is distinct from 'paused' or pause_from is not null and ((period->>'invoiceDate')::date<pause_from or pause_until is not null and (period->>'invoiceDate')::date>pause_until))
    order by period->>'invoiceDate',client_name,agreement_id`,[org,context.actor.id,options.includeHistory?'1900-01-01':asOf,options.through||addDays(asOf,120)]);
  const contracts=(await context.db.query("select client_id,snapshot from fmz_members.contracts where trainer_id=$1 and snapshot ? 'duo' order by created_at desc",[context.actor.id])).rows;
  const duo=new Map();for(const c of contracts)if(!duo.has(c.client_id))duo.set(c.client_id,c.snapshot.duo);
  const secondary=new Set([...duo.values()].map(x=>x.secondClientId));
  return result.rows.filter(row=>!secondary.has(row.client_id)).map(row=>{const pair=duo.get(row.client_id),second=pair?.secondPerson;const participants=[{clientId:row.client_id,name:row.client_name,memberNumber:row.member_number,primary:true}];if(pair?.secondClientId)participants.push({clientId:pair.secondClientId,name:[second?.firstName,second?.insertion,second?.lastName].filter(Boolean).join(' ')||'Tweede duodeelnemer',primary:false});return{agreementId:row.agreement_id,clientId:row.client_id,clientName:row.client_name,participants,duo:Boolean(pair),amountCents:Number(row.amount_cents),cycle:row.cycle,packageLabel:row.package_label,agreementVersion:row.version,start:day(row.period.start),end:day(row.period.end),invoiceDate:day(row.period.invoiceDate),prepareDate:addDays(row.period.invoiceDate,-7),timeZone:'Europe/Amsterdam'};});
 }
 async function calendar(context,options={}){
  await organization(context);if(!/^TEST-/.test(context.runId||''))fail('Geïsoleerde testrun ontbreekt.','42501');
  const asOf=options.asOf||amsterdamDay(),from=options.from||asOf,to=options.to||addDays(asOf,120);
  for(const d of [asOf,from,to])if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d)fail('Ongeldige agendadatum.');
  if(to<from||to>addDays(from,400))fail('Kies een agendaweergave van maximaal 400 dagen.');
  const periods=await readPeriods(context,asOf,{includeHistory:true,through:to>asOf?to:asOf}),groups=new Map(),completed=context.simulation?.calendarCompleted||{},model=window.OwnerTestMemberStatus;
  for(const p of periods)for(const kind of ['billing_prepare','billing_due']){
   const date=kind==='billing_prepare'?p.prepareDate:p.invoiceDate;if(date>to||date<from&&date>=asOf)continue;
   const flags=model?.at(context.simulation,p.clientId,'active',date);if(flags&&(!flags.billing||!flags.reminders))continue;
   const key=date+'|'+kind;let group=groups.get(key);if(!group){group={date,kind,time:'09:00',timeZone:'Europe/Amsterdam',text:kind==='billing_prepare'?'Over één week facturen maken':'Vandaag facturen maken en versturen',items:[]};groups.set(key,group);}group.items.push(p);
  }
  const itemKey=(p,kind)=>[p.agreementId,p.start,p.end,kind].join('|'),covered=new Set(Object.values(completed).filter(t=>t.runId===context.runId).flatMap(t=>t.items.map(p=>itemKey(p,t.kind))));
  const tasks=[...groups.values()].map(g=>({...g,items:g.items.filter(p=>!covered.has(itemKey(p,g.kind)))})).filter(g=>g.items.length).map(g=>{g.items.sort((a,b)=>a.agreementId.localeCompare(b.agreementId));const id=['calendar',context.runId,g.date,g.kind,...g.items.map(p=>p.agreementId+':'+p.start)].join('|');return{...g,id,runId:context.runId,status:g.date<asOf?'overdue':'open',completedAt:null,totalCents:g.items.reduce((s,p)=>s+p.amountCents,0)};});
  // Completed historical items retain their exact participant/price snapshot.
  for(const done of Object.values(completed))if(done.runId===context.runId&&done.date>=from&&done.date<=to&&!tasks.some(t=>t.id===done.id))tasks.push({...copy(done),status:'done'});
  return tasks.filter(t=>t.date>=from&&t.date<=to||t.status==='overdue').sort((a,b)=>a.date.localeCompare(b.date)||a.kind.localeCompare(b.kind));
 }
 async function run(context,action,payload={},requestId){
  if(!['reminder-7','reminder-today','reminder-complete','calendar-complete'].includes(action))fail('Factuurautomatisering en e-mailsimulaties zijn uitgeschakeld in deze owner-test.','OWNER_TEST_DISABLED');
  const {simulation,runId}=context;await organization(context);
  if(typeof runId!=='string'||runId.length<8||!simulation)fail('De geïsoleerde testrun ontbreekt.','42501');
  if(!/^[a-f0-9-]{36}$/i.test(requestId||''))fail('Een uniek testverzoek ontbreekt.');
  const state=copy(simulation);state.reminders??=[];state.receipts??={};
  const request=JSON.stringify({action,payload,runId}),prior=state.receipts[requestId];
  if(prior){if(prior.request!==request)fail('Dit testverzoek is al voor een andere handeling gebruikt.','PT409');return copy(prior.result);}
  let result;const at=new Date().toISOString();
  if(action==='calendar-complete'){
   const items=await calendar(context,{from:payload.date,to:payload.date}),task=items.find(t=>t.id===payload.id);if(!task)fail('De herinnering is gewijzigd. Ververs en controleer opnieuw.','PT409');
   state.calendarCompleted??={};state.calendarCompleted[task.id]??={...copy(task),status:'done',completedAt:at};result=state.calendarCompleted[task.id];
  }else if(action==='reminder-complete'){
   result=state.reminders.find(r=>r.id===payload.id&&r.runId===runId&&r.reminderVersion===2);if(!result)fail('Deze herinnering bestaat niet in deze testrun.');
   if(result.status!=='done'){result.status='done';result.completedAt=at;}
  }else{
   const periods=await readPeriods(context,payload.periodStart),period=periods.find(p=>p.agreementId===payload.agreementId&&p.start===payload.periodStart);if(!period)fail('Deze betaalafspraak of periode is niet actief.','PT409');
   const kind=action==='reminder-7'?'billing_prepare':'billing_due',key=[runId,period.agreementId,period.start,period.end,kind].join('|');
   result=state.reminders.find(r=>r.key===key&&r.reminderVersion===2);
   if(!result){result={id:crypto.randomUUID(),key,reminderVersion:2,runId,...period,kind,period:period.start+' t/m '+period.end,date:kind==='billing_prepare'?period.prepareDate:period.invoiceDate,time:'09:00',timeZone:'Europe/Amsterdam',status:'open',simulated:true,at,text:kind==='billing_prepare'?'Over één week facturen maken':'Vandaag facturen maken en versturen'};state.reminders.push(result);}
  }
  state.receipts[requestId]={request,result:copy(result)};Object.keys(simulation).forEach(k=>delete simulation[k]);Object.assign(simulation,state);return copy(result);
 }
 return{run,readPeriods,calendar,amsterdamDay,addDays};
})();

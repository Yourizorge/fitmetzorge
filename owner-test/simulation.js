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
 async function readPeriods(context,asOf=amsterdamDay()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf)))fail('Ongeldige testdatum.');
  const org=await organization(context);
  const result=await context.db.query(`
   with periods as (
    select distinct v.id agreement_id,v.client_id,v.cycle,v.package_label,v.version,p.value period,
     coalesce(d.name,v.client_id) client_name,r.state,r.pause_from,r.pause_until,r.end_date
    from fmz_accounting.agreement_versions v
    cross join lateral generate_series(greatest(v.effective_from,$2::date),$2::date+63,interval '1 day') x(at_date)
    cross join lateral (select fmz_accounting.billing_period(v,x.at_date::date) value) p
    left join fmz_members.directory d on d.client_id=v.client_id and d.trainer_id=$3
    left join fmz_accounting.billing_plan_rules r on r.org_id=v.org_id and r.client_id=v.client_id
    where v.org_id=$1 and v.enabled and v.cycle in ('four_weeks','calendar_month')
    and v.id=(select z.id from fmz_accounting.agreement_versions z where z.org_id=v.org_id and z.client_id=v.client_id and z.effective_from<=(p.value->>'start')::date order by z.effective_from desc,z.version desc limit 1)
    and not exists(select 1 from fmz_accounting.agreement_versions z where z.org_id=v.org_id and z.client_id=v.client_id and z.effective_from>(p.value->>'start')::date and z.effective_from<=(p.value->>'end')::date)
   ) select * from periods where
    (state is distinct from 'ended' or (period->>'invoiceDate')::date<end_date)
    and (state is distinct from 'paused' or pause_from is not null and ((period->>'invoiceDate')::date<pause_from or pause_until is not null and (period->>'invoiceDate')::date>pause_until))
    order by period->>'invoiceDate',client_name,agreement_id`,[org,asOf,context.actor.id]);
  return result.rows.map(row=>({agreementId:row.agreement_id,clientId:row.client_id,clientName:row.client_name,cycle:row.cycle,packageLabel:row.package_label,agreementVersion:row.version,start:day(row.period.start),end:day(row.period.end),invoiceDate:day(row.period.invoiceDate),prepareDate:addDays(row.period.invoiceDate,-7),timeZone:'Europe/Amsterdam'}));
 }
 async function run(context,action,payload={},requestId){
  if(!['reminder-7','reminder-today','reminder-complete'].includes(action))fail('Factuurautomatisering en e-mailsimulaties zijn uitgeschakeld in deze owner-test.','OWNER_TEST_DISABLED');
  const {simulation,runId}=context;await organization(context);
  if(typeof runId!=='string'||runId.length<8||!simulation)fail('De geïsoleerde testrun ontbreekt.','42501');
  if(!/^[a-f0-9-]{36}$/i.test(requestId||''))fail('Een uniek testverzoek ontbreekt.');
  const state=copy(simulation);state.reminders??=[];state.receipts??={};
  const request=JSON.stringify({action,payload,runId}),prior=state.receipts[requestId];
  if(prior){if(prior.request!==request)fail('Dit testverzoek is al voor een andere handeling gebruikt.','PT409');return copy(prior.result);}
  let result;const at=new Date().toISOString();
  if(action==='reminder-complete'){
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
 return{run,readPeriods,amsterdamDay,addDays};
})();

/* Isolated owner-test status ledger. Reads synthetic directory; never writes SQL. */
(function(root){
 'use strict';const clone=v=>structuredClone(v),fail=(m,code='P0001')=>{throw Object.assign(Error(m),{code});};
 const today=(v=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
 function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T12:00:00Z'))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)fail('Vul een geldige effectieve datum in.');return v;}
 function normalize(v){return ['inactive','paused','ended','archived'].includes(v)?'inactive':['draft','concept'].includes(v)?'concept':'active';}
 function at(simulation,clientId,base='active',on=today()){
  const ledger=simulation?.memberStatus?.[clientId],out={status:normalize(base),coaching:true,billing:true,reminders:true,version:ledger?.events?.length||0,scheduled:[],history:clone(ledger?.events||[])};
  for(const e of [...(ledger?.events||[])].sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)||a.version-b.version)){
   if(e.effectiveDate<=on)out.status=e.newStatus;else out.scheduled.push(clone(e));
  }
  // Operational effects never erase past tasks, even with a retroactive status date.
  for(const e of [...(ledger?.events||[])].sort((a,b)=>a.operationalFrom.localeCompare(b.operationalFrom)||a.version-b.version))if(e.operationalFrom<=on)for(const k of ['coaching','billing','reminders'])if(e.effects[k]!=='keep')out[k]=e.effects[k]==='resume';
  return out;
 }
 async function directory({db,actor},clientId){
  if(!db?.query||!actor?.id||actor.role!=='trainer')fail('Alleen de bevoegde trainer mag de teststatus beheren.','42501');
  const params=[actor.id],where=clientId?' and client_id=$2':'';if(clientId)params.push(clientId);
  const rows=(await db.query('select client_id,name,member_number,status from fmz_members.directory where trainer_id=$1'+where+' order by member_number',params)).rows;
  if(clientId&&!rows.length)fail('Dit lid is niet toegankelijk.','42501');return rows;
 }
 async function read(context,clientId,on=today()){date(on);const rows=await directory(context,clientId),duo=(await context.db.query("select client_id,snapshot#>>'{duo,secondClientId}' secondary_client_id from fmz_members.contracts where trainer_id=$1 and snapshot ? 'duo'",[context.actor.id])).rows;return rows.map(m=>({...m,...at(context.simulation,m.client_id,m.status,on),billingOwnerClientId:duo.find(d=>d.secondary_client_id===m.client_id)?.client_id||m.client_id}));}
 async function command(context,payload,requestId){
  const {simulation,runId}=context;if(!simulation||!/^TEST-/.test(runId||''))fail('Geïsoleerde testrun ontbreekt.','42501');
  if(typeof payload?.clientId!=='string'||!payload.clientId.trim())fail('Kies een lid.');
  const member=(await directory(context,payload.clientId))[0];if(!member)fail('Kies een lid.');
  if(!/^[a-f0-9-]{36}$/i.test(requestId||''))fail('Een uniek verzoek ontbreekt.');
  const signature=JSON.stringify({runId,payload}),receipts=simulation.statusReceipts||{},prior=receipts[requestId];
  if(prior){if(prior.signature!==signature)fail('Dit verzoek hoort bij andere invoer.','PT409');return clone(prior.result);}
  const effectiveDate=date(payload.effectiveDate),now=new Date(context.now||Date.now()).toISOString(),recordedDay=today(now),previous=at(simulation,member.client_id,member.status,effectiveDate);
  if(payload.expectedVersion!==previous.version)fail('De ledenstatus is ondertussen gewijzigd. Ververs en controleer opnieuw.','PT409');
  if(!['active','inactive'].includes(payload.status)||payload.confirmed!==true)fail('Bevestig de statuswijziging eerst.');
  const effects={};for(const key of ['coaching','billing','reminders']){const value=payload.effects?.[key];if(!['keep','pause','resume'].includes(value))fail('Maak een afzonderlijke keuze voor '+key+'.');if(payload.status==='inactive'&&value==='resume'||payload.status==='active'&&value==='pause')fail('De gekozen vervolghandeling past niet bij de status.');effects[key]=value;}
  if(effects.billing!=='keep'||effects.reminders!=='keep'){const joint=(await context.db.query("select client_id from fmz_members.contracts where trainer_id=$1 and snapshot#>>'{duo,secondClientId}'=$2",[context.actor.id,member.client_id])).rows[0];if(joint&&joint.client_id!==member.client_id)fail('Dit duo deelt één betaalafspraak. Beheer de betaalafspraak en herinneringen bewust bij de hoofdcontractant; de persoonlijke status en coaching kunnen hier worden aangepast.');}
  const reason=String(payload.reason||'').trim(),note=String(payload.note||'').trim();if(reason.length>500||note.length>2000)fail('Reden of notitie is te lang.');
  const event={id:crypto.randomUUID(),runId,clientId:member.client_id,version:previous.version+1,oldStatus:previous.status,newStatus:payload.status,effectiveDate,operationalFrom:effectiveDate>recordedDay?effectiveDate:recordedDay,at:now,actorId:context.actor.id,reason,note,effects};
  simulation.memberStatus??={};simulation.memberStatus[member.client_id]??={events:[]};simulation.memberStatus[member.client_id].events.push(event);
  const result={event:clone(event),member:{...member,...at(simulation,member.client_id,member.status,recordedDay)}};simulation.statusReceipts??={};simulation.statusReceipts[requestId]={signature,result:clone(result)};return result;
 }
 function project(simulation,action,value,on=today()){
  const valueCopy=clone(value);const apply=m=>m&&({...m,status:at(simulation,m.client_id,m.status,on).status,ownerStatus:at(simulation,m.client_id,m.status,on)});
  if(['search','duplicates'].includes(action)&&Array.isArray(valueCopy))return valueCopy.map(apply);
  if(action==='profile'&&valueCopy?.member){valueCopy.member=apply(valueCopy.member);valueCopy.events=[...(valueCopy.events||[]),...valueCopy.member.ownerStatus.history.map(e=>({id:e.id,action:'Ledenstatus: '+e.oldStatus+' → '+e.newStatus,created_at:e.at,actor_id:e.actorId,before_data:{status:e.oldStatus},after_data:{status:e.newStatus,effectiveDate:e.effectiveDate,reason:e.reason,note:e.note,effects:e.effects}}))];}
  return valueCopy;
 }
 const api={read,command,at,project,today,date,normalize};root.OwnerTestMemberStatus=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);

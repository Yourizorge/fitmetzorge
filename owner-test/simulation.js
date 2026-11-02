/* Isolated laptop-test transport. This module contains no network or provider client. */
window.OwnerTestSimulation=(()=>{
 'use strict';
 const fail=(message,code='P0001')=>{throw Object.assign(Error(message),{code});};
 const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
 const digest=async bytes=>hex(await crypto.subtle.digest('SHA-256',bytes));
 const copy=value=>structuredClone(value);
 const day=value=>typeof value?.toISOString==='function'?value.toISOString().slice(0,10):String(value).slice(0,10);
 async function run({db,blobs,simulation,runId,actor},action,payload={},requestId){
  if(!db?.query||!blobs?.get||typeof runId!=='string'||runId.length<8||!actor?.id||actor.role!=='trainer')fail('Alleen de geïsoleerde trainerstest mag simuleren.','42501');
  if(!/^[a-f0-9-]{36}$/i.test(requestId||''))fail('Een uniek testverzoek ontbreekt.');
  const state=copy(simulation||{});state.sent??=[];state.history??=[];state.reminders??=[];state.receipts??={};
  const request=JSON.stringify({action,payload,runId}),prior=state.receipts[requestId];
  if(prior){if(prior.request!==request)fail('Dit testverzoek is al voor een andere handeling gebruikt.','PT409');return copy(prior.result);}
  const rows=await db.query('select id from fmz_accounting.organizations where owner_id=$1',[actor.id]);const org=rows.rows[0]?.id;if(!org)fail('Geen eigenaar van deze oefenadministratie.','42501');
  const at=new Date().toISOString();let result;
  if(['reminder-7','reminder-today'].includes(action)){
   const task=(await db.query('select * from fmz_accounting.billing_plan_tasks where org_id=$1 and id=$2',[org,payload.taskId])).rows[0];if(!task||task.status!=='active')fail('Kies een actieve synthetische factuurperiode.');
   const kind=action==='reminder-7'?'billing_prepare':'billing_due',existing=state.reminders.find(r=>r.taskId===task.id&&r.kind===kind);
   if(existing)result=existing;else{const date=new Date(day(task.send_date)+'T12:00:00Z');if(kind==='billing_prepare')date.setUTCDate(date.getUTCDate()-7);result={id:crypto.randomUUID(),runId,taskId:task.id,kind,period:day(task.start_date)+' t/m '+day(task.end_date),date:date.toISOString().slice(0,10),time:'09:00',timeZone:'Europe/Amsterdam',status:'simulated',at,text:kind==='billing_prepare'?'De facturen voor deze periode moeten binnenkort worden voorbereid.':'Controleer de facturen voor deze periode vóór verzending.'};state.reminders.push(result);}
   state.history.push({id:crypto.randomUUID(),action,at,runId,taskId:task.id,status:'simulated',description:'Alleen een in-appvoorbeeld; geen pushprovider benaderd.'});
  }else if(['mail-send','mail-fail','mail-retry'].includes(action)){
   if(payload.confirmed!==true)fail('Controleer het e-mailconcept en de PDF vóór de simulatie.');
   const m=(await db.query('select * from fmz_communication.messages where org_id=$1 and id=$2',[org,payload.messageId])).rows[0];if(!m)fail('Open eerst een definitief synthetisch document met e-mailconcept.');
   if(Number(m.version)!==Number(payload.version))fail('Het testconcept is gewijzigd. Ververs en controleer opnieuw.','PT409');
   if(m.purpose!=='document')fail('Kies de documentmail in de oefenomgeving.');
   if(m.status==='sent'){const sent=state.sent.find(x=>x.messageId===m.id);if(!sent||!m.acceptance?.simulated)fail('Geen herstelbare simulatie gevonden.');result=sent;}
   else{
    if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(m.recipient)||!m.subject?.trim()||/[\r\n]/.test(m.subject)||!m.body?.trim())fail('Controleer de ontvanger, het onderwerp en de tekst in het e-mailconcept.');
    const previous=state.history.filter(h=>h.messageId===m.id).at(-1);
    if(action==='mail-retry'&&previous?.status!=='failed')fail('Alleen de eerder gesimuleerde mislukking kan opnieuw worden geprobeerd.');
    if(!['draft','approved','scheduled','temporary_failure','permanent_failure'].includes(m.status))fail('Deze testmail kan niet opnieuw worden verstuurd.');
    const doc=(await db.query('select * from fmz_communication.documents where org_id=$1 and id=$2 and kind=$3',[org,m.document_id,m.kind])).rows[0];if(!doc)fail('De definitieve PDF ontbreekt.');
    const blob=blobs.get(doc.bucket+'/'+doc.path),bytes=blob?.bytes;if(!(bytes instanceof Uint8Array)||bytes.length!==Number(doc.bytes)||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-'||await digest(bytes)!==doc.sha256)fail('De lokale PDF-bijlage is niet volledig bevestigd.');
    if(m.kind==='invoice'){const inv=(await db.query("select status,data from fmz_accounting.records where org_id=$1 and id=$2 and kind='invoice'",[org,m.document_id])).rows[0];if(!inv||inv.status!=='posted'||inv.data?.cancellation_id)fail('De oefenfactuur is niet meer geldig.');}
    const failed=action==='mail-fail';result={id:crypto.randomUUID(),runId,messageId:m.id,documentId:m.document_id,kind:m.kind,recipient:m.recipient,subject:m.subject,body:m.body,attachmentName:doc.name,attachmentHash:doc.sha256,attachmentPath:doc.bucket+'/'+doc.path,status:failed?'failed':'sent',at,simulated:true};
    await db.exec('begin');try{
     await db.query("update fmz_communication.messages set status=$3,acceptance=$4,archive=$5,last_code=$6,version=version+1,updated_at=now() where org_id=$1 and id=$2",[org,m.id,failed?'temporary_failure':'sent',failed?null:JSON.stringify({simulated:true,method:'local-owner-test',from:'oefenmail@example.test',at}),failed?null:JSON.stringify({simulated:true,folder:'Verzonden — simulatie',messageId:m.id}),failed?'simulated_failure':'simulated_success']);
     await db.query("insert into fmz_communication.audit(org_id,message_id,actor,action,detail) values($1,$2,$3,$4,$5)",[org,m.id,actor.id,'owner_test_'+action,JSON.stringify(result)]);await db.exec('commit');
    }catch(error){await db.exec('rollback');throw error;}
    if(!failed)state.sent.push(result);state.history.push({...result,action,description:failed?'Bewust nagebootste mailfout. Geen externe verzending.':'Alleen lokaal als verzonden getoond; niets naar een mailbox verstuurd.'});
   }
  }else fail('Onbekende simulatieactie.');
  state.receipts[requestId]={request,result};Object.keys(simulation).forEach(k=>delete simulation[k]);Object.assign(simulation,state);return copy(result);
 }
 return{run};
})();

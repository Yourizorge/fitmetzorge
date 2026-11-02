/* Planning dates are civil Europe/Amsterdam dates. Payments stay in the ledger. */
(function(root){
 'use strict';
 const B=typeof module!=='undefined'?require('./billing-periods.js'):root.FMZBillingPeriods;
 const labels={planned:'Gepland',draft:'Concept',ready:'Gereed voor controle',final:'Definitief',sent:'Verzonden',partial:'Deels betaald',paid:'Betaald',cancelled:'Geannuleerd of gecorrigeerd',paused:'Gepauzeerd',failed:'Mislukte verzending',scheduled:'Ingepland'};
 const today=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 function state(task,invoice,projection,mail){
  if(task.status==='cancelled'||invoice?.data?.cancellation_id||(projection?.credits<0&&projection.credits===-invoice?.data?.document?.totalCents))return'cancelled';
  if(task.status==='paused')return'paused';
  if(!invoice)return'planned';
  if(invoice.status==='draft')return task.ready?'ready':'draft';
  if(projection?.outstanding===0)return'paid';
  if(projection?.outstanding>0&&projection.paidCents>0)return'partial';
  if(['sent','sent_archive_pending','archive_pending'].includes(mail?.status))return'sent';
  if(['failed','rejected','delivery_unknown','temporary_failed','permanent_failed','temporary_failure','permanent_failure'].includes(mail?.status))return'failed';
  if(mail?.status==='scheduled')return'scheduled';
  return'final';
 }
 function filter(rows,f={}){const q=String(f.query||'').trim().toLocaleLowerCase('nl-NL').replace(/\s+/g,' ');return rows.filter(t=>(!f.cycle||t.cycle===f.cycle)&&(!f.status||t.display_status===f.status)&&(!f.send_status||(t.mail?.status||'none')===f.send_status)&&(!f.payment_status||t.payment_status===f.payment_status)&&(!f.package_id||t.package_id===f.package_id)&&(!f.client_id||t.client_id===f.client_id)&&(!f.from||t.end_date>=f.from)&&(!f.to||t.start_date<=f.to)&&(!q||[t.client_name,t.package_label,t.number].filter(Boolean).join(' ').toLocaleLowerCase('nl-NL').replace(/\s+/g,' ').includes(q)));}
 function reminder(task,now=today()){B.date(now);B.date(task.send_date);return task.send_date===now?'due':B.add(task.send_date,-7)===now?'prepare':null;}
 function validateOverride(raw){const date=B.date(raw.send_date).toISOString().slice(0,10),reason=String(raw.reason||'').trim();if(reason.length<5||reason.length>1000)throw Error('Geef een duidelijke reden van 5 tot 1000 tekens.');return{send_date:date,reason};}
 const api={labels,today,state,filter,reminder,validateOverride};if(typeof module!=='undefined')module.exports=api;else root.FMZBillingPlanningModel=api;
})(typeof window==='undefined'?globalThis:window);

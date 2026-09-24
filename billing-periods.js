/* Calendar dates only: never local-time milliseconds or an average number of weeks. */
(function(root){
 'use strict';
 const catalog=[
  ['pt-basis','Personal training Basis',20000,4],['pt-progressie','Personal training Progressie',38000,8],['pt-transformatie','Personal training Transformatie',48000,12],
  ['online-coaching','Online coaching',20000,0],['duo-basis','Duo Basis',26000,4],['duo-progressie','Duo Progressie',52000,8],['duo-transformatie','Duo Transformatie',78000,12],
  ['single-session','Losse training',5500,1,'none'],['ten-sessions','Strippenkaart 10 trainingen',52000,10,'none']
 ].map(([id,label,cents,sessions,cycle])=>({id,label,cents,sessions,recurring:cycle!=='none'}));
 function date(s){if(!/^\d{4}-\d\d-\d\d$/.test(s||''))throw Error('Kies een geldige datum.');const d=new Date(s+'T12:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s)throw Error('Kies een geldige datum.');return d;}
 const iso=d=>d.toISOString().slice(0,10),add=(s,n)=>{const d=date(s);d.setUTCDate(d.getUTCDate()+n);return iso(d);};
 const label=c=>({calendar_month:'per kalendermaand',four_weeks:'per 4 weken',none:'eenmalig'}[c]||'Betaalperiode nog vastleggen');
 const display=s=>s.split('-').reverse().join('-');
 function active(versions,client,at){date(at);return versions.filter(v=>v.client_id===client&&v.effective_from<=at).sort((a,b)=>a.effective_from.localeCompare(b.effective_from)||a.version-b.version).at(-1)||null;}
 function period(v,at){date(at);if(at<v.effective_from)throw Error('De overeenkomst is op deze datum nog niet ingegaan.');let start,end;
  if(v.cycle==='four_weeks'){const n=Math.floor((date(at)-date(v.effective_from))/86400000/28);start=add(v.effective_from,n*28);end=add(start,27);}
  else if(v.cycle==='calendar_month'){start=at.slice(0,7)+'-01';const next=date(start);next.setUTCMonth(next.getUTCMonth()+1);end=add(iso(next),-1);}
  else if(v.cycle==='none'){start=v.effective_from;end=v.effective_from;}
  else throw Error('Betaalperiode ontbreekt.');
  return {start,end,invoiceDate:end,nextStart:v.cycle==='none'?null:add(end,1)};
 }
 function text(v,p){return v.cycle==='calendar_month'?`${v.package_label} - kalendermaand ${new Intl.DateTimeFormat('nl-NL',{month:'long',year:'numeric',timeZone:'UTC'}).format(date(p.start))}`:v.cycle==='four_weeks'?`${v.package_label} - periode van ${display(p.start)} t/m ${display(p.end)} - per 4 weken`:v.package_label;}
 function metadata(v,p){return {agreementVersionId:v.id,agreementVersion:v.version,clientId:v.client_id,packageId:v.package_id,packageLabel:v.package_label,cycle:v.cycle,effectiveFrom:v.effective_from,start:p.start,end:p.end,invoiceDate:p.invoiceDate,amountCents:v.amount_cents};}
 const api={catalog,date,add,label,display,active,period,text,metadata};if(typeof module!=='undefined')module.exports=api;else root.FMZBillingPeriods=api;
})(typeof window==='undefined'?globalThis:window);

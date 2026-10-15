/* Calendar arithmetic is independent of the device timezone and of billing periods. */
(function(root){
 'use strict';
 const zone='Europe/Amsterdam',pad=n=>String(n).padStart(2,'0');
 function parts(now=new Date()){const p=new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);return Object.fromEntries(p.map(x=>[x.type,x.value]));}
 function today(now){const p=parts(now);return `${p.year}-${p.month}-${p.day}`;}
 function clock(now){const p=parts(now);return `${p.hour}:${p.minute}`;}
 function addDays(value,n){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
 function addMonths(value,n){const d=new Date(value.slice(0,7)+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10);}
 function week(value){const day=new Date(value+'T12:00:00Z').getUTCDay();return addDays(value,-((day+6)%7));}
 function minutes(t){return /^([01]\d|2[0-3]):[0-5]\d$/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3)):null;}
 function time(n){return `${pad(Math.floor(n/60))}:${pad(n%60)}`;}
 function duration(a){const n=Number(a.duration),end=minutes(a.endTime),start=minutes(a.time);return n>0?n:end!==null&&start!==null&&end>start?end-start:60;}
 function end(a){const m=minutes(a.time);return m===null?'':time(m+duration(a));}
 const labels={attended:'Geweest',planned:'Gepland',cancelled:'Geannuleerd',no_show:'Niet verschenen',unknown:'Aanwezigheid onbekend'};
 function status(a,now=new Date(),participant){const raw=participant?.status??a.status;if(['attended','completed'].includes(raw))return 'attended';if(['cancelled','canceled'].includes(raw))return 'cancelled';if(['no_show','no-show'].includes(raw))return 'no_show';return a.date>today(now)||(a.date===today(now)&&a.time>=clock(now))?'planned':'unknown';}
 function monthly(items,cid,month,now){const groups=Object.fromEntries(Object.keys(labels).map(k=>[k,[]])),seen=new Set();for(const a of items){const p=a.participants?.find(p=>p.id===cid);if(!p&&a.clientId!==cid)continue;const key=a.key||a.occurrenceId||`${cid}:${a.id}`;if(seen.has(key)||a.date?.slice(0,7)!==month)continue;seen.add(key);groups[status(a,now,p)].push(a);}return groups;}
 function overlaps(a,items){const start=minutes(a.time),finish=start+duration(a);return items.filter(b=>b.key!==a.key&&b.date===a.date&&!['cancelled','no_show'].includes(b.status)&&minutes(b.time)!==null&&start<minutes(b.time)+duration(b)&&finish>minutes(b.time));}
 function range(view,date){const start=view==='week'?week(date):view==='month'||view==='list'?date.slice(0,7)+'-01':date;const end=view==='week'?addDays(start,7):view==='month'||view==='list'?addMonths(start,1):addDays(start,1);return{start,end};}
 function label(date,options={day:'numeric',month:'long',year:'numeric'}){return new Intl.DateTimeFormat('nl-NL',{timeZone:'UTC',...options}).format(new Date(date+'T12:00:00Z'));}
 const api={zone,today,clock,addDays,addMonths,week,minutes,time,duration,end,labels,status,monthly,overlaps,range,label};root.FMZAgendaModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

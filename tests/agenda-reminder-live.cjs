/* Actual server-time reminder test, synthetic accounts only, no push subscription or mail. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const dir=process.env.FMZ_AGENDA_PRIVATE;assert(dir);const m=JSON.parse(fs.readFileSync(path.join(dir,'agenda-synthetic.json'),'utf8'));const keys=JSON.parse(fs.readFileSync('C:/Users/Fitme/.codex/backups/appfmz-20260908/api-keys.json','utf8')),anon=keys.find(k=>k.name==='anon').api_key,service=keys.find(k=>k.name==='service_role').api_key,base='https://hgoygcviutmynaihcvpd.supabase.co',tokens={};
 async function api(route,body,token=anon){const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{apikey:token===service?service:anon,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});assert(r.ok,'HTTP '+r.status);const raw=await r.text();return raw?JSON.parse(raw):null;}
 const rpc=(role,name,payload={})=>api('/rest/v1/rpc/'+name,payload,tokens[role]);
 const command=(role,action,payload)=>rpc(role,'fmz_agenda_command',{action,payload,request_id:crypto.randomUUID()});
 try{for(const role of ['trainer','a']){const a=m.accounts[role];assert.equal(a.email,m.marker+'-'+role+'@example.test');const u=await api('/auth/v1/admin/users/'+a.id,undefined,service);assert.equal(u.user_metadata.fmz_release,m.marker);tokens[role]=(await api('/auth/v1/token?grant_type=password',{email:a.email,password:a.password})).access_token;}
  await command('a','preferences',{reminder_minutes:15,changes:true,push:false});
  const start=new Date(Date.now()+17*60000);start.setUTCSeconds(0,0);const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(start).map(p=>[p.type,p.value]));
  const created=await command('trainer','create',{participants:[{id:'a'}],appointment:{date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`,duration:45,type:'Synthetische echte cronherinnering'}});
  const due=new Date(start-15*60000);console.log('Synthetic reminder due at '+due.toISOString()+'. No push device enrolled.');let found;
  for(let i=0;i<12;i++){const data=await rpc('a','fmz_agenda_read');found=data.inbox.find(e=>e.kind==='reminder'&&e.appointment_key===created.key);if(found)break;await new Promise(r=>setTimeout(r,20000));}
  assert(found,'Actual cron reminder not visible within four minutes');const report={at:new Date().toISOString(),project:'hgoygcviutmynaihcvpd',syntheticOnly:true,noPushSubscription:true,scheduledDue:due.toISOString(),serverCronMadeReminderVisible:true,appointmentIdentityMatched:true,noBrowserTimerOrManualTick:true};fs.writeFileSync('docs/examples/agenda-20261015/production-reminder-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{for(const token of Object.values(tokens))await api('/auth/v1/logout?scope=local',{},token).catch(()=>{});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});

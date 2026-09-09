// Compare original rows to the encrypted restore point without logging customer contents.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
 const dir='C:/Users/Fitme/.codex/backups/appfmz-autosave-20260909',keys=JSON.parse(fs.readFileSync(dir+'/backup-keys.json')),raw=JSON.parse(fs.readFileSync(dir+'/backup.encrypted.json','utf8').replace(/^\uFEFF/,'')),p=Array.isArray(raw)?raw[0]:raw.rows?.[0]||raw.result?.[0]||raw.data?.[0];
 const cipher=Buffer.from(p.ciphertext,'hex'),iv=Buffer.from(p.iv,'hex');assert(crypto.timingSafeEqual(crypto.createHmac('sha256',Buffer.from(keys.mac,'hex')).update(Buffer.concat([iv,cipher])).digest(),Buffer.from(p.hmac,'hex')));
 const dec=crypto.createDecipheriv('aes-256-cbc',Buffer.from(keys.enc,'hex'),iv),backup=JSON.parse(Buffer.concat([dec.update(cipher),dec.final()]));
 const api=JSON.parse(fs.readFileSync('C:/Users/Fitme/.codex/backups/appfmz-20260908/api-keys.json','utf8').replace(/^\uFEFF/,'')),service=api.find(k=>k.name==='service_role').api_key;
 const normalize=x=>Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,normalize(x[k])])):typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d.*(?:Z|[+-]\d\d:\d\d)$/.test(x)?new Date(x).toISOString():x;
 const results={};let changed=false;
 for(const [table,key,id] of [['profiles','profiles','id'],['coach_workspaces','workspaces','trainer_id'],['client_invites','invites','id']]){
  const r=await fetch('https://hgoygcviutmynaihcvpd.supabase.co/rest/v1/'+table+'?select=*',{headers:{apikey:service,Authorization:'Bearer '+service},signal:AbortSignal.timeout(20000)});assert(r.ok);const rows=await r.json();let differences=[];
  for(const [i,b] of backup[key].entries()){const a=rows.find(r=>r[id]===b[id]);if(!a){differences.push({row:i,missing:true});continue;}const columns=Object.keys(b).filter(k=>JSON.stringify(normalize(b[k]))!==JSON.stringify(normalize(a[k])));if(columns.length)differences.push({row:i,columns});}
  results[table]={originalRows:backup[key].length,unchanged:differences.length===0,differences};changed ||= differences.length>0;
 }
 fs.writeFileSync(dir+'/customer-preservation.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));assert(!changed,'Original rows differ from restore point; review without overwriting newer data');
})().catch(e=>{console.error(e.message);process.exitCode=1});

/* Only the newly created, marker-verified synthetic owner may use this harness. */
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
async function connect(){
 const dir='C:/Users/Fitme/.codex/backups/appfmz-20260908',m=JSON.parse(fs.readFileSync(dir+'/synthetic-accounts.json')),keys=JSON.parse(fs.readFileSync(dir+'/api-keys.json')),anon=keys.find(k=>k.name==='anon').api_key,base='https://hgoygcviutmynaihcvpd.supabase.co';
 assert(m.marker.startsWith('fmz-release-'));const tokens={};
 for(const role of ['trainer','a']){const a=m.accounts[role];assert(!a.deleted&&a.email===m.marker+'-'+role+'@example.test');const r=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:a.email,password:a.password})});assert.equal(r.status,200);const data=await r.json();assert.equal(data.user.user_metadata.fmz_release,m.marker);tokens[role]=data.access_token;}
 async function rpc(name,params,role='trainer'){const started=performance.now(),r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',signal:AbortSignal.timeout(15000),headers:{apikey:anon,Authorization:'Bearer '+tokens[role],'Content-Type':'application/json'},body:JSON.stringify(params)}),data=await r.json();if(!r.ok){if(data.code==='PT409'){assert.equal(r.status,409);assert(performance.now()-started<5000);}throw Object.assign(Error(data.message),{code:data.code,status:r.status});}return data;}
 const cmd=(action,payload={},request_id=crypto.randomUUID())=>rpc('fmz_accounting_command',{action,payload,request_id}),snap=()=>rpc('fmz_accounting_read',{});
 const s=await snap();assert.equal(s.organization.owner_id,m.accounts.trainer.id);assert.notEqual(s.organization.owner_id,"1a499b4d-c875-4995-b3cd-976fb9c7558b");
 async function storeFile(){const bytes=Buffer.from('date;amount\n2026-09-11;1,23\n'),f=await cmd('file_reserve',{id:crypto.randomUUID(),data:{kind:'bank_csv',original_name:'synthetic-hotfix.csv',mime:'text/csv',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}});assert(f.path.startsWith(s.organization.id+'/'));const r=await fetch(base+'/storage/v1/object/fmz-finance/'+f.path,{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+tokens.trainer,'Content-Type':'text/csv','x-upsert':'false'},body:bytes});assert.equal(r.status,200);await r.arrayBuffer();await cmd('file_finish',{id:f.id});return f;}
 const deny=payload=>rpc('fmz_accounting_command',{action:'invoice_cancel',payload,request_id:crypto.randomUUID()},'a');
 async function close(){for(const token of Object.values(tokens)){const r=await fetch(base+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+token}});await r.arrayBuffer();}}
 return {cmd,snap,storeFile,deny,close};
}
module.exports={connect};

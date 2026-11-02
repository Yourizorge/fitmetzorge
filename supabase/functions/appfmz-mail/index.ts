/* Server-only mail worker. No mailbox secret, service role or private attachment reaches public clients. */
import {deliver} from './transport.mjs';
import {adapters} from './protocol.mjs';
import webpush from 'npm:web-push@3.6.7';
const base=Deno.env.get('SUPABASE_URL')||'';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
async function rpc(action:string,payload:unknown={},push=false){
 const r=await fetch(base+'/rest/v1/rpc/'+(push?'fmz_communication_push_worker':'fmz_communication_worker'),{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Communication state unavailable');return r.json();
}
Deno.serve(async(req:Request)=>{
 const token=Deno.env.get('APPFMZ_MAIL_WORKER_TOKEN');if(req.method!=='POST'||!token||req.headers.get('authorization')!=='Bearer '+token)return new Response('Unauthorized',{status:401});
 try{const publicKey=Deno.env.get('APPFMZ_VAPID_PUBLIC_KEY'),privateKey=Deno.env.get('APPFMZ_VAPID_PRIVATE_KEY');if(publicKey&&privateKey){const reminders=await rpc('claim',{},true);for(const j of reminders){let code=0;try{if(!/^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|notify\.windows\.com|push\.services\.mozilla\.com|fcm\.googleapis\.com)\//.test(j.subscription?.endpoint||''))continue;if(!(await rpc('check',{id:j.id,lease:j.lease},true)).ok)continue;const v=webpush.generateRequestDetails(j.subscription,JSON.stringify({id:j.id,eventId:j.eventId,taskId:j.taskId,kind:j.kind,period:j.period,expiresAt:j.expiresAt}),{vapidDetails:{subject:'https://appfmz.nl',publicKey,privateKey},TTL:3600,topic:j.id.replaceAll('-',''),urgency:'normal'});const r=await fetch(v.endpoint,{method:v.method,headers:v.headers,body:v.body,redirect:'error',signal:AbortSignal.timeout(8000)});code=r.status;}catch{}finally{await rpc('finish',{id:j.id,lease:j.lease,code},true);}}}}catch{return new Response('Reminder state requires review',{status:500});}
 if(Deno.env.get('APPFMZ_MAIL_ENABLED')!=='true')return Response.json({enabled:false,claimed:0});
 const from=Deno.env.get('APPFMZ_MAILBOX_ADDRESS')||'',password=Deno.env.get('APPFMZ_MAILBOX_PASSWORD')||'';
 if(!from||!password)return new Response('Mailbox not configured',{status:503});
 try{
  const transport=adapters({from,password,sentFolder:Deno.env.get('APPFMZ_MAIL_SENT_FOLDER')||undefined},(options:object)=>Deno.connectTls(options as Deno.ConnectTlsOptions));
  const jobs=await rpc('claim');let processed=0;
  for(const job of jobs){
   if(job.sender!==from){await rpc('finish',{id:job.id,lease:job.lease,status:'permanent_failure',code:'sender_configuration_changed'});continue;}
   const store={async download(a:any){if(!['fmz-finance','fmz-members'].includes(a.bucket)||!a.path.startsWith(a.ownerPrefix+'/'))throw Error('Invalid private attachment');const r=await fetch(base+'/storage/v1/object/authenticated/'+a.bucket+'/'+a.path.split('/').map(encodeURIComponent).join('/'),{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Attachment unavailable');return new Uint8Array(await r.arrayBuffer());},check:async(j:any)=>(await rpc('check',{id:j.id,lease:j.lease})).ok,accepted:async(j:any,acceptance:any)=>{const r=await rpc('accepted',{id:j.id,lease:j.lease,acceptance});if(!r.ok)throw Error('Acceptance not persisted');},finish:async(j:any,outcome:any)=>{const r=await rpc('finish',{id:j.id,lease:j.lease,...outcome});if(!r.ok)throw Error('Outcome not persisted');}};
   await deliver(job,{...transport,store,sha256:async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('')});processed++;
  }
  return Response.json({claimed:jobs.length,processed});
 }catch{return new Response('Communication worker requires review',{status:500});}
});

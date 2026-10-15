import webpush from 'npm:web-push@3.6.7';
// Called only by the APPFMZ cron dispatcher. The custom secret is separate from user JWTs.
const endpointAllowed=(value:string)=>/^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|notify\.windows\.com|push\.services\.mozilla\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)\//.test(value);
async function rpc(action:string,payload:unknown={}){
 const response=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/fmz_agenda_worker',{method:'POST',headers:{apikey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,Authorization:'Bearer '+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),'Content-Type':'application/json'},body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Worker database request failed: '+response.status);return await response.json();
}
Deno.serve(async req=>{
 const secret=Deno.env.get('APPFMZ_AGENDA_WORKER_TOKEN');
 if(req.method!=='POST'||!secret||req.headers.get('authorization')!=='Bearer '+secret)return new Response('Unauthorized',{status:401});
 try{
  const publicKey=Deno.env.get('APPFMZ_VAPID_PUBLIC_KEY'),privateKey=Deno.env.get('APPFMZ_VAPID_PRIVATE_KEY');if(!publicKey||!privateKey)return new Response('Push unavailable',{status:503});
  const jobs=await rpc('claim');let accepted=0,failed=0;
  // Four concurrent bounded sends keep the cron batch below its lease duration.
  for(let i=0;i<jobs.length;i+=4)await Promise.all(jobs.slice(i,i+4).map(async(job:any)=>{
   let code=0;try{
    if(!endpointAllowed(job.subscription?.endpoint||'')){code=400;return;}
    if(!(await rpc('check',{id:job.id,lease:job.lease})).ok){code=400;return;}
    const details=webpush.generateRequestDetails(job.subscription,JSON.stringify({id:job.id,eventId:job.eventId,kind:job.kind,expiresAt:job.expiresAt}),{vapidDetails:{subject:'https://appfmz.nl',publicKey,privateKey},TTL:Math.max(1,Math.min(3600,Math.floor((Date.parse(job.expiresAt)-Date.now())/1000))),topic:job.id.replaceAll('-',''),urgency:'normal'});
    const response=await fetch(details.endpoint,{method:details.method,headers:details.headers,body:details.body,redirect:'error',signal:AbortSignal.timeout(8000)});code=response.status;if(response.ok)accepted++;else failed++;
   }catch{failed++;}finally{await rpc('finish',{id:job.id,lease:job.lease,code});}
  }));
  return Response.json({claimed:jobs.length,accepted,failed});
 }catch{return new Response('Reminder processing failed',{status:500});}
});

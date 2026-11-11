import * as PDFLib from 'npm:pdf-lib@1.17.1';
import './members-documents.js';
import './verify-image.js';
const headers={'Access-Control-Allow-Origin':'https://appfmz.nl','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const digest=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return reply({ok:true});if(request.method!=='POST')return reply({error:'Methode niet toegestaan'},405);
 try{
  const base=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,authorization=request.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer '))return reply({error:'Meld je opnieuw aan'},401);
  const userHeaders={apikey:anon,authorization,'Content-Type':'application/json'},auth=await fetch(base+'/auth/v1/user',{headers:userHeaders});if(!auth.ok)return reply({error:'Meld je opnieuw aan'},401);
  const input=await request.json();if(!/^[a-f0-9-]{36}$/.test(input.id||''))return reply({error:'Ongeldig bestand'},400);
  const get=await fetch(base+'/rest/v1/rpc/fmz_members_read',{method:'POST',headers:userHeaders,body:JSON.stringify({action:input.action==='delete_draft'?'cleanup_asset':'asset',payload:{id:input.id}})});
  if(!get.ok)return reply({error:'Bestand niet toegankelijk'},403);const asset=await get.json();if(!asset)return reply({error:'Bestand niet toegankelijk'},403);
  const adminHeaders={apikey:service,authorization:'Bearer '+service,'Content-Type':'application/json'};
  if(input.action==='delete_draft'){
   if(asset.kind!=='agreement'||!['retired','deleted'].includes(asset.status))return reply({error:'Alleen een verwijderd ongebruikt conceptbestand mag worden opgeruimd'},409);
   const removed=await fetch(base+'/storage/v1/object/fmz-members',{method:'DELETE',headers:adminHeaders,body:JSON.stringify({prefixes:[asset.path]})});if(!removed.ok)return reply({error:'Concept verwijderd; bestandsopruiming nog niet bevestigd'},409);
   const completed=await fetch(base+'/rest/v1/rpc/fmz_member_draft_asset_deleted',{method:'POST',headers:adminHeaders,body:JSON.stringify({asset_id:asset.id})});if(!completed.ok)return reply({error:'Conceptopruiming nog niet bevestigd'},409);return reply({ok:true});
  }
  if(input.action==='delete_photo'){
   if(asset.kind!=='photo'||!['retired','deleted'].includes(asset.status))return reply({error:'Alleen een ingetrokken profielfoto mag worden verwijderd'},409);
   const removed=await fetch(base+'/storage/v1/object/fmz-members',{method:'DELETE',headers:adminHeaders,body:JSON.stringify({prefixes:[asset.path]})});if(!removed.ok)return reply({error:'Foto is uit profiel verwijderd; opslagopruiming nog niet bevestigd'},409);
   const completed=await fetch(base+'/rest/v1/rpc/fmz_member_photo_deleted',{method:'POST',headers:adminHeaders,body:JSON.stringify({asset_id:asset.id})});if(!completed.ok)return reply({error:'Opslagopruiming nog niet bevestigd'},409);return reply({ok:true});
  }
  const object=await fetch(base+'/storage/v1/object/authenticated/fmz-members/'+asset.path,{headers:adminHeaders});if(!object.ok)return reply({error:'Upload nog niet compleet; probeer opnieuw'},409);
  if(Number(object.headers.get('content-length')||0)>12000000)return reply({error:'Bestand te groot'},400);const bytes=new Uint8Array(await object.arrayBuffer());
  if(bytes.length>12000000||bytes.length!==asset.bytes||await digest(bytes)!==asset.sha256)return reply({error:'Bestandsinhoud wijkt af; upload opnieuw'},409);
  if(asset.kind==='agreement'){
   const current=await fetch(base+'/rest/v1/rpc/fmz_members_read',{method:'POST',headers:userHeaders,body:JSON.stringify({action:'document_snapshot',payload:{id:asset.draft_id}})});if(!current.ok)return reply({error:'Ondertekende versie niet toegankelijk'},403);const snapshot=await current.json();if(!snapshot)return reply({error:'Controleer de ondertekende versie opnieuw'},409);
   const expected=await (globalThis as any).FMZMemberDocuments.pdf(snapshot,PDFLib);
   if(await digest(expected)!==asset.sha256)return reply({error:'PDF komt niet overeen met de vastgelegde overeenkomst'},409);
   const pdf=await PDFLib.PDFDocument.load(bytes,{ignoreEncryption:false});if(pdf.getPageCount()<1)return reply({error:'Ongeldige PDF'},400);
  }else{
   await (globalThis as any).FMZMemberVerifyImage(bytes,asset.mime,PDFLib);
  }
  const confirmed=await fetch(base+'/rest/v1/rpc/fmz_member_verify_asset',{method:'POST',headers:adminHeaders,body:JSON.stringify({asset_id:asset.id,actual_sha256:asset.sha256,actual_bytes:bytes.length})});if(!confirmed.ok)return reply({error:'Bestandsbevestiging mislukt; probeer opnieuw'},409);return reply({ok:true,asset:await confirmed.json()});
 }catch{return reply({error:'Bestandscontrole tijdelijk niet beschikbaar; probeer opnieuw'},503);}
});

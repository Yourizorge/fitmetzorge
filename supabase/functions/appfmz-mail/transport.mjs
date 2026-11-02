/* Transport orchestration is independent of Deno and exercised with synthetic adapters. */
export async function deliver(job, adapters){
 const {store,smtp,imap,sha256}=adapters;
 // Do not treat Message-ID as SMTP idempotency: an ambiguous DATA result is held.
 if(job.status==='delivery_unknown')return {status:'delivery_unknown'};
 let pdf;try{pdf=await store.download(job.attachment);}catch{await store.finish(job,{status:job.acceptance?'archive_pending':'temporary_failure',code:'attachment_unavailable'});return {status:job.acceptance?'archive_pending':'temporary_failure'};}
 if(pdf.length!==job.attachment.bytes||await sha256(pdf)!==job.attachment.sha256||new TextDecoder().decode(pdf.slice(0,5))!=='%PDF-'){await store.finish(job,{status:job.acceptance?'archive_pending':'permanent_failure',code:'attachment_verification_failed'});return {status:job.acceptance?'archive_pending':'permanent_failure'};}
 if(!(await store.check(job))){await store.finish(job,{status:job.acceptance?'archive_pending':'permanent_failure',code:'approval_changed'});return {status:job.acceptance?'archive_pending':'permanent_failure'};}
 let acceptance=job.acceptance;
 if(!acceptance){
  try{acceptance=await smtp.send(job,pdf);}
  catch(error){const status=error.ambiguous?'delivery_unknown':error.permanent?'permanent_failure':'temporary_failure';await store.finish(job,{status,code:error.safeCode||'transport_failure'});return {status};}
  // Persist accepted outcome before any mailbox append. If persistence fails the expired
  // lease becomes delivery_unknown; it must never repeat SMTP automatically.
  await store.accepted(job,acceptance);
 }
 try{
  const existing=await imap.find(job.messageId);
  const archive=existing||await imap.append({...job,acceptance},pdf);
  await store.finish(job,{status:'sent',acceptance,archive});return {status:'sent'};
 }catch{await store.finish(job,{status:'archive_pending',acceptance,code:'sent_copy_failed'});return {status:'archive_pending'};}
}
export function allowedAddress(value){return typeof value==='string'&&value.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);}
export function safeHeader(value){if(typeof value!=='string'||/[\r\n\0]/.test(value))throw Error('Invalid header');return value;}

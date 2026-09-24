/* Read-only proof. Decrypt in memory; never restore real customer content in a test database. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const dir=process.env.FMZ_BILLING_PRIVATE;if(!dir)throw Error('Private checkpoint path required');
const proof=file=>JSON.parse(fs.readFileSync(path.join(dir,file),'utf8').replace(/^\uFEFF/,'')).rows[0].proof;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const before=proof('baseline.json');
 const platform=require('../docs/APPFMZ_BILLING_STORAGE_PLATFORM_20260924.json'),expected=structuredClone(before.tables);
 assert.equal(expected['storage.buckets'].sha256,platform.originalFieldsSha256);assert(platform.allOriginalFieldsIdentical&&platform.newFieldsBothNull);assert.equal(expected['storage.buckets'].rows,platform.rows);
 expected['storage.buckets'].sha256=platform.fullRowAfterPlatformAdditionSha256;
 if(process.argv[2]==='before'){
  const current=proof('before-apply.json');assert.deepEqual(current.tables,expected);assert.deepEqual(current.functions,before.functions);console.log('PASS 16 exact table hashes and all old Storage bucket fields; only two new NULL platform columns, before this release. All existing functions identical.');return;
 }
 if(process.argv[2]==='prepare'){
  let sql=fs.readFileSync('tests/billing-preservation-query.sql','utf8');assert(Number.isSafeInteger(before.auditMax));
  sql=sql.replace('from fmz_accounting.audit t)','from fmz_accounting.audit t where id<='+before.auditMax+')');
  fs.writeFileSync(path.join(dir,'after-query.sql'),sql);console.log('Read-only proof query prepared for all prior rows, including original audit history.');return;
 }
 const after=proof('after.json'),tables={};for(const [name,value]of Object.entries(expected)){assert.deepEqual(after.tables[name],value,name+' changed');tables[name]={unchangedByRelease:true,sha256:value.sha256};}
 const changed=[];for(const f of before.functions){const n=after.functions.find(x=>x.signature===f.signature);assert(n,'Missing old function '+f.signature);if(f.hash!==n.hash)changed.push(f.signature);}assert.deepEqual(changed,['fmz_accounting.snapshot()']);
 process.env.FMZ_COMPLETE_BACKUP_DIR=dir;const backup=require('./release-backup-complete.cjs').decrypt();assert.equal(backup.project,'hgoygcviutmynaihcvpd');
 const keys=JSON.parse(fs.readFileSync(process.env.FMZ_BILLING_KEYS||'C:/Users/Fitme/.codex/backups/appfmz-20260908/api-keys.json')),service=keys.find(k=>k.name==='service_role').api_key;
 for(const o of backup.storage_objects){const r=await fetch('https://hgoygcviutmynaihcvpd.supabase.co/storage/v1/object/'+encodeURIComponent(o.bucket_id)+'/'+o.name.split('/').map(encodeURIComponent).join('/'),{headers:{apikey:service,Authorization:'Bearer '+service},signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer()),f=backup.tables['fmz_accounting.files'].find(f=>f.path===o.name);assert(f);assert.equal(hash(bytes),f.sha256);assert.equal(bytes.length,Number(f.bytes));}
 const result={at:new Date().toISOString(),baselineAt:before.at,project:backup.project,allExistingDataUnchanged:true,tables,storagePlatformAddition:platform,originalAuditUpTo:before.auditMax,onlyChangedExistingFunction:changed,newFunctions:after.functions.filter(f=>!before.functions.some(x=>x.signature===f.signature)),oldPrivatePDFsByteIdentical:backup.storage_objects.length,realDataRestoredForTesting:false};
 fs.writeFileSync('docs/APPFMZ_BILLING_PRESERVATION_20260924.json',JSON.stringify(result,null,2)+'\n');console.log('PASS original table data, audit and private PDF bytes; documented platform columns retained; old functions unchanged except additive snapshot.');
})().catch(e=>{console.error(e.message);process.exitCode=1});

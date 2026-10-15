/* Read-only, aggregate comparison after own synthetic cleanup. Private file bytes stay in memory. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
 const dir=process.env.FMZ_COMPLETE_BACKUP_DIR;assert(dir);const read=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8').replace(/^\uFEFF/,''));const before=read('before-apply.json').rows[0].proof,after=read('after.json').rows[0].proof;
 assert.equal(before.project,'hgoygcviutmynaihcvpd');assert.equal(after.project,before.project);
 const report={at:new Date().toISOString(),project:before.project,before:before.at,after:after.at,tables:Object.keys(before.tables).map(table=>({table,unchanged:JSON.stringify(before.tables[table])===JSON.stringify(after.tables[table])})),originalFunctions:before.functions.length,originalFunctionsUnchanged:before.functions.every(f=>after.functions.some(a=>a.signature===f.signature&&a.hash===f.hash)),privateStorageFiles:0,privateStorageBytesUnchanged:true};
 const {decrypt}=require('./release-backup-complete.cjs'),backup=decrypt(),keys=read('backup-keys.json'),key=crypto.hkdfSync('sha256',Buffer.from(keys.enc,'hex'),Buffer.alloc(0),Buffer.from('appfmz-storage-backup-v1'),32);
 const credentials=JSON.parse(fs.readFileSync('C:/Users/Fitme/.codex/backups/appfmz-20260908/api-keys.json','utf8')),service=credentials.find(k=>k.name==='service_role').api_key;
 for(const object of backup.storage_objects){
  const identity=object.bucket_id+'/'+object.name,filename=crypto.createHash('sha256').update(identity).digest('hex')+'.encrypted',encrypted=fs.readFileSync(path.join(dir,'storage',filename));
  const decoder=crypto.createDecipheriv('aes-256-gcm',key,encrypted.subarray(0,12));decoder.setAAD(Buffer.from(identity));decoder.setAuthTag(encrypted.subarray(12,28));const original=Buffer.concat([decoder.update(encrypted.subarray(28)),decoder.final()]);
  const url='https://hgoygcviutmynaihcvpd.supabase.co/storage/v1/object/'+encodeURIComponent(object.bucket_id)+'/'+object.name.split('/').map(encodeURIComponent).join('/');const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{apikey:service,Authorization:'Bearer '+service}});assert.equal(r.status,200);const current=Buffer.from(await r.arrayBuffer());assert(current.equals(original),'Existing private file changed');report.privateStorageFiles++;
 }
 fs.writeFileSync('docs/examples/agenda-20261015/data-preservation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));assert(report.tables.every(t=>t.unchanged),'Existing table changed: inspect separately; never restore over live activity');assert(report.originalFunctionsUnchanged);
})().catch(e=>{console.error(e.message);process.exitCode=1;});

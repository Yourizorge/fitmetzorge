const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm'),{PGlite}=require('@electric-sql/pglite'),PDFLib=require('pdf-lib'),Adapter=require('../owner-test/database.js'),images=require('./members-images.cjs');

test('owner test: loaded image hook rejects MIME mismatch; cleanup manifest covers transport drafts and local histories',{timeout:90000},async()=>{
 const read=p=>fs.readFileSync(require.resolve('../'+p),'utf8');
 assert.match(read('owner-test/boot.js'),/script\(r\.verifyImage\)/);
 assert.match(read('tests/build-owner-test.cjs'),/verifyImage:read\('supabase\/functions\/member-assets\/verify-image\.js'\)/);
 vm.runInThisContext(read('supabase/functions/member-assets/verify-image.js'));
 let stored,db;const seed=new Blob([fs.readFileSync(require.resolve('../owner-test/seed.bin'))]);
 const options={PGlite,PDFLib,seed,persist:async value=>{stored=structuredClone(value);},remove:async run=>{assert.equal(stored.runId,run);stored=null;}};
 const call=async(name,params)=>{const r=await db.sdk.rpc(name,params);assert.equal(r.error,null,r.error?.message);return r.data;};
 try{
  db=await Adapter.create(options);
  const initial=await db.manifest();for(const key of ['preliminary','files','communicationDocuments','simulationRecords'])assert.deepEqual(initial[key],[]);
  for(const [mime,valid] of [['image/jpeg',false],['image/png',true]]){
   const member=(await call('fmz_members_read',{action:'profile',payload:{client_id:'TEST-NOOR'}})).member;
   const asset=await call('fmz_members_command',{action:'reserve_photo',request_id:crypto.randomUUID(),payload:{client_id:'TEST-NOOR',expected_version:member.version,id:crypto.randomUUID(),mime,bytes:images.png.length,sha256:crypto.createHash('sha256').update(images.png).digest('hex')}});
   assert.equal((await db.sdk.storage.from('fmz-members').upload(asset.path,images.png,{contentType:mime})).error,null);
   const checked=await db.sdk.functions.invoke('member-assets',{body:{id:asset.id}});
   if(valid)assert.equal(checked.data.ok,true);else assert.ok(checked.error,'PNG mislabeled as JPEG must fail actual decoder');
   const reread=await call('fmz_members_read',{action:'asset',payload:{id:asset.id}});assert.equal(reread.status,valid?'ready':'reserved');
  }
  const before=await db.manifest(),checkpoint=await db.checkpoint();await db.close();
  checkpoint.simulation.sent=[{messageId:'TEST-MAIL',subject:'Fictieve testmail',status:'sent'}];checkpoint.simulation.history=[{action:'mail-send',messageId:'TEST-MAIL'}];checkpoint.simulation.reminders=[{taskId:'TEST-TASK',kind:'billing_due'}];
  db=await Adapter.create({...options,restore:checkpoint});const manifest=await db.manifest();assert.equal(manifest.simulationRecords.length,3);assert.notEqual(manifest.hash,before.hash);assert.equal(manifest.blobs.length,2);
  const result=await db.reset(manifest);assert.equal(stored,null);for(const key of ['preliminary','files','communicationDocuments','simulationRecords'])assert.deepEqual(result.after[key],[]);assert.match(result.after.verification,/not a SQL query/);db=null;
 }finally{if(db&&!db.getState().closed)await db.close();delete globalThis.FMZMemberVerifyImage;}
});

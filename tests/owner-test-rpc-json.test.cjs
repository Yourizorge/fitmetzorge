const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{PGlite}=require('@electric-sql/pglite'),Adapter=require('../owner-test/database.js');
test('owner RPC uses PostgREST JSON dates for agreement and blocked planning and preserves downloaded Blob',{timeout:90000},async()=>{
 let db;const call=async(name,params)=>{const r=await db.sdk.rpc(name,params);assert.equal(r.error,null,r.error?.message);return r.data;},command=(name,action,payload)=>call(name,{action,payload,request_id:crypto.randomUUID()});
 try{
  db=await Adapter.create({PGlite,seed:new Blob([fs.readFileSync(require.resolve('../owner-test/seed.bin'))]),persist:async()=>{}});
  const snapshot=await call('fmz_accounting_read',{}),v=snapshot.agreements.find(x=>x.client_id==='TEST-NOOR');
  assert.equal(typeof v.effective_from,'string');assert.match(v.effective_from,/^\d{4}-\d{2}-\d{2}/);assert.equal(typeof v.created_at,'string');
  for(const name of ['fmz_billing_planning_command','fmz_billing_planning_read','fmz_communication_command'])assert.ok((await db.sdk.rpc(name,{action:'refresh',payload:{},request_id:crypto.randomUUID()})).error,'Removed automation must be blocked');
  const member=(await call('fmz_members_read',{action:'profile',payload:{client_id:'TEST-NOOR'}})).member,bytes=Buffer.from('synthetic image fixture bytes'),asset=await command('fmz_members_command','reserve_photo',{client_id:'TEST-NOOR',expected_version:member.version,id:crypto.randomUUID(),mime:'image/png',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  const uploaded=await db.sdk.storage.from('fmz-members').upload(asset.path,bytes,{contentType:'image/png'});assert.equal(uploaded.error,null);const downloaded=await db.sdk.storage.from('fmz-members').download(asset.path);assert.equal(downloaded.error,null);assert.ok(downloaded.data instanceof Blob);assert.equal(downloaded.data.type,'image/png');assert.deepEqual(Buffer.from(await downloaded.data.arrayBuffer()),bytes);
 }finally{if(db)await db.close();}
});

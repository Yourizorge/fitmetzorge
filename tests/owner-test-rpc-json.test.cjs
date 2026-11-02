const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{PGlite}=require('@electric-sql/pglite'),Adapter=require('../owner-test/database.js');
test('owner RPC uses PostgREST JSON dates for agreement/planning and preserves downloaded Blob',{timeout:90000},async()=>{
 let db;const call=async(name,params)=>{const r=await db.sdk.rpc(name,params);assert.equal(r.error,null,r.error?.message);return r.data;},command=(name,action,payload)=>call(name,{action,payload,request_id:crypto.randomUUID()});
 try{
  db=await Adapter.create({PGlite,seed:new Blob([fs.readFileSync(require.resolve('../owner-test/seed.bin'))]),persist:async()=>{}});
  const date=new Date().toISOString().slice(0,10),v=await command('fmz_billing_command','save_agreement',{client_id:'TEST-NOOR',expected_version:0,effective_from:date,cycle:'four_weeks',package_id:'pt-progressie',enabled:true,confirmed:true});
  assert.equal(typeof v.effective_from,'string');assert.match(v.effective_from,/^\d{4}-\d{2}-\d{2}/);assert.equal(typeof v.created_at,'string');
  await command('fmz_billing_planning_command','refresh',{});const planning=await call('fmz_billing_planning_read',{});assert.ok(planning.tasks.length);for(const task of planning.tasks)for(const key of ['start_date','end_date','send_date'])assert.match(task[key],/^\d{4}-\d{2}-\d{2}$/);
  const member=(await call('fmz_members_read',{action:'profile',payload:{client_id:'TEST-NOOR'}})).member,bytes=Buffer.from('synthetic image fixture bytes'),asset=await command('fmz_members_command','reserve_photo',{client_id:'TEST-NOOR',expected_version:member.version,id:crypto.randomUUID(),mime:'image/png',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  const uploaded=await db.sdk.storage.from('fmz-members').upload(asset.path,bytes,{contentType:'image/png'});assert.equal(uploaded.error,null);const downloaded=await db.sdk.storage.from('fmz-members').download(asset.path);assert.equal(downloaded.error,null);assert.ok(downloaded.data instanceof Blob);assert.equal(downloaded.data.type,'image/png');assert.deepEqual(Buffer.from(await downloaded.data.arrayBuffer()),bytes);
 }finally{if(db)await db.close();}
});

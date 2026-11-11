const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
test('native PostgreSQL/PostgREST: durable owner tasks, retries, roles and closed signing gate',{timeout:120000},async()=>{
 const f=await require('./native-postgrest.cjs').setup();
 try{
  for(const file of ['20261026154916_appfmz_members.sql','20261104163836_appfmz_central_billing_opt_in.sql','20261104164206_appfmz_member_release_gate.sql'])await f.db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8'));
  const api=await f.start(),rpc=api.rpc,args={from_date:'2026-10-30',to_date:'2029-01-26'};
  assert.equal((await rpc('fmz_central_billing_read',args)).body.enabled,false);
  assert.equal((await rpc('fmz_central_billing_read',args,'a')).status,403);
  assert.ok([401,403].includes((await rpc('fmz_central_billing_read',args,null)).status));
  assert.equal((await rpc('fmz_central_billing_read',args,'trainer',{exp:1})).status,401);
  const key=crypto.randomUUID(),payload={expected_version:0,enabled:true,confirmed:true,base_date:'2026-10-30',credit_policy:'pro_rata_exact',invoice_policy:'arrears_only',reason:'Isolated synthetic test'};
  const config=await rpc('fmz_central_billing_command',{action:'configure',payload,request_id:key});assert.equal(config.status,200,JSON.stringify(config.body));
  assert.deepEqual((await rpc('fmz_central_billing_command',{action:'configure',payload,request_id:key})).body,config.body);
  const taskList=await rpc('fmz_central_billing_read',args);assert.equal(taskList.body.tasks.length,58);
  const task=taskList.body.tasks[0],taskKey=crypto.randomUUID(),complete={action:'complete',payload:{config_id:config.body.id,config_version:config.body.version,period_index:task.periodIndex,kind:task.kind,expected_version:0},request_id:taskKey};
  const before=(await f.db.query('select count(*)::int n from fmz_accounting.records')).rows[0].n;
  const first=await rpc('fmz_central_billing_command',complete);assert.equal(first.status,200);
  assert.deepEqual((await rpc('fmz_central_billing_command',complete)).body,first.body,'lost response reuses exact request');
  const conflict=await rpc('fmz_central_billing_command',{...complete,request_id:crypto.randomUUID()});assert.equal(conflict.status,409);assert.equal(conflict.body.code,'PT409');
  const reload=await rpc('fmz_central_billing_read',args);assert.equal(reload.body.tasks.find(t=>t.id===task.id).status,'done');assert.notEqual(reload.body.tasks[1].status,'done');
  assert.equal((await f.db.query('select count(*)::int n from fmz_accounting.records')).rows[0].n,before);
  const members=await rpc('fmz_members_read',{action:'bootstrap',payload:{}});assert.equal(members.status,200);assert.equal(members.body.enrollment_available,false);assert.equal(members.body.terms,null);
  assert.equal((await rpc('fmz_members_read',{action:'search',payload:{query:'a'}},'a')).status,403);
  const profile=await rpc('fmz_members_read',{action:'profile',payload:{client_id:'a'}},'a');assert.equal(profile.status,200,JSON.stringify(profile.body));
  assert.equal((await rpc('fmz_members_read',{action:'profile',payload:{client_id:'b'}},'a')).status,403);
  const blocked=await rpc('fmz_members_command',{action:'finalize',payload:{id:crypto.randomUUID()},request_id:crypto.randomUUID()});assert.equal(blocked.status,403);
  await f.db.query('delete from auth.sessions where id=$1',[f.ids.trainer]);
  assert.ok([401,403].includes((await rpc('fmz_central_billing_read',args)).status));
  const out=path.join(__dirname,'../docs/examples/production-integration-20261104');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'native-http.json'),JSON.stringify({pass:true,checkedAt:new Date().toISOString(),postgres:'18',postgrest:'16.5',transport:'Real HTTP over loopback; signed test JWTs; isolated synthetic auth/session tables, not hosted GoTrue',checks:['Owner-only tasks','Anonymous/member/expired JWT denied','58 calendar tasks','Durable independent completion','Lost response idempotency','HTTP409/PT409','No financial record from completion','Private own profile only','Enrollment closed server-side','Revoked session denied'],productionTouched:false},null,2)+'\n');
 }finally{await f.cleanup();}
});

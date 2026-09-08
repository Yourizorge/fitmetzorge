const {test}=require('node:test'); const assert=require('node:assert/strict'); const {setup}=require('./database.cjs'); const sync=require('../sync.js');
test('isolated PostgreSQL: member/trainer chain, isolation, conflicts, profile authority and invites',async()=>{
 const {db,as,read,save,ids}=await setup();
 try {
  const a=await read('a'); assert.equal(a.clients.length,1); assert.equal(a.clients[0].id,'a'); assert(!JSON.stringify(a).includes('PRIVATE'));
  assert.equal(a.clients[0].trainingPlan.length,1);
  const modified=sync.clone(a); modified.clients[0].stepsByWeek['2026-09-07']=[{day:'Maandag',value:12345}];
  modified.clients[0].foodLog.push({id:'f1',date:'2026-09-08',mealType:'lunch',note:'<img src=x onerror=alert(1)>',kcal:650});
  modified.clients[0].trainingPlan[0].logsByWeek['2026-09-07']={actualWeight:65,notes:'Test log'};
  const changes=sync.diff(a,modified,a,'client'); assert.equal((await save('a',changes)).changed,changes.length);
  assert.equal((await read('a')).clients[0].stepsByWeek['2026-09-07'][0].value,12345);
  assert.equal((await read('trainer')).clients.find(c=>c.id==='a').trainingPlan[0].logsByWeek['2026-09-07'].actualWeight,65);
  assert.equal((await read('b')).clients[0].foodLog.length,0);
  await assert.rejects(save('b',changes),/denied/);
  await assert.rejects(as('a','select * from public.coach_workspaces'),/permission denied/);
  await assert.rejects(as('a',"update public.profiles set role='trainer' where id=auth.uid()"),/permission denied/);
  await assert.rejects(as('a',"update public.profiles set trainer_id=null where id=auth.uid()"),/permission denied/);
  await assert.rejects(as('new',"insert into public.profiles(id,role,name,email) values(auth.uid(),'trainer','Bad','bad@test')"),/permission denied/);
  await as('a',"update public.profiles set name='Allowed' where id=auth.uid()");
  const stale=sync.clone(a); stale.clients[0].stepsByWeek['2026-09-07']=[{value:1}];
  await assert.rejects(save('a',sync.diff(a,stale,a,'client')),/Concurrent change/);
  stale.clients[0].stepsByWeek={}; stale.clients[0].sleepByWeek['2026-09-07']=[{hours:8}];
  await save('a',sync.diff(a,stale,a,'client'));
  assert.equal((await read('a')).clients[0].stepsByWeek['2026-09-07'][0].value,12345);
  await assert.rejects(save('a',[{client_id:'a',path:['goals'],before_exists:true,before:a.clients[0].goals,after_exists:true,after:{kcalTraining:1}}]),/denied/);
  await assert.rejects(as('a','select public.accept_client_invite()'),/already linked/);
  await assert.rejects(as('trainer',"select public.fmz_prepare_invite('missing','missing@example.test','Missing')"),/Save client/);
  await assert.rejects(as('a',"select public.fmz_prepare_invite('a','a@example.test','A')"),/Trainer required/);
  await as('trainer',"select public.fmz_prepare_invite('a','a@example.test','A')");
  await db.query("insert into public.client_invites(trainer_id,client_id,email,name,created_at,expires_at) values($1,'new','new@example.test','New',now()-interval '8 days',now()-interval '1 day')",[ids.trainer]);
  await assert.rejects(as('new','select public.accept_client_invite()'),/valid invitation/);
  await db.exec("update public.client_invites set expires_at=now()+interval '1 day'");
  await as('new','select public.accept_client_invite()');
  assert.equal((await read('new')).clients[0].id,'new');
  await assert.rejects(as('new','select public.accept_client_invite()'),/already linked/);
  await db.query('delete from auth.sessions where user_id=$1',[ids.a]);
  await assert.rejects(read('a'),/Session ended/);
  await db.exec('set role anon');
  await assert.rejects(db.query('select public.fmz_read_workspace()'),/permission denied/);
  await db.exec('reset role');
 } finally {await db.close();}
});
test('bounded recurrence handles month ends without repeated fees',()=>{
 const series=sync.occurrences({id:'series',date:'2026-01-31',time:'10:00',repeat:'monthly',amount:60});
 assert.equal(series.length,12); assert.equal(series[1].date,'2026-02-28'); assert.equal(series[2].date,'2026-03-31'); assert.equal(new Set(series.map(x=>x.id)).size,12); assert(series.slice(1).every(x=>x.amount===''&&x.adminItemSuppressed));
 assert.equal(sync.occurrences({id:'x',date:'2026-09-08',repeat:'biweekly'})[1].date,'2026-09-22');
});

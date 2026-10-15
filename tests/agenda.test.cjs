const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{setup}=require('./database.cjs'),{extend}=require('./agenda-database.cjs'),M=require('../agenda-model.js');
test('agenda commands preserve all finance; duo, attendance, conflicts, recurrence and role boundaries',async()=>{
 const d=await extend(await setup());try{
 const before=await d.read('trainer');const req=randomUUID(),payload={participants:[{id:'a'},{id:'b'}],appointment:{date:'2026-10-31',time:'23:00',duration:60,type:'Synthetische duo',location:'Test',notes:'Gedeelde notitie'}};
 await d.command('trainer','create',payload,req);await d.command('trainer','create',payload,req);
 let read=await d.agenda('trainer');assert.equal(read.appointments.length,1);let ap=read.appointments[0];assert.equal(ap.participants.length,2);
 assert.deepEqual((await d.read('trainer')).trainerFinance,before.trainerFinance);assert.equal((await d.read('trainer')).clients[0].appointments.length,1);
 await assert.rejects(d.command('a','edit',{key:ap.key,revision:ap.revision,appointment:{type:'hack'}}),e=>e.code==='42501');
 assert.equal((await d.agenda('a')).appointments[0].participants.length,1);assert.equal((await d.agenda('a')).appointments[0].participants[0].id,'a');
 await d.command('trainer','attendance',{key:ap.key,revision:ap.revision,clientId:'a',status:'attended'});
 await assert.rejects(d.command('trainer','cancel',{key:ap.key,revision:ap.revision}),e=>e.code==='PT409');
 read=await d.agenda('trainer');ap=read.appointments[0];assert.equal(M.monthly(read.appointments,'a','2026-10',new Date('2026-11-01Z')).attended.length,1);assert.equal(M.monthly(read.appointments,'b','2026-10',new Date('2026-11-01Z')).unknown.length,1);
 await d.command('trainer','edit',{key:ap.key,revision:ap.revision,appointment:{date:'2026-11-01',time:'09:00',duration:45}});
 read=await d.agenda('trainer');ap=read.appointments[0];assert.equal(M.monthly(read.appointments,'a','2026-10').attended.length,0);assert.equal(M.monthly(read.appointments,'a','2026-11').attended.length,1);
 await d.command('trainer','cancel',{key:ap.key,revision:ap.revision});read=await d.agenda('trainer');assert.equal(M.monthly(read.appointments,'a','2026-11').cancelled.length,1);
 await assert.rejects(d.command('trainer','create',{...payload,appointment:{...payload.appointment,amount:200}}),e=>e.code==='22023');
 await assert.rejects(d.command('trainer','create',{...payload,participants:[{id:'not-owned'}]}),e=>e.code==='42501');
 await assert.rejects(d.command('trainer','create',{...payload,appointment:{...payload.appointment,date:'2027-03-28',time:'02:30'}}),e=>e.code==='22023');
 await d.command('trainer','create',{...payload,participants:[{id:'a'}],appointment:{...payload.appointment,date:'2027-01-31',time:'09:00',repeat:'monthly'}});
 read=await d.agenda('trainer');assert.equal(read.appointments.length,13);assert.ok(read.appointments.some(a=>a.date==='2027-02-28'));
 assert.deepEqual((await d.read('trainer')).trainerFinance,before.trainerFinance);
 }finally{await d.db.close();}
});
test('calendar months, Amsterdam boundaries, unknown history and duplicate occurrences',()=>{
 assert.equal(M.today(new Date('2026-10-31T23:30:00Z')),'2026-11-01');assert.equal(M.today(new Date('2026-06-30T22:30:00Z')),'2026-07-01');
 const a={key:'one',clientId:'a',date:'2026-10-02',time:'10:00'};const m=M.monthly([a,a,{...a,key:'two',status:'no_show'},{...a,key:'three',status:'cancelled'},{...a,key:'four',status:'attended'}],'a','2026-10',new Date('2026-11-01Z'));assert.equal(m.unknown.length,1);assert.equal(m.attended.length,1);assert.equal(m.cancelled.length,1);assert.equal(m.no_show.length,1);
});
test('durable reminders: opt-in, reschedule/cancel, DST, bounded retry, sessions and no backlog',{timeout:60000},async()=>{
 const d=await extend(await setup());const worker=async(action,payload={})=>(await d.db.query('select fmz_agenda.worker($1,$2) r',[action,JSON.stringify(payload)])).rows[0].r;
 try{
  await d.db.exec("update fmz_agenda.config set enabled=true,public_key='synthetic';");
  await d.command('a','preferences',{reminder_minutes:30,changes:true,push:true});
  const sub={endpoint:'https://web.push.apple.com/synthetic-only',keys:{p256dh:'A'.repeat(87),auth:'A'.repeat(22)}};
  await d.command('a','subscribe',sub);
  const future=M.addDays(M.today(),4),payload={participants:[{id:'a'},{id:'b'}],appointment:{date:future,time:'10:00',duration:60,type:'Voorbeeld'}};
  await d.command('trainer','create',payload);let ap=(await d.agenda('trainer')).appointments[0];
  let queued=(await d.db.query("select * from fmz_agenda.events where kind='reminder' and status='pending'")).rows;assert.equal(queued.length,1);assert.equal(queued[0].recipient,d.ids.a);
  await d.command('trainer','edit',{key:ap.key,revision:ap.revision,appointment:{time:'12:00'}});
  queued=(await d.db.query("select * from fmz_agenda.events where kind='reminder'")).rows;assert.equal(queued.filter(e=>e.status==='obsolete').length,1);assert.equal(queued.filter(e=>e.status==='pending').length,1);
  const first=await worker('claim');assert.ok(first.length>=1);assert.equal(first[0].subscription.endpoint,sub.endpoint);assert.equal((await worker('claim')).length,0);
  await worker('finish',{id:first[0].id,lease:first[0].lease,code:503});assert.equal((await worker('claim')).length,0);await d.db.exec("update fmz_agenda.deliveries set next_attempt=now()-interval '1 second' where status='retry';");const retry=await worker('claim');assert.equal(retry.length,1);assert.equal(retry[0].id,first[0].id);assert.notEqual(retry[0].lease,first[0].lease);await worker('finish',{id:retry[0].id,lease:retry[0].lease,code:201});
  await d.db.exec('select fmz_agenda.tick();select fmz_agenda.tick();');assert.equal((await worker('claim')).length,0);
  ap=(await d.agenda('trainer')).appointments[0];await d.command('trainer','cancel',{key:ap.key,revision:ap.revision});assert.equal((await d.db.query("select count(*)::int n from fmz_agenda.events where kind='reminder' and status='pending'")).rows[0].n,0);
  const inbox=(await d.agenda('a')).inbox;assert.ok(inbox.length);assert.equal(new Set(inbox.map(e=>e.id)).size,inbox.length);
  await d.db.query('delete from auth.sessions where id=$1',[d.ids.a]);assert.equal((await worker('claim')).length,0);await assert.rejects(d.agenda('a'),e=>e.code==='28000');
  const times=(await d.db.query(`select to_char(fmz_agenda.start_at('{"date":"2027-03-28","time":"03:30"}') at time zone 'UTC','YYYY-MM-DD HH24:MI') spring,to_char(fmz_agenda.start_at('{"date":"2026-10-25","time":"02:30"}') at time zone 'UTC','YYYY-MM-DD HH24:MI') autumn`)).rows[0];assert.equal(times.spring,'2027-03-28 01:30');assert.equal(times.autumn,'2026-10-25 01:30');
  // Expired messages cannot suddenly become notifications after a restart.
  await d.db.exec("update fmz_agenda.events set expires_at=now()-interval '1 day';select fmz_agenda.tick();");assert.equal((await worker('claim')).length,0);
  await d.db.exec('set role authenticated');try{await assert.rejects(d.db.query("select public.fmz_agenda_worker('claim','{}')"),e=>e.code==='42501');await assert.rejects(d.db.query('select * from fmz_agenda.events'),e=>e.code==='42501');}finally{await d.db.exec('reset role');}
 }finally{await d.db.close();}
});
test('isolated restore: synthetic agenda, receipts and notifications recover without finance changes',async()=>{
 const d=await extend(await setup());try{
 await d.command('a','preferences',{reminder_minutes:60,changes:true,push:false});await d.command('trainer','create',{participants:[{id:'a'},{id:'b'}],appointment:{date:M.addDays(M.today(),3),time:'10:00',duration:60,type:'Restore example',notes:'Gedeelde synthetische notitie'}});await d.db.exec('select fmz_agenda.tick()');
 const before=await d.agenda('trainer'),workspace=(await d.db.query('select state from public.coach_workspaces where trainer_id=$1',[d.ids.trainer])).rows[0].state;const tables=['requests','preferences','events','subscriptions','deliveries','config'],snapshot={};for(const table of tables)snapshot[table]=(await d.db.query('select to_jsonb(t) r from fmz_agenda.'+table+' t')).rows.map(x=>x.r);
 // The database was created by setup() in memory and contains only fixed synthetic identities.
 await d.db.exec('truncate fmz_agenda.deliveries,fmz_agenda.events,fmz_agenda.subscriptions,fmz_agenda.preferences,fmz_agenda.requests,fmz_agenda.config');
 for(const table of tables)await d.db.query(`insert into fmz_agenda.${table} select * from jsonb_populate_recordset(null::fmz_agenda.${table},$1)`,[JSON.stringify(snapshot[table])]);
 assert.deepEqual(await d.agenda('trainer'),before);assert.deepEqual((await d.db.query('select state from public.coach_workspaces where trainer_id=$1',[d.ids.trainer])).rows[0].state,workspace);await d.db.exec('select fmz_agenda.tick()');assert.deepEqual(await d.agenda('trainer'),before);
 }finally{await d.db.close();}
});

const test=require('node:test'),assert=require('node:assert/strict');
test('complete release: additive data preservation, RLS, private workers and revoked-session denial',async()=>{
 const d=await require('./database.cjs').setup();try{
  await require('./accounting-database.cjs').extend(d);await require('./agenda-database.cjs').extend(d);
  const tables=(await d.db.query("select n.nspname||'.'||c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','fmz_private','fmz_accounting','fmz_agenda') and c.relkind='r' order by 1")).rows.map(r=>r.name);
  const before=new Map();for(const t of tables)before.set(t,(await d.db.query(`select to_jsonb(t) row from ${t} t order by to_jsonb(t)::text`)).rows);
  await require('./enrollment-database.cjs').extend(d);
  for(const t of tables)assert.deepEqual((await d.db.query(`select to_jsonb(t) row from ${t} t order by to_jsonb(t)::text`)).rows,before.get(t),'Original data changed during migration: '+t);
  const unsecured=(await d.db.query("select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('fmz_members','fmz_communication') and c.relkind='r' and not c.relrowsecurity")).rows;assert.deepEqual(unsecured,[]);
  for(const sql of ["select * from fmz_members.drafts","select * from fmz_members.contracts","select * from fmz_communication.messages","select fmz_accounting.planning_tick()","select public.fmz_communication_worker('claim','{}')","select public.fmz_communication_push_worker('claim','{}')","select public.fmz_member_verify_asset(gen_random_uuid(),repeat('a',64),50)"]){await assert.rejects(d.as('trainer',sql),e=>e.code==='42501',sql);}
  const exposed=(await d.db.query("select p.oid::regprocedure::text name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'fmz_member%' or p.proname like 'fmz_communication%' or p.proname like 'fmz_billing_plan%' or p.proname like 'fmz_billing_reminder%') and has_function_privilege('anon',p.oid,'EXECUTE')")).rows;assert.deepEqual(exposed,[]);
  await d.db.query('delete from auth.sessions where id=$1',[d.ids.trainer]);
  for(const sql of ["select public.fmz_members_read('search','{}')","select public.fmz_billing_planning_read()","select public.fmz_communication_read()","select public.fmz_billing_reminders_read()"]){await assert.rejects(d.as('trainer',sql),e=>['28000','42501'].includes(e.code),sql);}
 }finally{await d.db.close();}
});

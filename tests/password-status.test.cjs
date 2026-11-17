const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('password status is read-only, self-only and requires a live session',{timeout:60000},async()=>{
 const s=await require('./database.cjs').setup();try{
 await s.db.exec("alter table auth.users add column encrypted_password text, add column invited_at timestamptz;");
 await s.db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261117161135_appfmz_invitation_password_gate.sql'),'utf8'));
 await s.db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261117162324_appfmz_invitation_password_proof.sql'),'utf8'));
 await s.db.query('update auth.users set encrypted_password=$1 where id=$2',['PRIVATE HASH MUST NEVER LEAVE SQL',s.ids.a]);
 await s.db.query('update auth.users set invited_at=now() where id=$1',[s.ids.a]);
 const before=JSON.stringify((await s.db.query('select * from auth.users order by id')).rows);
 assert.deepEqual((await s.as('a','select public.fmz_password_status() s')).rows[0].s,{user_id:s.ids.a,password_set:true});
 s.authMethods.a=['invite'];assert.equal((await s.as('a','select public.fmz_password_status() s')).rows[0].s.password_set,false,'temporary invite password is insufficient');
 s.authMethods.a=['password','token_refresh'];assert.equal((await s.as('a','select public.fmz_password_status() s')).rows[0].s.password_set,true,'password proof persists on refresh');
 assert.deepEqual((await s.as('b','select public.fmz_password_status() s')).rows[0].s,{user_id:s.ids.b,password_set:false});
 assert.deepEqual((await s.as('new','select public.fmz_password_status() s')).rows[0].s,{user_id:s.ids.new,password_set:false});
 await assert.rejects(s.as('b','select public.fmz_password_status($1)',[s.ids.a]),/does not exist/);
 await s.db.exec('set role anon');await assert.rejects(s.db.query('select public.fmz_password_status()'),/permission denied/);await s.db.exec('reset role');
 await s.db.query('delete from auth.sessions where user_id=$1',[s.ids.b]);await assert.rejects(s.as('b','select public.fmz_password_status()'),/Active session required/);
 assert.equal(JSON.stringify((await s.db.query('select * from auth.users order by id')).rows),before);
 }finally{await s.db.close();}
});

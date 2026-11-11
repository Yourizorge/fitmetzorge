const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
test('native concurrent profile/photo commands use autosave lock order and return PT409 without deadlock',{timeout:60000},async()=>{
 const f=await require('./native-postgrest.cjs').setup(),{Client}=require('pg');let autosave,edit;
 try{
  await f.db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261026154916_appfmz_members.sql'),'utf8'));
  autosave=new Client({host:'127.0.0.1',port:55439,user:'postgres',database:f.database,query_timeout:7000});edit=new Client({host:'127.0.0.1',port:55439,user:'postgres',database:f.database,query_timeout:7000});await autosave.connect();await edit.connect();
  const claims=JSON.stringify({sub:f.ids.trainer,session_id:f.ids.trainer,email:'trainer@example.test'});await autosave.query("select set_config('request.jwt.claims',$1,false)",[claims]);await edit.query("select set_config('request.jwt.claims',$1,false)",[claims]);await edit.query('set role authenticated');const pid=(await edit.query('select pg_backend_pid() pid')).rows[0].pid;
  let name='a';
  for(const action of ['edit_profile','reserve_photo','remove_photo']){
   const version=(await f.db.query("select version from fmz_members.directory where client_id='a'")).rows[0].version;
   await autosave.query('begin');await autosave.query('select state from public.coach_workspaces where trainer_id=$1 for update',[f.ids.trainer]);
   const payload={client_id:'a',expected_version:version,personal:{firstName:'Synthetic',lastName:'Profile',phone:'0612345678',birthDate:'1990-04-20',street:'Voorbeeldstraat',houseNumber:'1',postalCode:'1234 AB',city:'Teststad',country:'Nederland'},id:randomUUID(),mime:'image/jpeg',bytes:100,sha256:'a'.repeat(64)};
   const pending=edit.query('select public.fmz_members_command($1,$2,$3)',[action,payload,randomUUID()]).then(r=>({result:r}),error=>({error}));
   let blocked=false;for(let i=0;i<80;i++){const q=await f.db.query('select wait_event_type from pg_stat_activity where pid=$1',[pid]);if(q.rows[0]?.wait_event_type==='Lock'){blocked=true;break;}await new Promise(r=>setTimeout(r,20));}a.equal(blocked,true,'member action waits behind workspace autosave');
   const changed=name+'x';const saved=await autosave.query('select public.fmz_save_changes($1) result',[JSON.stringify([{client_id:'a',path:['name'],before:name,after:changed,before_exists:true,after_exists:true}])]);a.equal(saved.rows[0].result.ok,true);name=changed;await autosave.query('commit');
   const outcome=await pending;a.equal(outcome.error?.code,'PT409','concurrent autosave preserved; stale member command rejected');
  }
  a.equal((await f.db.query("select state#>>'{clients,0,name}' name from public.coach_workspaces where trainer_id=$1",[f.ids.trainer])).rows[0].name,name);a.equal((await f.db.query('select count(*)::int n from fmz_members.assets')).rows[0].n,0);
 }finally{if(autosave){await autosave.query('rollback').catch(()=>{});await autosave.end();}if(edit)await edit.end();await f.cleanup();}
});

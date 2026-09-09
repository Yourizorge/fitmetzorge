// Operational backup for the explicitly approved project. No customer data is logged.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=process.env.FMZ_BACKUP_DIR || 'C:/Users/Fitme/.codex/backups/appfmz-20260908';
const keys=JSON.parse(fs.readFileSync(path.join(dir,'backup-keys.json'),'utf8'));
if(process.argv[2]==='prepare') {
 const sql=`with snapshot as (select jsonb_build_object(
 'project','hgoygcviutmynaihcvpd','created_at',clock_timestamp(),
 'profiles',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.profiles t),
 'workspaces',(select coalesce(jsonb_agg(to_jsonb(t) order by trainer_id),'[]') from public.coach_workspaces t),
 'invites',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.client_invites t),
 'auth_users',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from auth.users t),
 'auth_identities',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from auth.identities t),
 'columns',(select jsonb_agg(to_jsonb(x)) from (select c.relname as table_name,a.attname as name,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as not_null,pg_get_expr(d.adbin,d.adrelid) as default_expr from pg_attribute a join pg_class c on c.oid=a.attrelid left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where c.relnamespace='public'::regnamespace and c.relname in ('profiles','coach_workspaces','client_invites') and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum)x),
 'constraints',(select jsonb_agg(jsonb_build_object('table_name',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid))) from pg_constraint where connamespace='public'::regnamespace),
 'indexes',(select jsonb_agg(to_jsonb(i)) from pg_indexes i where schemaname='public'),
 'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname='public'),
 'grants',(select jsonb_agg(to_jsonb(g)) from information_schema.role_table_grants g where table_schema='public'),
 'column_grants',(select jsonb_agg(to_jsonb(g)) from information_schema.role_column_grants g where table_schema='public'),
 'functions',(select jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl)) from pg_proc p where pronamespace in ('public'::regnamespace,'fmz_private'::regnamespace) and prokind='f')
 )::text as body), encrypted as (select extensions.encrypt_iv(convert_to(body,'utf8'),decode('${keys.enc}','hex'),decode('${keys.iv}','hex'),'aes-cbc/pad:pkcs') as cipher, encode(extensions.digest(body,'sha256'),'hex') as plaintext_sha256 from snapshot)
 select 'hgoygcviutmynaihcvpd' as project,'${keys.iv}' as iv,encode(cipher,'hex') as ciphertext,encode(extensions.hmac(decode('${keys.iv}','hex')||cipher,decode('${keys.mac}','hex'),'sha256'),'hex') as hmac,plaintext_sha256 from encrypted;`;
 fs.writeFileSync(path.join(dir,'backup-query.sql'),sql);
 console.log('Read-only encrypted backup query prepared outside Git.');
} else if(process.argv[2]==='verify') {
 (async()=>{
  const raw=JSON.parse(fs.readFileSync(path.join(dir,'backup.encrypted.json'),'utf8').replace(/^\uFEFF/,''));
  const packet=Array.isArray(raw)?raw[0]:(raw.rows?.[0] || raw.result?.[0] || raw.data?.[0]);
  if(!packet?.ciphertext) throw Error('Encrypted backup packet missing');
  const cipher=Buffer.from(packet.ciphertext,'hex'),iv=Buffer.from(packet.iv,'hex');
  const signature=crypto.createHmac('sha256',Buffer.from(keys.mac,'hex')).update(Buffer.concat([iv,cipher])).digest();
  if(!crypto.timingSafeEqual(signature,Buffer.from(packet.hmac,'hex')))throw Error('Backup integrity failed');
  const decrypt=crypto.createDecipheriv('aes-256-cbc',Buffer.from(keys.enc,'hex'),iv);
  const plain=Buffer.concat([decrypt.update(cipher),decrypt.final()]);
  if(crypto.createHash('sha256').update(plain).digest('hex')!==packet.plaintext_sha256)throw Error('Content checksum mismatch');
  const backup=JSON.parse(plain);
  const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
  await db.exec('create role anon;create role authenticated;create role service_role;create schema auth;create schema fmz_private;set check_function_bodies=false;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;create function auth.jwt() returns jsonb language sql as $$select null::jsonb$$;');
  for(const u of backup.auth_users)await db.query('insert into auth.users values($1)',[u.id]);
  const quote=s=>'"'+s.replaceAll('"','""')+'"';
  for(const table of ['profiles','coach_workspaces','client_invites']){
   const columns=backup.columns.filter(c=>c.table_name===table);
   await db.exec(`create table public.${quote(table)}(${columns.map(c=>`${quote(c.name)} ${c.type}${c.default_expr?' default '+c.default_expr:''}${c.not_null?' not null':''}`).join(',')})`);
  }
  for(const [table,key] of [['profiles','profiles'],['coach_workspaces','workspaces'],['client_invites','invites']]) {
   for(const row of backup[key])await db.query(`insert into public.${quote(table)} select * from jsonb_populate_record(null::public.${quote(table)},$1)`,[JSON.stringify(row)]);
  }
  // Primary/check constraints first, then foreign keys, so every referenced key exists.
  for(const c of [...backup.constraints].sort((a,b)=>Number(a.definition.startsWith('FOREIGN'))-Number(b.definition.startsWith('FOREIGN'))))await db.exec(`alter table public.${quote(c.table_name.replace('public.',''))} add constraint ${quote(c.name)} ${c.definition}`);
  for(const f of backup.functions || [])await db.exec(f.definition);
  const result={project:backup.project,encryptedBytes:cipher.length,checksum:packet.plaintext_sha256,restored:true,tables:{}};
  for(const [table,key] of [['profiles','profiles'],['coach_workspaces','workspaces'],['client_invites','invites']]){
   const loaded=(await db.query(`select to_jsonb(t) as value from public.${quote(table)} t order by ${table==='coach_workspaces'?'trainer_id':'id'}`)).rows.map(x=>x.value);
   // JSON serialization of timestamps is semantically checked by PostgreSQL itself.
   const expected=`select to_jsonb(t) from jsonb_populate_recordset(null::public.${quote(table)},$1::jsonb) t`;
   const equal=(await db.query(`select not exists((select to_jsonb(t) from public.${quote(table)} t except ${expected}) union all (${expected} except select to_jsonb(t) from public.${quote(table)} t)) as ok`,[JSON.stringify(backup[key])])).rows[0].ok;
   if(!equal)throw Error('Restore mismatch in '+table);
   result.tables[table]=loaded.length;
  }
  await db.close();fs.writeFileSync(path.join(dir,'restore-verification.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
 })().catch(e=>{console.error('Backup verification failed:',e.message);process.exitCode=1});
}

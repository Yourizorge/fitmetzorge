/* Compare only baseline record identities. The query and customer values stay in the private backup directory. */
const fs=require('node:fs'),path=require('node:path');
const dir=process.env.FMZ_COMPLETE_BACKUP_DIR,{decrypt}=require('./release-backup-complete.cjs'),b=decrypt();
if(b.project!=='hgoygcviutmynaihcvpd')throw Error('Project mismatch');
const keys={profiles:['id'],coach_workspaces:['trainer_id'],client_invites:['id'],write_receipts:['actor_id','request_id'],photo_annotations:['trainer_id','client_id','week','day','slot','source_hash'],organizations:['id'],accounts:['org_id','code'],records:['org_id','id'],journals:['org_id','id'],lines:['org_id','journal_id','line_no'],files:['org_id','id'],audit:['id'],receipts:['org_id','request_id']};
const {PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite(),checks=[];try{
 await db.exec("set timezone='UTC';create schema fmz_private;create schema fmz_accounting;");
 for(const [table,rows]of Object.entries(b.tables)){
  const key=keys[table.split('.')[1]],columns=b.columns.filter(c=>c.table_name===table);if(!key?.every(k=>columns.some(c=>c.name===k)))throw Error('Check baseline primary key');
  await db.exec(`create table ${table}(${columns.map(c=>`"${c.name}" ${c.type}`).join(',')})`);
  for(const row of rows)await db.query(`insert into ${table} select * from jsonb_populate_record(null::${table},$1)`,[JSON.stringify(row)]);
  const hashes=(await db.query(`select jsonb_build_array(${key.map(k=>`"${k}"::text`).join(',')}) identity,md5(to_jsonb(t)::text) hash from ${table} t`)).rows;
  const expected="'"+JSON.stringify(hashes).replaceAll("'","''")+"'::jsonb";
  checks.push(`'${table}',(with expected as (select * from jsonb_to_recordset(${expected}) as e(identity jsonb,hash text)) select jsonb_build_object('baseline_rows',${rows.length},'identical',not exists(select 1 from expected e left join ${table} t on jsonb_build_array(${key.map(k=>`t."${k}"::text`).join(',')})=e.identity where md5(to_jsonb(t)::text) is distinct from e.hash)))`);
 }
 fs.writeFileSync(path.join(dir,'preservation-query.sql'),"set timezone='UTC';select jsonb_build_object("+checks.join(',')+') as preservation;');
 console.log('Prepared read-only database hashes for all 13 baseline tables; no customer contents logged.');
}finally{await db.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});

const fs=require('node:fs'),path=require('node:path');
async function extend({db,ids}){
 await db.exec(`alter table auth.users add column raw_user_meta_data jsonb default '{}';create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260910145050_appfmz_owner_accounting.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20260910171432_appfmz_accounting_closed_bank_period.sql'),'utf8'));
 return (await db.query('select fmz_accounting.provision($1,$2) id',[ids.trainer,'Synthetic owner'])).rows[0].id;
}
module.exports={extend};

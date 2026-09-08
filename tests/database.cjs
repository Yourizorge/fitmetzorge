const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const path=require('node:path');
const ids={trainer:'11111111-1111-4111-8111-111111111111',a:'22222222-2222-4222-8222-222222222222',b:'33333333-3333-4333-8333-333333333333',new:'44444444-4444-4444-8444-444444444444'};
async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'$$;
 ` .replace("select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'","select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid"));
 await db.exec(`create function auth.jwt() returns jsonb language sql as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
 grant usage on schema auth to authenticated,anon;
 create table public.profiles(id uuid primary key references auth.users,role text not null check(role in ('trainer','client')), name text not null,email text not null,trainer_id uuid references public.profiles,client_id text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
 create table public.coach_workspaces(trainer_id uuid primary key references public.profiles,state jsonb not null default '{}',updated_at timestamptz not null default now());
 create table public.client_invites(id uuid primary key default gen_random_uuid(),trainer_id uuid not null references public.profiles,client_id text not null,email text not null,name text not null,status text not null default 'invited' check(status in ('invited','accepted')),created_at timestamptz not null default now(),accepted_at timestamptz);
 create unique index client_invites_trainer_email on public.client_invites(trainer_id,email);
 alter table public.profiles enable row level security;
 create policy "profiles read own and linked" on public.profiles for select using(id=auth.uid() or trainer_id=auth.uid());
 create policy "profiles update own" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
 grant all on public.profiles,public.coach_workspaces,public.client_invites to anon,authenticated;`);
 for(const [name,id] of Object.entries(ids)){
  await db.query('insert into auth.users values($1,$2,now())',[id,`${name}@example.test`]);
  await db.query('insert into auth.sessions values($1,$1)',[id]);
 }
 await db.query("insert into public.profiles(id,role,name,email) values($1,'trainer','Synthetic trainer','trainer@example.test')",[ids.trainer]);
 for(const name of ['a','b'])await db.query("insert into public.profiles(id,role,name,email,trainer_id,client_id) values($1,'client',$2,$3,$4,$2)",[ids[name],name,`${name}@example.test`,ids.trainer]);
 const client=id=>({id,name:id,email:`${id}@example.test`,goal:'Test',goals:{kcalTraining:2500,kcalRest:2000},profile:{privateAdminNote:'PRIVATE ADMIN'},password:'PRIVATE PASSWORD',coachNotesByWeek:{secret:'PRIVATE NOTE'},trainingPlan:[{id:'ex1',day:'Dinsdag',exercise:'Squat',sets:3,published:true,logsByWeek:{}},{id:'draft',exercise:'PRIVATE DRAFT',published:false}],nutritionPlan:[{id:'meal1',meal:'Lunch',published:true,logsByWeek:{}}],foodLog:[],stepsByWeek:{},dailyWeightByWeek:{},wellbeingByWeek:{},sleepByWeek:{},waterByWeek:{},trainingAttendanceByWeek:{},appointments:[]});
 await db.query('insert into public.coach_workspaces(trainer_id,state) values($1,$2)',[ids.trainer,JSON.stringify({clients:[client('a'),client('b'),client('new')],trainerFinance:{secret:'PRIVATE FINANCE'},ui:{}})]);
 const migration=fs.readdirSync(path.join(__dirname,'../supabase/migrations')).find(f=>f.endsWith('_appfmz_storage_security.sql'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',migration),'utf8'));
 async function as(name,sql,params=[]){
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:ids[name],session_id:ids[name],email:`${name}@example.test`})]);
  await db.exec('set role authenticated');
  try{return await db.query(sql,params);}finally{await db.exec('reset role');}
 }
 const read=async name=>(await as(name,'select public.fmz_read_workspace() as result')).rows[0].result.state;
 const save=async(name,changes)=>(await as(name,'select public.fmz_save_changes($1::jsonb) as result',[JSON.stringify(changes)])).rows[0].result;
 return {db,as,read,save,ids};
}
module.exports={setup,ids};

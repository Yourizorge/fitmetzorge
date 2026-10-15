const fs=require('node:fs'),path=require('node:path');
async function extend(database){
 const {db}=database;
 await db.exec("do $$begin if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;end$$;");
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261015102946_appfmz_agenda_reminders.sql'),'utf8'));
 database.agenda=async(name)=>(await database.as(name,'select public.fmz_agenda_read() r')).rows[0].r;
 database.command=async(name,action,payload,id=require('node:crypto').randomUUID())=>(await database.as(name,'select public.fmz_agenda_command($1,$2,$3) r',[action,JSON.stringify(payload),id])).rows[0].r;
 return database;
}
module.exports={extend};

/* Installed only after the owner-test metadata marker is checked. Never a production migration. */
(function(root){'use strict';
 async function install(db){
  const marker=(await db.query('select fixture,production from owner_test.metadata')).rows;
  if(marker.length!==1||marker[0].fixture!=='APPFMZ-SYNTHETIC-OWNER-TEST'||marker[0].production!==false)throw Error('Duo is uitsluitend beschikbaar in de synthetische testdatabase.');
  const installed=Boolean((await db.query("select to_regprocedure('owner_test.duo_client(jsonb,jsonb,text)') ready")).rows[0].ready);
  const definition=async name=>(await db.query('select pg_get_functiondef($1::regprocedure) sql',[name])).rows[0].sql;
  let command=await definition('fmz_members.command(text,jsonb,uuid)'),read=await definition('fmz_members.read(text,jsonb)'),storage=await definition('fmz_members.storage_allowed(text,boolean)'),health=await definition('fmz_members.guard_health(uuid,text,jsonb,jsonb,boolean)');
  const replace=(sql,old,value)=>{if(sql.split(old).length!==2)throw Error('Lokale duopatch past niet exact op '+old.slice(0,65));return sql.replace(old,value);};
  if(!command.includes("'additionalGoals'"))command=replace(command,"'goal','experience','preferences','injuries','trainerNote','marketing'","'goal','experience','preferences','additionalGoals','injuries','trainerNote','marketing'");
  if(!read.includes("'additionalGoals'"))read=replace(read,"'experience','preferences','injuries','marketing'","'experience','preferences','additionalGoals','injuries','marketing'");
  if(installed){await db.exec('begin');try{await db.exec(command);await db.exec(read);await db.exec('commit');}catch(e){await db.exec('rollback');throw e;}return;}
  command=replace(command,"if t.id is null then raise exception 'Geverifieerde algemene voorwaarden en privacyvoorwaarden ontbreken';end if;", "if t.id is null then raise exception 'Geverifieerde algemene voorwaarden en privacyvoorwaarden ontbreken';end if; perform owner_test.validate_duo(d.data,catalog.snapshot,p.id);");
  command=replace(command,"'route','appfmz-trainer-enrollment-v1') where id=d.id returning * into d;result:=to_jsonb(d);", "'route','appfmz-trainer-enrollment-v1') || case when catalog.snapshot->>'mode'='duo' then jsonb_build_object('duo',jsonb_build_object('primaryClientId',d.client_id,'secondClientId',d.client_id||'-duo','secondPerson',(d.data->'duoPerson')-'trainerNote'-'injuries','pricePerPersonCents',(catalog.snapshot->>'cents')::bigint/2,'jointSessions',(catalog.snapshot->>'sessions')::integer)) else '{}'::jsonb end where id=d.id returning * into d;result:=to_jsonb(d);");
  command=replace(command,"oid:=fmz_accounting.owner_org();person:=d.data->'person';perform fmz_members.validate_person(person);\n    perform fmz_members.guard_health", "oid:=fmz_accounting.owner_org();person:=d.data->'person';perform fmz_members.validate_person(person);perform owner_test.validate_duo(d.data,d.snapshot->'package',p.id);\n    perform fmz_members.guard_health");
  command=replace(command,"coalesce(w->'clients','[]')||jsonb_build_array(c)","coalesce(w->'clients','[]')||jsonb_build_array(c)||case when d.snapshot ? 'duo' then jsonb_build_array(owner_test.duo_client(d.data->'duoPerson',d.snapshot->'package',d.client_id||'-duo')) else '[]'::jsonb end");
  command=replace(command,"result:=jsonb_build_object('ok',true,'client_id',d.client_id,'contract_id',d.id,'number',d.snapshot->>'number');", "if d.snapshot ? 'duo' then insert into fmz_members.events(trainer_id,client_id,draft_id,actor_id,action,after_data) values(p.id,d.client_id||'-duo',d.id,p.id,'duo_enrollment_completed',jsonb_build_object('contract_id',d.id,'primary_client_id',d.client_id,'document_id',a.id));end if; result:=jsonb_build_object('ok',true,'client_id',d.client_id,'contract_id',d.id,'number',d.snapshot->>'number');");
  read=replace(read,"where k.trainer_id=tid and k.client_id=cid)","where k.trainer_id=tid and (k.client_id=cid or k.snapshot#>>'{duo,secondClientId}'=cid))");
  read=replace(read,"'managed',exists(select 1 from fmz_members.contracts where trainer_id=tid and client_id=cid)","'managed',exists(select 1 from fmz_members.contracts where trainer_id=tid and (client_id=cid or snapshot#>>'{duo,secondClientId}'=cid))");
  health=replace(health,"where trainer_id=tid and client_id=cid)","where trainer_id=tid and (client_id=cid or snapshot#>>'{duo,secondClientId}'=cid))");
  storage=replace(storage,"fmz_members.allowed(a.trainer_id,a.client_id) and ((a.kind='photo'", "(fmz_members.allowed(a.trainer_id,a.client_id) or (p.role='client' and p.trainer_id=a.trainer_id and exists(select 1 from fmz_members.contracts k where k.document_id=a.id and k.snapshot#>>'{duo,secondClientId}'=p.client_id))) and ((a.kind='photo'");
  await db.exec('begin');try{
   await db.exec(`create function owner_test.duo_client(person jsonb,package jsonb,cid text) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('id',cid,'name',concat_ws(' ',person->>'firstName',nullif(person->>'insertion',''),person->>'lastName'),'email',fmz_members.clean(person->>'email'),'startDate',person->>'startDate','goal',coalesce(person->>'goal',''),'profile',person||jsonb_build_object('package',package->>'id','address',concat_ws(' ',person->>'street',person->>'houseNumber')),'goals','{}'::jsonb,'trainingPlan','[]'::jsonb,'nutritionPlan','[]'::jsonb,'foodLog','[]'::jsonb,'appointments','[]'::jsonb)$$;
   create function owner_test.validate_duo(data jsonb,package jsonb,tid uuid) returns void language plpgsql security definer set search_path='' as $$declare partner jsonb:=data->'duoPerson';begin
    if package->>'mode'<>'duo' then return;end if;
    perform fmz_members.validate_person(partner);
    if (package->>'cents')::bigint%2<>0 then raise exception 'Duobedrag kan niet exact op centen worden verdeeld';end if;
    if partner->>'startDate' is distinct from data#>>'{person,startDate}' then raise exception 'Beide duodeelnemers moeten dezelfde startdatum hebben';end if;
    if fmz_members.clean(partner->>'email')=fmz_members.clean(data#>>'{person,email}') or fmz_members.phone(partner->>'phone')=fmz_members.phone(data#>>'{person,phone}') then raise exception 'Kies twee verschillende personen' using errcode='23505';end if;
    perform pg_advisory_xact_lock(hashtextextended(fmz_members.clean(partner->>'email'),0));
    if exists(select 1 from fmz_members.directory where email=fmz_members.clean(partner->>'email') or (trainer_id=tid and phone=fmz_members.phone(partner->>'phone'))) or exists(select 1 from auth.users where lower(email)=fmz_members.clean(partner->>'email')) then raise exception 'Tweede deelnemer bestaat mogelijk al; open het bestaande profiel' using errcode='23505';end if;
    if length(trim(coalesce(partner->>'injuries','')))>0 then raise exception 'Deze testroute verzamelt nog geen gezondheidsinformatie van een tweede deelnemer';end if;
   end$$;
   revoke all on function owner_test.duo_client(jsonb,jsonb,text),owner_test.validate_duo(jsonb,jsonb,uuid) from public,anon,authenticated;`);
   await db.exec(command);await db.exec(read);await db.exec(storage);await db.exec(health);await db.exec('commit');
  }catch(e){await db.exec('rollback');throw e;}
 }
 const api={install};if(typeof module!=='undefined')module.exports=api;else root.OwnerTestDuo=api;
})(typeof window==='undefined'?globalThis:window);

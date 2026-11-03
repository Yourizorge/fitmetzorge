/* Synthetic browser-only adapter. No network, Supabase credentials, production API or service worker. */
(function(root){
 'use strict';
 const IDS={trainer:'11111111-1111-4111-8111-111111111111',a:'22222222-2222-4222-8222-222222222222',b:'33333333-3333-4333-8333-333333333333'};
 const copy=value=>structuredClone(value),uuid=()=>crypto.randomUUID();
 const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 const failure=(message,code='OWNER_TEST_ONLY')=>({data:null,error:{message,code}});
 async function create(options){
  if(!options?.PGlite||!(options.seed instanceof Blob)||typeof options.persist!=='function')throw Error('Geïsoleerde testdatabaseconfiguratie ontbreekt.');
  const restored=options.restore;if(restored&&(restored.version!==1||restored.synthetic!==true||!(restored.dump instanceof Blob)||!/^TEST-[-a-zA-Z0-9]{8,75}$/.test(restored.runId)))throw Error('Testcheckpoint ongeldig; geen productie-import toegestaan.');
  let db,runId=restored?.runId||'TEST-'+uuid(),fakeActor=restored?restored.fakeActor:'trainer',guide=copy(restored?.guide||{version:1,step:0,done:[],skipped:[]}),simulation=copy(restored?.simulation||{sent:[],history:[],reminders:[],receipts:{}}),revision=restored?.revision||0,queue=Promise.resolve(),closed=false,dirty=false;
  const blobs=new Map(restored?.blobs||[]),urls=new Set(),listeners=new Set(),authListeners=new Set();
  if(fakeActor!==null&&!Object.hasOwn(IDS,fakeActor))throw Error('Alleen synthetische testaccounts zijn toegestaan.');
  async function open(dump){db=new options.PGlite({loadDataDir:dump,pgliteWasmModule:options.pgliteWasmModule,initdbWasmModule:options.initdbWasmModule,fsBundle:options.fsBundle});await db.waitReady;const marker=(await db.query('select * from owner_test.metadata')).rows;if(marker.length!==1||marker[0].fixture!=='APPFMZ-SYNTHETIC-OWNER-TEST'||marker[0].production!==false)throw Error('Dit is geen gecontroleerde synthetische testdatabase.');}
  await open(restored?.dump||options.seed);
  const duo=options.duo||root.OwnerTestDuo||(typeof require==='function'?require('./duo.js'):null);if(duo)await duo.install(db);
  // Local seed/checkpoint only: no automatic communication may be created by enrollment.
  await db.exec('alter table fmz_members.contracts disable trigger appfmz_contract_communication');
  const emit=()=>listeners.forEach(fn=>{try{fn(getState());}catch{}});
  function getState(){return copy({version:1,synthetic:true,runId,fakeActor,guide,simulation,revision,dirty,closed});}
  function enqueue(fn){const task=queue.catch(()=>{}).then(()=>{if(closed)throw Error('Deze testrun is afgesloten.');return fn();});queue=task;return task;}
  async function snapshot(){return {version:1,synthetic:true,runId,fakeActor,guide:copy(guide),simulation:copy(simulation),revision,dump:await db.dumpDataDir('gzip'),blobs:copy(Array.from(blobs))};}
  async function persist(){dirty=true;emit();const value=await snapshot();try{await options.persist(value);dirty=false;emit();return value;}catch{throw Object.assign(Error('Testwijziging is verwerkt, maar veilig hervatten is nog niet bevestigd. Probeer opnieuw; sluit het testvenster nog niet.'),{code:'LOCAL_PERSIST'});}}
  const revoke=()=>{for(const url of urls)URL.revokeObjectURL(url);urls.clear();};
  async function actor(){if(!fakeActor)throw Object.assign(Error('Testsessie afgesloten; kies de synthetische trainer opnieuw.'),{code:'28000'});return (await db.query('select * from public.profiles where id=$1',[IDS[fakeActor]])).rows[0];}
  async function as(sql,params=[]){const account=await actor();await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:account.id,session_id:account.id,email:account.email})]);await db.exec('set role authenticated');try{return await db.query(sql,params);}finally{await db.exec('reset role');}}
  const scalar=async(sql,params)=>(await as(sql,params)).rows[0]?.result;
  const bucketKey=(bucket,path)=>{if(!['fmz-members','fmz-finance'].includes(bucket)||typeof path!=='string'||path.length>1000||path.includes('..')||path.startsWith('/'))throw Error('Ongeldig testbestandspad.');return bucket+'/'+path;};
  async function allowedBlob(bucket,path){const key=bucketKey(bucket,path),visible=(await as('select name from storage.objects where bucket_id=$1 and name=$2',[bucket,path])).rows;if(!visible.length||!blobs.has(key))throw Object.assign(Error('Dit testbestand is niet toegankelijk.'),{code:'42501'});return blobs.get(key);}
  async function verifyAsset(payload){
   const deleting=payload.action==='delete_draft',asset=await scalar('select public.fmz_members_read($1,$2) result',[deleting?'cleanup_asset':'asset',JSON.stringify({id:payload.id})]);if(!asset)throw Error('Testbestand niet beschikbaar.');
   const key=bucketKey('fmz-members',asset.path);
   if(deleting||payload.action==='delete_photo'){
    if(asset.kind!==(deleting?'agreement':'photo')||!['retired','deleted'].includes(asset.status))throw Error('Alleen een ingetrokken testbestand mag worden verwijderd.');
    await db.query('delete from storage.objects where bucket_id=$1 and name=$2',['fmz-members',asset.path]);blobs.delete(key);
    await db.query(deleting?'select public.fmz_member_draft_asset_deleted($1)':'select public.fmz_member_photo_deleted($1)',[asset.id]);return {ok:true};
   }
   const object=blobs.get(key);if(!object)throw Error('Testupload ontbreekt.');const bytes=Uint8Array.from(object.bytes),sha=await digest(bytes);
   if(sha!==asset.sha256||bytes.length!==Number(asset.bytes))throw Error('Bestandsinhoud wijkt af van de testregistratie.');
   const library=options.PDFLib||root.PDFLib;
   if(asset.kind==='agreement'){
    const stored=await scalar("select public.fmz_members_read('document_snapshot',$1) result",[JSON.stringify({id:asset.draft_id})]);const renderer=options.renderer||root.FMZMemberDocuments;if(!renderer||!library)throw Error('Lokale PDF-controle nog niet geladen.');const expected=await renderer.pdf(stored,library,stored.owner_test_branding);if(expected.length!==bytes.length||await digest(expected)!==sha)throw Error('PDF wijkt af van de ondertekende testversie.');
   }else{const check=options.verifyImage||root.FMZMemberVerifyImage;if(!check||!library)throw Error('Lokale fotocontrole nog niet geladen.');await check(bytes,asset.mime,library);}
   const confirmed=(await db.query('select public.fmz_member_verify_asset($1,$2,$3) result',[asset.id,sha,bytes.length])).rows[0].result;return {ok:true,asset:confirmed};
  }
  const READS=new Set(['fmz_billing_planning_read','fmz_communication_read','fmz_billing_reminders_read','fmz_accounting_read','fmz_agenda_read']);
  const COMMANDS=new Set(['fmz_members_command','fmz_billing_planning_command','fmz_communication_command','fmz_billing_reminders_command','fmz_billing_command','fmz_accounting_command','fmz_vat_command','fmz_bank_repair_command','fmz_payment_command','fmz_agenda_command']);
  async function dispatch(name,params={}){
   if(['fmz_billing_planning_read','fmz_billing_planning_command','fmz_communication_read','fmz_communication_command','fmz_billing_reminders_command'].includes(name))throw Error('Facturatieplanning en automatische communicatie zijn uitgeschakeld in deze owner-test.');
   if(READS.has(name))return {data:await scalar(`select public.${name}() result`,[]),write:false};
   if(name==='fmz_members_read'){let data=await scalar('select public.fmz_members_read($1,$2) result',[params.action,JSON.stringify(params.payload||{})]);const statusModel=options.memberStatus||root.OwnerTestMemberStatus;if(statusModel&&(await actor()).role==='trainer')data=statusModel.project(simulation,params.action,data);return {data,write:false};}
   if(COMMANDS.has(name)){let data=await scalar(`select public.${name}($1,$2,$3) result`,[params.action,JSON.stringify(params.payload||{}),params.request_id]);if(name==='fmz_members_command'&&params.action==='review'&&options.branding&&data?.status==='review'&&data.id===params.payload?.id){const current=(await db.query("select snapshot from fmz_members.drafts d where d.id=$1 and d.trainer_id=$2 and d.status='review' and not exists(select 1 from fmz_members.contracts k where k.id=d.id)",[data.id,(await actor()).id])).rows[0];if(current){const branding=current.snapshot.owner_test_branding||copy(options.branding);const snapshot={...current.snapshot,owner_test_branding:branding};await db.query('update fmz_members.drafts set snapshot=$1 where id=$2',[JSON.stringify(snapshot),data.id]);data={...data,snapshot};}}return {data,write:true};}
   if(['fmz_bank_repair_preview','fmz_vat_preview'].includes(name))return {data:await scalar(`select public.${name}($1,$2) result`,[params.action,JSON.stringify(params.payload||{})]),write:false};
   if(name==='profile')return {data:(await as('select * from public.profiles where id=auth.uid()')).rows[0],write:false};
   if(name==='fmz_read_workspace')return {data:{...(await scalar('select public.fmz_read_workspace() result',[])),profile_id:IDS[fakeActor]},write:false};
   if(name==='fmz_save_changes')return {data:await scalar('select public.fmz_save_changes($1) result',[JSON.stringify(params.changes)]),write:true};
   if(name==='fmz_save_changes_once')return {data:await scalar('select public.fmz_save_changes_once($1,$2) result',[JSON.stringify(params.changes),params.request_id]),write:true};
   if(name==='fmz_photo_annotation')return {data:await scalar('select public.fmz_photo_annotation($1,$2,$3,$4,$5,$6,$7,$8,$9) result',[params.client_id,params.week,params.day,params.slot,params.source_hash||null,params.action||'read',JSON.stringify(params.strokes||[]),params.expected_version||0,params.request_id||null]),write:params.action&&params.action!=='read'};
   if(name==='member_verify')return {data:await verifyAsset(params),write:true};
   if(name==='storage_upload'){
    const key=bucketKey(params.bucket,params.path);if(blobs.has(key))throw Object.assign(Error('Dit testbestand bestaat al.'),{code:'23505'});const bytes=Uint8Array.from(params.bytes);if(!bytes.length||bytes.length>12000000)throw Error('Testbestand is leeg of te groot.');await as('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',[params.bucket,params.path,JSON.stringify({size:bytes.length,mimetype:params.mime})]);blobs.set(key,{bytes,mime:params.mime});return {data:{path:params.path},write:true};
   }
   if(name==='storage_download'||name==='storage_sign'){
    const object=await allowedBlob(params.bucket,params.path),blob=new Blob([object.bytes],{type:object.mime});if(name==='storage_download')return {data:blob,write:false};const url=URL.createObjectURL(blob);urls.add(url);setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},Math.min(Math.max(params.seconds||60,1),300)*1000);return {data:{signedUrl:url},write:false};
   }
   throw Error('Deze route is niet beschikbaar in de synthetische test.');
  }
  async function rpc(name,params={}){return enqueue(async()=>{try{const result=await dispatch(name,params);if(result.write){revision++;await persist();}return {data:result.data instanceof Blob?result.data:result.data===undefined?null:JSON.parse(JSON.stringify(result.data)),error:null};}catch(e){return failure(e.message,e.code||'OWNER_TEST_ONLY');}});}
  function syntheticUser(){if(!fakeActor)return null;return {id:IDS[fakeActor],email:({trainer:'trainer',a:'noor',b:'sam'}[fakeActor])+'@example.test',user_metadata:{name:'Fictieve testgebruiker'},aud:'owner-test'};}
  const session=()=>syntheticUser()?{user:syntheticUser(),access_token:'SYNTHETIC-NOT-A-REAL-TOKEN',expires_at:Math.floor(Date.now()/1000)+3600}:null;
  async function changeActor(next){return enqueue(async()=>{fakeActor=next;revoke();revision++;await persist();for(const fn of authListeners)fn(next?'SIGNED_IN':'SIGNED_OUT',session());return {data:{session:session(),user:syntheticUser()},error:null};});}
  const sdk={rpc,functions:{invoke:async(name,config={})=>name==='member-assets'?rpc('member_verify',config.body||{}):failure('Echte account-, e-mail- en pushfuncties zijn uitgeschakeld in TESTMODUS.')},
   storage:{from:bucket=>({upload:async(path,bytes,config={})=>rpc('storage_upload',{bucket,path,bytes:new Uint8Array(bytes instanceof Blob?await bytes.arrayBuffer():bytes),mime:config.contentType||'application/octet-stream'}),download:path=>rpc('storage_download',{bucket,path}),createSignedUrl:(path,seconds)=>rpc('storage_sign',{bucket,path,seconds})})},
   from:table=>{let valid=table==='profiles';return {select(){return this;},eq(key,value){if(key!=='id'||value!==IDS[fakeActor])valid=false;return this;},maybeSingle(){return valid?rpc('profile'):Promise.resolve(failure('Alleen het eigen synthetische profiel is beschikbaar.'));}};},
   auth:{getSession:async()=>({data:{session:session()},error:null}),getUser:async()=>({data:{user:syntheticUser()},error:fakeActor?null:{message:'Geen testsessie'}}),onAuthStateChange:fn=>{authListeners.add(fn);return {data:{subscription:{unsubscribe:()=>authListeners.delete(fn)}}};},signInWithPassword:({email})=>{const aliases={'trainer@example.test':'trainer','a@example.test':'a','noor@example.test':'a','b@example.test':'b','sam@example.test':'b'};return Object.hasOwn(aliases,email)?changeActor(aliases[email]):Promise.resolve(failure('Gebruik uitsluitend een fictief testaccount.'));},signOut:()=>changeActor(null),signUp:async()=>failure('Geen echt account in TESTMODUS.'),resetPasswordForEmail:async()=>failure('Geen e-mail in TESTMODUS.'),updateUser:async()=>failure('Geen echt wachtwoord in TESTMODUS.')}
  };
  async function inventoryRaw(){
   const query=async sql=>(await db.query(sql)).rows;
   const result={runId,revision,synthetic:true,members:await query('select client_id as id,name as label,member_number,status from fmz_members.directory order by member_number'),contracts:await query('select id,number,client_id from fmz_members.contracts order by number'),documents:await query('select id,kind,path,status,sha256 from fmz_members.assets order by path'),invoices:await query("select id,number,status,data->>'description' as label from fmz_accounting.records where kind='invoice' order by created_at,id"),messages:await query('select id,document_id,recipient,subject as label,status from fmz_communication.messages order by id'),reminders:await query('select id,task_id,kind,period_start,period_end from fmz_communication.reminders order by id'),blobs:Array.from(blobs,([path,value])=>({path,bytes:value.bytes.length,mime:value.mime})).sort((a,b)=>a.path.localeCompare(b.path)),sessions:await query('select id,user_id from auth.sessions order by id'),drafts:await query("select id,status,data#>>'{person,firstName}' as label from fmz_members.drafts order by id")};
   result.preliminary=await query('select id,version,recipient,subject as label from fmz_communication.preliminary order by id');
   result.files=await query("select id,record_id,original_name as label,mime,bytes,sha256,path,status,'fmz-finance' as bucket from fmz_accounting.files order by id");
   result.communicationDocuments=await query("select id,kind,client_id,recipient,bucket,path,sha256,bytes,name,metadata,'application/pdf' as mime from fmz_communication.documents order by kind,id");
   result.simulationRecords=['sent','history','reminders'].flatMap(kind=>(simulation[kind]||[]).map((item,index)=>({...copy(item),id:kind+':'+index,simulationKind:kind})));
   if(root.OwnerTestMemberStatus)result.members=result.members.map(m=>({...m,status:root.OwnerTestMemberStatus.at(simulation,m.id,m.status).status}));
   result.calendarViews=guide.calendarViews?[{id:'calendar-views',data:copy(guide.calendarViews)}]:[];
   result.memberStatusEvents=Object.values(simulation.memberStatus||{}).flatMap(x=>copy(x.events||[]));
   result.statusReceipts=Object.entries(simulation.statusReceipts||{}).map(([id,value])=>({id,...copy(value)}));
   result.calendarCompletions=Object.values(simulation.calendarCompleted||{}).map(copy);
   result.schemaDrafts=guide.schemaBuilder?[{id:'schema-builder',label:'Schema builder — lokaal testschema en koppelingen',data:copy(guide.schemaBuilder)}]:[];
   for(const key of ['schemaCopies','schemaGeneralDraft'])if(guide[key])result.schemaDrafts.push({id:key,label:key==='schemaCopies'?'Schemakopieën, versies en audit':'Algemeen schemaconcept',data:copy(guide[key])});
   result.hash=await digest(new TextEncoder().encode(JSON.stringify(result)));return result;
  }
  async function reset(expected){return enqueue(async()=>{const before=await inventoryRaw();if(!expected||expected.runId!==runId||expected.hash!==before.hash)throw Error('Testgegevens zijn veranderd. Bekijk de verwijderlijst opnieuw.');const oldRun=runId;
   const remove=options.removeRun||options.remove;if(typeof remove!=='function')throw Error('Veilige verwijdering is nog niet aangesloten; er is niets verwijderd.');await remove(oldRun);closed=true;await db.close();revoke();blobs.clear();fakeActor=null;guide={version:1,step:0,done:[],skipped:[]};simulation={sent:[],history:[],reminders:[],receipts:{}};dirty=false;emit();return {before,after:{runId:oldRun,members:[],contracts:[],documents:[],invoices:[],messages:[],reminders:[],blobs:[],sessions:[],drafts:[],preliminary:[],files:[],communicationDocuments:[],simulationRecords:[],schemaDrafts:[],calendarViews:[],memberStatusEvents:[],statusReceipts:[],calendarCompletions:[],deleted:true,verification:"Isolated database instance closed; host checkpoint removal acknowledged. This is not a SQL query after deletion."},deletedRunId:oldRun};});}
  const api={sdk,getState,onChange:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},checkpoint:()=>enqueue(()=>persist()),inventory:()=>enqueue(inventoryRaw),manifest:()=>enqueue(inventoryRaw),reset,
   patchGuide:patch=>enqueue(async()=>{const value={...guide,...copy(patch)};if(!value||value.version!==1||JSON.stringify(value).length>100000)throw Error('Ongeldige testvoortgang.');guide=value;revision++;await persist();return copy(guide);}),
   setGuide:value=>enqueue(async()=>{if(!value||value.version!==1||JSON.stringify(value).length>100000)throw Error('Ongeldige testvoortgang.');guide=copy(value);revision++;await persist();return copy(guide);}),
   memberStatusRead:(clientId,on)=>enqueue(async()=>{const helper=options.memberStatus||root.OwnerTestMemberStatus;if(!helper)throw Error('Lokale statusmodule ontbreekt.');return helper.read({db,simulation,runId,actor:await actor()},clientId,on);}),
   memberStatusCommand:(payload,requestId)=>enqueue(async()=>{const helper=options.memberStatus||root.OwnerTestMemberStatus;if(!helper)throw Error('Lokale statusmodule ontbreekt.');const result=await helper.command({db,simulation,runId,actor:await actor()},payload,requestId);revision++;await persist();return result;}),
   reminderCalendar:(range)=>enqueue(async()=>{const helper=options.simulator||root.OwnerTestSimulation;return helper.calendar({db,simulation,runId,actor:await actor()},range);}),
   reminderPeriods:(asOf)=>enqueue(async()=>{const helper=options.simulator||root.OwnerTestSimulation;return helper.readPeriods({db,actor:await actor()},asOf);}),
   simulate:(action,payload,requestId)=>enqueue(async()=>{const helper=options.simulator||root.OwnerTestSimulation;if(!helper?.run)throw Error('De lokale simulatiemodule is nog niet beschikbaar.');const result=await helper.run({db,blobs,simulation,runId,actor:await actor()},action,payload,requestId);revision++;await persist();return result;}),
   close:()=>enqueue(async()=>{await persist();await db.close();closed=true;revoke();fakeActor=null;authListeners.clear();listeners.clear();})};
  // Explicit fixed synthetic agreements for the two fixture members, including restored v1 runs.
  // No existing agreement is replaced and no invoice/payment is prepared.
  let fixtureAdded=false;
  if(fakeActor==='trainer')for(const [clientId,cycle,start]of [['TEST-NOOR','four_weeks','2026-11-02'],['TEST-SAM','calendar_month','2026-11-01']]){
   const exists=(await db.query('select 1 from fmz_accounting.agreement_versions where client_id=$1',[clientId])).rows.length;
   const member=(await db.query('select 1 from fmz_members.directory where client_id=$1 and trainer_id=$2',[clientId,IDS.trainer])).rows.length;
   if(!exists&&member){await db.query("insert into fmz_accounting.agreement_versions(org_id,client_id,version,effective_from,cycle,package_id,package_label,amount_cents,sessions,enabled,origin,reason,created_by) select o.id,$1,1,$2::date,$3,'pt-basis',c->>'label',(c->>'cents')::bigint,(c->>'sessions')::integer,true,'owner-test-fixture','Vaste fictieve betaalafspraak voor owner-herinneringentest',o.owner_id from fmz_accounting.organizations o cross join lateral fmz_accounting.billing_catalog('pt-basis') c where o.owner_id=$4",[clientId,start,cycle,IDS.trainer]);fixtureAdded=true;}
  }
  if(!restored||fixtureAdded)await persist();return api;
 }
 const api={create};if(typeof module!=='undefined')module.exports=api;else root.OwnerTestDatabase=api;
})(typeof globalThis==='undefined'?window:globalThis);

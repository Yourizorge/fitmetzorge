const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{chromium}=require('playwright');
test('rendered owner profile preserves unfinished coaching input and identity when navigation is refused',{timeout:30000},async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.setContent('<main><section id="clients"></section></main>');
  await page.evaluate(()=>{
   window.escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   window.onlineProfile={id:'synthetic-trainer',role:'trainer'};window.state={ui:{selectedClientId:''}};window.allowed=true;window.profileReads=[];window.routeCalls=[];window.unmounts=0;
   window.showView=id=>{routeCalls.push(id);return allowed;};
   window.OwnerTestMemberViews={unmount:()=>{unmounts++;},mount:({target})=>{target.innerHTML='<label>Onvolledige coachinginvoer<textarea aria-label="Onvolledige coachinginvoer"></textarea></label>';}};
   window.supabaseClient={rpc:async(name,{action,payload})=>{if(name!=='fmz_members_read'||action!=='profile')throw Error('Unexpected RPC');profileReads.push(payload.client_id);return{data:{member:{client_id:payload.client_id,name:payload.client_id==='noor'?'Noor Voorbeeld':'Sam Test',member_number:payload.client_id==='noor'?1:2,status:'active',email:payload.client_id+'@example.test'},personal:{},documents:[],events:[]},error:null};}};
  });
  await page.addScriptTag({path:path.join(__dirname,'../members-model.js')});await page.addScriptTag({path:path.join(__dirname,'../members-ui.js')});
  await page.evaluate(()=>FMZMembers.openProfile('noor','coaching'));await page.locator('textarea').fill('Nog niet afgerond — 12,');
  const before=await page.evaluate(()=>{window.originalProfile=document.querySelector('.members-profile-page');window.allowed=false;return{reads:profileReads.length,unmounts};});
  await page.evaluate(()=>FMZMembers.openProfile('sam'));
  assert.deepEqual(await page.evaluate(()=>({sameDOM:document.querySelector('.members-profile-page')===originalProfile,selected:state.ui.selectedClientId,reads:profileReads.length,unmounts,input:document.querySelector('textarea')?.value,route:routeCalls.at(-1)})),{sameDOM:true,selected:'noor',reads:before.reads,unmounts:before.unmounts,input:'Nog niet afgerond — 12,',route:'clients'});
  assert.match(await page.locator('.members-profile-head').innerText(),/Noor Voorbeeld/);
  await page.evaluate(async()=>{allowed=true;await FMZMembers.openProfile('sam');});assert.equal(await page.evaluate(()=>state.ui.selectedClientId),'sam');assert.equal(await page.evaluate(()=>profileReads.length),before.reads+1);assert.match(await page.locator('.members-profile-head').innerText(),/Sam Test/);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

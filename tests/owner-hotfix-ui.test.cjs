const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{start}=require('./preview.cjs');
test('owner hotfix: actual goal controls bind to the selected client and survive server reload',{timeout:120000},async()=>{
 const live=process.env.FMZ_LIVE_TESTS==='1',preview=live?null:await start(0),url=live?process.env.FMZ_RELEASE_URL:preview.url,account=live?JSON.parse(fs.readFileSync('C:/Users/Fitme/.codex/backups/appfmz-20260908/synthetic-accounts.json')).accounts.trainer:{email:'trainer@example.test',password:'test'},browser=await chromium.launch({headless:true,channel:'msedge'}),p=await browser.newPage({viewport:{width:390,height:844}});
 const read=async()=>live?await p.evaluate(async()=>{const r=await supabaseClient.rpc('fmz_read_workspace');if(r.error)throw Error(r.error.message);return r.data.state;}):await preview.database.read('trainer');const saveRoute=live?'**/rest/v1/rpc/fmz_save_changes_once':'**/__test__/rpc';
 try{
  if(!live)await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());await p.goto(url);
  await p.locator('#loginForm select[name=role]').selectOption('trainer');await p.locator('#loginForm input[name=email]').fill(account.email);await p.locator('#loginForm input[name=password]').fill(account.password);await p.locator('#loginForm button[type=submit]').click();await p.waitForFunction(()=>onlineReady&&FMZAccounting.ready);
  await p.evaluate(()=>{state.ui.selectedClientId='a';showView('clients')});await p.locator('[data-edit-goals="a"]').click();
  const f=p.locator('#goalForm');await f.locator('[name=package]').selectOption('pt-progressie');await f.locator('[name=goal]').fill('Synthetic first goal');
  await p.waitForTimeout(1000);let stored=await read();assert.equal(stored.clients.find(c=>c.id==='a').profile.package,'pt-progressie','package must reach the actual server through the visible select');
  assert.equal(stored.clients.find(c=>c.id==='a').goal,'Synthetic first goal');assert.equal(await f.locator('[type=submit]').isVisible(),true);
  await p.locator('#clientSelect').selectOption('b');await f.locator('[name=package]').selectOption('pt-transformatie');await f.locator('[name=goal]').fill('Synthetic second goal');await f.locator('[type=submit]').click();
  await p.waitForFunction(()=>!hasPendingChanges());stored=await read();assert.equal(stored.clients.find(c=>c.id==='b').profile.package,'pt-transformatie');assert.equal(stored.clients.find(c=>c.id==='a').goal,'Synthetic first goal');
  await p.reload();await p.waitForFunction(()=>onlineReady);assert.equal(await p.evaluate(()=>state.clients.find(c=>c.id==='b').goal),'Synthetic second goal');
  await p.evaluate(()=>{state.ui.selectedClientId='b';showView('clients')});let fail=true,count=0;
  await p.route(saveRoute,r=>{if(live||r.request().postDataJSON().name==='fmz_save_changes_once'){count++;if(fail)return r.abort();}return r.continue();});
  await f.locator('[name=goal]').fill('Synthetic retained after offline');await p.waitForFunction(()=>document.querySelector('[data-goal-status]').textContent==='Opslaan mislukt — opnieuw proberen');await p.waitForTimeout(900);assert.equal(count,1);
  p.once('dialog',d=>d.dismiss());await p.evaluate(()=>showView('training'));assert.equal(await p.evaluate(()=>currentView),'clients');assert.equal(await f.locator('[name=goal]').inputValue(),'Synthetic retained after offline');
  fail=false;await f.locator('[type=submit]').click();await p.waitForFunction(()=>!hasPendingChanges());assert.equal((await read()).clients.find(c=>c.id==='b').goal,'Synthetic retained after offline');await p.unroute(saveRoute);
  await f.locator('[name=water]').fill('2,');await f.locator('[type=submit]').click();assert.equal(await f.locator('[name=water]').inputValue(),'2,');assert.notEqual((await read()).clients.find(c=>c.id==='b').goals.water,0);
  await f.locator('[name=water]').fill('2,8');await f.locator('[type=submit]').click();await p.waitForFunction(()=>!hasPendingChanges());
  await p.locator('#logoutButton').click();await p.waitForFunction(()=>!onlineReady);await p.locator('#loginForm select[name=role]').selectOption('trainer');await p.locator('#loginForm input[name=email]').fill(account.email);await p.locator('#loginForm input[name=password]').fill(account.password);await p.locator('#loginForm button[type=submit]').click();await p.waitForFunction(()=>onlineReady);assert.equal(await p.evaluate(()=>state.clients.find(c=>c.id==='b').goal),'Synthetic retained after offline');
 }finally{await browser.close();await preview?.close();}
});

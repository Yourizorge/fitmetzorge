const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {start}=require('./preview.cjs');
const {chromium}=require('playwright');
test('browser + isolated PostgreSQL: persistence, trainer refresh, session privacy, XSS and compact images',async()=>{
 const preview=await start(0); const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}); const errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1400,height:950}});
  await context.route('**/*',route=>route.request().url().startsWith(preview.url)?route.continue():route.abort());
  const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
  await page.goto(preview.url);
  async function login(p,account,role){await p.locator('#loginForm select[name=role]').selectOption(role);await p.locator('#loginForm input[name=email]').fill(account+'@example.test');await p.locator('#loginForm input[name=password]').fill('test');await p.locator('#loginForm button[type=submit]').click();await p.waitForFunction(()=>document.body.classList.contains('logged-in'));}
  await login(page,'a','client');
  await page.evaluate(()=>{state.ui.trackingWeekStart='2026-09-07';state.ui.trainingDay='Dinsdag';state.ui.trackerDayIndex=1;renderAll();showView('training')});
  await page.locator('[data-training-log="0:actualWeight"]').fill('72.5');

  await page.waitForFunction(()=>!hasPendingChanges() && document.querySelector('#syncStatus').textContent==='Opgeslagen');
  await page.reload(); await page.waitForFunction(()=>document.body.classList.contains('logged-in'));
  assert.equal(await page.evaluate(()=>client().trainingPlan[0].logsByWeek['2026-09-07'].actualWeight),'72.5');
  await page.evaluate(async()=>{state.ui.trackingWeekStart='2026-09-07';state.ui.trackerDayIndex=1;renderAll();showView('nutrition');});
  await page.locator('[data-food-note="2026-09-08:lunch"]').fill('<img src=x onerror="window.XSS=true">');
  await page.locator('[data-food-status="2026-09-08:lunch"]').selectOption('Anders gegeten');

  await page.waitForFunction(()=>!hasPendingChanges() && document.querySelector('#syncStatus').textContent==='Opgeslagen');
  assert.equal(await page.evaluate(()=>window.XSS),undefined);
  await page.evaluate(()=>{showView('trackers');renderTrackersOverview()});
  await page.locator('#trackers [data-step-index="1"]').fill('13000');

  await page.locator('#trackers [data-sleep="1:hours"]').selectOption('8');

  await page.waitForFunction(()=>!hasPendingChanges() && document.querySelector('#syncStatus').textContent==='Opgeslagen');
  assert.equal(await page.evaluate(()=>client().sleepByWeek['2026-09-07'][1].hours),'8');
  const trainer=await context.newPage();trainer.on('pageerror',e=>errors.push(e.message));await trainer.goto(preview.url);await login(trainer,'trainer','trainer');
  assert.equal(await trainer.evaluate(()=>state.clients.find(c=>c.id==='a').trainingPlan[0].logsByWeek['2026-09-07'].actualWeight),'72.5');
  await page.evaluate(async()=>{client().stepsByWeek['2026-09-07'][1].value='14000';await saveStateToCloud()});
  await trainer.locator('#refreshWorkspace').click();
  await trainer.waitForFunction(()=>state.clients.find(c=>c.id==='a').stepsByWeek['2026-09-07'][1].value==='14000');
  await trainer.evaluate(()=>{state.ui.selectedClientId='a';state.ui.trainingDay='Dinsdag';renderAll();showView('training')});
  const width=await trainer.locator('.training-exercise-card .exercise-photo').first().evaluate(e=>e.getBoundingClientRect().width);assert(width>=96&&width<=120);
  fs.mkdirSync('tests/artifacts',{recursive:true});await trainer.screenshot({path:'tests/artifacts/trainer-desktop.png',fullPage:true});
  await trainer.setViewportSize({width:390,height:844});await trainer.locator('.training-exercise-card').first().scrollIntoViewIfNeeded();await trainer.screenshot({path:'tests/artifacts/trainer-mobile.png'});
  const mobileWidth=await trainer.locator('.training-exercise-card .exercise-photo').first().evaluate(e=>e.getBoundingClientRect().width);assert(mobileWidth>=96&&mobileWidth<=120);
  await page.evaluate(()=>window.expireTestSession());
  assert.equal(await page.evaluate(()=>state.ui.loggedIn),false);assert.equal(await page.evaluate(()=>state.clients.length),0);
  await login(page,'b','client');assert.equal(await page.evaluate(()=>state.clients.length),1);assert.equal(await page.evaluate(()=>client().id),'b');assert(!await page.locator('body').innerText().then(t=>t.includes('<img src=x')));
  await page.locator('#logoutButton').click();await login(page,'a','client');
  assert.equal(await page.evaluate(()=>client().trainingPlan[0].logsByWeek['2026-09-07'].actualWeight),'72.5');
  // Zero-row and network failures must retain input without a success indication.
  await page.route('**/__test__/rpc',route=>{
    const body=route.request().postDataJSON();
    return body.name==='fmz_save_changes_once'?route.fulfill({json:{data:{ok:true,changed:0},error:null}}):route.continue();
  });
  const failed=await page.evaluate(async()=>{client().trainingPlan[0].logsByWeek['2026-09-07'].actualWeight='99';return (await saveStateToCloud()).ok});
  assert.equal(failed,false);assert.equal(await page.evaluate(()=>client().trainingPlan[0].logsByWeek['2026-09-07'].actualWeight),'99');
  assert.match(await page.locator('#syncStatus').getAttribute('title'),/bevestiging/);
  await page.evaluate(()=>{renderAll()});assert.notEqual(await page.locator('#syncStatus').innerText(),'Online opgeslagen');
  await page.unroute('**/__test__/rpc');
  await page.evaluate(async()=>{await saveStateToCloud()});
  const device2=await context.newPage();device2.on('pageerror',e=>errors.push(e.message));await device2.goto(preview.url);await login(device2,'a','client');
  await page.evaluate(async()=>{client().trainingPlan[0].logsByWeek['2026-09-07'].actualWeight='100';await saveStateToCloud()});
  assert.equal(await device2.evaluate(async()=>{client().trainingPlan[0].logsByWeek['2026-09-07'].actualWeight='80';return (await saveStateToCloud()).ok}),false);
  assert.match(await device2.locator('#syncStatus').getAttribute('title'),/Conflict/);
  assert.equal(await device2.evaluate(()=>client().trainingPlan[0].logsByWeek['2026-09-07'].actualWeight),'80');
  // Draft is restored only for the same account, never for B.
  await device2.evaluate(()=>expireTestSession());await login(device2,'b','client');assert.equal(await device2.evaluate(()=>client().id),'b');
  await device2.evaluate(()=>expireTestSession());await login(device2,'a','client');assert.equal(await device2.evaluate(()=>client().trainingPlan[0].logsByWeek['2026-09-07'].actualWeight),'80');
  const beforeRender=preview.calls.filter(c=>c.name==='fmz_save_changes_once').length;
  await page.evaluate(()=>{renderAll();renderAll();});await page.waitForTimeout(800);
  assert.equal(preview.calls.filter(c=>c.name==='fmz_save_changes_once').length,beforeRender);
  const blockedInvites=[];
  await trainer.route('**/functions/**',route=>{blockedInvites.push(route.request().url());return route.fulfill({json:{ok:true}})});
  await trainer.route('**/__test__/rpc',route=>route.request().postDataJSON().name==='fmz_save_changes_once'?route.fulfill({json:{data:null,error:{code:'42501',message:'Synthetic failure'}}}):route.continue());
  await trainer.evaluate(async()=>{const f=document.querySelector('#clientForm');f.elements.email.value='unsaved@example.test';f.elements.firstName.value='Unsaved';f.elements.lastName.value='Synthetic';f.elements.goal.value='Test';await addClient(f)});
  assert.equal(blockedInvites.length,0);assert.equal(await trainer.locator('#clientForm input[name=email]').inputValue(),'unsaved@example.test');
  assert.match(await trainer.locator('#clientInviteMessage').innerText(),/Niet voltooid/);
  const calendarChecks=await trainer.evaluate(()=>({
    rest:todayKcalGoal({goals:{kcalTraining:2500,kcalRest:2000},trainingPlan:[{day:'Zaterdag',published:true}]},new Date('2026-09-07T12:00:00')),
    train:todayKcalGoal({goals:{kcalTraining:2500,kcalRest:2000},trainingPlan:[{day:'Zaterdag',published:true}]},new Date('2026-09-12T12:00:00')),
    next:nextAppointment({appointments:[{id:'past',date:'2026-09-08',time:'09:00'},{id:'future',date:'2026-09-08',time:'15:00'}]},new Date('2026-09-08T12:00:00')).id
  }));assert.deepEqual(calendarChecks,{rest:2000,train:2500,next:'future'});
  const broken=await context.newPage();await broken.route('**/tests/mock-sdk.js',r=>r.fulfill({body:'/* SDK unavailable */',contentType:'text/javascript'}));await broken.goto(preview.url);
  assert.equal(await broken.evaluate(()=>document.body.classList.contains('logged-in')),false);assert.match(await broken.locator('#onlineStatus').innerText(),/geblokkeerd/);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await preview.close();}
});

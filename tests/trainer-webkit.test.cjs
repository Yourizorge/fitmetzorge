const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{webkit}=require('playwright'),{start}=require('./preview.cjs'),{seed,login}=require('./layout-fixture.cjs');
test('WebKit engine: phone/landscape/tablet/laptop, both roles, install help, focus and reload',{timeout:180000},async()=>{
 const preview=await start(0);await seed(preview);const browser=await webkit.launch({headless:true}),results=[],errors=[];
 try{
  for(const role of ['trainer','member']){
   const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});await context.route('**/*',r=>r.request().url().startsWith(preview.url)?r.continue():r.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(preview.url);await login(page,role);
   for(const [width,height]of [[320,740],[390,844],[844,390],[768,1024],[1400,950]])for(const light of [false,true]){
    await page.setViewportSize({width,height});await page.evaluate(light=>document.body.classList.toggle('light',light),light);
    for(const id of (role==='trainer'?['trainer-dashboard','training','training-log','clients','settings','administration']:['client-home','training','trackers'])){
     const nav=page.locator(`#nav [data-view="${id}"]`);if(!await nav.isVisible())await page.locator('[data-nav-menu-toggle]').click();await nav.click();await page.locator(`#${id}.active`).waitFor();
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${role}/${id}/${width}/${light} overflow`);
     if(id.includes('training'))assert(await page.locator('.view.active :is(.exercise-photo,.training-log-photo) img').evaluateAll(imgs=>imgs.every(img=>{const i=img.getBoundingClientRect(),p=img.parentElement.getBoundingClientRect();return i.width<=p.width&&i.height<=p.height&&getComputedStyle(img).objectFit==='contain';})));
     results.push({role,width,height,light,id,pass:true});
    }
   }
   await page.setViewportSize({width:390,height:844});await page.locator('.topbar [data-install-app]').click();assert(await page.locator('#installAppDialog').isVisible());await page.keyboard.press('Escape');assert(!await page.locator('#installAppDialog').isVisible());
   await page.evaluate(()=>showView('training'));const input=page.locator('[data-training-log="0:actualReps"]');await input.fill('8/8/8');await page.waitForFunction(()=>!hasPendingChanges());assert(await input.evaluate(e=>document.activeElement===e));await page.reload();await page.waitForFunction(()=>onlineReady);assert.equal(await page.evaluate(()=>client().trainingPlan[0].logsByWeek['2026-10-12'].actualReps),'8/8/8');await page.locator('#logoutButton').click();assert.equal(await page.evaluate(()=>state.clients.length),0);await context.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync('docs/examples/trainer-pwa-20261015/webkit-tests.json',JSON.stringify({engine:'Playwright WebKit 26.5 on Windows (not physical Safari/iPhone)',results,errors,pass:true},null,2));
 }finally{await browser.close();await preview.close();}
});

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {chromium}=require('playwright'),{start}=require('./preview.cjs'),{seed,login}=require('./layout-fixture.cjs');
const launch=()=>chromium.launch({headless:true,channel:'msedge'});
const out='docs/examples/trainer-pwa-20261015';
async function localPage(browser,preview,options={}){
 const context=await browser.newContext(options);
 await context.route('**/*',r=>r.request().url().startsWith(preview.url)?r.continue():r.abort());
 const page=await context.newPage();return page;
}
async function navigate(page,id){
 const button=page.locator(`#nav [data-view="${id}"]`);
 if(!await button.isVisible())await page.locator('[data-nav-menu-toggle]').click();
 await button.click();await page.locator(`#${id}.active`).waitFor();
}
async function mediaBounds(page){
 return page.locator('.view.active :is(.exercise-photo,.exercise-library-photo,.training-log-photo)').evaluateAll(elements=>elements.filter(e=>e.checkVisibility()).map(e=>{
  const r=e.getBoundingClientRect(),image=e.querySelector('img'),i=image.getBoundingClientRect(),card=e.closest('.training-exercise-card,.training-log-exercise,.exercise-library-item').getBoundingClientRect();
  return {type:e.className,w:r.width,h:r.height,imageW:i.width,imageH:i.height,contained:i.x>=r.x-1&&i.y>=r.y-1&&i.right<=r.right+1&&i.bottom<=r.bottom+1,cardContained:r.x>=card.x&&r.right<=card.right+1,fit:getComputedStyle(image).objectFit};
 }));
}
test('rendered trainer/member layout: all navigation, bounded moving media, touch widths, focus and enlarged text',{timeout:300000},async()=>{
 const preview=await start(0);await seed(preview);const browser=await launch(),results=[],errors=[];fs.mkdirSync(out,{recursive:true});
 try{
  for(const role of ['trainer','member']){
   const page=await localPage(browser,preview);page.on('pageerror',e=>errors.push(e.message));await page.goto(preview.url);await login(page,role);
   const views=await page.evaluate(()=>allowedViews().map(([id])=>id));assert.equal(views.length,role==='trainer'?11:5);
   for(const [width,height]of [[320,740],[390,844],[768,1024],[844,390],[1024,768],[1400,950]]){
    await page.setViewportSize({width,height});
    // The member agenda intentionally folds the header into Appbediening.
    // Measure the normal header on home, then visit every view at this width.
    await navigate(page,role==='trainer'?'trainer-dashboard':'client-home');
    assert(await page.locator('.topbar').evaluate(e=>getComputedStyle(e).flexDirection==='row'),'header flex bases must describe widths, not tall mobile rows');
    if(width===390)assert((await page.locator('.topbar').boundingBox()).height<360,'compact phone header');
    for(const id of views){
     await navigate(page,id);await page.waitForTimeout(50);
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${role}/${id}/${width} horizontal page overflow`);
     if(['training','training-log'].includes(id)){
      const bounds=await mediaBounds(page);assert(bounds.length>0);for(const b of bounds){assert(b.contained&&b.cardContained,JSON.stringify({role,id,width,b}));assert.equal(b.fit,'contain');assert(b.h<=151&&b.w<=Math.max(116,width-30));}
      const selector=id==='training'?'.training-exercise-card':'.training-log-exercise',moving=page.locator(selector).nth(1),missing=page.locator(selector).nth(2);
      await moving.locator('img').scrollIntoViewIfNeeded();await moving.locator('img').evaluate(i=>i.decode());
      const dimensions=e=>({width:e.offsetWidth,height:e.offsetHeight,top:e.offsetTop,next:e.nextElementSibling?.offsetTop});
      const before=await moving.evaluate(dimensions);
      if([390,1400].includes(width)){
       const first=await moving.locator('img').screenshot();let changed=false;
       for(let attempt=0;attempt<12&&!changed;attempt++){await page.waitForTimeout(120);changed=!first.equals(await moving.locator('img').screenshot());}
       assert(changed,`${role}/${id}/${width}: GIF actually changes frames`);
      }
      assert.deepEqual(await moving.evaluate(dimensions),before,'animation cannot resize or displace cards');
      await missing.scrollIntoViewIfNeeded();await missing.locator('img').evaluate(i=>i.decode());assert.match(await missing.locator('img').getAttribute('src'),/^data:image\/svg/);
      if(role==='trainer'&&id==='training'){
       for(const selector of ['[data-publish-training-schema]','#trainingForm [type=submit]','#exerciseLibraryForm [type=submit]','[data-copy-training-schema]','[data-complete-training]','[data-remove-training="0"]','[data-publish-training="11"]']){
        const button=page.locator(selector).first();try{await button.scrollIntoViewIfNeeded();await button.click({trial:true});}catch(error){fs.mkdirSync('tests/artifacts',{recursive:true});await page.screenshot({path:'tests/artifacts/trainer-control-failure.png'});throw new Error(`${role}/${width}/${selector}: ${error.message}`);}
       }
      }
     }
     results.push({role,width,height,id,pass:true});
    }
   }
   await page.setViewportSize({width:390,height:844});await navigate(page,'training');
   await page.addStyleTag({content:'body {font-size:28px !important} body button,body input,body select,body textarea {font-size:inherit !important}'});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'large text page overflow');
   for(const b of await mediaBounds(page))assert(b.contained&&b.cardContained);
   const input=page.locator('[data-training-log="0:actualReps"]');await input.fill('10/9/8');await input.focus();
   await page.waitForFunction(()=>!hasPendingChanges());assert(await input.evaluate(e=>document.activeElement===e),'autosave keeps keyboard focus');
   await page.setViewportSize({width:390,height:420});await input.scrollIntoViewIfNeeded();assert(await input.isVisible());await page.setViewportSize({width:390,height:844});
   await page.context().close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/interaction-tests.json`,JSON.stringify({browser:'Headless Microsoft Edge, viewport emulation (no physical phone)',results,errors},null,2));
 }finally{await browser.close();await preview.close();}
});

test('PWA manifest, original padded icons, native prompt lifecycle, iPhone help, standalone role/session and no cache writes',{timeout:180000},async()=>{
 const preview=await start(0),browser=await launch();const proof={};
 try{
  const page=await localPage(browser,preview,{viewport:{width:390,height:844}});await page.goto(preview.url);
  const manifest=await page.evaluate(async()=>{const r=await fetch(document.querySelector('link[rel=manifest]').href);return {mime:r.headers.get('content-type'),data:await r.json()};});
  assert.match(manifest.mime,/manifest\+json/);assert.equal(manifest.data.id,'/');assert.equal(manifest.data.start_url,'/');assert.equal(manifest.data.name,'FitMetZorge');assert.equal(manifest.data.display,'standalone');
  for(const icon of manifest.data.icons){assert.equal((await page.request.get(preview.url+icon.src)).status(),200);}
  const provenance=JSON.parse(fs.readFileSync('assets/pwa/provenance.json'));assert.equal(provenance.sourceSHA256,crypto.createHash('sha256').update(fs.readFileSync(provenance.source)).digest('hex'));
  for(const item of provenance.outputs){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(item.file)).digest('hex'),item.sha256);}
  const mask=await page.evaluate(async()=>{const image=new Image();image.src='assets/pwa/maskable-512.png';await image.decode();const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const d=ctx.getImageData(0,0,512,512).data;let outside=0;for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4;if(Math.hypot(x-256,y-256)>204.8&&(d[i]<245||d[i+1]<245||d[i+2]<245))outside++;}return {outside};});assert.equal(mask.outside,0,'all visible logo fits maskable circle');
  fs.mkdirSync('tests/artifacts',{recursive:true});
  const persistent=await chromium.launchPersistentContext(fs.mkdtempSync('tests/artifacts/pwa-profile-'),{headless:true,channel:'msedge'});
  try{await persistent.route('**/*',r=>r.request().url().startsWith(preview.url)?r.continue():r.abort());const installPage=await persistent.newPage();await installPage.goto(preview.url);const cdp=await persistent.newCDPSession(installPage);proof.manifest=await cdp.send('Page.getAppManifest');proof.installability=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(proof.manifest.errors,[]);assert.deepEqual(proof.installability.installabilityErrors,[]);}finally{await persistent.close();}
  await page.locator('#loginScreen [data-install-app]').click();await page.locator('#installAppDialog').waitFor({state:'visible'});await page.keyboard.press('Escape');assert(!await page.locator('#installAppDialog').isVisible());
  await page.evaluate(()=>{window.prompts=0;const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.prompts++};e.userChoice=Promise.resolve({outcome:'dismissed'});dispatchEvent(e);});
  await page.locator('#loginScreen [data-install-app]').dblclick();assert.equal(await page.evaluate(()=>prompts),1);assert.equal(await page.locator('#loginScreen [data-install-app]').innerText(),'App installeren');if(await page.locator('#installAppDialog').isVisible())await page.keyboard.press('Escape');
  const before=preview.calls.length;await page.locator('#loginScreen [data-install-app]').click();await page.keyboard.press('Escape');assert.equal(preview.calls.length,before);
  await page.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{throw Error('Synthetic unavailable prompt')};e.userChoice=Promise.resolve({outcome:'dismissed'});dispatchEvent(e);});
  await page.locator('#loginScreen [data-install-app]').click();assert.match(await page.locator('[data-install-instructions]').innerText(),/kon niet worden geopend/);await page.locator('[data-install-close]').click();
  await page.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{};e.userChoice=Promise.resolve({outcome:'accepted'});dispatchEvent(e);});
  await page.locator('#loginScreen [data-install-app]').click();assert.equal(await page.locator('#loginScreen [data-install-app]').innerText(),'App installeren');
  await page.evaluate(()=>dispatchEvent(new Event('appinstalled')));assert.equal(await page.locator('#loginScreen [data-install-app]').innerText(),'App geïnstalleerd');assert(await page.locator('#loginScreen [data-install-app]').isDisabled());
  assert.deepEqual(await page.evaluate(async()=>({caches:await caches.keys(),workers:(await navigator.serviceWorker.getRegistrations()).length})),{caches:[],workers:0});
  await page.context().close();
  const iphone=await localPage(browser,preview,{viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});await iphone.goto(preview.url);await iphone.locator('#loginScreen [data-install-app]').click();assert.match(await iphone.locator('[data-install-instructions]').innerText(),/Deel → Zet op beginscherm/);await iphone.locator('[data-install-close]').click();
  await iphone.context().close();
  for(const role of ['trainer','member']){
   const app=await localPage(browser,preview,{viewport:{width:390,height:844},hasTouch:true});
   await app.addInitScript(()=>{const original=window.matchMedia.bind(window);window.matchMedia=query=>query==='(display-mode: standalone)'?{matches:true,addEventListener(){},removeEventListener(){}}:original(query);Object.defineProperty(navigator,'standalone',{value:true});});
   await app.goto(preview.url);await login(app,role);assert.equal(await app.locator('[data-install-app]:visible').count(),0);assert.equal(await app.evaluate(()=>currentView),role==='trainer'?'trainer-dashboard':'client-home');
   await navigate(app,'training');const input=app.locator('[data-training-log="0:actualWeight"]');await input.fill('33.5');await app.waitForFunction(()=>!hasPendingChanges());await app.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));assert.equal(await input.inputValue(),'33.5');
   await app.reload();await app.waitForFunction(()=>onlineReady);assert.equal(await app.evaluate(()=>client().trainingPlan[0].logsByWeek['2026-10-12'].actualWeight),'33.5');await app.locator('#logoutButton').click();assert.equal(await app.evaluate(()=>state.clients.length),0);await login(app,role);await navigate(app,'training');
   if(role==='trainer'){await app.locator('[data-nav-menu-toggle]').click();await app.keyboard.press('Escape');assert.equal(await app.locator('[data-nav-menu-toggle]').getAttribute('aria-expanded'),'false');assert(await app.locator('[data-nav-menu-toggle]').evaluate(e=>document.activeElement===e));}
   await app.context().close();
  }
  fs.writeFileSync(`${out}/pwa-tests.json`,JSON.stringify({manifest:manifest.data,manifestErrors:proof.manifest.errors,installabilityErrors:proof.installability.installabilityErrors,maskable:mask,scope:'Edge technical checks; native prompt simulated; iPhone/standalone browser emulation; no physical installation',pass:true},null,2));
 }finally{await browser.close();await preview.close();}
});

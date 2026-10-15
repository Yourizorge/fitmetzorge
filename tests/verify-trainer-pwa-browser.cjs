/* Public live shell only, fresh synthetic browser profile, no login or API writes. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 fs.mkdirSync('tests/artifacts',{recursive:true});
 const context=await chromium.launchPersistentContext(fs.mkdtempSync('tests/artifacts/live-pwa-profile-'),{headless:true,channel:'msedge',viewport:{width:390,height:844}}),errors=[],blocked=[];
 try{
  await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(!['GET','HEAD'].includes(req.method())){blocked.push({method:req.method(),host:url.host});return route.abort();}return ['appfmz.nl','cdn.jsdelivr.net'].includes(url.host)?route.continue():route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://appfmz.nl/',{waitUntil:'networkidle'});assert(await page.locator('#loginScreen').isVisible());assert.equal(await page.title(),'FitMetZorge');
  for(const [width,height]of [[320,740],[390,844],[844,390],[1400,950]]){await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#loginScreen [data-install-app]').click();assert(await page.locator('#installAppDialog').isVisible());await page.keyboard.press('Escape');assert(!await page.locator('#installAppDialog').isVisible());}
  const cdp=await context.newCDPSession(page),manifest=await cdp.send('Page.getAppManifest'),installability=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(manifest.errors,[]);assert.deepEqual(installability.installabilityErrors,[]);
  assert.equal(await page.evaluate(()=>document.querySelector('meta[name="apple-mobile-web-app-title"]').content),'FitMetZorge');
  assert.deepEqual(await page.evaluate(async()=>({caches:await caches.keys(),workers:(await navigator.serviceWorker.getRegistrations()).length})),{caches:[],workers:0});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/examples/trainer-pwa-20261015/live-login-390.png'});
  await page.goto('https://appfmz.nl/Fit_Met_Zorge_Coach_App_standalone.html');await page.waitForURL('**/index.html');assert.equal(await page.locator('link[rel=manifest]').getAttribute('href'),'manifest.webmanifest');assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  fs.writeFileSync('docs/APPFMZ_TRAINER_PWA_LIVE_20261015.json',JSON.stringify({at:new Date().toISOString(),host:'https://appfmz.nl',browser:await context.browser()?.version(),scope:'public login, manifest, native installability, helper, icons, legacy entry; no account login',viewports:[[320,740],[390,844],[844,390],[1400,950]],manifestErrors:manifest.errors,installabilityErrors:installability.installabilityErrors,errors,writeRequests:blocked,privateCaches:0,serviceWorkers:0,pass:true},null,2)+'\n');console.log('PASS public live login, four viewports, manifest/installability and unchanged routing; zero writes.');
 }finally{await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

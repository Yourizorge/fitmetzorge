const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
test('portable Chrome: native browser zoom, synthetic photo, responsive owner test',{timeout:180000},async()=>{
 const root=path.resolve(__dirname,'artifacts/chrome-testing'),ext=path.join(root,'zoom-extension');fs.mkdirSync(ext,{recursive:true});
 fs.writeFileSync(path.join(ext,'manifest.json'),JSON.stringify({manifest_version:3,name:'Local APPFMZ zoom test',version:'1.0',permissions:['tabs'],background:{service_worker:'worker.js'}}));fs.writeFileSync(path.join(ext,'worker.js'),'chrome.runtime.onInstalled.addListener(()=>{});');
 const preview=await require('./owner-test-preview.cjs').start(),profile=fs.mkdtempSync(path.join(root,'profile-')),context=await chromium.launchPersistentContext(profile,{executablePath:path.join(root,'chrome-win64/chrome.exe'),headless:true,viewport:{width:1440,height:1000},args:['--disable-extensions-except='+ext,'--load-extension='+ext]}),p=await context.newPage(),errors=[],results=[];
 const dir=path.join(__dirname,'../docs/images/owner-laptop-20261102');fs.mkdirSync(dir,{recursive:true});
 try{
  p.on('pageerror',e=>errors.push(e.message));await context.route('**/*',r=>r.request().url().startsWith(preview.url)||/^(blob:|data:|about:|chrome-extension:)/.test(r.request().url())?r.continue():r.abort());
  await p.goto(preview.url);await p.locator('#loginForm [name=email]').fill('trainer@example.test');await p.locator('#loginForm [name=password]').fill('synthetic');await p.locator('#loginForm [type=submit]').click();await p.waitForFunction(()=>FMZAccounting.ready);await p.evaluate(()=>showView('clients'));await p.locator('[data-owner-laptop-launch]').click();
  const frame=await(await p.locator('.fmz-owner-test-host iframe').elementHandle()).contentFrame();await frame.locator('[data-members-tools]').waitFor({timeout:90000});
  // The open guide must not intercept the existing draft button.
  await frame.locator('[data-member-action=drafts]').click();await frame.locator('[data-members-close]').click();
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  for(const zoom of [1,1.25,1.5,2]){
   const actual=await worker.evaluate(async({url,zoom})=>{const tab=(await chrome.tabs.query({})).find(t=>t.url?.startsWith(url));await chrome.tabs.setZoom(tab.id,zoom);return chrome.tabs.getZoom(tab.id);},{url:preview.url,zoom});assert.equal(actual,zoom);
   await frame.locator('[data-member-action=enroll]').click();await frame.locator('.members-package').first().waitFor();
   assert(await frame.locator('.members-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await frame.locator('[data-member-action=next]').scrollIntoViewIfNeeded();
   const bounds=await p.locator('.fmz-owner-test-host iframe').boundingBox();assert(bounds&&bounds.height>100);await p.screenshot({path:path.join(dir,'chrome-native-zoom-'+Math.round(zoom*100)+'.png')});
   results.push({nativeZoom:actual,devicePixelRatio:await p.evaluate(()=>devicePixelRatio),dialogNoHorizontalOverflow:true});await frame.locator('[data-members-close]').click();
  }
  await worker.evaluate(async url=>{const tab=(await chrome.tabs.query({})).find(t=>t.url?.startsWith(url));await chrome.tabs.setZoom(tab.id,1);},preview.url);
  await frame.locator('.fmz-test-guide details>summary').click();await frame.locator('[data-ot-step="9"]').click();const dl=p.waitForEvent('download');await frame.locator('.fmz-test-guide [data-ot-action=sample-photo]').click();const download=await dl;await download.saveAs(path.join(__dirname,'artifacts/owner-test-sample.png'));assert.equal(download.suggestedFilename(),'APPFMZ-TEST-geometrisch.png');
  if(await frame.locator('.fmz-test-guide').isVisible())await frame.locator('.fmz-test-guide [data-ot-action=toggle]').click();await frame.locator('[data-member-action=enroll]').click();await frame.locator('.members-package').first().waitFor();
  for(const[width,height]of [[390,844],[844,390],[768,1024],[1366,768]]){
   await p.setViewportSize({width,height});await frame.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert(await frame.locator('.members-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await frame.locator('[data-member-action=next]').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(dir,`chrome-responsive-${width}.png`)});results.push({width,height,dialogNoHorizontalOverflow:true});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(__dirname,'../docs/examples/owner-laptop-20261102/layout-evidence.json'),JSON.stringify({browser:'Official portable Chrome for Testing',version:context.browser()?.version(),source:JSON.parse(fs.readFileSync(path.join(root,'source.json'))),nativeZoomMethod:'chrome.tabs.setZoom + getZoom readback, local temporary extension',results,errors,physicalOwnerTest:false,status:'PASS'},null,2));
 }catch(error){await p.screenshot({path:path.join(dir,'layout-failure.png')});console.error('LAYOUT', (await frameBody(p)).slice(-5000));throw error;}finally{await context.close();await preview.close();}
});

async function frameBody(p){const f=await(await p.locator('.fmz-owner-test-host iframe').elementHandle()).contentFrame();return f.locator('body').innerText();}

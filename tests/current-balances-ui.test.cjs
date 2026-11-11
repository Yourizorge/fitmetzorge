const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright'),{start}=require('./preview.cjs');
test('October current balances: actual Edge laptop/phone screens, drilldowns, refresh and new login',{timeout:180000},async()=>{
 const preview=await start(0),h=await require('./current-balances-fixture.cjs').provision(preview.database),browser=await chromium.launch({channel:'msedge',headless:true});
 const images=path.resolve('docs/images/owner-navigation-20261111');fs.mkdirSync(images,{recursive:true});
 const old=Object.fromEntries(['finance-model.js','finance-ui.js'].map(f=>[f,execFileSync('git',['show','HEAD:'+f],{encoding:'utf8'})]));
 try{
  for(const [width,height] of [[1440,1000],[390,844]]){
   const c=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await c.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});let baseline=true;
   await c.route('**/*',route=>{const u=new URL(route.request().url());if(!u.href.startsWith(preview.url))return route.abort();if(baseline&&old[u.pathname.slice(1)])return route.fulfill({contentType:'text/javascript',body:old[u.pathname.slice(1)]});return route.continue();});
   const login=async()=>{await page.goto(preview.url);await page.locator('#loginForm [name=role]').selectOption('trainer');await page.locator('#loginForm [name=email]').fill('trainer@example.test');await page.locator('#loginForm [name=password]').fill('test');await page.locator('#loginForm [type=submit]').click();await page.waitForFunction(()=>onlineReady&&FMZAccounting.ready).catch(async e=>{console.error(await page.locator("body").innerText(),preview.calls);throw e;});};
   const october=async()=>{await page.evaluate(()=>showView('administration'));await page.locator('#administration [name=periodValue]').fill('2026-10');await page.locator('#administration [data-acc-action=period-filter]').click();};
   const metric=id=>page.locator(`#administration [data-acc-action=finance-metric][data-id=${id}]`);
   await login();await october();assert.match(await metric('outstanding').innerText(),/332,50/);await page.locator('#administration .acc-panel').filter({hasText:'Facturen uit deze periode'}).first().screenshot({path:path.join(images,`payments-before-${width}.png`)});
   baseline=false;await page.reload();await page.waitForFunction(()=>onlineReady&&FMZAccounting.ready);await october();
   const check=async()=>{assert.match(await metric('outstanding').innerText(),/€\s*0,00/);assert.match(await metric('overdue').innerText(),/€\s*0,00/);assert.equal(await metric('open').locator('strong').innerText(),'0');assert.match(await metric('cohort-received').innerText(),/482,50/);};
   await check();for(const id of ['outstanding','overdue','open']){await metric(id).click();assert.equal(await page.locator('.acc-dialog[open] [data-acc-action=detail]').count(),0);await page.locator('.acc-dialog[open] [data-acc-action=close]').click();}
   await metric('paid').click();assert.equal(await page.locator('.acc-dialog[open] [data-acc-action=detail]').count(),2);await page.locator('.acc-dialog[open] [data-acc-action=close]').click();
   await page.locator('#administration .acc-panel').filter({hasText:'Facturen uit deze periode'}).first().screenshot({path:path.join(images,`payments-after-${width}.png`)});
   await page.reload();await page.waitForFunction(()=>onlineReady&&FMZAccounting.ready);await october();await check();await page.locator('#logoutButton').click();await login();await october();await check();assert.deepEqual(errors,[]);await c.close();
  }
  const snapshot=await h.snapshot();assert.equal(snapshot.records.filter(r=>r.kind==='bank').length,2);assert.equal(snapshot.records.filter(r=>r.kind==='invoice').length,2);
 }finally{await browser.close();await preview.close();}
});

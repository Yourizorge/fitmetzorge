/* Actual published UI and production API, using only the release's four marker-owned accounts.
   Does not request notification permission or create a device subscription. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const dir=process.env.FMZ_AGENDA_PRIVATE;assert(dir);const manifest=JSON.parse(fs.readFileSync(path.join(dir,'agenda-synthetic.json'),'utf8'));
 const out='docs/examples/agenda-20261015',report={at:new Date().toISOString(),host:'https://appfmz.nl',syntheticOnly:true,physicalPhone:false,pushPermissionRequested:false,checks:[]};
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const role of ['trainer','a']){
  const account=manifest.accounts[role];assert.equal(account.email,manifest.marker+'-'+role+'@example.test');assert(!account.deleted);
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{await page.goto('https://appfmz.nl/?agenda-release-check='+Date.now());const form=page.locator('#loginForm');await form.locator('[name=role]').selectOption(role==='trainer'?'trainer':'client');await form.locator('[name=email]').fill(account.email);await form.locator('[name=password]').fill(account.password);await form.locator('[type=submit]').click();
   await page.waitForFunction(()=>typeof onlineReady!=='undefined'&&onlineReady,{},{timeout:30000});await page.evaluate(()=>showView('agenda'));await page.waitForFunction(()=>FMZAgenda.data?.appointments.length===3);
   const first=await page.evaluate(()=>FMZAgenda.data.appointments);assert.equal(first.length,3);assert(first.every(a=>a.type.startsWith('Synthetische')));if(role==='a')assert(first.every(a=>a.participants.length===1&&a.participants[0].id==='a'));
   await page.locator('[data-ag-view=list]').click();
   for(const width of [390,1400]){await page.setViewportSize({width,height:width===390?844:1000});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(out,`live-${role==='a'?'member':role}-${width}.png`),animations:'disabled'});report.checks.push({role:role==='a'?'member':role,width,overflow:false});}
   await page.locator('[data-ag-detail]').first().click();assert((await page.locator('#agDialog').innerText()).includes('Synthetische'));await page.keyboard.press('Escape');assert.equal(await page.locator('#agDialog').evaluate(d=>d.open),false);
   if(role==='trainer'){await page.evaluate(()=>showView('clients'));assert.equal(await page.locator('[data-ag-client-month]').count(),2);await page.evaluate(()=>showView('agenda'));}
   await page.locator('[data-ag-action=messages]').click();assert((await page.locator('#agDialog').innerText()).includes('Testmelding op mijn toestel'));assert.equal(await page.evaluate(()=>FMZAgenda.data.pushReady),true);await page.keyboard.press('Escape');
   await page.reload();await page.waitForFunction(()=>typeof onlineReady!=='undefined'&&onlineReady);await page.evaluate(()=>showView('agenda'));await page.waitForFunction(()=>FMZAgenda.data?.appointments.length===3);assert.deepEqual(await page.evaluate(()=>FMZAgenda.data.appointments),first);
   await page.evaluate(()=>document.querySelector('#logoutButton').click());await page.waitForFunction(()=>!onlineReady);assert.equal(await page.locator('#agendaRoot').innerText(),'');assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }}finally{await browser.close();}
 report.reloadPreserved=true;report.memberProjectionPrivate=true;report.clientMonthCards=true;report.logoutClearsAgenda=true;report.errors=[];fs.writeFileSync(path.join(out,'live-browser-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.message);process.exitCode=1;});

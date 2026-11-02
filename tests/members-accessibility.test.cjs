const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium,webkit}=require('playwright'),F=require('./members-fixture.cjs');
for(const engine of ['edge','webkit'])test('members keyboard, seven package cards, enlarged text and portrait/landscape '+engine,{timeout:240000},async()=>{
 const preview=await require('./preview.cjs').start(0),browser=await(engine==='edge'?chromium:webkit).launch({headless:true,...(engine==='edge'?{channel:'msedge'}:{})}),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 const dir='tests/artifacts/members-accessibility';fs.mkdirSync(dir,{recursive:true});
 try{
  await F.legal({...preview.database,org:(await preview.database.db.query('select id from fmz_accounting.organizations limit 1')).rows[0].id});
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(preview.url)||r.request().url().startsWith('blob:')?r.continue():r.abort());
  await page.goto(preview.url);await page.locator('#loginForm [name=email]').fill('trainer@example.test');await page.locator('#loginForm [name=password]').fill('synthetic');await page.locator('#loginForm [type=submit]').click();await page.waitForFunction(()=>FMZAccounting.ready);
  await page.evaluate(()=>{showView('clients');FMZMembers.render();});await page.locator('[data-member-action=enroll]').click();await page.locator('.members-packages').waitFor();
  const catalog=(await preview.database.as('trainer',"select public.fmz_members_read('bootstrap','{}') r")).rows[0].r.catalog;
  assert.equal(catalog.length,7);assert.equal(await page.locator('.members-packages input[type=radio]').count(),7);
  const person={...F.person(),lastName:'Voorbeeld met meerdere familienamen'};
  for(const cat of catalog){
   await page.locator(`input[name=package][value="${cat.id}"]`).check();await page.locator('[data-member-action=next]').click();await page.locator('[data-person]').waitFor();
   for(const [k,v]of Object.entries(person)){const input=page.locator(`[data-person] [name="${k}"]`);if(!await input.count()||await input.isDisabled())continue;if(typeof v==='boolean')await input.setChecked(v);else await input.fill(v);}
   await page.locator('[data-member-action=next]').click();await page.getByRole('heading',{name:'Betaling controleren'}).waitFor();
   assert.match(await page.locator('.members-summary').innerText(),new RegExp(String(cat.snapshot.cents/100)));
   await page.locator('[data-member-action=previous]').click();assert.equal(await page.locator('[data-person] [name=lastName]').inputValue(),person.lastName);await page.locator('[data-member-action=previous]').click();
  }
  await page.getByText('Personal training Progressie',{exact:true}).click();await page.locator('[data-member-action=next]').click();await page.locator('[data-person] [name=phone]').fill('x');await page.locator('[data-member-action=next]').click();
  const invalid=page.locator('[data-person] [name=phone]');await page.waitForFunction(()=>document.querySelector('[data-person] [name=phone]')?.getAttribute('aria-invalid')==='true');const errorId=await invalid.getAttribute('aria-describedby');assert(errorId);assert((await page.locator('#'+errorId).innerText()).length>5);
  await invalid.fill(person.phone);await page.locator('[data-member-action=next]').click();await page.locator('[data-member-action=next]').click();await page.locator('[data-signature]').waitFor();
  const canvas=page.locator('[data-signature]');await canvas.focus();assert.equal(await canvas.evaluate(e=>e===document.activeElement),true);await canvas.press('Space');for(let i=0;i<12;i++)await canvas.press(i<6?'ArrowRight':'ArrowDown');await canvas.press('Space');await canvas.press('Escape');
  await page.locator('[data-confirmed]').check();await page.locator('[data-member-action=preview]').click();await page.locator('[data-member-action=finalize]').waitFor();
  // A real keyboard drawing passes the existing signature/PDF guard; no typed-name shortcut.
  assert.equal((await preview.database.db.query('select count(*)::int n from fmz_members.contracts')).rows[0].n,0);
  for(const[width,height]of [[320,700],[390,844],[844,390],[768,1024],[1024,768],[1400,900],[1920,1080]]){
   await page.setViewportSize({width,height});await page.locator('[data-member-action=finalize]').scrollIntoViewIfNeeded();
   assert(await page.locator('.members-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'No horizontal overflow '+width);
   const b=await page.locator('[data-member-action=finalize]').boundingBox();assert(b&&b.x>=0&&b.x+b.width<=width+1&&b.y>=0&&b.y<height,'Final action is reachable '+width);
   if([320,844,1400].includes(width))await page.screenshot({path:`${dir}/${engine}-${width}.png`});
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{const nodes=[...document.querySelectorAll('.members-dialog,.members-dialog *')];const sizes=nodes.map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);for(const[e,size]of sizes)e.style.fontSize=(size*2)+'px';});
  await page.locator('[data-member-action=finalize]').scrollIntoViewIfNeeded();assert(await page.locator('.members-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'200% text remains inside dialog');await page.screenshot({path:`${dir}/${engine}-text200.png`});
  // Escape closes only this dialog and returns to the same authenticated app.
  await page.keyboard.press('Escape');await page.locator('.members-dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>FMZAccounting.ready),true);assert.deepEqual(errors,[]);
 }finally{await browser.close();await preview.close();}
});

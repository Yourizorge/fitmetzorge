const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright'),{start}=require('./preview.cjs');
test('A4 preview fits all screens, enlarges privately and keeps archived download/share bytes',{timeout:180000},async()=>{
 const preview=await start(0),browser=await chromium.launch({headless:true,channel:'msedge'}),p=await browser.newPage({acceptDownloads:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const folder='tests/artifacts/invoice-layout';fs.mkdirSync(folder,{recursive:true});
 try{
  await p.route('**/*',r=>r.request().url().startsWith(preview.url)?r.continue():r.abort());await p.goto(preview.url);
  await p.locator('#loginForm input[name=email]').fill('trainer@example.test');await p.locator('#loginForm input[name=password]').fill('test');await p.locator('#loginForm button[type=submit]').click();await p.waitForFunction(()=>FMZAccounting.ready);
  await p.evaluate(async()=>{await FMZAccounting.command('settings',{data:{date:'2026-01-01',businessName:'FitMetZorge — synthetisch',ownerName:'Synthetische rekeninghouder',address:'Voorbeeldstraat 1',postalCity:'1000 AA Teststad',country:'Nederland',email:'synthetic@example.test',website:'example.test',iban:'TEST-IBAN',kvk_registered:false,vatNumber:'NL000000000B00',vat_status:'standard',vat_method:'invoice',vat_period:'quarter',vat_basis_points:2100,confirmed:true}});await FMZAccounting.refresh();client().profile.package='pt-progressie';await saveStateToCloud();showView('administration');document.querySelector('[data-acc-page=sales]').click();});
  await p.locator('[data-acc-action=new-package]').click();await p.locator('[data-acc-action=choose-invoice]').click();const form=p.locator('#invoiceDraftForm');
  await form.locator('[name=customerName]').fill('Voorbeeldlid — synthetisch');await form.locator('[name=customerAddress]').fill('Voorbeeldstraat 2, 1000 AB Teststad');await form.locator('[name=description]').fill('Personal coaching – Progressie');await form.locator('[name=discount]').fill('30');
  await p.waitForFunction(()=>document.querySelector('[data-preview-status]')?.textContent.startsWith('PDF-voorbeeld'));
  for(const [width,height] of [[320,700],[390,844],[768,1024],[1400,1000]])for(const light of [false,true]){
   await p.setViewportSize({width,height});await p.evaluate(light=>document.body.classList.toggle('light',light),light);
   await form.locator('.invoice-a4').scrollIntoViewIfNeeded();
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.equal(await p.locator('.acc-dialog header').evaluate(e=>getComputedStyle(e).backgroundColor),light?'rgb(247, 248, 250)':'rgb(24, 24, 24)','Sticky header must be opaque');
   const dimensions=await p.locator('[data-pdf-preview] canvas').first().boundingBox();assert(Math.abs(dimensions.width/dimensions.height-595.28/841.89)<.002);
   await p.screenshot({path:`${folder}/preview-${width}-${light?'light':'dark'}.png`});
   const before=JSON.stringify(preview.calls);
   await p.getByRole('button',{name:'PDF vergroten',exact:true}).click();const viewer=p.locator('.fmz-pdf-dialog');
   assert(await viewer.isVisible());assert.equal(await viewer.locator('canvas').first().evaluate(c=>Array.from(c.getContext('2d').getImageData(1,1,1,1).data).join(',')),'255,255,255,255');
   await viewer.getByRole('button',{name:'Inzoomen',exact:true}).click();await viewer.getByRole('button',{name:'Inzoomen',exact:true}).click();assert.equal(await viewer.locator('output').innerText(),'150%');
   const scroll=viewer.locator('.fmz-pdf-scroll'),box=await scroll.boundingBox();await p.mouse.move(box.x+box.width-30,box.y+100);await p.mouse.down();await p.mouse.move(box.x+30,box.y+40,{steps:8});await p.mouse.up();assert(await scroll.evaluate(e=>e.scrollLeft>0));
   await viewer.getByRole('button',{name:'Passend',exact:true}).click();assert.equal(await viewer.locator('output').innerText(),'100%');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.screenshot({path:`${folder}/vergroot-${width}-${light?'light':'dark'}.png`});await viewer.getByRole('button',{name:'Sluiten',exact:true}).click();await viewer.waitFor({state:'detached'});
   assert.equal(JSON.stringify(preview.calls),before,'Zoom/view must not write or call the server');
  }
  // A short visual viewport approximates keyboard space; focus and actions remain reachable.
  await p.setViewportSize({width:390,height:420});await form.locator('[name=description]').focus();assert(await form.locator('[name=description]').evaluate(e=>document.activeElement===e));await form.locator('[data-acc-action=invoice-save]').scrollIntoViewIfNeeded();assert(await form.locator('[data-acc-action=invoice-save]').isVisible());await p.setViewportSize({width:390,height:844});
  await p.waitForFunction(()=>document.querySelector('[data-invoice-message]')?.textContent==='Concept opgeslagen');
  const wait=p.waitForEvent('download');await form.locator('[data-acc-action=invoice-save]').click();const first=await wait;await first.saveAs(folder+'/browser-issued.pdf');assert(first.suggestedFilename().endsWith('.pdf'));
  const record=await p.evaluate(()=>FMZAccounting.snapshot.records.find(r=>r.kind==='invoice'&&r.status==='posted'));
  await p.locator('.acc-dialog [data-acc-action=close]').click();await p.locator(`[data-accounting-root=administration] [data-acc-action=invoice-share][data-id="${record.id}"]`).click();await p.locator('[data-pdf-preview] canvas').first().waitFor();
  await p.evaluate(()=>{navigator.canShare=()=>true;navigator.share=async({files})=>{window.sharedPDF={type:files[0].type,name:files[0].name,bytes:Array.from(new Uint8Array(await files[0].arrayBuffer()))};throw new DOMException('Synthetisch deelmenu gesloten','AbortError');};});
  await p.locator('[data-native-share]').click();await p.waitForFunction(()=>window.sharedPDF);const shared=await p.evaluate(()=>window.sharedPDF);assert.equal(shared.type,'application/pdf');assert.deepEqual(Buffer.from(shared.bytes),fs.readFileSync(folder+'/browser-issued.pdf'));
  const repeat=p.waitForEvent('download');await p.locator('.acc-dialog [data-acc-action=invoice-pdf]').click();await (await repeat).saveAs(folder+'/browser-redownload.pdf');assert.deepEqual(fs.readFileSync(folder+'/browser-redownload.pdf'),fs.readFileSync(folder+'/browser-issued.pdf'));
  await p.getByRole('button',{name:'PDF vergroten',exact:true}).click();await p.evaluate(()=>expireTestSession());await p.waitForFunction(()=>!onlineReady);await p.locator('.fmz-pdf-dialog').waitFor({state:'detached'});assert.equal(await p.locator('[data-pdf-preview] canvas').count(),0);assert.deepEqual(errors,[]);
 }finally{await browser.close();await preview.close();}
});

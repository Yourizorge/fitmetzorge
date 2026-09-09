// Run only against the authorized release, using manifest-owned synthetic accounts.
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const m=JSON.parse(fs.readFileSync('C:/Users/Fitme/.codex/backups/appfmz-20260908/synthetic-accounts.json'));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const p=await browser.newPage();await p.goto(process.env.FMZ_RELEASE_URL);
  await p.locator('#loginForm select[name=role]').selectOption('trainer');await p.locator('#loginForm input[name=email]').fill(m.accounts.trainer.email);await p.locator('#loginForm input[name=password]').fill(m.accounts.trainer.password);await p.locator('#loginForm button[type=submit]').click();await p.waitForFunction(()=>onlineReady);
  await p.evaluate(()=>{state.ui.selectedClientId='a';state.ui.trackingWeekStart='2026-09-07';state.ui.trackerDayIndex=1;renderAll();showView('trackers')});await p.locator('[data-view-photo="1:photoFront"]').click();await p.locator('#photoViewer').waitFor({state:'visible'});
  await p.evaluate(async()=>{const {data}=await supabaseClient.auth.getSession();const r=await fetch(SUPABASE_URL+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+data.session.access_token}});if(!r.ok)throw Error('Synthetic session revocation failed');});
  await p.locator('[data-photo-tool="draw"]').click();const b=await p.locator('#photoViewer canvas').boundingBox();await p.mouse.move(b.x+b.width*.3,b.y+b.height*.3);await p.mouse.down();await p.mouse.move(b.x+b.width*.6,b.y+b.height*.6);await p.mouse.up();await p.waitForFunction(()=>!onlineReady&&state.clients.length===0);assert.equal(await p.locator('#photoViewer').isVisible(),false);assert.equal(await p.locator('#photoViewer img').getAttribute('src'),null);console.log('PASS revoked annotation session closes viewer and removes private photo and workspace');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});

// Read-only anonymous live smoke; no credentials, login, submitted forms or production writes.
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.APPFMZ_PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});
try{const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],blocked=[];
await page.route('**/*',route=>{const req=route.request();if(!['GET','HEAD','OPTIONS'].includes(req.method())){blocked.push({method:req.method(),origin:new URL(req.url()).origin});return route.abort();}return route.continue();});
page.on('pageerror',e=>errors.push(e.message));
const response=await page.goto('https://appfmz.nl/?owner-test=1',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.FMZOwnerLaptopTest);
assert.equal(response.status(),200);assert.equal(await page.locator('[data-owner-laptop-launch]').count(),0);assert.equal(await page.locator('.fmz-owner-test-host').count(),0);assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
const report={at:new Date().toISOString(),browser:'Edge headless, anonymous new context',pass:true,status:response.status(),launcherLoaded:true,anonymousLauncherHidden:true,anonymousSandboxAbsent:true,pageErrors:errors,blockedWriteRequests:blocked,limitations:['No real owner login or physical owner acceptance','Authenticated full route covered separately with isolated fixtures']};
fs.writeFileSync((process.env.APPFMZ_BROWSER_EVIDENCE || 'docs/examples/owner-laptop-20261102/live-browser-smoke.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});

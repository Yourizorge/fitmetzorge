const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const M=require('../members-model.js');
const catalog=['pt-basis','pt-progressie','pt-transformatie','duo-basis','online-coaching'].map((id,i)=>({id:'catalog-'+i,package_id:id,active:true,enrollable:true,snapshot:{id,label:['Personal training Basis','Personal training Progressie','Personal training Transformatie','Duo Basis','Online coaching'][i],mode:i<3?'individual':i===3?'duo':'online',cycle:'four_weeks',cents:[20000,38000,48000,26000,20000][i],sessions:[4,8,12,4,0][i]}}));
test('individual PT route uses active catalog values and preserves established identity/address storage',()=>{
 assert.deepEqual(M.individualCatalog(catalog).map(v=>[v.snapshot.cents,v.snapshot.sessions]),[[20000,4],[38000,8],[48000,12]]);
 assert.equal(M.individualCatalog([{...catalog[0],active:false}]).length,0);
 const changed=structuredClone(catalog);changed[1].snapshot.cents=39000;assert.equal(M.individualCatalog(changed)[1].snapshot.cents,39000);
 assert.equal(M.enrollmentPriceNeedsReview({discountAmount:'30'}),true);assert.equal(M.enrollmentPriceNeedsReview({discountAmount:''}),true);assert.equal(M.enrollmentPriceNeedsReview({firstPeriodCustom:true}),true);assert.equal(M.enrollmentPriceNeedsReview({discountAmount:'0'}),false);
 assert.deepEqual(M.nameParts('  Noor   van der Test '),{firstName:'Noor',insertion:'',lastName:'van der Test'});assert.deepEqual(M.addressParts('18 B'),{number:'18',addition:'B'});
 const pay=M.payment(catalog[1].snapshot,'2026-11-02',{}).value;assert.equal(pay.firstPeriodNetCents,38000);assert.equal(pay.discountCents,0);assert.equal(pay.nextPeriodStart,'2026-11-30');
});
test('rendered forms: three cards, vertical fields, stale-price guard, complete profile tabs and scoped camera capture',{timeout:90000},async()=>{
 const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,...(process.env.OWNER_TEST_CHROME?{executablePath:process.env.OWNER_TEST_CHROME}:{channel:'msedge'})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.setContent('<main><section id="clients"></section></main>');await page.addStyleTag({path:path.resolve(__dirname,'../members.css')});
 await page.evaluate(catalog=>{
 let n=0;if(!crypto.randomUUID)crypto.randomUUID=()=> '00000000-0000-4000-8000-'+String(++n).padStart(12,'0');window.escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));window.onlineProfile={id:'test',role:'trainer'};window.state={ui:{},clients:[]};window.todayISO=()=> '2026-11-02';window.showView=()=>{};window.renderAll=()=>{};
 window.OwnerTestMemberViews={mount({view,clientId,target}){target.innerHTML='<h3>'+view+'</h3><p>'+clientId+'</p>';window.lastMounted={view,clientId};},unmount(){}};
 window.testBootstrap={catalog,drafts:[],terms:null};window.saved=[];
 window.supabaseClient={rpc:async(name,{action,payload})=>{
 if(name==='fmz_members_read'&&action==='bootstrap')return {data:structuredClone(testBootstrap),error:null};
 if(action==='duplicates')return {data:[],error:null};
 if(action==='profile')return {data:{member:{client_id:payload.client_id,name:payload.client_id,member_number:'TEST-1',status:'active'},personal:{phone:'0612345678'},documents:[],events:[],account:{registered:true}},error:null};
 if(action==='save_draft'){saved.push(structuredClone(payload));return {data:{...payload,version:payload.expected_version+1},error:null};}return {data:null,error:null};}};
 window.OwnerTestCamera={capture:async()=>{window.cameraCalls=(window.cameraCalls||0)+1;return new Promise(resolve=>{const c=document.createElement('canvas');c.width=c.height=40;c.getContext('2d').fillRect(0,0,40,40);c.toBlob(resolve,'image/jpeg');});},cancel(){}};
 },catalog);
 await page.addScriptTag({path:path.resolve(__dirname,'../members-model.js')});await page.addScriptTag({path:path.resolve(__dirname,'../members-ui.js')});
 await page.evaluate(()=>FMZMembers.openEnrollment());assert.equal(await page.locator('.members-package').count(),3,await page.locator('body').innerText());
 const cards=await page.locator('.members-packages').innerText();assert.match(cards,/380/);assert.doesNotMatch(cards,/btw|opzeg|13 betaal|duo|online/i);
 await page.locator('[data-package="catalog-1"]').click();await page.locator('[data-member-action=next]').click();
 const expected=['fullName','email','phone','birthDate','startDate','street','houseNumber','houseAddition','postalCode','city','country','goal','experience','preferences','injuries','trainerNote'];
 assert.deepEqual((await page.locator('[data-person] input,[data-person] textarea').evaluateAll(els=>els.map(e=>e.name))).slice(0,16),expected);
 for(const zoom of [1,1.25,1.5,2]){await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);const positions=await page.locator('[data-person] .field').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().height>0).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y};}));assert(positions.every((p,i)=>!i||p.y>positions[i-1].y));assert(positions.every(p=>Math.abs(p.x-positions[0].x)<1));assert(await page.locator('.members-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 const values={fullName:'Mila van Test',email:'mila@example.test',phone:'0612345678',birthDate:'1990-01-01',startDate:'2026-11-02',street:'Voorbeeldstraat',houseNumber:'8',houseAddition:'A',postalCode:'1234 AB',city:'Teststad',country:'Nederland'};
 for(const [key,value]of Object.entries(values))await page.locator('[data-person] [name='+key+']').fill(value);
 await page.locator('[data-member-action=next]').click();await page.getByRole('heading',{name:'Kostenoverzicht'}).waitFor();assert.equal(await page.locator('[name=discountAmount]').count(),0);assert.match(await page.locator('.members-cost-summary').innerText(),/47,50/);assert.equal(await page.locator('.members-cost-summary dt').filter({hasText:'Eerstvolgende vierwekelijkse factuurdatum'}).locator('+ dd').innerText(),'2026-11-29');
 const saved=await page.evaluate(()=>saved.at(-1));assert.equal(saved.data.person.houseNumber,'8 A');assert.equal(saved.data.person.firstName,'Mila');assert.equal(saved.data.person.lastName,'van Test');assert.equal(saved.data.person.fullName,undefined);
 await page.locator('[data-members-close]').click();
 await page.evaluate(()=>{testBootstrap.drafts=[{id:'old',catalog_id:'catalog-1',version:1,data:{person:{},payment:{discountAmount:'30',discountPeriods:'1'}}}];return FMZMembers.openEnrollment('old');});await page.locator('[data-member-action=next]').click();assert.equal(await page.locator('[data-person]').count(),0);assert.match(await page.locator('[data-members-message]').innerText(),/prijsafwijkingen/);await page.locator('[data-package="catalog-1"]').click();await page.locator('[data-member-action=next]').click();await page.locator('[data-person]').waitFor();assert.equal(await page.evaluate(()=>saved.at(-1).data.payment.discountAmount),undefined);await page.locator('[data-members-close]').click();
 await page.evaluate(()=>FMZMembers.openProfile('Noor'));assert.equal(await page.locator('.members-profile-page').count(),1);assert.equal(await page.locator('[role=tab]').count(),10);
 await page.locator('[data-profile-tab=coaching]').click();assert.deepEqual(await page.evaluate(()=>lastMounted),{view:'coaching',clientId:'Noor'});await page.keyboard.press('ArrowRight');assert.deepEqual(await page.evaluate(()=>lastMounted),{view:'training',clientId:'Noor'});
 await page.evaluate(()=>FMZMembers.openProfile('Mila','nutrition'));assert.deepEqual(await page.evaluate(()=>lastMounted),{view:'nutrition',clientId:'Mila'});assert.doesNotMatch(await page.locator('.members-profile-page').innerText(),/Noor/);
 await page.locator('[data-member-action=camera]').click();await page.getByText('Controleer de uitsnede.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>cameraCalls),1);assert.equal(await page.locator('[data-photo-existing]').count(),1);
 await page.locator('[data-member-action=back]').click();await page.locator('[data-members-close]').click();assert.equal(await page.locator('.members-profile-page').count(),0);assert.equal(await page.evaluate(()=>state.ui.selectedClientId),null);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

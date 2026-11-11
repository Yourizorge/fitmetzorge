/* Actual rendered app + isolated SQL fixtures. All identities and finances are synthetic. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium,webkit}=require('playwright');
const images=path.resolve(__dirname,'../docs/images/compact-profile-20261111');
async function login(p,who='trainer'){
 await p.locator('#loginForm [name=role]').selectOption(who==='trainer'?'trainer':'client');
 await p.locator('#loginForm [name=email]').fill(who+'@example.test');await p.locator('#loginForm [name=password]').fill('synthetic');
 await p.locator('#loginForm button[type=submit]').click();await p.waitForFunction(()=>onlineReady);
}
async function open(p,id='a'){
 await p.locator('#globalSearch').fill(id+'@example');await p.locator('[data-search-member='+id+']').click();
 await p.locator('.members-profile-head').waitFor();await p.locator('#member-panel-overzicht').waitFor();
}
test('approved compact profile: real values, all actions, private drafts and responsive Edge/WebKit',{timeout:240000},async()=>{
 const s=await require('./preview.cjs').start(0);fs.mkdirSync(images,{recursive:true});
 try{
  await require('./layout-fixture.cjs').seed(s);
  const state=await s.database.read('trainer');state.clients[0].profile.phone='0612345678';
  state.clients[0].appointments=[{id:'compact-future',date:'2027-01-15',time:'11:00',duration:60,type:'Synthetische techniektraining',status:'planned'}];
  await s.database.db.query('update public.coach_workspaces set state=$1 where trainer_id=$2',[JSON.stringify(state),s.database.ids.trainer]);
  const h=await require('./current-balances-fixture.cjs').provision(s.database),inv=await h.invoice(12500,'Voorbeeldlid Alex','2026-11-01',{client_id:'a'});
  await h.payInvoice(inv,5000,'2026-11-02');
  const before=JSON.stringify(await h.snapshot());
  for(const engine of ['edge','webkit']){
   const b=await(engine==='edge'?chromium.launch({channel:'msedge',headless:true}):webkit.launch({headless:true})),p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];
   p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>{if(r.request().url().startsWith(s.url+'/'))return r.continue();external.push(r.request().url());return r.abort();});
   try{
    await p.goto(s.url);await login(p);await p.waitForFunction(()=>FMZAccounting.ready);await open(p);
    assert.equal(await p.locator('.members-overview-card').count(),3);
    const overview=p.locator('#member-panel-overzicht');assert.match(await overview.innerText(),/Synthetische techniektraining/);assert.match(await overview.innerText(),/Sterker worden met gecontroleerde techniek/);assert.match(await overview.innerText(),/75,00/);assert.doesNotMatch(await overview.innerText(),/Geboortedatum|Noodcontact|Wijzigingshistorie/);
    assert(await p.locator('.members-profile-head [data-member-action=edit]').isVisible());
    await p.locator('[data-profile-tab=overzicht]').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.locator('[data-profile-tab=gegevens]').getAttribute('aria-selected'),'true');assert(await p.locator('#member-panel-gegevens').isVisible());assert.match(await p.locator('#member-panel-gegevens').innerText(),/0612345678/);
    assert(await p.locator('#member-panel-gegevens [data-member-action=photo]').isVisible());assert.match(await p.locator('#member-panel-gegevens').innerText(),/Account/);
    await p.keyboard.press('End');assert.equal(await p.locator('[data-profile-tab=historie]').getAttribute('aria-selected'),'true');await p.keyboard.press('Home');
    for(const tab of ['coaching','training','voeding','trackers','agenda','financien','documenten','notities','historie','overzicht']){await p.locator('[data-profile-tab='+tab+']').click();assert.equal(await p.locator('[data-profile-tab='+tab+']').getAttribute('aria-selected'),'true');}
    await p.locator('.members-profile-head').getByRole('button',{name:'Notitie toevoegen',exact:true}).click();const note=p.locator('[data-note-form] textarea');assert(await note.isVisible());await note.fill('Nog niet opgeslagen synthetische notitie');await p.locator('[data-profile-tab=overzicht]').click();await p.locator('.members-profile-head').getByRole('button',{name:'Notitie toevoegen',exact:true}).click();assert.equal(await note.inputValue(),'Nog niet opgeslagen synthetische notitie');
    p.once('dialog',d=>d.dismiss());await p.locator('.members-profile-head [data-member-action=edit]').click();assert.equal(await note.inputValue(),'Nog niet opgeslagen synthetische notitie');assert.equal(await p.locator('[data-edit]').count(),0);
    p.once('dialog',d=>d.dismiss());await p.locator('#nav [data-view=trainer-dashboard]').click();assert.equal(await note.inputValue(),'Nog niet opgeslagen synthetische notitie');
    await note.fill('');await p.locator('.members-profile-head [data-member-action=edit]').click();await p.locator('[data-edit] [name=phone]').fill('0698765432');p.once('dialog',d=>d.dismiss());await p.locator('[data-profile-tab=gegevens]').click();assert.equal(await p.locator('[data-edit] [name=phone]').inputValue(),'0698765432');p.once('dialog',d=>d.accept());await p.locator('[data-profile-tab=overzicht]').click();
    for(const theme of ['dark','light']){
     if(await p.evaluate(()=>state.ui.theme)!==theme)await p.locator('#themeToggle').click();
     for(const width of [320,390,768,1440]){
      await p.setViewportSize({width,height:1000});await p.evaluate(()=>scrollTo(0,0));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),engine+' '+theme+' '+width+' no horizontal page overflow');
      const cards=await p.locator('.members-overview-card').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width};}));assert(cards.every(c=>c.x>=-1&&c.right<=width+1&&c.width>0),'all three cards stay within viewport');
      await p.screenshot({path:path.join(images,engine+'-'+theme+'-'+width+'.png'),fullPage:true});
     }
    }
    await p.setViewportSize({width:390,height:844});await p.addStyleTag({content:'.members-profile-page{font-size:200%}'});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'200% profile text has no page overflow');
    await p.reload();await p.waitForFunction(()=>onlineReady);await open(p);assert.equal(await p.locator('.members-overview-card').count(),3);assert.match(await p.locator('#member-panel-overzicht').innerText(),/75,00/);
    await p.evaluate(()=>expireTestSession());await p.waitForFunction(()=>!onlineReady);await login(p,'a');assert.equal(await p.locator('.members-profile-page').count(),0);await p.locator('[data-own-member]').click();await p.locator('dialog.members-dialog').waitFor();assert.equal(await p.locator('.members-overview-card').count(),0);assert.equal(await p.locator('[data-note-form]').count(),0);assert.doesNotMatch(await p.locator('dialog.members-dialog').innerText(),/PRIVATE ADMIN|Nog niet opgeslagen synthetische notitie/);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   }finally{await b.close();}
  }
  assert.equal(JSON.stringify(await h.snapshot()),before,'viewing and cancelled edits do not mutate invoices, payments or ledger');
 }finally{await s.close();}
});

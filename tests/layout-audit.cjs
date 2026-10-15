const fs=require('node:fs'),{chromium}=require('playwright'),{start}=require('./preview.cjs'),{seed,login}=require('./layout-fixture.cjs');
(async()=>{
 const phase=process.argv[2]||'before',shotsOnly=process.argv.includes('--screenshots-only'),out='docs/examples/trainer-pwa-20261015';fs.mkdirSync(out,{recursive:true});
 const preview=await start(0);await seed(preview);const browser=await chromium.launch({headless:true,channel:'msedge'});const report={phase,emulation:true,views:[],media:[],errors:[]};
 try{
 for(const role of ['trainer','member']){
  const context=await browser.newContext();await context.route('**/*',r=>r.request().url().startsWith(preview.url)?r.continue():r.abort());
  if(phase==='before'){
   const html=require('node:child_process').execFileSync('git',['show','787b15065d347cfa39fa374b7d4999a70c08eaa8:index.html'],{encoding:'utf8'}).replace(/https:\/\/cdn.jsdelivr.net\/npm\/@supabase\/supabase-js@2(?:\.\d+\.\d+)?/,'tests/mock-sdk.js').replace('<body class="logged-out">','<body class="logged-out"><aside style="padding:8px;background:#674900;color:white">LOKALE TESTPREVIEW — synthetische gegevens. Accounts: trainer@example.test, a@example.test, b@example.test. Elk wachtwoord werkt; kies Trainer of Lid.</aside>');
   await context.route(preview.url+'/',r=>r.fulfill({contentType:'text/html',body:html}));
  }
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(preview.url);await login(p,role);
  const views=await p.evaluate(()=>allowedViews());
  for(const width of (shotsOnly?[390,1400]:[320,390,768,844,1400])) {
   await p.setViewportSize({width,height:width===844?390:width===1400?1000:844});
   for(const [id,label]of (shotsOnly?[]:views)){await p.evaluate(id=>showView(id),id);await p.waitForTimeout(70);
    report.views.push(await p.evaluate(({role,width,id,label})=>({role,width,id,label,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('.view.active *,.topbar *')].filter(e=>{const r=e.getBoundingClientRect();return e.checkVisibility()&&r.width>0&&(r.right>innerWidth+2||r.left< -2)&&!e.closest('.table-wrap,.agenda-board-wrap,.week-calendar,.tracker-detail-table')}).slice(0,8).map(e=>({tag:e.tagName,cl:e.className,width:Math.round(e.getBoundingClientRect().width)}))}),{role,width,id,label}));
   }
   for(const id of (role==='trainer'?['training','training-log']:['training'])){
    await p.evaluate(id=>showView(id),id);const selector=id==='training'?'.training-exercise-card':'.training-log-exercise';await p.locator(selector).first().evaluate(e=>e.scrollIntoView({behavior:'instant',block:'start'}));await p.waitForTimeout(150);
    report.media.push(await p.locator(selector).first().evaluate((e,info)=>{const media=e.querySelector('.exercise-photo,.training-log-photo'),img=media.querySelector('img');return {...info,card:e.getBoundingClientRect().toJSON(),media:media.getBoundingClientRect().toJSON(),image:img.getBoundingClientRect().toJSON()}},{role,width,id}));
    if([390,1400].includes(width))await p.screenshot({path:`${out}/${phase}-${role}-${id}-${width}.png`,animations:'disabled'});
   }
   if(role==='trainer'&&[390,1400].includes(width)){await p.evaluate(()=>showView('trainer-dashboard'));await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(350);await p.screenshot({path:`${out}/${phase}-trainer-dashboard-${width}.png`,animations:'disabled'});}
  }
  await context.close();
 }
 if(!shotsOnly)fs.writeFileSync(`${out}/${phase}-audit.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({phase,views:report.views.length,overflow:report.views.filter(v=>v.scroll>v.width||v.overflow.length),media:report.media.map(m=>({role:m.role,width:m.width,id:m.id,container:[m.media.width,m.media.height],image:[m.image.width,m.image.height]})),errors:report.errors},null,2));
 }finally{await browser.close();await preview.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

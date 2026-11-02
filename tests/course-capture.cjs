/* Actual local browser capture. Only call with the isolated synthetic preview. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
async function createCapture(page,{name,script,proof=async()=>({})}){
 assert(/^[a-z0-9-]+$/.test(name));assert(script.synthetic===true);
 const root=path.resolve(__dirname,'..'),base=path.join(__dirname,'artifacts',name),take=path.join(base,'take-'+Date.now());fs.mkdirSync(take,{recursive:true});
 const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
 const files=fs.readdirSync(root).filter(f=>/\.(js|html|css)$/.test(f));const hashes=()=>Object.fromEntries(files.map(f=>[f,hash(f)]));
 const runtimeAtStart=hashes(),scenes=[],clicks=[],errors=[],external=[],fast=process.env.FMZ_FAST==='1';let active=null,serial=0;
 const allowed=url=>/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)||/^(blob:|data:)/.test(url);
 assert(allowed(page.url()),'Only isolated preview can be recorded');
 const pageError=e=>errors.push(e.message),request=r=>{if(!allowed(r.url()))external.push(new URL(r.url()).origin);};page.on('pageerror',pageError);page.on('request',request);
 await page.evaluate(()=>{
  const style=document.createElement('style');style.textContent='body{padding-top:48px!important}[data-course-banner]{position:fixed;inset:0 0 auto;height:42px;z-index:2147483646;background:#e5c46d;color:#10131b;padding:9px 18px;font:bold 15px Arial;pointer-events:none}[data-course-cursor]{position:fixed;z-index:2147483647;width:28px;height:28px;margin:-14px;border:3px solid #f1c95e;background:#f1c95e33;border-radius:50%;pointer-events:none}';document.head.append(style);
  const banner=document.createElement('div');banner.dataset.courseBanner='';banner.textContent='OEFENOPNAME — fictieve gegevens, geen echte administratie';document.body.append(banner);
  const cursor=document.createElement('div');cursor.dataset.courseCursor='';cursor.style.display='none';document.body.append(cursor);document.addEventListener('pointermove',e=>{cursor.style.display='block';cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px';});
  const layer=()=>{const target=[...document.querySelectorAll('dialog[open]')].at(-1)||document.body;if(banner.parentElement!==target||!banner.isConnected)target.append(banner);if(cursor.parentElement!==target||!cursor.isConnected)target.append(cursor);};
  new MutationObserver(layer).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});layer();
 });
 const session=await page.context().newCDPSession(page);
 session.on('Page.screencastFrame',event=>{const a=active;if(a&&!fast){const f=String(serial++).padStart(6,'0')+'.jpg';fs.writeFileSync(path.join(take,a.id,f),Buffer.from(event.data,'base64'));a.frames.push({file:a.id+'/'+f,at:Date.now()-a.started});}session.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});});
 if(!fast)await session.send('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:1280,maxHeight:960,everyNthFrame:2});
 const pause=ms=>page.waitForTimeout(fast?0:ms);
 async function frame(){if(fast)return;const a=active,f=String(serial++).padStart(6,'0')+'.jpg';await page.screenshot({path:path.join(take,a.id,f),type:'jpeg',quality:90});a.frames.push({file:a.id+'/'+f,at:Date.now()-a.started});}
 function write(){fs.writeFileSync(path.join(take,'capture.json'),JSON.stringify({synthetic:true,method:'Actual isolated Edge CDP screen capture; real frames held for narration',runtimeAtStart,runtimeAtEnd:hashes(),scriptSHA256:crypto.createHash('sha256').update(JSON.stringify(script)).digest('hex'),scenes,clicks,errors,external},null,2));}
 async function scene(id,action){const chapter=script.chapters.find(c=>c.scenes.some(s=>s.id===id));assert(chapter,'Known scripted scene '+id);assert(/^[a-z0-9-]+$/.test(id));assert(!scenes.some(s=>s.id===id));active={id,started:Date.now(),frames:[]};fs.mkdirSync(path.join(take,id));await page.evaluate(title=>{document.querySelector('[data-course-banner]').textContent='OEFENOPNAME — '+title;},chapter.title);console.log('SCENE',id);await frame();await action();await pause(650);await frame();const a=active;active=null;a.rawDuration=(Date.now()-a.started)/1000;a.frames.sort((x,y)=>x.at-y.at);a.proof=await proof();a.text=await page.locator('body').innerText();assert(!/fitmetzorge@outlook|hgoygcviutmynaihcvpd|Patrick|Debora/i.test(a.text),'Only fictional visible content');scenes.push(a);write();}
 async function click(locator){await locator.scrollIntoViewIfNeeded();const b=await locator.boundingBox();assert(b);await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:fast?1:8});await pause(150);clicks.push({scene:active?.id,label:(await locator.innerText()).slice(0,120),at:Date.now()});await locator.click();await pause(200);}
 async function fill(locator,value){await click(locator);await locator.fill(String(value));await pause(160);}
 let stopped=false;async function stop(){if(stopped)return;stopped=true;await session.send('Page.stopScreencast').catch(()=>{});await session.detach();page.off('pageerror',pageError);page.off('request',request);}
 async function finish(){await stop();assert.equal(scenes.length,script.chapters.flatMap(c=>c.scenes).length);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(hashes(),runtimeAtStart,'Freeze runtime during final recording');write();fs.writeFileSync(path.join(base,'latest-take.txt'),take);console.log('CAPTURE PASS',scenes.length,take);return take;}
 async function abort(){await stop();await page.screenshot({path:path.join(take,'FAIL.png')});fs.writeFileSync(path.join(take,'FAIL.txt'),await page.locator('body').innerText());write();}
 return {scene,click,fill,finish,abort,take};
}
module.exports={createCapture};

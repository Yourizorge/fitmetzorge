const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{chromium}=require('playwright'),{start}=require('./preview.cjs'),M=require('../tutorial/model.js'),C=require('../tutorial/content.js');
const dir='tests/artifacts/tutorial';fs.mkdirSync(dir,{recursive:true});
async function frame(p){await p.waitForSelector('iframe');const f=await p.locator('iframe').contentFrame();await f.locator('[data-action=start]').waitFor();return f;}
async function openLesson(f,id){await f.locator('[data-action=topics]').first().click();await f.locator(`[data-lesson="${id}"]`).click();}
async function pdfView(f,action){await f.locator(`[data-action=${action}]`).click();await f.locator('.pdf-dialog canvas').first().waitFor();await f.locator('.pdf-dialog [role=status]').filter({hasText:'A4-pagina'}).waitFor();await f.locator('[data-action=zoom-in]').click();await f.locator('.pdf-dialog [role=status]').filter({hasText:'125%'}).waitFor();await f.locator('[data-action=zoom-out]').click();await f.locator('[data-action=viewer-close]').click();await f.locator('.pdf-dialog').waitFor({state:'detached'});}
async function download(p,f,action,name){const event=p.waitForEvent('download');await f.locator(`[data-action=${action}]`).click();const d=await event;assert.equal(await d.failure(),null);await d.saveAs(path.join(dir,name||d.suggestedFilename()));return fs.readFileSync(path.join(dir,name||d.suggestedFilename()));}
async function fill(f,step){for(const field of step.fields){const el=f.locator(`#practiceForm [name="${field.key}"]`);if(field.type==='select')await el.selectOption(field.answer);else if(field.type==='checkbox')await el.check();else await el.fill(field.answer);}}
test('every lesson and exercise works through the opaque browser UI, PDFs and completion',{timeout:360000},async()=>{const server=await start(0),browser=await chromium.launch({channel:'msedge',headless:true}),p=await browser.newPage({acceptDownloads:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.goto(server.url+'/tutorial.html');const f=await frame(p);
 await p.screenshot({path:dir+'/start-desktop.png'});
 for(let id=1;id<=27;id++){
  await openLesson(f,id);assert.equal(await f.locator('.explanation').count(),9);await f.locator('[data-action=explain]').first().click();assert.equal(await f.locator('.explanation[open]').count(),9);
  for(const [i,step] of M.plans[id].entries()){
   if(step.fields.length){await f.locator('#practiceForm [data-action=check-practice]').click();assert((await f.locator('#practiceFeedback').innerText()).length>10);}
   await fill(f,step);
   if(step.tour)for(const key of Object.keys(C.help)){await f.locator(`[data-help=${key}]`).click();await f.locator('.info-dialog [data-dialog-close]').click();}
   if(step.tasks){await f.locator('[data-action=tasks]').last().click();await f.locator('[data-task=week-0]').check();await f.locator('[data-task=week-0]').uncheck();await f.locator('[data-action=return-lesson]').click();}
   if(step.csv)await f.locator('[data-action=choose-csv]').click();
   if(step.preview)await pdfView(f,'preview');
   if(step.pdf||step.downloads){await pdfView(f,'open-pdf');const b=await download(p,f,'download-pdf',`lesson-${id}-${i}.pdf`);assert.equal(b.subarray(0,5).toString(),'%PDF-');if(id===9){const second=await download(p,f,'download-pdf','redownload.pdf');assert.equal(crypto.createHash('sha256').update(b).digest('hex'),crypto.createHash('sha256').update(second).digest('hex'));}}
   if(step.downloads){const zip=await download(p,f,'download-zip',`lesson-${id}.zip`);assert.equal(zip.subarray(0,2).toString(),'PK');}
   await f.locator('#practiceForm [data-action=check-practice]').click();
   if(i+1<M.plans[id].length)assert.equal(await f.locator('#practiceTitle').innerText(),M.plans[id][i+1].title,`lesson ${id} step ${step.key}: ${await f.locator('#practice').innerText()}`);
   else await f.locator('#practice h3').filter({hasText:'Oefening doorlopen'}).waitFor();
  }
  if(id===19||id===27){await pdfView(f,'credit-preview');await download(p,f,'credit-download',`lesson-${id}-credit.pdf`);}
  for(let i=0;i<2;i++)await f.locator(`#quizForm [name=q${i}][value="${1-C.lessons[id-1].quiz[i].correct}"]`).check();await f.locator('#quizForm [data-action=check-quiz]').click();assert.equal(await f.locator('[data-quiz-feedback].error').count(),2);
  for(let i=0;i<2;i++)await f.locator(`#quizForm [name=q${i}][value="${C.lessons[id-1].quiz[i].correct}"]`).check();await f.locator('#quizForm [data-action=check-quiz]').click();assert.match(await f.locator('#lessonComplete').innerText(),/afgerond/);
  console.log('PASS lesson',id);
 }
 assert.match(await f.locator('#lessonComplete').innerText(),/Je hebt de APPFMZ-beginnerscursus boekhouden afgerond/);assert.deepEqual(server.calls,[]);assert.equal(server.blobs.size,0);assert.deepEqual(errors,[]);
 const progress=await p.evaluate(()=>JSON.parse(localStorage.getItem('fmz-course-progress-v1')));assert.equal(progress.completed.length,27);assert.deepEqual(Object.keys(progress).sort(),['completed','current','last','tasks','version']);
 fs.writeFileSync(dir+'/all-lessons.json',JSON.stringify({lessons:27,exercises:Object.values(M.plans).reduce((n,p)=>n+p.length,0),progress,writes:server.calls.length,storageUploads:server.blobs.size},null,2));
 }finally{await browser.close();await server.close();}});

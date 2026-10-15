/* Records real clicks in the opaque synthetic course. No invented screens. */

const fs=require('node:fs'),{chromium}=require('playwright'),{start}=require('./preview.cjs');

(async()=>{fs.mkdirSync('tutorial/media',{recursive:true});fs.mkdirSync('tests/artifacts/video',{recursive:true});const server=await start(0),browser=await chromium.launch({headless:true,channel:'msedge'}),context=await browser.newContext({viewport:{width:1000,height:900},recordVideo:{dir:'tests/artifacts/video',size:{width:1000,height:900}},reducedMotion:'reduce'}),p=await context.newPage(),cues=[],started=Date.now();const pause=ms=>new Promise(r=>setTimeout(r,ms));let f;

 async function caption(title,text){const time=(Date.now()-started)/1000;cues.push({time,title,text});await p.evaluate(text=>{let el=document.querySelector('#demoCaption');if(!el){el=document.createElement('div');el.id='demoCaption';el.style='position:fixed;bottom:0;left:0;right:0;z-index:99999;padding:18px 35px;background:#080d15f5;color:#f7e5b7;font:bold 21px/1.5 Arial;text-align:center;border-top:2px solid #d3ac50;pointer-events:none';document.body.append(el);}el.textContent=text;},text);}

 const b=a=>f.locator(`[data-beginner="${a}"]`),screen=async()=>{await f.locator('.practice-shell').evaluate(e=>e.scrollIntoView({block:'start'}));await pause(500);},next=async n=>{for(let i=0;i<n;i++)await b('next').click();await screen();};

 async function pay(amount){await b('pay').click();const form=f.locator('[data-payment-form]');if(amount)await form.locator('[name=amount]').fill(amount);await pause(3300);await form.locator('[data-payment-submit]').click();await f.locator('.practice-payment-dialog').waitFor({state:'detached'});await screen();await pause(1800);}

 try{await p.goto(server.url+'/tutorial.html');f=p.locator('iframe').contentFrame();await f.locator('[data-action=start]').click();await next(1);await b('issue').click();await next(3);await caption('Factuur openen','1. Open de oefenfactuur. €380 min €30 korting = €350 te betalen.');await screen();await pause(4000);await caption('Betaling registreren','2. Betaald ontvangen: controleer bedrag, datum en rekening. Eén bevestiging is voldoende.');await pay();await caption('Bank/Kas','3. Bank/Kas is meteen bijgewerkt. Voer deze €350 niet opnieuw in.');await b('bank').click();await screen();await pause(4300);await next(2);await caption('Deelbetalingen','4. Nieuwe oefenronde: registreer €200. Er blijft €150 open.');await pay('200');await caption('Tweede ontvangst','5. Registreer de tweede €150 op de volgende betaaldatum. De factuur is betaald.');await pay('150');await next(1);await b('history').click();await screen();await caption('Invoer corrigeren','6. Verkeerd ingevoerd? Kies Invoerfout corrigeren. De historie en originele factuur blijven bewaard.');await f.locator('[data-correct-payment]').last().click();await f.locator('[name=reason]').fill('Verkeerde betaaldatum in het voorbeeld');await pause(4000);await f.locator('[data-payment-submit]').click();await f.locator('.practice-payment-dialog').waitFor({state:'detached'});await screen();await pause(2500);await next(3);await caption('Nog open','7. Nog open toont wat nog te ontvangen is. Deze oefenfactuur heeft €150 open.');await screen();await pause(4000);await next(1);await b('reports').click();await screen();await caption('Kwartaaloverzicht','8. Overzichten: ontvangen geld en omzet staan apart. Controleer het gekozen kwartaal.');await pause(5000);const duration=(Date.now()-started)/1000;const video=p.video();await context.close();await video.saveAs('tests/artifacts/payment-demo.webm');

  const stamp=s=>{const ms=Math.floor(s*1000),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,sec=Math.floor(ms/1000)%60;return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};fs.writeFileSync('tutorial/media/betalingen-nl.vtt','WEBVTT\n\n'+cues.map((c,i)=>`${stamp(c.time)} --> ${stamp(cues[i+1]?.time||duration)}\n${c.text}\n`).join('\n'));

  fs.writeFileSync('tutorial/media/betalingen-chapters.json',JSON.stringify({recorded:'2026-10-15',source:'Built opaque-origin synthetic practice UI, Playwright real interactions',subtitles:'burned-in Dutch captions; additional VTT',duration,chapters:cues},null,2)+'\n');console.log('Recorded actual UI, seconds:',duration.toFixed(1));

  fs.writeFileSync('tutorial/demo-data.js','window.FMZPaymentDemo='+fs.readFileSync('tutorial/media/betalingen-chapters.json','utf8').trim()+';\n');

  const ffmpeg=process.env.FMZ_FFMPEG||'tests/artifacts/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';

  if(!fs.existsSync(ffmpeg))throw Error('Set FMZ_FFMPEG to a local FFmpeg with libx264; no production dependency.');

  require('node:child_process').execFileSync(ffmpeg,['-y','-i','tests/artifacts/payment-demo.webm','-c:v','libx264','-preset','medium','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart','-an','tutorial/media/betalingen.mp4'],{stdio:'inherit'});

  console.log('Actual recording converted locally to seekable H.264 MP4.');

 }finally{await browser.close();await server.close();}})().catch(e=>{console.error(e);process.exitCode=1});

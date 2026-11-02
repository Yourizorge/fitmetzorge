/* Runs only inside the opaque sandbox. There is intentionally no production SDK. */
(()=>{
 'use strict';const nonce=window.__OWNER_TEST_NONCE,CHANNEL='fmz-owner-laptop-v1',waiting=new Map();let started=false,adapter=null;
 const send=(type,body={})=>parent.postMessage({channel:CHANNEL,nonce,type,...body},'*');
 async function request(type,body){const id=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{waiting.delete(id);if(type==='camera-request')send('camera-cancel');reject(Error(type==='camera-request'?'Camera gesloten na vijf minuten. Kies opnieuw Foto maken.':'Testopslag kreeg geen bevestiging. Probeer opnieuw.'));},type==='camera-request'?300000:20000);waiting.set(id,{resolve,reject,timer});send(type,{id,...body});});}
 function script(code){const el=document.createElement('script');el.nonce=nonce;el.textContent=code;document.head.append(el);}
 async function close(){const event=new Event('beforeunload',{cancelable:true});if(!dispatchEvent(event)){alert('Er is nog onopgeslagen testinvoer. Sla het concept op voordat je de test sluit.');return;}try{if(adapter&&!adapter.getState().closed)await adapter.checkpoint();send('close');}catch(error){alert(error.message);}}
 window.OwnerTestHost={close,restart(){if(!adapter?.getState().closed)throw Error('Verwijder eerst de huidige testrun met de gecontroleerde verwijderlijst.');send('restart');}};
 window.OwnerTestCamera={capture:async()=>{const b=await request('camera-request',{});if(!(b instanceof Blob)||b.type!=='image/jpeg'||b.size>4000000)throw Error('Ongeldige camerafoto.');return b;},cancel:()=>send('camera-cancel')};
 window.OwnerTestDocuments={show:(blob,options={})=>request('document-request',{blob,filename:options.filename,mode:options.mode||'view'})};
 const memoryStorage=()=>{const data=new Map();return{getItem:k=>data.get(String(k))??null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size}};};
 async function start(m){
  const r=m.runtime;if(r?.synthetic!==true)throw Error('Geen geldige synthetische test.');
  for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{value:memoryStorage(),configurable:false});
  const objects=new Map(),createURL=URL.createObjectURL.bind(URL),revokeURL=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=blob=>{const url=createURL(blob);objects.set(url,blob);return url;};URL.revokeObjectURL=url=>{objects.delete(url);revokeURL(url);};
  const dataBlob=data=>{const [header,body]=data.split(',');return new Blob([Uint8Array.from(atob(body),c=>c.charCodeAt(0))],{type:header.slice(5).split(';')[0]});};
  // Local bytes only. Even a programming error cannot reach an API because CSP connect-src is none.
  window.fetch=async input=>{const url=String(input?.url||input);if(objects.has(url))return new Response(objects.get(url));if(url==='fit-met-zorge-logo.png'||url.endsWith('/fit-met-zorge-logo.png'))return new Response(dataBlob(r.logoURL));if(url.startsWith('data:'))return new Response(dataBlob(url));throw Error('TESTMODUS: externe verbinding geblokkeerd ('+url.slice(0,140)+').');};
  const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker{constructor(url,options){if(url!=='vendor/heic-worker.js')throw Error('Onbekende testworker');super(URL.createObjectURL(new Blob([r.heic],{type:'text/javascript'})),options);}};
  window.FMZ_CONFIG={SUPABASE_URL:'https://synthetic.invalid',SUPABASE_ANON_KEY:'synthetic-owner-laptop',INVITE_FUNCTION_NAME:'disabled'};
  script(m.pglite);script(r.database);
  const pgliteWasmModule=await WebAssembly.compile(m.wasm),initdbWasmModule=await WebAssembly.compile(m.initdb);
  adapter=await OwnerTestDatabase.create({PGlite:OwnerTestPGlite,pgliteWasmModule,initdbWasmModule,fsBundle:new Blob([m.fs]),seed:new Blob([m.seed]),restore:m.restore,persist:value=>request('checkpoint',{value}),remove:runId=>request('delete-run',{runId})});
  window.OwnerTestAdapter=adapter;window.supabase={createClient:()=>adapter.sdk};
  window.FMZPush={render(){},lock(){},mount(){},openBillingTask(){}};
  window.FMZBillingNotifications={mount(){},lock(){}};
  window.FMZTutorial={open(){alert('Deze test behandelt de nieuwe ledenroute. De bestaande cursus staat in je echte app.');},close(){},help(){}};
  document.body.className='logged-out';document.body.innerHTML=r.html;
  for(const css of r.styles){const el=document.createElement('style');el.textContent=css;document.head.append(el);}
  const style=document.createElement('style');style.textContent='html{scroll-behavior:auto}body{padding-top:54px}a[href^="http"],a[href^="mailto:"]{pointer-events:none}';document.head.append(style);
  document.addEventListener('submit',e=>e.preventDefault());
  document.addEventListener('click',e=>{const a=e.target.closest('a');if(a&&!a.download&&!a.href.startsWith('blob:')&&!a.href.startsWith('#'))e.preventDefault();},true);
  for(const {code} of r.scripts)script(code);
  script(r.media);script(r.verifyImage);
  const invoice=window.FMZDocuments.pdf;
  window.FMZDocuments.pdf=async(...args)=>{
   const result=await invoice(...args),doc=await PDFLib.PDFDocument.load(result),font=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
   for(const page of doc.getPages())page.drawText('OEFENFACTUUR — NIET GELDIG',{x:42,y:100,size:15,font,color:PDFLib.rgb(.7,.12,.1)});
   doc.setTitle('OEFENFACTUUR — NIET GELDIG');return doc.save();
  };
  script(r.pdfRenderer);
  window.FMZDocuments.renderPDF=async(bytes,element,isCurrent=()=>true)=>{
   const task=pdfjsLib.getDocument({data:new Uint8Array(bytes),useSystemFonts:true,isEvalSupported:false});
   try{const pdf=await task.promise,fragment=document.createDocumentFragment();for(let i=1;i<=pdf.numPages;i++){
    if(!element.isConnected||!isCurrent())return;const page=await pdf.getPage(i),viewport=page.getViewport({scale:1.4}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.style.cssText='max-width:100%;height:auto;display:block;margin:12px auto';canvas.setAttribute('aria-label',`Test-PDF pagina ${i} van ${pdf.numPages}`);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;fragment.append(canvas);
   }if(element.isConnected&&isCurrent())element.replaceChildren(fragment);}finally{await task.destroy();}
  };
  script(r.navigation);script(r.guide);
  const timeout=Date.now()+30000;while(!window.FMZAccounting?.ready){if(Date.now()>timeout)throw Error('Synthetische traineromgeving kon niet worden gestart.');await new Promise(resolve=>setTimeout(resolve,100));}
  showView('administration');FMZAccounting.render(true);showView('clients');FMZMembers.render();await FMZOwnerNavigation.start(adapter);await FMZOwnerGuide.start(adapter);
 }
 addEventListener('message',async e=>{
  const m=e.data;if(e.source!==parent||m?.channel!==CHANNEL||m.nonce!==nonce)return;
  if(m.type==='ack'){const p=waiting.get(m.id);if(!p)return;clearTimeout(p.timer);waiting.delete(m.id);m.ok?p.resolve(m.value):p.reject(Error(m.error));return;}
  if(m.type==='init'&&!started){started=true;try{await start(m);}catch(error){document.body.replaceChildren();const p=document.createElement('p');p.textContent='Laptoptest niet gestart: '+error.message;const b=document.createElement('button');b.textContent='Terug naar de echte app';b.onclick=()=>send('close');document.body.append(p,b);}}
  if(m.type==='request-close')await close();
 });
})();

/* Owner-only launcher. The child receives static assets and synthetic checkpoints only.
   No session, real profile, workspace, mailbox credential or production RPC bridge. */
window.FMZOwnerLaptopTest=(()=>{
 'use strict';
 const FLAGS=Object.freeze({ownerTest:true,memberSearch:false,enrollment:false,signature:false,memberProfile:false,billingPlanning:false,emailSending:false,billingPush:false,automaticInvoiceSending:false});
 const CHANNEL='fmz-owner-laptop-v1',DB='fmz-owner-laptop-synthetic-v1';
 let dialog=null,frame=null,nonce='',owner=null,pending=0,dbPromise=null,opening=false,unsubscribe=null,releaseLease=null,releaseWanted=false;
 const ready=()=>typeof onlineProfile!=='undefined'&&onlineProfile?.role==='trainer'&&window.FMZAccounting?.ready===true;
 function database(){return dbPromise||=(new Promise((resolve,reject)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>q.result.createObjectStore('runs');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(Error('Testconcepten bewaren is niet beschikbaar in deze browser.'));}));}
 async function store(mode,key,value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('runs',mode==='get'?'readonly':'readwrite'),os=tx.objectStore('runs');let q=mode==='get'?os.get(key):mode==='delete'?os.delete(key):os.put(value,key);let result;q.onsuccess=()=>{result=q.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(Error('Testconcept nog niet opgeslagen. Probeer opnieuw.'));tx.onabort=()=>reject(Error('Testopslag onderbroken.'));});}
 function active(){return owner&&ready()&&onlineProfile.id===owner;}
 function send(type,body={}){frame?.contentWindow.postMessage({channel:CHANNEL,nonce,type,...body},'*');}
 function release(){if(pending===0&&releaseWanted){releaseLease?.();releaseLease=null;releaseWanted=false;}}
 function close(){window.FMZOwnerTestCamera?.cancel();window.FMZOwnerTestDocuments?.clear();frame?.remove();frame=null;dialog?.remove();dialog=null;nonce='';owner=null;opening=false;releaseWanted=true;release();}
 async function lease(id){if(!navigator.locks)throw Error('Gebruik een actuele Edge- of Chrome-browser voor de veilige laptoptest.');return new Promise((resolve,reject)=>{navigator.locks.request('fmz-owner-test:'+id,{ifAvailable:true},async lock=>{if(!lock){resolve(false);return;}await new Promise(done=>{releaseLease=done;releaseWanted=false;resolve(true);});}).catch(reject);});}
 async function verify(){
  if(!ready())throw Error('Deze laptoptest is alleen beschikbaar voor de geverifieerde eigenaar.');
  const profileId=onlineProfile.id;
  const {data,error}=await supabaseClient.auth.getUser();
  if(error||data?.user?.id!==profileId)throw Error('Meld je opnieuw aan als eigenaar.');
  const checked=await supabaseClient.rpc('fmz_accounting_read');
  if(checked.error||!checked.data||!ready()||onlineProfile.id!==profileId)throw Error('Eigenaarsbevoegdheid kon niet worden bevestigd.');
  return profileId;
 }
 async function bytes(path,expected){
  if(!/^owner-test\/[a-zA-Z0-9._/-]+$/.test(path)||path.includes('..'))throw Error('Ongeldig testbestand.');
  const r=await fetch(path,{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('Testbestand niet beschikbaar: '+path);
  const b=await r.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(hash!==expected)throw Error('Testbestanden horen niet bij dezelfde release. Vernieuw de app.');return b;
 }
 async function open(){
  if(opening||dialog)return;opening=true;
  try{
   owner=await verify();if(!await lease(owner))throw Error('Deze test is al geopend in een ander tabblad. Sluit die test eerst.');nonce=crypto.randomUUID();
   dialog=document.createElement('dialog');dialog.className='fmz-owner-test-host';dialog.setAttribute('aria-label','Afgeschermde APPFMZ laptoptest');
   const header=document.createElement('header'),title=document.createElement('strong'),exit=document.createElement('button');
   title.innerHTML='TESTMODUS<span class="ot-host-detail"> — geen invloed op je echte administratie</span>';title.setAttribute('aria-label','TESTMODUS — geen invloed op je echte administratie');exit.innerHTML='Terug<span class="ot-host-detail"> naar mijn echte app</span>';exit.setAttribute('aria-label','Terug naar mijn echte app');exit.type='button';exit.onclick=()=>send('request-close');header.append(title,exit);
   const status=document.createElement('p');status.textContent='Afgeschermde test laden en bestanden controleren…';status.setAttribute('role','status');dialog.append(header,status);document.body.append(dialog);dialog.showModal();dialog.addEventListener('cancel',e=>{e.preventDefault();if(frame)send('request-close');else close();});
   const response=await fetch('owner-test/manifest.json',{cache:'no-store',credentials:'omit'});if(!response.ok)throw Error('Laptoptest nog niet beschikbaar.');const manifest=await response.json();
   if(manifest.version!==1||manifest.synthetic!==true)throw Error('Ongeldige testrelease.');
   const loaded=await Promise.all(Object.entries(manifest.files).map(async([key,v])=>[key,await bytes(v.path,v.sha256)]));
   if(!active())throw Error('Sessie gewijzigd.');
   const assets=Object.fromEntries(loaded),runtime=JSON.parse(new TextDecoder().decode(assets.runtime)),restore=await store('get',owner);
   for(const[k,v]of Object.entries(runtime.brand.tokens))dialog.style.setProperty('--ot-'+k,v);const mark=document.createElement('img');mark.src=runtime.brand.variants.sidebar;mark.alt='Fit Met Zorge';mark.style.cssText='width:110px;height:55px;object-fit:contain';header.prepend(mark);
   if(!assets.camera||!assets.documents)throw Error('Camera- of documentmodule ontbreekt in deze testversie.');
   const cameraScript=document.createElement('script');cameraScript.textContent=new TextDecoder().decode(assets.camera);window.FMZOwnerTestCamera?.cancel();document.head.append(cameraScript);cameraScript.remove();window.FMZOwnerTestCamera.configure(runtime.brand.tokens);
   const documentScript=document.createElement('script');documentScript.textContent=new TextDecoder().decode(assets.documents);window.FMZOwnerTestDocuments?.clear();document.head.append(documentScript);documentScript.remove();window.FMZOwnerTestDocuments.configure(runtime.pdfRenderer,runtime.brand.tokens);
   if(!active())throw Error('Sessie gewijzigd.');
   frame=document.createElement('iframe');frame.title='APPFMZ synthetische trainerstest';frame.setAttribute('sandbox','allow-scripts allow-downloads allow-modals allow-forms');frame.referrerPolicy='no-referrer';
   frame.allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'";
   const images=(runtime.exerciseImages||[]);if(!Array.isArray(images)||images.some(url=>!/^https:\/\/fitnessprogramer\.com\/wp-content\/uploads\/[0-9]{4}\/[0-9]{2}\/[a-zA-Z0-9_-]+\.gif$/.test(url)))throw Error('Ongeldige oefenmediabron.');
   const csp=`default-src 'none'; script-src 'nonce-${nonce}' 'wasm-unsafe-eval' blob:; style-src 'unsafe-inline'; img-src data: blob: ${images.join(' ')}; connect-src 'none'; worker-src blob:; frame-src blob:; object-src 'none'; form-action 'none'; base-uri 'none'; font-src data:`;
   const boot=new TextDecoder().decode(assets.boot).replaceAll('</script','<\\/script');
   frame.srcdoc=`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>APPFMZ TESTMODUS</title></head><body><p>Testomgeving starten…</p><script nonce="${nonce}">window.__OWNER_TEST_NONCE=${JSON.stringify(nonce)};${boot}<\/script></body></html>`;
   frame.addEventListener('load',()=>{if(active())send('init',{runtime,wasm:assets.wasm,initdb:assets.initdb,fs:assets.fs,seed:assets.seed,pglite:new TextDecoder().decode(assets.pglite),restore:restore||null});},{once:true});
   status.remove();dialog.append(frame);
  }catch(e){close();alert(e.message||'Laptoptest openen mislukt.');}finally{opening=false;}
 }
 addEventListener('message',async e=>{
  const m=e.data;if(!frame||e.source!==frame.contentWindow||e.origin!=='null'||m?.channel!==CHANNEL||m.nonce!==nonce)return;
  if(!active()){close();return;}
  const generation=nonce,key=owner;
  if(m.type==='close'){close();return;}
  if(m.type==='restart'){close();open();return;}
  if(m.type==='camera-request'&&typeof m.id==='string'){
   try{const photo=await window.FMZOwnerTestCamera.capture({isCurrent:()=>active()&&generation===nonce});if(active()&&generation===nonce)send('ack',{id:m.id,ok:true,value:photo});}
   catch(error){if(active()&&generation===nonce)send('ack',{id:m.id,ok:false,error:error.message});}return;
  }
    if(m.type==='document-request'&&typeof m.id==='string'){
   try{const result=await window.FMZOwnerTestDocuments.show(m.blob,{filename:m.filename,mode:m.mode,isCurrent:()=>active()&&generation===nonce});if(active()&&generation===nonce)send('ack',{id:m.id,ok:true,value:result});}
   catch(error){if(active()&&generation===nonce)send('ack',{id:m.id,ok:false,error:error.message});}return;
  }  if(m.type==='camera-cancel'){window.FMZOwnerTestCamera?.cancel();return;}
  if(!['checkpoint','delete-run'].includes(m.type)||typeof m.id!=='string')return;
  pending++;
  try{
   if(m.type==='checkpoint'){
    if(m.value?.synthetic!==true||typeof m.value.runId!=='string'||!m.value.runId.startsWith('TEST-'))throw Error('Ongeldig synthetisch checkpoint.');
    await store('put',key,m.value);
   }else{
    const old=await store('get',key);if(old&&old.runId!==m.runId)throw Error('De testrun is veranderd; vernieuw eerst.');
    window.FMZOwnerTestDocuments?.clear();await store('delete',key);if(await store('get',key))throw Error('Verwijdering nog niet bevestigd.');
   }
   if(active()&&generation===nonce)send('ack',{id:m.id,ok:true});
  }catch(error){if(active()&&generation===nonce)send('ack',{id:m.id,ok:false,error:error.message});}finally{pending--;release();}
 });
 addEventListener('beforeunload',e=>{if(pending){e.preventDefault();e.returnValue='';}});
 function mount(){
  let button=document.querySelector('[data-owner-laptop-launch]');
  if(!ready()||!FLAGS.ownerTest){button?.remove();if(dialog)close();return;}
  if(button)return;
  const target=document.querySelector('#clients .view-head')||document.querySelector('#settings .view-head');if(!target)return;
  button=document.createElement('button');button.type='button';button.className='primary-btn';button.dataset.ownerLaptopLaunch='';button.textContent='Nieuwe ledeninschrijving testen';button.onclick=open;target.append(button);
  if(new URLSearchParams(location.search).get('owner-test')==='1'&&!opening&&!dialog){history.replaceState(history.state,'',location.pathname+location.hash);open();}
 }
 const style=document.createElement('style');style.textContent='.fmz-owner-test-host{width:min(1600px,98vw);height:96dvh;max-width:98vw;max-height:96dvh;padding:0;border:1px solid var(--ot-gold,#dfa639);background:var(--ot-background,#080808);color:var(--ot-text,#f7f7f5)}.fmz-owner-test-host[open]{display:flex;flex-direction:column}.fmz-owner-test-host::backdrop{background:#000b}.fmz-owner-test-host>header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;padding:8px 16px;background:var(--ot-surface,#141414);color:var(--ot-text,#f7f7f5)}.fmz-owner-test-host>header button{padding:8px 12px;min-height:44px;background:var(--ot-surface-raised,#202020);color:var(--ot-text,#f7f7f5);border:1px solid var(--ot-border,#73736b);border-radius:8px}.fmz-owner-test-host>header button:focus-visible{outline:3px solid var(--ot-focus,#f1bf4b);outline-offset:3px}@media(max-width:850px){.fmz-owner-test-host>header{flex-wrap:nowrap;gap:8px;padding:4px 8px;flex:none}.fmz-owner-test-host>header>img{width:72px!important;height:36px!important}.fmz-owner-test-host>header>strong{font-size:13px;flex:1;min-width:0}.fmz-owner-test-host>header .ot-host-detail{display:none}.fmz-owner-test-host>header button{font-size:13px;padding:6px 10px;flex:none}}.fmz-owner-test-host>iframe{display:block;border:0;width:100%;flex:1;min-height:0}.fmz-owner-test-host>p{padding:24px}';document.head.append(style);
 let queued=false;new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;mount();});}}).observe(document.body,{childList:true,subtree:true});
 if(typeof supabaseClient!=='undefined')unsubscribe=supabaseClient.auth.onAuthStateChange((event,session)=>{if(owner&&(!session?.user||session.user.id!==owner))close();});
 mount();return {open,close,flags:FLAGS};
})();

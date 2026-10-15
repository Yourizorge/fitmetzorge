/* Push only: deliberately no fetch handler, cache, skipWaiting or forced navigation. */
// This store contains only random delivery IDs and expiry times, never appointment/user data.
function receipts(){return new Promise((resolve,reject)=>{const request=indexedDB.open('fmz-push-receipts',1);request.onupgradeneeded=()=>request.result.createObjectStore('ids');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function seen(id,expiry){const db=await receipts();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('ids',expiry?'readwrite':'readonly'),store=tx.objectStore('ids'),q=expiry?store.put(expiry,id):store.get(id);if(expiry){const cursor=store.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){if(c.value<Date.now())c.delete();c.continue();}};}q.onerror=()=>reject(q.error);tx.oncomplete=()=>resolve(q.result);tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
let pushQueue=Promise.resolve();
self.addEventListener('push',event=>{
 let payload;try{payload=event.data.json();}catch{return;}
 if(!/^[0-9a-f-]{36}$/.test(payload.id||'')||!Number.isFinite(Date.parse(payload.expiresAt))||Date.parse(payload.expiresAt)<=Date.now())return;
 const deliver=async()=>{if(await seen(payload.id).catch(()=>false))return;await self.registration.showNotification('FitMetZorge',{
  body:payload.kind==='test'?'Dit is je aangevraagde testmelding.':payload.kind==='reminder'?'Je hebt binnenkort een afspraak bij FitMetZorge.':'Er is een wijziging in je FitMetZorge-agenda. Open de app voor details.',
  icon:'/assets/pwa/icon-192.png',badge:'/assets/pwa/icon-192.png',tag:'fmz-'+payload.id,renotify:false,data:{url:/^[0-9a-f-]{36}$/.test(payload.eventId||'')?'/#melding='+payload.eventId:'/#meldingen'}
 });await seen(payload.id,Date.parse(payload.expiresAt)).catch(()=>{});};
 pushQueue=pushQueue.then(deliver,deliver);event.waitUntil(pushQueue);
});
self.addEventListener('notificationclick',event=>{const url=event.notification.data?.url;event.notification.close();event.waitUntil(self.clients.openWindow(/^\/#melding=[0-9a-f-]{36}$/.test(url||'')?url:'/#meldingen'));});

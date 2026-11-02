/* Explicit opt-in only. No private response cache and no automatic reload on updates. */
(function(){
 const show=(target,message)=>{if(target)target.textContent=message;};
 function keyBytes(s){const p=s.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(p+'='.repeat((4-p.length%4)%4)),c=>c.charCodeAt(0));}
 function bindActor(){const generation=authGeneration,id=onlineProfile?.id;return()=>{if(!id||!onlineReady||authGeneration!==generation||onlineProfile?.id!==id)throw Error('Account of sessie gewijzigd. Schakel meldingen bewust opnieuw in voor dit account.');};}
 async function registration(){if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw new Error('Deze browser ondersteunt geen push. Op iPhone: installeer FitMetZorge op je beginscherm en open de app daar.');const r=await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;return r;}
 async function enable(data,target){try{
  const check=bindActor();check();const preferences={...data?.preferences};
  if(!data?.pushReady||!data.publicKey)throw new Error('Push is nog niet beschikbaar. Het berichtenoverzicht werkt wel.');
  if(!('Notification'in window))throw new Error('Open de geïnstalleerde app vanaf je beginscherm voor pushmeldingen.');
  // This call must remain in the user's click event, before any awaited network operation.
  const permission=await Notification.requestPermission();check();if(permission!=='granted'){show(target,'Geen toestemming voor push. Je afspraken en berichtenoverzicht blijven werken.');return;}
  const r=await registration();check();let s=await r.pushManager.getSubscription();check();if(!s){s=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(data.publicKey)});check();}
  const result=await FMZAgenda.command('subscribe',s.toJSON(),target);check();if(!result)return;
  const saved=await FMZAgenda.command('preferences',{...preferences,push:true},target);check();if(saved)show(target,'Push ingeschakeld op dit toestel. Gebruik Testmelding om de ontvangst te controleren.');
 }catch(e){show(target,e.message||'Inschakelen mislukt. Probeer opnieuw.');}}
 async function disable(target){try{const check=bindActor();check();const result=await FMZAgenda.command('preferences',{...FMZAgenda.data?.preferences,push:false},target);check();if(!result)return;await FMZAgenda.command('unsubscribe',{},target);check();await clearLocal(check);check();show(target,'Push uitgeschakeld. Berichten blijven in de app beschikbaar.');}catch(e){show(target,e.message||'Uitschakelen niet bevestigd.');}}
 async function clearLocal(check=()=>{}){try{const r=await navigator.serviceWorker?.getRegistration('/');check();const s=await r?.pushManager.getSubscription();check();if(s)await s.unsubscribe();check();const notices=await r?.getNotifications()||[];check();for(const n of notices)n.close();}catch{}}
 // Notification links reveal no appointment information until the normal login and RPC checks pass.
 window.addEventListener('load',()=>{if(location.hash==='#meldingen'||/^#melding=[0-9a-f-]{36}$/.test(location.hash)){const messageId=location.hash.startsWith('#melding=')?location.hash.slice(9):null;const check=setInterval(()=>{if(typeof onlineReady!=='undefined'&&onlineReady&&FMZAgenda.data){clearInterval(check);showView('agenda');if(messageId)void FMZAgenda.openMessage(messageId);else FMZAgenda.settings();history.replaceState(null,'',location.pathname+location.search);}},500);setTimeout(()=>clearInterval(check),300000);}});
 window.FMZPush={enable,disable,clearLocal};
 window.addEventListener('load',()=>{if(!/^#facturatie(?:=[0-9a-f-]{36})?$/.test(location.hash))return;const taskId=location.hash.includes('=')?location.hash.split('=')[1]:null;const check=setInterval(()=>{if(window.FMZAccounting?.ready){clearInterval(check);FMZAccounting.openPlanning(taskId);history.replaceState(null,'',location.pathname+location.search);}else if(window.FMZAccounting?.access===false)clearInterval(check);},500);setTimeout(()=>clearInterval(check),300000);});
})();

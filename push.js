/* Explicit opt-in only. No private response cache and no automatic reload on updates. */
(function(){
 const show=(target,message)=>{if(target)target.textContent=message;};
 function keyBytes(s){const p=s.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(p+'='.repeat((4-p.length%4)%4)),c=>c.charCodeAt(0));}
 async function registration(){if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw new Error('Deze browser ondersteunt geen push. Op iPhone: installeer FitMetZorge op je beginscherm en open de app daar.');const r=await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;return r;}
 async function enable(data,target){try{
  if(!data?.pushReady||!data.publicKey)throw new Error('Push is nog niet beschikbaar. Het berichtenoverzicht werkt wel.');
  if(!('Notification'in window))throw new Error('Open de geïnstalleerde app vanaf je beginscherm voor pushmeldingen.');
  // This call must remain in the user's click event, before any awaited network operation.
  const permission=await Notification.requestPermission();if(permission!=='granted'){show(target,'Geen toestemming voor push. Je afspraken en berichtenoverzicht blijven werken.');return;}
  const r=await registration();let s=await r.pushManager.getSubscription();if(!s)s=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(data.publicKey)});
  const result=await FMZAgenda.command('subscribe',s.toJSON(),target);if(!result)return;
  const saved=await FMZAgenda.command('preferences',{...data.preferences,push:true},target);if(saved)show(target,'Push ingeschakeld op dit toestel. Gebruik Testmelding om de ontvangst te controleren.');
 }catch(e){show(target,e.message||'Inschakelen mislukt. Probeer opnieuw.');}}
 async function disable(target){const result=await FMZAgenda.command('preferences',{...FMZAgenda.data?.preferences,push:false},target);if(!result)return;await FMZAgenda.command('unsubscribe',{},target);await clearLocal();show(target,'Push uitgeschakeld. Berichten blijven in de app beschikbaar.');}
 async function clearLocal(){try{const r=await navigator.serviceWorker?.getRegistration('/');const s=await r?.pushManager.getSubscription();if(s)await s.unsubscribe();for(const n of await r?.getNotifications()||[])n.close();}catch{}}
 // Notification links reveal no appointment information until the normal login and RPC checks pass.
 window.addEventListener('load',()=>{if(location.hash==='#meldingen'||/^#melding=[0-9a-f-]{36}$/.test(location.hash)){const messageId=location.hash.startsWith('#melding=')?location.hash.slice(9):null;const check=setInterval(()=>{if(typeof onlineReady!=='undefined'&&onlineReady&&FMZAgenda.data){clearInterval(check);showView('agenda');if(messageId)void FMZAgenda.openMessage(messageId);else FMZAgenda.settings();history.replaceState(null,'',location.pathname+location.search);}},500);setTimeout(()=>clearInterval(check),300000);}});
 window.FMZPush={enable,disable,clearLocal};
})();

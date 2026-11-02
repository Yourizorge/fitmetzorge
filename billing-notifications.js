/* Owner billing notifications. Permission is requested only from a deliberate click. */
window.FMZBillingNotifications=(()=>{
 let active=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mount(root,h){
  active?.close();let alive=true,busy=false,pending=null,data=null;
  root.innerHTML='<section class="panel fmz-billing-notifications"><h2>Factuurmeldingen</h2><p>Je taken blijven in APPFMZ staan, ook zonder telefoonmeldingen. Alleen de eigenaar ontvangt deze meldingen; leden krijgen hierdoor geen herinnering.</p><div class="acc-actions"><button type="button" class="secondary-btn" data-billing-push="enable">Telefoonmeldingen inschakelen</button><button type="button" class="secondary-btn" data-billing-push="disable">Factuurmeldingen uitschakelen</button><button type="button" class="secondary-btn" data-billing-push="test">Eén testmelding naar mijn telefoon</button></div><p data-billing-push-status role="status">Meldingen laden…</p><div data-billing-reminders></div></section>';
  const status=s=>{if(alive)root.querySelector('[data-billing-push-status]').textContent=s;};
  function render(){if(!alive)return;status(data.push?'Factuurmeldingen ingeschakeld. Ontvangst op je eigen telefoon moet je zelf controleren.':'Telefoonmeldingen uit. Het takenoverzicht in de app blijft beschikbaar.');root.querySelector('[data-billing-reminders]').innerHTML=data.reminders.map(r=>`<button type="button" class="secondary-btn" data-billing-task="${esc(r.task_id)}">${r.kind==='billing_test'?'Testmelding':r.kind==='billing_prepare'?'Binnenkort voorbereiden':'Facturen controleren'} · ${esc(r.period_start)} t/m ${esc(r.period_end)}</button>`).join('')||'<p>Nog geen factuurmeldingen.</p>';}
  async function command(action,payload){const key=JSON.stringify({action,payload});if(pending&&pending.key!==key)throw Error('Vraag eerst de uitkomst van de vorige handeling opnieuw op.');pending??={key,request_id:crypto.randomUUID()};try{const result=await h.rpc('fmz_billing_reminders_command',{action,payload,request_id:pending.request_id});pending=null;return result;}catch(e){if(e.code&&/^(PT409|22|23|42|P0001)/.test(e.code))pending=null;throw e;}}
  async function click(e){const b=e.target.closest('[data-billing-push],[data-billing-task]');if(!b||!root.contains(b)||busy)return;if(b.dataset.billingTask){h.open(b.dataset.billingTask);return;}busy=true;b.disabled=true;try{
   const a=b.dataset.billingPush;
   if(a==='enable'){
    if(!window.FMZAgenda?.data?.pushReady)throw Error('Open eerst Agenda → Meldingen om de bestaande telefoonverbinding te controleren. Je factuurtaken blijven hier zichtbaar.');
    await FMZPush.enable(FMZAgenda.data,root.querySelector('[data-billing-push-status]'));if(!alive)return;
    if(!('Notification'in window)||Notification.permission!=='granted')return;
    await FMZAgenda.refresh();if(!alive)return;if(!FMZAgenda.data?.preferences?.push)throw Error('Telefoonverbinding nog niet bevestigd. Probeer opnieuw.');
    data=await command('preferences',{push:true});render();
   }else if(a==='disable'){data=await command('preferences',{push:false});render();}
   else {if(!data?.push)throw Error('Schakel telefoonmeldingen eerst bewust in.');data=await command('test',{});render();status('Eén testmelding ingepland. Dit bewijst nog geen fysieke ontvangst op je iPhone.');}
  }catch(error){status(error.message||'Niet bevestigd — probeer opnieuw.');}finally{if(alive){busy=false;b.disabled=false;}}}
  root.addEventListener('click',click);
  h.rpc('fmz_billing_reminders_read').then(async value=>{if(!alive)return;data=value;if(value.push&&'Notification'in window&&Notification.permission==='denied')data=await command('preferences',{push:false});render();}).catch(e=>status('Meldingen niet geladen — '+e.message));
  const instance={close(){alive=false;data=null;pending=null;root.removeEventListener('click',click);root.replaceChildren();}};active=instance;return instance;
 }
 return {mount,lock(){active?.close();active=null;}};
})();

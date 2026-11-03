/* Owner-only synthetic laptop feedback route. No invoice/mail automation. */
window.FMZOwnerGuide=(()=>{
 'use strict';let active=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const steps=[
 [
  "logo-v4",
  "Nieuw logo controleren",
  "Controleer TESTMODUS en het aangeleverde logo bovenaan en op het Dashboard.",
  "Alle onderdelen van het nieuwe logo blijven zichtbaar; de gewone app is niet aangepast.",
  "settings"
 ],
 [
  "colours-v4",
  "Nieuwe kleuren controleren",
  "Bekijk in Instellingen het logo op licht en donker en de appicoonvoorbeelden.",
  "Rustige zwarte oppervlakken, leesbare tekst en drie goudtinten uit de bron.",
  "settings"
 ],
 [
  "icons-v4",
  "Navigatie-iconen controleren",
  "Bekijk alle zeven menu-iconen bij 100%, 125%, 150% en 200% browserzoom.",
  "Scherpe vectoriconen; de actieve knop verspringt niet.",
  "none"
 ],
 [
  "source-v4",
  "Bronlid zoeken",
  "Klik op Open dit onderdeel voor Schema builder. Heeft Noor nog geen schema? Voeg eerst een oefening toe, zoek Noor bij het doellid en bevestig bewust de koppeling. Ga terug naar Schema builder, klik Schema van ander lid kopiëren en zoek Noor. Er wordt niets automatisch klaargezet.",
  "Je kiest bewust het bronlid met naam en lidnummer.",
  "builder"
 ],
 [
  "version-v4",
  "Schema en versie bekijken",
  "Kies een bestaande vastgelegde schemaversie en bekijk alle trainingsdagen en oefeningen.",
  "Geen verzonnen oudere versies; de gekozen inhoud staat volledig in het voorbeeld.",
  "none"
 ],
 [
  "copy-v4",
  "Naar ander fictief lid kopiëren",
  "Zoek Sam als doel. Controleer beide identiteiten en bevestig het onafhankelijke concept.",
  "Bron en doel verschillen; er is nog geen definitief schema toegevoegd.",
  "none"
 ],
 [
  "private-v4",
  "Controleren wat niet is gekopieerd",
  "Controleer het concept op lege doelgewichten en afwezigheid van resultaten, privénotities en gezondheidsinformatie.",
  "Alleen schema-inhoud en de bestaande oefenmedia zijn meegenomen.",
  "none"
 ],
 [
  "save-copy-v4",
  "Kopie aanpassen en bewust opslaan",
  "Pas het concept aan en gebruik de definitieve opslagactie voor het gecontroleerde doellid.",
  "De bevestigde kopie heeft een eigen identiteit. Herhalen maakt geen duplicaat.",
  "none"
 ],
 [
  "source-unchanged-v4",
  "Bron en kopiehistorie controleren",
  "Bekijk de kopiehistorie en open daarna het bronlid opnieuw.",
  "De broninhoud is ongewijzigd; wie, bronversie, doel en nieuwe identiteit zijn vastgelegd.",
  "none"
 ],
 [
  "agreement-v4",
  "Oefenovereenkomst klaarzetten",
  "Ontbreekt er nog een oefenovereenkomst? Schrijf dan via Nieuw lid inschrijven een fictief individueel of duo-lid in, teken en rond af. Gebruik geen echte gegevens.",
  "De bestaande inschrijfroute, camera en oefenmedia blijven beschikbaar. De PDF is duidelijk niet geldig.",
  "signup"
 ],
 [
  "document-open-v4",
  "Overeenkomst onder Documenten openen",
  "Open Documenten van het fictieve lid en kies Openen. Probeer ook Nieuw tabblad.",
  "De echte opgeslagen PDF verschijnt. Bij pop-upblokkering is opnieuw openen mogelijk.",
  "none"
 ],
 [
  "document-download-v4",
  "Dezelfde PDF downloaden",
  "Kies Downloaden, herlaad en download dezelfde overeenkomst nogmaals.",
  "Naam en datum staan in de bestandsnaam; de app controleert bytes en opslaghash vóór downloaden. Er komt geen tweede document.",
  "none"
 ],
 [
  "prepare-v4",
  "Herinnering zeven dagen vooraf controleren",
  "Open Agenda en kies Lijst. Open Over één week facturen maken.",
  "Periode, factuurdatum, deelnemers, pakket en verwacht bedrag zijn zichtbaar.",
  "agenda"
 ],
 [
  "due-v4",
  "Herinnering op de factuurdatum controleren",
  "Open Vandaag facturen maken en versturen voor dezelfde periode.",
  "Dit herinneringsmoment heeft een eigen status. Er is een link naar de bestaande Facturen-pagina.",
  "none"
 ],
 [
  "future-v4",
  "Drie toekomstige perioden controleren",
  "Gebruik Lijst en blader vooruit. Vergelijk drie factuurdatums; probeer ook dag, week en maand.",
  "Vier weken blijft steeds 28 dagen; kalendermaandklanten behouden hun cyclus.",
  "none"
 ],
 [
  "no-finance-v4",
  "Bevestigen dat niets automatisch is geboekt",
  "Rond alleen de voorbereidingsherinnering af en ververs. Bekijk de facturen en betalingen.",
  "De factuurdag blijft zelfstandig open. Geen factuur, concept, e-mail of betaling is automatisch gemaakt.",
  "none"
 ],
 [
  "inactive-v4",
  "Fictief lid inactief maken",
  "Open het gewenste fictieve profiel. Kies Lid inactief maken, datum en reden. Kies afzonderlijk wat moet pauzeren en controleer het effect.",
  "Pas na jouw bevestiging ontstaat een statuswijziging; documenten en financiële historie blijven behouden.",
  "none"
 ],
 [
  "filter-v4",
  "Inactief lid zoeken",
  "Gebruik Leden → Inactief en probeer ook de algemene zoekbalk.",
  "Het lid blijft vindbaar met de juiste status. Een toekomstige ingangsdatum gaat pas op die datum in.",
  "clients"
 ],
 [
  "history-v4",
  "Documenten en historie behouden",
  "Open opnieuw het inactieve lid. Controleer Documenten, Training, Financiën en Statushistorie.",
  "De overeenkomst, opgeslagen PDF, trainingshistorie en openstaande facturen blijven bestaan.",
  "none"
 ],
 [
  "reactivate-v4",
  "Lid opnieuw activeren",
  "Kies Lid opnieuw actief maken en een effectieve startdatum.",
  "De app toont vooraf welke onderdelen je bewust kunt hervatten.",
  "none"
 ],
 [
  "resume-v4",
  "Bewust kiezen wat hervat",
  "Bevestig coaching, betaalafspraak en toekomstige herinneringen afzonderlijk. Controleer daarna Agenda.",
  "Geen gemiste facturen worden gemaakt. Alleen bewust hervatte toekomstige herinneringen verschijnen.",
  "none"
 ],
 [
  "manifest-v4",
  "Volledige verwijderlijst controleren",
  "Open de verwijderlijst en controleer leden, documenten, foto’s, schemakopieën, statusgebeurtenissen, herinneringen en testbestanden.",
  "De lijst hoort uitsluitend bij deze synthetische testrun.",
  "reset"
 ],
 [
  "cleanup-v4",
  "Alleen synthetische testgegevens verwijderen",
  "Vink de gecontroleerde verwijderlijst aan en bevestig het verwijderen van deze testrun.",
  "De opruimcontrole bevestigt de verwijdering. Echte APPFMZ-gegevens blijven buiten bereik.",
  "reset"
 ]
];
 const button=(text,action,extra='')=>`<button type="button" data-ot-action="${action}" ${extra}>${text}</button>`;
 function start(adapter){
  active?.stop();if(!adapter?.getState||!adapter?.setGuide||!adapter?.inventory||!adapter?.simulate||!adapter?.reminderPeriods)throw Error('De geïsoleerde owner-test is niet beschikbaar.');
  let state=null,busy=false,alive=true,panelOpen=window.matchMedia('(min-width: 901px)').matches,dialog=null,pending=null,manifest=null,unsubscribe=null;
  const mounts=new Set();
  const banner=document.createElement('section');banner.className='fmz-test-banner';banner.setAttribute('aria-label','Geïsoleerde owner-test');
  banner.innerHTML='<strong>TESTMODUS</strong><span>Uitsluitend lokale testgegevens — geen echte factuurautomatisering, e-mail of push.</span>'+button('Testbegeleider','toggle')+button('Sluiten','exit');
  const panel=document.createElement('aside');panel.className='fmz-test-guide';panel.id='fmz-owner-test-guide';panel.setAttribute('aria-label','Laptoptest in drieëntwintig stappen');document.body.append(banner,panel);document.body.classList.add('fmz-owner-test-active');
  const guide=()=>state?.guide?.routeVersion===4?{step:0,done:[],skipped:[],...state.guide}:{version:1,routeVersion:4,step:0,done:[],skipped:[]};
  const status=text=>{const node=panel.querySelector('[data-ot-status]');if(node)node.textContent=text;};
  async function refresh(){if(!alive)return;state=await adapter.getState();if(!alive)return;render();refreshMounts();}
  async function save(patch){state=await adapter.getState();const previous=state.guide||{},g=guide();const next={...previous,...g,...patch,version:1,routeVersion:4,updatedAt:new Date().toISOString()};if(previous.routeVersion!==4)next.previousRouteProgress={step:previous.step,done:previous.done,skipped:previous.skipped};await (adapter.patchGuide?adapter.patchGuide({version:1,routeVersion:next.routeVersion,step:next.step,done:next.done,skipped:next.skipped,updatedAt:next.updatedAt,...(next.previousRouteProgress?{previousRouteProgress:next.previousRouteProgress}:{})}):adapter.setGuide(next));state=await adapter.getState();render();}
  function currentHTML(mini=false){const g=guide(),step=Math.max(0,Math.min(steps.length-1,Number(g.step)||0)),[id,title,doing,result,route]=steps[step];return `<p class="fmz-test-step">${mini?'TESTMODUS · ':''}Stap ${step+1} van ${steps.length} · ${g.done.length} zelf gecontroleerd</p><h${mini?'3':'2'}>${esc(title)}</h${mini?'3':'2'}><p>${esc(doing)}</p><p><strong>Controle:</strong> ${esc(result)}</p><div class="fmz-test-actions">${route!=='none'?button('Open dit onderdeel','route'):''}${button('Vorige','previous',step===0?'disabled':'')}${button('Volgende','next',step===steps.length-1?'disabled':'')}${button(g.done.includes(id)?'Controle opnieuw doen':'Dit heb ik gecontroleerd','done')}${button('Stap overslaan','skip')}</div>`;}
  function render(){if(!alive)return;const expanded=panel.querySelector('details')?.open,g=guide();panel.hidden=!panelOpen;document.body.classList.toggle('fmz-test-guide-open',panelOpen);const toggle=banner.querySelector('[data-ot-action=toggle]');toggle.setAttribute('aria-expanded',String(panelOpen));toggle.setAttribute('aria-controls',panel.id);panel.innerHTML=`<header><strong>Laptoptest — vernieuwde route</strong>${button('Inklappen','toggle')}</header>${currentHTML()}<details><summary>Alle 23 stappen</summary><ol>${steps.map(([id,title],i)=>`<li><button type="button" data-ot-action="step" data-ot-step="${i}" ${Number(g.step)===i?'aria-current="step"':''}>${esc(title)} <span>${g.done.includes(id)?'✓':g.skipped.includes(id)?'overgeslagen':''}</span></button></li>`).join('')}</ol></details><div class="fmz-test-actions">${button('Factuurherinneringen testen','reminders')}${button('Testgegevens verwijderen en opnieuw beginnen','reset')}</div><p data-ot-status role="status">${busy?'Bezig…':'Voortgang wordt uitsluitend bij deze testrun bewaard.'}</p><p class="fmz-test-small">Zelf afvinken is geen technische PASS of toestemming om nieuwe productieroutes te openen.</p>`;if(expanded)panel.querySelector('details').open=true;syncMini();}
  function syncMini(){if(!alive)return;const g=guide(),key=JSON.stringify([g.step,g.done,g.skipped]);for(const d of document.querySelectorAll('dialog[open]:not([data-owner-test-dialog])')){let mini=d.querySelector('[data-owner-test-mini]');if(!mini){mini=document.createElement('details');mini.dataset.ownerTestMini='';mini.className='fmz-test-mini';d.prepend(mini);}if(mini.dataset.key!==key){const wasOpen=mini.open;mini.dataset.key=key;mini.innerHTML='<summary>TESTMODUS — laptopstappen bekijken</summary>'+currentHTML(true);mini.open=wasOpen;}}}
  let observedProfile=null;function collapseForProfile(){if(panelOpen){panelOpen=false;render();}}
  const observer=new MutationObserver(()=>{syncMini();const current=document.querySelector('.members-profile-page');if(current!==observedProfile){observedProfile=current;if(current)collapseForProfile();}});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  function openDialog(title,html){dialog?.close();dialog?.remove();dialog=document.createElement('dialog');dialog.dataset.ownerTestDialog='';dialog.className='fmz-test-dialog';dialog.setAttribute('aria-labelledby','fmz-test-dialog-title');dialog.innerHTML=`<header><h2 id="fmz-test-dialog-title">${esc(title)}</h2>${button('Sluiten','close-dialog')}</header><p class="fmz-test-warning">TESTMODUS — geen echte mail, push of productiemutatie.</p>${html}${retryHTML()}<p data-ot-dialog-status role="status"></p>`;dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});document.body.append(dialog);dialog.showModal();return dialog;}
  const retryHTML=()=>pending?'<p class="fmz-test-warning">De opslagbevestiging ontbreekt. Herhaal hetzelfde verzoek; er wordt geen tweede herinnering gemaakt.</p>'+button('Onbevestigde handeling opnieuw proberen','retry-pending'):'';
  const dialogStatus=text=>{const node=dialog?.querySelector('[data-ot-dialog-status]');if(node)node.textContent=text;};
  async function route(){const target=steps[guide().step]?.[4];if(target==='reminders')return reminderDialog();if(target==='reset')return resetDialog();const other=[...document.querySelectorAll('dialog[open]')].find(d=>!d.hasAttribute('data-owner-test-dialog'));if(other){const mini=other.querySelector('[data-owner-test-mini]');if(mini)mini.open=true;status('Rond het huidige venster af of sluit het veilig voordat je een ander onderdeel opent.');return;}
   if(['settings','agenda','clients'].includes(target)){window.showView?.(target);}
   else if(target==='search'){document.getElementById('globalSearch')?.focus();}
   else if(target==='signup')await window.FMZMembers?.openEnrollment();
   else if(target==='drafts')await window.FMZMembers?.openDrafts();
   else if(target==='builder')window.showView?.('schema-builder');
   else if(target==='profile'){const inv=await adapter.inventory(),members=inv.members||[];if(!members.length)throw Error('Schrijf eerst een fictief lid in.');const m=members.find(m=>/Mila Laptoptest/i.test(m.label||m.name||''))||members.find(m=>/Noor/i.test(m.label||m.name||''))||members[0];await window.FMZMembers?.openProfile(m.client_id||m.clientId||m.id);}
  }
  const currentReminders=()=> (state?.simulation?.reminders||[]).filter(r=>r.reminderVersion===2&&r.runId===state.runId).sort((a,b)=>a.date.localeCompare(b.date)||a.clientName.localeCompare(b.clientName));
  const reminderTitle=r=>r.kind==='billing_prepare'?'Over één week facturen maken':'Vandaag facturen maken en versturen';
  function reminderHTML(items){return items.length?items.map(r=>`<article class="fmz-test-history" data-ot-reminder="${esc(r.id)}"><strong>${esc(reminderTitle(r))}</strong><p>${esc(r.clientName)} · ${r.cycle==='calendar_month'?'Kalendermaand':'Vier weken'}</p><p>Periode ${esc(r.period)}<br>Herinnering: ${esc(r.date)} om ${esc(r.time)} · Europe/Amsterdam<br>Factuurdatum volgens betaalafspraak: ${esc(r.invoiceDate)}</p><p>${r.status==='done'?'✓ Voltooid':'Openstaande herinnering'} · Alleen lokaal gesimuleerd</p><div class="fmz-test-actions">${button('Herinnering openen','reminder-open',`data-ot-id="${esc(r.id)}"`)}${button('Open Facturen','open-invoices')}${r.status==='done'?'':button('Als voltooid markeren','reminder-complete',`data-ot-id="${esc(r.id)}"`)}</div></article>`).join(''):'<p>Nog geen herinneringen in deze test. Kies Factuurherinneringen testen om beide momenten uit een vastgelegde betaalafspraak te controleren.</p>';}
  function refreshMounts(){for(const el of mounts){if(!el.isConnected){mounts.delete(el);continue;}el.innerHTML='<h2>Factuurherinneringen</h2><p>TESTMODUS — handmatig facturen maken. Deze herinneringen veranderen de administratie niet.</p>'+reminderHTML(currentReminders())+button('Factuurherinneringen testen','reminders');}}
  async function mountReminders(element,options={}){if(window.FMZOwnerReminderCalendar)return window.FMZOwnerReminderCalendar.mount(element,options,adapter);if(!element||!alive)return;element.dataset.ownerTestReminderSurface=options.surface||'notifications';element.classList.add('fmz-test-reminder-surface');mounts.add(element);state=await adapter.getState();if(alive)refreshMounts();}
  async function reminderDetails(id){
   state=await adapter.getState();const reminder=currentReminders().find(r=>r.id===id);if(!reminder)throw Error('Deze herinnering bestaat niet meer.');
   const periods=await adapter.reminderPeriods(reminder.start),related=periods.filter(p=>p.cycle===reminder.cycle&&p.start===reminder.start&&p.end===reminder.end&&p.invoiceDate===reminder.invoiceDate);const members=[...new Map(related.map(p=>[p.clientId,p])).values()];
   openDialog(reminderTitle(reminder),'<p><strong>Periode '+esc(reminder.period)+'</strong> · '+(reminder.cycle==='calendar_month'?'Kalendermaand':'Vier weken')+'</p><p>Herinnering: '+esc(reminder.date)+' om 09:00 · Europe/Amsterdam. Handmatige factuurdatum: '+esc(reminder.invoiceDate)+'.</p><h3>Betreffende leden</h3><ul class="fmz-test-reminder-members" data-ot-reminder-members>'+members.map(m=>'<li data-ot-reminder-client="'+esc(m.clientId)+'"><strong>'+esc(m.clientName)+'</strong> · '+esc(m.packageLabel)+'</li>').join('')+'</ul>'+(members.length?'':'<p>Er is voor deze periode geen actieve betaalafspraak meer gevonden. Controleer de afspraak voordat je handmatig een factuur maakt.</p>')+'<p>Maak en verstuur facturen zelf via de bestaande Facturen-pagina. Deze herinnering maakt geen factuur, e-mailconcept of financiële boeking.</p><div class="fmz-test-actions">'+button('Naar Facturen','open-invoices')+(reminder.status==='done'?'<p>✓ Voltooid</p>':button('Als voltooid markeren','reminder-complete','data-ot-id="'+esc(reminder.id)+'"'))+'</div>');dialog.dataset.reminderId=id;
  }
  async function reminderDialog(){if(window.FMZOwnerReminderCalendar)return window.FMZOwnerReminderCalendar.open(adapter);const periods=await adapter.reminderPeriods();state=await adapter.getState();openDialog('Factuurherinneringen testen',`<p>Datums komen uit de vastgelegde betaalafspraak en bestaande perioderegel. Er wordt geen factuurconcept of e-mail gemaakt. De test simuleert de twee momenten; er gaat geen push naar een apparaat.</p><label>Actieve betaalperiode<select data-ot-period><option value="">Kies een periode</option>${periods.map((p,i)=>`<option value="${i}">${esc(p.clientName)} · ${p.cycle==='calendar_month'?'kalendermaand':'vier weken'} · ${esc(p.start)} t/m ${esc(p.end)} · factuurdatum ${esc(p.invoiceDate)}</option>`).join('')}</select></label><div class="fmz-test-actions">${button('Zeven dagen vooraf simuleren','reminder-7')}${button('Factuurdatum simuleren','reminder-today')}</div><div data-ot-reminder-list>${reminderHTML(currentReminders())}</div>${periods.length?'':'<p>Voltooi eerst een synthetische inschrijving met een actieve betaalafspraak.</p>'}`);dialog._periods=periods;}
  async function simulate(action,source){let payload;if(action==='reminder-complete')payload={id:source.dataset.otId};else{const value=dialog.querySelector('[data-ot-period]').value,p=value===''?null:dialog._periods?.[Number(value)];if(!p)throw Error('Kies eerst een actieve betaalperiode.');payload={agreementId:p.agreementId,periodStart:p.start};}
   const body=JSON.stringify({action,payload});if(pending&&pending.body!==body)throw Error('Probeer eerst dezelfde onbevestigde handeling opnieuw.');pending??={body,action,payload,id:crypto.randomUUID()};await adapter.simulate(action,payload,pending.id);pending=null;await refresh();if(dialog?.dataset.reminderId)await reminderDetails(dialog.dataset.reminderId);if(dialog?.querySelector('[data-ot-reminder-list]'))dialog.querySelector('[data-ot-reminder-list]').innerHTML=reminderHTML(currentReminders());dialogStatus('Lokaal bevestigd. Er is geen factuur, boeking, mail of push gemaakt.');}
  function inventoryHTML(inv){const groups=[['members','Testleden'],['memberStatusEvents','Ledenstatushistorie'],['statusReceipts','Bevestigde statusverzoeken'],['calendarCompletions','Afgeronde agenda-herinneringen'],['calendarViews','Agendaweergaven'],['drafts','Inschrijfconcepten'],['schemaDrafts','Schema’s en koppelingen in deze testbrowser'],['contracts','Testovereenkomsten'],['documents','Testdocumenten'],['communicationDocuments','Bijlagekoppelingen'],['invoices','Testfacturen en concepten'],['messages','Definitieve testmailconcepten'],['preliminary','Voorlopige testmailconcepten'],['files','Factuur-PDF-registraties'],['simulationRecords','Gesimuleerde verzendingen en historie'],['reminders','Testmeldingen'],['blobs','Lokale testbestanden'],['sessions','Synthetische sessies']];return groups.map(([key,label])=>{const rows=inv[key]||[];return `<details ${rows.length?'open':''}><summary>${label}: ${rows.length}</summary>${rows.length?'<ul>'+rows.map(r=>`<li>${esc(r.label||r.name||r.number||r.subject||r.path||r.id)} <small>${esc(r.id||r.path||'')}</small></li>`).join('')+'</ul>':'<p>Geen.</p>'}</details>`;}).join('');}
  async function resetDialog(){manifest=await (adapter.manifest?adapter.manifest():adapter.inventory());openDialog('Deze testgegevens verwijderen?',`<p>Alleen testrun <strong>${esc(manifest.runId)}</strong> wordt verwijderd. Echte administratie kan deze geïsoleerde opruimactie niet bereiken. Niet-bewaarde invoer in een open testvenster gaat ook verloren.</p>${inventoryHTML(manifest)}<label class="fmz-test-check"><input type="checkbox" data-ot-reset-confirm>Ik heb deze exacte lijst gecontroleerd en wil uitsluitend deze testrun opnieuw beginnen.</label>${button('Deze testgegevens verwijderen','confirm-reset')}`);}
  async function reset(){if(!dialog.querySelector('[data-ot-reset-confirm]').checked)throw Error('Controleer eerst de volledige verwijderlijst.');const result=await adapter.reset(manifest);pending=null;state={...state,guide:{version:1,step:0,done:[],skipped:[]},simulation:{sent:[],history:[],reminders:[]}};window.FMZMembers?.lock();window.FMZCommunicationsUI?.lock();render();openDialog('Opruimcontrole',`<p>De lokale adapter heeft de verwijderopdracht bevestigd. Controleer hieronder het resultaat voor de oude testrun.</p><pre>${esc(JSON.stringify(result,null,2))}</pre><p>Open daarna de nieuwe testrun zodat alle schermen opnieuw uit de geïsoleerde database worden geladen.</p>${button('Nieuwe testrun openen','reload')}`);}


  async function click(event){const b=event.target.closest('[data-ot-action]');if(!b||!alive||(!panel.contains(b)&&!banner.contains(b)&&!b.closest('[data-owner-test-dialog],[data-owner-test-mini],[data-owner-test-reminder-surface]')))return;event.preventDefault();event.stopPropagation();const action=b.dataset.otAction;if(busy)return;
   if(action==='toggle'){panelOpen=!panelOpen;render();return;}if(action==='close-dialog'){dialog?.close();dialog?.remove();dialog=null;return;}if(action==='reload'){window.OwnerTestHost?.restart();return;}if(action==='exit'){window.OwnerTestHost?.close();return;}
   if(action==='open-invoices'){dialog?.close();dialog?.remove();dialog=null;window.showView?.('invoice');return;}
   busy=true;b.disabled=true;try{const g=guide(),id=steps[g.step]?.[0];if(action==='previous'||action==='next')await save({step:Math.max(0,Math.min(steps.length-1,g.step+(action==='next'?1:-1)))});else if(action==='step')await save({step:Number(b.dataset.otStep)});else if(action==='done')await save({done:g.done.includes(id)?g.done.filter(x=>x!==id):[...g.done,id],skipped:g.skipped.filter(x=>x!==id)});else if(action==='skip')await save({step:Math.min(steps.length-1,g.step+1),skipped:[...new Set([...g.skipped,id])]});else if(action==='route')await route();else if(action==='reminders')await reminderDialog();else if(action==='reminder-open')await reminderDetails(b.dataset.otId);else if(action==='reset')await resetDialog();else if(action==='confirm-reset')await reset();else if(action==='retry-pending'){if(!pending)throw Error('Er is geen onbevestigde handeling.');const p=pending;await adapter.simulate(p.action,p.payload,p.id);pending=null;await refresh();await reminderDialog();dialogStatus('Dezelfde handeling is bevestigd en bewaard.');}else if(['reminder-7','reminder-today','reminder-complete'].includes(action))await simulate(action,b);}
   catch(error){const text='Niet bevestigd — '+(error.message||'probeer dezelfde handeling opnieuw.');status(text);dialogStatus(text);if(pending&&dialog&&!dialog.querySelector('[data-ot-action=retry-pending]'))dialog.querySelector('[data-ot-dialog-status]').insertAdjacentHTML('beforebegin',retryHTML());if(error.code&&/^(PT409|22|23|42|P0001)/.test(error.code))pending=null;}
   finally{busy=false;if(b.isConnected)b.disabled=false;if(panel.querySelector('[data-ot-status]')?.textContent==='Bezig…')status('Voortgang wordt uitsluitend bij deze testrun bewaard.');syncMini();}
  }
  document.addEventListener('click',click);unsubscribe=adapter.onChange?.(()=>{if(!busy)refresh().catch(e=>status(e.message));});refresh().catch(e=>status(e.message));
  const instance={refresh,mountReminders,collapseForProfile,stop(){alive=false;observer.disconnect();unsubscribe?.();document.removeEventListener('click',click);document.querySelectorAll('[data-owner-test-mini]').forEach(n=>n.remove());mounts.clear();banner.remove();panel.remove();dialog?.close();dialog?.remove();document.body.classList.remove('fmz-owner-test-active','fmz-test-guide-open');}};active=instance;
  for(const [id,surface] of [['ot-dashboard-reminders','notifications'],['ot-agenda-reminders','agenda']]){const el=document.getElementById(id);if(el)mountReminders(el,{surface}).catch(e=>status(e.message));}
  return instance;
 }
 return{start,collapseForProfile:()=>active?.collapseForProfile(),mountReminders:(element,options)=>active?.mountReminders(element,options)};
})();




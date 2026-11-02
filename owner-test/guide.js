/* Owner-only synthetic laptop feedback route. No invoice/mail automation. */
window.FMZOwnerGuide=(()=>{
 'use strict';let active=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const steps=[
 [
  "testmode-v3",
  "TESTMODUS controleren",
  "Controleer de vaste testbalk. Gebruik alleen fictieve leden en gegevens.",
  "Je werkt uitsluitend in deze lokale owner-test.",
  "none"
 ],
 [
  "navigation-v3",
  "Verticale navigatie controleren",
  "Bekijk links Dashboard, Agenda, Schema builder, Leden, Administratie, Facturen en Instellingen.",
  "De zijbalk staat verticaal; de actieve keuze is goudgeel.",
  "none"
 ],
 [
  "search-v3",
  "Zoekbalk bovenin gebruiken",
  "Zoek Noor met de vaste zoekbalk. Probeer ook e-mail, telefoonnummer en lidnummer.",
  "De zoekbalk is vanuit ieder hoofdonderdeel bereikbaar.",
  "search"
 ],
 [
  "profile-v3",
  "Fictief lid in volledig scherm openen",
  "Open Noor vanuit het zoekresultaat.",
  "Het profiel gebruikt de beschikbare pagina; deze gids klapt automatisch in.",
  "profile"
 ],
 [
  "tabs-v3",
  "Alle profieltabbladen controleren",
  "Controleer Overzicht, Coaching, Training, Voeding, Trackers, Agenda, Financiën, Documenten, Notities en Historie.",
  "Alle tabs zijn leesbaar. Bij meer zoom mogen ze over nette regels lopen.",
  "none"
 ],
 [
  "documents-v3",
  "Documenten controleren",
  "Open Documenten. Bekijk type, datum, status, versie en de acties Bekijken en Downloaden.",
  "Je ziet alleen documenten van het geopende fictieve lid; een lege lijst wordt eerlijk getoond.",
  "none"
 ],
 [
  "sections-v3",
  "Coaching, Training, Voeding en Trackers openen",
  "Open achtereenvolgens deze vier tabs.",
  "De gegevens blijven bij hetzelfde geopende lid.",
  "none"
 ],
 [
  "animations-v3",
  "Oefeninganimaties controleren",
  "Bekijk bij een bestaande oefening de bijbehorende animatie.",
  "De bestaande media laden en blijven volledig binnen het oefenvak.",
  "none"
 ],
 [
  "enroll-v3",
  "Nieuwe inschrijving starten",
  "Open Leden en kies Nieuw lid inschrijven.",
  "De begeleide inschrijving opent zonder een definitief lid aan te maken.",
  "signup"
 ],
 [
  "individual-v3",
  "Individuele PT-pakketten controleren",
  "Bekijk de rustige kaarten voor Basis, Progressie en Transformatie.",
  "Bedrag per vier weken, trainingen en prijs per training kloppen met de catalogus.",
  "none"
 ],
 [
  "duo-v3",
  "Duo-pakketten controleren",
  "Bekijk de groep Duo personal training. Controleer bedrag per duo en per persoon. Kies voor deze eerste ronde Progressie individueel; test daarna desgewenst apart een duo met twee fictieve personen.",
  "Bij duo zijn hoofdcontractlid, tweede deelnemer en gezamenlijke trainingen duidelijk.",
  "none"
 ],
 [
  "person-v3",
  "Persoonsgegevens, adres en doelen invullen",
  "Gebruik Mila Laptoptest, mila@example.test, 0612345678, 1990-01-01 en vandaag als startdatum. Adres: Voorbeeldstraat 8, 1234 AB Teststad, Nederland. Gebruik fictieve doelen en geen echte medische gegevens.",
  "Velden staan verticaal en vrijwillige gezondheidsinformatie heeft aparte toestemming.",
  "none"
 ],
 [
  "resume-v3",
  "Concept bewaren, verversen en hervatten",
  "Bewaar het concept, sluit de inschrijving en ververs de test. Open Inschrijfconcepten.",
  "Hetzelfde concept en je bevestigde invoer zijn behouden.",
  "drafts"
 ],
 [
  "cost-v3",
  "Kostenoverzicht controleren",
  "Controleer pakket, bedrag, trainingen, startdatum, eerste periode en verwachte handmatige factuurdatum.",
  "Geen korting, toeslag, automatische factuur, incasso of e-mail.",
  "none"
 ],
 [
  "sign-v3",
  "Handtekening tekenen, wissen en opnieuw tekenen",
  "Lees de conceptvoorwaarden. Teken, wis en teken opnieuw. Controleer dat een leeg vak niet kan worden bevestigd.",
  "De gekozen gegevens en de handtekening verschijnen in de testovereenkomst.",
  "none"
 ],
 [
  "pdf-v3",
  "PDF openen en downloaden",
  "Controleer het PDF-voorbeeld, voltooi één testinschrijving en probeer Bekijken en Downloaden.",
  "Een leesbare PDF met OEFENOVEREENKOMST – NIET GELDIG. Een downloadfout maakt geen tweede inschrijving.",
  "none"
 ],
 [
  "document-return-v3",
  "Overeenkomst onder Documenten terugvinden",
  "Open het ingeschreven fictieve lid en kies Documenten. Ververs en controleer opnieuw.",
  "Dezelfde overeenkomst blijft bij het juiste lid beschikbaar.",
  "profile"
 ],
 [
  "camera-v3",
  "Laptopcamera openen en foto gebruiken",
  "Klik Foto maken. Schakel bewust de camera in, neem een foto van een voorwerp en probeer Opnieuw maken en Foto gebruiken.",
  "Alleen je gekozen foto wordt lokaal bewaard. Sluiten of afronden stopt de camera.",
  "profile"
 ],
 [
  "schema-v3",
  "Schema aan het juiste fictieve lid koppelen",
  "Open Schema builder. Maak een schema, zoek bewust het lid en controleer foto, naam en lidnummer vóór bevestigen.",
  "Het schema wordt uitsluitend aan het gekozen lid gekoppeld.",
  "builder"
 ],
 [
  "training-v3",
  "Schema en animaties onder Training controleren",
  "Open het fictieve lid en kies Training. Controleer het gekoppelde schema en de oefenanimaties.",
  "Geen dubbel schema; de media passen ook bij meer zoom binnen hun oefenvak.",
  "profile"
 ],
 [
  "prepare-v3",
  "Herinnering één week vooraf controleren",
  "Kies een vastgelegde betaalperiode en simuleer zeven dagen vooraf. Open de herinnering en bekijk periode en betreffende leden.",
  "Over één week facturen maken; de knop opent de bestaande Facturen-pagina.",
  "reminders"
 ],
 [
  "due-v3",
  "Herinnering op de factuurdatum controleren",
  "Simuleer de factuurdatum. Bekijk de melding onder Agenda en Dashboard, markeer voltooid en ververs.",
  "Vandaag facturen maken en versturen. Voltooid blijft bewaard, zonder dubbele herinnering.",
  "reminders"
 ],
 [
  "manual-v3",
  "Geen automatische factuur of mail bevestigen",
  "Controleer dat de herinneringen alleen taken tonen. Open desgewenst de bestaande Facturen-pagina om dit te vergelijken.",
  "Er is door inschrijven of herinneren geen factuur, e-mailconcept, verzending of financiële boeking gemaakt.",
  "none"
 ],
 [
  "cleanup-list-v3",
  "Verwijderlijst controleren",
  "Bekijk de exacte lijst met testleden, concepten, overeenkomsten, foto’s, schema’s en herinneringen. Bevestig nog niet totdat je de lijst hebt gecontroleerd.",
  "De lijst hoort uitsluitend bij de huidige synthetische testrun.",
  "reset"
 ],
 [
  "cleanup-v3",
  "Uitsluitend de testgegevens verwijderen",
  "Bevestig de gecontroleerde verwijderlijst. Controleer de opruimbevestiging en open eventueel een nieuwe lege testrun.",
  "Alleen de testbrowsergegevens zijn verwijderd. De echte app blijft ongewijzigd.",
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
  const panel=document.createElement('aside');panel.className='fmz-test-guide';panel.id='fmz-owner-test-guide';panel.setAttribute('aria-label','Laptoptest in vijfentwintig stappen');document.body.append(banner,panel);document.body.classList.add('fmz-owner-test-active');
  const guide=()=>state?.guide?.routeVersion===3?{step:0,done:[],skipped:[],...state.guide}:{version:1,routeVersion:3,step:0,done:[],skipped:[]};
  const status=text=>{const node=panel.querySelector('[data-ot-status]');if(node)node.textContent=text;};
  async function refresh(){if(!alive)return;state=await adapter.getState();if(!alive)return;render();refreshMounts();}
  async function save(patch){state=await adapter.getState();const previous=state.guide||{},g=guide();const next={...previous,...g,...patch,version:1,routeVersion:3,updatedAt:new Date().toISOString()};if(previous.routeVersion!==3)next.previousRouteProgress={step:previous.step,done:previous.done,skipped:previous.skipped};await adapter.setGuide(next);state=await adapter.getState();render();}
  function currentHTML(mini=false){const g=guide(),step=Math.max(0,Math.min(steps.length-1,Number(g.step)||0)),[id,title,doing,result,route]=steps[step];return `<p class="fmz-test-step">${mini?'TESTMODUS · ':''}Stap ${step+1} van ${steps.length} · ${g.done.length} zelf gecontroleerd</p><h${mini?'3':'2'}>${esc(title)}</h${mini?'3':'2'}><p>${esc(doing)}</p><p><strong>Controle:</strong> ${esc(result)}</p><div class="fmz-test-actions">${route!=='none'?button('Open dit onderdeel','route'):''}${button('Vorige','previous',step===0?'disabled':'')}${button('Volgende','next',step===steps.length-1?'disabled':'')}${button(g.done.includes(id)?'Controle opnieuw doen':'Dit heb ik gecontroleerd','done')}${button('Stap overslaan','skip')}</div>`;}
  function render(){if(!alive)return;const expanded=panel.querySelector('details')?.open,g=guide();panel.hidden=!panelOpen;document.body.classList.toggle('fmz-test-guide-open',panelOpen);const toggle=banner.querySelector('[data-ot-action=toggle]');toggle.setAttribute('aria-expanded',String(panelOpen));toggle.setAttribute('aria-controls',panel.id);panel.innerHTML=`<header><strong>Laptoptest — vernieuwde route</strong>${button('Inklappen','toggle')}</header>${currentHTML()}<details><summary>Alle 25 stappen</summary><ol>${steps.map(([id,title],i)=>`<li><button type="button" data-ot-action="step" data-ot-step="${i}" ${Number(g.step)===i?'aria-current="step"':''}>${esc(title)} <span>${g.done.includes(id)?'✓':g.skipped.includes(id)?'overgeslagen':''}</span></button></li>`).join('')}</ol></details><div class="fmz-test-actions">${button('Factuurherinneringen testen','reminders')}${button('Testgegevens verwijderen en opnieuw beginnen','reset')}</div><p data-ot-status role="status">${busy?'Bezig…':'Voortgang wordt uitsluitend bij deze testrun bewaard.'}</p><p class="fmz-test-small">Zelf afvinken is geen technische PASS of toestemming om nieuwe productieroutes te openen.</p>`;if(expanded)panel.querySelector('details').open=true;syncMini();}
  function syncMini(){if(!alive)return;const g=guide(),key=JSON.stringify([g.step,g.done,g.skipped]);for(const d of document.querySelectorAll('dialog[open]:not([data-owner-test-dialog])')){let mini=d.querySelector('[data-owner-test-mini]');if(!mini){mini=document.createElement('details');mini.dataset.ownerTestMini='';mini.className='fmz-test-mini';d.prepend(mini);}if(mini.dataset.key!==key){const wasOpen=mini.open;mini.dataset.key=key;mini.innerHTML='<summary>TESTMODUS — laptopstappen bekijken</summary>'+currentHTML(true);mini.open=wasOpen;}}}
  let observedProfile=null;function collapseForProfile(){if(panelOpen){panelOpen=false;render();}}
  const observer=new MutationObserver(()=>{syncMini();const current=document.querySelector('.members-profile-page');if(current!==observedProfile){observedProfile=current;if(current)collapseForProfile();}});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  function openDialog(title,html){dialog?.close();dialog?.remove();dialog=document.createElement('dialog');dialog.dataset.ownerTestDialog='';dialog.className='fmz-test-dialog';dialog.setAttribute('aria-labelledby','fmz-test-dialog-title');dialog.innerHTML=`<header><h2 id="fmz-test-dialog-title">${esc(title)}</h2>${button('Sluiten','close-dialog')}</header><p class="fmz-test-warning">TESTMODUS — geen echte mail, push of productiemutatie.</p>${html}${retryHTML()}<p data-ot-dialog-status role="status"></p>`;dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});document.body.append(dialog);dialog.showModal();return dialog;}
  const retryHTML=()=>pending?'<p class="fmz-test-warning">De opslagbevestiging ontbreekt. Herhaal hetzelfde verzoek; er wordt geen tweede herinnering gemaakt.</p>'+button('Onbevestigde handeling opnieuw proberen','retry-pending'):'';
  const dialogStatus=text=>{const node=dialog?.querySelector('[data-ot-dialog-status]');if(node)node.textContent=text;};
  async function route(){const target=steps[guide().step]?.[4];if(target==='reminders')return reminderDialog();if(target==='reset')return resetDialog();const other=[...document.querySelectorAll('dialog[open]')].find(d=>!d.hasAttribute('data-owner-test-dialog'));if(other){const mini=other.querySelector('[data-owner-test-mini]');if(mini)mini.open=true;status('Rond het huidige venster af of sluit het veilig voordat je een ander onderdeel opent.');return;}
   if(target==='search'){document.getElementById('globalSearch')?.focus();}
   else if(target==='signup')await window.FMZMembers?.openEnrollment();
   else if(target==='drafts')await window.FMZMembers?.openDrafts();
   else if(target==='builder')window.showView?.('schema-builder');
   else if(target==='profile'){const inv=await adapter.inventory(),members=inv.members||[];if(!members.length)throw Error('Schrijf eerst een fictief lid in.');const m=members.find(m=>/Mila Laptoptest/i.test(m.label||m.name||''))||members.find(m=>/Noor/i.test(m.label||m.name||''))||members[0];await window.FMZMembers?.openProfile(m.client_id||m.clientId||m.id);}
  }
  const currentReminders=()=> (state?.simulation?.reminders||[]).filter(r=>r.reminderVersion===2&&r.runId===state.runId).sort((a,b)=>a.date.localeCompare(b.date)||a.clientName.localeCompare(b.clientName));
  const reminderTitle=r=>r.kind==='billing_prepare'?'Over één week facturen maken':'Vandaag facturen maken en versturen';
  function reminderHTML(items){return items.length?items.map(r=>`<article class="fmz-test-history" data-ot-reminder="${esc(r.id)}"><strong>${esc(reminderTitle(r))}</strong><p>${esc(r.clientName)} · ${r.cycle==='calendar_month'?'Kalendermaand':'Vier weken'}</p><p>Periode ${esc(r.period)}<br>Herinnering: ${esc(r.date)} om ${esc(r.time)} · Europe/Amsterdam<br>Factuurdatum volgens betaalafspraak: ${esc(r.invoiceDate)}</p><p>${r.status==='done'?'✓ Voltooid':'Openstaande herinnering'} · Alleen lokaal gesimuleerd</p><div class="fmz-test-actions">${button('Herinnering openen','reminder-open',`data-ot-id="${esc(r.id)}"`)}${button('Open Facturen','open-invoices')}${r.status==='done'?'':button('Als voltooid markeren','reminder-complete',`data-ot-id="${esc(r.id)}"`)}</div></article>`).join(''):'<p>Nog geen herinneringen in deze test. Kies Factuurherinneringen testen om beide momenten uit een vastgelegde betaalafspraak te controleren.</p>';}
  function refreshMounts(){for(const el of mounts){if(!el.isConnected){mounts.delete(el);continue;}el.innerHTML='<h2>Factuurherinneringen</h2><p>TESTMODUS — handmatig facturen maken. Deze herinneringen veranderen de administratie niet.</p>'+reminderHTML(currentReminders())+button('Factuurherinneringen testen','reminders');}}
  async function mountReminders(element,options={}){if(!element||!alive)return;element.dataset.ownerTestReminderSurface=options.surface||'notifications';element.classList.add('fmz-test-reminder-surface');mounts.add(element);state=await adapter.getState();if(alive)refreshMounts();}
  async function reminderDetails(id){
   state=await adapter.getState();const reminder=currentReminders().find(r=>r.id===id);if(!reminder)throw Error('Deze herinnering bestaat niet meer.');
   const periods=await adapter.reminderPeriods(reminder.start),related=periods.filter(p=>p.cycle===reminder.cycle&&p.start===reminder.start&&p.end===reminder.end&&p.invoiceDate===reminder.invoiceDate);const members=[...new Map(related.map(p=>[p.clientId,p])).values()];
   openDialog(reminderTitle(reminder),'<p><strong>Periode '+esc(reminder.period)+'</strong> · '+(reminder.cycle==='calendar_month'?'Kalendermaand':'Vier weken')+'</p><p>Herinnering: '+esc(reminder.date)+' om 09:00 · Europe/Amsterdam. Handmatige factuurdatum: '+esc(reminder.invoiceDate)+'.</p><h3>Betreffende leden</h3><ul class="fmz-test-reminder-members" data-ot-reminder-members>'+members.map(m=>'<li data-ot-reminder-client="'+esc(m.clientId)+'"><strong>'+esc(m.clientName)+'</strong> · '+esc(m.packageLabel)+'</li>').join('')+'</ul>'+(members.length?'':'<p>Er is voor deze periode geen actieve betaalafspraak meer gevonden. Controleer de afspraak voordat je handmatig een factuur maakt.</p>')+'<p>Maak en verstuur facturen zelf via de bestaande Facturen-pagina. Deze herinnering maakt geen factuur, e-mailconcept of financiële boeking.</p><div class="fmz-test-actions">'+button('Naar Facturen','open-invoices')+(reminder.status==='done'?'<p>✓ Voltooid</p>':button('Als voltooid markeren','reminder-complete','data-ot-id="'+esc(reminder.id)+'"'))+'</div>');dialog.dataset.reminderId=id;
  }
  async function reminderDialog(){const periods=await adapter.reminderPeriods();state=await adapter.getState();openDialog('Factuurherinneringen testen',`<p>Datums komen uit de vastgelegde betaalafspraak en bestaande perioderegel. Er wordt geen factuurconcept of e-mail gemaakt. De test simuleert de twee momenten; er gaat geen push naar een apparaat.</p><label>Actieve betaalperiode<select data-ot-period><option value="">Kies een periode</option>${periods.map((p,i)=>`<option value="${i}">${esc(p.clientName)} · ${p.cycle==='calendar_month'?'kalendermaand':'vier weken'} · ${esc(p.start)} t/m ${esc(p.end)} · factuurdatum ${esc(p.invoiceDate)}</option>`).join('')}</select></label><div class="fmz-test-actions">${button('Zeven dagen vooraf simuleren','reminder-7')}${button('Factuurdatum simuleren','reminder-today')}</div><div data-ot-reminder-list>${reminderHTML(currentReminders())}</div>${periods.length?'':'<p>Voltooi eerst een synthetische inschrijving met een actieve betaalafspraak.</p>'}`);dialog._periods=periods;}
  async function simulate(action,source){let payload;if(action==='reminder-complete')payload={id:source.dataset.otId};else{const value=dialog.querySelector('[data-ot-period]').value,p=value===''?null:dialog._periods?.[Number(value)];if(!p)throw Error('Kies eerst een actieve betaalperiode.');payload={agreementId:p.agreementId,periodStart:p.start};}
   const body=JSON.stringify({action,payload});if(pending&&pending.body!==body)throw Error('Probeer eerst dezelfde onbevestigde handeling opnieuw.');pending??={body,action,payload,id:crypto.randomUUID()};await adapter.simulate(action,payload,pending.id);pending=null;await refresh();if(dialog?.dataset.reminderId)await reminderDetails(dialog.dataset.reminderId);if(dialog?.querySelector('[data-ot-reminder-list]'))dialog.querySelector('[data-ot-reminder-list]').innerHTML=reminderHTML(currentReminders());dialogStatus('Lokaal bevestigd. Er is geen factuur, boeking, mail of push gemaakt.');}
  function inventoryHTML(inv){const groups=[['members','Testleden'],['drafts','Inschrijfconcepten'],['schemaDrafts','Schema’s en koppelingen in deze testbrowser'],['contracts','Testovereenkomsten'],['documents','Testdocumenten'],['communicationDocuments','Bijlagekoppelingen'],['invoices','Testfacturen en concepten'],['messages','Definitieve testmailconcepten'],['preliminary','Voorlopige testmailconcepten'],['files','Factuur-PDF-registraties'],['simulationRecords','Gesimuleerde verzendingen en historie'],['reminders','Testmeldingen'],['blobs','Lokale testbestanden'],['sessions','Synthetische sessies']];return groups.map(([key,label])=>{const rows=inv[key]||[];return `<details ${rows.length?'open':''}><summary>${label}: ${rows.length}</summary>${rows.length?'<ul>'+rows.map(r=>`<li>${esc(r.label||r.name||r.number||r.subject||r.path||r.id)} <small>${esc(r.id||r.path||'')}</small></li>`).join('')+'</ul>':'<p>Geen.</p>'}</details>`;}).join('');}
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




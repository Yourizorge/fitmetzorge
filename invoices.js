/* Invoice drafts stay outside workspace autosave until explicit confirmation.
 * Final snapshots and sequence changes use the existing atomic/idempotent write chain. */
window.FMZInvoices = (() => {
  const drafts = new Map();
  let dialog, active;
  const copy = x => JSON.parse(JSON.stringify(x));
  const money = cents => new Intl.NumberFormat('nl-NL', {style:'currency',currency:'EUR'}).format(cents / 100);
  function cents(raw, label = 'Bedrag') {
    const value = String(raw ?? '').trim();
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) throw Error(`${label}: vul een geldig bedrag in (maximaal twee decimalen).`);
    const [euros, decimals = ''] = value.replace(',', '.').split('.');
    const result = Number(euros) * 100 + Number(decimals.padEnd(2, '0'));
    if (!Number.isSafeInteger(result) || result > 999999999) throw Error(`${label} is te groot.`);
    return result;
  }
  function totals(amount, discount, vatPercent) {
    const grossCents = cents(amount), discountCents = cents(discount, 'Korting');
    if (discountCents > grossCents) throw Error('Korting mag niet hoger zijn dan het oorspronkelijke bedrag.');
    const vatBasisPoints = cents(vatPercent, 'Btw-percentage');
    if (vatBasisPoints > 10000) throw Error('Controleer het ingestelde btw-percentage.');
    const totalCents = grossCents - discountCents;
    const netCents = Math.round(totalCents * 10000 / (10000 + vatBasisPoints));
    return {grossCents,discountCents,totalCents,netCents,vatCents:totalCents-netCents,vatBasisPoints};
  }
  function fields(item) {
    const doc = item.document;
    return {description:doc?.description ?? item.description ?? '', amount:doc ? (doc.grossCents/100).toFixed(2) : String(item.amount ?? ''),
      discount:doc ? (doc.discountCents/100).toFixed(2) : '0.00', discountNote:doc?.discountNote || '',
      date:doc?.date || item.date || todayISO(), term:String(doc?.paymentTermDays ?? (Number.isFinite(Date.parse(item.dueDate)) ? Math.max(0, Math.round((Date.parse(item.dueDate)-Date.parse(item.date))/86400000)) : invoiceSettings().paymentTermDays))};
  }
  function editor() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');dialog.id='invoiceEditor';
    dialog.innerHTML=`<form id="invoiceDraftForm" novalidate><header><div><small>Concept controleren</small><h2>Factuur</h2></div><button type="button" data-close-invoice>Sluiten</button></header>
      <p data-invoice-client></p><p data-invoice-package></p><p data-invoice-number>Nummer volgt bij bevestigde opslag</p>
      <div class="invoice-draft-fields"><label>Omschrijving<textarea name="description" maxlength="2000" required></textarea></label>
      <label>Oorspronkelijk bedrag incl. btw (€)<input name="amount" inputmode="decimal" required></label>
      <label>Korting (€)<input name="discount" inputmode="decimal" required></label>
      <label>Toelichting korting (optioneel)<textarea name="discountNote" maxlength="1000"></textarea></label>
      <label>Factuurdatum<input name="date" type="date" required></label><label>Betaaltermijn (dagen)<input name="term" inputmode="numeric" required></label></div>
      <section class="invoice-draft-preview" aria-label="Factuurvoorbeeld" aria-live="polite"></section>
      <p data-invoice-message role="status"></p><footer><button class="primary-btn" data-save-invoice="draft" type="button">Opslaan en PDF downloaden</button><button data-invoice-retry-download type="button" hidden>PDF opnieuw downloaden</button></footer></form>`;
    document.body.append(dialog);
    dialog.querySelector('form').addEventListener('submit',e=>{e.preventDefault();save(dialog.querySelector('[data-save-invoice]'));});
    dialog.addEventListener('input',()=>{if(!active||active.busy)return;active.values=Object.fromEntries(new FormData(dialog.querySelector('form')));active.dirty=true;preview();});
    dialog.querySelector('[data-close-invoice]').onclick=close;
    dialog.querySelector('[data-invoice-retry-download]').onclick=()=>download(active.id,dialog.querySelector('[data-invoice-retry-download]'));
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    return dialog;
  }
  function close(){if(active?.busy)return;dialog?.close();active=null;}
  function lock(){dialog?.close();if(dialog)dialog.querySelector('form').reset();active=null;}
  function preview() {
    const target=dialog.querySelector('.invoice-draft-preview'),v=active.values;
    try {const t=totals(v.amount,v.discount,active.settings.vatPercent);
      target.innerHTML=`<strong>${escapeHTML(v.description || 'Omschrijving')}</strong><p>Oorspronkelijk bedrag <b>${money(t.grossCents)}</b></p><p>Korting <b>− ${money(t.discountCents)}</b></p>${v.discountNote?`<p>${escapeHTML(v.discountNote)}</p>`:''}<p>Excl. btw ${money(t.netCents)} · Btw ${fmt(t.vatBasisPoints/100)}% ${money(t.vatCents)}</p><p class="invoice-total">Te betalen <b>${money(t.totalCents)}</b></p>`;
    }catch(e){target.textContent=e.message;}
  }
  function show(d) {
    if(active?.busy)return;
    active=d;editor();for(const [k,v] of Object.entries(d.values))dialog.querySelector(`[name="${k}"]`).value=v;
    dialog.querySelector('[data-invoice-client]').textContent=d.customer.name;
    dialog.querySelector('[data-invoice-package]').textContent=d.packageLabel;
    dialog.querySelector('[data-invoice-number]').textContent=d.invoiceNo || 'Nummer volgt bij bevestigde opslag';
    dialog.querySelector('[data-invoice-message]').textContent='Controleer het concept. Typen geeft geen factuur uit.';
    dialog.querySelector('[data-invoice-retry-download]').hidden=true;
    dialog.querySelectorAll('input,textarea').forEach(e=>e.disabled=Boolean(d.prepared));preview();if(!dialog.open)dialog.showModal();
  }
  function customer(c){return {name:c?.name || '',email:c?.email || '',address:[c?.profile?.address,c?.profile?.postalCode,c?.profile?.city].filter(Boolean).join(', ')};}
  function open(id) {
    if(!isTrainer()||!onlineReady)return;
    const item=financeAdminItems().find(i=>i.id===id);if(!item)return;
    const key=onlineProfile.id+'|'+id;
    let d=drafts.get(key);
    if(!d || !d.dirty){const c=state.clients.find(c=>c.id===item.clientId);d={id,key,owner:onlineProfile.id,clientId:item.clientId,values:fields(item),settings:copy(item.document?.settings || invoiceSettings()),customer:copy(item.document?.customer || customer(c)),packageLabel:item.document?.packageLabel || packageByValue(c?.profile?.package)?.label || c?.profile?.package || '',invoiceNo:item.invoiceNo};drafts.set(key,d);}
    show(d);
  }
  function create(packageOnly) {
    if(!isTrainer()||!onlineReady)return;
    const form=document.querySelector('#financeAdminForm'),v=Object.fromEntries(new FormData(form)),c=state.clients.find(c=>c.id===v.clientId)||client();
    if(!hasSelectedClient(c)){alert('Kies eerst een lid.');return;}
    const label=clientPackageLabel(c),price=clientPackageAmount(c),date=v.date || todayISO();
    if(packageOnly && !c.profile?.package){alert('Kies eerst een pakket bij het lid.');return;}
    const key=onlineProfile.id+'|new|'+c.id+'|'+(packageOnly?'package':'manual')+'|'+date;
    let d=drafts.get(key);
    if(!d){d={key,id:crypto.randomUUID(),owner:onlineProfile.id,clientId:c.id,settings:copy(invoiceSettings()),customer:customer(c),packageLabel:label,dirty:true,
      values:{description:packageOnly?`Pakket: ${label} - ${monthLabel(date.slice(0,7))}`:v.description || '',amount:String(packageOnly?price:v.amount ?? ''),discount:'0.00',discountNote:'',date,term:String(invoiceSettings().paymentTermDays)}};drafts.set(key,d);}
    show(d);
  }
  function validate(d) {
    const v=d.values;if(!v.description.trim())throw Error('Vul een omschrijving in.');
    if(!/^\d{4}-\d\d-\d\d$/.test(v.date)||!Number.isFinite(Date.parse(v.date))||new Date(v.date).toISOString().slice(0,10)!==v.date)throw Error('Vul een geldige factuurdatum in.');
    if(!/^\d{1,4}$/.test(v.term)||Number(v.term)>3650)throw Error('Vul een betaaltermijn van 0 tot 3650 dagen in.');
    return {...totals(v.amount,v.discount,d.settings.vatPercent),description:v.description.trim(),discountNote:v.discountNote.trim(),date:v.date,paymentTermDays:Number(v.term),dueDate:addDaysISO(v.date,Number(v.term))};
  }
  async function logo(settings) {
    let source=settings.logoUrl || FMZ_LOGO_FILE;
    if(source===FMZ_INVOICE_LOGO_URL)source=FMZ_LOGO_FILE;
    const response=await fetch(source,{credentials:'omit',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Logo laden mislukt. Probeer opnieuw.');
    const blob=await response.blob();if(blob.size>4000000)throw Error('Logo is te groot.');
    return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Logo lezen mislukt.'));r.readAsDataURL(blob);});
  }
  async function save(button) {
    const d=active;if(!d||d.busy||d.owner!==onlineProfile?.id)return;
    const form=button.closest('#invoiceDraftForm');if(!form)return;
    if(!d.prepared)d.values=Object.fromEntries(new FormData(form));
    const message=form.querySelector('[data-invoice-message]'),generation=authGeneration;
    d.busy=true;button.disabled=true;
    try {
      const values=validate(d);message.textContent='Opslaan…';
      form.querySelectorAll('input,textarea').forEach(e=>e.disabled=true);
      // Finish/retry an already prepared write before changing its payload or number.
      let record=financeAdminItems().find(i=>i.id===d.id);
      if(d.prepared && !pendingWrite && (!record || JSON.stringify(record.document)!==JSON.stringify(d.prepared.document)))d.prepared=null;
      if(!d.prepared){
        const ready=await saveStateToCloud();if(!ready.ok)throw ready.error;
        const document={version:1,...values,settings:copy(d.settings),customer:copy(d.customer),packageLabel:d.packageLabel,logo:await logo(d.settings)};
        if(generation!==authGeneration||d.owner!==onlineProfile?.id)throw Error('Account gewijzigd. Log opnieuw in.');
        record=financeAdminItems().find(i=>i.id===d.id);
        document.invoiceNo=record?.invoiceNo || `FMZ-${new Date().getFullYear()}-${String(state.trainerFinance.invoiceSequenceNext).padStart(2,'0')}`;
        await pdf(document); // Check PDF generation before assigning a number or issuing anything.
        if(generation!==authGeneration||d.owner!==onlineProfile?.id)throw Error('Sessie gewijzigd.');
        if(!record){record={id:d.id,type:'invoice',clientId:d.clientId,status:'unpaid'};financeAdminItems().push(record);}
        if(!record.invoiceNo)record.invoiceNo=nextInvoiceNumber();
        document.invoiceNo=record.invoiceNo;
        Object.assign(record,{description:values.description,date:values.date,dueDate:values.dueDate,amount:values.totalCents/100,draft:false,document});
        d.prepared=copy(record);syncAppointmentFromAdminItem(record);
      }
      const result=await saveStateToCloud();if(!result.ok)throw result.error;
      const confirmed=cloudBaseline?.trainerFinance?.adminItems?.find(i=>i.id===d.id);
      if(!confirmed?.document || JSON.stringify(confirmed.document)!==JSON.stringify(d.prepared.document))throw Error('Nog geen bevestiging voor deze factuur. Probeer opnieuw.');
      d.dirty=false;d.prepared=null;d.invoiceNo=confirmed.invoiceNo;drafts.delete(d.key);
      message.textContent='Opgeslagen';form.querySelector('[data-invoice-number]').textContent=confirmed.invoiceNo;
      form.querySelector('[data-invoice-retry-download]').hidden=false;
      renderAdministration();renderInvoicePage();
      try {await download(d.id);message.textContent='Opgeslagen — PDF-download gestart';}
      catch(e){message.textContent='Opgeslagen — PDF-download mislukt. Probeer opnieuw.';form.querySelector('[data-invoice-retry-download]').hidden=false;}
    }catch(e){message.textContent='Niet opgeslagen — '+e.message;}
    finally{d.busy=false;button.disabled=false;if(!d.prepared)form.querySelectorAll('input,textarea').forEach(e=>e.disabled=false);}
  }
  function card(item) {
    const doc=item.document;
    return `<div class="finance-card invoice-card"><div><strong>${escapeHTML(item.draft?'Concept':invoiceNumber(item))}</strong><span>${escapeHTML(doc?.customer.name || clientNameById(item.clientId))}</span><p>${escapeHTML(doc?.description || item.description)}</p><b>${item.amount===''?'Bedrag nog invullen':currency(item.amount)}</b>${doc?.discountCents?`<p>Korting ${money(doc.discountCents)} op ${money(doc.grossCents)}</p>`:''}</div><div class="finance-card-actions"><button class="primary-btn" data-edit-invoice="${escapeHTML(item.id)}">Concept openen / bewerken</button><button data-download-invoice="${escapeHTML(item.id)}">${doc?'PDF downloaden':'PDF voorbereiden'}</button><select data-admin-status="${escapeHTML(item.id)}">${paymentStatusOptions(item.status)}</select><button data-save-admin="${escapeHTML(item.id)}">Betaalstatus opslaan</button><button class="danger-btn" data-remove-admin="${escapeHTML(item.id)}">Verwijderen</button></div></div>`;
  }
  async function pdf(doc) {
    const {PDFDocument,StandardFonts,rgb}=PDFLib;
    const out=await PDFDocument.create();out.setTitle('Factuur '+doc.invoiceNo);out.setAuthor(doc.settings.businessName || 'Fit Met Zorge');
    const regular=await out.embedFont(StandardFonts.Helvetica),bold=await out.embedFont(StandardFonts.HelveticaBold);
    let page,y;const ink=rgb(.08,.11,.15),gold=rgb(.65,.46,.08);
    function fresh(){page=out.addPage([595.28,841.89]);y=790;}
    function text(value,{size=11,font=regular,color=ink,width=495}={}) {
      for(const paragraph of String(value??'').split(/\r?\n/)){
        let line='';for(const char of paragraph){if(font.widthOfTextAtSize(line+char,size)>width){if(y<65)fresh();page.drawText(line,{x:50,y,size,font,color});y-=size+5;line='';}line+=char;}
        if(y<65)fresh();page.drawText(line,{x:50,y,size,font,color});y-=size+5;
      }
    }
    function row(label,value,strong=false){if(y<85)fresh();const font=strong?bold:regular,size=strong?15:11;page.drawText(label,{x:50,y,size,font,color:ink});page.drawText(value,{x:545-font.widthOfTextAtSize(value,size),y,size,font,color:ink});y-=strong?30:23;}
    fresh();
    const image=doc.logo.startsWith('data:image/jpeg')?await out.embedJpg(doc.logo):await out.embedPng(doc.logo);
    const scale=Math.min(150/image.width,68/image.height);page.drawImage(image,{x:50,y:y-image.height*scale,width:image.width*scale,height:image.height*scale});
    page.drawText('FACTUUR',{x:350,y:y-15,size:26,font:bold,color:gold});y-=85;
    text(doc.settings.businessName || 'Fit Met Zorge',{font:bold,size:14});
    for(const value of [doc.settings.ownerName,doc.settings.email,doc.settings.phone,[doc.settings.address,doc.settings.postalCity,doc.settings.country].filter(Boolean).join(', '),doc.settings.vatNumber&&'BTW '+doc.settings.vatNumber,doc.settings.chamberNumber&&'KvK '+doc.settings.chamberNumber,doc.settings.iban&&'IBAN '+doc.settings.iban].filter(Boolean))text(value,{size:10});
    y-=12;text('Factuur aan',{font:bold});text(doc.customer.name);if(doc.customer.email)text(doc.customer.email);if(doc.customer.address)text(doc.customer.address);
    y-=12;text('Factuurnummer: '+doc.invoiceNo,{font:bold});text('Factuurdatum: '+doc.date+'   |   Vervaldatum: '+doc.dueDate);text('Betaaltermijn: '+doc.paymentTermDays+' dagen');y-=14;
    text('OMSCHRIJVING',{font:bold,color:gold});text(doc.description);if(doc.discountNote){y-=5;text('Toelichting korting: '+doc.discountNote);}y-=16;
    row('Oorspronkelijk bedrag incl. btw',money(doc.grossCents));row('Korting', '- '+money(doc.discountCents));row('Bedrag excl. btw',money(doc.netCents));row('Btw '+(doc.vatBasisPoints/100)+'%',money(doc.vatCents));row('Te betalen',money(doc.totalCents),true);
    if(doc.settings.note){y-=8;text(doc.settings.note,{size:10});}
    out.getPages().forEach((p,i)=>p.drawText(`${doc.invoiceNo}  |  ${i+1} / ${out.getPageCount()}`,{x:50,y:30,size:9,font:regular,color:ink}));
    return out.save();
  }
  async function download(id,button) {
    if(!isTrainer()||!onlineReady)throw Error('Log opnieuw in.');
    const item=cloudBaseline?.trainerFinance?.adminItems?.find(i=>i.id===id);
    if(!item?.document){open(id);return;}
    const owner=onlineProfile.id,generation=authGeneration;
    if(button)button.disabled=true;
    try {const data=await pdf(copy(item.document));if(owner!==onlineProfile?.id||generation!==authGeneration)throw Error('Account gewijzigd.');const blob=new Blob([data],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=item.invoiceNo+'.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
    catch(e){if(button)alert('PDF downloaden mislukt. Probeer opnieuw; er wordt geen nieuwe factuur aangemaakt.');else throw e;}
    finally{if(button)button.disabled=false;}
  }
  window.addEventListener('beforeunload',e=>{if([...drafts.values()].some(d=>d.dirty)){e.preventDefault();e.returnValue='';}});
  return {open,create,save,download,card,pdf,cents,totals,lock};
})();

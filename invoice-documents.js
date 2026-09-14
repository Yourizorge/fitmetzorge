/* Local A4 documents and real PDF previews. No external document service. */
window.FMZDocuments=(()=>{
 const money=n=>FMZAccountingModel.money(n),W=595.28,H=841.89,L=44,R=551.28;
 async function base(title,settings={}){
  const {PDFDocument,StandardFonts,rgb}=PDFLib,out=await PDFDocument.create();out.setTitle(title);out.setAuthor(settings.businessName||'FitMetZorge');
  const regular=await out.embedFont(StandardFonts.Helvetica),bold=await out.embedFont(StandardFonts.HelveticaBold);
  const ink=rgb(.075,.12,.19),gold=rgb(.67,.49,.16),muted=rgb(.35,.39,.44),line=rgb(.82,.84,.86);let page;
  function fresh(){page=out.addPage([W,H]);return page;}
  function write(value,x,y,size=10,font=regular,color=ink){page.drawText(String(value??''),{x,y:H-y-size,size,font,color});}
  function right(value,x,y,size=10,font=regular,color=ink){write(value,x-font.widthOfTextAtSize(String(value),size),y,size,font,color);}
  function wrap(value,width,size=10,font=regular){const rows=[];for(const p of String(value??'').split(/\r?\n/)){let text='';for(const word of p.split(/(\s+)/)){if(text&&font.widthOfTextAtSize(text+word,size)>width){rows.push(text.trimEnd());text='';}for(const char of word){if(font.widthOfTextAtSize(text+char,size)>width){rows.push(text);text='';}text+=char;}}rows.push(text.trimEnd());}return rows;}
  function block(value,x,y,width,size=10,font=regular,color=ink){const rows=wrap(value,width,size,font);rows.forEach((s,i)=>write(s,x,y+i*(size+4),size,font,color));return y+rows.length*(size+4);}
  function rule(y,x=L,end=R){page.drawLine({start:{x,y:H-y},end:{x:end,y:H-y},thickness:.65,color:line});}
  function rect(x,y,width,height,color){page.drawRectangle({x,y:H-y-height,width,height,color});}
  function footer(reference=''){out.getPages().forEach((p,i)=>{page=p;rule(787);const contact=[settings.businessName,settings.email,settings.phone,settings.website].filter(Boolean).join('  |  ');wrap(contact,420,8).slice(0,2).forEach((s,j)=>write(s,L,797+j*11,8,regular,muted));right(`${i+1} / ${out.getPageCount()}`,R,800,9,regular,muted);if(reference)write(reference,L,824,7,regular,muted);});}
  return {out,regular,bold,ink,gold,muted,fresh,write,right,wrap,block,rule,rect,footer,selectPage:p=>{page=p;}};
 }
 // Presentation only: reconcile displayed line cents to the immutable document totals.
 function invoiceRows(doc){
  const source=Array.isArray(doc.lines)&&doc.lines.length?doc.lines:[{quantity:doc.quantity||1,description:doc.description,unitCents:Math.round(doc.grossCents/(doc.quantity||1)),amountCents:doc.grossCents}];
  const exclusive=doc.priceMode==='exclusive',discount=Math.abs(doc.discountInputCents??doc.discountCents??0),subtotal=doc.subtotalCents??source.reduce((sum,item)=>sum+item.amountCents,0);
  const round=(n,den)=>{const sign=n<0n?-1n:1n;return Number(sign*((sign*n*2n+den)/(2n*den)));};
  const rate=['kor','exempt'].includes(doc.vatStatus)?0:Number(doc.vatBasisPoints);
  const beforeNet=discount?(exclusive?subtotal:round(BigInt(doc.grossCents)*10000n,BigInt(10000+rate))):doc.netCents;
  const beforeVat=doc.grossCents-beforeNet,weight=source.reduce((sum,item)=>sum+Math.abs(item.amountCents),0);
  let seen=0,netBefore=0,vatBefore=0;
  const rows=source.map(item=>{
   seen+=Math.abs(item.amountCents);
   const net=weight?round(BigInt(beforeNet)*BigInt(seen),BigInt(weight)):0;
   const vat=exclusive?(weight?round(BigInt(beforeVat)*BigInt(seen),BigInt(weight)):0):null;
   const result={...item,netCents:net-netBefore,vatCents:exclusive?vat-vatBefore:item.amountCents-(net-netBefore)};
   netBefore=net;if(exclusive)vatBefore=vat;return result;
  });
  if(discount)rows.push({description:'Korting'+(doc.discountMode==='percent'?' ('+Number(doc.discountBasisPoints)/100+'%)':'')+(doc.discountNote?' - '+doc.discountNote:''),discount:true,netCents:doc.netCents-beforeNet,vatCents:doc.vatCents-beforeVat});
  return rows;
 }
 async function pdf(doc){
  const s=doc.settings||{},d=await base((doc.creditOf?'Creditfactuur ':'Factuur ')+doc.invoiceNo,s),{write,right,block,rule,rect,bold,regular,ink,gold,muted}=d;
  const left=56,rightEdge=539,width=rightEdge-left,limit=724,customer=doc.customer||{};
  const clean=v=>String(v??'').trim(),present=values=>values.map(clean).filter(Boolean),euros=n=>money(n).replace(/\u00a0/g,' ');
  function fittedRight(value,x,y,width,size=9,font=regular){right(value,x,y,Math.min(size,width/font.widthOfTextAtSize(String(value),1)),font);}
  const date=value=>/^\d{4}-\d\d-\d\d$/.test(value||'')?value.split('-').reverse().join('-'):clean(value);
  const heading=doc.creditOf?'CREDITFACTUUR':'FACTUUR',exempt=['kor','exempt'].includes(doc.vatStatus),exclusive=doc.priceMode==='exclusive';
  d.out.setCreator('FitMetZorge factuurtemplate 2026-09-13');
  d.fresh();
  if(doc.logo){
   const image=String(doc.logo).startsWith('data:image/jpeg')?await d.out.embedJpg(doc.logo):await d.out.embedPng(doc.logo);
   // The original FMZ PNG stays intact. Position its visible bounds, not its transparent square.
   const original=image.width===3000&&image.height===3000;
   const scale=original?205/2868:Math.min(205/image.width,112/image.height);
   const x=left-(original?51*scale:0),top=56-(original?892*scale:0);
   d.out.getPages()[0].drawImage(image,{x,y:H-top-image.height*scale,width:image.width*scale,height:image.height*scale});
  }
  let companyY=56;
  if(clean(s.businessName))companyY=block(s.businessName,405,companyY,134,10,bold)+2;
  for(const value of present([s.address,s.postalCity,s.country,s.chamberNumber&&'KVK '+s.chamberNumber,s.vatNumber&&'Btw-id '+s.vatNumber,s.email,s.phone,s.website]))companyY=block(value,405,companyY,134,8.5,regular);
  if(companyY>56)d.out.getPages()[0].drawLine({start:{x:393,y:H-56},end:{x:393,y:H-Math.max(144,companyY)},thickness:.8,color:gold});
  let y=Math.max(190,companyY+12);write(heading,left,y,21,bold);y+=33;
  let customerY=y;
  if(clean(customer.name))customerY=block(customer.name,left,customerY,242,10.5,bold)+3;
  for(const value of present([customer.address,customer.postalCity||[customer.postalCode,customer.city].filter(Boolean).join(' '),customer.country,customer.vatNumber&&'Btw-nummer '+customer.vatNumber]))customerY=block(value,left,customerY,242,9.5)+2;
  let infoY=y;
  const pairs=[['Factuurnummer',doc.invoiceNo],['Factuurdatum',date(doc.date)],['Vervaldatum',date(doc.dueDate)],['Klantnummer',customer.number],['Referentie',doc.reference],['Factuurperiode',doc.period],['Credit op',doc.creditOf]];
  for(const [label,value] of pairs.filter(([,value])=>clean(value))){write(label,325,infoY,8.5,bold);infoY=block(value,416,infoY,123,8.5)+1;}
  y=Math.max(customerY,infoY)+20;
  function newPage(){d.fresh();write(heading,left,44,15,bold);right(doc.invoiceNo,rightEdge,48,9,bold);rule(78,left,rightEdge);y=96;}
  function flow(value,size=9.5,font=regular,color=ink,gap=3){
   for(const row of d.wrap(value,width,size,font)){if(y+size+gap>limit)newPage();write(row,left,y,size,font,color);y+=size+gap;}
  }
  const title=clean(doc.packageLabel)||clean(doc.description)||clean(doc.lines?.[0]?.description);
  if(title){flow(title,14,regular,ink,4);y+=16;}
  const basis=exempt?'vrijgesteld':exclusive?'excl. btw':'incl. btw';
  function tableHeader(){
   if(y+58>limit)newPage();
   write('Omschrijving',left,y,8.5,bold);right('Aantal',282,y,8.5,bold);right('Prijs per stuk',361,y,8.5,bold);right('Btw',446,y,8.5,bold);right('Totaal exclusief btw',rightEdge,y,8.5,bold);
   right('('+basis+')',361,y+12,7.5,regular,muted);rule(y+25,left,rightEdge);y+=31;
  }
  tableHeader();
  const rows=invoiceRows(doc),rateLabel=exempt?'vrijgesteld':Number(doc.vatBasisPoints)/100+'%';
  for(const item of rows){
   const textRows=d.wrap(item.description,190,9.5,item.discount?bold:regular);
   const periodRows=!item.discount&&clean(item.period||doc.period)?d.wrap(item.period||doc.period,190,8):[];
   const height=textRows.length*13+periodRows.length*11+14;
   if(height<=limit-140&&y+height>limit){newPage();tableHeader();}
   let first=true;
   const fragments=[...textRows.map(text=>({text,size:9.5,font:item.discount?bold:regular,color:item.discount?gold:ink,leading:13})),...periodRows.map(text=>({text,size:8,font:regular,color:muted,leading:11}))];
   while(fragments.length){
    if(y+27>limit){newPage();tableHeader();}
    if(first){
     if(!item.discount){fittedRight(new Intl.NumberFormat('nl-NL',{maximumFractionDigits:3}).format(item.quantity),282,y,30);fittedRight(euros(item.unitCents),361,y,71);}
     fittedRight(euros(item.vatCents),446,y,77);right(rateLabel,446,y+13,7.5,regular,muted);fittedRight(euros(item.netCents),rightEdge,y,85,9,item.discount?bold:regular);
    }
    let used=0;
    while(fragments.length&&y+fragments[0].leading+12<=limit){const part=fragments.shift();write(part.text,left,y,part.size,part.font,part.color);y+=part.leading;used+=part.leading;}
    if(first&&used<25)y+=25-used;
    first=false;
    if(fragments.length){newPage();tableHeader();}
   }
   y+=8;
  }
  rule(y,left,rightEdge);y+=14;
  const shownDiscount=Math.abs(doc.discountInputCents??doc.discountCents??0),paid=doc.paidCents||0;
  const totals=[['Subtotaal ('+(exclusive?'excl. btw':'incl. btw')+')',doc.subtotalCents??doc.grossCents],...(shownDiscount?[['Korting',-shownDiscount]]:[]),['Totaal exclusief btw',doc.netCents],[exempt?'Btw (vrijgesteld)':'Btw '+rateLabel,doc.vatCents],['Totaal inclusief btw',doc.totalCents],...(paid?[['Reeds betaald',paid]]:[]),[doc.creditOf?'Te crediteren':'Te betalen',doc.outstandingCents??doc.totalCents,true]];
  const holder=clean(s.accountHolder)||clean(s.ownerName)||clean(s.businessName);
  let instruction;
  if(doc.creditOf)instruction='Deze creditfactuur corrigeert factuurnummer '+doc.creditOf+'.';
  else if(clean(s.iban)&&holder&&clean(doc.dueDate)&&clean(doc.invoiceNo))instruction='Maak het openstaande bedrag uiterlijk op '+date(doc.dueDate)+' over naar '+clean(s.iban)+' ten name van '+holder+', onder vermelding van factuurnummer '+doc.invoiceNo+'.';
  const ibanRows=clean(s.iban)?present([s.iban,holder,s.bic&&'BIC '+s.bic]).flatMap(v=>d.wrap(v,224,9)):[];
  const ibanHeight=ibanRows.length?38+ibanRows.length*13:0,totalHeight=totals.length*18+12;
  const paymentHeight=(instruction?d.wrap(instruction,width,9.5).length*13:0)+35;
  if(y+Math.max(totalHeight,ibanHeight)+paymentHeight>limit)newPage();
  const top=y;
  if(ibanRows.length){rect(left,top,245,ibanHeight,PDFLib.rgb(.955,.954,.941));write('IBAN',left+10,top+10,10,bold);ibanRows.forEach((text,i)=>write(text,left+10,top+30+i*13,9));}
  let ty=top;rule(ty,323,rightEdge);ty+=9;
  for(const [label,amount,strong] of totals){
   if(strong){rule(ty-5,323,rightEdge);ty+=3;}
   write(label,328,ty,strong?10:8.5,strong?bold:regular);
   fittedRight(euros(amount),rightEdge,ty,88,strong?11:9.5,strong?bold:regular);ty+=strong?23:18;
  }
  y=Math.max(top+ibanHeight,ty)+20;
  if(instruction){flow(instruction);y+=7;}
  flow('Bedankt voor je vertrouwen in FitMetZorge.');y+=8;
  if(clean(s.note)){flow(s.note,8.5,regular,muted);y+=6;}
  if(exempt)flow(doc.vatStatus==='kor'?'Vrijgesteld van btw wegens toepassing kleineondernemersregeling (KOR).':'Vrijgesteld van btw. Zie de bevestigde grondslag in de factuurtekst.',8.5,regular,muted);
  for(const [i,page] of d.out.getPages().entries()){
   d.selectPage(page);
   const leftRows=present([s.businessName,s.address,s.postalCity,s.country,[s.chamberNumber&&'KVK '+s.chamberNumber,s.vatNumber&&'Btw-id '+s.vatNumber].filter(Boolean).join(' | ')]);
   const contactRows=present([s.email,s.website,s.phone]);
   function footerColumn(values,x,columnWidth){
    let size=8;
    const wrapAll=()=>values.flatMap((v,index)=>d.wrap(v,columnWidth,size,index===0?bold:regular).map(text=>({text,font:index===0?bold:regular})));
    let lines=wrapAll();while(lines.length*(size+2)>69&&size>6){size-=.5;lines=wrapAll();}
    lines.forEach((line,index)=>write(line.text,x,753+index*(size+2),size,line.font,ink));
   }
   footerColumn(leftRows,left,240);footerColumn(contactRows,325,157);
   right((i+1)+' / '+d.out.getPageCount(),rightEdge,803,9);
  }
  return d.out.save();
 }
 async function report({title,settings,period,sections,createdAt=new Date().toISOString()}){
  const d=await base(title,settings),{write,block,rule,bold,regular,gold,muted}=d;let y;
  function fresh(){d.fresh();write('FitMetZorge',L,38,12,bold,gold);y=block(title,L,62,R-L,23,bold)+10;y=block(`Periode: ${period.from} t/m ${period.to} | Aangemaakt: ${createdAt}`,L,y,R-L,9,regular,muted)+12;rule(y);y+=18;}
  fresh();
  for(const section of sections){if(y>690)fresh();write(section.title,L,y,14,bold);y+=25;for(const row of section.rows){const text=Array.isArray(row)?row.join('  |  '):String(row);for(const line of d.wrap(text,R-L-4,10)){if(y>753)fresh();write(line,L,y,10);y+=15;}y+=8;}y+=17;}
  if(y>713)fresh();block('Controle- en overdrachtsdocument. Geen automatische btw-aangifte. Controleer de aansluiting en brongegevens vóór aangifte.',L,y,R-L,9,regular,muted);d.footer();return d.out.save();
 }
 let renderer;
 const viewers=new WeakMap();
 function previewControls(element,isCurrent){
  const toolbar=document.createElement('div');toolbar.className='fmz-pdf-toolbar';
  const enlarge=document.createElement('button');enlarge.type='button';enlarge.textContent='PDF vergroten';toolbar.append(enlarge);element.prepend(toolbar);
  enlarge.addEventListener('click',()=>{
   if(!element.isConnected||!isCurrent())return;
   viewers.get(element)?.();
   const dialog=document.createElement('dialog');dialog.className='fmz-pdf-dialog';dialog.setAttribute('aria-label','PDF vergroot bekijken');
   const actions=document.createElement('div');actions.className='fmz-pdf-toolbar';
   const pages=document.createElement('div');pages.className='fmz-pdf-pages';
   const scroll=document.createElement('div');scroll.className='fmz-pdf-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label','PDF-pagina’s; vergroot om details te bekijken');scroll.append(pages);
   for(const source of element.querySelectorAll('canvas')){const canvas=source.cloneNode();canvas.getContext('2d').drawImage(source,0,0);pages.append(canvas);}
   let scale=1,drag=null;
   function button(label,handler){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',handler);actions.append(b);return b;}
   function zoom(next){scale=Math.max(1,Math.min(3,next));pages.style.width=scale*100+'%';minus.disabled=scale===1;plus.disabled=scale===3;level.textContent=Math.round(scale*100)+'%';scroll.classList.toggle('is-zoomed',scale>1);}
   const minus=button('−',()=>zoom(scale-.25));minus.setAttribute('aria-label','Uitzoomen');
   const plus=button('+',()=>zoom(scale+.25));plus.setAttribute('aria-label','Inzoomen');
   const level=document.createElement('output');level.setAttribute('aria-live','polite');actions.append(level);button('Passend',()=>zoom(1));
   const close=button('Sluiten',()=>dialog.close());
   const observer=new MutationObserver(()=>{if(!element.isConnected||!isCurrent())cleanup();});
   function cleanup(){observer.disconnect();if(dialog.open)dialog.close();dialog.remove();pages.replaceChildren();if(viewers.get(element)===cleanup)viewers.delete(element);}
   dialog.addEventListener('close',cleanup,{once:true});
   scroll.addEventListener('pointerdown',e=>{if(scale<=1||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:scroll.scrollLeft,top:scroll.scrollTop};scroll.setPointerCapture(e.pointerId);});
   scroll.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;scroll.scrollLeft=drag.left+drag.x-e.clientX;scroll.scrollTop=drag.top+drag.y-e.clientY;});
   const stop=()=>{drag=null;};scroll.addEventListener('pointerup',stop);scroll.addEventListener('pointercancel',stop);scroll.addEventListener('lostpointercapture',stop);
   dialog.append(actions,scroll);document.body.append(dialog);viewers.set(element,cleanup);observer.observe(document.body,{childList:true,subtree:true});zoom(1);dialog.showModal();close.focus();
  });
 }
 async function renderPDF(bytes,element,isCurrent=()=>true){
  renderer ||= import('./vendor/pdfjs-6.3.289/pdf.mjs');const lib=await renderer;
  lib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs-6.3.289/pdf.worker.mjs',location.href).href;
  const task=lib.getDocument({data:new Uint8Array(bytes),useSystemFonts:true});
  try{
   const doc=await task.promise,fragment=document.createDocumentFragment();
   for(let i=1;i<=doc.numPages;i++){
    if(!element.isConnected||!isCurrent())return;
    const page=await doc.getPage(i),viewport=page.getViewport({scale:1.4}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('aria-label',`A4-pagina ${i} van ${doc.numPages}`);
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;fragment.append(canvas);
   }
   if(element.isConnected&&isCurrent()){viewers.get(element)?.();element.replaceChildren(fragment);previewControls(element,isCurrent);}
  }finally{await task.destroy();}
 }
 return {pdf,report,renderPDF,invoiceRows};
})();

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
  return {out,regular,bold,ink,gold,muted,fresh,write,right,wrap,block,rule,rect,footer};
 }
 async function pdf(doc){
  const s=doc.settings||{},d=await base((doc.creditOf?'Creditfactuur ':'Factuur ')+doc.invoiceNo,s),{write,right,block,rule,rect,bold,regular,ink,gold,muted}=d;
  d.fresh();
  if(doc.logo){const image=String(doc.logo).startsWith('data:image/jpeg')?await d.out.embedJpg(doc.logo):await d.out.embedPng(doc.logo),scale=Math.min(154/image.width,72/image.height);d.out.getPages()[0].drawImage(image,{x:L,y:H-44-image.height*scale,width:image.width*scale,height:image.height*scale});}
  let cy=44;cy=block(s.businessName||'',324,cy,227,12,bold);
  for(const value of [s.address,s.postalCity,s.country,s.email,s.phone,s.chamberNumber&&'KVK '+s.chamberNumber,s.vatNumber&&'Btw-id '+s.vatNumber].filter(Boolean))cy=block(value,324,cy,227,9,regular,muted);
  let y=Math.max(146,cy+16);rule(y);y+=20;
  const heading=doc.creditOf?'CREDITFACTUUR':'FACTUUR';write(heading,L,y,25,bold,ink);y+=36;
  let customerY=block('FACTUUR AAN',L,y,245,9,bold,gold)+9;
  customerY=block(doc.customer?.name,L,customerY,240,11,bold);customerY=block(doc.customer?.address,L,customerY,240,10);if(doc.customer?.email)customerY=block(doc.customer.email,L,customerY,240,9,regular,muted);
  let infoY=y;const pairs=[['Factuurnummer',doc.invoiceNo],['Factuurdatum',doc.date],['Vervaldatum',doc.dueDate],...(doc.customer?.number?[['Klantnummer',doc.customer.number]]:[]),...(doc.reference?[['Referentie',doc.reference]]:[]),...(doc.period?[['Factuurperiode',doc.period]]:[]),...(doc.creditOf?[['Credit op',doc.creditOf]]:[])];
  for(const [label,value] of pairs){write(label,324,infoY,9,regular,muted);infoY=block(value,419,infoY,132,9,bold)+5;}
  y=Math.max(customerY,infoY)+22;
  y=block('Levering / vooruitbetaling: '+(doc.serviceDate||doc.date)+(doc.serviceExtent?'  |  '+doc.serviceExtent:''),L,y,R-L,9,regular,muted)+12;
  const exclusive=doc.priceMode==='exclusive',exempt=['kor','exempt'].includes(doc.vatStatus),basis=exempt?'vrijgesteld van btw':exclusive?'exclusief btw':'inclusief btw';
  function tableHeader(){if(y>690)newPage();rect(L,y,R-L,30,ink);const white=PDFLib.rgb(1,1,1);write('Aantal',L+8,y+9,9,bold,white);write('Omschrijving',102,y+9,9,bold,white);right('Prijs per stuk',466,y+9,9,bold,white);right('Bedrag',R-8,y+9,9,bold,white);y+=39;}
  function newPage(){d.fresh();write(heading,L,42,16,bold);right(doc.invoiceNo,R,46,10,bold);rule(77);y=95;}
  tableHeader();
  const fallback={quantity:doc.quantity||1,description:doc.description,unitCents:Math.round(doc.grossCents/(doc.quantity||1)),amountCents:doc.grossCents};
  const lines=Array.isArray(doc.lines)&&doc.lines.length?doc.lines:[fallback];
  for(const item of lines){const rows=d.wrap(item.description,275,10);if(rows.length*14+17<=600&&y+rows.length*14+17>750){newPage();tableHeader();}let first=true;while(rows.length){if(y+30>750){newPage();tableHeader();}const available=Math.max(1,Math.floor((750-y-15)/14)),chunk=rows.splice(0,available);if(first){write(new Intl.NumberFormat('nl-NL',{maximumFractionDigits:3}).format(item.quantity),L+8,y,10);right(money(item.unitCents),466,y,10);right(money(item.amountCents),R-8,y,10);}chunk.forEach((row,i)=>write(row,102,y+i*14,10));y+=chunk.length*14+9;rule(y);y+=8;first=false;}}
  const shownDiscount=doc.discountInputCents??doc.discountCents;
  if(shownDiscount){if(y+45>750){newPage();tableHeader();}write('Korting'+(doc.discountMode==='percent'?` (${Number(doc.discountBasisPoints)/100}%)`:''),102,y,10,bold,gold);right('- '+money(Math.abs(shownDiscount)),R-8,y,10,bold,gold);y+=26;rule(y);y+=10;}
  y=block('Regelprijzen '+basis,L,y,R-L,9,regular,muted)+6;
  if(doc.discountNote)y=flow(doc.discountNote,y,9);
  if(y+199>755)newPage();else y+=18;
  const top=y;
  let pay=block(doc.creditOf?'CORRECTIE':'BETALEN',L,top,245,10,bold,gold)+12;
  for(const text of [doc.creditOf?'Deze creditfactuur corrigeert '+doc.creditOf:`Betaaltermijn: ${doc.paymentTermDays} dagen.`,!doc.creditOf&&`Vervaldatum: ${doc.dueDate}`,s.ownerName||s.businessName,s.iban&&'IBAN: '+s.iban,'Betalingskenmerk: '+doc.invoiceNo].filter(Boolean))pay=block(text,L,pay,240,9)+4;
  // Arbitrarily long notes flow after both columns, never underneath the totals.
  let ty=top;
  function totalRow(label,value,strong=false){if(strong)rect(318,ty-6,233,30,ink);write(label,326,ty,strong?11:9,strong?bold:regular,strong?PDFLib.rgb(1,1,1):muted);right(money(value),R-8,ty,strong?13:10,strong?bold:regular,strong?PDFLib.rgb(1,1,1):ink);ty+=strong?34:22;}
  totalRow('Subtotaal',doc.subtotalCents??doc.grossCents);totalRow('Korting',-Math.abs(shownDiscount||0));
  if(!exempt){totalRow('Totaal exclusief btw',doc.netCents);totalRow('Btw '+Number(doc.vatBasisPoints)/100+'%',doc.vatCents);}
  totalRow(exempt?'Totaal':'Totaal inclusief btw',doc.totalCents,true);totalRow('Reeds betaald bij uitgifte',doc.paidCents||0);totalRow(doc.creditOf?'Te crediteren':'Openstaand bedrag',doc.outstandingCents??doc.totalCents);
  y=Math.max(pay,ty)+15;
  if(s.note)y=flow(s.note,y,9);
  if(exempt)y=flow(doc.vatStatus==='kor'?'Vrijgesteld van btw wegens toepassing kleineondernemersregeling (KOR).':'Vrijgesteld van btw. Zie de bevestigde grondslag in de factuurtekst.',y,9);
  d.footer(doc.invoiceNo);return d.out.save();
  function flow(value,start,size){const rows=d.wrap(value,R-L,size);y=start;for(const row of rows){if(y>755)newPage();write(row,L,y,size);y+=size+4;}return y;}
 }
 async function report({title,settings,period,sections,createdAt=new Date().toISOString()}){
  const d=await base(title,settings),{write,block,rule,bold,regular,gold,muted}=d;let y;
  function fresh(){d.fresh();write('FitMetZorge',L,38,12,bold,gold);y=block(title,L,62,R-L,23,bold)+10;y=block(`Periode: ${period.from} t/m ${period.to} | Aangemaakt: ${createdAt}`,L,y,R-L,9,regular,muted)+12;rule(y);y+=18;}
  fresh();
  for(const section of sections){if(y>690)fresh();write(section.title,L,y,14,bold);y+=25;for(const row of section.rows){const text=Array.isArray(row)?row.join('  |  '):String(row);for(const line of d.wrap(text,R-L-4,10)){if(y>753)fresh();write(line,L,y,10);y+=15;}y+=8;}y+=17;}
  if(y>713)fresh();block('Controle- en overdrachtsdocument. Geen automatische btw-aangifte. Controleer de aansluiting en brongegevens vóór aangifte.',L,y,R-L,9,regular,muted);d.footer();return d.out.save();
 }
 let renderer;
 async function renderPDF(bytes,element,isCurrent=()=>true){renderer ||= import('./vendor/pdfjs-6.3.289/pdf.mjs');const lib=await renderer;lib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs-6.3.289/pdf.worker.mjs',location.href).href;const task=lib.getDocument({data:new Uint8Array(bytes),useSystemFonts:true});try{const doc=await task.promise,fragment=document.createDocumentFragment();for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),viewport=page.getViewport({scale:1.4}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('aria-label',`A4-pagina ${i} van ${doc.numPages}`);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;fragment.append(canvas);}if(element.isConnected&&isCurrent())element.replaceChildren(fragment);}finally{await task.destroy();}}
 return {pdf,report,renderPDF};
})();

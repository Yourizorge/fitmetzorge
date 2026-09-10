/* One invoice system: owner ledger owns drafts, numbering and immutable PDFs. */
window.FMZInvoices=(()=>{
const money=n=>FMZAccountingModel.money(n);
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
    const image=String(doc.logo || '').startsWith('data:image/jpeg')?await out.embedJpg(doc.logo):await out.embedPng(doc.logo);
    const scale=Math.min(150/image.width,68/image.height);page.drawImage(image,{x:50,y:y-image.height*scale,width:image.width*scale,height:image.height*scale});
    page.drawText(doc.creditOf?'CREDITFACTUUR':'FACTUUR',{x:300,y:y-15,size:22,font:bold,color:gold});y-=85;
    text(doc.settings.businessName || 'Fit Met Zorge',{font:bold,size:14});
    for(const value of [doc.settings.ownerName,doc.settings.email,doc.settings.phone,[doc.settings.address,doc.settings.postalCity,doc.settings.country].filter(Boolean).join(', '),doc.settings.vatNumber&&'BTW '+doc.settings.vatNumber,doc.settings.chamberNumber&&'KvK '+doc.settings.chamberNumber,doc.settings.iban&&'IBAN '+doc.settings.iban].filter(Boolean))text(value,{size:10});
    y-=12;text('Factuur aan',{font:bold});text(doc.customer.name);if(doc.customer.email)text(doc.customer.email);if(doc.customer.address)text(doc.customer.address);
    y-=12;text('Factuurnummer: '+doc.invoiceNo,{font:bold});text('Factuurdatum: '+doc.date+'   |   Vervaldatum: '+doc.dueDate);text('Betaaltermijn: '+doc.paymentTermDays+' dagen');if(doc.creditOf)text('Credit op factuur: '+doc.creditOf);if(doc.serviceDate)text('Levering / vooruitbetaling: '+doc.serviceDate);if(doc.serviceExtent)text('Omvang: '+doc.serviceExtent+' | Hoeveelheid: '+doc.quantity);y-=14;
    text('OMSCHRIJVING',{font:bold,color:gold});text(doc.description);if(doc.discountNote){y-=5;text('Toelichting korting: '+doc.discountNote);}y-=16;
    row(doc.vatStatus==='kor'||doc.vatStatus==='exempt'?'Oorspronkelijk bedrag':'Oorspronkelijk bedrag incl. btw',money(doc.grossCents));row('Korting', '- '+money(doc.discountCents));if(doc.vatStatus==='kor'||doc.vatStatus==='exempt'){text(doc.vatStatus==='kor'?'Vrijgesteld van btw wegens toepassing kleineondernemersregeling (KOR).':'Vrijgesteld van btw; zie bevestigde grondslag in factuurtekst.',{size:10});}else{row('Bedrag excl. btw',money(doc.netCents));row('Btw '+(doc.vatBasisPoints/100)+'%',money(doc.vatCents));}row(doc.creditOf?'Te crediteren':'Te betalen',money(doc.totalCents),true);
    if(doc.settings.note){y-=8;text(doc.settings.note,{size:10});}
    out.getPages().forEach((p,i)=>p.drawText(`${doc.invoiceNo}  |  ${i+1} / ${out.getPageCount()}`,{x:50,y:30,size:9,font:regular,color:ink}));
    return out.save();
  }
  return {pdf,cents:(...a)=>FMZAccountingModel.cents(...a),open:id=>FMZAccounting.openInvoice(id),create:packageOnly=>FMZAccounting.newInvoice(packageOnly),save:button=>FMZAccounting.saveInvoice(button),download:id=>FMZAccounting.downloadInvoice(id),lock:()=>FMZAccounting.lock(),card:item=>FMZAccounting.legacyCard(item)};
})();

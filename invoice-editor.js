/* Draft values stay raw until validation; display and server independently calculate integer cents. */
window.FMZInvoiceEditor=(()=>{
 const M=FMZAccountingModel;
 function normalize(v){if(v.unitPrice!==undefined)return v;return {...v,unitPrice:v.amount??'',quantity:'1',priceMode:'inclusive',discountMode:'fixed',discountPercent:'0',extraLines:[]};}
 function read(form){const v=Object.fromEntries(new FormData(form));v.extraLines=[...form.querySelectorAll('[data-invoice-line]')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-line-field]')].map(e=>[e.dataset.lineField,e.value])));return v;}
 function body(raw,creditOf=null){const v=normalize(raw),line=(description,quantity,unitPrice)=>({description,quantity_milli:M.quantity(quantity),unit_cents:M.cents(unitPrice)});
  const lines=[line(v.description,v.quantity,v.unitPrice),...(v.extraLines||[]).map(x=>line(x.description,x.quantity,x.unitPrice))];
  return {lines,price_mode:v.priceMode||'inclusive',discount_mode:v.discountMode||'fixed',discount_input_cents:M.cents(v.discount??'0'),discount_bp:M.cents(v.discountPercent??'0'),period:v.period||'',reference:v.reference||''};
 }
 function document(body,settings,logo,original=null,credited=0){
  const rate=['kor','exempt'].includes(settings.vat_status)?0:Number(settings.vat_basis_points??0),amounts=M.invoiceTotals(body,rate),credit=!!original;
  if(credit){const n=amounts.totalCents;amounts.netCents=Math.round((credited+n)*10000/(10000+rate))-Math.round(credited*10000/(10000+rate));amounts.vatCents=n-amounts.netCents;for(const k of ['subtotalCents','grossCents','discountCents','netCents','vatCents','totalCents'])amounts[k]*=-1;amounts.lines=amounts.lines.map(l=>({...l,unitCents:-l.unitCents,amountCents:-l.amountCents}));}
  const due=new Date(body.date+'T12:00:00Z');due.setUTCDate(due.getUTCDate()+body.term_days);
  return {...amounts,layoutVersion:3,invoiceNo:'CONCEPT',settings,customer:body.customer,description:body.description,discountNote:body.discountNote,discountMode:body.discount_mode,discountBasisPoints:body.discount_bp,priceMode:body.price_mode,date:body.date,dueDate:due.toISOString().slice(0,10),paymentTermDays:body.term_days,serviceDate:body.service_date,serviceExtent:body.service_extent,quantity:body.quantity,period:body.period,reference:body.reference,vatStatus:settings.vat_status,vatMethod:settings.vat_method,vatBasisPoints:rate,creditOf:original?.invoiceNo,logo,paidCents:0,outstandingCents:amounts.totalCents};
 }
 return {normalize,read,body,document};
})();

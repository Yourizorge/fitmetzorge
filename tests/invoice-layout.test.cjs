const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),PDFLib=require('pdf-lib'),M=require('../accounting-model.js');
const {cases,documents}=require('./invoice-layout-fixtures.cjs');
test('invoice layout preserves immutable cents and produces complete A4 variants',async()=>{
 const folder='tests/artifacts/invoice-layout';fs.mkdirSync(folder,{recursive:true});const expected={};
 for(const [name,doc] of Object.entries(cases)){
  const before=JSON.stringify(doc),rows=documents.invoiceRows(doc);
  assert.equal(rows.reduce((n,r)=>n+r.netCents,0),doc.netCents,name+' net rows');
  assert.equal(rows.reduce((n,r)=>n+r.vatCents,0),doc.vatCents,name+' VAT rows');
  const bytes=await documents.pdf(doc),pdf=await PDFLib.PDFDocument.load(bytes);
  assert.equal(JSON.stringify(doc),before,'Rendering must never mutate archived data');
  assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');
  for(const page of pdf.getPages()){assert.equal(page.getWidth(),595.28);assert.equal(page.getHeight(),841.89);}
  if(['progressie','twee-regels','btw-9','btw-0','optioneel-leeg','credit'].includes(name))assert.equal(pdf.getPageCount(),1,name+' on one A4');
  if(name==='lange-omschrijving')assert(pdf.getPageCount()>1);
  fs.writeFileSync(folder+'/'+name+'.pdf',bytes);expected[name]={pages:pdf.getPageCount(),total:M.money(doc.totalCents).replace(/\u00a0/g,' '),net:M.money(doc.netCents).replace(/\u00a0/g,' '),vat:M.money(doc.vatCents).replace(/\u00a0/g,' '),number:doc.invoiceNo};
 }
 fs.writeFileSync(folder+'/expected.json',JSON.stringify(expected,null,2));
 // Fractional lines and fixed/percentage discounts must reconcile after rounding.
 for(const rate of [0,900,2100])for(const mode of ['inclusive','exclusive'])for(const discount of ['fixed','percent'])for(let n=1;n<=24;n++){
  const amounts=M.invoiceTotals({lines:[{description:'A',quantity_milli:1250,unit_cents:n},{description:'B',quantity_milli:3000,unit_cents:n+3}],price_mode:mode,discount_mode:discount,discount_input_cents:1,discount_bp:3333},rate),doc={...amounts,vatBasisPoints:rate,priceMode:mode},rows=documents.invoiceRows(doc);
  assert.equal(rows.reduce((n,r)=>n+r.netCents,0),doc.netCents);assert.equal(rows.reduce((n,r)=>n+r.vatCents,0),doc.vatCents);
 }
});

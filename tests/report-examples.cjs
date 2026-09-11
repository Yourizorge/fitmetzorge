/* Creates PDF examples only from the synthetic export produced by accounting-ui.test. */
const fs=require('node:fs'),assert=require('node:assert/strict'),PDFLib=require('pdf-lib'),M=require('../accounting-model.js');
(async()=>{const s=JSON.parse(fs.readFileSync('tests/artifacts/accounting-export-snapshot.json'));
 for(const r of s.records){if(r.kind==='settings'&&r.status==='confirmed')assert(r.data.businessName.startsWith('Synthetic'));if(r.kind==='invoice'&&r.data.document)assert(r.data.document.customer.name.startsWith('Synthetic'));if(r.kind==='expense')assert(r.data.supplier.startsWith('Synthetic'));}
 const window={};for(const file of ['invoice-documents.js','accounting-reports.js'])new Function('window','PDFLib','FMZAccountingModel',fs.readFileSync(file,'utf8'))(window,PDFLib,M);
 for(const type of ['all','vat','sales','expenses']){const model=window.FMZAccountingReports.build(s,{from:'2026-09-01',to:'2026-09-30'},type),bytes=await window.FMZDocuments.report(model);assert((await PDFLib.PDFDocument.load(bytes)).getPageCount()>0);fs.writeFileSync('tests/artifacts/hotfix-example-report-'+type+'.pdf',bytes);}
 console.log('Created four readable PDFs from verified synthetic accounting export.');
})().catch(e=>{console.error(e.message);process.exitCode=1});

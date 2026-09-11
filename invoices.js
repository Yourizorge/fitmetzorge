/* One invoice system: the owner ledger owns drafts, numbering and immutable PDF bytes. */
window.FMZInvoices={
 pdf:doc=>FMZDocuments.pdf(doc),
 report:doc=>FMZDocuments.report(doc),
 renderPDF:(...args)=>FMZDocuments.renderPDF(...args),
 cents:(...args)=>FMZAccountingModel.cents(...args),
 open:id=>FMZAccounting.openInvoice(id),
 create:packageOnly=>FMZAccounting.newInvoice(packageOnly),
 save:button=>FMZAccounting.saveInvoice(button),
 download:id=>FMZAccounting.downloadInvoice(id),
 lock:()=>FMZAccounting.lock(),
 card:item=>FMZAccounting.legacyCard(item)
};

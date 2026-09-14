/* Fixed synthetic documents only. No network, accounts, invoice issuing or storage. */
const fs=require('node:fs'),PDFLib=require('pdf-lib'),M=require('../accounting-model.js');
const window={};
for(const name of ['invoice-editor.js','invoice-documents.js'])new Function('window','PDFLib','FMZAccountingModel',fs.readFileSync(name,'utf8'))(window,PDFLib,M);
const settings={businessName:'FitMetZorge — synthetisch voorbeeld',ownerName:'Synthetische rekeninghouder',address:'Voorbeeldstraat 1',postalCity:'1000 AA Teststad',country:'Nederland',email:'synthetic@example.test',phone:'0000000000',website:'example.test',chamberNumber:'00000000',vatNumber:'NL000000000B00',iban:'TEST-IBAN',vat_status:'standard',vat_basis_points:2100};
const logo='data:image/png;base64,'+fs.readFileSync('fit-met-zorge-logo.png').toString('base64');
const body={date:'2026-09-13',term_days:14,customer:{name:'Voorbeeldlid — synthetisch',address:'Voorbeeldstraat 2',postalCity:'1000 AB Teststad',country:'Nederland',number:'TEST-001'},description:'Personal coaching – Progressie',lines:[{description:'Acht persoonlijke trainingen',quantity_milli:8000,unit_cents:4750}],price_mode:'inclusive',discount_mode:'fixed',discount_input_cents:3000,discountNote:'Synthetische korting',period:'September 2026',reference:'Synthetische controle'};
const make=(change={},s={})=>({...window.FMZInvoiceEditor.document({...body,...change},{...settings,...s},logo),invoiceNo:'SYNTHETISCH-2026-0001'});
const creditBody={...body,description:'Gedeeltelijke credit',discount_input_cents:0,lines:[{description:'Correctie eerder gefactureerde training',quantity_milli:1000,unit_cents:101}]};
const cases={
 progressie:make(),
 'twee-regels':make({lines:[...body.lines,{description:'Aanvullende persoonlijke begeleiding met extra uitleg',quantity_milli:1000,unit_cents:2000}]}),
 'btw-9':make({}, {vat_basis_points:900}),
 'btw-0':make({}, {vat_basis_points:0}),
 'kor':make({}, {vat_status:'kor',vat_basis_points:0}),
 'exclusief':make({price_mode:'exclusive',discount_mode:'percent',discount_bp:1000}),
 'optioneel-leeg':make({customer:{name:'Voorbeeldlid',address:'Teststraat 2'},reference:'',period:''},{ownerName:'',phone:'',website:'',chamberNumber:'',vatNumber:'',iban:'',country:''}),
 'lange-klant':make({customer:{name:'Synthetische Stichting voor Sportieve Persoonlijke Ontwikkeling en Langdurige Begeleiding',address:'Voorbeeldstraat met een lange synthetische straatnaam 123 A\nGebouw voor individuele persoonlijke begeleiding, tweede verdieping',postalCity:'1000 AA Synthetische Voorbeeldgemeente',country:'Nederland',vatNumber:'NL000000000B00',number:'SYNTHESTISCH-KLANTNUMMER-123456789'}}),
 'lange-omschrijving':make({description:'Persoonlijke begeleiding',lines:[{description:Array.from({length:50},(_,i)=>'DEEL-'+String(i+1).padStart(3,'0')+' Begeleiding met een afzonderlijke toelichting.').join(' '),quantity_milli:1000,unit_cents:38000}]}),
 'credit':{...window.FMZInvoiceEditor.document(creditBody,settings,logo,{invoiceNo:'SYNTHETISCH-ORIGINEEL'},1),invoiceNo:'SYNTHETISCH-CREDIT-0001'},
 'deelbetaling':{...make(),paidCents:10000,outstandingCents:25000},
 'groot-bedrag':make({description:'Synthetische grenscontrole',lines:[{description:'Grote waarde voor kolombreedtecontrole',quantity_milli:1000,unit_cents:900000000000}],discount_input_cents:0})
};
module.exports={cases,documents:window.FMZDocuments};

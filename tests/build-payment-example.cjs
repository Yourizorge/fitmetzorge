const fs=require('node:fs');
(async()=>{const f=await require('./payments-fixture.cjs').setup();try{const inv=await f.invoice(),s=await f.snapshot();delete s.audit;delete s.receipts;s.files=[];s.organization={name:'Afgeschermde oefenadministratie'};
 const i=s.records.find(r=>r.id===inv.id);i.number='OEFEN-2026-001';i.data.document.invoiceNo=i.number;i.data.document.settings.note='OEFENFACTUUR — NIET GELDIG. Niets betalen.';
 // Stable fixture identifiers; generated solely from the local synthetic database.
 let json=JSON.stringify(s,null,1),ids=[...new Set(json.match(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/g)||[])];ids.forEach((id,n)=>json=json.replaceAll(id,'OEF-'+String(n+1).padStart(3,'0')));json=json.replace(/2026-10-15T[^" ]+/g,'2026-10-15T12:00:00+00:00');
 fs.writeFileSync('tutorial/payment-example.js',`/* Fixed synthetic example; no production data. */\n(function(r){const s=${json};if(typeof module!=='undefined')module.exports=s;else r.FMZPaymentExample=s;})(typeof window==='undefined'?globalThis:window);\n`);
 }finally{await f.db.close();}})().catch(e=>{console.error(e);process.exitCode=1});

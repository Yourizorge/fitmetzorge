const {randomUUID}=require('node:crypto'),P=require('../payments-model.js');
async function provision(database){
 const h=await require('./payments-fixture.cjs').provision(database);
 async function invoice(cents,name='Noor Voorbeeld',date='2026-10-01',extra={}){
  const id=randomUUID(),draft=await h.cmd('draft',{id,version:0,data:{date,description:'Synthetisch pakket',gross_cents:cents,discount_cents:0,customer:{name,address:'Oefenlaan 2',postalCity:'1000 AA Voorbeeldstad',country:'Nederland'},service_date:date,service_extent:'Synthetische trainingen',quantity:1,term_days:14,...extra}});
  return h.cmd('final_invoice',{id,version:draft.version});
 }
 async function pay(inv,cents,date){return h.pay('register',{id:randomUUID(),...P.prepare(await h.snapshot(),inv.id,{amount:String(cents/100),date,account_id:h.bank.id})});}
 const before=await invoice(15000,'Fenna Voorbeeld'),after=await invoice(33250,'Noor Voorbeeld');
 await pay(before,15000,'2026-10-10');await pay(after,33250,'2026-11-10');
 return {...h,invoice,payInvoice:pay,before,after};
}
module.exports={provision};

const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),A=require('../accounting-model.js'),F=require('../finance-model.js'),P=require('../payments-model.js');
test('current invoice cohort: October payments before/after month end, partial, overdue, credit and correction remain ledger-derived',async()=>{
 const db=await require('./database.cjs').setup();await require('./accounting-database.cjs').extend(db);
 try{
  const h=await require('./current-balances-fixture.cjs').provision(db),span={from:'2026-10-01',to:'2026-10-31'},view=async()=>F.dashboard(await h.snapshot(),span,'2026-11-11');
  let s=await h.snapshot(),d=await view();assert.equal(d.outstanding,0);assert.equal(d.overdue,0);assert.equal(d.open.length,0);assert.equal(d.paid.length,2);assert.equal(d.received,48250);assert.equal(d.incoming,15000);
  assert.equal(A.project(s,span.from,span.to).invoices.find(i=>i.id===h.after.id).outstanding,33250,'historical accounting report remains historical');
  const partial=await h.invoice(35000,'Mila Voorbeeld'),late=await h.invoice(20000,'Sam Voorbeeld');await h.payInvoice(partial,20000,'2026-11-10');
  d=await view();assert.equal(d.outstanding,35000);assert.equal(d.overdue,35000);assert.equal(d.partial.length,1);assert.deepEqual(new Set(d.open.map(r=>r.id)),new Set([partial.id,late.id]));assert.equal(d.open.reduce((n,r)=>n+r.outstanding,0),d.outstanding);assert.equal(d.late.reduce((n,r)=>n+r.outstanding,0),d.overdue);
  await h.invoice(5000,'Mila Voorbeeld','2026-11-11',{credit_of:partial.id,description:'Synthetische deelcredit'});d=await view();assert.equal(d.open.find(r=>r.id===partial.id).outstanding,10000);assert.equal(d.outstanding,30000);
  const cancelled=await h.invoice(9000,'Isa Voorbeeld');await h.cmd('invoice_cancel',{id:cancelled.id,version:cancelled.version,data:{reason:'Synthetische ongewenste factuur',unpaid_unsent_confirmed:true}});d=await view();assert.equal(d.invoices.find(r=>r.id===cancelled.id).cancelled,true);assert.equal(d.outstanding,30000);
  s=await h.snapshot();const payment=P.payments(s,h.after.id)[0];await h.pay('correct',{id:randomUUID(),version:payment.version,expected:P.revision(s,h.after.id),data:{payment_id:payment.id,reason:'Synthetische verkeerde ontvangst'}});
  d=await view();assert.equal(d.open.find(r=>r.id===h.after.id).outstanding,33250);assert.equal(d.overdue,63250);
  const prior=JSON.stringify(await h.snapshot());F.dashboard(await h.snapshot(),span,'2026-11-11');assert.equal(JSON.stringify(await h.snapshot()),prior,'projection makes no financial changes');
 }finally{await db.db.close();}
});

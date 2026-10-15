const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const A=require('../accounting-model.js'),P=require('../payments-model.js');
async function setup(){const d=await require('./payments-fixture.cjs').setup();return{...d,
 preview:async(action,data,role='trainer')=>(await d.as(role,'select public.fmz_bank_repair_preview($1,$2) result',[action,JSON.stringify(data)])).rows[0].result,
 repair:async(action,payload,request=randomUUID(),role='trainer')=>(await d.as(role,'select public.fmz_bank_repair_command($1,$2,$3) result',[action,JSON.stringify(payload),request])).rows[0].result};}
const reason='Foutieve synthetische invoer gecontroleerd';
async function proposal(d,action,record_id,extra={}){const data={record_id,reason,...extra},expected=await d.preview(action,data);return{id:randomUUID(),confirmed:true,data,expected};}
test('preview is read-only; two paid invoices on one manually entered receipt can be reversed atomically without changing invoices or revenue',async()=>{
 const d=await setup();try{const i1=await d.invoice(19000,0),i2=await d.invoice(20000,0),b=await d.cmd('bank',{data:{account_id:d.bank.id,date:'2026-09-15',cents:39000,description:'Twee fictieve facturen'}});
 for(const [i,cents]of [[i1,19000],[i2,20000]])await d.cmd('allocate',{data:{bank_id:b.id,date:b.date,parts:[{type:'invoice',target_id:i.id,cents}]}});
 const before=await d.snapshot(),originals=before.records.filter(r=>r.kind==='invoice'),plan=await proposal(d,'reverse_bank',b.id);assert.deepEqual(await d.snapshot(),before);assert.equal(plan.expected.invoices.length,2);assert.equal(plan.expected.delta_cents,-39000);assert.equal(plan.expected.after_cents,0);
 const request=randomUUID(),result=await d.repair('reverse_bank',plan,request);assert.deepEqual(await d.repair('reverse_bank',plan,request),result);let s=await d.snapshot();assert.equal(s.records.filter(r=>r.kind==='bank').length,1);assert.equal(A.project(s).bank.find(x=>x.id===d.bank.id).cents,0);assert.equal(A.project(s).invoices.find(x=>x.id===i1.id).outstanding,19000);assert.equal(A.project(s).invoices.find(x=>x.id===i2.id).outstanding,20000);assert.deepEqual(s.records.filter(r=>r.kind==='invoice'),originals);assert.equal(A.project(s).revenue,A.project(before).revenue);assert.equal(A.project(s).outputVAT,A.project(before).outputVAT);assert(s.audit.some(a=>a.action==='bank_repair_reverse_bank'));
 await assert.rejects(d.repair('reverse_bank',plan),e=>e.code==='PT409');await assert.rejects(d.repair('reverse_bank',{...plan,confirmed:false},request),e=>e.code==='PT409');assert.deepEqual(await d.snapshot(),s);
 }finally{await d.db.close();}
});
test('unlink leaves real bank receipt, restores exactly affected invoice balances and permits explicit relinking',async()=>{
 const d=await setup();try{const i=await d.invoice(),b=await d.cmd('bank',{data:{account_id:d.bank.id,date:'2026-09-15',cents:35000,description:'Bestaande ontvangst'}}),a=await d.cmd('allocate',{data:{bank_id:b.id,date:b.date,parts:[{type:'invoice',target_id:i.id,cents:35000}]}}),p=await proposal(d,'unlink_allocation',a.id);assert.equal(p.expected.delta_cents,0);await d.repair('unlink_allocation',p);let s=await d.snapshot();assert.equal(A.project(s).balance('1400',b.id),-35000);assert.equal(P.revision(s,i.id).outstanding,35000);assert.equal(A.project(s).bank.find(x=>x.id===d.bank.id).cents,35000);
 await d.pay('register',{id:randomUUID(),...P.prepare(s,i.id,{amount:'350',date:b.date,account_id:d.bank.id,bank_id:b.id})});s=await d.snapshot();assert.equal(P.revision(s,i.id).outstanding,0);assert.equal(s.records.filter(r=>r.kind==='bank').length,1);
 }finally{await d.db.close();}
});
test('opening replacement keeps old journal, supports zero, checks dates, and can itself be corrected once more',async()=>{
 const d=await setup();try{let s=await d.snapshot(),old=s.records.find(r=>r.kind==='opening'&&r.data.account_id===d.bank.id);const p=await proposal(d,'replace_opening',d.bank.id,{new_cents:20,new_date:'2026-01-01'});await d.repair('replace_opening',p);s=await d.snapshot();assert.equal(s.records.find(r=>r.id===old.id).status,'reversed');assert.equal(A.project(s).bank.find(x=>x.id===d.bank.id).cents,20);assert.equal(s.records.find(r=>r.id===d.bank.id).data.opening_cents,20);
 await d.repair('replace_opening',await proposal(d,'replace_opening',d.bank.id,{new_cents:0,new_date:'2026-01-01'}));s=await d.snapshot();assert.equal(A.project(s).bank.find(x=>x.id===d.bank.id).cents,0);await assert.rejects(d.preview('replace_opening',{record_id:d.bank.id,reason,new_cents:0,new_date:'2026-01-01'}),/geen correctie/);
 await d.cmd('bank',{data:{account_id:d.bank.id,date:'2026-09-15',cents:1000,description:'Ontvangst'}});await assert.rejects(d.preview('replace_opening',{record_id:d.bank.id,reason,new_cents:20,new_date:'2026-10-01'}),/na bestaande/);
 }finally{await d.db.close();}
});
test('stale previews, missing explicit confirmation, wrong owner, revoked session and direct private helper calls are denied with complete rollback',async()=>{
 const d=await setup();try{const b=await d.cmd('bank',{data:{account_id:d.bank.id,date:'2026-09-15',cents:-6700,description:'Fictieve uitgave'}}),p=await proposal(d,'reverse_bank',b.id);await assert.rejects(d.repair('reverse_bank',{...p,confirmed:false}),e=>e.code==='22023');await d.cmd('bank',{data:{account_id:d.bank.id,date:'2026-09-16',cents:10,description:'Nieuwe invoer'}});const before=await d.snapshot();await assert.rejects(d.repair('reverse_bank',p),e=>e.code==='PT409');assert.deepEqual(await d.snapshot(),before);
 for(const role of ['a','b']){await assert.rejects(d.preview('reverse_bank',p.data,role),e=>e.code==='42501');await assert.rejects(d.repair('reverse_bank',p,randomUUID(),role),e=>e.code==='42501');}
 await assert.rejects(d.as('trainer','select fmz_accounting.bank_repair_plan($1,$2,$3)',[before.organization.id,'reverse_bank',JSON.stringify(p.data)]),/permission denied/);
 await d.db.query('delete from auth.sessions where user_id=$1',[d.ids.trainer]);await assert.rejects(d.preview('reverse_bank',p.data),e=>e.code==='28000');
 }finally{await d.db.close();}
});
test('closed periods, reconciled accounts, imported evidence, own transfers and mixed splits fail closed',async()=>{
 const d=await setup();try{const b=await d.cmd('bank',{data:{account_id:d.bank.id,date:'2026-09-15',cents:1000,description:'Fictieve ontvangst'}}),p=await proposal(d,'reverse_bank',b.id),period=await d.cmd('close_period',{data:{from:'2026-09-01',to:'2026-09-30',reason}});await assert.rejects(d.repair('reverse_bank',p),e=>e.code==='PT409');await d.cmd('reopen_period',{id:period.id,data:{reason}});
 await d.cmd('reconcile',{data:{account_id:d.bank.id,date:'2026-09-30',closing_cents:1000,description:'Synthetisch afschrift'}});await assert.rejects(d.preview('reverse_bank',p.data),/afgestemd/);
 const imported=await d.cmd('bank',{data:{account_id:d.cash.id,date:'2026-10-01',cents:1000,description:'Synthetisch bankbewijs',import_id:randomUUID()}});await assert.rejects(d.preview('reverse_bank',{record_id:imported.id,reason}),/bankbron/);
 const mixed=await d.cmd('bank',{data:{account_id:d.cash.id,date:'2026-10-02',cents:1000,description:'Privestorting'}});await d.cmd('allocate',{data:{bank_id:mixed.id,date:mixed.date,parts:[{type:'deposit',cents:1000}]}});await assert.rejects(d.preview('reverse_bank',{record_id:mixed.id,reason}),/Andere verdelingen/);
 }finally{await d.db.close();}
});
test('cash VAT reversal follows original receipt date; unallocated outgoing bank correction restores ledger without creating revenue',async()=>{
 const d=await setup();try{const before=await d.snapshot(),b=await d.cmd('bank',{data:{account_id:d.bank.id,date:'2026-09-15',cents:-6700,description:'Onjuist ingevoerde uitgave'}});await d.repair('reverse_bank',await proposal(d,'reverse_bank',b.id));const after=await d.snapshot();assert.equal(A.project(after).balance(d.bank.data.code),A.project(before).balance(d.bank.data.code));assert.equal(A.project(after).revenue,A.project(before).revenue);assert.equal(A.project(after).unallocated.length,0);
 }finally{await d.db.close();}
 const c=await require('./payments-fixture.cjs').setup('cash');try{const d={...c,preview:async(a,p)=>(await c.as('trainer','select public.fmz_bank_repair_preview($1,$2) result',[a,JSON.stringify(p)])).rows[0].result,repair:async(a,p)=>(await c.as('trainer','select public.fmz_bank_repair_command($1,$2,$3) result',[a,JSON.stringify(p),randomUUID()])).rows[0].result};const i=await d.invoice(),b=await d.cmd('bank',{data:{account_id:d.bank.id,date:'2026-09-15',cents:35000,description:'Bestaande ontvangst'}});await d.cmd('allocate',{data:{bank_id:b.id,date:b.date,parts:[{type:'invoice',target_id:i.id,cents:35000}]}});assert.equal(A.project(await d.snapshot()).outputVAT,6074);await d.repair('reverse_bank',await proposal(d,'reverse_bank',b.id));assert.equal(A.project(await d.snapshot()).outputVAT,0);}finally{await c.db.close();}
});

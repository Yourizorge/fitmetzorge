const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),A=require('../accounting-model.js');
async function setup(method='invoice'){
 const h=await require('./payments-fixture.cjs').setup(method);
 h.preview=async(action,data,role='trainer')=>(await h.as(role,'select public.fmz_vat_preview($1,$2) result',[action,JSON.stringify(data)])).rows[0].result;
 h.vat=async(action,payload,request=randomUUID(),role='trainer')=>(await h.as(role,'select public.fmz_vat_command($1,$2,$3) result',[action,JSON.stringify(payload),request])).rows[0].result;
 h.prepare=async(action,data)=>({id:randomUUID(),data,expected:await h.preview(action,data),confirmed:true});
 h.declare=async(from='2026-09-01',to='2026-09-30',declared_cents=6074)=>h.vat('period',await h.prepare('period',{from,to,filed:true,filed_date:'2026-10-01',declared_cents,reviewed:true,reason:'Gecontroleerde synthetische aangifte'}));
 h.settlement=(period,cents=2000,extra={})=>({period_id:period.period_id,direction:'payment',date:'2026-10-02',account_id:h.bank.id,cents,reference:'OEFEN-BTW-2026-Q3',...extra});return h;
}
test('VAT: full/partial payments, retry, no profit/VAT duplication, source trace and preserved invoices',async()=>{const h=await setup();try{
 const invoice=await h.invoice(),s=await h.snapshot(),p=A.project(s),period=await h.declare();assert.equal(p.outputVAT,6074);
 const first=await h.prepare('settle',h.settlement(period));assert.equal(first.expected.bank_delta_cents,-2000);assert.equal(first.expected.after_cents,4074);const id=randomUUID(),saved=await h.vat('settle',first,id);assert.deepEqual(await h.vat('settle',first,id),saved);
 await assert.rejects(h.vat('settle',{...first,id:randomUUID()},randomUUID()),e=>e.code==='PT409');await h.vat('settle',await h.prepare('settle',h.settlement(period,4074,{date:'2026-10-03'})));
 const end=await h.snapshot(),endP=A.project(end);assert.equal(end.records.filter(r=>r.kind==='vat_settlement').length,2);assert.equal(end.records.filter(r=>r.kind==='bank').length,2);assert.equal(endP.balance(h.bank.data.code),-6074);assert.equal(endP.revenue,p.revenue);assert.equal(endP.cost,p.cost);assert.equal(endP.outputVAT,p.outputVAT);assert.deepEqual(end.records.find(r=>r.id===invoice.id),s.records.find(r=>r.id===invoice.id));assert.equal(endP.balance('1850'),6074);
 for(const j of end.journals)assert.equal(end.lines.filter(l=>l.journal_id===j.id).reduce((n,l)=>n+l.cents,0),0);
 }finally{await h.db.close();}});
test('VAT: existing bank, wrong period unlink, relink, refund and immutable correction history',async()=>{const h=await setup();try{
 const p1=await h.declare(),p2=await h.declare('2026-08-01','2026-08-31',-3000),bank=await h.cmd('bank',{data:{account_id:h.bank.id,date:'2026-10-02',cents:3000,description:'Fictieve belastingteruggaaf'}});
 const s=await h.vat('settle',await h.prepare('settle',h.settlement(p2,3000,{bank_id:bank.id,direction:'refund'})));let snap=await h.snapshot();assert.equal(snap.records.filter(r=>r.kind==='bank').length,1);assert.equal(A.project(snap).profit,0);
 await assert.rejects(h.prepare('correct',{settlement_id:s.settlement_id,mode:'reverse',reason:'Onjuiste koppeling aan periode'}));
 const correction=await h.prepare('correct',{settlement_id:s.settlement_id,mode:'unlink',reason:'Teruggaaf hoort bij andere periode'});assert(correction.expected.keeps_bank);await h.vat('correct',correction);snap=await h.snapshot();assert.equal(snap.records.find(r=>r.id===bank.id).status,'posted');assert.equal(A.project(snap).balance('1850'),0);assert.equal(-A.project(snap).balance('1400',bank.id),3000);
 await h.vat('settle',await h.prepare('settle',h.settlement(p1,3000,{bank_id:bank.id,direction:'refund',difference_reason:'Werkelijk ontvangen verrekening gecontroleerd'})));snap=await h.snapshot();assert.equal(snap.records.filter(r=>r.kind==='bank').length,1);assert.equal(snap.records.filter(r=>r.kind==='vat_settlement'&&r.status==='reversed').length,1);assert.equal(A.project(snap).profit,0);
 }finally{await h.db.close();}});
test('VAT: false manual payment reverses exactly; old repair path and duplicate CSV cannot bypass linking',async()=>{const h=await setup();try{
 const p=await h.declare(),s=await h.vat('settle',await h.prepare('settle',h.settlement(p))),before=await h.snapshot();
 const rawPlan=(await h.as('trainer','select public.fmz_bank_repair_preview($1,$2) r',['reverse_bank',JSON.stringify({record_id:s.bank_id,reason:'Verkeerde algemene herstelroute'})])).rows[0].r;
 await assert.rejects(h.as('trainer','select public.fmz_bank_repair_command($1,$2,$3)',['reverse_bank',JSON.stringify({id:randomUUID(),data:{record_id:s.bank_id,reason:'Verkeerde algemene herstelroute'},expected:rawPlan,confirmed:true}),randomUUID()]),e=>e.code==='PT409');assert.deepEqual(await h.snapshot(),before);
 await assert.rejects(h.cmd('bank',{data:{account_id:h.bank.id,date:'2026-10-02',cents:-2000,description:'Duplicaat bankimport'}}),e=>e.code==='PT409');
 await h.vat('correct',await h.prepare('correct',{settlement_id:s.settlement_id,mode:'reverse',reason:'Volledig fictieve dubbele handmatige betaling'}));const snap=await h.snapshot();assert.equal(A.project(snap).balance(h.bank.data.code),0);assert.equal(A.project(snap).balance('1850'),0);assert.equal(snap.records.find(r=>r.id===s.bank_id).status,'reversed');assert.equal(snap.records.find(r=>r.id===s.settlement_id).status,'reversed');
 }finally{await h.db.close();}});
test('VAT: owner/session restrictions, read-only preview, conflicts and rollback',async()=>{const h=await setup();try{
 const p=await h.declare(),body=h.settlement(p),before=await h.snapshot(),prepared=await h.prepare('settle',body);assert.deepEqual(await h.snapshot(),before);
 for(const role of ['a','b'])await assert.rejects(h.preview('settle',body,role),e=>e.code==='42501');
 const policy=(await h.db.query("select relrowsecurity from pg_class where oid='fmz_accounting.records'::regclass")).rows[0];assert(policy.relrowsecurity);
 await h.cmd('bank',{data:{account_id:h.bank.id,date:'2026-10-03',cents:1,description:'Gelijktijdige verandering'}});const changed=await h.snapshot();await assert.rejects(h.vat('settle',prepared),e=>e.code==='PT409');assert.deepEqual(await h.snapshot(),changed);
 await assert.rejects(h.vat('settle',{...await h.prepare('settle',body),confirmed:false}),e=>e.code==='22023');
 await h.db.exec("delete from auth.sessions where user_id='"+h.ids.trainer+"'");await assert.rejects(h.preview('settle',body),e=>['28000','42501'].includes(e.code));
 }finally{await h.db.close();}});
test('VAT: SQL/JS basis parity for cash, corrected receipt, expense and credit',async()=>{const h=await setup('cash');try{
 const invoice=await h.invoice(),P=require('../payments-model.js');let snap=await h.snapshot();await h.pay('register',{id:randomUUID(),...P.prepare(snap,invoice.id,{amount:'200',date:'2026-09-10',account_id:h.bank.id,description:'Deelbetaling'})});snap=await h.snapshot();const payment=P.payments(snap,invoice.id)[0];await h.pay('correct',{id:randomUUID(),version:payment.version,expected:P.revision(snap,invoice.id),data:{payment_id:payment.id,reason:'Fictieve betaling was verkeerd ingevoerd'}});
 await h.pay('register',{id:randomUUID(),...P.prepare(await h.snapshot(),invoice.id,{amount:'350',date:'2026-09-12',account_id:h.bank.id,description:'Volledige betaling'})});
 const plan=await h.preview('period',{from:'2026-09-01',to:'2026-09-30'}),a=A.project(await h.snapshot(),'2026-09-01','2026-09-30');assert.equal(plan.basis.output_cents,a.outputVAT);assert.equal(plan.basis.input_cents,a.inputVAT);assert.equal(plan.basis.net_cents,6074);
 }finally{await h.db.close();}});
test('VAT: declaration difference is explicit; overlapping periods, invalid amounts, future dates and closed dates reject',async()=>{const h=await setup();try{
 await h.invoice();const body={from:'2026-09-01',to:'2026-09-30',filed:true,filed_date:'2026-10-01',declared_cents:6000,reviewed:true};await assert.rejects(h.prepare('period',body),e=>e.code==='22023');const planned=await h.prepare('period',{...body,reason:'Afronding aangegeven bedrag volgens aangifte'});assert.equal(planned.expected.difference_cents,-74);const p=await h.vat('period',planned);assert.equal(A.project(await h.snapshot()).profit,28926);
 await assert.rejects(h.declare('2026-07-01','2026-09-30'),e=>e.code==='PT409');for(const cents of [null,-1,0,1.1])await assert.rejects(h.prepare('settle',h.settlement(p,cents)));await assert.rejects(h.prepare('settle',h.settlement(p,100,{date:'2099-01-01'})));
 await h.cmd('close_period',{data:{from:'2026-10-01',to:'2026-10-31',reason:'Gecontroleerde afgesloten oefenperiode'}});await assert.rejects(h.prepare('settle',h.settlement(p)),e=>e.code==='PT409');
 }finally{await h.db.close();}});

test('VAT: later CSV evidence attaches to the existing outgoing payment without a duplicate or losing the source',async()=>{const h=await setup();try{
 const p=await h.declare(),payment=await h.vat('settle',await h.prepare('settle',h.settlement(p))),snapshot=await h.snapshot(),bank=snapshot.records.find(r=>r.id===payment.bank_id),file=await h.cmd('file_reserve',{id:randomUUID(),data:{original_name:'OEFENBANK-BTW.csv',mime:'text/csv',bytes:10,sha256:'b'.repeat(64),kind:'bank_import'}});
 await h.as('trainer','insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['fmz-finance',file.path,JSON.stringify({size:10})]);await h.cmd('file_finish',{id:file.id});
 const row={bank_id:bank.id,version:bank.version,account_id:h.bank.id,date:bank.date,cents:bank.data.cents,file_id:file.id,source_key:'c'.repeat(64),external_reference:'OEFEN-EXTERNE-REF'},payload=await h.prepare('attach_source',row),request=randomUUID(),result=await h.vat('attach_source',payload,request);assert.deepEqual(await h.vat('attach_source',payload,request),result);
 await h.cmd('import',{data:{date:'2026-10-03',account_id:h.bank.id,file_id:file.id,rows:[row]}});const after=await h.snapshot();assert.equal(after.records.filter(r=>r.kind==='bank').length,1);assert.equal(after.records.find(r=>r.id===bank.id).data.bank_evidence_id,file.id);assert.equal(A.project(after).profit,A.project(snapshot).profit);assert.equal(A.project(after).balance(h.bank.data.code),-2000);
 await assert.rejects(h.prepare('correct',{settlement_id:payment.settlement_id,mode:'reverse',reason:'Een echte CSV-bron moet behouden blijven'}),e=>e.code==='22023');await h.vat('correct',await h.prepare('correct',{settlement_id:payment.settlement_id,mode:'unlink',reason:'Alleen de verkeerde periodekoppeling herstellen'}));assert.equal((await h.snapshot()).records.find(r=>r.id===bank.id).status,'posted');
 }finally{await h.db.close();}});

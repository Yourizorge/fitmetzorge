const test=require('node:test'),assert=require('node:assert/strict'),M=require('../accounting-model.js');
test('CSV mapping, signed integer cents, overlaps, ambiguous duplicates, periods and safe exports',async()=>{
 assert.equal(M.cents('0,20'),20);assert.equal(M.cents('1.234,56'),123456);assert.equal(M.cents('-20,01',true),-2001);
 for(const value of ['',null,'abc','1,234','-1','NaN'])assert.throws(()=>M.cents(value));
 const rows=M.csv('\uFEFF"Datum";"Naam / Omschrijving";"Rekening";"Tegenrekening";"Af Bij";"Bedrag (EUR)";"Mededelingen"\r\n"20260910";"Bankkosten";"TEST";"BANK";"Af";"0,20";"Regel 1\nRegel ""2"""\r\n"20260910";"Bankkosten";"TEST";"BANK";"Af";"0,20";"Regel 1\nRegel ""2"""');
 const a={id:'bank',data:{iban:'TEST'}},parsed=await M.importRows(rows,M.mapping(rows[0]),a);assert.equal(parsed[0].cents,-20);assert.equal(parsed[0].selected,true);assert.equal(parsed[1].ambiguous,true);assert.equal(parsed[1].selected,false);
 const repeat=await M.importRows(rows,M.mapping(rows[0]),a,[{source_key:parsed[0].source_key}]);assert(repeat.every(r=>!r.selected));assert.equal(repeat[0].duplicate,true);
 assert.equal((await M.importRows(rows,M.mapping(rows[0]),{...a,data:{iban:'OTHER'}}))[0].error,'CSV-rekening wijkt af van gekozen rekening');
 assert.deepEqual(M.period('quarter','2026-Q3'),{from:'2026-07-01',to:'2026-09-30'});assert.deepEqual(M.period('month','2028-02'),{from:'2028-02-01',to:'2028-02-29'});
 assert.throws(()=>M.date('2026-02-30'));assert.equal(M.date('10-09-2026'),'2026-09-10');assert.match(M.csvOut([['=HYPERLINK("x")',20]]),/'=HYPERLINK/);
});
test('cash VAT uses bank receipt dates and cumulative cent rounding, excludes deposits',()=>{
 const inv={id:'i',kind:'invoice',status:'posted',date:'2026-01-01',number:'F1',data:{document:{totalCents:35000,vatCents:6074,vatMethod:'cash'}}};
 const s={organization:{legacy_reviewed:true},accounts:[],lines:[],journals:[],files:[{record_id:'i',kind:'invoice_pdf',status:'ready'}],records:[{id:'s',kind:'settings',status:'confirmed',date:'2026-01-01',data:{confirmed:true}},inv]};
 for(const [id,date,cents] of [['b1','2026-01-10',10000],['b2','2026-02-10',25000],['b3','2026-03-10',-5000]]){
  s.records.push({id,kind:'bank',date,data:{cents}},{id:'a'+id,kind:'allocation',date:'2026-03-20',created_at:date,data:{bank_id:id,parts:[{type:'invoice',target_id:'i',cents:Math.abs(cents)}]}});
 }
 assert.equal(M.project(s,'2026-01-01','2026-01-31').outputVAT,1735);assert.equal(M.project(s,'2026-02-01','2026-02-28').outputVAT,4339);assert.equal(M.project(s,'2026-03-01','2026-03-31').outputVAT,-868);assert.equal(M.project(s).outputVAT,5206);
});

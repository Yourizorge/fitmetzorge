const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),F=require('./members-fixture.cjs'),M=require('../members-model.js');
const personal=()=>Object.fromEntries(Object.entries(F.person()).filter(([key])=>!['email','startDate'].includes(key)));
test('member profile validation and exact first-period/discount model',()=>{
 for(const [key,value] of [['street',''],['houseNumber',''],['postalCode',''],['city',''],['country',''],['birthDate','2030-01-01'],['birthDate','2026-02-30'],['emergencyPhone','123']])assert.ok(M.validateProfile({...personal(),[key]:value},'2026-10-26')[key],key);
 assert.equal(M.cents('30,01'),3001);assert.equal(M.cents(''),null);assert.equal(M.cents('1.999'),null);
 const result=M.payment({cents:38000,cycle:'four_weeks'},'2026-10-26',{discountAmount:'30,01',discountPeriods:'2',discountReason:'Synthetische kennismakingskorting',firstPeriodCustom:true,firstPeriodEnd:'2026-11-08',firstPeriodAmount:'190,01',firstPeriodReason:'14 van 28 dagen, expliciet afgesproken €190,01'});
 assert.deepEqual(result.errors,{});assert.equal(result.value.firstPeriodNetCents,16000);assert.equal(result.value.regularCents,34999);assert.equal(result.value.nextPeriodStart,'2026-11-09');
 assert.ok(M.payment({cents:20000,cycle:'four_weeks'},'2026-10-26',{discountAmount:'201',discountPeriods:'1',discountReason:'Test'}).errors.discountAmount);
 assert.ok(M.payment({cents:20000,cycle:'calendar_month'},'2026-11-01',{firstPeriodCustom:true,firstPeriodEnd:'2026-11-14',firstPeriodAmount:'100',firstPeriodReason:'Test'}).errors.firstPeriodEnd);
});
test('profile server validation blocks incomplete/invalid changes and preserves existing bytes',async()=>{const f=await F.setup();try{
 const before=JSON.stringify(await f.read('trainer')),old=(await f.members('profile',{client_id:'a'})).member;
 for(const [key,value] of [['street',''],['houseNumber',''],['postalCode',''],['city',''],['country',''],['birthDate','2030-01-01'],['birthDate','2026-02-30'],['emergencyPhone','abc']])await assert.rejects(f.command('edit_profile',{client_id:'a',expected_version:old.version,personal:{...personal(),[key]:value}}),/profielveld|Geboortedatum|geboortedatum|noodcontactnummer/i,key);
 assert.equal(JSON.stringify(await f.read('trainer')),before);
 await f.command('edit_profile',{client_id:'a',expected_version:old.version,personal:personal()});assert.equal((await f.members('profile',{client_id:'a'})).personal.city,'Teststad');
}finally{await f.db.close();}});
test('server payment snapshot agrees on exact cents and rejects malformed totals',async()=>{const f=await F.setup();try{
 await F.legal(f);let draft=await F.draft(f);const payment={discountAmount:'30,01',discountPeriods:'2',discountReason:'Synthetische korting',firstPeriodCustom:true,firstPeriodEnd:M.add(F.today(),13),firstPeriodAmount:'190,01',firstPeriodReason:'14 dagen, afgesproken bedrag'};
 draft=await f.command('save_draft',{id:draft.id,expected_version:draft.version,catalog_id:draft.catalog_id,data:{...draft.data,payment}});draft=await f.command('review',{id:draft.id,expected_version:draft.version,signature:F.signature,signer:'Fictieve van Test',confirmed:true});
 assert.deepEqual(draft.snapshot.payment,M.payment(draft.snapshot.package,F.today(),payment).value);
 for(const input of [{discountAmount:''},{discountAmount:'-1'},{discountAmount:'381',discountPeriods:'1',discountReason:'Test'},{discountAmount:'1',discountPeriods:'0',discountReason:'Test'},{firstPeriodCustom:true,firstPeriodEnd:F.today(),firstPeriodAmount:'',firstPeriodReason:'Test'}])await assert.rejects(f.db.query('select fmz_members.payment_snapshot($1,$2,$3)',[JSON.stringify(draft.snapshot.package),F.today(),JSON.stringify(input)]));
}finally{await f.db.close();}});

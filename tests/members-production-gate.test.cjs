const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),F=require('./members-fixture.cjs');
test('production enrollment gate: explicit closure survives active synthetic terms; profile/drafts remain authorized; private bypass denied',async()=>{const f=await F.setup();try{
 await f.db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261104163836_appfmz_central_billing_opt_in.sql'),'utf8'));
 await f.db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261104164206_appfmz_member_release_gate.sql'),'utf8'));
 const baseline=await f.db.query("select (select count(*) from fmz_accounting.records) records,(select count(*) from fmz_accounting.agreement_versions) agreements,(select count(*) from fmz_members.contracts) contracts,(select count(*) from auth.users) users");
 await F.legal(f);const b=await f.members('bootstrap');assert.equal(b.enrollment_available,false);assert.equal(b.terms,null);assert.ok(b.catalog.length>0);
 const draft=await F.draft(f);assert.equal(draft.status,'draft');
 for(const action of ['review','reserve_agreement','finalize'])await assert.rejects(f.command(action,{id:draft.id,expected_version:draft.version,confirmed:true,signer:'Fictieve Test',signature:F.signature}),e=>e.code==='42501'&&/privacygoedkeuring/.test(e.message));
 await assert.rejects(f.as('trainer',"select fmz_members.command_before_release_gate('review',$1,$2)",[JSON.stringify({id:draft.id}),require('crypto').randomUUID()]),e=>e.code==='42501');
 await assert.rejects(f.as('trainer',"update fmz_members.release_control set enrollment_enabled=true"),e=>e.code==='42501');
 await assert.rejects(f.members('search',{query:'a'},'a'),e=>e.code==='42501');
 const after=await f.db.query("select (select count(*) from fmz_accounting.agreement_versions) agreements,(select count(*) from fmz_members.contracts) contracts,(select count(*) from auth.users) users");
 for(const key of ['agreements','contracts','users'])assert.equal(after.rows[0][key],baseline.rows[0][key]);
 const policies=await f.db.query("select cmd from pg_policies where schemaname='storage' and policyname like 'fmz_members_%'");assert.ok(policies.rows.length>0);assert.ok(policies.rows.every(p=>['SELECT','INSERT'].includes(p.cmd)));
 }finally{await f.db.close();}});

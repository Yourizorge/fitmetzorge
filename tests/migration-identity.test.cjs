const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const proof=require('../docs/APPFMZ_MIGRATION_IDENTITY_20260913.json');

test('six reconciled migrations retain their approved SQL and unique production identity',()=>{
 const directory=path.join(__dirname,'../supabase/migrations');
 const files=fs.readdirSync(directory).filter(file=>file.endsWith('.sql'));
 const seen=new Set();
 for(const mapping of proof.mappings){
  assert.equal(mapping.sqlIdentity,'PASS');
  assert.equal(seen.has(mapping.productionVersion),false,'duplicate production version');
  seen.add(mapping.productionVersion);
  assert.equal(mapping.canonicalFile,`${mapping.productionVersion}_${mapping.name}.sql`);
  assert.deepEqual(files.filter(file=>file.endsWith(`_${mapping.name}.sql`)),[mapping.canonicalFile]);
  assert.equal(files.includes(mapping.oldFile),false,'obsolete local timestamp must not return');
  const sql=fs.readFileSync(path.join(directory,mapping.canonicalFile),'utf8').replace(/\r\n/g,'\n');
  assert.equal(crypto.createHash('sha256').update(sql).digest('hex'),mapping.hash,'approved Git SQL changed');
  assert.equal(crypto.createHash('sha256').update(sql.trim()).digest('hex'),mapping.normalizedHash,'SQL differs from recorded production migration');
 }
 assert.equal(seen.size,6);
});

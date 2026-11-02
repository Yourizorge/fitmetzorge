/* Read-only source/data inventory. Never serialize customer rows into repository evidence. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const dir='docs/examples/members-20261026';fs.mkdirSync(dir,{recursive:true});
 const head=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const files=cp.execFileSync('git',['ls-tree','-r','--name-only',head],{encoding:'utf8'}).trim().split('\n');
 const runtime=files.filter(f=>!f.startsWith('tests/')&&!f.startsWith('docs/')&&!f.startsWith('supabase/')&&!f.startsWith('.')&&!f.startsWith('output/'));
 const hashes=Object.fromEntries(runtime.map(f=>[f,sha(cp.execFileSync('git',['show',head+':'+f],{maxBuffer:150*1024*1024}))]));
 const privateDir=process.env.FMZ_COMPLETE_BACKUP_DIR;if(!privateDir)throw Error('Private checkpoint required');
 const {decrypt}=require('./release-backup-complete.cjs'),backup=decrypt();
 const verification=JSON.parse(fs.readFileSync(path.join(privateDir,'restore-verification.json')));
 const catalog=backup.functions.find(f=>f.definition.includes('FUNCTION fmz_accounting.billing_catalog('));if(!catalog)throw Error('Catalog missing');
 const expected=fs.readFileSync('supabase/migrations/20260924133305_appfmz_billing_periods.sql','utf8');
 const productionBody=catalog.definition.split('$function$')[1]?.trim();
 const localBody=expected.match(/create function fmz_accounting\.billing_catalog\(pid text\)[\s\S]*?as \$\$([\s\S]*?)\$\$/)?.[1].replace(/\r\n/g,'\n').trim();
 if(productionBody!==localBody)throw Error('Production catalog body differs');
 fs.writeFileSync(dir+'/baseline.json',JSON.stringify({at:new Date().toISOString(),head,project:backup.project,checkpointAt:backup.created_at,checkpointHash:verification.plaintext_sha256,isolatedRestoreVerified:verification.isolatedRowsAndConstraintsRestored,tableCount:Object.keys(backup.tables).length,privateBinariesVerified:verification.privateBinariesDecryptedAndVerified,catalogSQLMatchesGit:true,catalogBodySHA256:sha(productionBody),runtime:hashes},null,2)+'\n');
 console.log('PASS: runtime baseline, encrypted restore proof and production catalog identity saved without customer data.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});

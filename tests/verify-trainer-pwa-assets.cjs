/* Read-only public asset verification. No authenticated API or client records. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const baseline='787b15065d347cfa39fa374b7d4999a70c08eaa8',sha=b=>createHash('sha256').update(b).digest('hex');
(async()=>{
 const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const added=['layout.css','presentation.js','pwa.js','pwa.css','manifest.webmanifest',...JSON.parse(fs.readFileSync('assets/pwa/provenance.json')).outputs.map(x=>x.file),'assets/pwa/provenance.json'];
 const files=[...new Set([...require('../docs/APPFMZ_BILLING_ASSETS_20260924.json').files.map(f=>f.file),...added])];
 const changed=new Set(['index.html','Fit_Met_Zorge_Coach_App_standalone.html',...added]);
 const report={at:new Date().toISOString(),commit,baseline,host:'https://appfmz.nl',files:[],databaseAccess:false};
 for(const file of files){
  const expected=execFileSync('git',['show',commit+':'+file],{maxBuffer:25*1024*1024});
  const response=await fetch(`${report.host}/${file}?release=${commit}`,{cache:'no-store',signal:AbortSignal.timeout(45000)});assert(response.ok,`${file}: HTTP ${response.status}`);
  const actual=Buffer.from(await response.arrayBuffer());assert(actual.equals(expected),`${file}: live differs from Git`);
  if(!changed.has(file))assert(actual.equals(execFileSync('git',['show',baseline+':'+file],{maxBuffer:25*1024*1024})),`${file}: protected runtime changed`);
  const mime=response.headers.get('content-type');if(file.endsWith('.png'))assert.match(mime,/image\/png/);if(file.endsWith('.webmanifest'))assert.match(mime,/(manifest\+json|application\/json)/);
  report.files.push({file,bytes:actual.length,sha256:sha(actual),mime,unchangedFromBaseline:!changed.has(file)});
 }
 const protectedDiff=execFileSync('git',['diff','--name-only',baseline,commit,'--','supabase','config.js','app.js','sync.js','autosave.js','photos.js','accounting.js','accounting-model.js','accounting-reports.js','billing-periods.js','billing-ui.js','invoice-documents.js','invoice-editor.js','invoices.js','styles.css','tutorial','output','fit-met-zorge-logo.png','assets/fit-met-zorge-logo.png','assets/fit-met-zorge-logo-cropped.png'],{encoding:'utf8'}).trim();assert.equal(protectedDiff,'');
 report.protectedSourceDiff=[];fs.writeFileSync('docs/APPFMZ_TRAINER_PWA_ASSETS_20261015.json',JSON.stringify(report,null,2)+'\n');console.log(`PASS ${files.length} public live files exactly match ${commit}; protected application source unchanged.`);
})().catch(error=>{console.error(error);process.exitCode=1;});

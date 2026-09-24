/* Read-only public release proof against committed bytes, including unchanged course assets. */
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex'),baseline='e42639fe840fddc61de50b77d3f7648cb1d538a2';
(async()=>{
 const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),prior=require('../docs/APPFMZ_TUTORIAL_LIVE_20260914.json');
 const files=[...new Set([...prior.files.map(f=>f.file),'billing-periods.js','billing-ui.js'])],changed=new Set(['index.html','styles.css','app.js','accounting.js','invoice-documents.js','invoice-editor.js','billing-periods.js','billing-ui.js']);
 const result={at:new Date().toISOString(),commit,baseline,host:'https://appfmz.nl',files:[]};
 for(const file of files){
  const expected=execFileSync('git',['show',commit+':'+file],{maxBuffer:25*1024*1024}),r=await fetch(result.host+'/'+file+'?verify='+commit,{cache:'no-store',signal:AbortSignal.timeout(45000)});
  if(!r.ok)throw Error(file+': HTTP '+r.status);const actual=Buffer.from(await r.arrayBuffer());if(!expected.equals(actual))throw Error(file+': live differs from Git');
  let same=null;if(!file.startsWith('billing-')){const before=execFileSync('git',['show',baseline+':'+file],{maxBuffer:25*1024*1024});same=before.equals(actual);if(!changed.has(file)&&!same)throw Error(file+': outside release scope');}
  result.files.push({file,bytes:actual.length,sha256:sha(actual),mime:r.headers.get('content-type'),unchangedFromBaseline:same});
 }
 fs.writeFileSync(process.env.FMZ_BILLING_ASSET_OUTPUT||'docs/APPFMZ_BILLING_ASSETS_20260924.json',JSON.stringify(result,null,2)+'\n');console.log('PASS '+files.length+' live files equal Git '+commit+'; unchanged assets preserved');
})().catch(e=>{console.error(e.message);process.exitCode=1});

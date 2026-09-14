/* Read-only production byte check. Never authenticates or calls financial APIs. */
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
(async()=>{
 const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const baseline=JSON.parse(fs.readFileSync('docs/APPFMZ_OWNER_HOTFIX_ASSETS.json','utf8'));
 const files=[];
 for(const {file,sha256:oldHash} of baseline.files){
  const expected=execFileSync('git',['show',commit+':'+file],{maxBuffer:20*1024*1024}),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const response=await fetch('https://appfmz.nl/'+file+'?verify='+commit,{cache:'no-store',signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error(file+': HTTP '+response.status);
  const actual=Buffer.from(await response.arrayBuffer()),sha256=hash(expected);
  if(!expected.equals(actual))throw Error(file+': live bytes differ from Git '+commit);
  if(!['index.html','styles.css','invoice-documents.js'].includes(file)&&oldHash!==sha256)throw Error(file+': unexpected runtime change');
  files.push({file,bytes:actual.length,sha256,mime:response.headers.get('content-type'),unchangedFromAcceptedRuntime:sha256===oldHash});
 }
 const result={at:new Date().toISOString(),commit,host:'https://appfmz.nl',files};
 fs.writeFileSync('docs/APPFMZ_INVOICE_LAYOUT_ASSETS_20260913.json',JSON.stringify(result,null,2)+'\n');
 console.log('PASS '+files.length+' live files equal Git '+commit+'; only the 3 authorized visual assets changed');
})().catch(e=>{console.error(e.message);process.exitCode=1;});

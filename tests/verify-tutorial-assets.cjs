/* Public GET requests only. No Auth session or application mutation endpoint. */
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex');
(async()=>{
 const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baseline=require('../docs/APPFMZ_INVOICE_LAYOUT_ASSETS_20260913.json');
 const list=execFileSync('git',['ls-tree','-r','--name-only',commit],{encoding:'utf8'}).trim().split(/\r?\n/);
 const files=[...new Set([...baseline.files.map(f=>f.file),...list.filter(f=>f==='tutorial.html'||f.startsWith('tutorial/')||f.startsWith('output/pdf/APPFMZ-'))])];
 const result={at:new Date().toISOString(),commit,host:'https://appfmz.nl',baseline:baseline.commit,files:[]};
 for(const file of files){const expected=execFileSync('git',['show',commit+':'+file],{maxBuffer:25*1024*1024}),r=await fetch('https://appfmz.nl/'+file+'?verify='+commit,{cache:'no-store',signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(file+': HTTP '+r.status);const actual=Buffer.from(await r.arrayBuffer());if(!expected.equals(actual))throw Error(file+': live bytes differ from Git');const old=baseline.files.find(f=>f.file===file);if(old&&!['index.html','accounting.js'].includes(file)&&sha(expected)!==old.sha256)throw Error(file+': prior runtime must stay identical');if(file.endsWith('.pdf')&&!r.headers.get('content-type')?.includes('application/pdf'))throw Error(file+': wrong PDF MIME');result.files.push({file,bytes:actual.length,sha256:sha(actual),mime:r.headers.get('content-type'),unchangedFromInvoiceRelease:old?old.sha256===sha(actual):null});}
 fs.writeFileSync(process.env.FMZ_TUTORIAL_VERIFY_OUTPUT||'docs/APPFMZ_TUTORIAL_LIVE_20260914.json',JSON.stringify(result,null,2)+'\n');console.log('PASS '+result.files.length+' public files equal Git '+commit+'; prior runtime unchanged except index/accounting help entry');
})().catch(e=>{console.error(e.message);process.exitCode=1;});

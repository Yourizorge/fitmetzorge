/* Package only synthetic assets. Does not change the existing root application or deploy. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'owner-test'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>(f==='accounting.js'?require('node:child_process').execFileSync('git',['show','309cb0:accounting.js'],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,f),'utf8')).replace(/\r\n?/g,'\n');
function build(){
 fs.mkdirSync(out,{recursive:true});let html=read('index.html');const scripts=[],styles=[],sources={};
 const omitted=new Set(['config.js','pwa.js','push.js','billing-notifications.js','billing-planning-model.js','billing-planning-ui.js','communications-model.js','communications-ui.js','tutorial/host.js','owner-test/host.js']);
 html=html.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,(_,src)=>{const file=src.split('?')[0];if(!/^https?:/.test(file)&&!omitted.has(file)){const code=read(file);scripts.push({file,code});sources[file]=sha(code);}return '';});
 html=html.replace(/<link\b[^>]*>/g,tag=>{const file=tag.match(/href="([^"]+)"/)?.[1]?.split('?')[0];if(tag.includes('stylesheet')&&file){const code=read(file);styles.push(code);sources[file]=sha(code);}return '';});
 html=html.replace(/<\/?(?:html|head)\b[^>]*>/g,'').replace(/<!doctype[^>]*>/i,'').replace(/<meta[^>]*>/g,'').replace(/<title>[\s\S]*?<\/title>/,'').replace(/<body[^>]*>/,'').replace('</body>','');
 const provenance=JSON.parse(read('owner-test/brand/provenance.json')),tokens=JSON.parse(read('owner-test/brand-tokens.json'));
 if(sha(fs.readFileSync(path.join(root,'owner-test/brand/source-logo-20261102.png')))!==provenance.sourceSHA256)throw Error('Official logo source hash changed');
 const brand={sourceSHA256:provenance.sourceSHA256,sourceFilename:provenance.sourceFilename,tokens,variants:{},variantHashes:{}};
 for(const [name,item]of Object.entries(provenance.variants)){const b=fs.readFileSync(path.join(root,item.path));if(sha(b)!==item.sha256)throw Error('Logo variant hash changed');brand.variants[name]='data:image/png;base64,'+b.toString('base64');brand.variantHashes[name]=item.sha256;}
 const logoURL=brand.variants.horizontal;
 html=html.replace(/src="fit-met-zorge-logo.png"/g,'src="'+logoURL+'"');
 for(const file of ['owner-test/database.js','owner-test/guide.js','owner-test/simulation.js','owner-test/navigation.js','owner-test/media.js','owner-test/duo.js','owner-test/brand.js','owner-test/schema-copy.js','owner-test/member-status.js','owner-test/status-ui.js','owner-test/reminder-calendar.js']){const code=read(file);sources[file]=sha(code);}
 styles.push(read('owner-test/guide.css'));styles.push(read('owner-test/navigation.css'));sources['owner-test/navigation.css']=sha(read('owner-test/navigation.css'));
 for(const file of ['owner-test/status-reminders.css','owner-test/brand.css']){styles.push(read(file));sources[file]=sha(read(file));}
 const exerciseImages=[...new Set([...read('app.js').matchAll(/https:\/\/fitnessprogramer\.com\/wp-content\/uploads\/[0-9]{4}\/[0-9]{2}\/[a-zA-Z0-9_-]+\.gif/g)].map(m=>m[0]))];
 const runtime={exerciseImages,revision:'owner-update-20261103',version:1,synthetic:true,sourceTextNormalization:'LF',html,styles,scripts,sources,logoURL,brand,brandScript:read('owner-test/brand.js'),schemaCopy:read('owner-test/schema-copy.js'),statusUI:read('owner-test/status-ui.js'),reminderCalendar:read('owner-test/reminder-calendar.js'),database:read('owner-test/member-status.js')+'\n'+read('owner-test/duo.js')+'\n'+read('owner-test/simulation.js')+'\n'+read('owner-test/database.js'),guide:read('owner-test/guide.js'),navigation:read('owner-test/navigation.js'),media:read('owner-test/media.js'),verifyImage:read('supabase/functions/member-assets/verify-image.js'),pdfRenderer:read('tutorial/vendor/pdf.worker.js')+'\n'+read('tutorial/vendor/pdf.js'),heic:read('vendor/heic-libheif-1.23.5.js')+'\n'+read('vendor/heic-worker.js').replace("importScripts('heic-libheif-1.23.5.js');",'')};
 fs.writeFileSync(path.join(out,'runtime.json'),JSON.stringify(runtime));
 const dir=path.dirname(require.resolve('@electric-sql/pglite'));
 for(const file of ['pglite.wasm','initdb.wasm','pglite.data'])fs.copyFileSync(path.join(dir,file),path.join(out,file+'.bin'));
 const cjs=fs.readFileSync(path.join(dir,'index.cjs'),'utf8');
 fs.writeFileSync(path.join(out,'pglite-browser.js'),'(()=>{const module={exports:{}},exports=module.exports;const __dirname="/synthetic";const require=name=>{throw Error("Node module forbidden in owner test: "+name)};\n'+cjs+'\nwindow.OwnerTestPGlite=module.exports.PGlite;})();\n');
 const files={};for(const[key,file]of Object.entries({runtime:'runtime.json',boot:'boot.js',camera:'camera-host.js',documents:'documents-host.js',pglite:'pglite-browser.js',wasm:'pglite.wasm.bin',initdb:'initdb.wasm.bin',fs:'pglite.data.bin',seed:'seed.bin'})){const b=fs.readFileSync(path.join(out,file));files[key]={path:'owner-test/'+file,bytes:b.length,sha256:sha(b)};}
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version:1,synthetic:true,files,sources,flags:{ownerTest:true,memberSearch:false,enrollment:false,signature:false,memberProfile:false,billingPlanning:false,emailSending:false,billingPush:false,automaticInvoiceSending:false}},null,2)+'\n');
 fs.copyFileSync(path.join(dir,'../LICENSE'),path.join(out,'PGLITE-LICENSE.txt'));
 console.log('Packaged isolated owner test; no production deployment. Total bytes:',Object.values(files).reduce((n,f)=>n+f.bytes,0));
}
if(require.main===module)build();module.exports={build};

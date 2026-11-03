// Reproduce the exact theme-tested package; only the old-review guard may differ.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir='docs/examples/owner-laptop-correction-20261103/',read=f=>fs.readFileSync(path.join(root,f)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const kind=process.argv.includes('--instruction')?'instruction':'theme';
const bytes=read('owner-test/runtime.json'),now=JSON.parse(bytes),index=now.scripts.findIndex(x=>x.file==='members-ui.js');assert(index>=0);
const permitted=new Set(kind==='instruction'?['guide','sources.owner-test/guide.js']:['guide','sources.owner-test/guide.js','database','billingCycleUI','sources.owner-test/billing-cycle-ui.js','sources.owner-test/database.js','sources.members-ui.js','scripts.'+index+'.code']);
if(process.argv.includes('--record')){
 const oldBytes=read('tests/artifacts/owner-correction-'+kind+'-runtime.json'),old=JSON.parse(oldBytes),patch=[];
 function diff(a,b,at=[]){if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'&&JSON.stringify(Object.keys(a))===JSON.stringify(Object.keys(b))){for(const k of Object.keys(a))diff(a[k],b[k],at.concat(k));}else{assert(permitted.has(at.join('.')),'Unexpected runtime change '+at.join('.'));patch.push({path:at,before:a,afterSHA256:sha(JSON.stringify(b))});}}
 diff(old,now);assert(patch.length>0);fs.writeFileSync(path.join(root,dir+kind+'-runtime-inverse-patch.json'),JSON.stringify({testRuntime:sha(oldBytes),finalRuntime:sha(bytes),patch})+'\n');
}
const record=JSON.parse(read(dir+kind+'-runtime-inverse-patch.json')),restored=structuredClone(now);assert.equal(sha(bytes),record.finalRuntime);
for(const entry of record.patch){assert(permitted.has(entry.path.join('.')));let target=restored;for(const key of entry.path.slice(0,-1))target=target[key];const key=entry.path.at(-1);assert.equal(sha(JSON.stringify(target[key])),entry.afterSHA256);target[key]=entry.before;}
assert.equal(sha(JSON.stringify(restored)),record.testRuntime);
for(const [i,s]of now.scripts.entries())if(kind==='instruction'||i!==index)assert.deepEqual(s,restored.scripts[i]);
for(const key of Object.keys(now))if(!(kind==='instruction'?['guide','sources']:['guide','database','billingCycleUI','sources','scripts']).includes(key))assert.deepEqual(now[key],restored[key]);
if(kind==='instruction'){assert.equal(restored.guide.replace('startdatum 2 november 2026. Bekijk Betaling','startdatum 30 november 2026 (de volgende gezamenlijke grens). Bekijk Betaling'),now.guide);assert(now.guide.includes('startdatum 30 november 2026'));}
const report={pass:true,testRuntime:record.testRuntime,finalRuntime:record.finalRuntime,changedPaths:record.patch.map(p=>p.path.join('.')),exactEarlierRuntimeReproduced:true,themeAndLayoutByteIdentical:true,otherApplicationScriptsByteIdentical:true,explanation:kind==='instruction'?'Only one test-guide sentence changes the full-period example from the already past 2 November to the next boundary, 30 November. Exact replacement asserted; every application script, adapter, stylesheet and host remains identical.':'Only the old unfinished-review guard differs in functional code. In addition, one guide sentence uses the next future boundary for the full-period example. All styles, theme code and other application scripts remain identical.',limits:'Earlier browser runs are reproduced exactly; they are not claimed to have run on the final hash.'};
fs.writeFileSync(path.join(root,dir+kind+'-runtime-delta.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

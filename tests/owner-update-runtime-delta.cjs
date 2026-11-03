/* Reproduce the document-tested runtime from the final package plus an exact inverse patch. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const directory='docs/examples/owner-laptop-update-20261103/',current=read('owner-test/runtime.json'),now=JSON.parse(current),kind=process.argv.includes('--calendar')?'calendar':'document';
if(process.argv.includes('--record')){
 const previous=read('tests/artifacts/owner-update-'+kind+'-runtime.json'),old=JSON.parse(previous),patch=[];
 assert.deepEqual(old.scripts,now.scripts);for(const key of ['pdfRenderer','verifyImage','heic','brandScript','statusUI'])assert.equal(old[key],now[key]);
 if(kind==='calendar')for(const key of ['database','reminderCalendar','guide'])assert.equal(old[key],now[key]);
 function diff(a,b,at=[]){if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'&&JSON.stringify(Object.keys(a))===JSON.stringify(Object.keys(b))){for(const k of Object.keys(a))diff(a[k],b[k],at.concat(k));}else patch.push({path:at,before:a,afterSHA256:sha(JSON.stringify(b))});}
 diff(old,now);fs.writeFileSync(path.join(root,directory+kind+'-runtime-inverse-patch.json'),JSON.stringify({documentRuntimeSHA256:sha(previous),finalRuntimeSHA256:sha(current),patch})+'\n');
}
const record=JSON.parse(read(directory+kind+'-runtime-inverse-patch.json')),restored=structuredClone(now);assert.equal(sha(current),record.finalRuntimeSHA256);
for(const entry of record.patch){let target=restored;for(const k of entry.path.slice(0,-1))target=target[k];const key=entry.path.at(-1);assert.equal(sha(JSON.stringify(target[key])),entry.afterSHA256);target[key]=entry.before;}
assert.equal(sha(JSON.stringify(restored)),record.documentRuntimeSHA256);
const report={pass:true,testKind:kind,testRuntime:record.documentRuntimeSHA256,finalRuntime:record.finalRuntimeSHA256,changedPaths:record.patch.map(e=>e.path.join('.')),exactEarlierRuntimeReproduced:true,allEmbeddedApplicationScriptsByteIdentical:JSON.stringify(restored.scripts)===JSON.stringify(now.scripts),calendarFunctionalCodeByteIdentical:kind==='calendar'?['database','reminderCalendar','statusUI','guide'].every(k=>restored[k]===now[k]):null,explanation:['Central colour tokens and field contrast corrected; calendar dialog centred','Schema copy scoped hidden rule, confirmation identities, Dutch labels and unconfirmed checkpoint retry','Owner-only lazy week log prevents read-only Training render from creating unsaved records','Guide explains explicitly creating a source schema','Calendar day layout and async error feedback (already present in calendar-tested runtime)','Cleanup evidence lists all new empty groups (already present in calendar-tested runtime)'],limits:kind+' Edge/Chrome tests used the earlier runtime; changed schema/layout and host paths are tested separately on final runtime.'};
fs.writeFileSync(path.join(root,directory+kind+'-runtime-delta.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,kind,testRuntime:record.documentRuntimeSHA256,finalRuntime:record.finalRuntimeSHA256,changedPaths:record.patch.length}));

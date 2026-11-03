const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),D=require('../members-documents.js');
const bytes=Buffer.from('%PDF-1.7\nSYNTHETIC STORED BYTES\n%%EOF\n'),asset={path:'synthetic/agreement.pdf',mime:'application/pdf',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
test('stored document metadata and filename use immutable signed snapshot, without invented dates',()=>{
 const document={number:'TEST-2026-0001',created_at:'2026-11-03T11:05:00Z',snapshot:{version:2,person:{firstName:'Fictieve',insertion:'van',lastName:'Tést'},signedAt:'2026-11-03T11:00:00Z',package:{label:'Duo Progressie'},terms:{version:'SYNTHETIC-2',source:{test:true}}}};
 const original=JSON.stringify(document),meta=D.describe(document);assert.equal(meta.filename,'fictieve-van-test-overeenkomst-2026-11-03-test-2026-0001.pdf');assert.equal(meta.createdAt,'2026-11-03T11:05:00.000Z');assert.equal(meta.signedAt,'2026-11-03T11:00:00.000Z');assert.equal(meta.version,'2');assert.equal(meta.package,'Duo Progressie');assert.equal(meta.termsVersion,'SYNTHETIC-2');assert.match(meta.status,/testdocument/);assert.equal(JSON.stringify(document),original);
 assert.equal(D.describe({snapshot:{signedAt:document.snapshot.signedAt}}).createdAt,null);assert.equal(D.describe({}).signedAt,null);assert.equal(D.describe({}).version,'Niet vastgelegd');assert(!D.describe({snapshot:{person:{firstName:'../../<script>'}}}).filename.includes('/'));
});
test('stored PDF rejects missing, wrong MIME, truncated and changed bytes; repeat keeps exact original',async()=>{
 const original=Buffer.from(bytes),blob=new Blob([bytes],{type:'application/pdf'});
 assert.deepEqual(Buffer.from(await D.verifyStored(blob,asset)),original);assert.deepEqual(Buffer.from(await D.verifyStored(blob,asset)),original);
 await assert.rejects(D.verifyStored(blob,{...asset,mime:'text/html'}),/bestandstype/);await assert.rejects(D.verifyStored(blob,null),/ontbreekt/);await assert.rejects(D.verifyStored(null,asset),/niet beschikbaar/);await assert.rejects(D.verifyStored(new Blob([bytes],{type:'text/html'}),asset),/bestandstype/);
 await assert.rejects(D.verifyStored(new Blob([bytes.subarray(0,-7)],{type:'application/pdf'}),asset),/onvolledig/);
 const changed=Buffer.from(bytes);changed[10]^=1;await assert.rejects(D.verifyStored(new Blob([changed],{type:'application/pdf'}),asset),/inhoudscontrole/);
 const falsePDF=Buffer.from(bytes);falsePDF[0]=65;await assert.rejects(D.verifyStored(new Blob([falsePDF],{type:'application/pdf'}),{...asset,sha256:crypto.createHash('sha256').update(falsePDF).digest('hex')}),/beschadigd/);assert.deepEqual(bytes,original);
});
test('document UI has separate Openen/Downloaden, row-scoped retry and read-only retrieval',()=>{
 const ui=fs.readFileSync(require.resolve('../members-ui.js'),'utf8'),start=ui.indexOf('async function download('),end=ui.indexOf('async function showPDF(',start),route=ui.slice(start,end);
 assert.match(route,/storage\.from\('fmz-members'\)\.download/);assert.match(route,/verifyStored/);assert.doesNotMatch(route,/command\(|\.pdf\(|upload\(/);
 assert.match(ui,/data-document-view="\$\{esc\(d.id\)\}">Openen/);assert.match(ui,/data-document-retry hidden>Opnieuw proberen/);assert.match(ui,/documentAction\(b,d,'download'\)/);assert.match(ui,/documentAction\(b,d,'view'\)/);assert.match(ui,/row\.dataset\.loading/);
});

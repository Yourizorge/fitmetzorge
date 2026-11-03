/* Local provenance/contrast assertions; no network or private data. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),test=require('node:test');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const p=JSON.parse(read('owner-test/brand/provenance.json')),t=JSON.parse(read('owner-test/brand-tokens.json'));
test('original owner supplied logo and complete proportional variants retain identity',()=>{
 assert.equal(sha(read('owner-test/brand/source-logo-20261102.png')),'f60fd1fd2d34c02cfae5a7cb833e2cfc32c4c1284e200880cb0f68a0d05b315a');
 assert.equal(p.contentCrop,false);assert.equal(p.designModified,false);assert.deepEqual(p.sourceDimensions,[1774,887]);assert.deepEqual(p.sourceAlphaRange,[0,255]);
 for(const v of Object.values(p.variants)){const b=read(v.path);assert.equal(sha(b),v.sha256);assert.equal(b.readUInt32BE(16),v.width);assert.equal(b.readUInt32BE(20),v.height);const [x,y,w,h]=v.imageBounds;assert.ok(Math.abs(w/h-2)<.04);assert.ok(x>=0&&y>=0&&x+w<=v.width&&y+h<=v.height);}
 assert.equal(t.gold,p.goldSamples.primary.hex);assert.equal(t['gold-highlight'],p.goldSamples.highlight.hex);assert.equal(t['gold-edge'],p.goldSamples.edge.hex);
 for(const file of ['brand.css','navigation.css','guide.css','status-reminders.css'])assert.doesNotMatch(read('owner-test/'+file).toString(),/#[0-9a-f]{3,8}\b/i,'Owner styles must use central tokens: '+file);
});
function luminance(hex){const c=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('text buttons messages and field/focus boundaries meet contrast thresholds',()=>{
 const checks=[];for(const bg of ['background','surface','surface-raised'])for(const fg of ['text','muted','gold','success','warning','error'])checks.push({foreground:fg,background:bg,minimum:4.5});
 checks.push({foreground:'ink',background:'gold',minimum:4.5});for(const bg of ['background','surface','surface-raised'])for(const fg of ['focus','border'])checks.push({foreground:fg,background:bg,minimum:3});
 for(const row of checks){row.ratio=Number(contrast(t[row.foreground],t[row.background]).toFixed(3));row.pass=row.ratio>=row.minimum;assert.ok(row.pass,JSON.stringify(row));}
 const dest=path.join(root,process.env.OWNER_BRAND_EVIDENCE||'docs/examples/owner-laptop-update-20261103/brand-contrast.json');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify({sourceSHA256:p.sourceSHA256,tokens:t,checks,pass:true,limits:'Token contrast; rendered browser layouts checked separately. Gold logo artwork is unmodified and not body text.'},null,2)+'\n');
});

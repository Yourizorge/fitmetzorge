// Deterministic asset export: the entire original logo, no crop, redraw or AI.
const fs=require('node:fs'),crypto=require('node:crypto'),{chromium}=require('playwright');
(async()=>{
 const source=fs.readFileSync('fit-met-zorge-logo.png');
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();fs.mkdirSync('assets/pwa',{recursive:true});
  const outputs=[];
  for(const [name,size,scale] of [['icon-192',192,.88],['icon-512',512,.88],['maskable-512',512,.76],['apple-touch-icon',180,.76],['favicon-32',32,.88]]){
   const data=await page.evaluate(async({base64,size,scale})=>{const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,size,size);const ratio=Math.min(size*scale/image.width,size*scale/image.height),w=image.width*ratio,h=image.height*ratio;ctx.drawImage(image,(size-w)/2,(size-h)/2,w,h);return c.toDataURL('image/png').split(',')[1];},{base64:source.toString('base64'),size,scale});
   const bytes=Buffer.from(data,'base64'),file=`assets/pwa/${name}.png`;fs.writeFileSync(file,bytes);outputs.push({file,size,scale,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  fs.writeFileSync('assets/pwa/provenance.json',JSON.stringify({source:'fit-met-zorge-logo.png',sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),method:'Full source contain-resized on opaque white square; original unchanged. Maskable visible logo inside central 80% circle.',outputs},null,2)+'\n');
 }finally{await browser.close();}
})();

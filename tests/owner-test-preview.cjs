/* Test the owner-only release against Git's unchanged production frontend. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),BASE='309cb0db3569f14ac54442c8daec678020ba149a';
async function start(){
 const backend=await require('./preview.cjs').start(0),cache=new Map();
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),file=url.pathname.slice(1)||'index.html';
  if(url.pathname.startsWith('/__test__/')){let body='';for await(const c of req)body+=c;const r=await fetch(backend.url+url.pathname+url.search,{method:req.method,...(req.method==='POST'?{body}:{}),headers:{'Content-Type':'application/json'}});res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')});return res.end(Buffer.from(await r.arrayBuffer()));}
  let b;try{
   if(file==='config.js')b=Buffer.from('window.FMZ_CONFIG={SUPABASE_URL:location.origin,SUPABASE_ANON_KEY:"synthetic-preview"};');
   else if(file==='tests/mock-sdk.js')b=fs.readFileSync(path.join(ROOT,file));
   else if(/^owner-test\/[a-zA-Z0-9._/-]+$/.test(file)&&!file.includes('..'))b=fs.readFileSync(path.join(ROOT,file));
   else{if(!cache.has(file))cache.set(file,cp.execFileSync('git',['show',BASE+':'+file],{maxBuffer:100*1024*1024,stdio:['ignore','pipe','ignore']}));b=cache.get(file);}
   if(file==='index.html')b=Buffer.from(b.toString().replace(/https:\/\/cdn.jsdelivr.net\/npm\/@supabase\/supabase-js@2(?:\.\d+\.\d+)?/,'tests/mock-sdk.js').replace('</body>','<script src="owner-test/host.js"></script></body>'));
   res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.json':'application/json','.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.pdf':'application/pdf'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return{url:'http://127.0.0.1:'+server.address().port,backend,close:async()=>{await new Promise(r=>{server.close(r);server.closeAllConnections();});await backend.close();}};
}
module.exports={start};if(require.main===module)start().then(x=>console.log(x.url));

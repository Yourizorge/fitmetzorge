// Local release frontend, real production Auth/RPC; only approved public assets served.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),allowed=new Set(['index.html','app.js','sync.js','autosave.js','photos.js','invoices.js','accounting.js','accounting-model.js','vendor/fflate-0.8.2.js','styles.css','config.js','fit-met-zorge-logo.png','vendor/pdf-lib-1.17.1.min.js']);
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!allowed.has(name)){res.writeHead(404);return res.end();}const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(name)];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});fs.createReadStream(path.join(root,name)).pipe(res);});
server.listen(8878,'127.0.0.1',()=>console.log('Authorized production-chain preview at http://127.0.0.1:8878'));

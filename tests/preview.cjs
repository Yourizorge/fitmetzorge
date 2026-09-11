const http=require('node:http'),fs=require('node:fs'),path=require('node:path'); const {setup}=require('./database.cjs');
async function start(port=8876){
 const database=await setup();await require('./accounting-database.cjs').extend(database);const blobs=new Map();let queue=Promise.resolve();const calls=[];
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type==='application/json'?JSON.stringify(data):data)};
  if(url.pathname==='/__test__/rpc'){
   let body='';for await(const chunk of req)body+=chunk;
   const {account,name,params}=JSON.parse(body); calls.push({account,name});
   const run=async()=>{try{
    if(!['trainer','a','b'].includes(account))return send(401,{data:null,error:{message:'No test session',code:'42501'}});
    if(name==='fmz_accounting_read')return send(200,{data:(await database.as(account,'select public.fmz_accounting_read() result')).rows[0].result,error:null});
    if(name==='fmz_accounting_command')return send(200,{data:(await database.as(account,'select public.fmz_accounting_command($1,$2,$3) result',[params.action,JSON.stringify(params.payload),params.request_id])).rows[0].result,error:null});
    if(name==='storage_upload'){const bytes=Buffer.from(params.base64,'base64');await database.as(account,'insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['fmz-finance',params.path,JSON.stringify({size:bytes.length})]);if(blobs.has(params.path))return send(409,{error:{message:'Already exists'}});blobs.set(params.path,{base64:params.base64,mime:params.mime});return send(200,{data:{path:params.path},error:null});}
    if(name==='storage_download'){const rows=(await database.as(account,'select name from storage.objects where bucket_id=$1 and name=$2',['fmz-finance',params.path])).rows;if(!rows.length||!blobs.has(params.path))return send(403,{error:{message:'Denied'}});return send(200,{data:blobs.get(params.path),error:null});}
    if(name==='profile'){const result=await database.as(account,'select * from public.profiles where id=auth.uid()');return send(200,{data:result.rows[0],error:null});}
    if(name==='fmz_read_workspace')return send(200,{data:{state:await database.read(account),profile_id:database.ids[account]},error:null});
    if(name==='fmz_save_changes')return send(200,{data:await database.save(account,params.changes),error:null});
    if(name==='fmz_save_changes_once')return send(200,{data:(await database.as(account,'select public.fmz_save_changes_once($1,$2) as result',[JSON.stringify(params.changes),params.request_id])).rows[0].result,error:null});
    if(name==='fmz_photo_annotation')return send(200,{data:(await database.as(account,'select public.fmz_photo_annotation($1,$2,$3,$4,$5,$6,$7,$8,$9) as result',[params.client_id,params.week,params.day,params.slot,params.source_hash||null,params.action||'read',JSON.stringify(params.strokes||[]),params.expected_version||0,params.request_id||null])).rows[0].result,error:null});
    return send(400,{error:{message:'Unsupported test RPC'}});
   }catch(error){send(400,{data:null,error:{message:error.message,code:error.code}})}};
   queue=queue.then(run,run); return;
  }
  if(url.pathname.startsWith('/functions/'))return send(200,{ok:true,intercepted:true});
  if(url.pathname==='/config.js')return send(200,'window.FMZ_CONFIG={SUPABASE_URL:location.origin,SUPABASE_ANON_KEY:"synthetic-preview"};','text/javascript');
  const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
  const root=path.resolve(__dirname,'..'),file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep) || !['.js','.mjs','.css','.html','.png','.svg'].includes(path.extname(file)) || relative.startsWith('node_modules'))return send(404,{});
  try{let content=fs.readFileSync(file);const type={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)];
   if(relative==='index.html'){content=content.toString().replace(/https:\/\/cdn.jsdelivr.net\/npm\/@supabase\/supabase-js@2(?:\.\d+\.\d+)?/,'tests/mock-sdk.js').replace('<body class="logged-out">','<body class="logged-out"><aside style="padding:8px;background:#674900;color:white">LOKALE TESTPREVIEW — synthetische gegevens. Accounts: trainer@example.test, a@example.test, b@example.test. Elk wachtwoord werkt; kies Trainer of Lid.</aside>');}
   send(200,content,type);
  }catch{send(404,{})}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
 return {url:`http://127.0.0.1:${server.address().port}`,calls,database,blobs,close:async()=>{await new Promise(r=>server.close(r));await database.db.close();}};
}
module.exports={start};
if(require.main===module)start().then(x=>console.log('Synthetic preview: '+x.url));

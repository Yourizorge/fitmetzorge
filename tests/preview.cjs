const http=require('node:http'),fs=require('node:fs'),path=require('node:path'); const {setup}=require('./database.cjs');
async function start(port=8876){
 const database=await setup();await require('./accounting-database.cjs').extend(database);await require('./agenda-database.cjs').extend(database);
 for(const file of ['20261026154916_appfmz_members.sql','20261104163836_appfmz_central_billing_opt_in.sql','20261104164206_appfmz_member_release_gate.sql'])await database.db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8'));
 const blobs=new Map();let queue=Promise.resolve();const calls=[];
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; connect-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; worker-src 'none'; object-src 'none'; frame-src 'self' blob:; form-action 'self'; base-uri 'self'",'Referrer-Policy':'no-referrer'});res.end(type==='application/json'?JSON.stringify(data):data)};
  if(url.pathname==='/__test__/rpc'){
   let body='';for await(const chunk of req)body+=chunk;
   const {account,name,params}=JSON.parse(body); calls.push({account,name});
   const run=async()=>{try{
    if(!['trainer','a','b'].includes(account))return send(401,{data:null,error:{message:'No test session',code:'42501'}});
    if(['fmz_members_read'].includes(name))return send(200,{data:(await database.as(account,'select public.fmz_members_read($1,$2) r',[params.action,JSON.stringify(params.payload||{})])).rows[0].r,error:null});
    if(['fmz_members_command','fmz_central_billing_command'].includes(name))return send(200,{data:(await database.as(account,'select public.'+name+'($1,$2,$3) r',[params.action,JSON.stringify(params.payload||{}),params.request_id])).rows[0].r,error:null});
    if(name==='fmz_central_billing_read')return send(200,{data:(await database.as(account,'select public.fmz_central_billing_read($1,$2) r',[params.from_date,params.to_date])).rows[0].r,error:null});
    if(name==='fmz_billing_proposal')return send(200,{data:(await database.as(account,'select public.fmz_billing_proposal($1,$2) r',[params.client_id,params.at_date||null])).rows[0].r,error:null});
    if(name==='fmz_accounting_read')return send(200,{data:(await database.as(account,'select public.fmz_accounting_read() result')).rows[0].result,error:null});
    if(name==='fmz_billing_command')return send(200,{data:(await database.as(account,'select public.fmz_billing_command($1,$2,$3) result',[params.action,JSON.stringify(params.payload),params.request_id])).rows[0].result,error:null});
    if(name==='fmz_accounting_command')return send(200,{data:(await database.as(account,'select public.fmz_accounting_command($1,$2,$3) result',[params.action,JSON.stringify(params.payload),params.request_id])).rows[0].result,error:null});
    if(name==='fmz_bank_repair_preview')return send(200,{data:(await database.as(account,'select public.fmz_bank_repair_preview($1,$2) result',[params.action,JSON.stringify(params.payload)])).rows[0].result,error:null});
    if(name==='fmz_vat_preview')return send(200,{data:(await database.as(account,'select public.fmz_vat_preview($1,$2) result',[params.action,JSON.stringify(params.payload)])).rows[0].result,error:null});
    if(name==='fmz_vat_command')return send(200,{data:(await database.as(account,'select public.fmz_vat_command($1,$2,$3) result',[params.action,JSON.stringify(params.payload),params.request_id])).rows[0].result,error:null});
    if(name==='fmz_bank_repair_command')return send(200,{data:(await database.as(account,'select public.fmz_bank_repair_command($1,$2,$3) result',[params.action,JSON.stringify(params.payload),params.request_id])).rows[0].result,error:null});
    if(name==='fmz_payment_command')return send(200,{data:(await database.as(account,'select public.fmz_payment_command($1,$2,$3) result',[params.action,JSON.stringify(params.payload),params.request_id])).rows[0].result,error:null});
    if(name==='storage_upload'){const bytes=Buffer.from(params.base64,'base64');await database.as(account,'insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['fmz-finance',params.path,JSON.stringify({size:bytes.length})]);if(blobs.has(params.path))return send(409,{error:{message:'Already exists'}});blobs.set(params.path,{base64:params.base64,mime:params.mime});return send(200,{data:{path:params.path},error:null});}
    if(name==='storage_download'){const rows=(await database.as(account,'select name from storage.objects where bucket_id=$1 and name=$2',['fmz-finance',params.path])).rows;if(!rows.length||!blobs.has(params.path))return send(403,{error:{message:'Denied'}});return send(200,{data:blobs.get(params.path),error:null});}
    if(name==='profile'){const result=await database.as(account,'select * from public.profiles where id=auth.uid()');return send(200,{data:result.rows[0],error:null});}
    if(name==='fmz_read_workspace')return send(200,{data:{state:await database.read(account),profile_id:database.ids[account]},error:null});
    if(name==='fmz_save_changes')return send(200,{data:await database.save(account,params.changes),error:null});
    if(name==='fmz_agenda_read')return send(200,{data:await database.agenda(account),error:null});
    if(name==='fmz_agenda_command')return send(200,{data:await database.command(account,params.action,params.payload,params.request_id),error:null});
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
  if(!file.startsWith(root+path.sep) || !['.js','.mjs','.css','.html','.png','.jpg','.svg','.pdf','.csv','.txt','.webmanifest','.mp4','.webm','.vtt','.json'].includes(path.extname(file)) || relative.startsWith('node_modules'))return send(404,{});
  try{let content=fs.readFileSync(file);const type={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.pdf':'application/pdf','.csv':'text/csv','.txt':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json','.mp4':'video/mp4','.webm':'video/webm','.vtt':'text/vtt','.json':'application/json'}[path.extname(file)];
   if(path.extname(file)==='.mp4' && req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match)return send(416,{});const start=Number(match[1]),end=Math.min(match[2]?Number(match[2]):content.length-1,content.length-1);if(start>end)return send(416,{});res.writeHead(206,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${content.length}`,'Content-Length':end-start+1});return res.end(content.subarray(start,end+1));}
   if(relative==='index.html'){content=content.toString().replace(/https:\/\/cdn.jsdelivr.net\/npm\/@supabase\/supabase-js@2(?:\.\d+\.\d+)?/,'tests/mock-sdk.js').replace('<body class="logged-out">','<body class="logged-out"><aside class="local-test-banner">LOKALE TESTMODUS — NIET LIVE · Alleen fictieve gegevens</aside><style>.local-test-banner{position:fixed;top:0;left:0;right:0;z-index:9999;padding:7px 10px;background:#674900;color:#fff;font:600 12px/1.5 sans-serif;text-align:center}body{padding-top:38px!important}body .topbar{top:38px!important}body.fmz-trainer-layout .sidebar{top:38px!important;height:calc(100dvh - 38px)!important}</style>');}
   send(200,content,type);
  }catch{send(404,{})}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
 return {url:`http://127.0.0.1:${server.address().port}`,calls,database,blobs,close:async()=>{await queue;await new Promise(r=>{server.close(r);server.closeAllConnections();});await database.db.close();}};
}
module.exports={start};
if(require.main===module)start().then(x=>console.log('Synthetic preview: '+x.url));

const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'); const {setup}=require('./database.cjs');
async function start(port=8876){
 const database=await setup();await require('./accounting-database.cjs').extend(database);await require('./agenda-database.cjs').extend(database);await require('./enrollment-database.cjs').extend(database);const blobs=new Map(),signed=new Map();let queue=Promise.resolve();const calls=[];
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type==='application/json'?JSON.stringify(data):data)};
  if(url.pathname==='/__test__/signed'){const token=signed.get(url.searchParams.get('token'));if(!token||token.until<Date.now())return send(403,{error:'Expired test link'});const blob=blobs.get(token.key);if(!blob)return send(404,{});return send(200,Buffer.from(blob.base64,'base64'),blob.mime);}
  if(url.pathname==='/__test__/rpc'){
   let body='';for await(const chunk of req)body+=chunk;
   const {account,name,params}=JSON.parse(body); calls.push({account,name});
   const run=async()=>{try{
    if(!['trainer','a','b'].includes(account))return send(401,{data:null,error:{message:'No test session',code:'42501'}});
    if(['fmz_billing_planning_read','fmz_communication_read','fmz_billing_reminders_read'].includes(name))return send(200,{data:(await database.as(account,`select public.${name}() result`)).rows[0].result,error:null});
    if(name==='fmz_members_read')return send(200,{data:(await database.as(account,'select public.fmz_members_read($1,$2) result',[params.action,JSON.stringify(params.payload||{})])).rows[0].result,error:null});
    if(['fmz_members_command','fmz_billing_planning_command','fmz_communication_command','fmz_billing_reminders_command'].includes(name))return send(200,{data:(await database.as(account,`select public.${name}($1,$2,$3) result`,[params.action,JSON.stringify(params.payload),params.request_id])).rows[0].result,error:null});
    if(name==='member_verify'){
     const asset=(await database.as(account,"select public.fmz_members_read($1,$2) r",[params.action==='delete_draft'?'cleanup_asset':'asset',JSON.stringify({id:params.id})])).rows[0].r;
     if(!asset)throw Error('Bestand niet beschikbaar');
     if(params.action==='delete_draft'){
      if(asset.kind!=='agreement'||!['retired','deleted'].includes(asset.status))throw Error('Alleen een ingetrokken ongebruikt concept mag worden verwijderd');
      await database.db.query('delete from storage.objects where bucket_id=$1 and name=$2',['fmz-members',asset.path]);blobs.delete('fmz-members/'+asset.path);
      await database.db.query('select public.fmz_member_draft_asset_deleted($1)',[asset.id]);return send(200,{data:{ok:true},error:null});
     }
     if(params.action==='delete_photo'){
      if(asset.kind!=='photo'||!['retired','deleted'].includes(asset.status))throw Error('Alleen een ingetrokken profielfoto mag worden verwijderd');
      await database.db.query('delete from storage.objects where bucket_id=$1 and name=$2',['fmz-members',asset.path]);blobs.delete('fmz-members/'+asset.path);
      await database.db.query('select public.fmz_member_photo_deleted($1)',[asset.id]);return send(200,{data:{ok:true},error:null});
     }
     const blob=blobs.get('fmz-members/'+asset.path);if(!blob)throw Error('Upload ontbreekt');
     const bytes=Buffer.from(blob.base64,'base64'),hash=crypto.createHash('sha256').update(bytes).digest('hex');if(hash!==asset.sha256||bytes.length!==Number(asset.bytes))throw Error('Inhoud wijkt af');
     if(asset.kind==='agreement'){const snapshot=(await database.as(account,"select public.fmz_members_read('document_snapshot',$1) r",[JSON.stringify({id:asset.draft_id})])).rows[0].r;const expected=await require('../members-documents.js').pdf(snapshot,require('pdf-lib'));if(!Buffer.from(expected).equals(bytes))throw Error('PDF wijkt af van ondertekende versie');}
     else {require('../supabase/functions/member-assets/verify-image.js');await globalThis.FMZMemberVerifyImage(bytes,asset.mime,require('pdf-lib'));}
     const confirmed=(await database.db.query('select public.fmz_member_verify_asset($1,$2,$3) r',[asset.id,hash,bytes.length])).rows[0].r;return send(200,{data:{ok:true,asset:confirmed},error:null});
    }
    if(name==='fmz_accounting_read')return send(200,{data:(await database.as(account,'select public.fmz_accounting_read() result')).rows[0].result,error:null});
    if(name==='fmz_billing_command')return send(200,{data:(await database.as(account,'select public.fmz_billing_command($1,$2,$3) result',[params.action,JSON.stringify(params.payload),params.request_id])).rows[0].result,error:null});
    if(name==='fmz_accounting_command')return send(200,{data:(await database.as(account,'select public.fmz_accounting_command($1,$2,$3) result',[params.action,JSON.stringify(params.payload),params.request_id])).rows[0].result,error:null});
    if(name==='fmz_bank_repair_preview')return send(200,{data:(await database.as(account,'select public.fmz_bank_repair_preview($1,$2) result',[params.action,JSON.stringify(params.payload)])).rows[0].result,error:null});
    if(name==='fmz_vat_preview')return send(200,{data:(await database.as(account,'select public.fmz_vat_preview($1,$2) result',[params.action,JSON.stringify(params.payload)])).rows[0].result,error:null});
    if(name==='fmz_vat_command')return send(200,{data:(await database.as(account,'select public.fmz_vat_command($1,$2,$3) result',[params.action,JSON.stringify(params.payload),params.request_id])).rows[0].result,error:null});
    if(name==='fmz_bank_repair_command')return send(200,{data:(await database.as(account,'select public.fmz_bank_repair_command($1,$2,$3) result',[params.action,JSON.stringify(params.payload),params.request_id])).rows[0].result,error:null});
    if(name==='fmz_payment_command')return send(200,{data:(await database.as(account,'select public.fmz_payment_command($1,$2,$3) result',[params.action,JSON.stringify(params.payload),params.request_id])).rows[0].result,error:null});
    if(name==='storage_upload'){const bytes=Buffer.from(params.base64,'base64'),bucket=params.bucket||'fmz-finance',key=bucket==='fmz-finance'?params.path:bucket+'/'+params.path;await database.as(account,'insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',[bucket,params.path,JSON.stringify({size:bytes.length,mimetype:params.mime})]);if(blobs.has(key))return send(409,{error:{message:'Already exists'}});blobs.set(key,{base64:params.base64,mime:params.mime});return send(200,{data:{path:params.path},error:null});}
    if(name==='storage_download'||name==='storage_sign'){const bucket=params.bucket||'fmz-finance',key=bucket==='fmz-finance'?params.path:bucket+'/'+params.path,rows=(await database.as(account,'select name from storage.objects where bucket_id=$1 and name=$2',[bucket,params.path])).rows;if(!rows.length||!blobs.has(key))return send(403,{error:{message:'Denied'}});if(name==='storage_sign'){const token=crypto.randomUUID();signed.set(token,{key,until:Date.now()+Math.min(params.seconds||60,300)*1000});return send(200,{data:{signedUrl:'/__test__/signed?token='+token},error:null});}return send(200,{data:blobs.get(key),error:null});}
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
   if(relative==='index.html'){content=content.toString().replace(/https:\/\/cdn.jsdelivr.net\/npm\/@supabase\/supabase-js@2(?:\.\d+\.\d+)?/,'tests/mock-sdk.js').replace('<body class="logged-out">','<body class="logged-out"><aside style="padding:8px;background:#674900;color:white">LOKALE TESTPREVIEW — synthetische gegevens. Accounts: trainer@example.test, a@example.test, b@example.test. Elk wachtwoord werkt; kies Trainer of Lid.</aside>');}
   send(200,content,type);
  }catch{send(404,{})}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
 return {url:`http://127.0.0.1:${server.address().port}`,calls,database,blobs,close:async()=>{await queue;await new Promise(r=>{server.close(r);server.closeAllConnections();});await database.db.close();}};
}
module.exports={start};
if(require.main===module)start().then(x=>console.log('Synthetic preview: '+x.url));

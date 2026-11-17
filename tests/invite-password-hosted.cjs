/* Operator-only, one synthetic Auth account. generate_link sends NO email.
 * Secret material and account manifest stay outside Git; never print API responses.
 * No profile/workspace/finance/storage rows are created or edited.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const project='hgoygcviutmynaihcvpd',base='https://'+project+'.supabase.co',dir=process.env.FMZ_AUTH_PRIVATE;
assert(dir&&!path.resolve(dir).startsWith(path.resolve(__dirname,'..')+path.sep),'Private directory outside Git required');fs.mkdirSync(dir,{recursive:true});
const keys=JSON.parse(fs.readFileSync('C:/Users/Fitme/.codex/backups/appfmz-20260908/api-keys.json','utf8').replace(/^\uFEFF/,''));
const service=keys.find(x=>x.name==='service_role').api_key,anon=keys.find(x=>x.name==='anon').api_key;
async function api(route,method='POST',body={},token=service){const r=await fetch(base+route,{method,headers:{apikey:token===service?service:anon,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});const data=await r.json().catch(()=>null);if(!r.ok)throw Error('Hosted check HTTP '+r.status+' at '+route.split('?')[0]);return data;}
const file=path.join(dir,'synthetic-auth.json'),save=x=>fs.writeFileSync(file,JSON.stringify(x));
async function cleanup(m){if(!m?.id)return;assert(/^fmz-password-[a-f0-9]{16}$/.test(m.marker));const u=await api('/auth/v1/admin/users/'+m.id,'GET');assert.equal(u.email,m.marker+'@example.test');assert.equal(u.user_metadata.fmz_release,m.marker);await api('/auth/v1/admin/users/'+m.id,'DELETE',{});m.deleted=true;save(m);}
(async()=>{
 if(process.argv[2]==='cleanup'){await cleanup(JSON.parse(fs.readFileSync(file)));console.log('Synthetic Auth cleanup confirmed');return;}
 assert(!fs.existsSync(file),'Preserve existing canary manifest; cleanup first');const m={marker:'fmz-password-'+crypto.randomBytes(8).toString('hex')};save(m);let result;
 try{
  const link=await api('/auth/v1/admin/generate_link','POST',{type:'invite',email:m.marker+'@example.test',data:{fmz_release:m.marker},redirect_to:'https://appfmz.nl'});
  m.id=link.id||link.user?.id;assert(m.id);save(m);
  const session=await api('/auth/v1/verify','POST',{type:'invite',token_hash:link.hashed_token},anon);assert.equal(session.user.id,m.id);
  const status=()=>api('/rest/v1/rpc/fmz_password_status','POST',{},session.access_token);
  assert.deepEqual(await status(),{user_id:m.id,password_set:false});
  const password=crypto.randomBytes(26).toString('base64url')+'aA1!';
  const updated=await api('/auth/v1/user','PUT',{password},session.access_token);assert.equal(updated.id,m.id);assert.deepEqual(await status(),{user_id:m.id,password_set:true});
  const signed=await api('/auth/v1/token?grant_type=password','POST',{email:m.marker+'@example.test',password},anon);assert.equal(signed.user.id,m.id);
  assert.deepEqual(await api('/rest/v1/rpc/fmz_password_status','POST',{},signed.access_token),{user_id:m.id,password_set:true});
  await api('/auth/v1/logout?scope=global','POST',{},signed.access_token);
  await assert.rejects(status(),/HTTP (401|403)/);
  result={at:new Date().toISOString(),project,pass:true,checks:['Real hosted invite link generated without email','Real invite verification produces session without password','PostgREST self-only status false','Real Auth password update acknowledged','PostgREST password status true','Fresh password sign-in succeeds','Revoked session rejected'],realEmailsSent:0,syntheticAuthAccounts:1,profilesCreated:0,customerWrites:0};
 }finally{if(m.id)await cleanup(m);}
 result.syntheticAuthCleaned=true;fs.mkdirSync('docs/examples/invite-password-20261117',{recursive:true});fs.writeFileSync('docs/examples/invite-password-20261117/hosted-auth.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1;});

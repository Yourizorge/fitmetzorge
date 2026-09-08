const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
test('Edge mail requests are intercepted; failed preparation never sends an invitation',async()=>{
 let handler,mailCalls=0,preparationError=true,alreadyRegistered=false;
 const sdk={auth:{getUser:async()=>({data:{user:{id:'trainer'}},error:null}),admin:{inviteUserByEmail:async()=>{mailCalls++;return {error:null}}}},from(){return {select(){return this},eq(){return this},single:async()=>({data:{id:'trainer',role:'trainer'},error:null})}},rpc:async()=>({data:preparationError?null:{ok:true,alreadyRegistered},error:preparationError?{message:'denied'}:null})};
 const source=fs.readFileSync('supabase/functions/invite-client/index.ts','utf8').replace(/^import .*\n/,'');
 vm.runInNewContext(stripTypeScriptTypes(source),{createClient:()=>sdk,Deno:{env:{get:()=> 'synthetic'},serve:fn=>handler=fn},Request,Response,URL,console});
 const req=()=>new Request('http://localhost/invite',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({clientId:'a',email:'a@example.test',name:'Synthetic'})});
 assert.equal((await handler(req())).status,409);assert.equal(mailCalls,0);
 preparationError=false; assert.equal((await handler(req())).status,200);assert.equal(mailCalls,1);
 alreadyRegistered=true; assert.equal((await handler(req())).status,200);assert.equal(mailCalls,1);
});

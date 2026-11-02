const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
// Exercise the real private request function. The extra export exists only in this VM,
// never in delivered browser code. lock() is the actual close/account-change cleanup.
for(const oldFailure of [false,true])test('old dialog '+(oldFailure?'rejection':'response')+' cannot clear a new lost-response request identity',async()=>{
 const source=fs.readFileSync(require.resolve('../communications-ui.js'),'utf8').replace('return{configure,open,lock,statusFor:', 'return{request:command,configure,open,lock,statusFor:');
 const window={addEventListener(){}};vm.runInNewContext(source,{window,crypto:{randomUUID}});const ui=window.FMZCommunicationsUI,calls=[];
 ui.configure({rpc:(name,args)=>new Promise((resolve,reject)=>calls.push({name,args,resolve,reject}))});
 const first=ui.request('save',{id:'first',version:1,body:'first'}).catch(e=>e);ui.lock();
 const second=ui.request('save',{id:'second',version:2,body:'second'}).catch(e=>e);
 if(oldFailure)calls[0].reject(Object.assign(Error('Old version conflict'),{code:'PT409'}));else calls[0].resolve({id:'first'});await first;
 calls[1].reject(Error('New response lost'));await second;
 const retry=ui.request('save',{id:'second',version:2,body:'second'});assert.equal(calls[2].args.request_id,calls[1].args.request_id);assert.notEqual(calls[2].args.request_id,calls[0].args.request_id);calls[2].resolve({id:'second',version:3});assert.equal((await retry).version,3);
});

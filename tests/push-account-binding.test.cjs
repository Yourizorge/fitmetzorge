const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('push opt-in and opt-out never continue under another account after an awaited browser or RPC step',async()=>{
 for(const stage of ['permission','registration','getSubscription','subscribeBrowser','subscribeRPC','none']){
  const calls=[],target={textContent:''};let context;
  const step=async(name,value)=>{if(stage===name){context.authGeneration++;context.onlineProfile={id:'account-b'};}return value;};
  const sub={toJSON:()=>({endpoint:'https://web.push.apple.com/synthetic'})},reg={pushManager:{getSubscription:()=>step('getSubscription',null),subscribe:()=>step('subscribeBrowser',sub)}};
  context={authGeneration:1,onlineReady:true,onlineProfile:{id:'account-a'},window:{addEventListener(){}},navigator:{serviceWorker:{register:()=>step('registration',reg),ready:Promise.resolve()}},PushManager:function(){},Notification:{requestPermission:()=>step('permission','granted')},atob,Uint8Array,Error,FMZAgenda:{command:async(action)=>{calls.push({action,actor:context.onlineProfile.id});return step(action==='subscribe'?'subscribeRPC':'preferencesRPC',true);}}};
  context.window.Notification=context.Notification;context.window.PushManager=context.PushManager;
  vm.runInNewContext(fs.readFileSync('push.js','utf8'),context);
  await context.window.FMZPush.enable({pushReady:true,publicKey:'AA',preferences:{push:false}},target);
  assert(calls.every(c=>c.actor==='account-a'),stage);
  assert.equal(calls.length,stage==='none'?2:stage==='subscribeRPC'?1:0,stage);
  if(stage!=='none')assert.match(target.textContent,/Account of sessie gewijzigd/);
 }
 const calls=[],context={authGeneration:1,onlineReady:true,onlineProfile:{id:'account-a'},window:{addEventListener(){}},navigator:{},FMZAgenda:{data:{preferences:{}},command:async(action)=>{calls.push(action);context.authGeneration++;context.onlineProfile={id:'account-b'};return true;}}};
 vm.runInNewContext(fs.readFileSync('push.js','utf8'),context);await context.window.FMZPush.disable({textContent:''});assert.deepEqual(calls,['preferences']);
});

/* Synthetic preview only. Served in place of the CDN by tests/preview.cjs. */
window.supabase={createClient(){
  const callbacks=[];
  const who=()=>sessionStorage.getItem('fmz-test-account');
  const ids={trainer:'11111111-1111-4111-8111-111111111111',a:'22222222-2222-4222-8222-222222222222',b:'33333333-3333-4333-8333-333333333333'};
  const user=()=>who()?{id:ids[who()],email:who()+'@example.test',user_metadata:{name:who()}}:null;
  const session=()=>user()?{user:user(),access_token:'synthetic-'+who()}:null;
  async function call(name,params){
    const response=await fetch('/__test__/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:who(),name,params})});
    return response.json();
  }
  window.expireTestSession=()=>{sessionStorage.removeItem('fmz-test-account');callbacks.forEach(cb=>cb('SIGNED_OUT',null));};
  return {
    rpc:call,
    from(table){return {select(){return this},eq(){return this},async maybeSingle(){return call('profile',{})}}},
    auth:{
      async getSession(){return {data:{session:session()},error:null}},
      async getUser(){return {data:{user:user()},error:user()?null:{message:'No session'}}},
      onAuthStateChange(cb){callbacks.push(cb);return {data:{subscription:{unsubscribe(){}}}}},
      async signInWithPassword({email}){const name=email.split('@')[0];if(!ids[name])return {error:{message:'Gebruik trainer@example.test, a@example.test of b@example.test'}};sessionStorage.setItem('fmz-test-account',name);return {data:{session:session(),user:user()},error:null}},
      async signOut(){window.expireTestSession();return {error:null}},
      async signUp(){return {error:{message:'Accountaanmaak is uitgeschakeld in de testpreview.'}}}
    }
  };
}};

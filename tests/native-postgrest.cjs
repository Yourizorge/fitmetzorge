/* Isolated PostgreSQL + official PostgREST. No Supabase production URL or key. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net'),cp=require('node:child_process'),Module=require('node:module');
const infra=path.join(__dirname,'artifacts/production-infra');
const {Client}=require('pg');
const connection={host:'127.0.0.1',port:55439,user:'postgres',database:'postgres',connectionTimeoutMillis:5000,query_timeout:15000};
async function setup(){
 const admin=new Client(connection);await admin.connect();
 const database='fmz_isolated_'+crypto.randomBytes(8).toString('hex');
 await admin.query('create database '+database);
 const client=new Client({...connection,database});await client.connect();
 await client.query("create extension if not exists pgcrypto; do $$begin if not exists(select 1 from pg_roles where rolname='authenticator') then create role authenticator login noinherit;end if;end$$;");
 const exec=async sql=>client.query(sql.replace(/\bcreate role (anon|authenticated|service_role)\s*;/gi,(_,role)=>`do $local_role$begin if not exists(select 1 from pg_roles where rolname='${role}') then create role ${role};end if;end$local_role$;`));
 const db={exec,query:(sql,args)=>client.query(sql,args),close:()=>client.end()};
 const filename=path.join(__dirname,'database.cjs'),mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;
 const original=mod.require.bind(mod);mod.require=id=>id==='@electric-sql/pglite'?{PGlite:class{constructor(){return db;}}}:original(id);
 mod._compile(fs.readFileSync(filename,'utf8'),filename);
 const fixture=await mod.exports.setup();
 fixture.org=await require('./accounting-database.cjs').extend(fixture);
 await require('./agenda-database.cjs').extend(fixture);
 await client.query('grant anon,authenticated to authenticator');
 let server;
 async function start(){
  const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
  const secret=crypto.randomBytes(40).toString('hex'),folder=path.join(infra,database);fs.mkdirSync(folder);
  const config=path.join(folder,'postgrest.conf');fs.writeFileSync(config,`db-uri = "postgresql://authenticator@127.0.0.1:55439/${database}"\ndb-schemas = "public"\ndb-anon-role = "anon"\njwt-secret = "${secret}"\nserver-host = "127.0.0.1"\nserver-port = ${port}\n`);
  const log=fs.openSync(path.join(folder,'server.log'),'a');server=cp.spawn(path.join(infra,'postgrest/postgrest.exe'),[config],{windowsHide:true,env:{...process.env,PATH:'C:\\Program Files\\PostgreSQL\\18\\bin;'+process.env.PATH},stdio:['ignore',log,log]});
  const origin='http://127.0.0.1:'+port;
  for(let i=0;i<80;i++){try{const r=await fetch(origin,{signal:AbortSignal.timeout(1000)});await r.arrayBuffer();break;}catch{if(i===79)throw Error('Local PostgREST did not start');await new Promise(r=>setTimeout(r,100));}}
  function token(actor='trainer',overrides={}){const payload={role:'authenticated',sub:fixture.ids[actor],session_id:fixture.ids[actor],email:actor+'@example.test',exp:Math.floor(Date.now()/1000)+600,...overrides};const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),body=b64({alg:'HS256',typ:'JWT'})+'.'+b64(payload);return body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url');}
  async function rpc(name,params={},actor='trainer',overrides){const headers={'Content-Type':'application/json'};if(actor)headers.Authorization='Bearer '+token(actor,overrides);const response=await fetch(origin+'/rpc/'+name,{method:'POST',headers,body:JSON.stringify(params),signal:AbortSignal.timeout(12000)});const body=await response.json();return{status:response.status,body};}
  return{origin,rpc,token};
 }
 async function cleanup(){if(server&&server.exitCode===null&&!server.killed){const stopped=new Promise(r=>server.once('exit',r));server.kill();await stopped;}await client.end();if(!/^fmz_isolated_[a-f0-9]{16}$/.test(database))throw Error('Unsafe cleanup database');await admin.query('drop database '+database+' with (force)');await admin.end();}
 return {...fixture,start,cleanup,database};
}
module.exports={setup};

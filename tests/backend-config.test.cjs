const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),load=()=>import('../scripts/backend-config.mjs');
const ref='abcdefghijklmnopqrst',key='sb_publishable_synthetic_test_public_key';
async function env(kind='test',extra={}){const m=await load();return {NETLIFY:'true',SITE_ID:kind==='production'?m.PRODUCTION_SITE:m.TEST_SITE,CONTEXT:'production',BRANCH:kind==='production'?'main':'staging',PS_BACKEND_ROLE:kind,PS_TEST_SUPABASE_URL:'https://'+ref+'.supabase.co',PS_TEST_SUPABASE_PUBLISHABLE_KEY:key,...extra};}
test('site identity, role and branch select live only on the production site main context',async()=>{
 const m=await load(),live=m.resolveBackend(await env('production'));
 assert.equal(live.environment,'production');assert.equal(live.project,m.PRODUCTION_PROJECT);
 assert.equal(m.resolveBackend(await env()).environment,'test');
 assert.equal(m.resolveBackend(await env('test',{SITE_ID:m.PRODUCTION_SITE,CONTEXT:'deploy-preview',BRANCH:'staging'})).project,ref);
 assert.equal(m.resolveBackend(await env('test',{SITE_ID:m.PRODUCTION_SITE,CONTEXT:'branch-deploy',BRANCH:'feature/demo'})).project,ref);
});
test('hosted builds without explicit role or isolated credentials fail closed',async()=>{
 const m=await load(),base=await env();for(const patch of [{PS_BACKEND_ROLE:''},{PS_TEST_SUPABASE_URL:''},{PS_TEST_SUPABASE_PUBLISHABLE_KEY:''},{SITE_ID:'unknown'},{BRANCH:'main'},{CONTEXT:'dev'}])assert.throws(()=>m.resolveBackend({...base,...patch}),/backend-config/);
 const live=await env('production');assert.throws(()=>m.resolveBackend({...live,PS_BACKEND_ROLE:''}),/explicit production/);
});
test('an isolated context can never select the live project or server credentials',async()=>{
 const m=await load(),base=await env();assert.throws(()=>m.resolveBackend({...base,PS_TEST_SUPABASE_URL:'https://'+m.PRODUCTION_PROJECT+'.supabase.co'}),/differ from production/);
 for(const value of ['sb_secret_do_not_publish_123',Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({role:'service_role',ref})).toString('base64url')+'.signature'])assert.throws(()=>m.resolveBackend({...base,PS_TEST_SUPABASE_PUBLISHABLE_KEY:value}),/server credentials are forbidden/);
 for(const url of ['http://'+ref+'.supabase.co','https://user:password@'+ref+'.supabase.co','https://'+ref+'.supabase.co/path','https://'+ref+'.supabase.co?token=hidden','https://elsewhere.invalid'])assert.throws(()=>m.resolveBackend({...base,PS_TEST_SUPABASE_URL:url}),/backend-config/);
});
test('local packaging is explicitly synthetic and cannot select an external project',async()=>{
 const m=await load();assert.equal(m.resolveBackend({}).environment,'synthetic');assert.equal(m.resolveBackend({PS_BACKEND_ROLE:'synthetic',PS_SYNTHETIC_URL:'http://127.0.0.1:1234'}).url,'http://127.0.0.1:1234');
 for(const e of [{PS_BACKEND_ROLE:'production'},{PS_SYNTHETIC_URL:'https://'+ref+'.supabase.co'},{PS_SYNTHETIC_URL:'ftp://localhost'},{SITE_ID:m.PRODUCTION_SITE},{CONTEXT:'production'}])assert.throws(()=>m.resolveBackend(e),/backend-config/);
});
test('generated runtime and enforced test CSP bind exactly the selected backend',async()=>{
 const m=await load(),config=m.resolveBackend(await env()),source=m.configuredModule(config),headers=m.backendHeaders(fs.readFileSync(path.join(ROOT,'_headers'),'utf8'),config);
 assert.ok(source.includes(JSON.stringify(config)));assert.equal((source.match(/PS_BACKEND_EMBED/g)||[]).length,1);
 assert.ok(!headers.includes(m.PRODUCTION_PROJECT));assert.ok(headers.includes(config.url)&&headers.includes(config.url.replace('https:','wss:')));
 assert.match(headers,/Content-Security-Policy: [^\n]+connect-src/);
 assert.equal(m.backendHeaders(fs.readFileSync(path.join(ROOT,'_headers'),'utf8'),m.resolveBackend(await env('production'))),fs.readFileSync(path.join(ROOT,'_headers'),'utf8'));
});
function browser(source,prior,extra={}){
 const local=new Map(prior?[['ps_sync_cfg',JSON.stringify(prior)],['real-data','untouched']]:[]),requests=[],sockets=[],mutations=[];
 function Socket(url){sockets.push(url);this.sent=[];}Socket.OPEN=1;Socket.prototype.send=function(message){this.sent.push(message);};
 if(extra.session)local.set('ps_sync_session',JSON.stringify(extra.session));
 const w={URL,URLSearchParams,atob,location:{href:extra.href||'https://preview.invalid/studio/app.html'},localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>{mutations.push(k);local.set(k,v);},removeItem:k=>{mutations.push(k);local.delete(k);}},fetch:async u=>{requests.push(String(u));return {ok:true};},WebSocket:Socket,document:{readyState:'loading',addEventListener(){}}};w.window=w;
 vm.runInNewContext(source,w);return {w,local,requests,sockets,mutations};
}
test('runtime permits its selected API and blocks another project for HTTP and Realtime',async()=>{
 const m=await load(),config=m.resolveBackend(await env()),{w,requests,sockets}=browser(m.configuredModule(config));
 await w.fetch(config.url+'/rest/v1/ps_library');await assert.rejects(w.fetch('https://'+m.PRODUCTION_PROJECT+'.supabase.co/rest/v1/ps_library'),/backend_environment_mismatch/);
 await w.fetch('/assets/example.svg');new w.WebSocket(config.url.replace('https:','wss:')+'/realtime/v1/websocket');assert.throws(()=>new w.WebSocket('wss://'+m.PRODUCTION_PROJECT+'.supabase.co/realtime/v1/websocket'),/backend_environment_mismatch/);
 assert.equal(requests.length,2);assert.equal(sockets.length,1);assert.equal(w.WebSocket.OPEN,1);
});
test('existing data from another backend is preserved and cannot be uploaded to either backend',async()=>{
 const m=await load(),config=m.resolveBackend(await env()),{w,local,requests,mutations}=browser(m.configuredModule(config),{url:'https://'+m.PRODUCTION_PROJECT+'.supabase.co',anonKey:'prior-public-key'});
 assert.equal(w.PSBackendConfig.blocked(),true);assert.equal(w.PS_SYNC.url,'');
 await assert.rejects(w.fetch(config.url+'/rest/v1/ps_kv'),/backend_environment_mismatch/);await assert.rejects(w.fetch('https://'+m.PRODUCTION_PROJECT+'.supabase.co/rest/v1/ps_kv'),/backend_environment_mismatch/);
 assert.equal(local.get('real-data'),'untouched');assert.equal(requests.length,0);assert.deepEqual(mutations,[]);
});
test('an existing incomplete backend identity cannot silently adopt a different environment',async()=>{
 const m=await load(),config=m.resolveBackend(await env()),{w,local,requests,mutations}=browser(m.configuredModule(config),{});
 assert.equal(w.PSBackendConfig.blocked(),true);await assert.rejects(w.fetch(config.url+'/rest/v1/ps_kv'),/backend_environment_mismatch/);
 assert.equal(local.get('real-data'),'untouched');assert.equal(local.get('ps_sync_cfg'),'{}');assert.deepEqual(mutations,[]);assert.equal(requests.length,0);
});
test('a stale custom backend cannot bypass the boundary and sync exits before reading its fallback',async()=>{
 const m=await load(),config=m.resolveBackend(await env()),old='https://private-backend.example.invalid',b=browser(m.configuredModule(config),{url:old,anonKey:'public-old'});
 await assert.rejects(b.w.fetch(old+'/rest/v1/ps_kv',{method:'POST',body:'synthetic-original'}),/backend_environment_mismatch/);
 assert.equal(b.requests.length,0);assert.deepEqual(b.mutations,[]);
 vm.runInNewContext(fs.readFileSync(path.join(ROOT,'studio/sync.js'),'utf8'),b.w);
 assert.equal(b.requests.length,0);assert.deepEqual(b.mutations,[]);assert.equal(b.local.get('real-data'),'untouched');
});
test('fixtures can patch the embedded configuration in source and packaged frames without a live backend',async()=>{
 const {fixtureBackend,sourceBackend}=await import('./fixtures/backend-config.mjs'),source=fs.readFileSync(path.join(ROOT,'studio/backend-config.js'));
 assert.equal(sourceBackend(ROOT).url,'https://synthetic-backend.invalid');
 const {w}=browser(fixtureBackend(source,'http://127.0.0.1:9999').toString());assert.equal(w.PS_SYNC.url,'http://127.0.0.1:9999');assert.equal(w.PSBackendConfig.environment,'synthetic');
});
const jwt=(project,extra={})=>Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({iss:'https://'+project+'.supabase.co/auth/v1',ref:project,...extra})).toString('base64url')+'.synthetic-signature';
test('a foreign session is never refreshed or sent when the old configuration is absent or already matches',async()=>{
 const m=await load(),config=m.resolveBackend(await env()),source=m.configuredModule(config);
 for(const prior of [null,{url:config.url,anonKey:config.anonKey}]){
  const old={at:jwt(m.PRODUCTION_PROJECT),rt:'synthetic-foreign-refresh'},b=browser(source,prior,{session:old});
  assert.equal(b.w.PSBackendConfig.blocked(),true);assert.equal(b.w.PS_SYNC.url,'');
  await assert.rejects(b.w.fetch(config.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:old.rt})}),/backend_environment_mismatch/);
  assert.equal(b.requests.length,0);assert.equal(b.local.get('ps_sync_session'),JSON.stringify(old));assert.deepEqual(b.mutations,[]);
 }
});
test('OAuth callback and request authorization are bound to the selected project',async()=>{
 const m=await load(),config=m.resolveBackend(await env()),source=m.configuredModule(config),foreign=jwt(m.PRODUCTION_PROJECT),own=jwt(ref);
 for(const token of [foreign,jwt(ref,{ref:m.PRODUCTION_PROJECT}),'opaque-token']){
  const b=browser(source,null,{href:'https://preview.invalid/#access_token='+token+'&refresh_token=synthetic-refresh'});assert.equal(b.w.PSBackendConfig.blocked(),true);assert.equal(b.requests.length,0);assert.deepEqual(b.mutations,[]);
 }
 const b=browser(source,null,{session:{at:own,rt:'synthetic-own-refresh'}});
 assert.equal(b.w.PSBackendConfig.blocked(),false);
 await b.w.fetch(config.url+'/rest/v1/ps_library',{headers:{Authorization:'Bearer '+own}});
 await b.w.fetch(config.url+'/auth/v1/token?grant_type=refresh_token',{headers:{apikey:config.anonKey},body:JSON.stringify({refresh_token:'synthetic-own-refresh'})});
 await assert.rejects(b.w.fetch(config.url+'/rest/v1/ps_library',{headers:{Authorization:'Bearer '+foreign}}),/backend_environment_mismatch/);
 await assert.rejects(b.w.fetch(config.url+'/auth/v1/token?grant_type=refresh_token',{body:JSON.stringify({refresh_token:'different-refresh'})}),/backend_environment_mismatch/);
 assert.equal(b.requests.length,2);
 const socket=new b.w.WebSocket(config.url.replace('https:','wss:')+'/realtime/v1/websocket');
 socket.send(JSON.stringify({payload:{access_token:own}}));assert.equal(socket.sent.length,1);
 assert.throws(()=>socket.send(JSON.stringify({payload:{access_token:foreign}})),/backend_environment_mismatch/);assert.equal(socket.sent.length,1);
 b.local.set('ps_sync_session',JSON.stringify({at:foreign,rt:'other'}));
 await assert.rejects(b.w.fetch(config.url+'/rest/v1/ps_library'),/backend_environment_mismatch/);assert.equal(b.w.PSBackendConfig.current().url,'');
 assert.throws(()=>socket.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{}})),/backend_environment_mismatch/);
});

test('empty backend settings cannot send bearer tokens to same-origin API paths',async()=>{
 const m=await load(),config=m.resolveBackend(await env()),b=browser(m.configuredModule(config),{url:'https://'+m.PRODUCTION_PROJECT+'.supabase.co'});
 for(const prefix of ['auth','rest','realtime','storage','functions'])await assert.rejects(b.w.fetch('/'+prefix+'/v1/user',{headers:{Authorization:'Bearer '+jwt(m.PRODUCTION_PROJECT)}}),/backend_environment_mismatch/);
 await b.w.fetch('/vendor/fonts.css');assert.deepEqual(b.requests,['/vendor/fonts.css']);assert.deepEqual(b.mutations,[]);
 const clean=browser(m.configuredModule(config));await assert.rejects(clean.w.fetch('/auth/v1/user'),/backend_environment_mismatch/);assert.equal(clean.requests.length,0);
});
test('raw standalone pages install the synthetic boundary before storage fallback',()=>{
 for(const file of fs.readdirSync(path.join(ROOT,'studio')).filter(f=>f.endsWith('.html'))){
  const source=fs.readFileSync(path.join(ROOT,'studio',file),'utf8'),storage=source.indexOf('<script src="storage.js"></script>');
  if(storage>=0)assert.ok(source.indexOf('<script src="backend-config.js"></script>')>=0&&source.indexOf('<script src="backend-config.js"></script>')<storage,file);
 }
});

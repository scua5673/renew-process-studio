'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const code=[section('function dataLockError()','function sensitiveLocalKey('),section('function signIn(','/* 2.256'),section('function linkIdentity(','function signOut('),
 section('function consumeHash()','/* ── 동기화 ── */')].join('\n');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const copy=x=>x==null?x:JSON.parse(JSON.stringify(x));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function session(uid='',extra={}){return {uid,email:uid===B?'synthetic-b@example.invalid':'',at:'synthetic-access-a',rt:'synthetic-refresh-a',exp:Date.now()+3600000,...extra};}
const userA={id:A,email:'synthetic-a@example.invalid',user_metadata:{provider:'google'}};
const userB={id:B,email:'synthetic-b@example.invalid',user_metadata:{provider:'kakao'}};
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>copy(body),text:async()=>JSON.stringify(body)});
function harness(initial=session(),options={}){
 let current=copy(initial);const writes=[],requests=[],hooks={},diagnostics=[],statuses=[],historyCalls=[],local=new Map(),timers=new Map();let timerId=0;
 const location={origin:'https://synthetic.invalid',pathname:'/studio/app.html',search:'?fixture=oauth',hash:'',href:'https://synthetic.invalid/studio/app.html'};
 const win={location};win.top=win;
 if(options.iframe){location.pathname='/studio/scout.html';location.href='https://synthetic.invalid/studio/scout.html';win.top={location:{origin:location.origin,pathname:'/studio/app.html',href:'https://synthetic.invalid/studio/app.html'}};}
 const c=vm.createContext({Promise,Date,String,Number,JSON,Error,URL,URLSearchParams,encodeURIComponent,decodeURIComponent,
  window:win,location,history:{replaceState(...args){historyCalls.push(args);location.hash='';}},
  BASE:'https://synthetic-auth.invalid',getSess:()=>copy(current),setSess(s){current=copy(s);writes.push(copy(s));},hj:at=>({Authorization:at?'Bearer '+at:'',apikey:'synthetic-public-key'}),
  localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)},
  fetch(url,opts){requests.push({url,opts});if(url.includes('/auth/v1/user/identities/authorize?'))return hooks.link?hooks.link(url,opts):Promise.resolve(response({url:'https://synthetic-provider.invalid/authorize'}));if(url.includes('/auth/v1/user'))return hooks.user?hooks.user(url,opts):Promise.resolve(response(userA));if(url.includes('/token?'))return hooks.refresh?hooks.refresh(url,opts):Promise.resolve(response({access_token:'synthetic-access-fresh',refresh_token:'synthetic-refresh-fresh',expires_in:3600}));throw Error('Unexpected network route');},
  signOutEpoch:0,refreshPromise:null,refreshRetryTimer:null,refreshRetryDelay:15000,syncErr:false,
  setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),navigator:{onLine:true},
  setStatus:msg=>statuses.push(msg),chip:msg=>statuses.push(msg),syncDiagnostic:(stage,e)=>diagnostics.push({stage,message:e?.message}),renderDataLock(){},dataUnlocked:()=>false,renderUI(){},syncNow:async()=>{}});
 vm.runInContext(code,c);
 return {c,win,location,writes,requests,hooks,diagnostics,statuses,historyCalls,local,timers,
  get session(){return copy(current);},setSession(s){current=copy(s);},
  callback(at='synthetic-access-a',rt='synthetic-refresh-a'){location.hash='#access_token='+encodeURIComponent(at)+'&refresh_token='+encodeURIComponent(rt)+'&expires_in=3600';return c.consumeHash();},
  start(mode){if(mode==='callback'){assert.equal(this.callback(),true);return Promise.resolve({ok:true});}return c.ensureSessionIdentity().then(value=>({ok:true,value:copy(value)}),error=>({ok:false,error}));}
 };
}
for(const mode of ['callback','ensure']){
 test(mode+': late A user lookup cannot overwrite a newer B login',async()=>{
  const h=harness(),g=deferred();h.hooks.user=()=>g.promise;const run=h.start(mode);await tick();assert.equal(h.requests.length,1);
  const newer=session(B,{at:'synthetic-access-b',rt:'synthetic-refresh-b'});h.setSession(newer);const writes=h.writes.length;
  g.resolve(response(userA));await run;await tick();assert.deepEqual(h.session,newer);assert.equal(h.writes.length,writes);
 });
 test(mode+': logout while /user is pending cannot resurrect a session',async()=>{
  const h=harness(),g=deferred();h.hooks.user=()=>g.promise;const run=h.start(mode);await tick();h.setSession(null);h.c.signOutEpoch++;
  const writes=h.writes.length;g.resolve(response(userA));await run;await tick();assert.equal(h.session,null);assert.equal(h.writes.length,writes);
 });
 test(mode+': logout and same-token login still invalidate the earlier generation',async()=>{
  const h=harness(),g=deferred();h.hooks.user=()=>g.promise;const run=h.start(mode);await tick();h.c.signOutEpoch++;const newer=session('',{email:'new-login@example.invalid'});h.setSession(newer);
  const writes=h.writes.length;g.resolve(response(userA));await run;await tick();assert.deepEqual(h.session,newer);assert.equal(h.writes.length,writes);
 });
 test(mode+': the same current token fills its UID and email normally',async()=>{
  const h=harness();const run=await h.start(mode);await tick();assert.equal(h.session.uid,A);assert.equal(h.session.email,userA.email);assert.equal(h.session.at,'synthetic-access-a');assert.equal(h.session.rt,'synthetic-refresh-a');
  assert.equal(h.requests[0].opts.headers.Authorization,'Bearer synthetic-access-a');assert.equal(run.ok,true);
 });
 test(mode+': same UID with a rotated token keeps the newer session and profile',async()=>{
  const h=harness(),g=deferred();h.hooks.user=()=>g.promise;const run=h.start(mode);await tick();
  const newer=session(A,{at:'synthetic-access-fresh',rt:'synthetic-refresh-fresh',email:'fresh-a@example.invalid'});h.setSession(newer);const writes=h.writes.length;
  g.resolve(response(userA));await run;await tick();assert.deepEqual(h.session,newer);assert.equal(h.writes.length,writes);
 });
 test(mode+': an old token user ID cannot replace an already bound different UID',async()=>{
  const h=harness(),g=deferred();h.hooks.user=()=>g.promise;const run=h.start(mode);await tick();
  const bound=session(B);h.setSession(bound);const writes=h.writes.length;g.resolve(response(userA));await run;await tick();assert.deepEqual(h.session,bound);assert.equal(h.writes.length,writes);
 });
 test(mode+': a switch during response JSON parsing is also rejected',async()=>{
  const h=harness(),g=deferred();h.hooks.user=async()=>({ok:true,status:200,json:()=>g.promise});const run=h.start(mode);await tick();
  const newer=session(B,{at:'synthetic-access-b',rt:'synthetic-refresh-b'});h.setSession(newer);const writes=h.writes.length;g.resolve(userA);await run;await tick();assert.deepEqual(h.session,newer);assert.equal(h.writes.length,writes);
 });
}
test('ensure identity after an actual token refresh binds the refreshed token user',async()=>{
 const h=harness(session('',{exp:1}));const result=await h.c.ensureSessionIdentity();
 assert.equal(result.uid,A);assert.equal(h.session.uid,A);assert.equal(h.session.at,'synthetic-access-fresh');assert.equal(h.session.rt,'synthetic-refresh-fresh');
 assert.equal(h.requests.filter(r=>r.url.includes('/token?')).length,1);assert.equal(h.requests.find(r=>r.url.endsWith('/user')).opts.headers.Authorization,'Bearer synthetic-access-fresh');
});
test('switch while refreshing identity must not query or bind the new login with the old request',async()=>{
 const h=harness(session('',{exp:1})),g=deferred();h.hooks.refresh=()=>g.promise;const run=h.start('ensure');await tick();
 const newer=session(B,{at:'synthetic-access-b',rt:'synthetic-refresh-b'});h.setSession(newer);g.resolve(response({access_token:'old-refreshed',refresh_token:'old-refreshed-rt',expires_in:3600,user:userA}));
 const result=await run;assert.equal(result.ok,false);assert.deepEqual(h.session,newer);assert.equal(h.requests.filter(r=>r.url.endsWith('/user')).length,0);
});
test('two actual OAuth callbacks retain B when the earlier A response arrives last',async()=>{
 const h=harness(null),a=deferred(),b=deferred();h.hooks.user=(_url,opts)=>opts.headers.Authorization==='Bearer synthetic-access-b'?b.promise:a.promise;
 assert.equal(h.callback(),true);assert.equal(h.callback('synthetic-access-b','synthetic-refresh-b'),true);assert.equal(h.c.signOutEpoch,2);
 b.resolve(response(userB));await tick();const newer=h.session,writes=h.writes.length;assert.equal(newer.uid,B);assert.equal(newer.email,userB.email);
 a.resolve(response(userA));await tick();assert.deepEqual(h.session,newer);assert.equal(h.writes.length,writes);
});
test('an actual new OAuth callback invalidates identity work awaiting a token refresh',async()=>{
 const h=harness(session('',{exp:1})),g=deferred();h.hooks.refresh=()=>g.promise;h.hooks.user=async()=>response(userB);const run=h.start('ensure');await tick();
 assert.equal(h.callback('synthetic-access-b','synthetic-refresh-b'),true);await tick();assert.equal(h.session.uid,B);const newer=h.session,writes=h.writes.length;
 g.resolve(response({access_token:'old-refreshed',refresh_token:'old-refreshed-rt',expires_in:3600,user:userA}));const result=await run;
 assert.equal(result.ok,false);assert.deepEqual(h.session,newer);assert.equal(h.writes.length,writes);assert.deepEqual(h.requests.filter(r=>r.url.endsWith('/user')).map(r=>r.opts.headers.Authorization),['Bearer synthetic-access-b']);
});
test('a refreshed session with a bound UID rejects a mismatched user response',async()=>{
 const h=harness(session('',{exp:1}));h.hooks.refresh=async()=>response({access_token:'synthetic-access-fresh',refresh_token:'synthetic-refresh-fresh',expires_in:3600,user:userA});h.hooks.user=async()=>response(userB);
 const result=await h.start('ensure');assert.equal(result.ok,false);assert.equal(h.session.uid,A);assert.equal(h.session.email,userA.email);assert.equal(h.session.at,'synthetic-access-fresh');assert.equal(h.writes.length,1);
});
test('an already identified current session is returned without another user request',async()=>{
 const initial=session(A,{email:userA.email}),h=harness(initial);assert.deepEqual(copy(await h.c.ensureSessionIdentity()),initial);assert.equal(h.requests.length,0);assert.equal(h.writes.length,0);
});
test('callback removes token fragment and preserves the application path and query',async()=>{
 const h=harness();assert.equal(h.callback(),true);await tick();assert.equal(h.location.hash,'');assert.equal(h.historyCalls[0][2],'/studio/app.html?fixture=oauth');
 assert.ok(!h.historyCalls[0][2].includes('synthetic-access'));assert.equal(h.session.uid,A);
});
test('unsuccessful user lookup leaves the unresolved current tokens intact',async()=>{
 const h=harness();h.hooks.user=async()=>response({error:'synthetic unauthorized'},401);assert.equal(h.callback(),true);await tick();assert.equal(h.session.uid,'');assert.equal(h.session.at,'synthetic-access-a');assert.equal(h.writes.length,1);
});
for(const iframe of [false,true])for(const provider of ['google','kakao'])test(provider+' authorization uses its exact provider '+(iframe?'from a same-origin iframe':'at top level'),()=>{
 const h=harness(null,{iframe}),own=h.location.href,sessionBefore=h.session;h.c.signIn(provider);const destination=iframe?h.win.top.location.href:h.location.href,url=new URL(destination);
 assert.equal(url.origin,'https://synthetic-auth.invalid');assert.equal(url.pathname,'/auth/v1/authorize');assert.equal(url.searchParams.get('provider'),provider);
 assert.equal(url.searchParams.get('redirect_to'),'https://synthetic.invalid/studio/app.html');assert.equal(url.searchParams.get('prompt'),provider==='google'?'select_account':null);
 if(iframe)assert.equal(h.location.href,own);assert.deepEqual(h.session,sessionBefore);assert.equal(h.writes.length,0);assert.equal(h.requests.length,0);
});
for(const provider of ['facebook','google&provider=kakao','',undefined])test('unsupported provider does not navigate: '+String(provider),()=>{
 const h=harness(null),before=h.location.href;let rejected=false;try{rejected=h.c.signIn(provider)===false;}catch(_){rejected=true;}
 assert.equal(h.location.href,before);assert.equal(rejected,true);assert.equal(h.writes.length,0);assert.equal(h.requests.length,0);
});
for(const provider of ['google','kakao'])test('link '+provider+' sends current credentials and navigates only to its successful server URL',async()=>{
 const iframe=provider==='kakao',h=harness(session(A),{iframe}),g=deferred(),target=iframe?h.win.top.location:h.location,before=target.href,own=h.location.href,initial=h.session;
 h.hooks.link=()=>g.promise;h.c.linkIdentity(provider);await tick();assert.equal(h.requests.length,1);assert.equal(target.href,before);
 const request=h.requests[0],url=new URL(request.url);assert.equal(url.origin,'https://synthetic-auth.invalid');assert.equal(url.pathname,'/auth/v1/user/identities/authorize');
 assert.equal(url.searchParams.get('provider'),provider);assert.equal(url.searchParams.get('redirect_to'),'https://synthetic.invalid/studio/app.html');assert.equal(url.searchParams.get('skip_http_redirect'),'true');
 assert.equal(url.searchParams.get('prompt'),provider==='google'?'select_account':null);assert.equal(request.opts.headers.Authorization,'Bearer synthetic-access-a');assert.equal(request.opts.headers.apikey,'synthetic-public-key');
 const returned='https://synthetic-provider.invalid/'+provider+'/link?state=server-generated';g.resolve(response({url:returned}));await tick();assert.equal(target.href,returned);
 if(iframe)assert.equal(h.location.href,own);assert.deepEqual(h.session,initial);assert.equal(h.writes.length,0);
});
test('link identity uses the refreshed access token instead of an expired login token',async()=>{
 const h=harness(session(A,{exp:1}));h.c.linkIdentity('google');await tick();
 assert.equal(h.requests.length,2);assert.ok(h.requests[0].url.includes('/token?'));const request=h.requests[1];assert.ok(request.url.includes('/identities/authorize?'));
 assert.equal(request.opts.headers.Authorization,'Bearer synthetic-access-fresh');assert.equal(h.location.href,'https://synthetic-provider.invalid/authorize');assert.equal(h.session.uid,A);
});
test('invalid linking providers never request a token refresh or authorization',async()=>{
 for(const provider of ['facebook','google&provider=kakao','',undefined]){
  const h=harness(session(A,{exp:1}),{iframe:true}),before=h.win.top.location.href,initial=h.session;h.c.linkIdentity(provider);await tick();
  assert.equal(h.requests.length,0);assert.equal(h.win.top.location.href,before);assert.deepEqual(h.session,initial);assert.equal(h.writes.length,0);assert.ok(h.statuses.length>0);
 }
});
test('link identity stays in the app when the server rejects or omits a usable result',async()=>{
 const replies=[response({url:'https://synthetic-provider.invalid/rejected'},403),response({}),{ok:true,status:200,text:async()=>'<invalid-json>'}];
 for(const reply of replies){
  const h=harness(session(A)),before=h.location.href,initial=h.session;h.hooks.link=async()=>reply;h.c.linkIdentity('google');await tick();
  assert.equal(h.location.href,before);assert.deepEqual(h.session,initial);assert.equal(h.writes.length,0);assert.equal(h.requests.length,1);assert.ok(h.statuses.length>0);
 }
});

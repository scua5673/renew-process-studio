'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const code=[section('function clearExpiredWorkspaceGuard(lock){','function workspaceSwitchGuardStart(from,to){'),section('function getSess(){','/* 2.627'),section('function dataUnlocked(){','function sensitiveLocalKey('),section('function authPreparationCurrent(','function signIn('),section('function consumeHash(','function ensureToken('),section('  function recheckAuth(){',"  document.addEventListener('load'")].join('\n');
const tick=()=>new Promise(r=>setImmediate(r));
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function session(uid='A',name='old'){return{uid,at:uid+'-'+name,rt:uid+'-refresh-'+name,exp:Date.now()+3600000,email:uid+'@synthetic.invalid'};}
function harness(){
 const local=new Map([['ps_sync_session',JSON.stringify(session())]]),tab=new Map(),events={},hooks={},calls={reloads:[],prepares:[],sync:[],fetch:[],notices:[],lock:[],errors:[]};
 let hash='';const location={pathname:'/studio/app.html',search:'?test=synthetic',get hash(){return hash;},set hash(value){if(hooks.hashFailure)throw Error('synthetic hash restriction');hash=value;},reload(){calls.reloads.push({hash,session:c.getSess(),unlocked:c.dataUnlocked()});}};
 const c={Promise,JSON,Date,Error,String,Object,Number,decodeURIComponent,encodeURIComponent,location,SKEY:'ps_sync_session',OWNERKEY:'owner',CFG:{anonKey:'synthetic'},BASE:'https://synthetic.invalid',
  signOutEpoch:0,authPreparePromise:null,authPrepareOwner:null,oauthCallbackIssue:null,dataReady:true,tabReadyUid:'A',tabReadyWid:'WA',externalSwitchFrozen:false,
  localStorage:{getItem:k=>local.get(k)||null,setItem(k,v){if(hooks.storageFailure&&k==='ps_sync_session')throw Error('synthetic quota');local.set(k,String(v));},removeItem:k=>local.delete(k)},
  sessionStorage:{getItem:k=>tab.get(k)||null,setItem:(k,v)=>tab.set(k,String(v)),removeItem:k=>tab.delete(k)},
  history:{replaceState(_a,_b,url){if(hooks.historyFailure)throw Error('synthetic history restriction');hash='';calls.cleanUrl=url;}},
  document:{getElementById:()=>null},navigator:{onLine:true},cacheOwner:()=>({uid:'A',wid:'WA'}),activeWs:()=>'WA',freezeForPendingExternalSwitch:()=>false,setCacheOwner:()=>true,
  setStatus:msg=>calls.notices.push(msg),chip:msg=>calls.notices.push(msg),renderUI(){},renderDataLock:on=>calls.lock.push(on),broadcastAuthState(){},syncDiagnostic:(stage,e)=>calls.errors.push({stage,name:e.name}),expireStashes(){},
  withWorkspaceTransitionLock:fn=>hooks.lock?hooks.lock(fn):Promise.resolve().then(fn),
  loadWorkspacesCore(){const s=c.getSess();calls.prepares.push(s);return hooks.prepare?hooks.prepare(s):Promise.resolve([]);},
  ensureToken:()=>Promise.resolve(c.getSess()?.at),syncNow:reason=>{calls.sync.push(reason);return Promise.resolve({});},
  fetch(url,options){calls.fetch.push({url,at:options.headers.Authorization});return hooks.user?hooks.user():Promise.resolve({ok:true,json:async()=>({id:'B',email:'B@synthetic.invalid'})});},
  addEventListener:(name,fn)=>{(events[name]||(events[name]=[])).push(fn);}
 };c.window=c;vm.createContext(c);vm.runInContext(code,c);
 return{c,hooks,calls,events,local,tab,hash(value){hash=value;},emit(name){for(const fn of events[name]||[])fn();},session(s){local.set('ps_sync_session',JSON.stringify(s));},get saved(){return c.getSess();}};
}
const callback='#access_token=B-google&refresh_token=B-refresh-google&expires_in=3600';
for(const event of ['hashchange','pageshow','focus'])test(event+' consumes a same-document callback once and reloads a clean, locked document',async()=>{
 const h=harness();h.hash(callback);h.emit(event);assert.equal(h.calls.reloads.length,1);assert.equal(h.saved.at,'B-google');assert.equal(h.saved.uid,'');assert.equal(h.c.dataUnlocked(),false);assert.equal(h.calls.reloads[0].hash,'');assert.equal(h.calls.fetch.length,0);
 h.emit('hashchange');await tick();assert.equal(h.calls.reloads.length,1);assert.equal(h.calls.prepares.length,0);
});
test('a normal view fragment does not change session, lock state, or navigation',()=>{
 const h=harness(),before=h.saved;h.hash('#view=attrs');h.emit('hashchange');assert.deepEqual(h.saved,before);assert.equal(h.c.dataUnlocked(),true);assert.equal(h.calls.reloads.length,0);assert.equal(h.calls.prepares.length,0);
});
test('history replacement failure clears the fragment before the sole reload',()=>{
 const h=harness();h.hooks.historyFailure=true;h.hash(callback);h.emit('hashchange');assert.equal(h.calls.reloads.length,1);assert.equal(h.calls.reloads[0].hash,'');h.emit('hashchange');assert.equal(h.calls.reloads.length,1);
});
test('unremovable callback URL fails closed without a reload loop',()=>{
 const h=harness();h.hooks.historyFailure=true;h.hooks.hashFailure=true;h.hash(callback);h.emit('hashchange');assert.equal(h.calls.reloads.length,0);assert.equal(h.c.dataUnlocked(),false);assert.ok(h.c.oauthCallbackIssue);assert.ok(h.tab.has('ps_oauth_callback_issue'));
});
for(const fragment of [callback,'#access_token=B-google','#refresh_token=B-refresh-google'])test('failed or incomplete callback cannot silently reopen the old account: '+fragment.split('=')[0],async()=>{
 const h=harness();h.hooks.storageFailure=true;h.hash(fragment);h.emit('hashchange');assert.equal(h.saved.uid,'A');assert.equal(h.c.dataUnlocked(),false);assert.ok(h.c.oauthCallbackIssue);assert.equal(h.calls.reloads.length,0);
 h.hooks.storageFailure=false;h.c.oauthCallbackContinue();await tick();assert.equal(h.c.oauthCallbackIssue,null);assert.equal(h.c.location.hash,'');assert.equal(h.tab.has('ps_oauth_callback_issue'),false);assert.equal(h.calls.prepares.length,1);assert.deepEqual(h.calls.sync,['oauth-previous-account']);
 h.c.setDataReady(true,'A','WA',true);h.emit('hashchange');h.emit('focus');await tick();assert.equal(h.c.oauthCallbackIssue,null);assert.equal(h.calls.reloads.length,0);assert.equal(h.calls.prepares.length,1);
});
for(const fragment of ['#error=access_denied&error_description=User+cancelled','#error_code=identity_already_exists'])test('provider cancellation or identity-link failure preserves the existing account without a new lock',()=>{
 const h=harness(),before=h.saved;h.hash(fragment);h.emit('hashchange');assert.deepEqual(h.saved,before);assert.equal(h.c.oauthCallbackIssue,null);assert.equal(h.c.dataUnlocked(),true);assert.equal(h.c.location.hash,'');assert.equal(h.calls.reloads.length,0);assert.ok(h.calls.notices.some(x=>x.includes('로그인 실패')));
});
test('successful retry and explicit logout both clear a stored callback failure',()=>{
 const h=harness();h.c.oauthCallbackSetIssue('synthetic failure');h.hash(callback);h.emit('hashchange');assert.equal(h.c.oauthCallbackIssue,null);assert.equal(h.tab.size,0);assert.equal(h.calls.reloads.length,1);
 h.c.oauthCallbackSetIssue('synthetic failure');h.c.setSess(null);assert.equal(h.c.oauthCallbackIssue,null);assert.equal(h.tab.size,0);assert.equal(h.saved,null);
});
test('callback failure survives a reload, and does not latch an independently replaced account',()=>{
 const h=harness();h.c.oauthCallbackSetIssue('synthetic failure');const restore=section('var oauthCallbackIssue=null;','var syncErr=');vm.runInContext(restore,h.c);assert.ok(h.c.oauthCallbackIssue);assert.equal(h.c.dataUnlocked(),false);
 h.session(session('B'));vm.runInContext(restore,h.c);assert.equal(h.c.oauthCallbackIssue,null);assert.equal(h.tab.size,0);
});
test('a linked Google callback may correctly resolve to the previous Kakao UID',async()=>{
 const h=harness();h.hooks.user=async()=>({ok:true,json:async()=>({id:'A',email:'A@synthetic.invalid',app_metadata:{provider:'kakao',providers:['kakao','google']},identities:[{provider:'kakao'},{provider:'google'}]})});h.hash(callback);assert.equal(h.c.consumeHash(),true);await tick();assert.equal(h.saved.uid,'A');assert.equal(h.saved.at,'B-google');assert.equal(h.c.oauthCallbackIssue,null);
});
test('new callback gets a distinct auth preparation flight and old completion cannot clear it',async()=>{
 const h=harness(),a=gate(),b=gate();h.hooks.prepare=s=>s.uid==='A'?a.promise:b.promise;const old=h.c.loadWorkspaces(),oldRejected=assert.rejects(old,e=>e.psDataLocked);await tick();h.hash(callback);h.c.consumeHash({deferIdentity:true});const latest=h.c.loadWorkspaces();await tick();assert.notEqual(old,latest);assert.equal(h.calls.prepares.length,2);
 a.resolve([]);await oldRejected;assert.equal(h.c.authPreparePromise,latest);assert.equal(h.c.loadWorkspaces(),latest);b.resolve([]);await latest;assert.equal(h.c.authPreparePromise,null);
});
test('a queued old preparation cannot bootstrap a new callback session',async()=>{
 const h=harness(),lock=gate();h.hooks.lock=fn=>lock.promise.then(fn);const old=h.c.loadWorkspaces(),rejected=assert.rejects(old,e=>e.psDataLocked);h.hash(callback);h.c.consumeHash({deferIdentity:true});lock.resolve();await rejected;assert.equal(h.calls.prepares.length,0);
});
test('an incomplete callback invalidates the earlier preparation even though old credentials are preserved',async()=>{
 const h=harness(),g=gate();h.hooks.prepare=()=>g.promise;const old=h.c.loadWorkspaces(),rejected=assert.rejects(old,e=>e.psDataLocked);await tick();h.hash('#refresh_token=incomplete');h.emit('hashchange');assert.equal(h.saved.uid,'A');assert.equal(h.c.dataUnlocked(),false);g.resolve([]);await rejected;assert.equal(h.c.dataUnlocked(),false);
});
test('same-UID token rotation retains an existing preparation, while a fresh same-UID OAuth login replaces it',async()=>{
 const h=harness(),g=gate();h.hooks.prepare=()=>g.promise;const old=h.c.loadWorkspaces();await tick();h.session(session('A','rotated'));assert.equal(h.c.loadWorkspaces(),old);g.resolve([]);await old;
 const a=gate(),b=gate();let n=0;h.hooks.prepare=()=>++n===1?a.promise:b.promise;const prior=h.c.loadWorkspaces(),rejected=assert.rejects(prior,e=>e.psDataLocked);await tick();h.hash('#access_token=A-google&refresh_token=A-refresh-google');h.c.consumeHash({deferIdentity:true});h.session(session('A','google'));const latest=h.c.loadWorkspaces();await tick();assert.notEqual(prior,latest);a.resolve([]);await rejected;b.resolve([]);await latest;
});

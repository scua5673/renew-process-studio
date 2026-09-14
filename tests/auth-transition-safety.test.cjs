'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const code=[section('function getSess(){','/* 2.627'),section('function dataLockError(){','function sensitiveLocalKey('),section('function signOut(){','/* ── 동기화 ── */')].join('\n');
const copy=x=>x==null?x:JSON.parse(JSON.stringify(x)),tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function session(uid='A',suffix='old',exp=1){return{uid,email:uid+'@synthetic.invalid',at:uid+'-'+suffix+'-at',rt:uid+'-'+suffix+'-rt',exp};}
function response(j,status=200){return{ok:status>=200&&status<300,status,json:async()=>copy(j),text:async()=>JSON.stringify(j)};}
function refreshed(uid='A',suffix='fresh'){return{access_token:uid+'-'+suffix+'-at',refresh_token:uid+'-'+suffix+'-rt',expires_in:3600,user:{id:uid,email:uid+'@synthetic.invalid'}};}
function harness(initial=session('A','old',Date.now()+3600000)){
  const local=new Map([['ps_sync_session',JSON.stringify(initial)],['cs_notes_v1','preserve synthetic private draft']]),hooks={},requests=[],writes=[],statuses=[],diagnostics=[],timers=new Map(),calls={barriers:0,sync:0,pending:0,hide:0};let wid='team-A',wsEpoch='0',timer=0;
  const location={hash:'',pathname:'/studio/app.html',search:'',href:'https://synthetic.invalid/studio/app.html'};
  const c={Promise,JSON,Date,Error,URL,URLSearchParams,decodeURIComponent,encodeURIComponent,SKEY:'ps_sync_session',CFG:{anonKey:'synthetic-public-key'},BASE:'https://synthetic.invalid',location,
    history:{replaceState(){location.hash='';}},localStorage:{getItem:k=>local.get(k)||null,setItem(k,v){if(hooks.storageFailure&&k==='ps_sync_session')throw Error('synthetic quota');local.set(k,String(v));writes.push(k);},removeItem(k){if(hooks.removeFailure&&k==='ps_sync_session')throw Error('synthetic removal blocked');local.delete(k);writes.push(k);}},
    signOutEpoch:0,signOutPromise:null,signOutOwner:null,refreshPromise:null,refreshOwner:null,refreshRetryTimer:null,refreshRetryDelay:15000,syncErr:false,switching:false,
    activeWs:()=>wid,workspaceSwitchEpochRaw:()=>wsEpoch,dataUnlocked:()=>!!c.getSess(),setDataReady(){},renderUI(){},renderDataLock(){},setStatus:x=>statuses.push(x),chip:x=>statuses.push(x),syncDiagnostic:(stage,e)=>diagnostics.push({stage,code:e?.psCode}),
    navigator:{onLine:true},document:{getElementById:()=>null},showSwitchOverlay(){},hideSwitchOverlay(){calls.hide++;},
    workspaceSwitchWriteBarrier(){calls.barriers++;return hooks.barrier?hooks.barrier(calls.barriers):Promise.resolve({ok:true});},forceSync(){calls.sync++;return hooks.sync?hooks.sync():Promise.resolve({ok:true});},
    logoutBlockingPendingKeys(){calls.pending++;return hooks.pending?hooks.pending():Promise.resolve([]);},withTimeout:p=>p,
    syncIssue:(code,stage,message)=>Object.assign(Error(message),{psCode:code,stage}),classifySyncError:e=>({code:e.psCode||'synthetic'}),keyLabel:k=>k,
    setTimeout(fn,ms){const id=++timer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),syncNow:async()=>{},
    fetch(url,options={}){requests.push({url,options});if(url.endsWith('/logout'))return Promise.resolve(response({}));if(url.endsWith('/user')){const at=options.headers.Authorization.slice(7);return Promise.resolve(response({id:at.split('-')[0],email:at.split('-')[0]+'@synthetic.invalid'}));}if(url.includes('/token?'))return hooks.refresh?hooks.refresh(url,options):Promise.resolve(response(refreshed(c.getSess()?.uid||'A')));throw Error('Unexpected synthetic route');}
  };c.window=c;vm.createContext(c);vm.runInContext(code,c);
  function change(s,notify=true){const oldValue=local.get('ps_sync_session')||null,newValue=s?JSON.stringify(s):null;if(newValue)local.set('ps_sync_session',newValue);else local.delete('ps_sync_session');if(notify&&c.sessionStorageOwnerChanged({oldValue,newValue}))c.signOutEpoch++;}
  return{c,local,hooks,requests,writes,statuses,diagnostics,timers,calls,change,get session(){return copy(c.getSess());},switch(next){wid=next;wsEpoch=String(+wsEpoch+1);},
    async callback(uid,suffix='new-login'){location.hash='#access_token='+uid+'-'+suffix+'-at&refresh_token='+uid+'-'+suffix+'-rt&expires_in=3600';assert.equal(c.consumeHash(),true);await tick();assert.equal(c.getSess().uid,uid);},
    logouts:()=>requests.filter(r=>r.url.endsWith('/logout')),refreshes:()=>requests.filter(r=>r.url.includes('/token?'))};
}
test('parallel refresh callers for one unchanged session share one request',async()=>{
 const h=harness(session()),g=deferred();h.hooks.refresh=()=>g.promise;const a=h.c.ensureToken(),b=h.c.ensureToken();assert.equal(a,b);await tick();assert.equal(h.refreshes().length,1);g.resolve(response(refreshed()));assert.equal(await a,'A-fresh-at');assert.equal(h.session.uid,'A');assert.equal(h.c.refreshPromise,null);
});
test('a later account refresh runs independently and an earlier completion cannot clear its flight',async()=>{
 const h=harness(session()),a=deferred(),b=deferred();h.hooks.refresh=(_u,o)=>JSON.parse(o.body).refresh_token.startsWith('B-')?b.promise:a.promise;
 const old=h.c.ensureToken();await tick();h.change(session('B'));const newer=h.c.ensureToken();await tick();assert.notEqual(old,newer);assert.equal(h.refreshes().length,2);
 a.resolve(response(refreshed()));assert.equal(await old,null);assert.equal(h.c.refreshPromise,newer);assert.equal(h.c.ensureToken(),newer);b.resolve(response(refreshed('B')));assert.equal(await newer,'B-fresh-at');assert.equal(h.session.uid,'B');assert.equal(h.c.refreshPromise,null);
});
for(const failure of [false,true])test('A-B-A login generations preserve the newest refresh after stale '+(failure?'errors':'successes'),async()=>{
 const h=harness(session()),gates=[];h.hooks.refresh=()=>{const g=deferred();gates.push(g);return g.promise;};const runs=[h.c.ensureToken()];await tick();
 h.change(session('B'));runs.push(h.c.ensureToken());await tick();h.change(session('A','new-login'));runs.push(h.c.ensureToken());await tick();assert.equal(gates.length,3);
 const before=h.session,notice=h.statuses.length;for(let i=0;i<2;i++){gates[i].resolve(response(failure?{code:'refresh_token_not_found'}:refreshed(i?'B':'A'),failure?400:200));assert.equal(await runs[i],null);assert.deepEqual(h.session,before);assert.equal(h.c.refreshPromise,runs[2]);}
 assert.equal(h.statuses.length,notice);gates[2].resolve(response(refreshed('A','newest')));assert.equal(await runs[2],'A-newest-at');assert.equal(h.session.rt,'A-newest-rt');
});
for(const change of ['logout','same-uid-rotation'])test('late failed refresh preserves '+change,async()=>{
 const h=harness(session()),g=deferred();h.hooks.refresh=()=>g.promise;const run=h.c.ensureToken();await tick();h.change(change==='logout'?null:session('A','rotated',Date.now()+3600000));const before=h.session;g.resolve(response({code:'refresh_token_not_found'},400));assert.equal(await run,null);assert.deepEqual(h.session,before);assert.equal(h.local.has('ps_login_expired'),false);assert.equal(h.statuses.length,0);
});
for(const body of [{},{access_token:'incomplete'}, {access_token:'valid',refresh_token:''},{access_token:4,refresh_token:'valid'},refreshed('B')])test('invalid refresh payload retains current tokens: '+JSON.stringify(body),async()=>{
 const h=harness(session()),before=h.session;h.hooks.refresh=async()=>response(body);await assert.rejects(h.c.ensureToken(),/invalid refresh response|owner mismatch/);assert.deepEqual(h.session,before);assert.equal(h.writes.length,0);assert.equal(h.c.refreshPromise,null);assert.equal(h.timers.size,1);
});
test('a failed session persistence never reports a refreshed token as usable',async()=>{
 const h=harness(session()),before=h.session;h.hooks.storageFailure=true;await assert.rejects(h.c.ensureToken(),/storage unavailable/);assert.deepEqual(h.session,before);assert.equal(h.c.refreshPromise,null);
});
test('refresh retains identity resolved concurrently for the same original token',async()=>{
 const h=harness(session('')),g=deferred();h.hooks.refresh=()=>g.promise;const run=h.c.ensureToken();await tick();h.change({...h.session,uid:'A',email:'resolved@synthetic.invalid'},false);g.resolve(response({access_token:'A-fresh-at',refresh_token:'A-fresh-rt'}));await run;assert.equal(h.session.uid,'A');assert.equal(h.session.email,'resolved@synthetic.invalid');
});
for(const stage of ['first barrier','sync','last barrier','pending check'])test('a new same-UID OAuth login cancels old logout at '+stage,async()=>{
 const h=harness(),g=deferred();if(stage.includes('barrier'))h.hooks.barrier=n=>(n===(stage==='first barrier'?1:2)?g.promise:Promise.resolve({ok:true}));else if(stage==='sync')h.hooks.sync=()=>g.promise;else h.hooks.pending=()=>g.promise;
 const run=h.c.signOut();await tick();await h.callback('A');const newest=h.session,notice=h.statuses.length;g.resolve(stage==='pending check'?[]:{ok:true});assert.equal(await run,false);assert.deepEqual(h.session,newest);assert.equal(h.logouts().length,0);assert.equal(h.statuses.length,notice);assert.equal(h.calls.hide,0);
});
test('repeated A-B-A logins cannot revive the original logout intent',async()=>{
 const h=harness(),g=deferred();h.hooks.barrier=()=>g.promise;const run=h.c.signOut();await tick();await h.callback('B');await h.callback('A');const before=h.session;g.resolve({ok:true});assert.equal(await run,false);assert.deepEqual(h.session,before);assert.equal(h.logouts().length,0);
});
test('workspace A-B-A cancels a delayed logout despite the same final uid and wid',async()=>{
 const h=harness(),g=deferred();h.hooks.barrier=()=>g.promise;const run=h.c.signOut();await tick();h.switch('team-B');h.switch('team-A');g.resolve({ok:true});assert.equal(await run,false);assert.equal(h.session.uid,'A');assert.equal(h.logouts().length,0);
});
test('ordinary same-UID token rotation remains valid during logout and uses the rotated token',async()=>{
 const h=harness(),g=deferred();h.hooks.barrier=n=>n===1?g.promise:Promise.resolve({ok:true});const run=h.c.signOut();await tick();h.change({...h.session,exp:1});await h.c.ensureToken();g.resolve({ok:true});assert.equal(await run,true);assert.equal(h.session,null);assert.equal(h.logouts().length,1);assert.equal(h.logouts()[0].options.headers.Authorization,'Bearer A-fresh-at');assert.equal(h.calls.barriers,2);assert.equal(h.calls.sync,1);assert.equal(h.calls.pending,1);assert.equal(h.local.get('cs_notes_v1'),'preserve synthetic private draft');
});
test('a new login logout gets its own flight and old completion does not clear it',async()=>{
 const h=harness(),a=deferred(),b=deferred();h.hooks.barrier=n=>n===1?a.promise:n===2?b.promise:Promise.resolve({ok:true});const old=h.c.signOut();assert.equal(h.c.signOut(),old);await tick();await h.callback('B');const newer=h.c.signOut();assert.notEqual(newer,old);await tick();a.resolve({ok:true});assert.equal(await old,false);assert.equal(h.c.signOutPromise,newer);assert.equal(h.c.signOut(),newer);b.resolve({ok:true});assert.equal(await newer,true);assert.equal(h.c.signOutPromise,null);assert.equal(h.logouts().length,1);assert.equal(h.logouts()[0].options.headers.Authorization,'Bearer B-new-login-at');
});
test('a late prelogout rejection does not change a new login status or overlay',async()=>{
 const h=harness(),g=deferred();h.hooks.barrier=()=>g.promise;const run=h.c.signOut();await tick();await h.callback('B');const notice=h.statuses.length;g.reject(Error('old storage failure'));assert.equal(await run,false);assert.equal(h.session.uid,'B');assert.equal(h.statuses.length,notice);assert.equal(h.calls.hide,0);
});
test('logout cannot claim success while its session record remains on this device',async()=>{
 const h=harness(),before=h.session;h.hooks.removeFailure=true;assert.equal(await h.c.signOut(),false);assert.deepEqual(h.session,before);assert.equal(h.statuses.includes('로그아웃됨'),false);assert.match(h.statuses.at(-1),/로그아웃하지 못했습니다/);assert.equal(h.local.get('cs_notes_v1'),'preserve synthetic private draft');
});

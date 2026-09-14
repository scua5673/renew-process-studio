'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const code=[section('function wsList(){','function activeWsObj(){'),section('function cacheOwner(){','function renderDataLock('),
  section('function dataUnlocked(){','function sensitiveLocalKey('),section('function sensitiveLocalKey(k){','function legacyCacheInfo(){'),
  section('function defaultWorkspace(rows){','/* 1.847'),section('function prepareCacheForSession(','/* RPC 호출(PostgREST) */'),
  section('function rpc(name,body,','/* 부팅: 개인 워크스페이스'),section('function loadWorkspacesCore(){','function loadWorkspaces(){'),
  'function authStorageEvent(e){'+section('    if(e.key===SKEY){','    /* 보관함 본문은 IDB에')+'}'].join('\n');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
function sess(uid=A,suffix='initial'){return{uid,at:uid+'-at-'+suffix,rt:uid+'-rt-'+suffix,email:'synthetic@example.invalid'};}
function response(rows){return{ok:true,status:200,text:async()=>JSON.stringify(rows)};}
function harness({owner=B,wid='B-workspace',rows=[{id:'A-workspace',kind:'personal'}],legacy=false}={}){
  const local=new Map([['ps_sync_session',JSON.stringify(sess())],['cs_notes_v1','synthetic local draft'],['ps_sync_outbox_v1','synthetic pending work']]);
  if(!legacy){local.set('ps_cache_owner_v1',JSON.stringify({uid:owner,wid}));local.set('ps_active_ws',wid);local.set('ps_ws_list',JSON.stringify([{id:wid,kind:'personal'}]));}
  const idb=new Map([['cs_notes_v1','synthetic durable draft']]),hooks={},calls={erased:[],idbErased:[],idbGuards:[],requests:[],confirms:0,legacyChoices:0,stashes:0,reloads:0,verifications:0};
  const storage={keys:()=>hooks.keys?hooks.keys():Promise.resolve([...idb.keys()]),del(k,current){calls.idbErased.push(k);calls.idbGuards.push(current);if(hooks.del)return hooks.del(k);idb.delete(k);return Promise.resolve();}};
  const win={storage};win.PSStorage={sharedReady:()=>hooks.storageReady?hooks.storageReady():Promise.resolve()};
  const c=vm.createContext({Promise,Error,JSON,Math,Date,Object,String,Array,
    SKEY:'ps_sync_session',WSKEY:'ps_active_ws',WLKEY:'ps_ws_list',MKEY:'ps_sync_meta',OWNERKEY:'ps_cache_owner_v1',
    dataReady:false,tabReadyUid:'',tabReadyWid:'',externalSwitchFrozen:false,signOutEpoch:0,
    KEYS:[],CONTENT:['cs_notes_v1'],LIBKEY:'cs_drill_lib_v1',TOMBKEY:'ps_tomb_v1',IDB_CONTENT:['cs_notes_v1'],IDBK:{},
    window:win,PSStorage:win.PSStorage,BASE:'https://synthetic.invalid',
    getSess(){const raw=local.get('ps_sync_session');return raw?JSON.parse(raw):null;},
    localStorage:{get length(){return local.size;},key:i=>[...local.keys()][i],getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,String(v)),removeItem(k){calls.erased.push(k);local.delete(k);}},
    syncBaseCacheClear(){},workspacePubLocalKeys:()=>[],isIdpPubKey:()=>false,
    verifyWorkspacePubCleared(){calls.verifications++;return hooks.verify?hooks.verify():Promise.resolve(true);},
    renderUI(){},renderDataLock(){},broadcastAuthState(){},syncDiagnostic(){},recSwitchFail(){},
    workspaceSwitchEpochRaw:()=>'',freezeForPendingExternalSwitch:()=>false,
    freezeForExternalSwitch(){c.externalSwitchFrozen=true;c.setDataReady(false);},reloadAfterExternalSwitch(){calls.reloads++;},
    loadWorkspaces:async()=>[],syncNow:async()=>{},
    ensureToken:()=>hooks.token?hooks.token():Promise.resolve(c.getSess()?.at),hj:at=>({Authorization:'Bearer '+at}),
    fetch(url,options){calls.requests.push({url,options});return hooks.bootstrap?hooks.bootstrap():Promise.resolve(response(rows));},
    stashSnapshot(){calls.stashes++;return hooks.stash?hooks.stash():Promise.resolve();},
    legacyCacheInfo:()=>hooks.legacyInfo?hooks.legacyInfo():Promise.resolve({has:true,uid:''}),
    askConfirm(){calls.confirms++;return hooks.confirm?hooks.confirm():Promise.resolve(false);},
    legacyWorkspace(){calls.legacyChoices++;return hooks.legacyChoice?hooks.legacyChoice():Promise.resolve('A-workspace');}
  });
  vm.runInContext(code,c);
  function change(s,notify=true){const oldValue=local.get('ps_sync_session')||null,newValue=s?JSON.stringify(s):null;if(newValue)local.set('ps_sync_session',newValue);else local.delete('ps_sync_session');const event={key:'ps_sync_session',oldValue,newValue};if(notify)c.authStorageEvent(event);return event;}
  function run(){return c.loadWorkspacesCore().then(()=>({ok:true}),e=>({ok:false,locked:!!e.psDataLocked}));}
  return{c,local,idb,hooks,calls,change,run,snapshot:()=>JSON.stringify([...local.entries()].filter(([k])=>k!=='ps_sync_session'))};
}
for(const mode of ['different-account-no-event','logout','A-B-A'])test('late bootstrap cannot wipe after '+mode,async()=>{
  const h=harness(),g=deferred(),before=h.snapshot();h.hooks.bootstrap=()=>g.promise;const pending=h.run();await tick();assert.equal(h.c.tabReadyUid,'');
  if(mode==='different-account-no-event')h.change(sess(B),false);
  if(mode==='logout')h.change(null);
  if(mode==='A-B-A'){
    const toB=h.change(sess(B),false),toA=h.change(sess(A,'new-login'),false);
    h.c.authStorageEvent(toB);h.c.authStorageEvent(toA);assert.equal(h.c.signOutEpoch,2);
  }
  g.resolve(response([{id:'A-workspace',kind:'personal'}]));assert.deepEqual(await pending,{ok:false,locked:true});
  assert.equal(h.snapshot(),before);assert.deepEqual(h.calls.erased,[]);assert.deepEqual(h.calls.idbErased,[]);
});
test('same-UID token rotation keeps a valid bootstrap and existing cache usable',async()=>{
  const h=harness({owner:A,wid:'A-workspace'}),g=deferred();h.hooks.bootstrap=()=>g.promise;const pending=h.run();await tick();
  h.change(sess(A,'rotated'));assert.equal(h.c.signOutEpoch,0);assert.equal(h.calls.reloads,0);
  g.resolve(response([{id:'A-workspace',kind:'personal'}]));assert.deepEqual(await pending,{ok:true});assert.equal(h.c.dataUnlocked(),true);assert.equal(h.local.get('cs_notes_v1'),'synthetic local draft');assert.deepEqual(h.calls.idbErased,[]);
});
test('an owner change while the shared write barrier waits prevents the bootstrap request',async()=>{
  const h=harness(),g=deferred(),before=h.snapshot();h.hooks.storageReady=()=>g.promise;const pending=h.run();await tick();h.change(sess(B),false);g.resolve();
  assert.deepEqual(await pending,{ok:false,locked:true});assert.equal(h.calls.requests.length,0);assert.equal(h.snapshot(),before);
});
test('an owner change during token refresh cannot send bootstrap for the later account',async()=>{
  const h=harness(),g=deferred(),before=h.snapshot();h.hooks.token=()=>g.promise;const pending=h.run();await tick();h.change(sess(B),false);g.resolve(sess(B).at);
  assert.deepEqual(await pending,{ok:false,locked:true});assert.equal(h.calls.requests.length,0);assert.equal(h.snapshot(),before);
});
for(const mine of [false,true])test('an old legacy confirmation cannot wipe or attach data when answered '+mine,async()=>{
  const h=harness({legacy:true}),g=deferred(),before=h.snapshot();h.hooks.confirm=()=>g.promise;const pending=h.run();await tick();assert.equal(h.calls.confirms,1);
  h.change(sess(B),false);g.resolve(mine);assert.deepEqual(await pending,{ok:false,locked:true});assert.equal(h.snapshot(),before);assert.equal(h.calls.legacyChoices,0);assert.deepEqual(h.calls.idbErased,[]);
});
test('a legacy workspace choice cannot stamp markers after logout',async()=>{
  const h=harness({legacy:true}),g=deferred(),before=h.snapshot();h.hooks.confirm=async()=>true;h.hooks.legacyChoice=()=>g.promise;const pending=h.run();await tick();assert.equal(h.calls.legacyChoices,1);
  h.change(null,false);g.resolve('A-workspace');assert.deepEqual(await pending,{ok:false,locked:true});assert.equal(h.snapshot(),before);assert.deepEqual(h.calls.idbErased,[]);
});
for(const owner of [A,B])test('a stale IndexedDB key listing cannot start a '+(owner===A?'workspace':'account')+' wipe',async()=>{
  const h=harness({owner}),g=deferred(),before=h.snapshot();h.hooks.keys=()=>g.promise;const pending=h.run();await tick();
  h.change(sess(B),false);g.resolve(['cs_notes_v1']);assert.deepEqual(await pending,{ok:false,locked:true});assert.equal(h.snapshot(),before);assert.deepEqual(h.calls.idbErased,[]);
});
test('an orphan workspace stash must recheck login before removing its cache',async()=>{
  const h=harness({owner:A}),g=deferred(),before=h.snapshot();h.hooks.stash=()=>g.promise;const pending=h.run();await tick();assert.equal(h.calls.stashes,1);
  h.change(null,false);g.resolve();assert.deepEqual(await pending,{ok:false,locked:true});assert.equal(h.snapshot(),before);assert.deepEqual(h.calls.idbErased,[]);
});
test('a completed old deletion cannot stamp old workspace markers over a newer login',async()=>{
  const h=harness(),g=deferred();h.hooks.del=()=>g.promise;const pending=h.run();await tick();assert.equal(h.calls.idbErased.length,1);
  h.change(sess(B),false);h.local.set('ps_cache_owner_v1',JSON.stringify({uid:B,wid:'B-new'}));h.local.set('ps_active_ws','B-new');h.local.set('cs_notes_v1','new B draft');const before=h.snapshot();
  assert.equal(typeof h.calls.idbGuards[0],'function');assert.throws(h.calls.idbGuards[0],e=>e.psDataLocked===true);
  g.resolve();assert.deepEqual(await pending,{ok:false,locked:true});assert.equal(h.snapshot(),before);assert.equal(h.calls.verifications,0);
});
test('unchanged login can complete an intended cache replacement',async()=>{
  const h=harness();assert.deepEqual(await h.run(),{ok:true});assert.equal(h.c.cacheOwner().uid,A);assert.equal(h.c.activeWs(),'A-workspace');assert.equal(h.c.dataUnlocked(),true);assert.equal(h.local.has('cs_notes_v1'),false);assert.equal(h.idb.has('cs_notes_v1'),false);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8'),start=source.indexOf('function __schedReadScope(){'),code=source.slice(start,source.indexOf('\nsetTimeout(window.__schedIdbCheck',start));
const raw=JSON.stringify,tick=()=>new Promise(r=>setImmediate(r));
function harness(){
  let resolve;const pending=new Promise(r=>resolve=r),old=raw({team:'A',scheduleRev:1,editedAt:1,weeks:{}}),incoming=raw({team:'A',scheduleRev:9,editedAt:9,weeks:{}}),local=new Map([['process_coach_v1',old],['ps_sync_session','{"uid":"coach"}'],['ps_active_ws','A'],['ps_cache_owner_v1','{"uid":"coach","wid":"A","nonce":"one"}']]),writes=[],renders=[],queued=[],state={unlocked:true,reads:0,editing:false,quota:false};
  state.mirrorAttempts=0;
  const c={Promise,JSON,STORE_KEY:'process_coach_v1',__schedWritePending:false,__schedWriteSeq:0,localStorage:{getItem:k=>local.get(k)??null,setItem(k,v){state.mirrorAttempts++;if(state.quota)throw Object.assign(Error('quota'),{name:state.errorName||'QuotaExceededError'});writes.push(k);local.set(k,v);}},storage:{get(){state.reads++;return pending;}},parent:{PSSync:{dataUnlocked:()=>state.unlocked}},__schedEditorActive:()=>state.editing,__schedRenderIncoming:v=>renders.push(v),__schedQueueIncoming:v=>queued.push(v),__schedDrainIncoming(){},setTimeout(){}};
  c.PSStorage={mirrorSchedule:async(raw,current)=>{current();try{c.localStorage.setItem(c.STORE_KEY,raw);return{ok:true,quota:false,stale:false};}catch(e){return{ok:false,quota:/^(QuotaExceededError|NS_ERROR_DOM_QUOTA_REACHED)$/.test(e.name),stale:false};}}};
  c.window=c;vm.createContext(c);vm.runInContext(code,c);return{c,local,writes,renders,queued,state,old,incoming,finish:async()=>{resolve({value:incoming});await tick();}};
}
test('same-owner read accepts a newer IDB schedule; active editor retains its original mirror and queues the body',async()=>{
  for(const editing of [false,true]){const h=harness();h.state.editing=editing;h.c.__schedIdbCheck();await h.finish();assert.equal(h.local.get('process_coach_v1'),editing?h.old:h.incoming);assert.deepEqual(editing?h.queued:h.renders,[h.incoming]);assert.equal(h.state.mirrorAttempts,editing?0:1);}
});
const changes={team:h=>{h.local.set('ps_active_ws','B');h.local.set('ps_cache_owner_v1','{"uid":"coach","wid":"B","nonce":"two"}');},account:h=>h.local.set('ps_sync_session','{"uid":"other"}'),'ABA nonce':h=>h.local.set('ps_cache_owner_v1','{"uid":"coach","wid":"A","nonce":"two"}'),epoch:h=>h.local.set('ps_ws_switch_epoch_v1','two'),guard:h=>h.local.set('ps_ws_switch_guard_v1','{"token":"two"}'),lock:h=>h.state.unlocked=false};
for(const [name,change]of Object.entries(changes))test('late IDB schedule cannot write or render after '+name,async()=>{
  const h=harness();h.c.__schedIdbCheck();change(h);await h.finish();assert.equal(h.local.get('process_coach_v1'),h.old);assert.deepEqual(h.writes,[]);assert.deepEqual(h.renders,[]);assert.deepEqual(h.queued,[]);
});
test('a later same-team mirror edit is never overwritten even by a higher revision captured earlier',async()=>{
  const h=harness();h.c.__schedIdbCheck();const latest=raw({team:'A',scheduleRev:2,weeks:{draft:'new local edit'}});h.local.set('process_coach_v1',latest);await h.finish();assert.equal(h.local.get('process_coach_v1'),latest);assert.deepEqual(h.writes,[]);assert.deepEqual(h.renders,[]);
});
test('a newer local write generation discards a delayed boot read before any mirror write or queue',async()=>{
 const h=harness();h.c.__schedIdbCheck();h.c.__schedWriteSeq++;await h.finish();assert.equal(h.state.mirrorAttempts,0);assert.equal(h.local.get('process_coach_v1'),h.old);assert.deepEqual(h.queued,[]);assert.deepEqual(h.renders,[]);
});
test('missing optional mirror API never falls back to a direct write or renders unverified repair',async()=>{
 const h=harness();delete h.c.PSStorage.mirrorSchedule;const work=h.c.__schedIdbCheck();await h.finish();await work;assert.equal(h.state.mirrorAttempts,0);assert.deepEqual(h.renders,[]);assert.equal(h.local.get('process_coach_v1'),h.old);
});
test('an atomic stale optional-mirror result cannot render the captured body or recover its warning',async()=>{
 const h=harness(),r=recovery(h);h.c.PSStorage.mirrorSchedule=async()=>({ok:false,quota:false,stale:true});const work=h.c.__schedIdbCheck();await h.finish();await work;assert.equal(h.state.mirrorAttempts,0);assert.deepEqual(h.renders,[]);assert.deepEqual(r.calls,[]);
});
for(const change of ['owner','sequence','pending','mirror'])test('a changed '+change+' after optional repair prevents rendering and quota recovery',async()=>{
 const h=harness(),r=recovery(h);let release,entered=false;const gate=new Promise(resolve=>release=resolve);h.c.PSStorage.mirrorSchedule=()=>{entered=true;return gate;};const work=h.c.__schedIdbCheck();await h.finish();assert.equal(entered,true);
 if(change==='owner')changes.team(h);if(change==='sequence')h.c.__schedWriteSeq++;if(change==='pending')h.c.__schedWritePending=true;if(change==='mirror')h.local.set('process_coach_v1','newer mirror');release({ok:false,quota:true,stale:false});await work;assert.deepEqual(h.renders,[]);assert.deepEqual(r.calls,[]);
});
for(const kind of ['pending','editor','failed'])test('boot read during '+kind+' edit never attempts the quota mirror and only queues the incoming body',async()=>{
 const h=harness(),r=recovery(h);h.state.quota=true;const work=h.c.__schedIdbCheck();if(kind==='pending')h.c.__schedWritePending=true;if(kind==='editor')h.state.editing=true;if(kind==='failed')r.state.failed=true;
 await h.finish();await work;assert.equal(h.state.mirrorAttempts,0);assert.equal(h.local.get('process_coach_v1'),h.old);assert.deepEqual(h.queued,[h.incoming]);assert.deepEqual(h.renders,[]);assert.deepEqual(r.calls,[]);
});
test('locked start never reads and a quota failure may show only its unchanged-owner verified IDB schedule',async()=>{
  const locked=harness();locked.state.unlocked=false;locked.c.__schedIdbCheck();assert.equal(locked.state.reads,0);
  const h=harness();h.state.quota=true;h.c.__schedIdbCheck();await h.finish();assert.equal(h.c.__schedMirrorFull,true);assert.equal(h.local.get('process_coach_v1'),h.old);assert.deepEqual(h.renders,[h.incoming]);
});
function recovery(h){
 const calls=[],state={failed:false,confirmed:0,wait:Promise.resolve()};h.c.PSSaveState={get:()=>state.failed?'failed':'idle'};
 h.c.PSStorage.sharedRecovered=function(key,raw,current){calls.push({key,raw});return state.wait.then(()=>{assert.equal(current(),true);state.confirmed++;return true;});};
 return{calls,state};
}
test('boot mirror quota awaits exact durable recovery while the displayed IDB body stays intact',async()=>{
 const h=harness(),r=recovery(h);h.state.quota=true;const work=h.c.__schedIdbCheck();assert.ok(work&&typeof work.then==='function');await h.finish();await work;
 assert.deepEqual(r.calls,[{key:'process_coach_v1',raw:h.incoming}]);assert.equal(r.state.confirmed,1);assert.equal(h.local.get('process_coach_v1'),h.old);assert.deepEqual(h.renders,[h.incoming]);
});
test('a non-quota mirror exception cannot claim quota recovery',async()=>{
 const h=harness(),r=recovery(h);h.state.quota=true;h.state.errorName='SecurityError';const work=h.c.__schedIdbCheck();await h.finish();await work;assert.deepEqual(r.calls,[]);
});
for(const change of ['pending','editor','failed','sequence'])test('boot read never recovers an already changed '+change,async()=>{
 const h=harness(),r=recovery(h);h.state.quota=true;const work=h.c.__schedIdbCheck();
 if(change==='pending')h.c.__schedWritePending=true;if(change==='editor')h.state.editing=true;if(change==='failed')r.state.failed=true;if(change==='sequence')h.c.__schedWriteSeq++;
 await h.finish();await work;assert.deepEqual(r.calls,[]);assert.equal(r.state.confirmed,0);
});
for(const change of ['pending','failed','sequence','mirror','owner'])test('a new '+change+' vetoes boot recovery at its final async boundary',async()=>{
 const h=harness(),r=recovery(h);let release;r.state.wait=new Promise(resolve=>release=resolve);h.state.quota=true;const work=h.c.__schedIdbCheck();await h.finish();assert.equal(r.calls.length,1);
 if(change==='pending')h.c.__schedWritePending=true;if(change==='failed')r.state.failed=true;if(change==='sequence')h.c.__schedWriteSeq++;if(change==='mirror')h.local.set('process_coach_v1','new exact mirror');if(change==='owner')changes.team(h);
 release();await work;assert.equal(r.state.confirmed,0);
});

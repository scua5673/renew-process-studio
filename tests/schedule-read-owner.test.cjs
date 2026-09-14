'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8'),start=source.indexOf('function __schedReadScope(){'),code=source.slice(start,source.indexOf('\nsetTimeout(window.__schedIdbCheck',start));
const raw=JSON.stringify,tick=()=>new Promise(r=>setImmediate(r));
function harness(){
  let resolve;const pending=new Promise(r=>resolve=r),old=raw({team:'A',scheduleRev:1,editedAt:1,weeks:{}}),incoming=raw({team:'A',scheduleRev:9,editedAt:9,weeks:{}}),local=new Map([['process_coach_v1',old],['ps_sync_session','{"uid":"coach"}'],['ps_active_ws','A'],['ps_cache_owner_v1','{"uid":"coach","wid":"A","nonce":"one"}']]),writes=[],renders=[],queued=[],state={unlocked:true,reads:0,editing:false,quota:false};
  const c={Promise,JSON,STORE_KEY:'process_coach_v1',__schedWritePending:false,localStorage:{getItem:k=>local.get(k)??null,setItem(k,v){if(state.quota)throw Error('quota');writes.push(k);local.set(k,v);}},storage:{get(){state.reads++;return pending;}},parent:{PSSync:{dataUnlocked:()=>state.unlocked}},__schedEditorActive:()=>state.editing,__schedRenderIncoming:v=>renders.push(v),__schedQueueIncoming:v=>queued.push(v),__schedDrainIncoming(){},setTimeout(){}};
  c.window=c;vm.createContext(c);vm.runInContext(code,c);return{c,local,writes,renders,queued,state,old,incoming,finish:async()=>{resolve({value:incoming});await tick();}};
}
test('same-owner exact mirror accepts a newer IDB schedule and respects an active editor',async()=>{
  for(const editing of [false,true]){const h=harness();h.state.editing=editing;h.c.__schedIdbCheck();await h.finish();assert.equal(h.local.get('process_coach_v1'),h.incoming);assert.deepEqual(editing?h.queued:h.renders,[h.incoming]);}
});
const changes={team:h=>{h.local.set('ps_active_ws','B');h.local.set('ps_cache_owner_v1','{"uid":"coach","wid":"B","nonce":"two"}');},account:h=>h.local.set('ps_sync_session','{"uid":"other"}'),'ABA nonce':h=>h.local.set('ps_cache_owner_v1','{"uid":"coach","wid":"A","nonce":"two"}'),epoch:h=>h.local.set('ps_ws_switch_epoch_v1','two'),guard:h=>h.local.set('ps_ws_switch_guard_v1','{"token":"two"}'),lock:h=>h.state.unlocked=false};
for(const [name,change]of Object.entries(changes))test('late IDB schedule cannot write or render after '+name,async()=>{
  const h=harness();h.c.__schedIdbCheck();change(h);await h.finish();assert.equal(h.local.get('process_coach_v1'),h.old);assert.deepEqual(h.writes,[]);assert.deepEqual(h.renders,[]);assert.deepEqual(h.queued,[]);
});
test('a later same-team mirror edit is never overwritten even by a higher revision captured earlier',async()=>{
  const h=harness();h.c.__schedIdbCheck();const latest=raw({team:'A',scheduleRev:2,weeks:{draft:'new local edit'}});h.local.set('process_coach_v1',latest);await h.finish();assert.equal(h.local.get('process_coach_v1'),latest);assert.deepEqual(h.writes,[]);assert.deepEqual(h.renders,[]);
});
test('locked start never reads and a quota failure may show only its unchanged-owner verified IDB schedule',async()=>{
  const locked=harness();locked.state.unlocked=false;locked.c.__schedIdbCheck();assert.equal(locked.state.reads,0);
  const h=harness();h.state.quota=true;h.c.__schedIdbCheck();await h.finish();assert.equal(h.c.__schedMirrorFull,true);assert.equal(h.local.get('process_coach_v1'),h.old);assert.deepEqual(h.renders,[h.incoming]);
});

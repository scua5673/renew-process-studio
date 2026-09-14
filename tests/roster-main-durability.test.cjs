'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),scout=fs.readFileSync(path.join(root,'studio/scout.html'),'utf8'),storage=fs.readFileSync(path.join(root,'studio/storage.js'),'utf8'),sync=fs.readFileSync(path.join(root,'studio/sync.js'),'utf8');
function section(src,a,b){const i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return src.slice(i,j);}
const tracker=section(storage,'/* PROCESS STUDIO — 저장 상태(PSSaveState)','/* PROCESS STUDIO — 일정 기준선');
const shared=section(storage,'  var sharedWrites={},sharedLatest={};','  /* v369 — 팀 전환 전체 백업');
const store=section(scout,'const mem={};','const KEY=');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(r=>setImmediate(r));
const doc=n=>({attrs:[],positions:[],players:Array.from({length:n},(_,i)=>({id:'p'+i,name:'Synthetic '+i,memo:'latest '+i})),meta:{teamName:'Synthetic'}});
function harness(){
  const values=new Map([['ps_active_ws','team-a'],['ps_sync_session','{"uid":"coach-a"}'],['scout_tool_v1',JSON.stringify(doc(69))]]),disk=new Map([['scout_tool_v1',JSON.stringify(doc(69))]]),calls=[],hooks={};
  const c={Promise,JSON,Object,String,Date,Error,Set,Map,setTimeout,clearTimeout,
    document:{body:null,getElementById(){return null;}},CustomEvent:function(type,opts){this.type=type;this.detail=opts?.detail;},
    addEventListener(){},dispatchEvent(){},PSStorageDiagnostic(){},toast(){},
    localStorage:{getItem:k=>values.get(k)??null,setItem(k,v){values.set(k,String(v));}},
    storage:{async set(k,v){calls.push({k,v});if(hooks.set)await hooks.set(k,v);disk.set(k,v);return true;},async get(k){return disk.has(k)?{value:disk.get(k)}:null;},async keys(){return [...disk.keys()];}},
    idbGet:k=>Promise.resolve(disk.get(k)),afterMigrate:fn=>Promise.resolve().then(fn),itemsPI:()=>null,
  };c.window=c;vm.createContext(c);vm.runInContext(tracker+'\n'+shared+'\nwindow.PSStorage={sharedReady:sharedReady,sharedVerified:sharedVerified};\n'+store+'\nwindow.fixtureStore=store;',c);
  return {c,values,disk,calls,hooks,store:c.fixtureStore};
}
test('accepted main deletion remains pending until its exact IndexedDB write finishes',async()=>{
  const h=harness(),gate=deferred();h.hooks.set=()=>gate.promise;
  assert.equal(h.store.set('scout_tool_v1',doc(68)),true);let settled=false;const ready=h.store.ready().then(()=>{settled=true;});await tick();
  assert.equal(JSON.parse(h.values.get('scout_tool_v1')).players.length,68);assert.equal(JSON.parse(h.disk.get('scout_tool_v1')).players.length,69);
  assert.equal(settled,false);assert.equal(h.store.hasPending(),true);assert.equal(h.c.PSSaveState.get('team'),'saving');
  gate.resolve();await ready;assert.equal(h.disk.get('scout_tool_v1'),JSON.stringify(doc(68)));assert.equal(h.c.PSSaveState.get('team'),'saved');
});
test('main IndexedDB failure cannot report saved; a successful explicit retry verifies the same raw',async()=>{
  const h=harness();h.hooks.set=()=>{throw Error('synthetic disk unavailable');};assert.equal(h.store.set('scout_tool_v1',doc(68)),true);
  await assert.rejects(h.store.ready(),/disk unavailable/);assert.equal(h.store.hasFailed('scout_tool_v1'),true);assert.equal(h.c.PSSaveState.get('team'),'failed');assert.equal(JSON.parse(h.disk.get('scout_tool_v1')).players.length,69);
  delete h.hooks.set;await h.store.ready(true);assert.equal(h.disk.get('scout_tool_v1'),JSON.stringify(doc(68)));assert.equal(h.store.hasFailed('scout_tool_v1'),false);
});
test('main failure retry cannot overwrite newer local data or follow a changed owner',async()=>{
  for(const change of ['local','owner']){
    const h=harness();h.hooks.set=()=>{throw Error('synthetic failure');};h.store.set('scout_tool_v1',doc(68));await assert.rejects(h.store.ready());delete h.hooks.set;
    const calls=h.calls.length;if(change==='local')h.values.set('scout_tool_v1',JSON.stringify(doc(67)));else h.values.set('ps_sync_session','{"uid":"coach-b"}');
    if(change==='local')await assert.rejects(h.store.ready(true),/바뀌어/);else await h.store.ready(true);
    assert.equal(h.calls.length,calls);assert.equal(JSON.parse(h.disk.get('scout_tool_v1')).players.length,69);
  }
});
test('rapid main saves complete at the latest exact document rather than a stale earlier roster',async()=>{
  const h=harness(),gate=deferred();let first=true;h.hooks.set=()=>{if(first){first=false;return gate.promise;}};
  h.store.set('scout_tool_v1',doc(68));await tick();h.store.set('scout_tool_v1',doc(67));const ready=h.store.ready();gate.resolve();await ready;
  assert.equal(h.disk.get('scout_tool_v1'),JSON.stringify(doc(67)));assert.equal(h.values.get('scout_tool_v1'),h.disk.get('scout_tool_v1'));assert.equal(h.store.hasPending(),false);
});
test('a first main save creates its canonical IDB row and sync preloads the durable current value',async()=>{
  const h=harness();h.disk.delete('scout_tool_v1');h.store.set('scout_tool_v1',doc(68));await h.store.ready();
  const idbk=section(sync,'var IDBK=','/* 워크스페이스 전환 시');
  vm.runInContext(idbk+'\nvar IDB_LIVE={},_idbLiveAt=0,KEYS=["scout_tool_v1"],ITEMS_ACTIVE=false;function syncDiagnostic(){}\n'+section(sync,"var ITEMP='sq:';",'/* ── 권한 문서 읽기')+section(sync,'function idbRefreshLive(){','/* ══ 1.630 · kv 전송을'),h.c);
  assert.equal(h.c.idbBacked('scout_tool_v1'),true,'canonical before discovery scan');
  const preload=await h.c.kvPreload();assert.equal(preload.scout_tool_v1,JSON.stringify(doc(68)));assert.equal(h.c.IDBK.scout_tool_v1,1);
});

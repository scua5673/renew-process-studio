'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/storage.js'),'utf8');
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);}
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const tick=()=>new Promise(r=>setImmediate(r));
function harness(){
  const local=new Map([['ps_sync_session','{"uid":"fixture-user"}'],['ps_active_ws','fixture-team'],['ps_cache_owner_v1','fixture-owner']]);
  const disk=new Map(),events=[],writes=[],node={removed:false,remove(){this.removed=true;}};
  let owner='fixture-owner',readHook=null;
  const c=vm.createContext({Promise,Object,String,JSON,Date,console:{warn(){}},
    localStorage:{getItem:k=>local.get(k)??null},migrationOwner:()=>owner,
    afterMigrate:fn=>Promise.resolve().then(fn),idbGet:async k=>{if(readHook)await readHook(k);return disk.get(k);},
    document:{getElementById:id=>id==='psStorageFull'&&!node.removed?node:null},
    CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail;}},
    dispatchEvent:e=>events.push(e),banner(){},
    storage:{set(k,raw,current){const g=gate();writes.push({k,raw,...g});return g.promise.then(()=>{current();disk.set(k,raw);return true;});}}
  });c.window=c;
  vm.runInContext(section('  var warned=false,','  /* localStorage.setItem을 감싼다')+'\n'+section('  var sharedWrites={},sharedLatest={};','  /* 큰 보조 사본 전용 API.'),c);
  return {c,local,disk,events,writes,node,setOwner:v=>owner=v,onRead:f=>readHook=f};
}
test('quota recovery requires the exact durable body and only clears that key',async()=>{
  const h=harness(),k='process_coach_v1';h.c.warnFull(k);h.disk.set(k,'new');
  await h.c.sharedRecovered('cs_team_matches_v1','match').catch(()=>{});
  assert.equal(h.node.removed,false);
  await h.c.sharedRecovered(k,'new');assert.equal(h.node.removed,true);
  assert.equal(h.events.filter(e=>e.type==='ps-storage-recovered').length,1);
});
test('a different failed key retains its warning after the schedule is confirmed',async()=>{
  const h=harness(),k='process_coach_v1';h.c.warnFull(k);h.c.warnFull('cs_team_matches_v1');h.disk.set(k,'new');
  await h.c.sharedRecovered(k,'new');assert.equal(h.node.removed,false);
  assert.equal(h.events.filter(e=>e.type==='ps-storage-recovered').length,0);
});
test('quota telemetry and cleanup timestamps cannot latch a recovered document warning',async()=>{
  const h=harness(),k='process_coach_v1';h.c.warnFull(k);
  for(const key of ['ps_full_report_at','ps_opt_auto_at','ps_opt_build_v1'])h.c.warnFull(key);
  h.disk.set(k,'new');await h.c.sharedRecovered(k,'new');assert.equal(h.node.removed,true);
});
for(const change of ['owner','mirror','durable'])test('quota recovery preserves the warning on changed '+change,async()=>{
  const h=harness(),k='process_coach_v1';h.c.warnFull(k);h.disk.set(k,'new');
  h.onRead(()=>{if(change==='owner')h.setOwner('other');if(change==='mirror')h.local.set(k,'newer');if(change==='durable')h.disk.set(k,'newer');});
  // sharedReadContext also includes the cache seal, not only migrationOwner.
  if(change==='owner')h.onRead(()=>h.local.set('ps_cache_owner_v1','other'));
  await assert.rejects(h.c.sharedRecovered(k,'new'));assert.equal(h.node.removed,false);
});
test('a newer queued mirrorless save cannot be acknowledged by an older commit',async()=>{
  const h=harness(),k='process_coach_v1';h.c.warnFull(k);
  const first=h.c.sharedSet(k,'first');await tick();
  const confirm=h.c.sharedRecovered(k,'first');const rejected=assert.rejects(confirm,/changed/);
  const latest=h.c.sharedSet(k,'latest');h.writes[0].resolve();await first;await rejected;
  await tick();assert.equal(h.node.removed,false);h.writes[1].resolve();await latest;
  await h.c.sharedRecovered(k,'latest');assert.equal(h.disk.get(k),'latest');assert.equal(h.node.removed,true);
});
test('failed durable writes never clear a quota warning or replay an older body',async()=>{
  const h=harness(),k='process_coach_v1';h.c.warnFull(k);h.disk.set(k,'old');
  const pending=h.c.sharedSet(k,'new');const fail=assert.rejects(pending);await tick();
  const recovered=h.c.sharedRecovered(k,'new');const rejected=assert.rejects(recovered);
  h.writes[0].reject(new Error('fixture disk full'));await fail;await rejected;
  assert.equal(h.writes.length,1);assert.equal(h.disk.get(k),'old');assert.equal(h.node.removed,false);
});
test('a newer failed editor action can veto recovery immediately before its warning clears',async()=>{
  const h=harness(),k='process_coach_v1',g=gate();h.c.warnFull(k);h.disk.set(k,'new');let safe=true;
  h.onRead(()=>g.promise);const recovered=h.c.sharedRecovered(k,'new',()=>safe);const rejected=assert.rejects(recovered,/changed/);
  await tick();safe=false;g.resolve();await rejected;assert.equal(h.node.removed,false);
});

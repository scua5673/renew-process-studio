'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/storage.js'),'utf8');
function part(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const tick=()=>new Promise(r=>setImmediate(r));
function harness(){
  const local=new Map(),disk=new Map(),events=[],timers=new Map();let timerId=0,flushes=0,cleanups=0,readHook=null;
  const owner=(uid,wid)=>{local.set('ps_sync_session',JSON.stringify({uid}));local.set('ps_active_ws',wid);local.set('ps_cache_owner_v1',JSON.stringify({uid,wid}));};owner('fixture-a','fixture-team-a');
  function node(tag){return {tagName:tag,id:'',children:[],style:{},isConnected:false,disabled:false,textContent:'',innerHTML:'',setAttribute(){},appendChild(n){n.parentNode=this;n.isConnected=true;this.children.push(n);return n;},remove(){this.isConnected=false;if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);},click(){if(!this.disabled&&this.onclick)this.onclick();}};}
  const body=node('body');body.isConnected=true;
  function find(id,n=body){if(n.id===id)return n;for(const child of n.children){const match=find(id,child);if(match)return match;}return null;}
  const hooks={optimize:()=>Promise.resolve({freed:0}),flush:()=>Promise.reject(new Error('fixture storage failure')),pending:true};
  const c={Promise,Object,String,JSON,Date,OPEN_TIMEOUT:10000,console:{warn(){}},navigator:{},document:{body,createElement:node,getElementById:find},
    localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k),get length(){return local.size;},key:i=>[...local.keys()][i]},
    setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
    CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail;}},
    addEventListener(type,fn){(listeners[type]||(listeners[type]=[])).push(fn);},dispatchEvent(e){events.push(e);for(const fn of listeners[e.type]||[])fn(e);},
    afterMigrate:fn=>Promise.resolve().then(fn),idbGet:async key=>{if(readHook)await readHook(key);return disk.get(key);},
    psHasPending:()=>hooks.pending,psFlushPendingReady:()=>{flushes++;return hooks.flush();},PSStorageDiagnostic(){}};
  const listeners={};c.window=c;vm.createContext(c);
  vm.runInContext(part('  function migrationOwner(','  function localKeys(')+'\n'+part('  var warned=false,','  /* localStorage.setItem을 감싼다')+'\n'+part('  var sharedWrites={},sharedLatest={};','  /* 큰 보조 사본 전용 API.')+'\n'+part('/* PROCESS STUDIO — 저장 상태(PSSaveState)','/* PROCESS STUDIO — 일정 기준선'),c);
  c.PSStorage={optimize(){cleanups++;return hooks.optimize();}};
  vm.runInContext('window.peek=({'+part('    peek:function(k){','    get:function(k){')+'}).peek;',c);
  return {c,local,disk,events,timers,hooks,owner,find,read:f=>readHook=f,counts:()=>({flushes,cleanups}),deadline(){for(const [id,t]of [...timers])if(t.ms>=20000){timers.delete(id);t.fn();}}};
}
test('quota cleanup begins quietly while the actual failed input remains blocked',async()=>{
  const h=harness(),g=gate();h.hooks.optimize=()=>g.promise;
  h.c.PSSaveState.begin('schedule');h.c.warnFull('process_coach_v1','latest');h.c.PSSaveState.fail('schedule',Error('quota'));
  assert.equal(h.find('psStorageFull'),null);assert.equal(h.find('psSaveFailed'),null);
  assert.equal(h.c.PSSaveState.get('storage'),'saving');assert.equal(h.c.PSSaveState.get('schedule'),'failed');assert.equal(h.hooks.pending,true);
  await tick();assert.equal(h.counts().cleanups,1);g.resolve({freed:0});await tick();
  assert.ok(h.find('psStorageFull'));assert.equal(h.c.PSSaveState.get('storage'),'failed');
});
test('guarded author retry plus exact durable confirmation avoids a red notice',async()=>{
  const h=harness();h.hooks.optimize=()=>Promise.resolve({freed:4000});
  h.hooks.flush=()=>{h.disk.set('process_coach_v1','latest');h.hooks.pending=false;h.c.PSSaveState.ok('schedule');return Promise.resolve(true);};
  h.c.PSSaveState.begin('schedule');h.c.warnFull('process_coach_v1','latest');await tick();await tick();
  assert.equal(h.counts().flushes,1);assert.equal(h.find('psStorageFull'),null);assert.equal(h.c.PSSaveState.get('storage'),'saved');
  assert.equal(h.events.filter(e=>e.type==='ps-storage-full').length,0);assert.equal(h.disk.get('process_coach_v1'),'latest');
});
test('space reclaimed without saving the latest body never turns the failure green',async()=>{
  const h=harness();h.disk.set('process_coach_v1','older');h.hooks.optimize=()=>Promise.resolve({freed:4000});
  h.c.warnFull('process_coach_v1','latest');await tick();await tick();
  const b=h.find('psStorageFull');assert.ok(b);assert.equal(h.c.PSSaveState.get('storage'),'failed');
  assert.equal(h.disk.get('process_coach_v1'),'older');assert.equal(h.events.some(e=>e.type==='ps-storage-recovered'),false);
  b.children.find(n=>n.textContent==='지금 정리').click();await tick();
  assert.match(b.children[0].innerHTML,/저장은 아직 확인되지/);assert.notEqual(b.style.background,'#2E7D5B');
});
test('a stalled recovery has a bounded notice and a dismissed episode does not pop up again',async()=>{
  const h=harness(),g=gate();h.hooks.optimize=()=>g.promise;h.c.warnFull('process_coach_v1','first');await tick();h.deadline();
  const b=h.find('psStorageFull');assert.ok(b);b.children.find(n=>n.textContent==='닫기').click();
  h.c.warnFull('process_coach_v1','next edit');await tick();assert.equal(h.find('psStorageFull'),null);assert.equal(h.counts().cleanups,1);
  assert.equal(h.c.PSSaveState.get('storage'),'failed');g.resolve({freed:0});await tick();assert.equal(h.find('psStorageFull'),null);
});
test('an unrelated successful document cannot clear the failed storage warning',async()=>{
  const h=harness();h.c.warnFull('process_coach_v1','latest');await tick();await tick();const b=h.find('psStorageFull');
  h.c.PSSaveState.ok('another-document');assert.equal(h.find('psStorageFull'),b);assert.equal(h.c.PSSaveState.get('storage'),'failed');assert.equal(h.c.PSSaveState.failed(),true);
});
test('late account A cleanup cannot retry or alter account B save status',async()=>{
  const h=harness(),g=gate();h.hooks.optimize=()=>g.promise;h.c.warnFull('process_coach_v1','A');await tick();
  h.owner('fixture-b','fixture-team-b');h.c.PSSaveState.begin('schedule');g.resolve({freed:5000});await tick();h.deadline();
  assert.equal(h.counts().flushes,0);assert.equal(h.find('psStorageFull'),null);assert.equal(h.c.PSSaveState.get('schedule'),'saving');
  assert.deepEqual(JSON.parse(JSON.stringify(h.c.PSSaveState.snapshot().scopes)),{schedule:'saving'});
  h.c.PSSaveState.fail('new-owner-input',Error('B failure'));assert.ok(h.find('psSaveFailed'),'old recovery cannot hide the next account failure');
});
test('exact local fallback clears only its own failure and does not acknowledge IDB',async()=>{
  const h=harness(),g=gate();h.hooks.optimize=()=>g.promise;
  h.c.warnFull('board-record','exact');h.c.warnFull('process_coach_v1','schedule');h.local.set('board-record','exact');
  await h.c.localRecovered('board-record','exact',()=>true);assert.equal(h.c.fullFailures['board-record'],undefined);assert.equal(h.c.fullFailures.process_coach_v1,true);assert.equal(h.disk.has('board-record'),false);
  h.local.set('process_coach_v1','schedule');await h.c.localRecovered('process_coach_v1','schedule',()=>true);
  assert.equal(h.events.filter(e=>e.type==='ps-storage-recovered').at(-1).detail.medium,'local');assert.equal(h.c.PSSaveState.get('storage'),'saved');
  g.resolve({freed:0});await tick();
});
test('recovery refuses a newer failure recorded during the exact read',async()=>{
  const h=harness(),g=gate();h.hooks.optimize=()=>g.promise;h.disk.set('process_coach_v1','first');h.c.warnFull('process_coach_v1','first');
  h.read(()=>h.c.warnFull('process_coach_v1','newer failed edit'));
  await assert.rejects(h.c.sharedRecovered('process_coach_v1','first'),/newer quota failure/);assert.equal(h.c.fullFailures.process_coach_v1,true);
  g.resolve({freed:0});await tick();
});
test('status peek reads only actual IDB and never migrates a local fallback',async()=>{
  const h=harness();h.local.set('process_coach_v1','only local');assert.equal(await h.c.peek('process_coach_v1'),null);assert.equal(h.disk.has('process_coach_v1'),false);
  h.disk.set('process_coach_v1','exact idb');assert.equal((await h.c.peek('process_coach_v1')).value,'exact idb');assert.equal(h.local.get('process_coach_v1'),'only local');
  h.read(()=>h.owner('fixture-b','fixture-team-b'));await assert.rejects(h.c.peek('process_coach_v1'),/owner changed/);
});
test('a late quota rejection from account A cannot start account B recovery',async()=>{
  const h=harness(),g=gate();h.c.tx=()=>g.promise;h.c.diagnostic=()=>{};
  vm.runInContext(part('  function idbSet(k,v,current){','  /* 계정 캐시 정리는'),h.c);
  const failed=assert.rejects(h.c.idbSet('process_coach_v1','A'),/quota/);
  h.owner('fixture-b','fixture-team-b');g.reject(Object.assign(Error('fixture quota'),{name:'QuotaExceededError'}));await failed;await tick();
  assert.equal(h.counts().cleanups,0);assert.equal(h.events.some(e=>e.type==='ps-storage-checking'),false);assert.equal(h.find('psStorageFull'),null);
});
test('unsealed owner state cannot run automatic author writes or read IDB for a status',async()=>{
  const h=harness();let reads=0;h.read(()=>reads++);h.local.set('ps_cache_owner_v1',JSON.stringify({uid:'different-account',wid:'fixture-team-a'}));
  h.c.warnFull('process_coach_v1','latest');await tick();
  assert.equal(h.counts().cleanups,0);assert.equal(h.counts().flushes,0);assert.ok(h.find('psStorageFull'));
  await assert.rejects(h.c.peek('process_coach_v1'),/owner changed/);await assert.rejects(h.c.sharedRecovered('process_coach_v1','latest'),/owner not ready/);
  h.local.set('process_coach_v1','latest');await assert.rejects(h.c.localRecovered('process_coach_v1','latest',()=>true),/owner or source changed/);assert.equal(reads,0);
});
test('an already visible A notice is removed on team B without acknowledging or deleting A data',async()=>{
  const h=harness();h.disk.set('process_coach_v1','A original');h.c.warnFull('process_coach_v1','A failed');await tick();await tick();assert.ok(h.find('psStorageFull'));
  h.owner('fixture-b','fixture-team-b');h.c.dispatchEvent({type:'storage',key:'ps_active_ws'});
  assert.equal(h.find('psStorageFull'),null);assert.equal(h.disk.get('process_coach_v1'),'A original');assert.equal(h.events.some(e=>e.type==='ps-storage-recovered'),false);
  assert.deepEqual(JSON.parse(JSON.stringify(h.c.PSSaveState.snapshot().scopes)),{});
});

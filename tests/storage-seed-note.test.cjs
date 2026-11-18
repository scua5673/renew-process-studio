'use strict';
/* 저장 계층 정리 2단계 첫 판 — window.storage.get 의 «읽으면서 쓰기»(IndexedDB 에 없고 거울(localStorage)에 있는 키를 IndexedDB 에 심는다)를
   걷기 전에 잰다. 동작은 그대로이고, 심기 길을 지날 때만 ps_events storage_seed 한 줄(키 표 이름 · 화면 파일 · 부른 곳 파일:줄 · KB)을 남긴다.
   그냥 걷으면 동기화 받기 쓰기의 비교 저장(«기대값» = get 이 돌려준 거울 값)이 빈 IndexedDB 와 어긋날 수 있어서다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','studio','storage.js'),'utf8');
const K=require('../studio/storage-keys.js');
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start,a);return source.slice(start,end);}
const tick=()=>new Promise(r=>setImmediate(r));
async function settle(){for(let i=0;i<6;i++)await tick();}
function fakeLocal(entries){
  const m=new Map(entries||[]);
  return {get length(){return m.size;},key:i=>[...m.keys()][i]??null,getItem:k=>m.has(k)?m.get(k):null,
    setItem:(k,v)=>{m.set(k,String(v));},removeItem:k=>{m.delete(k);},map:m};
}
/* get 을 실제 본문 그대로 돌린다 — 저장소 I/O(idbGet · idbReplaceIfValue)와 주인 확인만 가짜 */
function harness({local,idb,owner='owner-1',cas,sync=true,pathname='/studio/scout.html'}){
  const events=[],timers=[],diags=[],store=new Map(Object.entries(idb||{}));
  const c=vm.createContext({Promise,Object,String,JSON,Date,Math,Error,RegExp,console:{warn(){}},localStorage:local,
    navigator:{storage:null},location:{pathname},
    setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},PSStorageKeys:K});
  c.window=c;c.top=c;
  if(sync)c.PSSync={event:(name,opts)=>events.push({name,opts})};
  c.diagnostic=(stage,e)=>diags.push(stage);
  c.afterMigrate=fn=>Promise.resolve().then(fn);
  c.idbGet=k=>Promise.resolve(store.has(k)?store.get(k):null);
  c.idbReplaceIfValue=(k,expected,replacement,current)=>Promise.resolve().then(()=>{
    if(cas)return cas(store,k,expected,replacement);
    current();const now=store.has(k)?store.get(k):null;
    if(now!==expected)return false;store.set(k,replacement);return true;
  });
  c.sharedReadContext=()=>'reader';
  c.sharedCapture=k=>({owner,mirror:local.getItem(k)});
  c.sharedCurrent=()=>true;
  c.DEVICE_LOCAL={};c.IDB_LEFT={};
  vm.runInContext(section('  function fullName(k){','  function fullReadContext(){'),c);
  vm.runInContext(section('  var seedSeen=','  /* 1.618 — 한 자료를 두 저장소에 같이 쓴다.'),c);
  return {c,events,timers,diags,store};
}

test('reading a key that IndexedDB lacks but the mirror holds still seeds it — and now says so once',async()=>{
  const raw=JSON.stringify({players:[{id:'pl-secret',name:'홍길동'}]});
  const h=harness({local:fakeLocal([['scout_tool_v1',raw]]),idb:{}});
  const r=await h.c.storage.get('scout_tool_v1');
  await settle();
  assert.equal(r.value,raw,'읽는 값은 그대로(거울 값)');
  assert.equal(h.store.get('scout_tool_v1'),raw,'동작은 바꾸지 않는다 — 예전처럼 IndexedDB 에 심는다');
  assert.equal(h.events.length,1);
  const {name,opts}=h.events[0];
  assert.equal(name,'storage_seed');assert.equal(opts.error_code,'seed');assert.equal(opts.status,'ok');assert.equal(opts.feature,'storage');
  assert.equal(opts.meta.stage,'scout_tool_v1');
  assert.equal(opts.meta.source,'scout.html');
  assert.equal(opts.meta.top,true);
  assert.equal(opts.meta.kb,Math.round(raw.length*2/1024));
  const flat=JSON.stringify(opts.meta);
  for(const bad of ['pl-secret','홍길동','players'])assert.ok(!flat.includes(bad),'내용은 보내지 않는다: '+bad);
  /* 같은 창에서 같은 키 · 같은 일은 한 번만 */
  h.store.delete('scout_tool_v1');
  await h.c.storage.get('scout_tool_v1');await settle();
  assert.equal(h.events.length,1,'창마다 (이름, 일)당 한 번');
});

test('nothing is reported when IndexedDB already holds the value, or when neither store has it',async()=>{
  const h=harness({local:fakeLocal([['scout_tool_v1','{"a":1}'],['cs_team_matches_v1','{"m":1}']]),idb:{scout_tool_v1:'{"a":2}'}});
  assert.equal((await h.c.storage.get('scout_tool_v1')).value,'{"a":2}','정본이 있으면 정본');
  assert.equal(await h.c.storage.get('process_coach_v1'),null,'어디에도 없으면 null');
  await settle();
  assert.equal(h.events.length,0);
});

test('each fallback outcome is named: owner (read only), race (another writer filled it), fail (seed write threw)',async()=>{
  const own=harness({local:fakeLocal([['cs_team_matches_v1','{"m":1}']]),idb:{},owner:null});
  assert.equal((await own.c.storage.get('cs_team_matches_v1')).value,'{"m":1}');await settle();
  assert.deepEqual(own.events.map(e=>e.opts.error_code),['owner']);
  assert.equal(own.store.has('cs_team_matches_v1'),false,'주인 확인 전에는 읽기만 — 심지 않는다(예전 그대로)');

  const race=harness({local:fakeLocal([['cs_team_matches_v1','{"m":1}']]),idb:{},cas:(s,k)=>{s.set(k,'{"m":"other"}');return false;}});
  assert.equal((await race.c.storage.get('cs_team_matches_v1')).value,'{"m":"other"}','다른 쪽이 먼저 채웠으면 그 값');await settle();
  assert.deepEqual(race.events.map(e=>e.opts.error_code),['race']);

  const fail=harness({local:fakeLocal([['cs_team_matches_v1','{"m":1}']]),idb:{},cas:()=>{throw new Error('idb broken');}});
  assert.equal((await fail.c.storage.get('cs_team_matches_v1')).value,'{"m":1}','심기 실패는 예전처럼 거울 값을 돌려준다');await settle();
  assert.deepEqual(fail.events.map(e=>e.opts.error_code),['fail']);
});

test('prefix keys report their table name, never the person-specific id',async()=>{
  const h=harness({local:fakeLocal([['sq:pl-abc','{"id":"pl-abc"}'],['cs_idp_v1_u-123','{"x":1}']]),idb:{}});
  await h.c.storage.get('sq:pl-abc');await h.c.storage.get('cs_idp_v1_u-123');await settle();
  const stages=h.events.map(e=>e.opts.meta.stage);
  assert.ok(stages.includes('sq:'),'선수별 행은 sq:');
  assert.ok(stages.includes('cs_idp_v1_'),'IDP 는 표의 접두사 이름');
  const flat=JSON.stringify(h.events);
  for(const bad of ['pl-abc','u-123'])assert.ok(!flat.includes(bad),'사람별 id 는 보내지 않는다: '+bad);
});

test('the caller is file:line of the first frame outside storage.js — no address, no query',()=>{
  const h=harness({local:fakeLocal(),idb:{}});
  const chrome={stack:'Error: storage.get\n    at Object.get (https://x.netlify.app/studio/storage.js?v=3.1:950:20)\n    at currentValueForKey (https://x.netlify.app/studio/sync.js?v=3.1:2331:40)\n    at https://x.netlify.app/studio/app.html:10:1'};
  assert.equal(h.c.seedCaller(chrome),'sync.js:2331');
  const safari={stack:'get@https://x.netlify.app/studio/storage.js:950:20\nload@https://x.netlify.app/studio/scout.html?v=3.1&t=abc:6359:22\nglobal code@https://x.netlify.app/studio/scout.html:1:1'};
  assert.equal(h.c.seedCaller(safari),'scout.html:6359');
  assert.equal(h.c.seedCaller({stack:'Error\n    at <anonymous>'}),'','알 수 없으면 빈 글');
  assert.equal(h.c.seedCaller(null),'');
});

test('at most six lines per window, and a missing PSSync is retried a few times, not dropped',async()=>{
  const keys=['cs_team_matches_v1','cs_perms_v1','cs_squad_v1','cs_scout_targets_v1','cs_gamemodel_v1','cs_terms_v1','scout_tool_v1','process_coach_v1'];
  const h=harness({local:fakeLocal(keys.map(k=>[k,'{"v":1}'])),idb:{}});
  for(const k of keys)await h.c.storage.get(k);
  await settle();
  assert.equal(h.events.length,6,'창마다 여섯 줄까지');

  const late=harness({local:fakeLocal([['cs_perms_v1','{"p":1}']]),idb:{},sync:false});
  await late.c.storage.get('cs_perms_v1');await settle();
  assert.equal(late.events.length,0);
  const t=late.timers.find(x=>x.ms===5000);assert.ok(t,'5초 뒤 다시 본다');
  late.c.PSSync={event:(name,opts)=>late.events.push({name,opts})};
  t.fn();
  assert.equal(late.events.length,1,'PSSync 가 생기면 보낸다');
  assert.equal(late.events[0].opts.error_code,'seed');
});

test('a broken telemetry path never breaks the read',async()=>{
  const h=harness({local:fakeLocal([['cs_perms_v1','{"p":1}']]),idb:{}});
  h.c.PSSync={event:()=>{throw new Error('telemetry down');}};
  const r=await h.c.storage.get('cs_perms_v1');
  assert.equal(r.value,'{"p":1}');
  assert.ok(h.diags.includes('storage-seed-note'),'실패는 진단에 남긴다');
});

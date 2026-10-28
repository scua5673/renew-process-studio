'use strict';
/* 3.201 — 선수 명단(scout_tool_v1)의 두 기기 사본(IDB · localStorage 거울)이 갈라졌을 때.
   3.144 는 «옛 거울 ← 서버 원문» 한 경우만 고치고 나머지는 회차 전체를 roster_copies_differ 로 실패시켰다 — 다음 회차도 그대로라
   영영 끝나지 않았고, 그 기기는 다른 자료도 받지 못했다(10/25~10/28 16명 · 800번 넘게 · 제보 419fead1 «데이터가 안 불러와집니다»).
   이제 옛 쪽이 분명하면 새 쪽을 남기고, 둘 다 새것이면 거울을 남기며 그 키만 «자료 확인»에 맡기며 회차는 끝난다.
   실제 sync.js 회차(kvWrite · CAS · 확인 목록)를 schedule-readiness 의 harness 로 돌린다 — 선수 키만 KEYS 에 둔다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const fixture=path.join(__dirname,'schedule-readiness.test.cjs'),source=fs.readFileSync(fixture,'utf8');
const declarations=source.slice(0,source.indexOf('\ntest('));
const {harness}=new Function('require','__dirname',declarations+'\nreturn {harness};')(createRequire(fixture),__dirname);
const copies=require('../studio/sync-roster-copies.js'),mirrorSync=require('../studio/sync-mirror.js');
const K='scout_tool_v1';
const roster=label=>JSON.stringify({attrs:[],positions:[{id:'pos_CB',name:'CB'}],players:[{id:'p1',name:label}],meta:{teamName:'Synthetic'}});
function setup(o){
  const h=harness({server:null,mirror:null,idb:null});
  const c=h.c;
  c.KEYS=[K];c.SCOUT_KEY='cs_scout_targets_v1';c.idbBacked=k=>k===K;c.PSRosterCopies=copies;c.PSMirrorSync=mirrorSync;
  c.scoutWriteAllowed=()=>true;c.scoutReadyInvalidate=()=>{};c.BLOB_KEYS={};
  c.currentValueForKey=k=>Promise.resolve(h.idb.has(k)?h.idb.get(k):null);   /* 실제처럼 선수 키는 IDB 정본 */
  c.bigDrop=()=>false;   /* 1.573 급감 보호는 다른 시험이 맡는다 */
  if(o.server!=null)h.server.set(K,{workspace_id:'team-a',k:K,v:o.server,cupd:o.cupd||2});
  if(o.mirror!=null)h.local.set(K,o.mirror);
  if(o.idb!=null)h.idb.set(K,o.idb);
  if(o.base!=null){const m=c.meta();m.h[K]=c.hash(o.base);m.c[K]=o.baseCupd||1;c.setMeta(m);h.base.set(K,o.base);}
  return h;
}
const pushes=h=>h.requests.filter(r=>r.stage.startsWith('kv_push'));
const holds=h=>JSON.parse(h.local.get('ps_hold_list_v1')||'[]').filter(x=>x.kind==='conflict'&&x.k===K);
const ok=(h,r)=>assert.equal(r.error,undefined,JSON.stringify({r,errors:h.errors.map(e=>e.stage)}));

test('판정: 옛 쪽이 분명하면 새 쪽을, 둘 다 새것이면 거울을 고른다 — 회차를 실패시키는 답은 없다',()=>{
  const hash=s=>'h:'+s,OLD='old',NEW='new',SRV='srv';
  const plan=o=>copies.plan(Object.assign({hash,confirmed:hash(OLD),base:OLD},o)).action;
  assert.equal(plan({idb:OLD,mirror:OLD,server:SRV}),'none');
  assert.equal(plan({idb:SRV,mirror:OLD,server:SRV}),'repair','IDB 가 서버 원문 · 거울은 옛것 → 거울을 서버로');
  assert.equal(plan({idb:SRV,mirror:null,server:SRV}),'repair','거울이 없어도 같다');
  assert.equal(plan({idb:NEW,mirror:OLD,server:OLD}),'idb','IDB 에 새 편집 · 거울은 옛것 → 거울을 IDB 로');
  assert.equal(plan({idb:NEW,mirror:null,server:OLD}),'idb');
  assert.equal(plan({idb:SRV,mirror:OLD,server:'other'}),'idb','IDB 가 새 pull 이고 거울이 옛것이면 서버가 또 바뀌었어도 IDB 가 새것');
  assert.equal(plan({idb:OLD,mirror:SRV,server:SRV}),'repair','거울이 서버 원문 · IDB 가 옛것 → IDB 를 서버로');
  assert.equal(plan({idb:OLD,mirror:NEW,server:OLD}),'mirror','거울에 새 편집 · IDB 는 옛것 → IDB 를 거울로');
  assert.equal(plan({idb:NEW,mirror:'newer',server:OLD}),'mirror','둘 다 바뀜 → 화면이 보이던 거울');
  assert.equal(plan({idb:null,mirror:NEW}),'none');
});

test('IDB 에 새 편집 · 거울은 마지막 확정본: 회차는 성공하고 거울을 IDB 로 맞춘 뒤 다음 회차에 올린다',async()=>{
  const h=setup({server:roster('base'),mirror:roster('base'),idb:roster('edit'),base:roster('base')});
  ok(h,await h.run());
  assert.equal(h.local.get(K),roster('edit'),'거울이 IDB 를 따라간다');
  assert.equal(h.idb.get(K),roster('edit'));
  assert.equal(pushes(h).length,0,'이 회차엔 올리지 않는다');
  assert.deepEqual(holds(h),[],'확인 목록에 넣지 않는다');
  h.c.busy=false;ok(h,await h.run());
  assert.equal(h.server.get(K).v,roster('edit'),'다음 회차가 보통 길로 올린다');
});

test('거울이 비고 IDB 가 서버 원문: 거울을 채우고 끝난다(3.144 그대로)',async()=>{
  const h=setup({server:roster('srv'),idb:roster('srv'),base:roster('old')});
  ok(h,await h.run());
  assert.equal(h.local.get(K),roster('srv'));assert.equal(pushes(h).length,0);
});

test('거울에 새 편집 · IDB 는 확정본(화면 저장의 IDB 쓰기 실패): 회차는 성공하고 IDB 를 거울로 맞춘 뒤 다음 회차에 올린다',async()=>{
  const h=setup({server:roster('base'),cupd:1,mirror:roster('screen'),idb:roster('base'),base:roster('base')});
  ok(h,await h.run());
  assert.equal(h.idb.get(K),roster('screen'),'IDB 가 거울을 따라간다');assert.equal(h.local.get(K),roster('screen'));
  assert.equal(pushes(h).length,0);assert.deepEqual(holds(h),[]);
  assert.ok(!h.errors.some(e=>/roster_copies_differ/.test(String(e.stage))),'옛 회차 실패 코드는 없다');
  h.c.busy=false;ok(h,await h.run());
  assert.equal(h.server.get(K).v,roster('screen'),'다음 회차가 보통 길로 올린다');
});

test('둘 다 새것(IDB 는 새 pull · 거울은 편집): 거울을 남기고, 서버 변경과의 충돌은 보통 길의 «자료 확인»이 맡는다',async()=>{
  const h=setup({server:roster('pull'),cupd:2,mirror:roster('screen'),idb:roster('pull'),base:roster('base')});
  ok(h,await h.run());
  assert.equal(h.idb.get(K),roster('screen'));assert.equal(h.local.get(K),roster('screen'));assert.equal(pushes(h).length,0);
  h.c.busy=false;ok(h,await h.run());
  assert.equal(h.server.get(K).v,roster('pull'),'서버를 덮지 않는다');assert.equal(h.local.get(K),roster('screen'),'기기도 덮지 않는다');
  assert.equal(holds(h).length,1,'진짜 충돌(기기 편집 vs 서버 변경)은 «자료 확인»으로');
});

test('sync.js 회차에는 roster_copies_differ 실패가 더는 없다',()=>{
  const sync=fs.readFileSync(path.join(__dirname,'..','studio','sync.js'),'utf8');
  assert.equal(/syncIssue\('sync_storage','roster_copies_differ'/.test(sync),false);
  assert.ok(sync.includes("PSRosterCopies.plan("));
});

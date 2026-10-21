'use strict';
/* 3.130 — 아이패드 «팀 경기 자료를 불러오는 중입니다»에서 멈춤(10/21 풋볼A 운영자 아이패드, 10/15 부터 회차마다 schedule_mirror_quota 58번).
   그 기기는 일정 화면 사본(localStorage 거울)을 쓰면 늘 QuotaExceededError. 예전엔 그 실패가 회차 전체를 실패시키고 일정 메타를 되돌려
   다음 회차가 일정을 또 받았고, «일정을 받은 회차엔 경기를 미룬다»(1.659)로 경기를 또 미뤘다 — 경기 문서가 영영 안 내려왔다
   (브라우저 재현: tests/browser/match-wait-schedule-quota.mjs).
   이제: IDB 정본이 서버 원문과 같으면 회차를 마친다. 동기화가 덮으려던 바로 그 옛 거울은 걷는다(남기면 다음 회차가 옛 거울을 «내 편집»으로 올린다).
   준비표는 발급하지 않는다. 다음 회차는 못 쓰는 거울을 다시 쓰지 않는다(다시 쓰면 일정을 «받은» 회차가 되어 경기가 또 미뤄진다). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const fixture=path.join(__dirname,'schedule-readiness.test.cjs'),source=fs.readFileSync(fixture,'utf8');
const declarations=source.slice(0,source.indexOf('\ntest('));
const {harness,doc,KEY}=new Function('require','__dirname',declarations+'\nreturn {harness,doc,KEY};')(createRequire(fixture),__dirname);
const quota=()=>Object.assign(new Error('The quota has been exceeded.'),{name:'QuotaExceededError'});
function setup(){
  const OLD=doc('old'),NEW=doc('server');
  const h=harness({mirror:OLD,idb:OLD,server:NEW,cupd:2});h.baseline(OLD,1);
  const writes=[],reports=[];
  h.hooks.localWrite=k=>{if(k===KEY){writes.push(k);if(h.full)throw quota();}};
  h.c.PSStorage.reportFull=k=>reports.push(k);
  h.full=true;
  return {h,OLD,NEW,writes,reports};
}
const pushes=h=>h.requests.filter(r=>r.stage.startsWith('kv_push'));
const metaHash=h=>JSON.parse(h.local.get('ps_sync_meta')).h[KEY];

test('거울을 못 쓰면 회차는 마치고, 옛 거울은 걷고, 정본은 IDB 의 서버 원문 · 준비표 없음 · 크기 보고 한 줄',async()=>{
  const {h,NEW,reports}=setup();
  const r=await h.run();
  assert.equal(r.error,undefined,JSON.stringify({r,errors:h.errors.map(e=>e.stage)}));
  assert.equal(h.local.has(KEY),false,'옛 거울을 걷는다');
  assert.equal(h.idb.get(KEY),NEW);
  assert.equal(metaHash(h),h.c.hash(NEW),'메타는 IDB 정본(서버 원문)으로 — 되돌리지 않는다');
  assert.equal(h.ready(),false,'거울이 없으니 준비표는 없다');
  assert.equal(h.server.get(KEY).v,NEW);assert.equal(pushes(h).length,0,'아무것도 올리지 않는다');
  assert.deepEqual(reports,[KEY],'무엇이 자리를 차지하는지 storage_full 한 줄(키 이름 · 크기만)');
});

test('다음 회차는 못 쓰는 거울을 다시 쓰지 않고(경기를 미루지 않는다) 오류 없이 끝난다 · 옛 일정을 올리지 않는다',async()=>{
  const {h,NEW,writes}=setup();
  await h.run();h.c.busy=false;
  const before=writes.length;
  const r=await h.run();
  assert.equal(r.error,undefined,JSON.stringify({r,errors:h.errors.map(e=>e.stage)}));
  assert.equal(writes.length-before,1,'한 번 가볍게 써 보기만(실패) — 회차 쓰기(IDB + 거울)는 없다');
  assert.equal(r.applied,0,'일정을 «받은» 회차가 아니다 — 경기가 이 회차에 내려온다');
  assert.equal(h.local.has(KEY),false);assert.equal(h.idb.get(KEY),NEW);
  assert.equal(h.server.get(KEY).v,NEW);assert.equal(pushes(h).length,0);
});

test('자리가 다시 나면 거울을 되살리고 준비표를 낸다',async()=>{
  const {h,NEW}=setup();
  await h.run();h.c.busy=false;h.full=false;
  const r=await h.run();
  assert.equal(r.error,undefined,JSON.stringify({r,errors:h.errors.map(e=>e.stage)}));
  assert.equal(h.local.get(KEY),NEW);assert.equal(h.ready(),true);
});

test('IDB 에만 둔 동안 서버 일정이 바뀌면 새 원문을 IDB 에 받고 회차를 마친다',async()=>{
  const {h}=setup();
  await h.run();h.c.busy=false;
  const NEW2=doc('server-2');h.server.set(KEY,{...h.server.get(KEY),v:NEW2,cupd:3});
  const r=await h.run();
  assert.equal(r.error,undefined,JSON.stringify({r,errors:h.errors.map(e=>e.stage)}));
  assert.equal(h.idb.get(KEY),NEW2);assert.equal(h.local.has(KEY),false);
  assert.equal(metaHash(h),h.c.hash(NEW2));assert.equal(h.server.get(KEY).v,NEW2);assert.equal(pushes(h).length,0);
});

test('그 사이 거울에 사용자 편집이 들어왔으면 걷지 않는다 — 예전처럼 저장 공간 문구로 회차를 멈춘다',async()=>{
  const {h,NEW}=setup(),MINE=doc('mine');let once=false;
  h.hooks.sharedReady=k=>{if(k===KEY&&!once&&h.idb.get(KEY)===NEW){once=true;h.local.set(KEY,MINE);}};
  const r=await h.run();
  assert.equal(r.code,'sync_storage',JSON.stringify(r));
  assert.equal(h.c.lastIssue&&h.c.lastIssue.stage,'schedule_mirror_quota');
  assert.equal(h.local.get(KEY),MINE,'사용자 편집은 그대로');assert.equal(h.ready(),false);
});

test('거울이 처음부터 없던 기기(닫을 때 팀 사본을 정리한 뒤)도 같은 길로 회차를 마친다',async()=>{
  const OLD=doc('old'),NEW=doc('server');
  const h=harness({server:NEW,cupd:2});
  h.hooks.localWrite=k=>{if(k===KEY)throw quota();};
  const r=await h.run();
  assert.equal(r.error,undefined,JSON.stringify({r,errors:h.errors.map(e=>e.stage)}));
  assert.equal(h.idb.get(KEY),NEW);assert.equal(h.local.has(KEY),false);assert.equal(h.ready(),false);
  assert.equal(OLD===NEW,false);
});

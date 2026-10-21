'use strict';
/* 3.063 — 풋볼A 운영자 아이패드: 기기 localStorage 0.7MB · 일정 0.24MB 인데 회차마다 «저장 공간 부족»(schedule_mirror_quota).
   진단이 원인과 상관없이 늘 QuotaExceededError 라고 적었다. 실제 원인을 적고, 저장 공간 문구는 진짜 용량 오류에만 쓴다.
   던지지 않았는데 안 바뀐 쓰기(보기 전용 게이트가 조용히 막은 것)는 원래 Storage.setItem 으로 한 번 더 쓴다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const fixture=path.join(__dirname,'schedule-readiness.test.cjs'),source=fs.readFileSync(fixture,'utf8');
const declarations=source.slice(0,source.indexOf('\ntest('));
const {harness,doc,KEY}=new Function('require','__dirname',declarations+'\nreturn {harness,doc,KEY};')(createRequire(fixture),__dirname);
const quota=()=>Object.assign(new Error('The quota has been exceeded.'),{name:'QuotaExceededError'});
function setup(){
  const OLD=doc('old'),NEW=doc('server');
  const h=harness({mirror:OLD,idb:OLD,server:NEW,cupd:2});h.baseline(OLD,1);
  return {h,OLD,NEW};
}
const diag=h=>h.errors.filter(e=>e.stage==='schedule-mirror-write').map(e=>({name:e.e.name,code:e.e.psCode}));
test('진짜 용량 오류면 이름과 크기를 적는다(3.131 — 회차는 IDB 정본으로 마친다 · 문구는 schedule-mirror-left-3131)',async()=>{
  const {h}=setup();h.hooks.localWrite=k=>{if(k===KEY)throw quota();};
  const r=await h.run();
  assert.equal(r.error,undefined,JSON.stringify(r));
  const d=diag(h);assert.ok(d.length,JSON.stringify(h.errors.map(e=>e.stage)));
  assert.equal(d[0].name,'QuotaExceededError');assert.match(d[0].code,/^threw-QuotaExceededError_\d+k_ls\d+k$/);
});
test('던지지 않았는데 안 바뀌면 저장 공간이라고 하지 않고 원인을 적는다',async()=>{
  const {h,OLD}=setup();const real=h.c.localStorage.setItem;
  h.c.localStorage.setItem=function(k,v){if(k===KEY)return;return real.call(this,k,v);};
  const r=await h.run();
  assert.equal(r.code,'sync_storage',JSON.stringify(r));
  const d=diag(h);assert.equal(d[0].name,'MirrorWriteError');assert.match(d[0].code,/^readback-/);
  assert.equal(h.c.lastIssue&&h.c.lastIssue.stage,'schedule_mirror_write');
  assert.equal(h.local.get(KEY),OLD,'거울은 지우지 않는다');
});
test('보기 전용 게이트가 조용히 막았으면 원래 Storage.setItem 으로 써서 회차를 마친다',async()=>{
  const {h,NEW}=setup();const real=h.c.localStorage.setItem;
  h.c.Storage={prototype:{setItem:real}};
  h.c.localStorage.setItem=function(k,v){if(k===KEY)return;return real.call(this,k,v);};
  const r=await h.run();
  assert.equal(r.error,undefined,JSON.stringify({r,errors:h.errors.map(e=>e.stage)}));
  assert.equal(h.local.get(KEY),NEW);assert.equal(h.ready(),true);
});

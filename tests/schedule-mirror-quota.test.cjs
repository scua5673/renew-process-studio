'use strict';
/* 2.920 — 일정 화면 사본(localStorage 거울)을 저장 공간 부족으로 못 쓸 때.
   예전엔 실패를 삼켜, 준비표 확인이 매 회차 «세 사본이 다르다»(sync_local_changed)로 실패하고
   일정 전체를 매번 다시 받았다(9/25~26 한 기기, 한 시간마다). */
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
test('거울을 못 쓰면 저장 공간 오류로 말하고, 거울은 지우지 않는다',async()=>{
  const {h,OLD,NEW}=setup();
  h.hooks.localWrite=(k)=>{if(k===KEY)throw quota();};
  const r=await h.run();delete h.hooks.localWrite;
  assert.equal(r.code,'sync_storage',JSON.stringify(r));
  assert.ok(h.errors.some(e=>e.stage==='schedule-mirror-write'));
  assert.equal(h.local.get(KEY),OLD,'일정 화면은 거울로 부팅한다 — 지우지 않는다');
  assert.equal(h.idb.get(KEY),NEW);assert.equal(h.ready(),false);
});
test('안전 정리로 자리가 나면 한 번 더 써서 회차를 마친다',async()=>{
  const {h,NEW}=setup();let full=true,tidy=0;
  h.hooks.localWrite=(k)=>{if(k===KEY&&full)throw quota();};
  h.c.PSStorage.optimize=async()=>{tidy++;full=false;return {};};
  const r=await h.run();
  assert.equal(r.error,undefined,JSON.stringify({r,errors:h.errors}));
  assert.equal(tidy,1);assert.equal(h.local.get(KEY),NEW);assert.equal(h.ready(),true);
});
test('정리하는 동안 사용자가 새로 적었으면 그 편집을 덮지 않는다',async()=>{
  const {h,NEW}=setup(),MINE=doc('mine');let full=true;
  h.hooks.localWrite=(k)=>{if(k===KEY&&full)throw quota();};
  h.c.PSStorage.optimize=async()=>{full=false;h.local.set(KEY,MINE);return {};};
  await h.run();
  assert.equal(h.local.get(KEY),MINE,'사용자 편집 보존');assert.equal(h.ready(),false);
});
test('안전 정리는 10분에 한 번만 시도한다(회차마다 돌지 않는다)',async()=>{
  const {h}=setup();let tidy=0;
  h.hooks.localWrite=(k)=>{if(k===KEY)throw quota();};
  h.c.PSStorage.optimize=async()=>{tidy++;return {};};
  await h.run();h.c.busy=false;await h.run();
  assert.equal(tidy,1);
});

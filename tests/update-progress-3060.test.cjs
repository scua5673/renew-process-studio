'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
/* 3.060 — 업데이트 진행 카드: 받는 중(0~70%) · 저장 확인(70~95%) · 다시 여는 중(100%). MP4 내보내기 카드와 같은 모양. */
const R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const P=require('../studio/update-progress.js'),M=P._math;
const app=R('studio/app.html'),sw=R('sw.js');

test('progress math: download fills 0-70%, saving 70-95%, never past 100', ()=>{
  assert.equal(M.downloadFraction(0,40),0);assert.equal(M.downloadFraction(20,40),0.35);assert.equal(M.downloadFraction(40,40),0.70);
  assert.equal(M.downloadFraction(99,40),0.70,'clamped');assert.equal(M.downloadFraction(3,0),0,'no total yet');
  assert.equal(M.saveFraction(5,5),0.70);assert.equal(M.saveFraction(0,5),0.95);assert.equal(M.saveFraction(0,0),0.95);
  assert.equal(M.pctText(0.355),'35%');assert.equal(M.pctText(2),'100%');assert.equal(M.pctText(NaN),'0%');
  assert.equal(M.releaseNo('process-9.999'),'9.999');assert.equal(M.releaseNo(''),'');
});
test('service worker reports how many release files it has stored, with no content', ()=>{
  assert.match(sw,/postMessage\(\{ type: 'ps-sw-progress', release: CACHE, done, total \}\)/);
  assert.match(sw,/stats\.fetched\+\+; if \(stats\.tick\) stats\.tick\(\);/,'counts a file only after it is stored');
  assert.ok(sw.includes("'/studio/update-progress.js'"),'card script is in the release cache');
});
test('the shell loads the card early and drives it from the real update path', ()=>{
  assert.ok(app.indexOf('src="update-progress.js"')>0&&app.indexOf('src="update-progress.js"')<app.indexOf('<script>var __swT0'),'loaded before service worker messages can arrive');
  const go=app.slice(app.indexOf('function psAutoReloadWhenSafe('),app.indexOf('window.__psForceReload=go;'));
  assert.match(go,/prog\.saving\(/);assert.match(go,/prog\.reloading\(\)/);
  assert.match(go,/if\(manual\)prog\.failed\(message\);else prog\.ready\(\);/,'auto attempts fall back quietly; only a press shows why');
  assert.ok(go.indexOf('prog.reloading()')<go.indexOf('location.reload()'),'100% only after the save check passed');
  assert.match(app,/track\.seen=track\.seen\|\|\{\};track\.seen\[id\]=1;/);
});
test('the card API never throws without a DOM (worker/test contexts)', ()=>{
  for(const f of ['download','ready','saving','reloading','failed','close'])assert.doesNotThrow(()=>P[f](1,2,'process-9.999'));
  assert.equal(typeof P.state(),'string');
});

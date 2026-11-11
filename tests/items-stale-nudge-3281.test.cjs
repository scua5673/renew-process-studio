'use strict';
/* 3.281 — 선수 입력 보류 알림 띠 · «모두 해제» 단추의 규칙 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const N=require('../studio/items-stale-nudge.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('need: 확인을 기다리는 보류일 때만 — 건수를 돌려준다',()=>{
  assert.equal(N.need({kind:'ask',reason:'items_stale_review',review:7}),7);
  assert.equal(N.need({kind:'ask',reason:'items_stale_review'}),1,'건수를 몰라도 띠는 보인다');
  for(const s of [null,{kind:'ok'},{kind:'wait',reason:'items_stale_review',review:3},{kind:'busy',reason:'items_stale_review',review:3},{kind:'ask',reason:'other',review:3},{kind:'bad',reason:'items_stale_review',review:3}])assert.equal(N.need(s),0,JSON.stringify(s));
  assert.match(N.text(3),/선수 입력 3건이 확인을 기다려요/);
});
test('띠는 스스로 풀지 않는다 — 원래 «보관 내용 보기»를 열 뿐',()=>{
  const src=read('studio/items-stale-nudge.js');
  assert.match(src,/getElementById\('psAutosaveRecoveryOpen'\)/);
  assert.doesNotMatch(src,/resolveItemsReview|prepareItemsReview|storage\.set|localStorage\.setItem/,'저장 · 해제를 직접 하지 않는다');
  assert.match(src,/w\.top!==w/,'맨 위 창에서만');
});
test('«모두 해제»는 항목마다 원래 확인 길(read → prepare → resolve)을 지나고, 어긋난 항목은 남긴다',()=>{
  const src=read('studio/autosave-recovery.js'),i=src.indexOf("resolve-all-items"),part=src.slice(i,i+2600);
  assert.ok(i>0);
  assert.ok(part.indexOf('o.read(row)')<part.indexOf('o.prepareItemsReview(row,value,live)')&&part.indexOf('o.prepareItemsReview(row,value,live)')<part.indexOf('o.resolveItemsReview(row,value,prepared,live)'));
  assert.match(part,/exact\(row,value\)/,'원문 대조는 그대로');assert.match(part,/result\.resolved!==true/,'해제 확인이 없으면 실패로');assert.match(part,/catch\(function\(\)\{left\+\+;\}\)/,'실패한 항목은 보류로 남긴다');
  assert.match(src,/held=rows\.filter\(function\(row\)\{return row\.reason==='items-stale-device';\}\)/,'선수 입력 보류만 — 다른 보관(동시 편집 등)은 건드리지 않는다');
});
test('실린 곳: 셸이 싣고 설치 묶음에 있다',()=>{
  assert.match(read('studio/app.html'),/<script src="items-stale-nudge\.js"><\/script>/);assert.match(read('sw.js'),/'\/studio\/items-stale-nudge\.js'/);
});

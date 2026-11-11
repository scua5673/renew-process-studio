'use strict';
/* 3.278 — 작업 보드 구조 사본(studio/board-rescue.js)의 순수 규칙: 자리 고르기 · 낡음 · 권할 사본 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../studio/board-rescue.js');
const o={uid:'u1',wid:'w1'},now=1800000000000;
const rec=(load,at,doc)=>R.parse(R.make(o,JSON.stringify(Object.assign({snap:{},_savedAt:at},doc||{})),load,at),o);
test('parse: 다른 계정 · 다른 공간 · 깨진 글은 사본이 아니다',()=>{
  const t=R.make(o,JSON.stringify({snap:{}}),'L1',now);
  assert.ok(R.parse(t,o));assert.equal(R.parse(t,{uid:'u2',wid:'w1'}),null);assert.equal(R.parse(t,{uid:'u1',wid:'w2'}),null);
  assert.equal(R.parse('{',o),null);assert.equal(R.parse(null,o),null);assert.equal(R.parse(JSON.stringify({v:1,uid:'u1',wid:'w1',at:now,load:'L',raw:'[]'}),o),null);
});
test('body: 담은 시각만 다른 본문은 같은 작업',()=>{
  assert.equal(R.body(JSON.stringify({a:1,_savedAt:1})),R.body(JSON.stringify({a:1,_savedAt:2})));
  assert.notEqual(R.body(JSON.stringify({a:1,_savedAt:1})),R.body(JSON.stringify({a:2,_savedAt:1})));
});
test('pickSlot: 제 자리 → 빈 자리 → 낡은 자리 → 가장 오래된 자리 — 다른 문서의 새 사본은 덮지 않는다',()=>{
  const a=rec('A',now-5000),b=rec('B',now-3000),c=rec('C',now-1000),d=rec('D',now-4000);
  assert.equal(R.pickSlot([a,b,null,null],'B',0,now),1,'제 자리');
  assert.equal(R.pickSlot([a,b,null,null],'X',0,now),2,'빈 자리');
  assert.equal(R.pickSlot([a,b,c,d],'X',now-3500,now),0,'저장본보다 낡은 자리(가장 앞)');
  assert.equal(R.pickSlot([c,b,d,a],'X',0,now),3,'다 새것이면 가장 오래된 자리');
  assert.equal(R.pickSlot([a,b,c,rec('E',now-R.KEEP_MS-1)],'X',0,now),3,'14일 지난 자리');
});
test('candidate: 다른 문서가 남긴 것 중 저장본보다 새롭고 지금 화면과 다른 가장 새 사본',()=>{
  const mine=rec('ME',now-10,{k:9}),old=rec('A',now-9000,{k:1}),fresh=rec('B',now-2000,{k:2}),same=rec('C',now-1000,{k:3});
  const cur=JSON.stringify({snap:{},k:3,_savedAt:now});
  assert.equal(R.candidate([mine,old,fresh,same],'ME',now-5000,now,cur),fresh,'내 것 · 낡은 것 · 지금 화면과 같은 것은 뺀다');
  assert.equal(R.candidate([mine,old],'ME',now-5000,now,cur),null);
  assert.equal(R.candidate([fresh],'ME',now-1000,now,cur),null,'저장본이 더 새롭다');
  assert.equal(R.candidate([fresh,null],'ME',0,now,null),fresh);
});
test('실린 곳: 작전판이 초안 모듈 뒤에 싣고, 설치 묶음에 들어 있다. 초안의 깐깐한 검사는 그대로',()=>{
  const root=path.join(__dirname,'..'),board=fs.readFileSync(path.join(root,'studio/board.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),src=fs.readFileSync(path.join(root,'studio/board-rescue.js'),'utf8');
  assert.ok(board.indexOf('board-draft.js')<board.indexOf('board-rescue.js'));assert.match(sw,/'\/studio\/board-rescue\.js'/);
  assert.match(src,/ps_private_board_draft_v1:/,'계정 정리가 같이 지우는 머리');
  assert.doesNotMatch(src,/boardDraftWriteNow\s*=/,'초안 쓰기를 바꾸지 않는다');assert.doesNotMatch(src,/_boardPrivateRecord\s*=|_boardPrivateEditSeq\s*=/,'개인 보드 기록을 건드리지 않는다');
});

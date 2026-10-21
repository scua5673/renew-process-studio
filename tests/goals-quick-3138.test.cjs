'use strict';
// 3.138 — 사용자 «득점 실점 기록하는 방식이 더 쉬워졌으면 좋겠어». 점수 아래 «＋ 득점 · ＋ 실점 · ↶» · 득점자 등번호 칩 · 전반 · 후반 칩.
// 저장 칸(goals[].side · min · who · note)은 그대로 — 모듈은 scout.html 의 matchRenderGoals 를 감싸 그려진 줄을 고친다.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Q=require('../studio/match-goals-quick.js');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('scout.html 본문 뒤에서 읽고 sw.js CORE 에 든다',()=>{
  const s=read('studio/scout.html');
  const i=s.indexOf('<script src="match-goals-quick.js"></script>');
  assert.ok(i>0,'script 한 줄');
  assert.ok(i>s.indexOf('function matchRenderGoals('),'본문의 matchRenderGoals 뒤');
  assert.match(read('sw.js'),/'\/studio\/match-goals-quick\.js'/);
  assert.ok(Buffer.byteLength(s)<=1900*1024,'scout.html 예산 '+Buffer.byteLength(s));
});

test('칩에 올릴 선수 — 명단(선발 → 리저브)이 있으면 그 선수만, 없으면 선수단 전체',()=>{
  const ours=[{id:'a',name:'김민수',num:'1'},{id:'b',name:'이준호',num:'8'},{id:'c',name:'박서준',num:'9'},{id:'d',name:'  ',num:'2'}];
  const win={tmOurs:()=>ours,matchReviewSquad:m=>m.squad||{start:[],res:[]}};
  assert.deepEqual(Q.chipPlayers(win,{}).list.map(p=>p.id),['a','b','c'],'이름 없는 선수는 뺀다');
  const r=Q.chipPlayers(win,{squad:{start:['c'],res:['a','zz']}});
  assert.deepEqual(r.list.map(p=>p.id),['c','a'],'선발 → 리저브 차례 · 모르는 id 는 뺀다');
  assert.deepEqual(r.rest.map(p=>p.id),['b'],'나머지는 «다른 선수»');
  const noHelper={tmOurs:()=>{throw new Error('x');}};
  assert.deepEqual(Q.chipPlayers(noHelper,{}),{list:[],rest:[]},'선수단을 못 읽어도 죽지 않는다');
});

test('CSS — 칩은 who 자리 · 고른 뒤엔 그 칩만 · 폰은 칩 줄을 따로 · 전반 · 후반은 한 줄',()=>{
  assert.match(Q.CSS,/\.mgq-chips\{grid-area:who/);
  assert.match(Q.CSS,/\.mgq-chips\.picked:not\(\.open\) \.mgq-chip:not\(\.on\)\{display:none\}/);
  assert.match(Q.CSS,/@media\(max-width:600px\)\{[^}]*"who who who who"/);
  assert.match(Q.CSS,/\.mgq-half button\{[^}]*white-space:nowrap/);
  assert.match(Q.CSS,/\.mgl\.ro \.mgq-chip/,'보기 전용이면 칩을 못 누른다');
});

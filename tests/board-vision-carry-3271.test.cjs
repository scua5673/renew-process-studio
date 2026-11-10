'use strict';
/* 3.271 — 제보 756c0a48 «시야 기능 관련».
   ① «한 페이지의 토큰의 시야 … 다른 모든 페이지의 해당 토큰에 모두 적용» — «시야» 단추(toggleVision)는 지금 판만 바꾼다.
      다른 페이지까지 시야(vis)를 켜는 길은 «시선»(lookPickTarget → _tokPropAll(["lookAt","vis","visW","visR"]), 2.980)이었다.
      이제 시야 · 시선 값은 이 페이지에만(잔상 trail 은 2.980 그대로 모든 페이지).
   ② «이전 장면에서 시야 버튼을 누르면 그 장면 이후로 모두» — 3.254 «계속 강조»와 같은 구간 규칙(_animCarryIds)을 그대로 쓴다.
   실제 판은 tests/browser/board-vision-carry-3271.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const tw=require('../studio/board-tweaks.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function carryApi(){
  const b=read('studio/board.html'),A='/* ══ 3.254 · 강조 · 깜박임 이어 적용 — 순수 구간 시작 ══',Z='/* ══ 3.254 · 강조 · 깜박임 이어 적용 — 순수 구간 끝 ══ */';
  const i=b.indexOf(A),j=b.indexOf(Z);assert.ok(i>0&&j>i,'순수 구간 표식');
  const c={};vm.runInNewContext(b.slice(i,j)+';this._animCarryIds=_animCarryIds;',c);return c._animCarryIds;
}
// 장면 n 개 — 선수 7 · 8, pattern 은 선수 7 의 장면별 시야('0'/'1')
const scenes=pattern=>pattern.split('').map((v,i)=>({dur:1,thumb:'t'+i,snap:{players:[Object.assign({id:7,x:i,dir:90},v==='1'?{vis:true,visW:40,visR:120}:{}),{id:8,x:i}],equipment:[]}}));
const row=(frames,id)=>frames.map(f=>{const p=f.snap.players.find(p=>p.id===id);return p&&p.vis?'1':'0';}).join('');
const tok=(over)=>Object.assign({id:7,dir:45,visW:52,visR:200},over);

test('시야 · 시선 값은 이 페이지에만 — 잔상은 예전처럼 모든 페이지',()=>{
  assert.equal(typeof tw.visionPageOnly,'function');
  assert.equal(tw.visionPageOnly(['lookAt','vis','visW','visR']),true,'시선을 걸 때');
  assert.equal(tw.visionPageOnly(['lookAt','dirBall']),true,'시선을 끌 때');
  assert.equal(tw.visionPageOnly(['vis']),true);
  assert.equal(tw.visionPageOnly(['trail']),false,'잔상(2.980)은 그대로');
  assert.equal(tw.visionPageOnly([]),false);assert.equal(tw.visionPageOnly(null),false);
});

test('시야를 켜면 이 장면부터 뒤로 — 앞 장면 · 고르지 않은 토큰은 그대로',()=>{
  const carry=carryApi(),frames=scenes('00000000'),snaps=frames.map(f=>f.snap);
  const last=tw.visionCarry(frames,3,[tok()],true,{7:false},carry);
  assert.equal(last,7);
  // 지금 장면(3)은 판이 주인이다 — 판을 담을 때 들어간다. 뒤 장면만 고친다.
  assert.equal(row(frames,7),'00001111');assert.equal(row(frames,8),'00000000');
  for(let j=0;j<=3;j++)assert.equal(frames[j].snap,snaps[j],'앞 · 지금 장면은 손대지 않는다');
  for(let j=4;j<8;j++){assert.notEqual(frames[j].snap,snaps[j],'바꾼 장면은 사본으로(⌘Z 기록이 옛 snap 을 들고 있다)');assert.equal(snaps[j].players[0].vis,undefined);assert.equal(frames[j].thumb,undefined,'썸네일은 다시');
    assert.equal(frames[j].snap.players[1],snaps[j].players[1],'다른 토큰은 같은 객체');}
  const t=frames[5].snap.players[0];assert.equal(t.dir,90,'그 장면의 방향은 그대로');assert.equal(t.visW,52);assert.equal(t.visR,200);assert.equal(t.x,5,'자리는 그대로');
});

test('뒤에서 따로 바꿔 둔 장면에서 멈춘다 — 켜기 · 끄기 모두(3.254 강조와 같은 규칙)',()=>{
  const carry=carryApi();
  let f=scenes('00011100');
  assert.equal(tw.visionCarry(f,1,[tok()],true,{7:false},carry),2);assert.equal(row(f,7),'00111100','지금 장면 1 은 판이 담는다');
  f=scenes('01111100');
  assert.equal(tw.visionCarry(f,4,[tok()],false,{7:true},carry),5);assert.equal(row(f,7),'01111000');
  assert.equal(f[5].snap.players[0].vis,false,'끈 값은 판과 같은 모양(false)');assert.equal(f[5].snap.players[0].visW,40,'넓이는 남는다 — 다시 켜면 그대로');
  f=scenes('0000');
  assert.equal(tw.visionCarry(f,3,[tok()],true,{7:false},carry),3,'마지막 장면이면 그 장면만');assert.equal(row(f,7),'0000');
});

test('지금 장면에 이미 그 상태인 토큰은 이어 가지 않는다 · 그 토큰이 없는 장면은 건너 이어 간다',()=>{
  const carry=carryApi();
  let f=scenes('10010');
  assert.equal(tw.visionCarry(f,0,[tok()],true,{7:true},carry),0,'여럿을 함께 켤 때 이미 켜진 토큰');assert.equal(row(f,7),'10010');
  f=scenes('0000');f[2].snap.players=[{id:8,x:2}];const two=f[2].snap;
  assert.equal(tw.visionCarry(f,0,[tok({dir:10})],true,{7:false},carry),3);assert.equal(row(f,7),'0101');assert.equal(f[2].snap,two,'토큰 없는 장면은 그대로');
  f=scenes('000');delete f[1].snap.players[0].dir;
  tw.visionCarry(f,0,[tok({dir:33})],true,{7:false},carry);assert.equal(f[1].snap.players[0].dir,33,'방향이 없는 장면은 지금 방향으로');
  f=scenes('000');
  assert.equal(tw.visionCarry(f,0,[tok(),{id:8,dir:0,visW:52,visR:200}],true,{7:false,8:false},carry),2);assert.equal(row(f,7),'011');assert.equal(row(f,8),'011','여럿');
  assert.equal(tw.visionCarry(null,0,[tok()],true,{7:false},carry),0);assert.equal(tw.visionCarry(scenes('00'),5,[tok()],true,{7:false},carry),5,'없는 장면');
});

test('작전판에 물려 있다 — 본문 함수는 window 속성이라 감싼다 · board.html 은 그대로',()=>{
  const b=read('studio/board.html'),t=read('studio/board-tweaks.js');
  assert.match(b,/^function toggleVision\(\)\{ var ps=selectedPlayers\(false\);/m,'함수 선언(감쌀 수 있다)');
  assert.match(b,/^function _tokPropAll\(ps,fields\)\{/m);
  assert.match(b,/^function _animCarryIds\(frames,k,key,id,on\)\{/m,'이어 적용 규칙은 3.254 것 하나');
  assert.match(b,/\$\("visBtn"\)\.onclick=\(\)=>toggleVision\(\)/,'누를 때 전역 이름으로 찾는다 — 감싼 것을 지난다');
  assert.match(t,/win\.toggleVision\s*=/);assert.match(t,/win\._tokPropAll\s*=/);
  assert.match(t,/win\._animCarryIds/,'새 구간 규칙을 만들지 않는다');
  assert.doesNotMatch(t,/win\.(state|anim|animActive)\b/,'let 전역은 window 속성이 아니다(3.086)');
});

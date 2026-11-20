// 3.339 — 선수단 명단 표에서 바로(사용자 11/20 «명단 선수추가, 선수 삭제 쉽게 · 스카우팅에 있는 선수단 불러오기» → 목업 A안).
// 순수 셈(toggle · rosterMatch)과 저장 길 배선(넣기 = push → save · 빼기 = plTombAdd → splice → save({deletedIds,skipTargets}) · 불러오기는 스카우팅 원장에 쓰지 않는다).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const W=require('../studio/player-workspace.js');
const src=fs.readFileSync(path.join(__dirname,'../studio/player-workspace.js'),'utf8');
const body=(name)=>{const at=src.indexOf('function '+name+'(');assert.ok(at>0,name);const next=src.indexOf('\n    function ',at+10);return src.slice(at,next>0?next:at+6000);};

test('선수단 선택은 몇 명이든 — 다시 누르면 빠지고 원래 배열은 그대로',()=>{
  const a=['a','b','c'];
  assert.deepEqual(W.toggle(a,'d'),['a','b','c','d']);
  assert.deepEqual(W.toggle(a,'b'),['a','c']);
  assert.deepEqual(a,['a','b','c']);
  let s=[];for(let i=0;i<12;i++)s=W.toggle(s,'p'+i);
  assert.equal(s.length,12,'스카우팅의 «비교 3명» 상한은 선수단 선택에 걸리지 않는다');
  assert.deepEqual(W.select(['a','b','c'],'d'),['a','b','c'],'스카우팅 비교는 예전처럼 3명');
});

test('같은 선수인지는 id · 값으로 — sameNow',()=>{
  const b=body('sameNow');
  assert.match(b,/String\(p\.id\)===id&&p\.type!=='target'/);
  assert.match(b,/key\(p\)===sig\[String\(p\.id\)\]/);
  assert.match(body('regroup'),/sameNow\(sig,key\)/);
});

test('스카우팅 후보가 이미 명단에 있나 — 불러온 표식 · 같은 이름 + 생년월일 · 같은 이름 + 번호',()=>{
  const roster=[
    {id:'p1',name:'가상 민수',num:'7',profile:{}},
    {id:'p2',name:'가상 지호',num:'',profile:{dob:'2011-03-04'}},
    {id:'p3',name:'가상 도윤',num:'9',joinedFrom:{cid:'cand:9'}},
    {id:'p4',name:'가상 하늘',num:'',profile:{}}
  ];
  assert.equal(W.rosterMatch(roster,{cid:'cand:9',name:'다른 이름',num:'1'}),'dup','불러온 표식(joinedFrom.cid)이면 이름이 달라도 있음');
  assert.equal(W.rosterMatch(roster,{cid:'c1',name:'가상 민수',num:'7'}),'dup','같은 이름 + 같은 번호');
  assert.equal(W.rosterMatch(roster,{cid:'c1',name:' 가상  민수 ',num:7}),'dup','띄어쓰기 · 숫자 번호도 같은 사람');
  assert.equal(W.rosterMatch(roster,{cid:'c2',name:'가상 민수',num:'8'}),'','같은 이름이라도 번호가 다르면 다른 사람');
  assert.equal(W.rosterMatch(roster,{cid:'c3',name:'가상 지호',num:'5',profile:{dob:'2011-03-04'}}),'dup','생년월일이 같으면 있음');
  assert.equal(W.rosterMatch(roster,{cid:'c4',name:'가상 지호',num:'',profile:{dob:'2012-01-01'}}),'','생년월일이 다르면 다른 사람');
  assert.equal(W.rosterMatch(roster,{cid:'c5',name:'가상 하늘',num:'3'}),'same','가를 값이 없으면 «같은 이름»만 알린다(흐리게 두지 않음)');
  assert.equal(W.rosterMatch(roster,{cid:'c6',name:'가상 새얼굴',num:'1'}),'');
  assert.equal(W.rosterMatch([],{cid:'c7',name:'',num:''}),'');
});

test('빼기는 «선수 삭제»와 같은 길 — 삭제 기록이 먼저, 실패하면 그 선수부터 멈춘다',()=>{
  const b=body('removeSelected');
  assert.match(b,/win\.psConfirm\(/,'이름을 보여 주고 확인을 받는다');
  assert.match(b,/평가 기록도 함께 지워져요/);
  const tomb=b.indexOf('win.plTombAdd(p.id)'),splice=b.indexOf('d.players.splice(at,1)'),save=b.indexOf("win.save({deletedIds:gone,skipTargets:true})");
  assert.ok(tomb>0&&splice>tomb&&save>splice,'plTombAdd → splice → save({deletedIds,skipTargets})');
  assert.match(b,/break;/,'삭제 기록을 못 남기면 나머지는 그대로 둔다');
  assert.match(b,/owner===win\.teamSaveOwner\(\)&&sameNow\(sig,key\)/,'확인 창이 떠 있는 사이 팀 · 그 선수(이름 · 번호)가 바뀌면 멈춘다 — data 를 바꿔 끼운 동기화는 막지 않는다');
  assert.match(b,/groupAllowed\(\)/,'운영진 · 잠금 · 보기 전용 확인');
});

test('넣기 · 불러오기는 명단에만 쓰고 스카우팅 원장은 건드리지 않는다',()=>{
  const q=body('quickAdd'),imp=body('importScout');
  assert.match(q,/d\.players\.push\(p\);var ok=win\.save\(\{skipTargets:true\}\)/,'후보 문서는 쓰지 않는다');
  assert.match(imp,/var ok=win\.save\(\{skipTargets:true\}\)/);
  assert.match(q,/type:'ours'/);
  assert.match(imp,/joinedFrom:\{at:now,cid:r\.cid/,'다시 불러오기를 막는 표식');
  assert.match(imp,/levels:\{\}/,'스카우팅 평가는 옮기지 않는다(스카우팅에 그대로)');
  assert.doesNotMatch(imp,/scStore\(\)\.(set|write|save|importLegacy)|scoutStore\.set|scMakePlacement|scArchiveCandidate/,'후보 원장에 쓰지 않는다');
  assert.match(imp,/owner!==win\.teamSaveOwner\(\)/,'창을 연 뒤 팀이 바뀌면 넣지 않는다');
  assert.match(imp,/rosterMatch\(rosterNow,it\.r\)!=='dup'/,'넣는 순간의 명단으로 다시 걸러 같은 후보를 두 번 넣지 않는다');
  const block=src.slice(src.indexOf('function scoutVisible('),src.indexOf('function compare(kind)'));
  assert.ok(block.length>4000,'3.339 구간');
  assert.doesNotMatch(block,/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/,'새 구간에 빈 catch 를 두지 않는다(저장 계층 문)');
});

test('한글 조합을 끝내는 Enter 는 넣기가 아니고, 치는 중엔 줄을 다시 그리지 않는다',()=>{
  assert.match(src,/e\.isComposing\|\|e\.keyCode===229/);
  assert.match(body('paintQuick'),/f\.contains\(doc\.activeElement\)\|\|f\.elements\.name\.value/);
});

'use strict';
/* 3.294 — 팀을 넷보다 많이(제보 29c97fc5 «팀 5, 팀 6 등 제한 없이» · 사용자 11/15 «팀 많이 추가할수 있게 해줘»).
   팀 목록은 studio/board-teams.js(PSTeams) 한 곳 — 작전판 본문 · 유니폼 창 · 떠 있는 도크가 여기서 읽는다. 화면은 tests/browser/board-more-teams-3294. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const T=require('../studio/board-teams.js');

test('앞의 넷은 예전 값 그대로 — 저장본의 팀 키도 색도 바뀌지 않는다. pink 은 옛 다섯째 팀 그대로 팀 5',()=>{
  assert.deepEqual(T.KEYS.slice(0,5),['blue','red','yellow','green','pink']);
  assert.deepEqual(T.KEYS.slice(0,5).map(k=>[T.COL[k],T.GK[k],T.TXT[k]]),[['#1a2f5c','#3aa6dc','#ffffff'],['#d12f38','#d4a017','#ffffff'],['#eeff00','#10b981','#1c1300'],['#34a56f','#d4a017','#ffffff'],['#e0569f','#8e2a55','#ffffff']]);
  const B=R('studio/board.html');
  /* 본문의 색 표와 같은 값(본문 표는 그대로 두고 없는 팀만 채운다) */
  for(const k of ['yellow','red','blue','green','pink']){assert.ok(B.includes(k+':"'+T.COL[k]+'"'),'TEAMCOL '+k);}
  assert.equal(T.BASE,4);assert.equal(T.MAX,10);assert.equal(T.KEYS.length,10);assert.equal(new Set(T.KEYS).size,10);
  assert.ok(T.KEYS.every(k=>/^#[0-9a-f]{6}$/.test(T.COL[k])&&/^#[0-9a-f]{6}$/.test(T.GK[k])&&/^#[0-9a-f]{6}$/.test(T.TXT[k])));
  assert.equal(new Set(T.KEYS.map(k=>T.COL[k])).size,10,'기본 색은 팀마다 다르다');
  assert.ok(T.KEYS.every(k=>T.COL[k]!==T.GK[k]),'골키퍼는 제 팀과 다른 색');
});

test('번호 · 이름 · 오른쪽 팀 — 짝수 번호가 오른쪽(팀 2 · 4 가 원래 그랬다)',()=>{
  assert.deepEqual(T.KEYS.map(T.no),[1,2,3,4,5,6,7,8,9,10]);
  assert.deepEqual(T.KEYS.map(T.name),['팀 1','팀 2','팀 3','팀 4','팀 5','팀 6','팀 7','팀 8','팀 9','팀 10']);
  assert.deepEqual(T.KEYS.filter(T.right),['red','green','orange','sky','black']);
  for(const bad of ['','home','away','neutral','equip','toString','__proto__','constructor',null,undefined,5,{}]){assert.equal(T.has(bad),false,String(bad));assert.equal(T.no(bad),0);assert.equal(T.name(bad),'');assert.equal(T.right(bad),false);}
});

test('fill — 색 표에 없는 팀만 채운다(본문의 값 · 사용자 정의 키는 그대로)',()=>{
  const col={yellow:'#eeff00',red:'#d12f38',blue:'#1a2f5c',green:'#34a56f',pink:'#000001',home:'#1a2f5c',away:'#d12f38',neutral:'#d4a017'},gk={blue:'#3aa6dc',home:'#3aa6dc'},txt={yellow:'#1c1300'};
  T.fill(col,gk,txt);
  assert.equal(col.pink,'#000001','있던 값은 안 덮는다');assert.equal(col.home,'#1a2f5c');assert.equal(col.neutral,'#d4a017');
  for(const k of T.KEYS.slice(5)){assert.equal(col[k],T.COL[k]);assert.equal(gk[k],T.GK[k]);assert.equal(txt[k],T.TXT[k]);}
  assert.equal(gk.blue,'#3aa6dc');assert.equal(txt.yellow,'#1c1300');assert.equal(txt.blue,'#ffffff');
  const one={};T.fill(one);assert.deepEqual(Object.keys(one),T.KEYS,'표 하나만 넘겨도 된다(TEAMHEX)');
  assert.doesNotThrow(()=>T.fill(null,undefined,7));
});

test('쓰는 만큼만 보인다 — 넷 + 판에서 쓰는 가장 큰 번호 + 꺼낸 팀 + 고른 팀, 열을 넘지 않는다',()=>{
  const pl=(...teams)=>teams.map((team,i)=>({id:i+1,team}));
  assert.equal(T.used(null,null,null),0);
  assert.equal(T.used({players:pl('blue','red')},null,null),2);
  assert.equal(T.used({players:pl('blue','purple','home','???')},null,null),7);
  assert.equal(T.used({players:pl('blue')},{frames:[{snap:{players:pl('red')}},null,{snap:null},{snap:{players:pl('sky')}}]},null),8,'다른 장면');
  assert.equal(T.used({players:pl('blue')},{frames:[]},[{snap:{players:pl('orange')}},null,{}]),6,'다른 페이지의 대표 판');
  assert.equal(T.used({players:[null,7,'x',{team:null},{team:{}}]},{frames:'x'},'x'),0,'이상한 모양');
  assert.equal(T.countOf(0,0,''),4);assert.equal(T.countOf(2,0,'blue'),4);
  assert.equal(T.countOf(6,0,'blue'),6);assert.equal(T.countOf(0,5,'blue'),5);assert.equal(T.countOf(0,0,'purple'),7,'고른 팀은 늘 보인다');
  assert.equal(T.countOf(99,99,'black'),10);assert.equal(T.countOf(-3,-1,'equip'),4);
});

test('저장 팀 불러오기의 대기 줄 — 팀 둘마다 한 줄 위(짝수 팀은 반대쪽 구석)',()=>{
  assert.deepEqual(T.KEYS.map(T.benchFrom),[0,0,16,16,32,32,48,48,64,64]);
  assert.equal(T.benchFrom('nope'),0);
  const L=require('../studio/team-load.js'),players=Array.from({length:16},(_,i)=>({name:'선수'+i,pos:'CM'}));
  const cells=new Set();
  for(const k of ['blue','yellow','pink','purple','white']){const p=L.plan([],players,{keep:true,from:T.benchFrom(k)});
    for(const a of p.add){const key=a.x.toFixed(3)+','+a.y.toFixed(3);assert.equal(cells.has(key),false,k+' 가 다른 팀 대기 줄과 겹친다');cells.add(key);assert.ok(a.x>0&&a.x<1&&a.y>0&&a.y<1,k+' 운동장 안');}}
});

test('배선 — 작전판 본문 · 유니폼 창 · 도크 · 오프라인 묶음',()=>{
  const B=R('studio/board.html'),K=R('studio/board-kit.js'),D=R('studio/board-dock-float.js');
  const at=B.indexOf('<script src="board-teams.js"></script>');assert.ok(at>0);
  assert.ok(at>B.indexOf('id="benchCat"'),'팀 알약 마크업 뒤 — 읽히자마자 추가 알약을 만든다');
  assert.ok(at<B.indexOf('<script src="board-kit.js"></script>')&&at<B.indexOf('<script src="board-dock-float.js"></script>'),'유니폼 창 · 도크보다 먼저');
  assert.ok(at<B.indexOf('const TEAMCOL={'),'본문보다 먼저');
  assert.ok(B.includes('PSTeams.fill(TEAMCOL,GK_DEF,TEAMTXT);'));assert.ok(B.includes(';PSTeams.fill(TEAMHEX);'));
  assert.ok(B.includes('function isRightTeam(t){return t==="away"||PSTeams.right(t);}'));
  assert.ok(B.includes('const TEAMS=PSTeams.KEYS,TEAMNO=PSTeams.NO,TEAMDEF=PSTeams.COL;'));
  assert.ok(B.includes('function stampTeam(){return PSTeams.has(benchCat)?benchCat:"blue";}'));
  assert.equal(B.split('PSTeams.KEYS.concat("home","away","neutral").forEach(function(t){').length-1,2,'무늬 정의 둘');
  assert.equal(/\["blue","red","yellow"/.test(B),false,'본문에 팀 넷을 박은 목록이 남아 있지 않다');
  assert.equal(/p\.team==="red"\|\|p\.team==="green"/.test(B),false);
  assert.match(R('sw.js'),/'\/studio\/board-teams\.js'/);
  assert.ok(K.includes("var TEAMS = PT.KEYS.map(function (k) { return [k, PT.name(k)]; });"));assert.ok(K.includes('var TEAM_DEF = PT.COL;'));
  assert.ok(K.includes('b.hidden = !on && teamsOn.indexOf(t) < 0;'),'유니폼 창의 팀 칸은 쓰는 팀만');
  assert.ok(K.includes('win.__psKitDecorate = function'));assert.ok(D.includes('win.__psDfLabelChips = function'));
  assert.ok(D.includes("grid-template-columns:repeat(5,1fr)"),'도크 «선수» 칸은 다섯 칸 — 팀 넷 + «팀 추가», 팀 10까지 두 줄');
  const kit=require('../studio/board-kit.js');assert.ok(kit,'node 에서도 읽힌다(require 로 팀 목록)');
});

'use strict';
/* 3.287 — 경기 종류 «대회»(제보 39338d23 · 7f00f3c9, 사용자 11/14 «대회는 정식»). 종류 넷은 studio/match-kind.js 한 곳 —
   일정(process.html) · 경기(scout.html) · IDP · 연간 기록이 같은 이름 · 같은 차례 · 같은 전적 규칙을 쓴다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const R=f=>fs.readFileSync(path.join(root,f),'utf8');
const K=require('../studio/match-kind.js');
function fn(src,name){const a=src.indexOf('function '+name+'(');assert.ok(a>=0,name);let j=src.indexOf('{',a),d=0;for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)break;}return src.slice(a,j+1);}

test('종류 넷 — 리그 · 컵 · 대회 · 친선 차례, 옛 값 · 모르는 값은 리그',()=>{
  assert.deepEqual(K.LIST.map(o=>o[0]),['official','cup','tour','friendly']);
  assert.deepEqual(K.LIST.map(o=>o[1]),['리그','컵','대회','친선']);
  for(const k of ['official','cup','tour','friendly'])assert.equal(K.norm(k),k);
  for(const k of [undefined,null,'','Tour','toString','__proto__',3])assert.equal(K.norm(k),'official',String(k));
  assert.equal(K.label('tour'),'대회');assert.equal(K.label('odd'),'리그');assert.equal(K.label('odd','경기'),'경기');
  assert.equal(K.has('tour'),true);assert.equal(K.has('constructor'),false);
  assert.ok(Object.isFrozen(K.LB),'다른 화면이 이름표를 고치지 못한다');
});

test('전적 — 대회는 컵처럼 정식(공식전), 친선만 친선',()=>{
  assert.deepEqual(['official','cup','tour','friendly',undefined].map(K.official),[true,true,true,false,true]);
  const S=R('studio/scout.html'),c={};vm.runInNewContext(fn(S,'matchKindOf')+';this.f=matchKindOf;',c);
  assert.equal(c.f({kind:'tour'}),'official','경기 목록 전적 통(공식전 · 친선)에서 대회는 공식전');
  assert.equal(c.f({kind:'friendly'}),'friendly');
});

test('일정 시트 · 고르개 · 월간 칸이 같은 표를 쓴다',()=>{
  assert.deepEqual(K.fix(),[['리그','#C24A46','official'],['컵','#B5762B','cup'],['대회','#0E7490','tour'],['친선','#7C5CC4','friendly']]);
  assert.deepEqual(K.options().map(o=>o.label),['리그','컵','대회','친선']);
  assert.deepEqual(['official','cup','tour','friendly','x'].map(K.cls),['',' cup',' tour',' friendly','']);
  assert.match(K.CSS,/\.mcell \.mkind\.k-tour\{background:var\(--tour\)\}/);
  assert.match(K.CSS,/\.mcell\.m\.tour\{/);assert.match(K.CSS,/button\.on\[data-mk="tour"\]/);assert.match(K.CSS,/body\.fmdark\{--tour:/);
  const P=R('studio/process.html');
  assert.ok(P.includes('var SCHED_FIX=PSMatchKind.fix();'),'주간 «일정» 고르개');
  assert.ok(P.includes('var FIX=PSMatchKind.fix();'),'채우기 시트 «종류»');
  assert.ok(P.includes('var M_KIND_LB=PSMatchKind.LB;'));
  assert.ok(!/cup:'컵'/.test(P),'일정 본문에 따로 적은 이름표가 남지 않는다');
});

test('고른 대회가 저장 · 다시 읽기에서 리그로 바뀌지 않는다(일정 · 경기 화면)',()=>{
  const P=R('studio/process.html'),c={PSMatchKind:K};
  vm.runInNewContext(fn(P,'mMatchKind')+';this.f=mMatchKind;',c);
  assert.equal(c.f({match:{kind:'tour'}}),'tour');assert.equal(c.f({match:{}}),'official');assert.equal(c.f(null),'official');
  const S=R('studio/scout.html');
  assert.equal((S.match(/PSMatchKind\.norm\(/g)||[]).length,6,'경기 → 일정 잇기 셋 · 새 경기 · 경기 정보의 값 · 저장');
  assert.ok(S.includes('if(PSMatchKind.has(_sk)){'),'일정 → 경기 합치기도 대회를 가져온다');
  assert.ok(!/v\.kind==="cup"/.test(S)&&!/m\.kind==="cup"/.test(S),'scout 본문에 컵만 아는 판정이 남지 않는다');
  assert.ok(S.includes('{key:"competition",label:"대회 이름",'),'구분 «대회»와 이름 칸을 가른다');
});

test('연간 기록 — 종류별 줄은 넷, 추가 경기도 제 종류',()=>{
  const Y=R('studio/year-plan.js');
  assert.ok(Y.includes('const kinds=Object.keys(M_KIND_LB).map('));
  assert.ok(Y.includes("kind:L.k}"),'추가 경기는 컵 · 대회를 잃지 않는다');
});

test('싣기 — 일정 · 경기 · IDP 머리에서 읽고, 오프라인 묶음에 든다',()=>{
  for(const f of ['studio/process.html','studio/scout.html','studio/idp.html']){
    const s=R(f),i=s.indexOf('<script src="match-kind.js"></script>'),st=s.indexOf('<script src="storage.js"></script>');
    assert.ok(i>0,f);assert.ok(i<s.indexOf('</head>')||s.indexOf('</head>')<0,f+' 머리');
    assert.ok(st>=0&&st<i,f+' storage.js 뒤');
    const use=s.indexOf('PSMatchKind.');assert.ok(use>i,f+' 쓰기 전에 싣는다');
  }
  assert.match(R('sw.js'),/'\/studio\/match-kind\.js'/);
  const I=R('studio/idp.html');assert.equal((I.match(/kind=PSMatchKind\.label\(m\.kind\)/g)||[]).length,2,'IDP 경기 줄 둘');
  assert.ok(R('studio/board.html').includes('tour:"대회"'),'작전판 경기 연결 창');
});

test('모듈 — 문서에 대회 색 규칙을 한 번만 붙인다',()=>{
  const added=[];const doc={head:{appendChild:s=>added.push(s)},createElement:()=>({}),getElementById:id=>added.find(s=>s.id===id)||null};
  K.style(doc);K.style(doc);
  assert.equal(added.length,1);assert.equal(added[0].id,'ps-match-kind');assert.equal(added[0].textContent,K.CSS);
  K.style(null);
});

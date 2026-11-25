'use strict';
/* 3.378 — 가용인원 › 부상 리포트(injury-report.js). 사용자 11/25 «가용인원에 부상리포트» → 목업 A안 + «선수를 클릭하면 개인으로도» · «이미지는 a4».
   셈 · A4 쪽 나누기는 모듈을 그대로 부르고(DOM 없음), scout.html · sw.js 는 배선만 글자로 본다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const R=require('../studio/injury-report.js');
const SRC=fs.readFileSync(path.join(root,'studio/injury-report.js'),'utf8');
const SC=fs.readFileSync(path.join(root,'studio/scout.html'),'utf8');
const measure=(s,size)=>String(s).length*size*0.62;
const who=(i,o)=>Object.assign({id:'p'+i,num:String(i),name:'가상 선수 '+i,pos:'CM',grp:'A팀',year:'2학년'},o||{});
const ep=o=>Object.assign({from:'2026-11-10',to:'2026-11-25',open:true,days:16,injury:10,rehab:6,notes:[],part:'발목',side:'L',when:'train',memo:''},o||{});
const row=(i,e,o)=>Object.assign({who:who(i),status:e&&e.open?'injury':'',until:'',e:e,missed:{train:3,match:1}},o||{});
const input=rows=>({teamName:'프로세스FC',today:'2026-11-25',from:'2026-10-29',to:'2026-11-25',soonTo:'2026-12-02',rows});

test('팀 셈: 열린 부상은 늘 · 끝난 부상은 기간에 걸친 것만 · 오래된 부상부터',()=>{
  const m=R.team(input([
    row(1,ep({from:'2026-11-20',days:6})),
    row(2,ep({from:'2026-11-03',days:23}),{status:'rehab',until:'2026-11-28'}),
    row(3,ep({from:'2026-11-02',to:'2026-11-10',open:false,days:9,part:'종아리'})),
    row(4,ep({from:'2026-09-01',to:'2026-09-10',open:false,days:10})),          // 기간 밖 — 빠진다
    row(5,null,{status:'injury'}),                                               // 상태만 부상 · 기간 기록 없음 — 빠뜨리지 않는다
    row(6,ep({from:'2026-11-24',days:2,part:''}),{until:'2026-12-20'})
  ]));
  assert.deepEqual(m.now.map(r=>r.who.id),['p2','p1','p6','p5']);
  assert.deepEqual(m.back.map(r=>r.who.id),['p3']);
  assert.deepEqual(m.kpi,{injury:3,rehab:1,soon:1,back:1});
  assert.equal(m.total,5);
  assert.equal(m.parts[0].part,'발목');assert.equal(m.parts[0].n,2);
  assert.equal(m.parts[m.parts.length-1].part,'부위 미정','부위 미정은 늘 맨 뒤');
  assert.equal(R.partNote({open:1,done:2,days:21}),'진행 중 1 · 평균 복귀 11일');
});

function inside(pages){
  pages.forEach((p,i)=>p.ops.forEach(o=>{
    const bottom=o.t==='rect'?o.y+o.h:o.y;
    assert.ok(bottom<=R.H-20,'쪽 '+(i+1)+' 아래로 넘침 '+JSON.stringify(o));
    if(o.t==='rect')assert.ok(o.x>=R.M-0.5&&o.x+o.w<=R.W-R.M+0.5,'좌우 여백 '+JSON.stringify(o));
  }));
}
test('A4: 5명은 한 장 · 40명은 글자를 줄이지 않고 다음 쪽으로',()=>{
  const few=R.teamPages(R.team(input([1,2,3,4,5].map(i=>row(i,ep({memo:'슈팅하다 당김 · 병원 진료'}))))),measure);
  assert.equal(few.length,1);inside(few);
  const rows=[];for(let i=1;i<=40;i++)rows.push(row(i,ep({memo:'착지하다 꺾임 · 반깁스 · 2주 뒤 다시 확인하기로 함 · 조깅부터 시작'})));
  for(let i=41;i<=60;i++)rows.push(row(i,ep({open:false,from:'2026-11-01',to:'2026-11-09',days:9})));
  const many=R.teamPages(R.team(input(rows)),measure);
  assert.ok(many.length>=3,'쪽 수 '+many.length);inside(many);
  const sizes=new Set();many.forEach(p=>p.ops.forEach(o=>{if(o.t==='text')sizes.add(o.size);}));
  assert.deepEqual([...sizes].sort((a,b)=>a-b),[12,14,20,28],'글자 크기는 정한 넷뿐');
  const names=new Set();many.forEach(p=>p.ops.forEach(o=>{if(o.t==='text'&&/^\d+ 가상 선수 \d+$/.test(o.s))names.add(o.s);}));
  assert.equal(names.size,60,'선수 60명이 모두 실린다');
  many.forEach((p,i)=>assert.ok(p.ops.some(o=>o.s===(i+1)+' / '+many.length),'쪽 번호'));
  assert.ok(many[1].ops.some(o=>/이어서$/.test(o.s)),'둘째 쪽 머리');
  assert.equal(R.PX[0]/R.PX[1]>0.706&&R.PX[0]/R.PX[1]<0.708,true,'A4 세로 비율');assert.deepEqual(R.PX,[2480,3508]);
});

test('개인: 부상 한 건마다 사실 · 막대 · 메모 · 날짜별 메모, 긴 기록은 다음 쪽',()=>{
  const m={who:who(7),teamName:'프로세스FC',today:'2026-11-25',status:'rehab',until:'2026-11-28',episodes:[
    Object.assign(ep({from:'2026-11-03',days:23,injury:15,rehab:8,part:'햄스트링',side:'R',memo:'슈팅하다 당김'}),{missed:{train:13,match:3},log:[{day:'2026-11-04',note:'병원 진료'},{day:'2026-11-18',note:'조깅 시작'}]}),
    Object.assign(ep({from:'2026-04-08',to:'2026-04-19',open:false,days:12,injury:12,rehab:0}),{missed:{train:7,match:2},log:[]})
  ]};
  assert.deepEqual(R.epFacts(m,m.episodes[0],true),[['다친 날','11/3 · 훈련 중'],['지금','재활 8일째'],['복귀 예상','11/28'],['빠진 훈련 · 경기','13 · 3']]);
  assert.deepEqual(R.epFacts(m,m.episodes[1],false),[['다친 날','4/8 · 훈련 중'],['복귀한 날','4/19'],['기간','12일'],['빠진 훈련 · 경기','7 · 2']]);
  assert.deepEqual(R.epBar(m,m.episodes[0]),[{k:'injury',days:15},{k:'rehab',days:8},{k:'left',days:3}]);
  assert.deepEqual(R.epBar(m,m.episodes[1]),[{k:'injury',days:12}]);
  const pages=R.playerPages(m,measure);assert.equal(pages.length,1);inside(pages);
  const text=pages[0].ops.filter(o=>o.t==='text').map(o=>o.s);
  ['가상 선수 7','햄스트링 · 오른쪽','진행 중','코치 메모','슈팅하다 당김','날짜별 메모','병원 진료','복귀'].forEach(s=>assert.ok(text.includes(s),s));
  const long=Object.assign({},m,{episodes:Array.from({length:8},(_,i)=>Object.assign({},m.episodes[1],{memo:'메모 '.repeat(60),log:Array.from({length:10},(_,j)=>({day:'2026-04-1'+j,note:'경과 '+i+'-'+j}))}))});
  const lp=R.playerPages(long,measure);assert.ok(lp.length>=2);inside(lp);
  assert.equal(R.playerPages(Object.assign({},m,{episodes:[]}),measure)[0].ops.some(o=>o.s==='부상 기록 0건입니다.'),true);
});

test('A4: 긴 이름은 제 칸 안에서 말줄임 — 옆 칸을 덮지 않는다',()=>{
  const long=row(1,ep());long.who=who(1,{name:'아주 긴 이름 '.repeat(12)});
  const pages=R.teamPages(R.team(input([long,Object.assign(row(2,ep({open:false,from:'2026-11-01',to:'2026-11-09',days:9})),{who:who(2,{name:'아주 긴 이름 '.repeat(12)})})])),measure);
  const names=pages[0].ops.filter(o=>o.t==='text'&&/아주 긴 이름/.test(o.s));
  assert.equal(names.length,2);names.forEach(o=>{assert.ok(/…$/.test(o.s));assert.ok(measure(o.s,o.size)<=180,o.s);});
});

test('줄바꿈: 폭 안에서 자르고 줄 수를 넘으면 말줄임',()=>{
  const lines=R.wrap('가나다라 마바사아 자차카타 파하 가나다라 마바사아',10,500,60,2,measure);
  assert.equal(lines.length,2);assert.ok(lines.every(l=>measure(l,10)<=60));assert.ok(/…$/.test(lines[1]));
  assert.deepEqual(R.wrap('',12,500,100,3,measure),[]);
});

test('배선: 셋째 탭 · 시즌 기간 · 스크립트 차례 · 서비스워커 · 새 저장 칸 없음',()=>{
  assert.ok(SC.includes('<script src="avail-table.js"></script><script src="injury-report.js"></script>'));
  assert.ok(SC.includes("[['days','날짜별'],['players','선수별 누적'],['injury','부상 리포트']]"));
  assert.ok(SC.includes("if(availMode==='injury')h+=renderAvailInjury(ours,from,today);else if(availMode==='players')"));
  assert.ok(SC.includes("if(availMode==='injury')irBind(root,ours,from,today);"));
  assert.ok(SC.includes("season=availRange==='season'&&availMode!=='days'"));
  assert.ok(/'\/studio\/avail-table\.js', '\/studio\/injury-report\.js'/.test(fs.readFileSync(path.join(root,'sw.js'),'utf8')));
  assert.ok(!/injuryInfo\s*\[|statusRuns\s*\[|(^|[^.\w])save\s*\(|localStorage|setItem/.test(SRC),'읽기만 한다 — 저장 길 없음');
  assert.ok(!/catch\s*\(\s*_?\s*\)\s*\{\s*\}/.test(SRC),'빈 catch 없음(저장 계층 문)');
  assert.ok(!/navigator\.clipboard|location\.href\s*=|encodeURIComponent/.test(SRC),'공유 링크를 만들지 않는다');
  const e=require('../studio/release-notes.js').entries().find(x=>x.id==='2026-11-25-v3-378-injury-report');assert.ok(e);assert.match(e.title,/v3\.378/);
});

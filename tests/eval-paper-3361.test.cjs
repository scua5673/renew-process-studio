'use strict';
/* 3.361 — 선수 평가서 · 선수 추천서. 그리기(eval-paper.js)와 팀 쪽 사본 · 집계(eval-paper-team.js)의 규칙. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
require('../studio/eval-paper.js');
const E=globalThis.PSEvalPaper;
const T=require('../studio/eval-paper-team.js');

const gs=[{cat:'전술',cid:'tac',items:[{id:'a',name:'스캔'},{id:'b',name:'전환'}]},
  {cat:'태도',cid:'att',items:[{id:'c',name:'소통'}]},
  {cat:'포지션 · 풀백',cid:'pos',items:[{id:'d',name:'측면 1v1'},{id:'e',name:'크로스'}]}];

test('눈금 모양 — 없는 값은 0(평가 전), 지난 눈금은 pv 로', ()=>{
  const g=E.shape(gs,{a:4,b:9,c:2,d:4,e:'2'},{a:3,d:4},null);
  assert.deepEqual(g[0].items.map(i=>[i.v,i.pv]),[[4,3],[0,0]]);
  assert.equal(g[2].pos,true);assert.equal(g[0].en,'Tactical');assert.equal(g[1].en,'Social');
  assert.deepEqual(E.radarRows(g).map(r=>[r.lb,r.now,r.prev]),[['전술',4,3],['태도',2,null]],'레이더는 포지션 묶음을 빼고 답한 항목만 평균');
});
test('강점 · 키울 것 — 평가한 항목만, 같은 값이면 포지션 항목이 먼저', ()=>{
  const g=E.shape(gs,{a:4,c:2,d:4,e:2},null,null);
  assert.deepEqual(E.pick(g,3,false).map(x=>x.id),['d','a'],'강점은 3 이상만');
  assert.deepEqual(E.pick(g,3,true).map(x=>x.id),['e','c'],'키울 것은 낮은 순 · 평가 전(b)은 빠진다');
  assert.deepEqual(E.pick(E.shape(gs,{},null,null),3,false),[]);
});
test('포지션 코드 — 자리표에 있는 것만', ()=>{
  assert.equal(E.posCode('rb'),'RB');assert.equal(E.posCode('CF'),'ST');assert.equal(E.posCode('LCM'),'CM');
  assert.equal(E.posCode('RM'),'RWB');assert.equal(E.posCode('풀백'),'');assert.equal(E.posCode(''),'');
});
test('표의 줄 — 있는 기록만 적는다', ()=>{
  assert.deepEqual(E.rows(null,{n:0,mins:0},{n:0,mins:0}),[]);
  const r=E.rows({match:{total:22,start:13,res:5,goals:1},train:{done:96,scheduled:112,minutes:8640}},{n:18,mins:1240},{n:0,mins:0});
  assert.deepEqual(r.map(x=>x.k),['선발','리저브','출전 · 선수 기록','득점','팀 훈련']);
  assert.equal(r[0].n,'13 / 22경기');assert.equal(r[0].r,'59%');assert.equal(r[2].t,'1,240분');assert.equal(r[4].t,'8,640분');
});
test('평가서 — 3 이상은 hi, 평가 전은 «–», 달라진 칸은 화살표', ()=>{
  const g=E.shape(gs,{a:4,c:2,d:3},{a:3,d:5},null);
  const h=E.evalSheet({name:'가상 <선수>',groups:g,radar:E.radarRows(g),pos:{main:'RB',subs:['RB','CB','??']},opinion:'<b>x</b>'});
  assert.ok(h.includes('가상 &lt;선수&gt;')&&h.includes('&lt;b&gt;x&lt;/b&gt;'),'받은 글은 이스케이프');
  assert.equal((h.match(/class="evp-dr hi"/g)||[]).length,2);assert.equal((h.match(/class="evp-dr"/g)||[]).length,3);
  assert.ok(h.includes('<em>↑1</em>')&&h.includes('<em>↓2</em>'));assert.ok(h.includes('<b>–</b>'));
  assert.ok(h.includes('스태프 전용')&&h.includes('키울 것 3'));
  assert.ok(h.includes('aria-label="포지션 — 주 RB · 보조 CB"'),'보조에서 주 포지션 · 모르는 코드는 빠진다');
});
test('추천서 — 항목별 눈금 · 키울 것 · 스태프 표시는 넣지 않는다', ()=>{
  const g=E.shape(gs,{a:4,c:5,d:3},null,null);
  const h=E.recoLetter({name:'가상 선수',groups:g,radar:E.radarRows(g),strengths:[{name:'스캔',en:'Scanning',text:E.phrase(4)}],to:'프로세스고등학교',opinion:'추천'});
  for(const x of ['evp-dr','키울 것','스태프 전용','항목 전체'])assert.ok(!h.includes(x),x);
  assert.ok(E.radar([{lb:'전술',en:'Tactical',now:3},{lb:'기술',en:'Technical',now:null},{lb:'체력',en:'Physical',now:4}],{en:true}).includes('Tactical'));
  assert.equal(E.radar([{lb:'전술',now:3}]),'','영역이 셋보다 적으면 레이더를 그리지 않는다');
  for(const x of ['Player Recommendation','Scanning','프로세스고등학교 귀중','Signature','압박이 강한 경기에서도 꾸준히 해냅니다.'])assert.ok(h.includes(x),x);
  assert.equal(E.phrase(5,true),'늘 보여 줍니다.');assert.equal(E.phrase(3),'경기에서 해냅니다.');
});
test('사본 — 정해진 칸만, 눈금은 1~5, 그려진 종이는 두지 않는다', ()=>{
  assert.equal(T.clean({kind:'eval'}),null);assert.equal(T.clean({id:'x',kind:'other'}),null);
  const c=T.clean({id:'p1',kind:'eval',at:5,date:'2026-11-22',label:'가'.repeat(200),opinion:'나'.repeat(3000),levels:{a:3,b:0,c:7,d:'4'},html:'<article>',picks:['a']});
  assert.deepEqual(Object.keys(c).sort(),['at','by','date','id','kind','label','levels','opinion']);
  assert.deepEqual(c.levels,{a:3,d:4});assert.equal(c.label.length,80);assert.equal(c.opinion.length,2000);
  const r=T.clean({id:'p2',kind:'reco',to:'프로세스고등학교',picks:['a','b','c','d',5],levels:{a:3}});
  assert.deepEqual(r.picks,['a','b','c']);assert.ok(!('levels' in r));
});
test('사본 목록 — 새 것이 앞, 같은 id 는 제자리, 24장까지', ()=>{
  let list=[];for(let i=0;i<30;i++)list=T.upsert(list,{id:'p'+i,kind:'eval'});
  assert.equal(list.length,T.MAX);assert.equal(list[0].id,'p29');
  const again=T.upsert(list,{id:'p20',kind:'eval',label:'고침'});
  assert.equal(again.length,T.MAX);assert.equal(again.find(x=>x.id==='p20').label,'고침');assert.equal(again[0].id,'p29');
});
test('경기 명단 집계 — 기간 안의 선발 · 리저브 · 득점(이름)', ()=>{
  const ms=[{date:'2026-03-01',squad:{start:['p'],res:[]},goals:[{side:'us',who:'가상 선수'},{side:'them',who:'가상 선수'}]},
    {date:'2026-04-01',squad:{start:[],res:['p']},goals:[{side:'us',who:'다른 선수'}]},{date:'2026-05-01',squad:{start:['q'],res:[]}},{date:'2025-12-31',squad:{start:['p']}}];
  assert.deepEqual(T.matchStats(ms,'p','가상 선수','2026-01-01','2026-12-31',m=>m.squad),{total:3,start:1,res:1,goals:1});
  assert.equal(T.blockMinutes({blocks:[{minutes:'20',sets:2},{min:15},{dur:'x'}]}),55);
});
test('배선 — 팀 쪽은 선수 역할에 답하지 않고, 사본은 teamEvalList 로 실려 온다', ()=>{
  const team=read('studio/eval-paper-team.js'),scout=read('studio/scout.html'),idp=read('studio/idp.html'),sw=read('sw.js');
  assert.match(team,/role === 'player'\) \{ reply\(\{ ok: false, err: 'player' \}\)/);
  assert.match(team,/if \(!w\.teEditable\(\)\) \{ reply\(\{ ok: false, err: 'forbidden' \}\)/);
  assert.match(scout,/papers:\(p\.papers\|\|\[\]\)\.slice\(\),meetings:/);
  assert.match(scout,/<script src="eval-paper-team\.js\?v=[0-9.]+"><\/script>/);
  assert.match(idp,/<link rel="stylesheet" href="eval-paper\.css\?v=[0-9.]+"><script src="eval-paper\.js\?v=[0-9.]+"><\/script>/);
  assert.match(idp,/p\.evalAt\?\(p\.levels\|\|\{\}\):\{\}/,'한 번도 평가하지 않은 선수의 채워 둔 눈금은 읽지 않는다');
  for(const f of ['eval-paper.js','eval-paper.css','eval-paper-team.js'])assert.ok(sw.includes("'/studio/"+f+"'"),f+' is precached');
  assert.match(read('studio/eval-paper.css'),/#report \.evp h4,\.evp h4\{/);
});

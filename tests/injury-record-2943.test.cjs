'use strict';
/* 2.943 — 선수별로 며칠 훈련·쉼·재활했는지, 어디를 다쳤는지(사용자 «제대로 기록할 수 있게»). 목업 ③④⑤.
   ⓐ 선수별 누적은 일정(훈련·경기)이 있던 날만 센다 — 한 줄을 더하면 그 선수의 일정일.
   ⓑ 부상→재활은 한 건(에피소드). 기간은 달력일. 부위·쪽·언제는 meta.injuryInfo[pid][첫날]. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../studio/participation.js');
const scout=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function block(from,to){const a=scout.indexOf(from),b=scout.indexOf(to,a);assert.ok(a>=0&&b>a,from);return scout.slice(a,b);}
const run=(s,from,to,n)=>Object.assign({s,from,to},n?{n}:{});

test('부상 → 재활은 한 건, 지금도 재활이면 진행 중이고 오늘까지 센다',()=>{
  const meta={statusRuns:{a:[run('ok','2026-09-01','2026-09-27'),run('injury','2026-09-28','2026-10-03','햄스트링 당김'),run('rehab','2026-10-04','2026-10-04')]},
    injuryInfo:{a:{'2026-09-28':{part:'햄스트링',side:'L',when:'match',n:'슈팅하다 당김'}}}};
  const L=P.episodes(meta,'a','rehab','2026-10-05');
  assert.equal(L.length,1);
  const e=L[0];
  assert.equal(e.from,'2026-09-28');assert.equal(e.to,'2026-10-05');assert.equal(e.open,true);
  assert.equal(e.days,8,'달력일 — 다친 날부터 오늘까지');assert.equal(e.injury,6);assert.equal(e.rehab,2,'재활 run 이 오늘까지 늘어난다');
  assert.equal(e.part,'햄스트링');assert.equal(e.side,'L');assert.equal(e.when,'match');assert.equal(e.memo,'슈팅하다 당김');
  assert.deepEqual(e.notes,['햄스트링 당김']);
});
test('복귀하면 닫히고, 정상인 날이 끼면 다른 부상이다',()=>{
  const meta={statusRuns:{a:[run('injury','2026-09-01','2026-09-03'),run('rehab','2026-09-04','2026-09-06'),run('ok','2026-09-07','2026-09-20'),run('injury','2026-09-21','2026-09-21'),run('ok','2026-09-22','2026-10-05')]}};
  const L=P.episodes(meta,'a','ok','2026-10-05');
  assert.equal(L.length,2);
  assert.deepEqual([L[0].from,L[0].to,L[0].days,L[0].open,L[0].part],['2026-09-01','2026-09-06',6,false,'']);
  assert.deepEqual([L[1].from,L[1].to,L[1].days],['2026-09-21','2026-09-21',1]);
});
test('부위 기록은 첫날 키가 없으면 그 부상 안의 날짜로도 찾는다(첫날을 고쳐 적은 경우)',()=>{
  const meta={statusRuns:{a:[run('injury','2026-09-10','2026-09-15')]},injuryInfo:{a:{'2026-09-12':{part:'발목'},'2026-08-01':{part:'무릎'}}}};
  assert.equal(P.episodes(meta,'a','ok','2026-10-05')[0].part,'발목');
});
test('잘못된 기록·다른 선수·미래는 에피소드를 만들지 않는다',()=>{
  const meta={statusRuns:{a:[{s:'injury',from:'2026-10-09',to:'2026-10-12'},{s:'bad',from:'2026-09-01',to:'2026-09-02'},null],b:[run('injury','2026-09-01','2026-09-02')]}};
  assert.deepEqual(P.episodes(meta,'a','injury','2026-10-05'),[]);
  assert.deepEqual(P.episodes(meta,'__proto__','injury','2026-10-05'),[]);
  assert.equal(P.episodes(meta,'b','ok','2026-10-05').length,1);
});
test('선수별 누적: 훈련 + 경기 + 휴식·불참·재활·부상(일정일) + 미기록 = 일정일',()=>{
  const meta={statusRuns:{a:[run('ok','2026-09-01','2026-09-05'),run('rest','2026-09-06','2026-09-06'),run('out','2026-09-07','2026-09-07'),run('injury','2026-09-08','2026-09-10'),run('rehab','2026-09-11','2026-09-14')]}};
  const kind=day=>day.endsWith('05')?'match':day.endsWith('13')?'off':'train';
  const t=P.totals(meta,'a','2026-09-01','2026-09-14',kind,'rehab','2026-09-14');
  assert.equal(t.scheduled,13,'OFF 하루는 일정일이 아니다');
  assert.deepEqual(t.missed,{rest:1,out:1,rehab:3,injury:3});
  assert.equal(t.training+t.match+t.missed.rest+t.missed.out+t.missed.rehab+t.missed.injury+t.unknown,t.scheduled);
  assert.equal(t.rehab,4,'달력일 재활(OFF 포함)은 예전 그대로');
});
test('부위는 목록 안에서만, 메모는 200자, 쪽·언제는 정해진 값만 저장한다',()=>{
  const c=vm.createContext({data:{meta:{}},Date,String});
  vm.runInContext(block('var INJ_PARTS=','function stRetOptions('),c);
  c.stInjInfoSet('a','2026-10-01',{part:'햄스트링',side:'L',when:'train',n:'  '+'가'.repeat(250)+'  '});
  c.stInjInfoSet('b','2026-10-01',{part:'<img>',side:'X',when:'?',n:''});
  const a=c.data.meta.injuryInfo.a['2026-10-01'],b=c.data.meta.injuryInfo.b['2026-10-01'];
  assert.equal(a.part,'햄스트링');assert.equal(a.side,'L');assert.equal(a.when,'train');assert.equal(a.n.length,200);
  assert.equal(b.part,undefined);assert.equal(b.side,undefined);assert.equal(b.when,undefined);assert.equal(b.n,undefined);
  assert.equal(c.INJ_PARTS.length,14);
  assert.equal(c.stInjLabel({part:'',side:'R'}),'부위 미정 · 오른쪽');
});
test('부위별 요약: 이 기간에 걸친 부상만, 평균 복귀는 끝난 부상만으로',()=>{
  const eps={a:[{from:'2026-09-01',to:'2026-09-10',days:10,open:false,part:'햄스트링'},{from:'2026-03-01',to:'2026-03-04',days:4,open:false,part:'발목'}],
    b:[{from:'2026-09-20',to:'2026-09-25',days:6,open:false,part:'햄스트링'}],c:[{from:'2026-10-01',to:'2026-10-05',days:5,open:true,part:''}]};
  const c=vm.createContext({esc:s=>String(s),stEpisodes:p=>eps[p.id]||[],String,Math,Object});
  vm.runInContext(block('function avInjurySummaryHTML(','function renderAvailPlayers('),c);
  const h=c.avInjurySummaryHTML([{id:'a'},{id:'b'},{id:'c'}],'2026-09-01','2026-10-05');
  assert.match(h,/<b>햄스트링<\/b><span>2건<\/span><small>평균 복귀 8일<\/small>/);
  assert.match(h,/<b>부위 미정<\/b><span>1건<\/span><small>진행 중 1<\/small>/);
  assert.doesNotMatch(h,/발목/,'기간 밖 부상은 세지 않는다');
});
test('새 부상은 모든 입구에서 부상 기록 시트를 연다, 선수별 누적에는 시즌이 있다',()=>{
  assert.match(scout,/if\(to==="injury"&&!ST_SPAN\[prev\]\)setTimeout\(function\(\)\{ try\{ stInjurySheet\(pl\); \}/);
  assert.match(scout,/if\(k==="injury"&&!ST_SPAN\[_pv\]\)try\{stInjurySheet\(pl\);\}/);
  assert.match(scout,/if\(isToday&&selected==='injury'&&!wasSpan\)setTimeout\(function\(\)\{try\{var fresh=/);
  assert.match(scout,/concat\(availMode==='players'\?\[\['season','시즌'\]\]:\[\]\)/);
  assert.match(scout,/<th scope="col">휴식<\/th><th scope="col">불참<\/th><th scope="col">재활<\/th><th scope="col">부상<\/th><th scope="col">참여율<\/th>/);
});

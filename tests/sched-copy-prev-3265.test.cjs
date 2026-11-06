'use strict';
/* 3.265 — 일정 «지난주 복사»(주간 액션바 boardCopyPrev)는 하루를 통째로 옮긴다: 세션(trainings · 블록 · 메모) · 경기 종류(컵 · 친선) · 조 · 추가 경기 · 미팅.
   예전엔 옛 보드 칸(sched · theme · trains …)과 경기의 시간 · 상대만 옮겨, 복사한 주에 세션이 하나도 없었고(요약 «계획만 N일») 컵 경기가 리그로 바뀌었다
   (코치로 일정을 돌려 보다 찾음). 경기 id(mid) · 리뷰 기록(reviewActions)은 «이 주 복제»(dupWeek)와 같이 옮기지 않는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8');
const fnSrc=name=>{const i=P.indexOf('function '+name+'(');assert.ok(i>=0,name);const j=P.indexOf('\n}\n',i);return P.slice(i,j+3);};
function harness(){
  const prev=[
    {d:'월',n:1,rest:false,trainings:[{slot:'Sa',time:'17:00',grp:['A팀'],note:'월 메모',blocks:[{name:'패스 앤 무브',min:20}],load:{rpe:7}}],board:{sched:'훈련',theme:'공격'},groupKinds:{'A팀':'훈련'}},
    {d:'화',n:2,rest:true,trainings:[]},
    {d:'수',n:3,rest:false,trainings:[],match:{time:'14:00',opp:'컵 상대',kind:'cup',grp:['A팀']},mid:'m-old',matchAdd:[{opp:'둘째 상대',time:'16:00',mid:'m-add'}],board:{sched:'경기'},reviewActions:[{k:'done'}]},
    {d:'목',n:4,rest:false,trainings:[{slot:'Sb',time:'10:00',grp:['B팀'],blocks:[]}],meeting:'상대 분석 영상'},
    {d:'금',n:5,rest:true,trainings:[],off:true,board:{sched:'OFF'}},
    {d:'토',n:6,rest:true,trainings:[]},
    {d:'일',n:7,rest:true,trainings:[]}
  ];
  const week=['월','화','수','목','금','토','일'].map((d,i)=>({d,n:i+1,rest:true,trainings:i===1?[{slot:'Sx',time:'19:00',note:'덮일 세션'}]:[]}));
  const c={weeksMap:{0:prev,1:week},wk:1,week,confirms:[],calls:[],toast(m){c.calls.push('toast:'+m);},psConfirm(msg,ok){c.confirms.push(msg);ok();},recomputeMD(){c.calls.push('md');},syncViews(){c.calls.push('sync');},renderMix(){c.calls.push('mix');},JSON};
  vm.createContext(c);
  vm.runInContext(fnSrc('mxStripMid')+'\n'+fnSrc('boardCopyPrev')+'\nthis.run=boardCopyPrev;',c);
  return {c,prev,week};
}
test('지난주 복사는 세션 · 블록 · 메모 · 강도를 그대로 옮긴다',()=>{
  const h=harness();h.c.run();
  const mon=h.c.weeksMap[1][0];
  assert.equal(mon.trainings.length,1);assert.equal(mon.trainings[0].note,'월 메모');assert.equal(mon.trainings[0].blocks[0].name,'패스 앤 무브');assert.equal(mon.trainings[0].load.rpe,7);
  assert.deepEqual(mon.trainings[0].grp,['A팀']);assert.equal(mon.board.sched,'훈련');assert.equal(mon.groupKinds['A팀'],'훈련');assert.equal(mon.rest,false);
  assert.equal(h.c.weeksMap[1][3].trainings[0].time,'10:00');assert.equal(h.c.weeksMap[1][3].meeting,'상대 분석 영상');
  assert.equal(h.c.weeksMap[1][4].off,true);assert.equal(h.c.weeksMap[1][4].board.sched,'OFF');
  assert.match(h.c.confirms[0],/지난주 일정/);assert.deepEqual(h.c.calls,['md','sync','mix']);
});
test('경기는 종류(컵) · 조 · 추가 경기까지 옮기고 경기 id · 리뷰 기록은 옮기지 않는다',()=>{
  const h=harness();h.c.run();
  const wed=h.c.weeksMap[1][2];
  assert.deepEqual(wed.match,{time:'14:00',opp:'컵 상대',kind:'cup',grp:['A팀']});
  assert.equal(wed.mid,undefined,'경기 id 는 문서 안에서 유일해야 한다(2.587)');
  assert.equal(wed.reviewActions,undefined);
  assert.equal(wed.matchAdd.length,1);assert.equal(wed.matchAdd[0].opp,'둘째 상대');assert.equal(wed.matchAdd[0].mid,undefined);
});
test('복사본은 깊은 사본이고 이번 주의 요일 이름 · 번호는 그대로, 덮인 세션은 사라진다',()=>{
  const h=harness();h.c.run();
  const W=h.c.weeksMap[1];
  assert.ok(W!==h.prev);assert.ok(W[0].trainings!==h.prev[0].trainings);
  W[0].trainings[0].note='고침';assert.equal(h.prev[0].trainings[0].note,'월 메모','지난주 원문은 그대로');
  W.forEach((d,i)=>{assert.equal(d.d,'월화수목금토일'[i]);assert.equal(d.n,i+1);});
  assert.equal(W[1].trainings.length,0,'현재 내용 덮어씀');
  assert.ok(h.c.week===W,'같은 week 배열 안에서 바꾼다');
});
test('지난주가 없으면 묻지 않고 알림만',()=>{
  const h=harness();h.c.wk=5;h.c.run();
  assert.equal(h.c.confirms.length,0);assert.deepEqual(h.c.calls,['toast:지난주가 없어요']);
});
test('옛 보드 칸만 옮기던 줄은 남아 있지 않다',()=>{
  const src=fnSrc('boardCopyPrev');
  assert.ok(!src.includes('trainThemes:(pb.trainThemes||[]).slice()'));
  assert.ok(!src.includes("match={time:(p.match&&p.match.time)||'',opp:(p.match&&p.match.opp)||''}"));
});

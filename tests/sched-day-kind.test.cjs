'use strict';
// 하루의 종류는 한 곳에서 읽는다 — storage.js PSSchedule.dayKind · effectiveDay · view('') 와 일정 화면의 감싸개(studio/schedule-day-kind.js).
// 한 팀을 OFF 로 돌린 날에 열리는 세션이 없으면 그 날은 OFF: 종류 칩 · 요약 · 팀 «오늘» · 주간 PDF 가 같은 말을 한다. 저장본은 그대로.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=fs.readFileSync(path.join(__dirname,'../studio/storage.js'),'utf8');
const P=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8');
function fn(name){const i=S.indexOf('  function '+name+'(');assert.ok(i>0,name);let d=0,j=S.indexOf('{',i);for(let k=j;k<S.length;k++){if(S[k]==='{')d++;else if(S[k]==='}'&&--d===0)return S.slice(i,k+1);}throw new Error(name);}
const PS=new Function(['hasMatch','groupKind','groupList','sessionActive','activeSessions','dayKind','effectiveDay','effectiveDoc'].map(fn).join('\n')+'\nreturn {hasMatch,groupKind,groupList,sessionActive,activeSessions,dayKind,effectiveDay,effectiveDoc};')();
const ses=(slot,grp,time)=>Object.assign({slot,time:time||'17:00',blocks:[]},grp?{grp}:{});
const day=o=>Object.assign({d:'화',n:2,trainings:[],board:{sched:'훈련',theme:'',trains:[],trainSlot:[],trainData:[],libs:[],libSlot:[],libData:[]}},o);

test('조별 지정이 없는 날은 예전 그대로 — 같은 객체를 돌려준다',()=>{
  for(const d of [day({}),day({trainings:[ses('a',['A팀'])]}),day({board:{sched:''}}),day({off:true}),day({board:{sched:'OFF'}}),day({match:{opp:'x'},board:{sched:'경기'}})]){
    assert.equal(PS.effectiveDay(d),d);assert.equal(PS.effectiveDay(d,{prune:true}),d);}
  assert.equal(PS.dayKind(day({})),'훈련');assert.equal(PS.dayKind(day({board:{sched:''}})),'');assert.equal(PS.dayKind(day({board:{sched:''},trainings:[ses('a')]})),'훈련');
  assert.equal(PS.dayKind(day({off:true})),'OFF');assert.equal(PS.dayKind(day({match:{opp:'x'}})),'경기');assert.equal(PS.dayKind(null),'');
});
test('사용 점검의 그 날: A팀 세션 + A팀 OFF + 하루는 «훈련» → OFF, 숨은 세션과 그 칩은 사본에서 빠진다',()=>{
  const d=day({groupKinds:{'A팀':'OFF'},trainings:[ses('S1',['A팀'])]});
  d.board.trains=['론도'];d.board.trainSlot=['S1'];d.board.trainData=[{minutes:10}];d.board.libs=['보관함 훈련'];d.board.libSlot=['S1'];d.board.libData=[{libId:'L'}];
  const raw=JSON.stringify(d);
  assert.equal(PS.dayKind(d),'OFF');
  const e=PS.effectiveDay(d);
  assert.notEqual(e,d);assert.equal(e.off,true);assert.equal(e.board.sched,'OFF');assert.deepEqual(e.trainings,[]);assert.deepEqual(e.board.trains,[]);assert.deepEqual(e.board.trainData,[]);assert.deepEqual(e.board.libs,[]);
  assert.equal(JSON.stringify(d),raw,'원본은 그대로');assert.deepEqual(e.groupKinds,{'A팀':'OFF'},'조별 지정은 사본에도 남는다(«A팀 · OFF» 줄)');
});
test('세션을 지운 뒤 OFF: 세션 없음 + A팀 OFF + 빈 «훈련» → OFF(«계획만» 아님)',()=>{
  const d=day({groupKinds:{'A팀':'OFF'}});assert.equal(PS.dayKind(d),'OFF');assert.equal(PS.effectiveDay(d).board.sched,'OFF');
});
test('다른 조가 훈련하는 날은 훈련: 열리는 세션 · 팀 공통 세션 · «훈련»으로 정한 조 · 주인 없는 보드 칩',()=>{
  const both=day({groupKinds:{'A팀':'OFF'},trainings:[ses('S1',['A팀']),ses('S2',['B팀'],'19:00')]});
  both.board.trains=['A 론도','B 게임'];both.board.trainSlot=['S1','S2'];both.board.trainData=[{minutes:10},{minutes:20}];
  assert.equal(PS.dayKind(both),'훈련');assert.equal(PS.effectiveDay(both),both,'일정 화면용은 손대지 않는다(칩을 순번으로 고친다)');
  const v=PS.effectiveDay(both,{prune:true});
  assert.deepEqual(v.trainings.map(t=>t.slot),['S2'],'«오늘»은 열리는 세션만');assert.deepEqual(v.board.trains,['B 게임']);assert.deepEqual(v.board.trainSlot,['S2']);assert.deepEqual(v.board.trainData,[{minutes:20}]);
  assert.equal(v.off,undefined);assert.equal(both.trainings.length,2);assert.equal(both.board.trains.length,2);
  assert.equal(PS.dayKind(day({groupKinds:{'A팀':'OFF'},trainings:[ses('S1',['A팀']),ses('S3')]})),'훈련','팀 공통 세션');
  assert.equal(PS.dayKind(day({groupKinds:{'A팀':'OFF'},trainings:[ses('S1',['A팀','B팀'])]})),'훈련','한 조라도 열리면 세션은 열린다');
  assert.equal(PS.dayKind(day({groupKinds:{'A팀':'OFF','B팀':'훈련'}})),'훈련');
  const chips=day({groupKinds:{'A팀':'OFF'},trainings:[ses('S1',['A팀'])]});chips.board.trains=['하루 단위 훈련'];chips.board.trainSlot=[''];
  assert.equal(PS.dayKind(chips),'훈련');
});
test('경기 · 하루 OFF 가 먼저',()=>{
  assert.equal(PS.dayKind(day({groupKinds:{'A팀':'OFF'},match:{opp:'상대'},board:{sched:'경기'}})),'경기');
  const off=day({groupKinds:{'A팀':'훈련'},off:true,board:{sched:'OFF'}});assert.equal(PS.dayKind(off),'OFF');assert.equal(PS.effectiveDay(off),off,'이미 OFF 인 저장본은 그대로');
  assert.equal(PS.dayKind(day({groupKinds:{'A팀':'이상한 값'}})),'훈련','모르는 값은 지정이 아니다');
});
test('effectiveDoc: 바뀐 주만 새 배열 — 나머지 주 · 날은 같은 객체(읽기 전용 사본을 싸게)',()=>{
  const w0=[day({}),day({groupKinds:{'A팀':'OFF'},trainings:[ses('S1',['A팀'])]})],w1=[day({})],doc={version:1,weeks:{0:w0,1:w1}};
  const out=PS.effectiveDoc(doc);
  assert.notEqual(out,doc);assert.equal(out.weeks[1],w1);assert.equal(out.weeks[0][0],w0[0]);assert.equal(out.weeks[0][1].board.sched,'OFF');assert.equal(doc.weeks[0][1].board.sched,'훈련');
  const plain={weeks:{0:[day({})]}};assert.equal(PS.effectiveDoc(plain),plain);
});
test('storage.js: 전체 보기의 읽기 전용 사본(view) 이 이 규칙을 지나고 PSSchedule 로 내보낸다',()=>{
  assert.match(fn('view'),/viewMemo\.by\[key\]=\(d&&key\)\?readForData\(d,key\):effectiveDoc\(d\);/);
  assert.match(S,/dayKind:dayKind, sessionActive:sessionActive, activeSessions:activeSessions, effectiveDay:effectiveDay,/);
});
test('일정 화면 감싸개: schedViewDay 는 effectiveDay 를 한 번 더 · wksGroupKind 는 지정 없는 조에 읽어 낸 OFF',()=>{
  const mod=require('../studio/schedule-day-kind.js');
  const d=day({groupKinds:{'A팀':'OFF'},trainings:[ses('S1',['A팀'])]}),plain=day({}),realOff=day({groupKinds:{'A팀':'OFF'},off:true});
  const W={PSSchedule:PS,schedViewDay:x=>x,wksGroupKind:(dd,g)=>PS.groupKind(dd,g)};
  assert.equal(mod.mount(W),true);assert.equal(mod.mount(W),false,'두 번 감싸지 않는다');
  assert.equal(W.schedViewDay(d).board.sched,'OFF');assert.equal(W.schedViewDay(plain),plain);
  assert.equal(W.wksGroupKind(d,''),'OFF');assert.equal(W.wksGroupKind(d,'B팀'),'OFF');assert.equal(W.wksGroupKind(d,'A팀'),'OFF');
  assert.equal(W.wksGroupKind(plain,''),'');assert.equal(W.wksGroupKind(realOff,''),'','저장본이 OFF 인 날은 예전 길 그대로');
  const b=day({groupKinds:{'A팀':'OFF','B팀':'훈련'}});assert.equal(W.wksGroupKind(b,'B팀'),'훈련');assert.equal(W.wksGroupKind(b,''),'');
  assert.equal(mod.derivedOff(null,d),false);
});
test('process.html 본문 뒤에 싣고(schedViewDay · wksGroupKind 가 먼저 있어야 감싼다) sw.js CORE 에 있다',()=>{
  const i=P.indexOf('<script src="schedule-day-kind.js"');assert.ok(i>P.indexOf('function schedViewDay(day){')&&i>P.indexOf('function wksGroupKind(day,g){'));
  assert.ok(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8').includes("'/studio/schedule-day-kind.js'"));
  assert.match(fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8'),/day=PSSchedule\.effectiveDay\(day,\{prune:true\}\)/,'«지금까지» 집계도 같은 규칙');
});

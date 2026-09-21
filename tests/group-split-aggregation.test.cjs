'use strict';
/* 2.878 — 조별 집계 분리와 «지금 보기(조)로 본 하루» 단일 규칙.
   실제 소스에서 함수를 잘라 실행한다(다른 회귀 테스트와 같은 방식). 원본 날짜가 바뀌지 않는 것도 함께 본다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'../studio',f),'utf8');
function part(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return s.slice(i,j);}
const P=read('process.html'),S=read('storage.js');
const plain=x=>JSON.parse(JSON.stringify(x));
function schedule(){const c=vm.createContext({});vm.runInContext(part(S,'  function hasMatch(','  var seq=0;')+part(S,'  function groupKind(','  window.PSSchedule='),c);return c;}
function page(extra={}){
  const s=schedule(),local=new Map();
  const c=vm.createContext({PSSchedule:{groupKind:s.groupKind,groupList:s.groupList,groupDay:s.groupDay},__schedGrp:'',week:[],
    localStorage:{getItem:k=>local.has(k)?local.get(k):null,setItem:(k,v)=>local.set(k,String(v))},
    schedGroups:()=>['A팀','B팀'],mxExtraList:d=>(d&&Array.isArray(d.matchAdd))?d.matchAdd.filter(x=>x&&typeof x==='object'):[],
    wkbdEsc:x=>String(x==null?'':x),...extra});
  c.window=c;
  vm.runInContext(part(P,'function schedDayGrp(','function wksSetGroupKind(')
    +part(P,'function schedGrpWithCommon(','/* 하루의 조를 정한다')
    +part(P,'function daySessionCount(','/* 2.146 — 띠 그리기 한 곳'),c);
  c.local=local;return c;
}

test('no override: a group sees its own and common sessions, never another group\'s',()=>{
  const s=schedule(),day={board:{sched:'훈련',theme:'공격',trains:['A 칩']},trainings:[{grp:'A팀',aims:'a'},{grp:['B팀'],aims:'b'},{aims:'공통'}]},raw=JSON.stringify(day);
  assert.deepEqual(plain(s.groupDay(day,'B팀').trainings.map(t=>t.aims)),['b','공통']);
  assert.deepEqual(plain(s.groupDay(day,'B팀',{common:false}).trainings.map(t=>t.aims)),['b']);
  assert.deepEqual(plain(s.groupDay(day,'C팀',{common:false}).trainings),[]);
  assert.equal(JSON.stringify(day),raw,'원본은 바뀌지 않는다');
});
test('board chips left by another group\'s sessions are not counted as this group\'s training',()=>{
  const s=schedule(),day={board:{sched:'훈련',theme:'공격',trains:['A 칩'],trainData:[{}]},trainings:[{grp:'A팀'}]};
  const b=s.groupDay(day,'B팀');
  assert.equal(b.trainings.length,0);assert.deepEqual(plain(b.board.trains),[]);assert.equal(b.board.sched,'');assert.equal(b.board.theme,'');
  assert.equal(s.groupDay(day,'A팀').board.trains.length,1);
});
test('the day group owns untagged sessions and day-level board content',()=>{
  const s=schedule(),day={grp:'A팀',board:{sched:'훈련',theme:'수비',trains:['칩']},trainings:[{aims:'꼬리표 없음'}]};
  assert.equal(s.groupDay(day,'A팀').trainings.length,1);
  const b=s.groupDay(day,'B팀');assert.equal(b.trainings.length,0);assert.equal(b.board.theme,'');
  const legacy={grp:'A팀',board:{sched:'훈련',theme:'수비',trains:['칩']}};
  assert.equal(s.groupDay(legacy,'A팀').board.trains.length,1);assert.equal(s.groupDay(legacy,'B팀').board.trains.length,0);
});
test('matches follow their group tag; common matches stay; the next own match is promoted only in the copy',()=>{
  const s=schedule();
  const day={mid:'m1',md:'MD',board:{sched:'경기',opp:'A상대'},match:{opp:'A상대',grp:'A팀'},matchAdd:[{opp:'B상대',grp:'B팀',mid:'m2'},{opp:'공통상대',grp:''}]},raw=JSON.stringify(day);
  const a=s.groupDay(day,'A팀');assert.equal(a.match.opp,'A상대');assert.deepEqual(plain(a.matchAdd.map(x=>x.opp)),['공통상대']);assert.equal(a.mid,'m1');
  const b=s.groupDay(day,'B팀');assert.equal(b.match.opp,'B상대');assert.equal(b.mid,'m2');assert.equal(b.board.opp,'B상대');assert.deepEqual(plain(b.matchAdd.map(x=>x.opp)),['공통상대']);
  const only={md:'MD',mid:'m1',board:{sched:'경기',opp:'A상대'},match:{opp:'A상대',grp:'A팀'}};
  const none=s.groupDay(only,'B팀');assert.equal(none.match,undefined);assert.equal(none.mid,undefined);assert.equal(none.board.sched,'');assert.equal(s.hasMatch(none),false);
  const common={board:{sched:'경기'},match:{opp:'모두'}};assert.equal(s.groupDay(common,'B팀').match.opp,'모두');
  assert.equal(JSON.stringify(day),raw,'원본은 바뀌지 않는다');
});
test('month cells judge the cell\'s own date, not the same weekday of the selected week',()=>{
  const c=page();c.__schedGrp='B팀';
  c.week=[{board:{sched:'훈련'},groupKinds:{'B팀':'OFF'},trainings:[{grp:'B팀'}]}];
  assert.equal(c.schedGrpDaySes({board:{sched:'훈련'},trainings:[{grp:'B팀'}]},0),1,'다른 주의 B팀 훈련은 이번 주 OFF 와 무관하다');
  c.week=[{board:{sched:'훈련'},trainings:[]}];
  assert.equal(c.schedGrpDaySes({board:{sched:'훈련'},groupKinds:{'B팀':'OFF'},trainings:[{grp:'B팀'}]},0),0,'다른 주에 지정한 B팀 OFF 가 적용된다');
  c.week=[{grp:'A팀'}];
  assert.equal(c.schedGrpDaySes({trainings:[{grp:'B팀'}]},0),1);
  assert.equal(c.schedGrpDaySes({grp:'B팀',board:{sched:'훈련',trains:['칩']}},0),1,'세션 객체가 없어도 하루의 조가 이 조이면 보인다');
  assert.equal(c.schedGrpDaySes({grp:'A팀',board:{sched:'훈련',trains:['칩']}},0),0);
});
test('view day mirrors the override both ways and leaves the whole-team view untouched',()=>{
  const c=page(),offB={off:true,board:{sched:'OFF'},groupKinds:{'B팀':'훈련'},trainings:[{grp:'B팀'}]};
  assert.equal(c.schedViewDay(offB),offB,'전체 보기는 원본 그대로');
  c.__schedGrp='B팀';const v=c.schedViewDay(offB);assert.equal(v.off,false);assert.equal(v.board.sched,'훈련');assert.notEqual(v,offB);
  c.__schedGrp='A팀';assert.equal(c.schedViewDay(offB).board.sched,'OFF');
});
const WEEK=()=>[
  {board:{sched:'훈련'},trainings:[{grp:'A팀'},{grp:'B팀'},{}]},
  {board:{sched:'훈련'},trainings:[{grp:'A팀'},{}],groupKinds:{'B팀':'OFF'}},
  {board:{sched:'훈련'},trainings:[{grp:'A팀'},{grp:'B팀'}]},
  {board:{sched:'경기'},match:{opp:'x',grp:'A팀'},matchAdd:[{opp:'y',grp:'B팀'}]},
  {off:true,board:{sched:'OFF'}},
];
test('whole-team summary keeps unique totals and adds a per-group split with the common share',()=>{
  const c=page(),week=WEEK(),raw=JSON.stringify(week),o=plain(c.weekSummaryCount(week));
  assert.equal(o.ses,7);assert.equal(o.match,2);assert.equal(o.off,1);
  assert.deepEqual(o.groups,[{g:'A팀',ses:5,common:2,day:3,match:1,off:1},{g:'B팀',ses:3,common:1,day:2,match:1,off:2}]);
  assert.match(c.sumGroupHTML(c.weekSummaryCount(week)),/A팀<\/b><span>훈련 5 <small>\(공통 2 포함\)/);
  assert.equal(JSON.stringify(week),raw,'집계는 원본을 바꾸지 않는다');
});
test('group view counts what is shown and always states the common share',()=>{
  const c=page(),week=WEEK();c.__schedGrp='B팀';
  c.local.set('ps_sched_grp_common','1');let o=c.weekSummaryCount(week);
  assert.equal(o.ses,3);assert.equal(o.common,1);assert.equal(o.commonHidden,0);assert.equal(o.match,1);assert.equal(o.off,2);
  assert.match(c.sumGroupHTML(o),/훈련 3 <small>\(팀 공통 1 포함\)/);
  c.local.set('ps_sched_grp_common','0');o=c.weekSummaryCount(week);
  assert.equal(o.ses,2);assert.equal(o.common,0);assert.equal(o.commonHidden,1);
  assert.match(c.sumGroupHTML(o),/팀 공통 1개는 숨김/);
});
test('a schedule without any group data draws no per-group line',()=>{
  const c=page(),o=c.weekSummaryCount([{board:{sched:'훈련'},trainings:[{},{}]},{off:true,board:{sched:'OFF'}}]);
  assert.equal(o.ses,2);assert.deepEqual(plain(o.groups),[]);assert.equal(c.sumGroupHTML(o),'');
});
test('topic mix counts the same sessions as the summary',()=>{
  const c=page({wksTopicOpts:()=>[{name:'공격',v:'m:ao'}],wksTopicsOf:t=>t.topics||[],wksTopicName:v=>String(v),bColor:()=>'',dayBoard:d=>d.board||{}});
  vm.runInContext(part(P,'function daysTopicCount(','/* 2.310 — 시각화 손질'),c);
  const days=[{board:{sched:'훈련'},groupKinds:{'B팀':'OFF'},trainings:[{grp:'A팀',topics:['m:ao']},{grp:'B팀',topics:['m:ao']}]}];
  assert.equal(c.daysTopicCount(days).b['공격'],1,'전체 보기: OFF 인 B팀 세션은 빠진다');
  c.__schedGrp='B팀';assert.equal(c.daysTopicCount(days).b['공격'],0);
  c.__schedGrp='A팀';assert.equal(c.daysTopicCount(days).b['공격'],1);
});
test('month, year, day and print views all read the day through the single view function',()=>{
  for(const [name,needle] of [
    ['buildMonthGrid','const rawDay=wkArr[col]; const day=schedViewDay(rawDay);'],
    ['renderYear','var day=schedViewDay(W&&W[col]);'],
    ['activityStatsForDates','day=schedViewDay(W&&W[col]), kind=yearDayKind(day)'],
    ['renderDay','const day=schedViewDay(rawDay);'],
    ['scheduleDocHTML','week.map(schedViewDay)'],
    ['dayDocHTML','schedViewDay(week[dayIdx])'],
    ['monthDocHTML','const day=schedViewDay(wkArr[col]||{});'],
  ]){const a=P.indexOf('function '+name+'('),b=P.indexOf('\nfunction ',a+10);assert.ok(a>=0&&b>a,name);assert.ok(P.slice(a,b).includes(needle),name+' must use schedViewDay');}
  const wb=P.indexOf('function weekBoardDocHTML(');assert.ok(P.slice(wb,wb+1200).includes('const VW=week.map(schedViewDay);'));
});
test('a group OFF day never offers the common OFF release in the day view',()=>{
  const a=P.indexOf('function renderDay('),b=P.indexOf('\nfunction ',a+10),src=P.slice(a,b);
  assert.match(src,/grpKind==='OFF'\s*\?`<div class="restoff" onclick="wksGroupDays\(/);
});

test('daily group controls preserve hidden matches and use the original extra-match index',()=>{
 const nodes={dayLabel:{},dayView:{}},day={d:'월',board:{sched:'경기'},match:{grp:'A팀',opp:'A상대'},matchAdd:[{grp:'C팀',opp:'C상대'},{grp:'B팀',opp:'B상대',time:'17:00'}]};
 const c=page({document:{getElementById:id=>nodes[id]},week:[day],dayIdx:0,wk:0,dateOf:()=>new Date(2026,8,21),dayBoard:d=>d.board||{},bColor:()=>'',mxExtraHtml:()=>'',BOARD_PH:{}});c.__schedGrp='B팀';
 vm.runInContext(part(P,'function renderDay(){','/* ---------- 세션 주제'),c);c.renderDay();
 const html=nodes.dayView.innerHTML;assert.match(html,/B상대/);assert.doesNotMatch(html,/openMatch\(0\)/);assert.match(html,/wkbdGoMatchX\('2026-09-21',0,1\)/);
 assert.match(html,/onclick="wksGroupDays\(0\)"/);assert.doesNotMatch(html,/wkbdPick\(0,'sched'\)/);assert.equal(day.match.opp,'A상대');assert.equal(day.matchAdd.length,2);
});

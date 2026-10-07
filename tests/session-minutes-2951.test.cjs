'use strict';
/* 2.951 — 같은 주를 화면마다 다른 숫자로 말하던 것(코치 점검 10/7).
   «오늘 › 지금까지»는 공-수 전환 85분·수-공 전환 85분, «플레이북»은 0분, 같은 줄의 «시즌 · 일»은 수-공 전환 0일.
   원인: 분 셈이 셋(일정 psSesMin · 콕핏 블록/첫 세션 몰기 · 플레이북 블록만), 시즌 국면은 세션의 첫 주제 하나만.
   → storage.js PSSchedule.sesMin/sesMoments 한 곳. 실제 소스에서 구간을 잘라 실행한다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'../studio',f),'utf8');
function part(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return s.slice(i,j);}
const S=read('storage.js'),P=read('process.html'),SC=read('scout.html'),I=read('idp.html'),PB=read('playbook.html');
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function thisMonday(){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d;}
function scheduleApi(local){
  const i=S.indexOf("var SCHED_KEY='process_coach_v1'"),start=S.lastIndexOf('(function(){',i);
  const endMark="try{ normalize(); }catch(e){ note('schedule-normalize',e); }\n})();",end=S.indexOf(endMark,i)+endMark.length;
  const c=vm.createContext({JSON,Date,Math,Object,Array,String,Number,parseInt,isNaN,isFinite,
    localStorage:{getItem:k=>local.has(k)?local.get(k):null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)}});
  c.window=c;vm.runInContext(S.slice(start,end),c);
  return c;
}
/* 월요일: 세션 둘(S1 오후 · S2 저녁) — 보드 칩은 슬롯으로 세션에 묶인다(2.310) */
function day(){
  return {trainings:[{slot:'S1',topics:['m:dt','m:at'],gmMoment:'dt'},{slot:'S2',topics:[],gmPhases:['p_set']}],
    board:{sched:'훈련',
      warms:['웜업'],warmSlot:['S1'],warmsData:[{minutes:10}],
      trains:['6v6+4','론도','패턴'],trainSlot:['S1','S1','S2'],trainData:[{minutes:20,sets:3},{minutes:5},{minutes:15}],
      meets:[],libs:[]}};
}

test('sesMin counts the chips of that session slot (minutes × sets); old blocks still win',()=>{
  const c=scheduleApi(new Map());const P2=c.PSSchedule,d=day();
  assert.equal(P2.sesMin(d,d.trainings[0]),10+60+5,'S1 = 웜업 10 + 20×3 + 5');
  assert.equal(P2.sesMin(d,d.trainings[1]),15,'S2 는 제 칩만 — 예전 콕핏은 보드 칩 전부를 첫 세션에 몰았다');
  assert.equal(P2.sesMin(d,{slot:'S1',blocks:[{dur:30},{minutes:12}]}),42,'옛 블록 저장본은 블록이 주인');
  assert.equal(P2.sesMin({},{slot:'S1'}),0);
});

test('sesMoments takes every topic moment, then gmMoment, then sub-phase moments',()=>{
  const c=scheduleApi(new Map());const P2=c.PSSchedule;
  assert.deepEqual(Array.from(P2.sesMoments({topics:['m:dt','m:at','t:IDP'],gmMoment:'dt'},null)),['dt','at']);
  assert.deepEqual(Array.from(P2.sesMoments({topics:[],gmMoment:'ao'},null)),['ao']);
  assert.deepEqual(Array.from(P2.sesMoments({gmPhases:['p_set','p_x']},{p_set:'set'})),['set']);
});

test('season counts every topic moment once per day — the row cannot say «85분 this week, 0일 this season»',()=>{
  const mon=thisMonday(),todayIdx=(new Date().getDay()+6)%7;
  const wk=[0,1,2,3,4,5,6].map(()=>({trainings:[],board:{}}));
  wk[0]=day();
  const local=new Map([['process_coach_v1',JSON.stringify({anchorMonday:ymd(mon),weeks:{0:wk}})],
    ['cs_gamemodel_v1',JSON.stringify({moments:[{key:'dt',name:'공격 → 수비 전환',phases:[]},{key:'at',name:'수비 → 공격 전환',phases:[]},{key:'set',name:'세트피스',phases:[{id:'p_set',name:'코너'}]}]})]]);
  const c=scheduleApi(local);
  c.PSSchedule.hasMatch=()=>false;
  vm.runInContext(part(SC,'function ckSeasonStats(){','function tgeTrainCount(')+';this.ckSeasonStats=ckSeasonStats;',c);
  const st=c.ckSeasonStats();
  assert.equal(st.byMoment.dt,1,'공-수 전환 하루');
  assert.equal(st.byMoment.at,1,'수-공 전환도 하루 — 옛 코드는 첫 주제(gmMoment)만 셌다');
  assert.equal(st.byMoment.set,1,'세부 국면만 고른 둘째 세션도 그 국면의 하루');
  assert.equal(st.tagged,1);
  assert.equal(st.train,1);
  assert.ok(/^(\d{4}\.)?\d{1,2}\/\d{1,2}$/.test(st.since),'머리는 주 수 대신 «언제부터»: '+st.since);
  void todayIdx;
});

test('cockpit week, playbook week and the schedule all ask PSSchedule for minutes and moments',()=>{
  const ck=part(SC,'function ckWeekPhase(wk){','function ckWeekPhasePanel(');
  assert.ok(/PSS\.sesMin\(day,tr\)/.test(ck)&&/PSS\.sesMoments\(tr,pm\)/.test(ck),'콕핏 «이번 주 · 분»');
  const pb=part(PB,'function readWeek(){','/* ── 보관함 드릴');
  assert.ok(/PS\.sesMin\(day,tr\)/.test(pb)&&/PS\.sesMoments\(tr,pmap\)/.test(pb),'플레이북 «이번 주»');
  assert.ok(!/var mins=minsOf\(tr\.blocks\); if\(!mins\)return;/.test(pb),'블록만 세던 옛 줄이 없다');
  const ps=part(P,'function psSesMin(day,tr){','function trOwnerDay(');
  assert.ok(/PSSchedule\.sesMin\(day,\{slot:tr&&tr\.slot\},b\)/.test(ps),'일정 머리의 «총 n분»도 같은 함수');
  assert.ok(/\(_st\.since\?\("올 시즌 · "\+_st\.since\+"부터"\)/.test(SC),'«올 시즌 · 43주» 대신 시작일');
});

test('IDP head counts linked accounts like the roster; month view marks planned-only days',()=>{
  assert.ok(/var accLinkedN=rws\.filter\(function\(r\)\{ return r\.d2\|\|sqDocState\(/.test(I));
  assert.equal((I.match(/· 계정 연결 '\+accLinkedN\+' \/ 전체 '/g)||[]).length,2);
  assert.ok(!/<u>· 연결 '\+linked\.length\+' \/ 전체 '/.test(I),'IDP 문서 수를 «연결»이라 부르던 줄이 없다');
  const sum=part(P,'function weekSummaryCount(days){','/* 2.878 — 요약 띠 아래의 조별 줄');
  assert.ok(/else if\(bd\.sched==='훈련'&&!\(day\.match\|\|bd\.sched==='경기'\)&&!day\.off\)o\.plan=\(o\.plan\|\|0\)\+1;/.test(sum));
  assert.equal((P.match(/c\.plan\?\('계획만 '\+c\.plan\+'일'\):''/g)||[]).length,2,'요약 띠 두 곳');
  assert.ok(/class="mtxt mtrain plan"/.test(P)&&/\.mcell \.mkind\.k-train\.plan\{/.test(P));
});

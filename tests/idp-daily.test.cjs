'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../studio/idp.html'),'utf8');
const evidence=require('../studio/idp-evidence.js');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const code=section('  function visionCore(', '  /* 시간은 자유 입력')+
  section('  function ymd(', '  function plannedOn(')+
  section('  function setLog(', '  function setType(')+
  section('  function idpDailyAction(', '  /* ══ 2.618 · 선수 — 주 마무리 카드');
const day=new Date(2026,8,12),key='2026-09-12';
function harness(patch={}){
  const state={readonly:false,saves:0,fc:null};
  const doc={v:1,log:{},vision:{statement:'동료를 살리는 선수',revision:'v-old',focusId:'scan',behaviors:[{id:'scan',text:'공 받기 전에 두 번 확인한다'},{id:'cover',text:'동료 뒤 공간을 커버한다'}]},...patch};
  const c=vm.createContext({doc,console,Date,JSON,PSIDPEvidence:evidence,DAYS:['월','화','수','목','금','토','일'],
    ro:()=>state.readonly,save:()=>state.saves++,focusOf:()=>state.fc,focusSet(){throw Error('unexpected automatic focus');},
    dlog:d=>doc.log[c.ymd(d)]||{},dayAtt:lg=>lg.t==='rest'||lg.t==='injury'?'off':'in',
    propsAll:()=>({}),viewing:'fixture',reactOf:()=>null,olRecentReact:()=>null,
    esc:x=>evidence.esc(String(x??''))});
  c.window=c;vm.runInContext(code,c);return {c,state,doc};
}
function json(x){return JSON.parse(JSON.stringify(x));}
test('direction alone supplies the daily action without writing weekly or quarterly goals',()=>{
  const {c,doc,state}=harness(),before=JSON.stringify(doc);assert.equal(c.idpDailyAction(day).text,'공 받기 전에 두 번 확인한다');assert.equal(state.saves,0);assert.equal(JSON.stringify(doc),before);
});
test('explicit weekly focus keeps priority over quarterly and direction actions',()=>{
  const {c,state}=harness({qgoal:{goals:[{t:'다른 12주 문장'}]}});state.fc={text:'이번 주 문장'};
  const a=c.idpDailyAction(day);assert.equal(a.text,'이번 주 문장');assert.equal(a.weekly,true);assert.equal(a.behavior,null);
});
test('existing quarterly action keeps its meaning when weekly focus is absent',()=>{
  const {c}=harness({qgoal:{goals:[{t:'기존 12주 문장'}]}});assert.equal(c.idpDailyAction(day).text,'기존 12주 문장');assert.equal(c.idpDailyAction(day).behavior,null);
});
test('a matching weekly sentence links its exact direction behavior',()=>{
  const {c,state}=harness();state.fc={text:'동료 뒤 공간을 커버한다'};assert.equal(c.idpDailyAction(day).behavior.id,'cover');
});
test('one positive try records both the answer and an immutable behavior snapshot',()=>{
  const {c,doc,state}=harness();assert.equal(c.idpRecordTry(day,1),true);
  assert.deepEqual(json(doc.log[key]),{try:1,visionEvidence:{id:'scan',text:'공 받기 전에 두 번 확인한다',revision:'v-old'}});assert.equal(state.saves,1);
});
test('the snapshot survives later direction text, focus, and revision changes',()=>{
  const {c,doc}=harness();c.idpRecordTry(day,1);doc.vision.behaviors[0].text='바뀐 문장';doc.vision.revision='v-new';doc.vision.focusId='cover';
  c.idpRecordTry(day,2);assert.equal(doc.log[key].visionEvidence.text,'공 받기 전에 두 번 확인한다');assert.equal(doc.log[key].visionEvidence.revision,'v-old');
});
test('a different weekly action does not manufacture direction evidence',()=>{
  const {c,state,doc}=harness();state.fc={text:'일대일 수비'};c.idpRecordTry(day,2);assert.deepEqual(json(doc.log[key]),{try:2});
});
test('an untried answer does not claim that a behavior scene happened',()=>{
  const {c,doc}=harness();c.idpRecordTry(day,0);assert.deepEqual(json(doc.log[key]),{try:0});
});
test('toggling a try off retains the independent scene evidence and memo',()=>{
  const {c,doc}=harness();c.idpRecordTry(day,1);doc.log[key].memo='앞을 볼 수 있었다';c.idpRecordTry(day,1);
  assert.equal(doc.log[key].try,undefined);assert.ok(doc.log[key].visionEvidence);assert.equal(doc.log[key].memo,'앞을 볼 수 있었다');
});
for(const entry of [{visionEvidence:{id:'past',text:'예전 행동',revision:'before'}},{visionBehaviorId:'legacy'}, {visionEvidence:{unexpected:'keep'}}]){
  test('existing independent or legacy evidence is preserved: '+JSON.stringify(entry),()=>{
    const {c,doc}=harness();doc.log[key]={...entry,memo:'기존 한 줄',body:3,sleepq:4,rpe:6,t:'team',custom:'keep'};
    const before=JSON.stringify(entry);c.idpRecordTry(day,1);assert.equal(JSON.stringify(Object.fromEntries(Object.keys(entry).map(k=>[k,doc.log[key][k]]))),before);
    assert.equal(doc.log[key].memo,'기존 한 줄');assert.equal(doc.log[key].custom,'keep');assert.equal(doc.log[key].rpe,6);
  });
}
for(const value of [-1,3,'1',NaN])test('invalid try never writes '+String(value),()=>{
  const {c,state,doc}=harness();assert.equal(c.idpRecordTry(day,value),false);assert.equal(state.saves,0);assert.deepEqual(doc.log,{});
});
for(const type of ['rest','injury'])test(type+' does not ask for or record an action try',()=>{
  const {c,state,doc}=harness();doc.log[key]={t:type};assert.equal(c.idpRecordTry(day,1),false);assert.equal(state.saves,0);
  const html=c.rOneLine(doc.log[key]);assert.doesNotMatch(html,/data-td-try/);assert.match(html,/dayMemo/);
});
test('coach reading another player cannot record a try',()=>{const {c,state}=harness();state.readonly=true;assert.equal(c.idpRecordTry(day,1),false);assert.equal(state.saves,0);});
test('missing direction and goals still provide one optional daily memo',()=>{
  const {c,doc}=harness({vision:undefined});const html=c.rOneLine({});assert.equal((html.match(/id="dayMemo"/g)||[]).length,1);assert.doesNotMatch(html,/data-td-try/);assert.equal(c.idpRecordTry(day,1),false);assert.deepEqual(doc.log,{});
});
test('fresh direction has one question and one memo; optional extra behavior selection is collapsed',()=>{
  const {c,state,doc}=harness();const before=JSON.stringify(doc),html=c.rOneLine({});
  assert.equal((html.match(/오늘 이 행동을 해봤어/g)||[]).length,1);assert.equal((html.match(/data-td-try=/g)||[]).length,3);
  assert.equal((html.match(/id="dayMemo"/g)||[]).length,1);assert.match(html,/<details class="idp-day-direction">/);assert.doesNotMatch(html,/오늘 내 방향에 가까워진 장면/);
  assert.equal(state.saves,0);assert.equal(JSON.stringify(doc),before);
});
test('stored behavior stays visible after the entire direction was removed',()=>{
  const {c}=harness({vision:undefined});const html=c.rVisionDaily({visionEvidence:{id:'past',text:'그날의 행동',revision:'gone'}});
  assert.match(html,/그날의 행동/);assert.match(html,/data-vd-clear/);
});
test('same id with a new revision and wording does not select the new behavior as old evidence',()=>{
  const {c}=harness();const html=c.rVisionDaily({visionEvidence:{id:'scan',text:'수정 전 행동',revision:'before'}});
  assert.match(html,/수정 전 행동/);assert.doesNotMatch(html,/class="on" data-vd-b="scan"/);
});
test('legacy id-only evidence remains current-reference text, even when it matches the daily question',()=>{
  const {c}=harness();const html=c.rVisionDaily({visionBehaviorId:'scan'},'공 받기 전에 두 번 확인한다');
  assert.match(html,/현재 문구 참고/);assert.match(html,/당시 문구는 저장되지 않아/);
  assert.doesNotMatch(html,/이 행동을 오늘 기록에 연결했어요/);assert.doesNotMatch(html,/class="on" data-vd-b="scan"/);
});
test('unresolved legacy connection remains visible and can be explicitly cleared',()=>{
  const {c}=harness({vision:undefined});const html=c.rVisionDaily({visionBehaviorId:'missing'});
  assert.match(html,/현재 행동에서도 찾을 수 없어요/);assert.match(html,/data-vd-clear/);
});
test('direction, daily action, and memo are escaped in rendered HTML',()=>{
  const {c,doc}=harness();doc.vision.statement='<img src=x onerror=1>';doc.vision.behaviors[0].text='<svg onload=1>';
  const html=c.rOneLine({memo:'</textarea><script>1</script>'});assert.doesNotMatch(html,/<svg onload|<img src=x|<script>1/);assert.match(html,/&lt;svg/);
});

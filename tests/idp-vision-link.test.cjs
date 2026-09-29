'use strict';
// 2.906 — 내 방향 행동을 12주 목표·주간 초점·경기 자기리뷰에 잇는 visionLink 스냅샷.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../studio/idp.html'),'utf8');
const evidence=require('../studio/idp-evidence.js');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const code=section('  function visionCore(', '  /* 시간은 자유 입력')+
  section('  function ymd(', '  function plannedOn(')+
  section('  function setLog(', '  function setType(')+
  section('  function focusOf(', '  /* 2.032 · 주간 회고')+
  section('  function mtSelf(', '  function mtTodayYmd(')+
  section('  function mtVisionPick(', '  function rMatchDetail(')+
  section('  function idpDailyAction(', '  /* ══ 2.618 · 선수 — 주 마무리 카드');
const day=new Date(2026,8,12),key='2026-09-12',wk='2026-09-07';
const SCAN={id:'scan',text:'공 받기 전에 두 번 확인한다',revision:'v-old'};
function harness(patch={}){
  const state={readonly:false,saves:0};
  const doc={v:1,log:{},vision:{statement:'동료를 살리는 선수',revision:'v-old',focusId:'scan',behaviors:[{id:'scan',text:SCAN.text},{id:'cover',text:'동료 뒤 공간을 커버한다'}]},...patch};
  const c=vm.createContext({doc,console,Date,JSON,PSIDPEvidence:evidence,DAYS:['월','화','수','목','금','토','일'],
    ro:()=>state.readonly,save:()=>state.saves++,focusWk:()=>wk,
    dlog:d=>doc.log[c.ymd(d)]||{},dayAtt:lg=>lg.t==='rest'||lg.t==='injury'?'off':'in',
    propsAll:()=>({}),viewing:'fixture',reactOf:()=>null,olRecentReact:()=>null,
    esc:x=>evidence.esc(String(x??''))});
  c.window=c;vm.runInContext(code,c);return {c,state,doc};
}
const json=x=>JSON.parse(JSON.stringify(x));

test('visionLinkCore keeps only a clean {id,text,revision} snapshot',()=>{
  const {c}=harness();
  assert.equal(c.visionLinkCore(null),null);assert.equal(c.visionLinkCore([]),null);assert.equal(c.visionLinkCore({id:'a',text:'  '}),null);
  assert.deepEqual(json(c.visionLinkCore({id:'a<b>"c',text:'  '+'가'.repeat(90)+' ',revision:'r 1',extra:1})),{id:'abc',text:'가'.repeat(80),revision:'r1'});
  assert.equal(c.visionLinkSame(SCAN,{...SCAN}),true);assert.equal(c.visionLinkSame(SCAN,{...SCAN,revision:'v-new'}),false);
});
test('a linked weekly focus supplies its behavior even when the sentence differs',()=>{
  const {c,doc}=harness();doc.focusByWk={[wk]:{wk,text:'경기당 전진 패스 5회',visionLink:SCAN}};
  const a=c.idpDailyAction(day);assert.equal(a.text,'경기당 전진 패스 5회');assert.equal(a.linked,true);assert.equal(a.behavior.id,'scan');assert.equal(a.revision,'v-old');
});
test('a linked 12-week sentence is used when there is no weekly focus',()=>{
  const {c}=harness({qgoal:{goals:[{t:'왼발 전진 패스',visionLink:{id:'cover',text:'동료 뒤 공간을 커버한다',revision:'v-old'}}]}});
  const a=c.idpDailyAction(day);assert.equal(a.text,'왼발 전진 패스');assert.equal(a.behavior.id,'cover');
});
test('an unlinked weekly focus does not borrow the 12-week sentence link',()=>{
  const {c,doc}=harness({qgoal:{goals:[{t:'왼발 전진 패스',visionLink:SCAN}]}});doc.focusByWk={[wk]:{wk,text:'코치 제안 문장'}};
  const a=c.idpDailyAction(day);assert.equal(a.text,'코치 제안 문장');assert.equal(a.behavior,null);assert.equal(a.linked,undefined);
});
test('a positive try records the link snapshot, keeping its own revision after the direction changes',()=>{
  const {c,doc}=harness();doc.focusByWk={[wk]:{wk,text:'경기당 전진 패스 5회',visionLink:SCAN}};
  doc.vision.revision='v-new';doc.vision.behaviors[0].text='바뀐 문장';
  assert.equal(c.idpRecordTry(day,1),true);assert.deepEqual(json(doc.log[key]),{try:1,visionEvidence:SCAN});
});
test('focusSet stores a link only when one is given and it is valid',()=>{
  const {c,doc,state}=harness();
  c.focusSet(wk,'왼발 전진 패스','me',SCAN);assert.deepEqual(json(doc.focusByWk[wk].visionLink),SCAN);assert.equal(doc.focus,doc.focusByWk[wk]);
  c.focusSet(wk,'다른 문장','pick-a');assert.equal('visionLink' in doc.focusByWk[wk],false);
  c.focusSet(wk,'또 다른 문장','me',{id:'x',text:''});assert.equal('visionLink' in doc.focusByWk[wk],false);assert.equal(state.saves,3);
});
test('match self link changes only its own field and can be removed',()=>{
  const {c,doc,state}=harness({matchSelf:{m1:{good:'잘 된 장면',score:4,future:'keep'}}});
  c.mtSelfLink('m1',SCAN);assert.deepEqual(json(doc.matchSelf.m1.visionLink),SCAN);assert.equal(doc.matchSelf.m1.good,'잘 된 장면');assert.equal(doc.matchSelf.m1.future,'keep');
  c.mtSelfLink('m1',null);assert.equal('visionLink' in doc.matchSelf.m1,false);assert.equal(doc.matchSelf.m1.score,4);assert.equal(state.saves,2);
  state.readonly=true;c.mtSelfLink('m1',SCAN);assert.equal('visionLink' in doc.matchSelf.m1,false);assert.equal(state.saves,2);
});
test('match picker is absent without a direction or a saved link',()=>{
  const {c}=harness({vision:undefined});assert.equal(c.mtVisionPick({}),'');
  assert.match(c.mtVisionPick({visionLink:SCAN}),/당시 연결/);
});
test('match picker marks the current link and keeps an older snapshot visible',()=>{
  const {c,doc}=harness();let html=c.mtVisionPick({visionLink:SCAN});
  assert.equal((html.match(/gl-pick on/g)||[]).length,1);assert.match(html,/data-mt-vlink="scan" aria-pressed="true"/);assert.doesNotMatch(html,/당시 연결/);assert.doesNotMatch(html,/data-mt-vnone hidden/);
  doc.vision.revision='v-new';html=c.mtVisionPick({visionLink:SCAN});
  assert.match(html,/당시 연결/);assert.match(html,/data-mt-vlink="scan" aria-pressed="false"/);
  html=c.mtVisionPick({});assert.match(html,/data-mt-vnone hidden/);assert.equal((html.match(/gl-pick on/g)||[]).length,0);
});
test('the daily card shows the linked behavior badge only when it adds information',()=>{
  const {c,doc}=harness();doc.focusByWk={[wk]:{wk,text:'경기당 전진 패스 5회',visionLink:SCAN}};
  const today=new Date();today.setHours(0,0,0,0);const tk=c.ymd(c.mondayOf(today));doc.focusByWk[tk]=doc.focusByWk[wk];
  assert.match(c.rOneLine({}),/gl-badge[^]*공 받기 전에 두 번 확인한다/);
  doc.focusByWk[tk]={wk:tk,text:SCAN.text,visionLink:SCAN};assert.doesNotMatch(c.rOneLine({}),/gl-badge/);
});

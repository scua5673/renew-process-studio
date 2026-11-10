'use strict';
// «일정 ＋» 시트에서 고른 «팀 공통»이 «훈련»을 누르면 A팀이 되던 것 — studio/schedule-fill-team.js 가 wksFillKind 를 감싼다.
// process.html 의 실제 wksFillKind · wksAddSession · sesDefaults 를 잘라 가짜 화면에서 돌린다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8');
const MOD=fs.readFileSync(path.join(__dirname,'../studio/schedule-fill-team.js'),'utf8');
const api=require('../studio/schedule-fill-team.js');
function cut(a,b){const i=P.indexOf(a),j=P.indexOf(b,i+a.length);assert.ok(i>0&&j>i,a);return P.slice(i,j);}
function setup({wrap=true,view=''}={}){
  const day={d:'수',n:3,trainings:[]},c={week:[day],__schedGrp:view,__schedYears:[],__fillNoSes:true,__fillGroups:['A팀'],__fillDi:0,__fillSlot:'',saves:0,
    schedEditBlocked:()=>false,schedBlockNotice(){},schedGroups:()=>['A팀','B팀'],schedDayGrp:()=>'',schedDefGrp:()=>'A팀',wksCommonTime:()=>'17:00',
    PSTeamAudience:{years:()=>[]},dayBoard:d=>d.board||(d.board={}),wkbdSetPick(di,f,v){c.dayBoard(c.week[di])[f]=v;},wksSetGroupKind(di,g,k){const d=c.week[di];(d.groupKinds=d.groupKinds||{})[g]=k;},
    save(){c.saves++;},syncViews(){},closeSheet(){},wksFillRender(){c.rendered=(c.rendered||0)+1;},
    wksFill(di,key){c.__fillNoSes=false;c.__fillSlot=key;},document:null,console};
  c.window=c;vm.createContext(c);
  vm.runInContext(cut('function _fillTr(){','function _fillList(')+'\n'+cut('window.wksAddSession=function(di,groups,schoolYears){','function ensureSlotSession(')+'\n'+cut('window.wksFillKind=function(kind){','window.wksFillGrp=function(g){')+'\n'+cut('window.wksFillGrp=function(g){','\n/* ')+';',c);
  if(wrap){c.document={};vm.runInContext(MOD,c);}
  return {c,day};
}
test('chosen(): 세션 없이 연 시트의 «훈련»만 — 조를 다 껐으면 null(팀 공통), 골랐으면 그 조, 다른 종류 · 세션 시트는 손대지 않는다',()=>{
  assert.equal(api.chosen(true,'훈련',[]),null);assert.deepEqual(api.chosen(true,'훈련',['B팀']),['B팀']);assert.deepEqual(api.chosen(true,'훈련',['A팀','B팀']),['A팀','B팀']);
  assert.equal(api.chosen(true,'OFF',[]),undefined);assert.equal(api.chosen(false,'훈련',[]),undefined);assert.equal(api.chosen(true,'훈련',['',null]),null);
});
test('고치기 전 코드(감싸지 않음)는 «팀 공통» → «훈련»이 A팀이 된다 — 이 시험이 지키는 결함',()=>{
  const {c,day}=setup({wrap:false});c.wksFillGrp('');assert.deepEqual(Array.from(c.__fillGroups),[]);c.wksFillKind('훈련');
  assert.deepEqual(Array.from(day.trainings[0].grp),['A팀']);
});
test('«팀 공통» → «훈련»: 조 없는 세션 하나 · 하루는 훈련 · 저장',()=>{
  const {c,day}=setup();c.wksFillGrp('');c.wksFillKind('훈련');
  assert.equal(day.trainings.length,1);assert.equal('grp' in day.trainings[0],false);assert.equal(day.board.sched,'훈련');assert.ok(c.saves>=1);assert.ok(c.rendered>=1);
});
test('조 필터(B팀)로 보는 중에도 일부러 고른 «팀 공통»은 팀 공통',()=>{
  const {c,day}=setup({view:'B팀'});c.__fillGroups=['B팀'];c.wksFillGrp('B팀');c.wksFillKind('훈련');assert.equal('grp' in day.trainings[0],false);
});
test('한 팀 · 여러 팀은 고른 그대로',()=>{
  let h=setup();h.c.wksFillKind('훈련');assert.deepEqual(Array.from(h.day.trainings[0].grp),['A팀']);
  h=setup();h.c.wksFillGrp('A팀');h.c.wksFillGrp('B팀');h.c.wksFillKind('훈련');assert.deepEqual(Array.from(h.day.trainings[0].grp),['B팀']);
  h=setup();h.c.wksFillGrp('B팀');h.c.wksFillKind('훈련');assert.deepEqual(Array.from(h.day.trainings[0].grp),['A팀','B팀']);assert.equal(h.day.trainings.length,1);
});
test('OFF · 세션이 이미 있는 시트는 그대로',()=>{
  let h=setup();h.c.wksFillGrp('');h.c.wksFillKind('OFF');assert.equal(h.day.trainings.length,0);assert.equal(h.day.board.sched,'OFF');
  h=setup();h.day.trainings.push({slot:'s1',time:'17:00',grp:['B팀']});h.c.__fillNoSes=false;h.c.__fillSlot='s1';h.c.wksFillKind('훈련');
  assert.equal(h.day.trainings.length,1);assert.deepEqual(Array.from(h.day.trainings[0].grp),['B팀']);
});
test('process.html 본문 뒤에 싣고 sw.js CORE 에 있다',()=>{
  const i=P.indexOf('<script src="schedule-fill-team.js"'),j=P.indexOf('window.wksFillKind=function(');assert.ok(i>j&&j>0);
  assert.ok(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8').includes("'/studio/schedule-fill-team.js'"));
});

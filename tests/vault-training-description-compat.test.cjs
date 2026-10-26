const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const vm=require('vm');

const source=fs.readFileSync('studio/board.html','utf8');
const start=source.indexOf('function _legacyMethodText(d)');
const end=source.indexOf('function _blankTraining',start);
assert.ok(start>=0&&end>start,'training draft helpers not found');

function harness(){
  const c={
    Array,
    Object,
    String,
    sectionsOf(d){return ((d&&d.type)==='setpiece')?[['spDesc','세트피스 설명'],['coaching','주의 · 상대 대응']]:[['method','훈련 방법'],['coaching','코칭 포인트']];}
  };
  vm.createContext(c);
  vm.runInContext(source.slice(start,end),c);
  return c;
}

test('legacy library description opens in the current training method field',()=>{
  const c=harness();
  const d=c._trainDraftFrom({
    type:'train',
    name:'legacy',
    overview:'목적 설명',
    setup:'준비 설명',
    func:'진행 설명',
    prog:'발전 설명',
    coaching:'코칭 A'
  });
  assert.equal(d.method,'목적 설명\n\n준비 설명\n\n진행 설명\n\n발전 설명');
  assert.equal(d.coaching,'코칭 A');
});

test('existing method wins, while setpiece receives a compatible description',()=>{
  const c=harness();
  const train=c._trainDraftFrom({type:'train',method:'현재 방법',overview:'예전 설명'});
  const setpiece=c._trainDraftFrom({type:'setpiece',description:'세트피스 설명',coaching:'상대 대응'});
  assert.equal(train.method,'현재 방법');
  assert.equal(setpiece.spDesc,'세트피스 설명');
  assert.equal(setpiece.coaching,'상대 대응');
});

test('explicit training rosters survive draft conversion without sharing the source object',()=>{
  const c=harness(),sourceRoster={gk:2,field:20,rehab:0,out:0};
  const d=c._trainDraftFrom({roster:sourceRoster});
  assert.equal(d.roster.field,20);
  d.roster.field=18;
  assert.equal(sourceRoster.field,20);
  assert.equal(c._trainDraftFrom({name:'legacy'}).roster,undefined);
});

test('switching individual trainings restores their roster and captures edits separately',()=>{
  const c=harness();
  Object.assign(c,{
    editorTrainings:[{draft:{roster:{gk:2,field:20,rehab:0,out:0}},scenes:[{snap:{}}]},
      {draft:{roster:{gk:0,field:10,rehab:0,out:0}},scenes:[{snap:{}}]},
      {draft:{name:'legacy'},scenes:[{snap:{}}]}],
    currentRoster:{gk:0,field:0,rehab:0,out:0},
    syncEpRosterUI(opts){if(opts.counts)c.currentRoster={...opts.counts};return {...c.currentRoster};},
    loadSnap(){},_trainAnimApply(){},editorCaptureScene(){},_trainAnimCapture(){}
  });
  vm.runInContext(source.slice(source.indexOf('function _activateTraining('),source.indexOf('function switchTraining(')),c);
  c._activateTraining(0);assert.equal(c.currentRoster.gk,2);assert.equal(c.currentRoster.field,20);
  c.currentRoster.field=18;c.captureActiveTraining();
  c._activateTraining(1);assert.equal(c.currentRoster.gk,0);assert.equal(c.currentRoster.field,10);
  c._activateTraining(0);assert.equal(c.currentRoster.field,18);
  c._activateTraining(2);assert.equal(c.currentRoster.field,18);
});

'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const R=require('../studio/review-training.js');
const root=path.join(__dirname,'../studio');
const sync=fs.readFileSync(path.join(root,'sync.js'),'utf8');
const storage=fs.readFileSync(path.join(root,'storage.js'),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`Extract actual ${start}`);return source.slice(a,b);}
function fn(name){return section(sync,`function ${name}(`,'\nfunction ');}
function task(overrides={}){return Object.assign(R.newTask({id:'ra-1',matchId:'match-1',matchDate:'2026-09-05',opponent:'Away',sourceKey:'reviewImprove',action:'압박 뒤 공간을 확인하기',grp:['A'],now:100}),overrides);}
function doc(actions,anchor='2026-09-07'){
  const week=Array.from({length:7},()=>({trainings:[]}));
  if(actions!==undefined)week[2].reviewActions=actions;
  return {anchorMonday:anchor,scheduleRev:1,editedAt:100,weeks:{0:week}};
}
function mergeHarness(){
  const c=vm.createContext({
    PSSchedule:{mondayOf:()=>new Date(2026,8,14)},
    mergeNoteAdd(){},SCHEDULE_KEY:'process_coach_v1',
    syncDiagnostic(){},__schedMidSeq:0,
  });c.window=c;
  vm.runInContext([
    fn('normalizeCoachDocument'),fn('scheduleRevOf'),fn('scheduleTokenNew'),fn('scheduleTokenValid'),
    fn('scheduleNewMid'),fn('scheduleStructureRepair'),fn('scheduleCommitRaw'),fn('deepMerge3'),
    fn('scheduleReviewActionsPrepare'),fn('scheduleReviewActionsFinish'),fn('mergeCoachWeeks'),
  ].join('\n'),c,{filename:'actual schedule normalization and merge functions'});
  return c;
}

test('validDate accepts real calendar dates without accepting rollover or coercion',()=>{
  for(const date of ['2024-02-29','2026-09-12','2000-02-29','0001-01-01'])assert.equal(R.validDate(date),true,date);
  for(const date of ['2026-02-29','2026-04-31','1900-02-29','2026-13-01','2026-00-12','2026-01-00','2026-9-12','2026-09-12T00:00:00Z','0000-01-01',' 2026-09-12',null,123,{}])assert.equal(R.validDate(date),false,String(date));
});

test('sources selects only improvement actions and deduplicates legacy text without mutation',()=>{
  const match={reviewImprove:'  공간 확인  ',reviewGood:'private good',phaseReview:{ao:{improve:'패스 전 보기',good:'private phase',note:'private old note'},do:{improve:'공간\n확인'},bad:[]},trainingAction:'패스 전 보기',privateNote:'secret'};
  const before=copy(match);
  assert.deepEqual(R.sources(match),[{key:'reviewImprove',label:'전체 개선할 점',text:'공간 확인'},{key:'phaseReview:ao',label:'ao',text:'패스 전 보기'}]);
  assert.deepEqual(match,before);
});

test('sources supports a distinct legacy action and ignores malformed fields',()=>{
  assert.deepEqual(R.sources({reviewImprove:[],phaseReview:{ao:{improve:{text:'invalid'}}},trainingAction:' 옛 과제 '}),[{key:'trainingAction',label:'기존 훈련 과제',text:'옛 과제'}]);
  assert.deepEqual(R.sources(null),[]);
});

test('newTask stores only the selected action and canonical groups',()=>{
  const input={id:'ra-new',matchId:'match-1',matchDate:'2026-09-05',opponent:' Away ',sourceKey:'reviewImprove',action:' 한 가지 행동 ',grp:['B','A','B',''],now:100,review:'private raw',observation:'should not be copied',status:'done'};
  const before=copy(input),result=R.newTask(input);
  assert.deepEqual(result,{id:'ra-new',matchId:'match-1',matchDate:'2026-09-05',opponent:'Away',sourceKey:'reviewImprove',action:'한 가지 행동',grp:['A','B'],status:'planned',observation:'',createdAt:100,updatedAt:100});
  assert.deepEqual(input,before);
});

for(const [name,change] of [
  ['empty action',{action:'  '}],['invalid date',{matchDate:'2026-02-30'}],['missing identity',{id:''}],
  ['prototype identity',{id:'__proto__'}],['invalid group',{grp:['A',{}]}],['oversized action',{action:'a'.repeat(2001)}],
  ['invalid timestamp',{now:NaN}],['non-string action',{action:{text:'do this'}}],
])test(`newTask rejects ${name} without creating a partial task`,()=>{
  assert.equal(R.newTask(Object.assign({id:'ra-1',matchId:'match-1',matchDate:'2026-09-05',opponent:'Away',sourceKey:'reviewImprove',action:'내용',grp:[],now:100},change)),null);
});

test('list resolves absolute dates, preserves references, and does not use mutable week indexes as identity',()=>{
  const t=task(),d=doc([t]),before=copy(d);
  assert.deepEqual(R.list(d),[{task:t,date:'2026-09-09',weekKey:'0',dayIndex:2}]);
  assert.equal(R.list(d)[0].task,t);
  assert.equal(R.forMatch(d,'match-1').length,1);
  assert.equal(R.forMatch(d,'other').length,0);
  assert.deepEqual(d,before);
});

test('list safely omits malformed task rows and invalid calendar documents',()=>{
  const good=task(),d=doc([null,{},task({id:'bad-state',status:'completed'}),task({id:'bad-text',action:{text:'x'}}),task({id:'bad-observation',observation:{private:'x'}}),good]);
  assert.deepEqual(R.list(d).map(x=>x.task.id),['ra-1']);
  for(const changed of [{anchorMonday:'2026-09-08'},{anchorMonday:'2026-02-30'},{weeks:[]},{weeks:{'01':d.weeks[0]}},{weeks:{0:[d.weeks[0][2]]}}])assert.deepEqual(R.list(Object.assign({},d,changed)),[]);
});

test('duplicate ids render once using the newest complete row while originals remain intact',()=>{
  const old=task(),newer=task({updatedAt:200,status:'done',observation:'한 장면을 확인함'}),d=doc([old]);
  d.weeks[0][3].reviewActions=[newer];const before=copy(d);
  const rows=R.list(d);assert.equal(rows.length,1);assert.equal(rows[0].date,'2026-09-10');assert.equal(rows[0].task,newer);
  assert.deepEqual(d,before);
});

test('duplicate creation matches match, action and group set, not source label or array order',()=>{
  const existing=task({grp:['A','B']}),day={reviewActions:[existing]};
  assert.equal(R.duplicate(day,{matchId:'match-1',action:' 압박 뒤\n공간을 확인하기 ',grp:['B','A','B']}),existing);
  assert.equal(R.duplicate(day,{matchId:'match-2',action:existing.action,grp:['A','B']}),null);
  assert.equal(R.duplicate(day,{matchId:'match-1',action:existing.action,grp:['A']}),null);
});

test('statusLabel distinguishes performing a task from recording an observation',()=>{
  assert.equal(R.statusLabel(task()),'훈련 예정');
  assert.equal(R.statusLabel(task({status:'done'})),'진행함 · 결과 대기');
  assert.equal(R.statusLabel(task({status:'done',observation:'확인한 장면'})),'결과 남김');
  assert.equal(R.statusLabel(task({status:'skipped',observation:'비로 취소'})),'진행하지 않음');
  assert.equal(R.statusLabel({status:'invalid'}),'');
  assert.equal(R.esc('<b>"내용" & \'메모\'</b>'),'&lt;b&gt;&quot;내용&quot; &amp; &#39;메모&#39;&lt;/b&gt;');
});

test('the same pure module loads as a browser global without CommonJS',()=>{
  const c=vm.createContext({});c.window=c;
  vm.runInContext(fs.readFileSync(path.join(root,'review-training.js'),'utf8'),c);
  assert.equal(c.PSReviewTraining.validDate('2026-09-12'),true);
});

test('actual PSSchedule startup normalization preserves tasks and their calendar dates',()=>{
  const original=doc([task()]),local=new Map([['process_coach_v1',JSON.stringify(original)]]);
  class ClockDate extends Date {constructor(...args){super(...(args.length?args:[new Date(2026,8,14,12).getTime()]));}static now(){return new Date(2026,8,14,12).getTime();}}
  const c=vm.createContext({Date:ClockDate,localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)}});c.window=c;
  vm.runInContext(storage.slice(storage.indexOf('/* PROCESS STUDIO — 일정 기준선')),c,{filename:'actual PSSchedule IIFE'});
  const after=JSON.parse(local.get('process_coach_v1'));
  assert.equal(after.anchorMonday,'2026-09-14');
  assert.deepEqual(after.weeks[-1][2].reviewActions,original.weeks[0][2].reviewActions);
  assert.equal(R.list(after)[0].date,'2026-09-09');
});

test('actual cloud normalization and commit preserve task metadata and calendar placement',()=>{
  const c=mergeHarness(),original=doc([task()]),raw=JSON.stringify(original);
  const normalized=JSON.parse(c.normalizeCoachDocument(raw));
  assert.equal(normalized.anchorMonday,'2026-09-14');
  assert.deepEqual(normalized.weeks[-1][2].reviewActions,original.weeks[0][2].reviewActions);
  const committed=JSON.parse(c.scheduleCommitRaw(JSON.stringify(normalized),raw));
  assert.deepEqual(committed.weeks[-1][2].reviewActions,original.weeks[0][2].reviewActions);
  assert.equal(committed.scheduleRev,2);assert.equal(R.list(committed)[0].date,'2026-09-09');
});

test('actual merge keeps a first task when a newer device changes another field on that day',()=>{
  const c=mergeHarness(),base=doc(),local=copy(base),server=copy(base);
  local.weeks[0][2].reviewActions=[task()];server.weeks[0][2].meeting='새 미팅';server.editedAt=200;
  const before=[base,local,server].map(JSON.stringify);
  const merged=JSON.parse(c.mergeCoachWeeks(...before));
  assert.equal(merged.weeks[-1][2].meeting,'새 미팅');
  assert.deepEqual(merged.weeks[-1][2].reviewActions,[task()]);
  assert.equal(R.list(merged)[0].date,'2026-09-09');
  assert.deepEqual([base,local,server].map(JSON.stringify),before,'Merge uses temporary parsed copies');
  assert.equal(Object.hasOwn(merged.weeks[-1][1],'reviewActions'),false,'Unrelated days gain no empty fields');
});

test('actual id merge preserves independent task additions without merging their content',()=>{
  const c=mergeHarness(),base=doc(),local=copy(base),server=copy(base);
  local.weeks[0][2].reviewActions=[task({id:'ra-a',action:'A 행동'})];
  server.weeks[0][2].reviewActions=[task({id:'ra-b',action:'B 행동'})];server.editedAt=200;
  const merged=JSON.parse(c.mergeCoachWeeks(JSON.stringify(base),JSON.stringify(local),JSON.stringify(server)));
  assert.deepEqual(merged.weeks[-1][2].reviewActions.map(t=>[t.id,t.action]).sort(),[['ra-a','A 행동'],['ra-b','B 행동']]);
});

test('actual merge preserves independent observation and schedule changes for the same task',()=>{
  const c=mergeHarness(),base=doc([task()]),local=copy(base),server=copy(base);
  local.weeks[0][2].reviewActions[0].status='done';local.weeks[0][2].reviewActions[0].observation='두 장면 확인';local.weeks[0][2].reviewActions[0].updatedAt=300;
  server.weeks[0][2].trainings=[{time:'08:00',note:'순서 변경'}];server.editedAt=200;
  const merged=JSON.parse(c.mergeCoachWeeks(JSON.stringify(base),JSON.stringify(local),JSON.stringify(server)));
  assert.equal(merged.weeks[-1][2].reviewActions[0].observation,'두 장면 확인');
  assert.equal(merged.weeks[-1][2].trainings[0].time,'08:00');
});

test('actual merge preserves explicit empty task arrays and does not add fields to old documents',()=>{
  const c=mergeHarness(),base=doc(),local=copy(base),server=copy(base);
  local.weeks[0][2].note='local';server.weeks[0][3].note='server';
  const old=JSON.parse(c.mergeCoachWeeks(JSON.stringify(base),JSON.stringify(local),JSON.stringify(server)));
  assert.equal(JSON.stringify(old).includes('reviewActions'),false);
  local.weeks[0][2].reviewActions=[];
  const empty=JSON.parse(c.mergeCoachWeeks(JSON.stringify(base),JSON.stringify(local),JSON.stringify(server)));
  assert.deepEqual(empty.weeks[-1][2].reviewActions,[]);
});

for(const [name,rows] of [
  ['non-array',{}],['null array',null],['missing id',[{action:'x'}]],
  ['duplicate id',[task(),task({action:'different'})]],['prototype id',[task({id:'__proto__'})]],
])test(`actual merge rejects ${name} instead of falling through to a destructive fallback`,()=>{
  const c=mergeHarness(),base=doc(),local=doc(rows),server=copy(base),raw=JSON.stringify(local);
  assert.throws(()=>c.mergeCoachWeeks(JSON.stringify(base),raw,JSON.stringify(server)),error=>error.psScheduleReviewActions===true&&error.psCode==='sync_storage');
  assert.equal(JSON.stringify(local),raw);
});

test('actual merge rejects a duplicated task identity across dates',()=>{
  const c=mergeHarness(),base=doc(),local=doc([task()]),server=copy(base);
  local.weeks[0][3].reviewActions=[task({observation:'copied'})];
  assert.throws(()=>c.mergeCoachWeeks(JSON.stringify(base),JSON.stringify(local),JSON.stringify(server)),error=>error.psScheduleReviewActions===true);
});

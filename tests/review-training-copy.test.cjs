'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../studio/process.html'), 'utf8');
function fn(name) {
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0, 'Actual function '+name+' exists');
  const firstLineEnd=source.indexOf('\n',start);
  const end=source.slice(start,firstLineEnd).trimEnd().endsWith('}')?firstLineEnd:source.indexOf('\n}',firstLineEnd)+2;
  assert.ok(end>start,'Actual function '+name+' ends');
  return source.slice(start,end);
}
const appCode=['mxStripMid','blankWeek','offsetOfDate','dupWeek','dupMonth','applyTemplate'].map(fn).join('\n');
const copy=v=>JSON.parse(JSON.stringify(v));
function task(id,patch={}) {
  return {id,matchId:'match-'+id,matchDate:'2026-08-20',opponent:'상대',sourceKey:'reviewImprove',action:'커버 위치 확인',grp:['A'],status:'done',observation:'커버가 먼저 도착함',createdAt:1,updatedAt:2,...patch};
}
function harness() {
  const calls={saved:0,synced:0,closed:0};
  const c=vm.createContext({Date,JSON,Math,Object,console,
    wk:0,week:null,weeksMap:{},curSession:null,myTemplates:[],__tplSel:'template-a',monthAnchor:{y:2026,m:8},
    mondayOfWeek0(){return new Date(2026,7,31);},
    monthGridDays(){const out=[];for(let day=1;day<=new Date(c.monthAnchor.y,c.monthAnchor.m+1,0).getDate();day++)out.push(new Date(c.monthAnchor.y,c.monthAnchor.m,day));return out;},
    recomputeMD(){},renderWeek(){},renderMonth(){},renderMonthMix(){},
    save(){calls.saved++;},syncViews(){calls.synced++;},closeSheet(){calls.closed++;},toast(){}
  });
  vm.runInContext(appCode,c);c.weeksMap[0]=c.blankWeek();c.week=c.weeksMap[0];
  function at(date){const n=c.offsetOfDate(new Date(date+'T00:00:00')),w=Math.floor(n/7),di=((n%7)+7)%7;if(!c.weeksMap[w])c.weeksMap[w]=c.blankWeek();return {w,di,day:c.weeksMap[w][di]};}
  function template(){const week=c.blankWeek();week[0].trainings=[{id:'template-session',blocks:[]}];week[0].mid='template-match';week[0].matchAdd=[{mid:'template-extra'}];week[0].reviewActions=[task('template-source')];c.myTemplates=[{id:'template-a',week}];return week;}
  return {c,calls,at,template};
}

test('dupWeek copies ordinary sessions without copying source task IDs or changing their outcomes',()=>{
  const h=harness(),src=h.c.weeksMap[0];src[0].trainings=[{id:'session-a',blocks:[]}];src[0].mid='source-match';src[0].matchAdd=[{mid:'source-extra'}];src[0].reviewActions=[task('source')];
  const before=copy(src);h.c.dupWeek();
  assert.equal(h.c.wk,1);assert.deepEqual(copy(src),before);assert.equal(h.c.weeksMap[1][0].trainings[0].id,'session-a');
  assert.equal(h.c.weeksMap[1][0].reviewActions,undefined);assert.equal(h.c.weeksMap[1][0].mid,undefined);assert.equal(h.c.weeksMap[1][0].matchAdd[0].mid,undefined);assert.equal(h.calls.saved,1);
});

test('dupWeek skips a week whose only content is existing review tasks',()=>{
  const h=harness();h.c.week[0].trainings=[{id:'session-a'}];h.c.weeksMap[1]=h.c.blankWeek();h.c.weeksMap[1][4].reviewActions=[task('target')];
  const target=h.c.weeksMap[1],before=copy(target);h.c.dupWeek();
  assert.equal(h.c.wk,2);assert.equal(h.c.weeksMap[1],target);assert.deepEqual(copy(target),before);assert.equal(h.c.weeksMap[2][0].trainings[0].id,'session-a');
});

test('dupWeek does not duplicate a tasks-only source week',()=>{
  const h=harness();h.c.week[0].reviewActions=[task('source')];const before=copy(h.c.weeksMap);h.c.dupWeek();
  assert.deepEqual(copy(h.c.weeksMap),before);assert.equal(h.calls.saved,0);
});

test('dupWeek leaves all weeks unchanged while a session is being edited',()=>{
  const h=harness();h.c.week[0].trainings=[{id:'session-a'}];h.c.curSession={};const before=copy(h.c.weeksMap);h.c.dupWeek();assert.deepEqual(copy(h.c.weeksMap),before);
});

test('dupMonth copies source sessions but preserves existing destination-date tasks and outcomes',()=>{
  const h=harness(),sourceDay=h.at('2026-09-01').day,target=h.at('2026-10-01');
  sourceDay.trainings=[{id:'source-session'}];sourceDay.mid='source-match';sourceDay.matchAdd=[{mid:'source-extra'}];sourceDay.reviewActions=[task('source')];
  target.day.reviewActions=[task('destination'),task('planned',{status:'planned',observation:''})];const tasks=target.day.reviewActions,sourceBefore=copy(sourceDay),labels={d:target.day.d,n:target.day.n};
  h.c.dupMonth();const result=h.c.weeksMap[target.w][target.di];
  assert.deepEqual(copy(result.reviewActions),copy(tasks));assert.equal(result.reviewActions,tasks);assert.equal(result.trainings[0].id,'source-session');
  assert.equal(result.mid,undefined);assert.equal(result.matchAdd[0].mid,undefined);assert.deepEqual({d:result.d,n:result.n},labels);assert.deepEqual(copy(sourceDay),sourceBefore);assert.equal(h.calls.saved,1);
});

test('dupMonth does not create task copies on an empty destination date',()=>{
  const h=harness(),sourceDay=h.at('2026-09-02').day;sourceDay.trainings=[{id:'source-session'}];sourceDay.reviewActions=[task('source')];
  h.c.dupMonth();assert.equal(h.at('2026-10-02').day.reviewActions,undefined);assert.equal(sourceDay.reviewActions[0].id,'source');
});

test('dupMonth leaves a destination task-only date unchanged when no source schedule is copied there',()=>{
  const h=harness();h.at('2026-09-01').day.trainings=[{id:'session-a'}];const target=h.at('2026-10-02').day;target.reviewActions=[task('untouched')];const before=copy(target);
  h.c.dupMonth();assert.equal(h.at('2026-10-02').day,target);assert.deepEqual(copy(target),before);
});

for(const mode of ['merge','overwrite']) {
  test(`template ${mode} never copies stored source task IDs`,()=>{
    const h=harness(),template=h.template(),before=copy(template);h.c.applyTemplate(mode);
    assert.equal(h.c.weeksMap[0][0].reviewActions,undefined);assert.equal(h.c.weeksMap[0][0].mid,undefined);assert.equal(h.c.weeksMap[0][0].matchAdd[0].mid,undefined);
    assert.equal(h.c.weeksMap[0][0].trainings[0].id,'template-session');assert.deepEqual(copy(template),before);assert.equal(h.calls.synced,1);
  });
}

test('template merge treats a task-only destination date as occupied and preserves the entire day',()=>{
  const h=harness();h.template();const target=h.c.week[0];target.reviewActions=[task('destination')];target.board={theme:'그날 계획'};const before=copy(target);
  h.c.applyTemplate('merge');assert.equal(h.c.week[0],target);assert.deepEqual(copy(target),before);
});

test('template merge fills a truly empty neighboring date without copying template tasks',()=>{
  const h=harness(),template=h.template();h.c.week[1].reviewActions=[task('destination')];const tasks=h.c.week[1].reviewActions;template[1].trainings=[{id:'should-not-replace'}];
  h.c.applyTemplate('merge');assert.equal(h.c.week[0].trainings[0].id,'template-session');assert.equal(h.c.week[1].reviewActions,tasks);assert.equal(h.c.week[1].trainings.length,0);
});

test('template overwrite replaces training content while keeping each destination date task and result',()=>{
  const h=harness(),template=h.template();
  h.c.week[0].trainings=[{id:'old-session'}];h.c.week[0].reviewActions=[task('destination-a')];h.c.week[6].reviewActions=[task('destination-b',{status:'skipped',observation:'우천으로 취소'})];
  const monday=h.c.week[0].reviewActions,sunday=h.c.week[6].reviewActions,templateBefore=copy(template);
  h.c.applyTemplate('overwrite');assert.equal(h.c.week[0].trainings[0].id,'template-session');
  assert.equal(h.c.week[0].reviewActions,monday);assert.equal(h.c.week[6].reviewActions,sunday);assert.deepEqual(copy(template),templateBefore);
  assert.equal(h.c.week[0].reviewActions[0].observation,'커버가 먼저 도착함');assert.equal(h.c.week[6].reviewActions[0].status,'skipped');
});

test('template overwrite keeps destination task records with unknown fields unchanged',()=>{
  const h=harness();h.template();const tasks=[task('destination',{future:{details:['retain']}}),{id:'legacy-unknown',payload:{keep:true}}];h.c.week[3].reviewActions=tasks;
  h.c.applyTemplate('overwrite');assert.equal(h.c.week[3].reviewActions,tasks);assert.deepEqual(copy(h.c.week[3].reviewActions),copy(tasks));
});

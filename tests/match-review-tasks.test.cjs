'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const review = require('../studio/review-training.js');
const source = fs.readFileSync(path.join(__dirname, '../studio/scout.html'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}
const code = section('/* 2.746 — 경기 → 날짜별 훈련 과제.', '/* 2.746 — 경기 훈련 연결 끝 */');
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
function task(id, patch = {}) {
  return {...review.newTask({id, matchId:'previous', matchDate:'2026-08-20', opponent:'상대', sourceKey:'reviewImprove', action:'압박 뒤 공간 확인', grp:['A'], now:1}), ...patch};
}
function schedule(entries) {
  const doc = {anchorMonday:'2026-08-31',weeks:{}};
  for (const [date,t] of entries) {
    const diff = Math.round((Date.parse(date+'T00:00:00Z') - Date.parse(doc.anchorMonday+'T00:00:00Z'))/864e5);
    const wk = Math.floor(diff/7), day = diff-wk*7;
    if (!doc.weeks[wk]) doc.weeks[wk] = Array.from({length:7}, () => ({}));
    (doc.weeks[wk][day].reviewActions ||= []).push(t);
  }
  return doc;
}
function harness() {
  const local = new Map([['ps_active_ws','team-a'], ['ps_sync_session','{"uid":"coach-a"}']]);
  const calls = {messages:[],toasts:[],snapshots:[],opened:[],views:[],flushes:0};
  const nodes = Object.fromEntries(['matchTrainingCard','matchTrainingOpen','matchTrainingHint','matchTrainingTasks','matchTrainingRecent','matchTrainingRecentList'].map(id=>[id,{hidden:false,disabled:false,textContent:'',innerHTML:'',querySelectorAll(){return [];}}]));
  const state = {role:'executive',canEdit:true,pending:false,keyReady:true,mayLeave:true,doc:schedule([]),matches:[{id:'match-a',date:'2026-09-12',opponent:'상대',reviewImprove:'비공개 개선 원문'}]};
  const parent = {PSSync:{keyReady(){return state.keyReady;}},postMessage(message,origin){calls.messages.push({message,origin});}};
  const c=vm.createContext({console,Promise,Date,Math,JSON,PSReviewTraining:review,parent,location:{origin:'https://local.test'},
    localStorage:{getItem(k){return local.has(k)?local.get(k):null;}},
    store:{owner(){return JSON.stringify([local.get('ps_active_ws'),JSON.parse(local.get('ps_sync_session')).uid]);},get(){return state.doc;}},
    matchSession(){return JSON.parse(local.get('ps_sync_session'));},matchRole(){return state.role;},matchCanEditOne(){return state.canEdit;},
    matchDocPending(){return state.pending;},matchCanLeaveCurrent(){return state.mayLeave;},
    matchCurrent:'match-a',matchSaveRevision:0,matchTab:'prep',matchStage:'prep',
    matchGet(){return state.matches.find(m=>m.id===c.matchCurrent)||null;},matchLoad(){return {matches:state.matches};},
    matchTakeSnap(id){calls.snapshots.push(JSON.stringify(state.matches.find(m=>m.id===id)));},
    matchOpen(id){calls.opened.push(id);c.matchCurrent=id;return true;},setView(v){calls.views.push(v);},
    psFlushPendingReady(){calls.flushes++;return Promise.resolve(true);},toast(s){calls.toasts.push(s);},$(id){return nodes[id]||null;}
  });
  c.window=c;vm.runInContext(code,c);
  return {c,state,local,calls,nodes,parent};
}

test('next training waits for actual flush, then sends identifiers only and refreshes cancel baseline', async () => {
  const {c,calls,state}=harness(), d=deferred();
  c.psFlushPendingReady=()=>{c.matchSaveRevision++;return d.promise;};
  const p=c.matchReviewTrainingOpen();
  assert.equal(calls.messages.length,0);assert.equal(calls.snapshots.length,0);
  d.resolve(true);assert.equal(await p,true);
  assert.equal(calls.messages.length,1);assert.equal(calls.messages[0].origin,'https://local.test');
  const msg=calls.messages[0].message;
  assert.deepEqual(Object.keys(msg).sort(),['matchId','requestId','source','type','uid','wid']);
  assert.equal(msg.matchId,'match-a');assert.equal(msg.type,'reviewTrainingOpen');
  assert.equal(JSON.stringify(msg).includes(state.matches[0].reviewImprove),false);
  assert.equal(JSON.parse(calls.snapshots[0]).reviewImprove,state.matches[0].reviewImprove);
});

test('failed persistence leaves match and cancel baseline intact', async () => {
  const {c,calls}=harness();c.psFlushPendingReady=()=>Promise.reject(new Error('disk failed'));
  assert.equal(await c.matchReviewTrainingOpen(),false);
  assert.equal(calls.messages.length,0);assert.equal(calls.snapshots.length,0);assert.equal(calls.toasts.length,1);
});

for (const change of ['account','workspace','match','input','remote record','permission']) {
  test(`an in-flight training request cannot cross ${change} changes`, async () => {
    const {c,calls,state,local}=harness(),d=deferred();c.psFlushPendingReady=()=>d.promise;
    const p=c.matchReviewTrainingOpen();
    if(change==='account')local.set('ps_sync_session','{"uid":"coach-b"}');
    if(change==='workspace')local.set('ps_active_ws','team-b');
    if(change==='match')c.matchCurrent='another';
    if(change==='input')c.matchSaveRevision++;
    if(change==='remote record')state.matches[0].reviewImprove='다른 판본';
    if(change==='permission')state.canEdit=false;
    d.resolve(true);assert.equal(await p,false);assert.equal(calls.messages.length,0);assert.equal(calls.snapshots.length,0);
  });
}

test('duplicate clicks use one flush and one request', async () => {
  const {c,calls}=harness(),d=deferred();let n=0;c.psFlushPendingReady=()=>{n++;return d.promise;};
  const p=c.matchReviewTrainingOpen();assert.equal(await c.matchReviewTrainingOpen(),false);
  d.resolve(true);await p;assert.equal(n,1);assert.equal(calls.messages.length,1);
});

for (const reason of ['player','no edit permission','no review source','pending match','unpublished input']) {
  test(`new training is blocked for ${reason}`, async () => {
    const {c,calls,state}=harness();
    if(reason==='player')state.role='player';
    if(reason==='no edit permission')state.canEdit=false;
    if(reason==='no review source')state.matches[0].reviewImprove='';
    if(reason==='pending match')state.pending=true;
    if(reason==='unpublished input')state.mayLeave=false;
    assert.equal(await c.matchReviewTrainingOpen(),false);assert.equal(calls.messages.length,0);assert.equal(calls.flushes,0);
  });
}

test('read-only coaches may view linked tasks; unlinked or unready schedule tasks cannot be opened', async () => {
  const {c,state,calls}=harness();state.canEdit=false;state.doc=schedule([['2026-09-13',task('task-a',{matchId:'match-a'})]]);
  assert.equal(await c.matchReviewTrainingOpen('task-a'),true);assert.equal(calls.messages[0].message.taskId,'task-a');
  assert.equal(await c.matchReviewTrainingOpen('unknown'),false);
  state.keyReady=false;assert.equal(await c.matchReviewTrainingOpen('task-a'),false);assert.equal(calls.messages.length,1);
});

test('recent training includes completed tasks in prior 14 days, excluding current match and match day', () => {
  const {c,state}=harness();
  const doc=schedule([
    ['2026-08-28',task('old',{status:'done'})],['2026-08-29',task('boundary',{status:'done'})],
    ['2026-09-11',task('latest',{status:'done',observation:'압박 뒤 커버 확인'})],['2026-09-12',task('today',{status:'done'})],
    ['2026-09-10',task('same-match',{matchId:'match-a',status:'done'})],['2026-09-09',task('planned')],['2026-09-08',task('skipped',{status:'skipped'})]
  ]);
  assert.deepEqual(c.matchTrainingRecentRows(doc,state.matches[0]).map(r=>r.task.id),['latest','boundary']);
  state.matches[0].date='2026-02-30';assert.equal(c.matchTrainingRecentRows(doc,state.matches[0]).length,0);
});

test('task card escapes confirmed content, never renders review source and stays hidden for players', () => {
  const {c,state,nodes}=harness();
  state.doc=schedule([['2026-09-13',task('task-a',{matchId:'match-a',action:'<img src=x onerror=alert(1)>',observation:'<script>bad</script>',grp:['A & B']})]]);
  c.matchRenderTraining(state.matches[0]);
  assert.match(nodes.matchTrainingTasks.innerHTML,/&lt;img/);assert.match(nodes.matchTrainingTasks.innerHTML,/&lt;script&gt;/);assert.match(nodes.matchTrainingTasks.innerHTML,/A &amp; B/);
  assert.equal(nodes.matchTrainingTasks.innerHTML.includes(state.matches[0].reviewImprove),false);
  state.role='player';c.matchRenderTraining(state.matches[0]);assert.equal(nodes.matchTrainingCard.hidden,true);
});

function backEvent(h,patch={}) { return {origin:'https://local.test',source:h.parent,data:{source:'app',type:'reviewTrainingBack',uid:'coach-a',wid:'team-a',matchId:'match-a',...patch}}; }
test('return opens exact match on review tab after verifying persistence', async () => {
  const h=harness(),d=deferred();h.c.psFlushPendingReady=()=>d.promise;
  const p=h.c.matchReviewTrainingBack(backEvent(h));assert.equal(h.calls.opened.length,0);
  d.resolve(true);assert.equal(await p,true);assert.deepEqual(h.calls.opened,['match-a']);assert.equal(h.c.matchTab,'review');assert.equal(h.c.matchStage,'review');
});

test('return never substitutes a match from the same date when the exact match is deleted', async () => {
  const h=harness();h.state.matches.push({id:'other-match',date:'2026-09-12'});
  assert.equal(await h.c.matchReviewTrainingBack(backEvent(h,{matchId:'deleted'})),false);
  assert.equal(h.calls.opened.length,0);assert.equal(h.calls.toasts.length,1);
});

for (const wrong of ['origin','sender','uid','wid','player','not ready']) {
  test(`return rejects ${wrong}`, async () => {
    const h=harness(),event=backEvent(h);
    if(wrong==='origin')event.origin='https://other.test';
    if(wrong==='sender')event.source={};
    if(wrong==='uid')event.data.uid='coach-b';
    if(wrong==='wid')event.data.wid='team-b';
    if(wrong==='player')h.state.role='player';
    if(wrong==='not ready')h.state.pending=true;
    assert.equal(await h.c.matchReviewTrainingBack(event),false);assert.equal(h.calls.opened.length,0);assert.equal(h.calls.flushes,0);
  });
}

test('return cannot open an old team match after workspace switch during flush', async () => {
  const h=harness(),d=deferred();h.c.psFlushPendingReady=()=>d.promise;
  const p=h.c.matchReviewTrainingBack(backEvent(h));h.local.set('ps_active_ws','team-b');d.resolve(true);
  assert.equal(await p,false);assert.equal(h.calls.opened.length,0);assert.equal(h.calls.toasts.length,0);
});

const statusCode = section('function matchPhaseReviewRowHas(r){','/* ══ 2.620 · 하루 여러 경기')+
  section('function matchStatusOf(m){','function matchStatusHTML(m){')+
  section('var MATCH_STEP_FIELDS={','function matchStepMark(m){')+
  section('/* 2.746 — 체크리스트와 같은 완료 기준.','function renderCkHome(){');
function reviewHarness(patch) {
  const h=harness();h.state.matches[0]={id:'match-a',date:'2026-09-11',opponent:'상대',scoreUs:'',scoreThem:'',reviewGood:'',reviewImprove:'',resultSummary:'',phaseReview:{},...patch};
  h.c.mprMoments=()=>[{key:'attack'}];h.c.ckEsc=review.esc;
  vm.runInContext(statusCode,h.c);return h;
}
const completed = {scoreUs:'1',scoreThem:'0',reviewGood:'유지',reviewImprove:'개선',resultSummary:'요약',phaseReview:{attack:{s:3}}};
for (const [name,patch,wanted] of [
  ['empty',{},true],['score only',{scoreUs:'2'},true],['zero string',{scoreUs:'0'},true],['zero number',{scoreUs:0},true],
  ['opponent score',{scoreThem:'2'},true],['partial overall review',{reviewGood:'장면'},true],
  ['phase only',{phaseReview:{attack:{improve:'장면'}}},true],['complete',completed,false],
  ['complete but explicitly unchecked',{...completed,ckDone:{review:false}},true],['explicitly checked',{ckDone:{review:true}},false]
]) {
  test(`today review task: ${name}`,()=>{
    const h=reviewHarness(patch),html=h.c.ckNextTask({today:new Date('2026-09-12T00:00:00')});
    assert.equal(html.includes('지난 경기 리뷰'),wanted);
    if(wanted)assert.match(html,/ckOpenMatchReview/);
  });
}

test('today review task excludes matches the coach cannot edit',()=>{
  const h=reviewHarness({});h.state.canEdit=false;
  assert.equal(h.c.ckNextTask({today:new Date('2026-09-12T00:00:00')}).includes('지난 경기 리뷰'),false);
});

test('today review action opens review after flush and handles quoted match IDs as data',async()=>{
  const h=reviewHarness({id:"match'quoted"});h.c.matchCurrent="match'quoted";
  const html=h.c.ckNextTask({today:new Date('2026-09-12T00:00:00')});
  const onclick=html.match(/onclick="([^"]+)"/)[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&');
  assert.doesNotThrow(()=>new vm.Script(onclick));
  const d=deferred();h.c.psFlushPendingReady=()=>d.promise;
  const p=vm.runInContext(onclick,h.c);assert.equal(h.calls.opened.length,0);d.resolve(true);
  assert.equal(await p,true);assert.deepEqual(h.calls.opened,["match'quoted"]);assert.deepEqual(h.calls.views,['review']);
});

test('confirmed review remains after the actual later cancel restores its snapshot',async()=>{
  const h=harness();
  h.c.matchIndividualPublishWasAttempted=()=>false;h.c.matchPrivateLoad=()=>({});h.c.matchIndividualPendingAny=()=>false;h.c.matchIndividualPublicPendingAny=()=>false;
  h.c.matchIndividualPendingClear=()=>{};h.c.matchIndividualPublicPendingClear=()=>{};
  h.c.matchBackToList=()=>{};h.c.matchSaveNow=()=>true;h.c.matchIndividualCanLeaveActive=()=>true;
  let cancelled;h.c.psConfirm=(message,callback)=>{cancelled=callback();};h.c.store.set=()=>true;
  h.c.MATCH_PRIVATE_KEY='private';
  vm.runInContext(section('var matchSnap=null, matchSnapPriv=null, matchSnapId="";','window.matchSaveAndExit=')+
    section('window.matchCancelExit=','function renderMatch(){'),h.c);
  h.c.matchTakeSnap('match-a');
  h.state.matches[0].reviewImprove='확정한 다음 훈련의 근거';
  assert.equal(await h.c.matchReviewTrainingOpen(),true);
  h.state.matches[0].reviewImprove='복귀 뒤 취소할 편집';
  h.c.matchCancelExit();await cancelled;
  assert.equal(h.state.matches[0].reviewImprove,'확정한 다음 훈련의 근거');
});

test('saved message refreshes task card from schedule while preserving active review and snapshot', () => {
  const h=harness();h.c.matchRenderTraining(h.state.matches[0]);
  h.state.doc=schedule([['2026-09-13',task('new-task',{matchId:'match-a',grp:[],action:'새로 확정한 훈련'})]]);
  assert.equal(h.c.matchReviewTrainingSaved(backEvent(h,{type:'reviewTrainingSaved'})),true);
  assert.match(h.nodes.matchTrainingTasks.innerHTML,/새로 확정한 훈련/);assert.match(h.nodes.matchTrainingTasks.innerHTML,/팀 공통/);
  assert.equal(h.calls.snapshots.length,0);assert.equal(h.calls.flushes,0);assert.equal(h.calls.opened.length,0);
  assert.equal(h.state.matches[0].reviewImprove,'비공개 개선 원문');
});

for (const wrong of ['origin','sender','uid','wid','player']) {
  test(`saved message rejects ${wrong}`, () => {
    const h=harness(),event=backEvent(h,{type:'reviewTrainingSaved'});
    if(wrong==='origin')event.origin='https://other.test';
    if(wrong==='sender')event.source={};
    if(wrong==='uid')event.data.uid='coach-b';
    if(wrong==='wid')event.data.wid='team-b';
    if(wrong==='player')h.state.role='player';
    assert.equal(h.c.matchReviewTrainingSaved(event),false);assert.equal(h.nodes.matchTrainingTasks.innerHTML,'');
  });
}

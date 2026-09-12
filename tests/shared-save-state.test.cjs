'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const storageSource = fs.readFileSync(path.join(__dirname, '../studio/storage.js'), 'utf8');
const scoutSource = fs.readFileSync(path.join(__dirname, '../studio/scout.html'), 'utf8');
function section(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Source section exists: ${start}`);
  return source.slice(a, b);
}
const stateCode = section(storageSource, '/* PROCESS STUDIO — 저장 상태(PSSaveState)', '/* PROCESS STUDIO — 일정 기준선');
const sharedCode = section(storageSource, '  var sharedWrites={},sharedLatest={};', '  /* 큰 보조 사본 전용 API.');
const saveCode = section(storageSource, '  window.psSaveShared=function', '  /* v369 — 팀 전환');
const storeCode = section(scoutSource, 'const mem={};', 'const KEY="scout_tool_v1";');
const matchCode = section(scoutSource, 'function matchSaveNow(){', 'function matchWriteSchedule(state){');
const flushCode = section(scoutSource, 'function matchFlushNow(){', '/* ⚠ 새로고침만이 아니라');
const exitCode = section(scoutSource, 'window.matchSaveAndExit=', 'window.matchCancelExit=');
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
const drain = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const local = new Map([['ps_active_ws','team-a'], ['ps_sync_session','{"uid":"coach-a"}']]);
  const durable = new Map(), commits = [], calls = {closed:0,acts:0,toasts:0}, label = {style:{}}, events = [];
  const context = vm.createContext({
    Promise, console, setTimeout, clearTimeout,
    CustomEvent:class { constructor(type,opts) { this.type=type; this.detail=opts.detail; } },
    document:{body:null,getElementById(){return null;}},
    localStorage:{getItem(k){return local.has(k)?local.get(k):null;},setItem(k,v){local.set(k,String(v));}},
    addEventListener(){},dispatchEvent(e){events.push(e);},
    storage:{set(k,raw){const d=deferred();commits.push({k,raw,...d});return d.promise.then(ok=>{if(ok!==false)durable.set(k,raw);return ok;});}},
    afterMigrate(fn){return Promise.resolve().then(fn);},idbGet(k){return Promise.resolve(durable.get(k));},
    toast(){calls.toasts++;},PSStorageDiagnostic(){},
    $(id){return id==='matchSavedState'?label:null;},
    matchState:{matches:[]},matchCurrent:'match-a',matchTab:'prep',matchSaveRevision:0,
    matchSaveTimer:0,_mprT:null,MATCH_KEY:'cs_team_matches_v1',
    matchWriteSchedule(){return true;},
    matchIndividualPendingAny(){return false;},matchIndividualPublicPendingAny(){return false;},
    matchIndividualFlushPendingAll(){return true;},matchIndividualPublicStaleRows(){return [];},
    matchIndividualPublishPendingAll(){return true;},matchGet(){return {};},
    matchBackToList(){calls.closed++;},psAct(){calls.acts++;}
  });
  context.window=context;
  vm.runInContext(stateCode+'\n'+sharedCode+'\n'+saveCode+'\nwindow.PSStorage={sharedReady:sharedReady,sharedVerified:sharedVerified};\n'+storeCode+'\nwindow.testStore=store;\n'+matchCode+'\n'+flushCode+'\n'+exitCode,context);
  return {c:context,local,durable,commits,calls,label,events};
}

test('shared store acceptance stays saving until the actual delayed commit completes', async () => {
  const {c,commits}=harness();
  assert.equal(c.testStore.set('cs_team_matches_v1',{title:'new'}),true);
  assert.equal(c.PSSaveState.get('team'),'saving');
  assert.equal(c.psHasPending(),true);
  let ready=false;const p=c.psFlushPendingReady().then(()=>{ready=true;});
  await drain();assert.equal(ready,false);assert.equal(commits.length,1);
  commits[0].resolve(true);await p;
  assert.equal(c.PSSaveState.get('team'),'saved');assert.equal(c.psHasPending(),false);
});

test('failed shared commit and verification retry reject flush; another key cannot hide failure', async () => {
  const {c,commits}=harness();
  c.testStore.set('cs_team_matches_v1',{title:'new'});
  const p=c.psFlushPendingReady();const rejection=assert.rejects(p,/disk unavailable/);
  await drain();commits[0].reject(new Error('disk unavailable'));
  await drain();assert.equal(commits.length,2,'sharedReady retries the same latest value once');
  commits[1].reject(new Error('disk unavailable'));await rejection;
  assert.equal(c.PSSaveState.get('team'),'failed');assert.equal(c.psHasPending(),true);
  c.testStore.set('scout_tool_v1',{players:[]});await drain();
  assert.equal(c.PSSaveState.get('team'),'failed');
  const recovered=c.psFlushPendingReady();await drain();
  assert.equal(c.PSSaveState.get('team'),'failed','failure remains visible while its retry is pending');
  commits[2].resolve(true);await recovered;
  assert.equal(c.PSSaveState.get('team'),'saved');
});

test('one committed shared key cannot confirm another pending key', async () => {
  const {c,commits}=harness();
  c.testStore.set('cs_team_matches_v1',{title:'match'});c.testStore.set('cs_scout_targets_v1',{players:[]});
  await drain();commits[0].resolve(true);await drain();
  assert.equal(c.PSSaveState.get('team'),'saving');assert.equal(c.psHasPending(),true);
  commits[1].resolve(true);await c.testStore.ready();assert.equal(c.PSSaveState.get('team'),'saved');
});

for (const changed of [false,true]) test(`flush rechecks a failed key after external queue recovery (durable changed: ${changed})`, async () => {
  const {c,commits,durable}=harness();const key='cs_scout_targets_v1';
  c.testStore.set(key,{players:['new']});const initial=assert.rejects(c.testStore.ready(),/temporary/);
  await drain();commits[0].reject(new Error('temporary'));await drain();commits[1].reject(new Error('temporary'));await initial;
  const external=c.PSStorage.sharedReady(key);await drain();commits[2].resolve(true);await external;
  assert.equal(c.PSSaveState.get('team'),'failed','external drain does not impersonate the tracked completion');
  if(changed)durable.set(key,'different bytes');
  if(changed){await assert.rejects(c.psFlushPendingReady(),/verification failed/);assert.equal(c.PSSaveState.get('team'),'failed');}
  else{await c.psFlushPendingReady();assert.equal(c.PSSaveState.get('team'),'saved');assert.equal(c.psHasPending(),false);}
});

test('failed-key recovery refuses to replay a stale mirror value', async () => {
  const {c,commits,local}=harness();const key='cs_scout_targets_v1';
  c.testStore.set(key,{players:['old']});const initial=assert.rejects(c.testStore.ready(),/temporary/);
  await drain();commits[0].reject(new Error('temporary'));await drain();commits[1].reject(new Error('temporary'));await initial;
  local.set(key,'{"players":["newer"]}');
  await assert.rejects(c.psFlushPendingReady(),/저장 내용이 바뀌어/);
  assert.equal(commits.length,2,'stale raw is never requeued');
  assert.equal(local.get(key),'{"players":["newer"]}');
});

test('a resolved false storage result is rejected rather than marked saved', async () => {
  const {c,commits}=harness();
  c.testStore.set('cs_team_matches_v1',{title:'new'});
  const p=assert.rejects(c.testStore.ready(),/write rejected/);
  await drain();commits[0].resolve(false);await drain();commits[1].resolve(false);await p;
  assert.equal(c.PSSaveState.get('team'),'failed');
});

test('sharedReady waits for new keys added during its second and third drain', async () => {
  const {c,commits}=harness();
  c.psSaveShared('a','1');let done=false;const p=c.PSStorage.sharedReady().then(()=>{done=true;});
  await drain();c.psSaveShared('b','2');commits[0].resolve(true);
  await drain();assert.equal(done,false);
  c.psSaveShared('c','3');commits[1].resolve(true);
  await drain();assert.equal(done,false,'third key is still an uncommitted write');
  commits[2].resolve(true);await p;assert.equal(done,true);
});

test('a superseded same-key failure cannot override the latest verified write', async () => {
  const {c}=harness();const a=deferred(),b=deferred();
  const tracker=c.PSSaveState.createTracker('test',()=> 'owner');
  tracker.track('key',a.promise);const ready=tracker.ready();
  tracker.track('key',b.promise);a.reject(new Error('obsolete'));
  await drain();assert.equal(c.PSSaveState.get('test'),'saving');
  b.resolve(true);await ready;assert.equal(c.PSSaveState.get('test'),'saved');
});

test('late old-owner completion neither confirms the new owner nor passes the old barrier', async () => {
  const {c}=harness();let owner='a';const a=deferred(),b=deferred();
  const tracker=c.PSSaveState.createTracker('test',()=>owner);
  tracker.track('key',a.promise);const ready=assert.rejects(tracker.ready(),/owner changed/);
  owner='b';tracker.track('key',b.promise);a.resolve(true);await ready;
  assert.equal(c.PSSaveState.get('test'),'saving');
  b.resolve(true);await tracker.ready();assert.equal(c.PSSaveState.get('test'),'saved');
});

test('synchronous mirror rejection remains failed after unrelated local success', async () => {
  const {c}=harness();c.localStorage.setItem=()=>{};
  assert.equal(c.testStore.set('local-doc',{title:'not written'}),false);
  await assert.rejects(c.testStore.ready(),/저장 확인 실패/);
  assert.equal(c.PSSaveState.get('team'),'failed');
});

test('match automatic-save label and activity wait for the committed key', async () => {
  const {c,commits,label,calls}=harness();
  assert.equal(c.matchSaveNow(),true);assert.equal(label.textContent,'저장 중…');
  assert.equal(calls.acts,0);await drain();commits[0].resolve(true);await c.testStore.ready();await drain();
  assert.equal(label.textContent,'방금 자동 저장됨');assert.equal(calls.acts,1);
});

test('an older match completion cannot label a newly edited draft as saved', async () => {
  const {c,commits,label}=harness();
  c.matchSaveNow();c.matchSaveRevision++;label.textContent='저장 중…';
  await drain();commits[0].resolve(true);await c.testStore.ready();await drain();
  assert.equal(label.textContent,'저장 중…');
});

test('explicit match save does not close until storage commits', async () => {
  const {c,commits,calls}=harness();
  const p=c.matchSaveAndExit();await drain();assert.equal(calls.closed,0);
  commits[0].resolve(true);await p;assert.equal(calls.closed,1);
});

test('explicit match save stays open on delayed failure', async () => {
  const {c,commits,calls,label}=harness();
  const p=c.matchSaveAndExit();await drain();commits[0].reject(new Error('disk unavailable'));
  await drain();commits[1].reject(new Error('disk unavailable'));await p;
  assert.equal(calls.closed,0);assert.match(label.textContent,/저장 안 됨/);
});

test('old-owner explicit save completion does not close or notify the new team', async () => {
  const {c,commits,calls,local}=harness();
  const p=c.matchSaveAndExit();await drain();local.set('ps_active_ws','team-b');
  commits[0].resolve(true);await p;
  assert.equal(calls.closed,0);assert.equal(calls.toasts,0);
});

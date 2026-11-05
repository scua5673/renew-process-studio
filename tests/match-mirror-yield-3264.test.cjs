'use strict';
/* 3.264 — 작은 저장소가 가득 차 경기 거울(cs_team_matches_v1)을 못 쓰는 PC(11/5 6c0d806d: 일정 거울 7.6MB · 하루 종일 match-round-failed).
   IDB 와 똑같은 일정 거울만 걷어(3.131 의 «거울 없는 기기» 상태) 경기 거울을 한 번 더 쓴다. 일정 거울이 IDB 와 다르면 걷지 않고 예전 되돌리기 그대로. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const fixture=path.join(__dirname,'team-data-consistency.test.cjs'),fixtureSource=fs.readFileSync(fixture,'utf8');
const declarations=fixtureSource.slice(0,fixtureSource.indexOf('\nconst pushed='));
const {harness}=new Function('require','__dirname',declarations+'\nreturn {harness};')(createRequire(fixture),__dirname);
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function fn(name){const a=source.indexOf('function '+name+'('),b=source.indexOf('\nfunction ',a+1);assert.ok(a>=0&&b>a,name);return source.slice(a,b);}
const KEY='cs_team_matches_v1',SCHEDULE='process_coach_v1';
const doc=attack=>JSON.stringify({version:1,matches:[{id:'fixture-match',date:'2026-11-05',opponent:'synthetic opponent',attack,phaseBoards:{cur:'atk',boards:{atk:{us:[],opp:[]}}}}]});
const OLD=doc('old confirmed preparation'),NEW=doc('new server preparation');
const BIG=JSON.stringify({version:1,anchorMonday:'2026-11-02',weeks:{0:[{d:'월',n:1,rest:true,trainings:[]}],pad:'x'.repeat(4000)}});
const quota=()=>Object.assign(Error('fixture MATCH mirror quota'),{name:'QuotaExceededError'});
function setup(options={}){
  const h=harness({key:KEY,server:NEW,cupd:2,mirror:OLD,idb:OLD});h.baseline(OLD,1);
  h.local.set('ps_sync_session','{"uid":"coach-a"}');
  vm.runInContext(['isMergeBaseKey','syncBaseGet','syncBaseStore','syncBaseSet','classifySyncError'].map(fn).join('\n'),h.c);
  h.local.set(SCHEDULE,BIG);h.idb.set(SCHEDULE,options.idbSchedule===undefined?BIG:options.idbSchedule);
  const attempts=[],rollbacks=[];
  /* 작은 저장소: 일정 거울이 있는 동안은 경기 거울을 쓸 자리가 없다 */
  h.hooks.localWrite=(k,v)=>{if(k===KEY){attempts.push(v);if(h.local.has(SCHEDULE))throw quota();}};
  h.hooks.idbReplace=(k,expected,value)=>{if(k===KEY)rollbacks.push({expected,value});};
  return Object.assign(h,{attempts,rollbacks});
}
test('일정 거울이 IDB 와 같으면 걷고, 경기 거울을 다시 써 회차를 마친다 — 되돌리기 없음 · 준비표 발급',async()=>{
  const h=setup();const r=await h.run();
  assert.equal(r.error,undefined,JSON.stringify({r,errors:h.errors.map(e=>e.stage)}));
  assert.equal(h.local.has(SCHEDULE),false,'일정 거울을 걷는다');assert.equal(h.idb.get(SCHEDULE),BIG,'일정 정본(IDB)은 그대로');
  assert.equal(h.c.scheduleMirrorLeft,BIG,'3.131 의 거울 없는 기기 상태');
  assert.equal(h.local.get(KEY),NEW);assert.equal(h.idb.get(KEY),NEW);assert.equal(h.ready(),true);
  assert.deepEqual(h.rollbacks,[]);assert.equal(h.attempts.length,2,'실패 한 번 · 걷은 뒤 한 번');
  assert.ok(h.errors.some(e=>e.stage==='schedule-mirror-yield'),'걷은 사실을 진단에 남긴다');
  assert.equal(h.c.meta().h[KEY],h.c.hash(NEW));
});
test('일정 거울이 IDB 와 다르면(새 입력) 걷지 않고 예전처럼 경기 IDB 만 정확히 되돌린다',async()=>{
  const h=setup({idbSchedule:BIG+' '});const r=await h.run();
  assert.equal(r.code,'sync_storage');
  assert.equal(h.local.get(SCHEDULE),BIG,'다른 일정 거울은 손대지 않는다');assert.equal(h.c.scheduleMirrorLeft,null);
  assert.equal(h.local.get(KEY),OLD);assert.equal(h.idb.get(KEY),OLD);assert.equal(h.ready(),false);
  assert.deepEqual(h.rollbacks,[{expected:NEW,value:OLD}]);assert.equal(h.attempts.length,1);
});
test('일정 거울이 없으면(이미 걷힌 기기) 걷을 것이 없어 되돌리기 그대로',async()=>{
  const h=setup();h.local.delete(SCHEDULE);h.hooks.localWrite=(k,v)=>{if(k===KEY){h.attempts.push(v);throw quota();}};
  const r=await h.run();assert.equal(r.code,'sync_storage');assert.deepEqual(h.rollbacks,[{expected:NEW,value:OLD}]);assert.equal(h.attempts.length,1);
});
test('걷은 뒤에도 경기 거울을 못 쓰면 일정 거울을 제자리에 — 다음 회차가 일정을 «받은» 회차가 되지 않는다',async()=>{
  const h=setup();h.hooks.localWrite=(k,v)=>{if(k===KEY){h.attempts.push(v);throw quota();}};
  const r=await h.run();assert.equal(r.code,'sync_storage');
  assert.equal(h.local.get(SCHEDULE),BIG,'일정 거울이 돌아와 있다');assert.equal(h.c.scheduleMirrorLeft,null);
  assert.equal(h.attempts.length,2,'걷기 전 한 번 · 걷은 뒤 한 번');assert.deepEqual(h.rollbacks,[{expected:NEW,value:OLD}]);
  assert.ok(!h.errors.some(e=>e.stage==='schedule-mirror-yield'),'자리를 못 냈으니 걷었다고 적지 않는다');
});

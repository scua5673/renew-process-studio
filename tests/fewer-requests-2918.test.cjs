'use strict';
/* 2.918 — 서버 요청 줄이기: 주기 동기화 간격을 상황에 맞춰 늘린다.
   ① 기기 상태 보고는 sync-observability.test.cjs  ②③ 여기 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function slice(a,b){const i=S.indexOf(a),j=S.indexOf(b,i+1);assert.ok(i>=0&&j>i,a);return S.slice(i,j);}
const BLOCK=slice('/* 2.918 — 주기 동기화 간격.','/* 서버 변경을 로컬에 반영한 뒤');
function gap(o={}){
  let now=o.now||1e12;
  const c=vm.createContext({Date:{now:()=>now},document:{hasFocus:()=>o.focused!==false,querySelectorAll:()=>o.frames||[]},window:o.win||{addEventListener(){}},
    visiblePendingInfo:()=>({count:o.pending||0}),activeWs:()=>'w1',rtConnected:()=>!!o.rt});
  vm.runInContext(BLOCK,c);
  if(o.activityAgo!=null)c.syncActivityAt=now-o.activityAgo;
  if(o.lastRoundAgo!=null)c.lastRoundStartAt=now-o.lastRoundAgo;
  return {c,tick(ms){now+=ms;}};
}
test('평소(보이는 창·실시간 없음·입력 있음)는 예전처럼 45초',()=>{
  assert.equal(gap().c.syncIntervalGap(false),45000);
});
test('② 실시간이 붙어 있으면 3분',()=>{
  assert.equal(gap({rt:true}).c.syncIntervalGap(false),180000);
});
test('③ 포커스 없는 창·15분 입력 없는 창은 5분, 숨긴 창은 10분',()=>{
  assert.equal(gap({focused:false}).c.syncIntervalGap(false),300000);
  assert.equal(gap({activityAgo:16*60000}).c.syncIntervalGap(false),300000);
  assert.equal(gap({activityAgo:14*60000}).c.syncIntervalGap(false),45000);
  assert.equal(gap().c.syncIntervalGap(true),600000);
  assert.equal(gap({rt:true,focused:false}).c.syncIntervalGap(false),300000,'방치가 실시간보다 우선');
});
test('올릴 것이 있으면 어떤 경우든 예전 간격(보일 때 45초·숨김 3분)',()=>{
  assert.equal(gap({pending:2,rt:true,focused:false}).c.syncIntervalGap(false),45000);
  assert.equal(gap({pending:1}).c.syncIntervalGap(true),180000);
});
test('최근에 다른 이유로 돈 회차가 있으면 주기 회차를 건너뛴다',()=>{
  let g=gap({rt:true,lastRoundAgo:60000});assert.equal(g.c.syncIntervalDue(false),false);
  g=gap({rt:true,lastRoundAgo:178000});assert.equal(g.c.syncIntervalDue(false),true,'3초 여유 — 45초 틱이 3분 경계를 놓치지 않게');
  g=gap({lastRoundAgo:44000});assert.equal(g.c.syncIntervalDue(false),true);
  g=gap({lastRoundAgo:30000});assert.equal(g.c.syncIntervalDue(false),false);
});
test('입력 감시는 창과 같은 출처 프레임마다 한 번만 붙고, 다른 출처 프레임은 건너뛴다',()=>{
  const added=[];const mk=()=>({addEventListener:(ev)=>added.push(ev)});
  const same=mk(),cross={get __psActWatch(){throw new Error('SecurityError');}};
  const g=gap({win:mk(),frames:[{contentWindow:same},{contentWindow:cross},{contentWindow:null}]});
  g.c.syncWatchFrames();g.c.syncWatchFrames();
  assert.equal(added.length,8,'창 4 + 같은 출처 프레임 4, 두 번 불러도 한 번');
  g.c.syncActivityAt=0;g.c.syncMarkActivity();assert.ok(g.c.syncActivityAt>0);
});
test('회차가 시작 시각을 남기고, 틱은 syncIntervalDue 를 본다',()=>{
  assert.match(S,/lastRoundStartAt=roundT0;/);
  assert.match(S,/if\(syncIntervalDue\(false\)\) syncNow\('interval'\);/);
  assert.match(S,/if\(syncIntervalDue\(true\)\) syncNow\('interval-bg'\);/);
});

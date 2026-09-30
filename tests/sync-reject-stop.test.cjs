'use strict';
/* 2.914 — 서버가 같은 원문을 같은 판본에서 거듭 받지 않으면 되풀이를 멈춘다.
   2026-09-30 관리자 오류 실측: 7일 854건 중 약 58%가 기기 5대가 45초마다 같은 거부를 되풀이한 것이었다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const a=S.indexOf('/* ── 2.914 · 서버가 같은 내용을 거듭 받지 않으면'),b=S.indexOf('/* 올리기 직전 검사',a);
assert.ok(a>0&&b>a,'reject block');
const BLOCK=S.slice(a,b);
function harness(opts={}){
  const store=new Map(Object.entries(opts.store||{}));let holds=opts.holds||[];const updates=[];let now=opts.now||1e12;
  const ctx=vm.createContext({JSON,Object,Array,Number,String,Date:{now:()=>now},
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    getSess:()=>opts.noSession?null:{uid:opts.uid||'u1'},activeWs:()=>opts.wid||'w1',
    holdList:()=>holds.slice(),holdConflictWrite:rows=>{holds=rows;},
    hash:s=>'h:'+s,
    navigator:{serviceWorker:{getRegistration:()=>{updates.push(now);return Promise.resolve({update:()=>Promise.resolve()});}}}});
  vm.runInContext(BLOCK+';this.api={rejectNote,rejectClear,rejectHoldCheck,rejectRead,REJECT_STOP};',ctx);
  return {api:ctx.api,store,updates,get holds(){return holds;},set holds(v){holds=v;},tick(ms){now+=ms;}};
}
test('같은 원문·같은 판본이 세 번 거부되면 멈춘다(두 번은 아직 보낸다)',()=>{
  const h=harness();
  h.api.rejectNote('process_coach_v1','h:A',5);h.api.rejectNote('process_coach_v1','h:A',5);
  assert.equal(h.api.rejectHoldCheck('process_coach_v1','A',5),false);
  h.api.rejectNote('process_coach_v1','h:A',5);
  assert.equal(h.api.REJECT_STOP,3);
  assert.equal(h.api.rejectHoldCheck('process_coach_v1','A',5),true);
  assert.equal(h.api.rejectHoldCheck('process_coach_v1','A','5'),true,'판본이 문자열이어도 같은 판본');
});
test('새로 고치면(원문이 바뀌면) 다시 시도한다',()=>{
  const h=harness();for(let i=0;i<3;i++)h.api.rejectNote('cs_team_matches_v1','h:A',5);
  assert.equal(h.api.rejectHoldCheck('cs_team_matches_v1','B',5),false);
});
test('서버 판본이 바뀌면(다른 기기가 저장) 다시 시도한다',()=>{
  const h=harness();for(let i=0;i<3;i++)h.api.rejectNote('cs_team_matches_v1','h:A',5);
  assert.equal(h.api.rejectHoldCheck('cs_team_matches_v1','A',6),false);
});
test('다른 판본에서의 거부는 횟수를 이어 세지 않는다',()=>{
  const h=harness();h.api.rejectNote('k','h:A',5);h.api.rejectNote('k','h:A',5);h.api.rejectNote('k','h:A',6);
  assert.equal(h.api.rejectRead()['u1|w1|k'].n,1);
});
test('기록은 계정·팀마다 따로다',()=>{
  const h=harness();for(let i=0;i<3;i++)h.api.rejectNote('k','h:A',5);
  const other=harness({store:Object.fromEntries(h.store),wid:'w2'});
  assert.equal(other.api.rejectHoldCheck('k','A',5),false);
  const nobody=harness({store:Object.fromEntries(h.store),noSession:true});
  assert.equal(nobody.api.rejectHoldCheck('k','A',5),false);
});
test('저장이 확인되면 기록을 지운다',()=>{
  const h=harness();for(let i=0;i<3;i++)h.api.rejectNote('k','h:A',5);
  h.api.rejectClear('k');assert.equal(h.api.rejectHoldCheck('k','A',5),false);
});
test('사람이 «이 기기 것»을 고르면 한 번 더 보내고, 또 거부되면 선택을 풀어 다시 묻는다',()=>{
  const h=harness({holds:[{kind:'conflict',k:'k',h:'h:A',c:5,reason:'rejected',choice:'local'}]});
  for(let i=0;i<3;i++)h.api.rejectNote('k','h:A',5);
  /* rejectNote 가 선택을 풀었으므로 이제 보류 */
  assert.equal(h.holds[0].choice,undefined);assert.equal(h.holds[0].reason,'rejected');
  assert.equal(h.api.rejectHoldCheck('k','A',5),true);
  h.holds=[{kind:'conflict',k:'k',h:'h:A',c:5,reason:'rejected',choice:'local'}];
  assert.equal(h.api.rejectHoldCheck('k','A',5),false,'선택이 살아 있으면 한 번 더 보낸다');
});
test('보류 중인 거부 기록은 횟수와 상관없이 같은 판본에서는 계속 멈춘다',()=>{
  const h=harness({holds:[{kind:'conflict',k:'k',h:'h:A',c:5,reason:'rejected'}]});
  assert.equal(h.api.rejectHoldCheck('k','A',5),true);
  assert.equal(h.api.rejectHoldCheck('k','A',6),false);
});
test('거부가 나면 새 판을 바로 확인하되 10분에 한 번만',()=>{
  const h=harness();h.api.rejectNote('k','h:A',5);h.api.rejectNote('k','h:A',5);
  assert.equal(h.updates.length,1);h.tick(600001);h.api.rejectNote('k','h:A',5);assert.equal(h.updates.length,2);
});
test('7일 지난 기록은 버린다',()=>{
  const h=harness();h.api.rejectNote('old','h:A',5);h.tick(8*864e5);h.api.rejectNote('new','h:B',1);
  const r=h.api.rejectRead();assert.equal(r['u1|w1|old'],undefined);assert.ok(r['u1|w1|new']);
});
test('queuePush 가 올리기 전에 멈춤 검사를 하고, 원문 지문과 거부 사유를 넘긴다',()=>{
  const q=S.indexOf('      function queuePush(k,raw,confirmedRaw,expectedLoc,casCupd,casMissing){');
  const body=S.slice(q,S.indexOf('      function restoreUnconfirmedTeamKey',q));
  assert.ok(body.indexOf('rejectHoldCheck(k,raw,rjC)')>0&&body.indexOf('rejectHoldCheck')<body.indexOf('var send=raw'),'검사가 전송 준비보다 먼저');
  assert.match(body,/resolveTeamConflict\(k,raw,rjRow,true,'rejected'\)/);
  assert.match(body,/_rh:hash\(raw\)/);
  assert.match(S,/function resolveTeamConflict\(k,loc,row,forceReview,reason\)/);
  assert.match(S,/holdConflictRecord\(k,loc,row,reason\)/);
});

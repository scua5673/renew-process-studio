'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
/* 3.056 — 회차 앞 단계(일정 화면 사본 · 경기 · 스카우트 준비표)가 기기 저장소 문제로 실패해도 보관함(ps_library)은 따로 주고받는다.
   풋볼A 운영자 아이패드: 3.055 로 선수 확인 막힘은 풀렸지만 일정 화면 사본 쓰기(schedule_mirror_quota)에서 회차가 계속 멈춰
   회차 맨 끝의 보관함 단계까지 못 가 보관함이 비어 있었다. */
const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function fn(name){const a=sync.indexOf('function '+name+'('),b=sync.indexOf('\nfunction ',a+1);assert.ok(a>=0&&b>a,name);return sync.slice(a,b);}

function harness({library,guard=()=>true,queue=[],values={}}={}){
  const local=new Map([['ps_sync_meta',JSON.stringify({h:{k:'h1'},c:{k:5},last:1,n:{},r:{},li:{old:{h:'x',s:1}}})]]);
  const diags=[],libCalls=[];let q=queue.slice();
  const box={
    localStorage:{getItem:k=>local.has(k)?local.get(k):null,setItem:(k,v)=>local.set(k,String(v))},
    MKEY:'ps_sync_meta',matchReadyPending:false,scheduleReadyPending:false,scoutReadyPending:false,MATCH_KEY:'m',SCHEDULE_KEY:'s',SCOUT_KEY:'t',
    syncDiagnostic:(s,e)=>diags.push([s,e&&e.message]),
    syncLibrary:async(at,m,now,wid,g)=>{libCalls.push({at,wid,li:JSON.parse(JSON.stringify(m.li||{}))});return library?library(m):{applied:0,pushed:0,ackHash:'rev-h'};},
    outboxOwner:()=>'coach',outboxScope:(u,w)=>u+'|'+w,
    outboxTxn:async f=>{q=await f(q);return q;},
    currentValueForKey:async k=>values[k],hash:v=>'h:'+v,
    syncIssue:(code,stage,msg)=>Object.assign(new Error(msg),{psCode:code,psStage:stage}),
  };
  vm.createContext(box);
  vm.runInContext([fn('meta'),fn('setMetaExact'),fn('libraryAfterRoundFailure'),fn('outboxAckLibrary')].join('\n')+'\nthis.run=libraryAfterRoundFailure;',box);
  return {run:(e,started)=>box.run(e,'tok','team-a',guard,started),local,diags,libCalls,queue:()=>q,meta:()=>JSON.parse(local.get('ps_sync_meta'))};
}
const storageErr=()=>Object.assign(new Error('저장 공간이 부족해 일정 화면 사본을 바꾸지 못했어요'),{psCode:'sync_storage',psStage:'schedule_mirror_quota'});

test('a device-side round failure still syncs the library and keeps only its ledger', async()=>{
  const h=harness({library:m=>{m.li.got={h:'g',s:9};m.ls=null;m.ld=3;return {applied:1,pushed:0,ackHash:'h:rev2'};},
    queue:[{key:'@library',uid:'coach',wid:'team-a'},{key:'process_coach_v1',uid:'coach',wid:'team-a'}],values:{'@library':'rev2','process_coach_v1':'x'}});
  const lr=await h.run(storageErr(),false);
  assert.equal(lr.applied,1);assert.equal(h.libCalls.length,1);assert.deepEqual(h.libCalls[0].li,{old:{h:'x',s:1}},'starts from the saved ledger');
  const m=h.meta();assert.deepEqual(m.li,{old:{h:'x',s:1},got:{h:'g',s:9}});assert.equal(m.ld,3);
  assert.deepEqual([m.h,m.c],[{k:'h1'},{k:5}],'other keys meta untouched');
  assert.deepEqual(h.queue().map(x=>x.key),['process_coach_v1'],'library pending closed, the failed key stays pending');
});
test('library pending stays when the library changed after the ack hash', async()=>{
  const h=harness({queue:[{key:'@library',uid:'coach',wid:'team-a'}],values:{'@library':'newer'}});
  await h.run(Object.assign(new Error('x'),{psCode:'sync_local_changed'}),false);
  assert.equal(h.queue().length,1);
});
test('no fallback when the library already ran, for network/auth/workspace errors, or after a switch', async()=>{
  for(const [e,started] of [[storageErr(),true],[Object.assign(new Error('Load failed'),{psCode:'sync_network'}),false],
    [Object.assign(new Error('x'),{psCode:'sync_auth'}),false],[Object.assign(new Error('x'),{psCode:'sync_workspace_changed'}),false],[new Error('plain'),false]]){
    const h=harness();assert.equal(await h.run(e,started),null);assert.equal(h.libCalls.length,0);
  }
  const moved=harness({guard:()=>false});assert.equal(await moved.run(storageErr(),false),null);assert.equal(moved.libCalls.length,0);
});
test('a failing library fallback never changes the round error or meta', async()=>{
  const h=harness({library:()=>{throw Object.assign(new Error('library_pull 500'),{psCode:'sync_http'});}});
  const before=h.local.get('ps_sync_meta');
  assert.equal(await h.run(storageErr(),false),null);
  assert.equal(h.local.get('ps_sync_meta'),before);assert.deepEqual(h.diags,[['library-after-failure','library_pull 500']]);
});
test('the round calls the fallback only from its failure path, before rethrowing, and marks the library stage', ()=>{
  assert.match(sync,/libraryRoundStarted=true; return syncLibrary\(at,m,now,wid,roundWorkspaceCurrent\);/);
  const a=sync.indexOf("try{blockMatchReady('match-round-failed',e);}"),b=sync.indexOf('}).then(function(){ throw e; });',a);
  assert.ok(a>0&&b>a,'fallback sits between the match fail-close and the rethrow');
  assert.match(sync.slice(a,b),/libraryAfterRoundFailure\(e,at,wid,roundWorkspaceCurrent,libraryRoundStarted\)/);
});

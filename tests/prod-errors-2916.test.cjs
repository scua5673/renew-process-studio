'use strict';
/* 2.916 — 운영 오류 7일(9/23~9/30, 891건·99명) 실측에서 나온 고침들.
   ① IDB 요청 실패가 null 로 reject 돼 이름·메시지 없는 sync_unexpected 로 남던 것
   ② 한 회차 안에서 만료된 토큰이 뒤 단계를 401 로 떨어뜨리던 것(재시도 없음)
   ③ 숨김·잠자기·깨어남 순간의 메타 조회 한 번 끊김을 오류로 보고하던 것
   ④ 연속 편집 경합(shared source or owner changed)을 오류로 보고하던 것 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const ST=fs.readFileSync(path.join(__dirname,'../studio/storage.js'),'utf8');
function slice(src,a,b){const i=src.indexOf(a),j=src.indexOf(b,i+1);assert.ok(i>=0&&j>i,'block '+a);return src.slice(i,j);}
const tick=()=>new Promise(r=>setImmediate(r));

/* ── ① storage.js ── */
const STORE_CODE=slice(ST,'  function open(){','  function idbKeys(');
function storeFixture(){
  const requests=[];let reads=0;
  const c=vm.createContext({Promise,Error,DB:'test',VER:1,STORE:'kv',dbp:null,indexedDB:{open(){const r={};requests.push(r);return r;}},
    isQuotaErr:e=>!!(e&&e.name==='QuotaExceededError'),diagnostic(){}});
  vm.runInContext(STORE_CODE,c);
  /* plan: 차례로 'ok' | {requestError:Error|null} | {abort:true} */
  function ready(plan){
    const r=requests.at(-1),db={close(){},transaction(){const step=plan.shift()||'ok';
      const t={error:null,abort(){queueMicrotask(()=>t.onabort&&t.onabort({}));},objectStore(){return {put(){},get(){reads++;const request={result:'v'};
        queueMicrotask(()=>{
          if(step==='ok')return t.oncomplete();
          if(step.abort)return t.onabort({});
          t.onerror({target:{error:step.requestError}});t.onabort({});
        });return request;}};}};return t;}};
    r.result=db;r.onsuccess();return db;
  }
  return {c,requests,ready,get reads(){return reads;}};
}
test('IDB 요청 실패는 null 이 아니라 요청의 오류로 reject 한다',async()=>{
  const h=storeFixture(),p=h.c.idbSet('k','v');
  const err=Object.assign(new Error('Connection to Indexed Database server lost'),{name:'UnknownError'});
  h.ready([{requestError:err}]);
  await assert.rejects(p,e=>e===err);
});
test('요청 오류도 transaction 오류도 없으면 이름 붙인 Error 를 만든다',async()=>{
  const h=storeFixture(),p=h.c.idbSet('k','v');h.ready([{requestError:null}]);
  await assert.rejects(p,e=>e instanceof Error&&e.name==='UnknownError'&&/request failed/.test(e.message));
});
test('읽기는 일시적으로 끊기면 연결을 새로 열어 한 번 더 한다',async()=>{
  const h=storeFixture(),p=h.c.idbGet('k');
  h.ready([{requestError:Object.assign(new Error('lost'),{name:'UnknownError'})}]);
  await tick();await tick();
  assert.equal(h.requests.length,2,'UnknownError 는 연결을 버리고 새로 연다');
  h.ready(['ok']);
  assert.equal(await p,'v');
});
test('읽기 재시도는 한 번뿐이고, 용량 초과는 재시도하지 않는다',async()=>{
  const h=storeFixture(),p=h.c.idbGet('k');
  h.ready([{abort:true},{abort:true}]);
  await assert.rejects(p,{name:'AbortError'});
  assert.equal(h.reads,2);
  const q=storeFixture(),p2=q.c.idbGet('k');
  q.ready([{requestError:Object.assign(new Error('full'),{name:'QuotaExceededError'})}]);
  await assert.rejects(p2,{name:'QuotaExceededError'});
  assert.equal(q.reads,1);
});
test('쓰기는 끊겨도 다시 보내지 않는다(더 새 편집을 덮을 수 있다)',async()=>{
  const h=storeFixture(),p=h.c.idbSet('k','v');h.ready([{abort:true},'ok']);
  await assert.rejects(p,{name:'AbortError'});
  assert.equal(h.reads,1);
});

/* ── ③④ 회차 실패 판정·기록 ── */
const HELP=slice(S,'/* 2.916 — 회차 실패 기록 도우미 */','/* 서버 변경을 로컬에 반영한 뒤');
function helpers(o={}){
  const c=vm.createContext({String,Math,Date:{now:()=>o.now||1e12},performance:{now:()=>o.perf||0},
    document:{visibilityState:o.hidden?'hidden':'visible'},Event:class Event{constructor(t){this.type=t;}},
    SYNC_DIAG_LOG:o.log||[],syncHiddenSeq:o.seq||0,syncWakeAt:o.wake||0});
  vm.runInContext(HELP+';this.api={syncRoundContext,syncQuietFailure,errText,errNameOf,syncFailMeta};',c);
  return c;
}
test('이름·메시지 없는 값(null·undefined·Event)도 무엇인지 남긴다',()=>{
  const {api}=helpers(),E=helpers().Event;
  assert.equal(api.errNameOf(null),'<null>');assert.equal(api.errNameOf(undefined),'<undefined>');
  assert.equal(api.errText(null),'');assert.equal(api.errText('boom'),'boom');
  const c=helpers();assert.equal(c.api.errText(new c.Event('abort')),'event:abort');
  assert.equal(api.errText({}),'','[object Object] 는 남기지 않는다');
  assert.equal(api.errNameOf({}),'Object');
});
test('숨김 회차·숨겨진 사이·잠자기·깨어난 직후의 네트워크 끊김은 조용히 다시 시도한다',()=>{
  const net={code:'sync_network',stage:'kv_meta'},e=Object.assign(new TypeError('Load failed'));
  let c=helpers({now:1e12,wake:1e12-60000});
  assert.equal(c.api.syncQuietFailure(e,net,c.api.syncRoundContext('interval',0,1e12,0)),false,'보이는 채로 평소 회차면 보고한다');
  assert.equal(c.api.syncQuietFailure(e,net,c.api.syncRoundContext('hide',0,1e12,0)),true);
  assert.equal(c.api.syncQuietFailure(e,net,c.api.syncRoundContext('interval-bg',0,1e12,0)),true);
  c=helpers({now:1e12,wake:1e12-60000,seq:2});
  assert.equal(c.api.syncQuietFailure(e,net,c.api.syncRoundContext('interval',1,1e12,0)),true,'회차 중에 숨겨졌다');
  c=helpers({now:1e12,wake:1e12-5000});
  assert.equal(c.api.syncQuietFailure(e,net,c.api.syncRoundContext('show',0,1e12,0)),true,'깨어난 지 15초 안');
  c=helpers({now:1e12,perf:1000,wake:1e12-60000});
  assert.equal(c.api.syncQuietFailure(e,net,c.api.syncRoundContext('interval',0,1e12-20000,1000-2000)),true,'벽시계 20초·성능시계 2초 = 잠잤다');
  c=helpers({hidden:true});
  assert.equal(c.api.syncQuietFailure(e,{code:'sync_timeout',stage:'kv_meta'},c.api.syncRoundContext('interval',0,1e12,0)),true);
});
test('권한·인증·서버 거부는 숨김이어도 늘 보고한다',()=>{
  const c=helpers({hidden:true}),ctx=c.api.syncRoundContext('hide',0,1e12,0);
  for(const code of ['sync_auth','sync_permission','sync_server_rejected','sync_unexpected'])
    assert.equal(c.api.syncQuietFailure(new Error('x'),{code,stage:'kv_push'},ctx),false,code);
});
test('저장소 오류는 일시 끊김(Abort·Timeout·Unknown)만 숨김일 때 조용히, 용량 초과는 늘 보고',()=>{
  const c=helpers({hidden:true}),ctx=c.api.syncRoundContext('hide',0,1e12,0),info={code:'sync_storage',stage:'storage'};
  assert.equal(c.api.syncQuietFailure(Object.assign(new Error('a'),{name:'AbortError'}),info,ctx),true);
  assert.equal(c.api.syncQuietFailure(Object.assign(new Error('t'),{name:'TimeoutError'}),info,ctx),true);
  assert.equal(c.api.syncQuietFailure(Object.assign(new Error('q'),{name:'QuotaExceededError'}),info,ctx),false);
  const v=helpers({now:1e12,wake:1e12-60000});
  assert.equal(v.api.syncQuietFailure(Object.assign(new Error('a'),{name:'AbortError'}),info,v.api.syncRoundContext('interval',0,1e12,0)),false,'보이는 채로면 보고');
});
test('연속 편집 경합(storage_source_changed)은 늘 조용히 다시 맞춘다',()=>{
  const c=helpers();
  assert.equal(c.api.syncQuietFailure(Object.assign(new Error('shared source or owner changed'),{name:'StorageOwnerChangedError'}),
    {code:'sync_local_changed',stage:'storage_source_changed'},c.api.syncRoundContext('edit',0,1e12,0)),true);
  assert.equal(c.api.syncQuietFailure(new Error('x'),{code:'sync_local_changed',stage:'schedule_ready_exact'},c.api.syncRoundContext('edit',0,1e12,0)),false,'일정 확인 불일치는 아직 보고(2.917)');
});
test('기록에 회차 이유·숨김·잠자기·깨어난 뒤 초·직전 진단 단계를 싣고 토큰은 가린다',()=>{
  const c=helpers({now:1e12,wake:1e12-42000,log:[{stage:'idb-set-schedule',at:1e12-3000},{stage:'kv_meta',at:1e12-1000}]});
  const m=c.api.syncFailMeta(new Error('bad eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxx'),{code:'sync_unexpected',stage:'kv_meta'},c.api.syncRoundContext('interval',0,1e12,0));
  assert.equal(m.reason,'interval');assert.equal(m.hid,0);assert.equal(m.slept,0);assert.equal(m.wake,42);
  assert.equal(m.source,'idb-set-schedule','같은 단계 진단은 건너뛰고 그 앞 단계');
  assert.match(m.msg,/<tok>/);assert.doesNotMatch(m.msg,/eyJhbGci/);
  const old=helpers({now:1e12,log:[{stage:'idb-x',at:1e12-60000}]}).api.syncFailMeta(null,{code:'sync_unexpected',stage:'sync'},{reason:'x',hid:false,slept:false,wakeMs:-1});
  assert.equal(old.source,undefined,'10초보다 오래된 진단은 싣지 않는다');assert.equal(old.name,'<null>');assert.equal(old.wake,-1);
});

/* ── ② 401 한 번 갱신·재시도 ── */
const FETCH=slice(S,'/* 2.916 — 서버가 401 로 거부한 토큰을 한 번만 갱신한다.','function syncHttpError(');
function fetchFixture(o={}){
  const calls=[];let sess={uid:'u1',at:'OLD',rt:'r',exp:9e15};let refreshes=0;
  const responses=(o.responses||[]).slice();
  const c=vm.createContext({Promise,Object,String,setTimeout,clearTimeout,AbortController,navigator:{onLine:true},
    getSess:()=>sess,forceStaleAt:'',tokenSwap:{from:'',to:''},
    syncIssue:(code,stage,msg)=>Object.assign(new Error(msg),{psCode:code,psStage:stage}),
    ensureToken:()=>{refreshes++;if(o.refreshFails)return Promise.reject(new Error('net'));if(o.refreshLogout){sess=null;return Promise.resolve(null);}
      sess=Object.assign({},sess,{at:'NEW'});if(o.switchUid)sess.uid='u2';return Promise.resolve(sess.at);},
    fetch:(url,opts)=>{calls.push({url,auth:opts.headers&&opts.headers.Authorization,body:opts.body,method:opts.method});const st=responses.length?responses.shift():200;return Promise.resolve({status:st,ok:st<300});}});
  vm.runInContext(FETCH+';this.syncFetch=syncFetch;',c);
  return {c,calls,get refreshes(){return refreshes;},get sess(){return sess;}};
}
const H=at=>({apikey:'k','Content-Type':'application/json',Authorization:'Bearer '+at});
test('401 이면 토큰을 한 번 갱신해 같은 요청을 한 번만 다시 보낸다',async()=>{
  const f=fetchFixture({responses:[401,200]});
  const r=await f.c.syncFetch('library_pull','/x',{headers:H('OLD')});
  assert.equal(r.status,200);assert.equal(f.refreshes,1);
  assert.deepEqual(f.calls.map(x=>x.auth),['Bearer OLD','Bearer NEW']);
  assert.equal(f.c.forceStaleAt,'OLD','서버가 거부한 토큰은 만료 시각이 남아 있어도 갱신 대상');
});
test('쓰기(POST)도 같은 본문으로 한 번 다시 보낸다',async()=>{
  const f=fetchFixture({responses:[401,201]});
  await f.c.syncFetch('kv_push','/x',{method:'POST',headers:H('OLD'),body:'{"a":1}'});
  assert.deepEqual(f.calls.map(x=>[x.method,x.body,x.auth]),[['POST','{"a":1}','Bearer OLD'],['POST','{"a":1}','Bearer NEW']]);
});
test('다시 보내도 401 이면 그대로 돌려준다(끝없이 돌지 않는다)',async()=>{
  const f=fetchFixture({responses:[401,401]});
  const r=await f.c.syncFetch('kv_meta','/x',{headers:H('OLD')});
  assert.equal(r.status,401);assert.equal(f.calls.length,2);assert.equal(f.refreshes,1);
});
test('갱신이 실패하거나 로그아웃되면 다시 보내지 않고 401 을 돌려준다',async()=>{
  for(const o of [{refreshFails:true},{refreshLogout:true}]){
    const f=fetchFixture(Object.assign({responses:[401]},o));
    const r=await f.c.syncFetch('kv_pull','/x',{headers:H('OLD')});
    assert.equal(r.status,401);assert.equal(f.calls.length,1);
  }
});
test('갱신 사이에 계정이 바뀌었으면 다시 보내지 않는다',async()=>{
  const f=fetchFixture({responses:[401,200],switchUid:true});
  const r=await f.c.syncFetch('kv_pull','/x',{headers:H('OLD')});
  assert.equal(r.status,401);assert.equal(f.calls.length,1);
});
test('이미 다른 흐름이 갱신했으면 새로 갱신하지 않고 그 토큰을 쓴다 · 뒤 단계는 옛 토큰을 미리 바꿔 보낸다',async()=>{
  const f=fetchFixture({responses:[401,200,200]});
  await f.c.syncFetch('kv_meta','/a',{headers:H('OLD')});
  await f.c.syncFetch('library_pull','/b',{headers:H('OLD')});
  assert.deepEqual(f.calls.map(x=>x.auth),['Bearer OLD','Bearer NEW','Bearer NEW'],'두 번째 요청은 401 없이 새 토큰으로');
  assert.equal(f.refreshes,1);
});
test('401 이 아니거나 토큰 없는 요청은 건드리지 않는다',async()=>{
  const f=fetchFixture({responses:[403,401]});
  assert.equal((await f.c.syncFetch('kv_push','/x',{headers:H('OLD')})).status,403);
  assert.equal((await f.c.syncFetch('probe','/y',{headers:{apikey:'k'}})).status,401);
  assert.equal(f.refreshes,0);assert.equal(f.calls.length,2);
});

/* ── ③ 메타 조회 한 번 재시도 ── */
const META=slice(S,'var kvWho=true;','/* 키별 마지막 수정자');
function metaFixture(o={}){
  const plan=(o.plan||[]).slice(),calls=[],diags=[];
  const c=vm.createContext({Promise,BASE:'https://x',kvWho:false,hj:at=>({Authorization:'Bearer '+at}),
    navigator:{onLine:o.offline?false:true},document:{visibilityState:o.hidden?'hidden':'visible'},
    setTimeout:(fn)=>{fn();return 0;},syncDiagnostic:s=>diags.push(s),
    syncFetch:(stage,url)=>{calls.push(stage);const step=plan.shift();if(step instanceof Error)return Promise.reject(step);return Promise.resolve({ok:true,status:200});}});
  vm.runInContext(META+';this.kvMetaFetch=kvMetaFetch;',c);
  return {c,calls,diags};
}
const netErr=()=>Object.assign(new TypeError('Failed to fetch'),{psStage:'kv_meta'});
test('메타 조회가 한 번 끊기면(TypeError) 1.5초 뒤 한 번 더 한다',async()=>{
  const f=metaFixture({plan:[netErr(),'ok']});
  const r=await f.c.kvMetaFetch('AT','w1');
  assert.equal(r.ok,true);assert.deepEqual(f.calls,['kv_meta','kv_meta']);assert.deepEqual(f.diags,['kv-meta-retry']);
});
test('두 번 끊기면 두 번째 오류를 올린다(재시도는 한 번뿐)',async()=>{
  const f=metaFixture({plan:[netErr(),netErr()]});
  await assert.rejects(f.c.kvMetaFetch('AT','w1'),TypeError);assert.equal(f.calls.length,2);
});
test('시간 초과·오프라인·숨김이면 다시 보내지 않는다',async()=>{
  const timeout=Object.assign(new Error('timeout'),{psCode:'sync_timeout'});
  let f=metaFixture({plan:[timeout]});await assert.rejects(f.c.kvMetaFetch('AT','w1'),/timeout/);assert.equal(f.calls.length,1);
  f=metaFixture({plan:[netErr()],hidden:true});await assert.rejects(f.c.kvMetaFetch('AT','w1'),TypeError);assert.equal(f.calls.length,1);
  f=metaFixture({plan:[netErr()],offline:true});await assert.rejects(f.c.kvMetaFetch('AT','w1'),TypeError);assert.equal(f.calls.length,1);
});

/* ── ensureToken: 서버가 거부한 토큰은 만료 시각이 남아도 갱신 ── */
test('ensureToken 은 forceStaleAt 과 같은 토큰이면 만료 시각을 믿지 않는다',()=>{
  const body=slice(S,'function ensureToken(){','/* ── 동기화 ── */');
  assert.match(body,/if\(Date\.now\(\)<s\.exp-60000&&!\(forceStaleAt&&s\.at===forceStaleAt\)\) return Promise\.resolve\(s\.at\);/);
});

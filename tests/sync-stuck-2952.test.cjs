'use strict';
/* 2.952 — «8일째 저장 대기 · 2건»이 안 풀리던 것(코치 점검 10/7, 이 맥의 앱 안 브라우저).
   ① 내 IDP: 두 원문 모두 v1 인데 안정 키 없는 배열을 양쪽이 고쳐 자동 병합이 null → 매 회차 조용히 return(출구 없음).
      → 자료 확인(holdConflictRecord, reason 'merge')에 두 원문을 맡기고, 고르면 그 문서로 이어 저장한다.
   ② 지운 선수(묘비)의 기기 사본 sq: 행: 자동으로 올리지 않는 규칙이라 대기함에만 영원히 남았다 → 대기에서 뺀다.
   ③ 이유가 8일 전 회차 실패(«오프라인이에요»)로 남아 있었다 → 확인까지 온 회차는 회차 오류를 지운다. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const sourcePath=path.join(__dirname,'team-data-consistency.test.cjs');
const source=fs.readFileSync(sourcePath,'utf8');
const end=source.indexOf('\nconst pushed=');assert.ok(end>0,'shared harness boundary');
const box={require:createRequire(sourcePath),__dirname,module:{exports:{}},console,URL,setImmediate,Buffer};
vm.runInNewContext(source.slice(0,end)+'\nmodule.exports={harness};',box,{filename:sourcePath});
const {harness}=box.module.exports;
const PRIVATE='cs_idp_v1_player-a';
const raw=JSON.stringify;
const push=h=>h.requests.filter(r=>r.stage.startsWith('kv_push')&&!r.stage.endsWith('_verify'));
const fixture=(key,opts={})=>harness({key,localOnly:true,dynamic:true,...opts});
async function run(h){const r=await h.run();assert.equal(r.error,undefined,JSON.stringify({r,errors:h.errors}));return r;}
/* 안정 키(id·date·at…)가 없는 객체 배열을 양쪽이 다르게 고친다 — 2.744 의 자동 병합이 멈추는 모양 */
const doc=list=>raw({v:1,log:{},imgNotes:[],custom:list});

for(const choice of ['local','server'])test('an unmergeable own IDP goes to data review instead of waiting forever ('+choice+')',async()=>{
  const initial=doc([{t:'기본'}]),mine=doc([{t:'기본'},{t:'이 기기에서 더함'}]),other=doc([{t:'기본'},{t:'다른 기기에서 더함'}]);
  const h=fixture(PRIVATE,{uid:'player-a',server:other,cupd:2,mirror:mine});h.baseline(initial);await h.mark();
  const r=await run(h);
  assert.ok(r.held.includes(PRIVATE),'자료 확인에 올린다');
  const held=h.c.holdList().filter(x=>x.k===PRIVATE);
  assert.equal(held.length,1);assert.equal(held[0].reason,'merge');
  assert.equal(h.local.get(PRIVATE),mine,'어느 쪽도 덮지 않는다');assert.equal(h.server.get(PRIVATE).v,other);assert.equal(push(h).length,0);
  assert.ok(await h.c.holdConflictChoose(PRIVATE,choice==='local',h.c.holdConflictView(held[0])));
  await run(h);
  const expected=choice==='local'?mine:other;
  assert.equal(JSON.parse(h.server.get(PRIVATE).v).custom.length,2);
  assert.deepEqual(JSON.parse(h.server.get(PRIVATE).v).custom,JSON.parse(expected).custom);
  assert.equal(h.queue.length,0,'고른 뒤에는 대기가 풀린다');assert.equal(h.c.holdList().length,0);
});

test('a malformed own IDP still stops without writing either side',async()=>{
  const initial=doc([{t:'기본'}]),mine=raw({v:2,log:{}}),other=doc([{t:'다른 기기'}]);
  const h=fixture(PRIVATE,{uid:'player-a',server:other,cupd:2,mirror:mine});h.baseline(initial);await h.mark();
  await h.run();
  assert.equal(h.local.get(PRIVATE),mine);assert.equal(h.server.get(PRIVATE).v,other);assert.equal(push(h).length,0);
  assert.equal(h.c.holdList().filter(x=>x.reason==='merge').length,0,'형식이 깨진 원문은 고르게 하지 않는다');
});

/* outboxAckSynced 만 잘라 실행 — 저장소·해시만 흉내 */
const SYNC=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function ack(queue,values,deleted,metaH){
  const a=SYNC.indexOf('function outboxAckSynced('),b=SYNC.indexOf('\n/* 개인 자료는 팀 화면에서도',a);assert.ok(a>0&&b>a);
  const c=vm.createContext({Promise,String,JSON,
    ITEMP:'sq:',
    itemsDeletedLive:(k,v)=>{const p=JSON.parse(v);return !p._del&&!!deleted[k.slice(3)];},
    outboxOwner:()=>'coach-a',outboxScope:(u,w)=>u+'|'+w,hash:v=>'h:'+v,syncIssue:(c2)=>Object.assign(new Error(c2),{psCode:c2}),
    currentValueForKey:k=>Promise.resolve(values[k]==null?null:values[k]),
    outboxTxn:fn=>Promise.resolve(fn(queue)).then(q=>{queue.splice(0,queue.length,...q);return q;})});
  vm.runInContext(SYNC.slice(a,b),c);
  return c.outboxAckSynced('team-a',{h:metaH},[],null,()=>true);
}

test('a deleted player remnant leaves the queue; a live player edit stays; stale round errors clear',async()=>{
  const q=[
    {uid:'coach-a',wid:'team-a',key:'sq:gone',roundError:'sync_offline',roundStage:'kv_meta'},
    {uid:'coach-a',wid:'team-a',key:'sq:live',roundError:'sync_offline',roundStage:'kv_meta'},
    {uid:'coach-a',wid:'team-a',key:'scout_tool_v1'}];
  const values={'sq:gone':raw({id:'gone',name:'지운 선수'}),'sq:live':raw({id:'live',name:'새 편집'}),'scout_tool_v1':'same'};
  await ack(q,values,{gone:1},{'scout_tool_v1':'h:same'});
  assert.deepEqual(q.map(x=>x.key),['sq:live'],'지운 선수 사본은 대기에서 빠지고, 확인된 문서도 빠진다');
  assert.equal(q[0].roundError,'','확인까지 온 회차는 옛 «오프라인» 이유를 지운다');
});

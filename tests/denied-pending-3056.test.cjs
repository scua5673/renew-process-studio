'use strict';
/* 3.056 — 앱의 권한 판정(canW)이 거절한 팀 키가 대기함(ps_sync_outbox_v1)에 영원히 남던 것.
   파일럿 집계(2026-10-16): 김포 25 · 풋볼A 16 · 재현중 11대의 구성원 기기가 «24시간 넘은 올릴 것»을 보고 — 거의 다 cs_perms_v1(옛 판의 흔적).
   회차마다 같은 거절을 «다음 회차로 미룸»(deferred)에 넣어 «N일째 저장 대기»(빨강) · 로그아웃 막힘(prelogout 의 deferred) · 관리자 «주의»가 됐다.
   이제 대기함에서만 뺀다. 확인(m.h)은 하지 않으므로 기기 사본은 «서버와 다름»으로 남고, 권한이 생기면 다음 회차에 올라간다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const sourcePath=path.join(__dirname,'team-data-consistency.test.cjs'),source=fs.readFileSync(sourcePath,'utf8');
const end=source.indexOf('\nconst pushed=');assert.ok(end>0,'shared harness boundary');
const box={require:createRequire(sourcePath),__dirname,module:{exports:{}},console,URL,setImmediate,Buffer};
vm.runInNewContext(source.slice(0,end)+'\nmodule.exports={harness,DEFAULT_KEY};',box,{filename:sourcePath});
const {harness,DEFAULT_KEY:K}=box.module.exports;
const raw=JSON.stringify,base=raw({v:1,entries:{a:{good:'A'},b:{good:'B'}}}),mine=raw({v:1,entries:{a:{good:'A'},b:{good:'이 기기에서 고침'}}});
const pushed=h=>h.requests.filter(r=>r.stage.startsWith('kv_push')&&!r.stage.endsWith('_verify'));
const member=opt=>harness({server:base,mirror:mine,idb:mine,role:'staff',teamRole:'member',scopes:[],...opt});

test('a key this account may not write leaves the pending queue but is never confirmed',async()=>{
  const h=member();h.baseline(base);await h.mark();assert.equal(h.queue.length,1);
  const r=await h.run();
  assert.equal(r.error,undefined);assert.equal(r.deferred.length,0,'로그아웃 확인(prelogout)이 막히지 않는다');assert.equal(r.pending,0);
  assert.equal(h.queue.length,0,'«N일째 저장 대기»가 남지 않는다');assert.equal(pushed(h).length,0,'올리지 않는다');
  assert.equal(h.server.get(K).v,base);assert.equal(h.local.get(K),mine,'기기 사본은 그대로');assert.equal(h.c.meta().h[K],h.c.hash(base),'확인하지 않는다');
  const again=await h.run();assert.equal(again.deferred.length,0);assert.equal(h.queue.length,0,'다음 회차에도 다시 쌓이지 않는다');
});

test('when the permission arrives later the device copy is uploaded (nothing is lost)',async()=>{
  const h=member();h.baseline(base);await h.mark();await h.run();assert.equal(h.queue.length,0);
  h.state.role='executive';h.state.teamRole='owner';
  const r=await h.run();assert.equal(r.error,undefined);
  assert.equal(h.server.get(K).v,mine,'권한이 생긴 회차에 그 사본이 올라간다');assert.equal(h.c.meta().h[K],h.c.hash(mine));
});

test('an unreadable permissions document is temporary: the key stays pending as before',async()=>{
  const h=member({role:'missing'});h.baseline(base);await h.mark();
  const r=await h.run();
  assert.equal(pushed(h).length,0);assert.equal(h.queue.length,1,'권한 문서를 못 읽은 회차는 대기에 남긴다');assert.ok(r.deferred.includes(K)||r.pending>=1);
});

test('a queued key with no device copy and no confirmed hash has nothing to send',async()=>{
  const SYNC=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
  const a=SYNC.indexOf('function outboxAckSynced('),b=SYNC.indexOf('\n/* 개인 자료는 팀 화면에서도',a);assert.ok(a>0&&b>a);
  const queue=[{id:'u|w|blind',uid:'u',wid:'w',key:'blind',at:1,updatedAt:Date.now()},{id:'u|w|gone',uid:'u',wid:'w',key:'gone',at:1,updatedAt:Date.now()},{id:'u|w|denied',uid:'u',wid:'w',key:'denied',at:1,updatedAt:Date.now()},{id:'u|w|held',uid:'u',wid:'w',key:'held',at:1,updatedAt:Date.now()}];
  const values={denied:'x',held:'y'};
  const c=vm.createContext({Promise,String,JSON,outboxOwner:()=>'u',outboxScope:(u,w)=>u+'|'+w,hash:v=>v==null?'':'h:'+v,syncIssue:x=>Error(x),
    currentValueForKey:k=>Promise.resolve(values[k]==null?null:values[k]),outboxTxn:fn=>Promise.resolve(fn(queue)).then(q=>{queue.splice(0,queue.length,...q);return q;})});
  vm.runInContext(SYNC.slice(a,b),c);
  await c.outboxAckSynced('w',{h:{gone:'h:old'}},['held'],null,null,['denied','held']);
  assert.deepEqual(queue.map(x=>x.key).sort(),['gone','held'],'blind(사본 · 해시 없음)와 denied 는 빠지고, 지울 것이 남은 gone 과 보류 held 는 남는다');
});

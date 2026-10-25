const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.071 — 폰 · 아이패드는 보관함 본문을 조금씩 받는다.
   10/17 운영자 아이폰 · 아이패드(팀 보관함 149개 33MB): 보관함 받기가 본문을 20개씩 받아 회차 끝에 한 번에 저장해,
   중간에 메모리가 넘쳐 죽으면 아무것도 남지 않고 다음 부팅이 처음부터 다시 받았다(앱을 열면 5초 안에 강제 종료 반복). */
const sync=fs.readFileSync(path.join(__dirname,'..','studio','sync.js'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const PURE=cut(sync,'/* ── 3.071 · 보관함 받기 묶음 순수 구간 시작','/* ── 3.071 · 보관함 받기 묶음 순수 구간 끝 ── */');
function pure(){ const c=vm.createContext({}); vm.runInContext(PURE+';this.api={libPullCapFor};',c); return c.api; }
const PULL=cut(sync,'    var deferred=0;','\n    function keepConflicts(){');

/* pullAll 을 떼어 내 가짜 서버로 돌린다 — 요청마다 받은 본문 크기와 미룬 수를 본다 */
function runPull(dev,items){
  const calls=[],crumbs=[];
  const ctx=vm.createContext({
    pullIds:items.map(x=>x.id),wid:'W',at:'T',BASE:'https://x',locMap:{},order:[],m:{li:{}},applied:0,libPriv:false,
    libSelCols:b=>b,hj:()=>({}),syncHttpError:(s,c)=>new Error(s+':'+c),libBlobHydrate:()=>Promise.resolve(''),
    srvPrivate:()=>false,libUid:()=>'U',libDietItem:()=>0,libHash:()=>'h',
    libPullCap:()=>pure().libPullCapFor(dev),libCrumb:c=>crumbs.push(c),
    syncFetch:(stage,url)=>{ const ids=decodeURIComponent(url.split('lib_id=in.(')[1]).replace(/\)$/,'').replace(/"/g,'').split(',');
      calls.push(ids); const rows=ids.map(id=>{ const it=items.find(x=>x.id===id); return {lib_id:id,saved_at:1,item:{pad:'x'.repeat(it.bytes)}}; });
      const body=JSON.stringify(rows); return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve(body)}); },
  });
  vm.runInContext(PULL+'\nthis.go=function(){ return pullAll().then(function(){ return {deferred:deferred,applied:applied,ids:Object.keys(locMap)}; }); };',ctx);
  return ctx.go().then(r=>Object.assign(r,{calls,crumbs}));
}
const big=(n,bytes)=>Array.from({length:n},(_,i)=>({id:'L'+i,bytes}));

test('desktops keep the old shape — twenty per request, no limit per round',()=>{
  const g=pure();
  assert.deepEqual(JSON.parse(JSON.stringify(g.libPullCapFor('desktop'))),{chunk:20,budget:0});
  assert.deepEqual(JSON.parse(JSON.stringify(g.libPullCapFor(''))),{chunk:20,budget:0});
  for(const d of ['phone','ipad'])assert.deepEqual(JSON.parse(JSON.stringify(g.libPullCapFor(d))),{chunk:2,budget:6e6},d);
});

test('a phone stops pulling once the round has taken the budget, and leaves the rest for the next round',async()=>{
  const r=await runPull('phone',big(40,1e6));   /* 40 × 1MB — the operator's library shape */
  assert.ok(r.calls.every(c=>c.length<=2),'two per request');
  assert.equal(r.applied,6,'stops after the request that crosses 6MB');
  assert.equal(r.deferred,34);
  assert.equal(r.applied+r.deferred,40,'nothing is lost — every item is either applied or deferred');
  assert.deepEqual(r.crumbs,['lb0','lb2','lb4'],'leaves a footprint before each request');
});

test('small libraries still finish in one round on a phone',async()=>{
  const r=await runPull('ipad',big(30,2e4));
  assert.equal(r.applied,30); assert.equal(r.deferred,0); assert.equal(r.calls.length,15);
});

test('a desktop pulls everything in one round, twenty at a time',async()=>{
  const r=await runPull('desktop',big(45,1e6));
  assert.equal(r.applied,45); assert.equal(r.deferred,0); assert.deepEqual(r.calls.map(c=>c.length),[20,20,5]);
});

test('a round that deferred anything is not remembered as «nothing changed»',()=>{
  const stage=cut(sync,'function syncLibrary(at,m,now,wid,ownerGuard){','\nfunction _syncLibrary(');
  assert.match(stage,/if\(sig&&res&&!res\.pushed&&!res\.applied&&!res\.deferred\) m\.ls=\{sig:sig,rev:rev2,tomb:tombN\}; else m\.ls=null;/,
    'otherwise the next round would skip the library stage and the deferred items would never arrive');
  assert.match(sync,/libCrumb\('lbok'\);return \{applied:applied,pushed:pushedOk,ackHash:hash\(libAckRev\),deferred:deferred\};/);
});

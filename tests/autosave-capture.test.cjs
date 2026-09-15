'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const J=require('../studio/autosave-journal.js');
const R=require('../studio/autosave-runtime.js');
const KEY='scout_tool_v1';
const A=' {"players":[{"id":"p1","memo":"exact old ancestor"}],"meta":{}}\n';
const B='{"players":[{"id":"p1","memo":"middle ancestor"}],"meta":{}}';
const C='{"players":[{"id":"p1","memo":"newer server baseline"}],"meta":{}}';
const D='{"players":[{"id":"p1","memo":"unsent edit"}],"meta":{}}';
const CTX={uid:'synthetic-user',wid:'synthetic-team',seal:'synthetic-seal',epoch:1};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function gate(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function fixture(options={}){
  let owner={...CTX},local=A,meta={h:J.hash(A),c:1},coreCalls=0,applyCalls=0;
  const data=new Map(),hooks={},calls=[],queue=[{key:KEY,raw:D}],failures=[];
  const hash=options.hash||J.hash;
  const storage={
    async get(k){calls.push(['get',k]);if(hooks.get)await hooks.get(k);return data.has(k)?{value:data.get(k)}:null;},
    async set(k,v,current){calls.push(['set',k]);if(current)current();if(hooks.set)await hooks.set(k,v);if(current)current();data.set(k,v);return true;},
    async replaceIfValue(k,expected,value,current){
      calls.push(['cas',k,expected]);if(hooks.cas)await hooks.cas(k,value);if(current)current();
      if(hooks.noop)return false;
      if((data.has(k)?data.get(k):null)!==expected)return false;
      data.set(k,hooks.rewrite?hooks.rewrite(value):value);
      if(hooks.afterCas)await hooks.afterCas(k,value);return true;
    },
    async keys(p){return [...data.keys()].filter(k=>k.startsWith(p));}
  };
  const journal=()=>J.create({storage,context:()=>owner,hash});let j=journal();
  const opts={context:()=>owner,hash,read:async()=>local,version:()=>({...meta}),
    confirmed:()=>[{k:KEY,wid:CTX.wid,h:meta.h,c:meta.c}],journal:()=>j,
    core:async()=>{coreCalls++;return hooks.core?hooks.core():{pending:1};},
    pending:()=>[],reviewCurrent:()=>true,plan:()=>({raw:B,needsArchive:false}),
    remote:async()=>[{k:KEY,v:B,cupd:2}],apply:async()=>{applyCalls++;return true;},
    fail:e=>{failures.push(e.name);return {error:e.name};},notify:()=>{}};
  return {data,hooks,calls,queue,failures,storage,ctx:{...CTX},options:opts,
    get j(){return j;},get coreCalls(){return coreCalls;},get applyCalls(){return applyCalls;},
    get local(){return local;},get meta(){return meta;},
    setLocal(v){local=v;},setMeta(v){meta={...v};},change(v){owner=v===null?null:{...owner,...v};},
    reload(){j=journal();return R.create(opts);},run(){return R.create(opts).run('fixture');},
    async seed(){for(const [raw,c] of [[A,1],[B,2],[C,3]])await j.remember(CTX,KEY,raw,hash(raw),c);},
    baseline(){return [...data.entries()].find(([k])=>k.includes(':base:'));},
    captured(){return [...data.entries()].filter(([k])=>k.includes(':captured:'));}
  };
}

test('older than both journal slots reaches core after preserving the exact ancestor without touching original baseline, draft, meta or outbox',async()=>{
  const f=fixture();await f.seed();const baseline=f.baseline(),meta={...f.meta},queue=JSON.stringify(f.queue);
  const result=await f.run();assert.equal(result.error,undefined);assert.equal(result.pending,1);assert.equal(result.complete,undefined);
  assert.equal(f.coreCalls,1);assert.deepEqual(f.baseline(),baseline);assert.equal(f.local,A);assert.deepEqual(f.meta,meta);assert.equal(JSON.stringify(f.queue),queue);
  assert.equal(f.captured().length,1);assert.equal(JSON.parse(f.captured()[0][1]).entry.raw,A);
  assert.equal(await f.j.base(CTX,KEY,J.hash(A),1),A);assert.equal(await f.j.base(CTX,KEY),C);
});
test('same cupd different raw is retained as an exact ancestor while remote remember still rejects it',async()=>{
  const f=fixture();await f.j.remember(CTX,KEY,C,J.hash(C),1);const baseline=f.baseline();
  await assert.rejects(f.j.remember(CTX,KEY,A,J.hash(A),1),{name:'AutosaveJournalVersionError'});
  assert.equal((await f.run()).error,undefined);assert.deepEqual(f.baseline(),baseline);
  assert.equal(await f.j.base(CTX,KEY,J.hash(A),1),A);assert.equal(await f.j.base(CTX,KEY,J.hash(C),1),C);
});
test('reload finds only the exact persisted capture and does not write a second copy',async()=>{
  const f=fixture();await f.seed();await f.run();const before=[...f.data],writes=f.calls.filter(c=>c[0]==='cas').length;
  const r=f.reload();assert.equal(await f.j.base(CTX,KEY,J.hash(A),1),A);await r.run('reload');
  assert.deepEqual([...f.data],before);assert.equal(f.calls.filter(c=>c[0]==='cas').length,writes);assert.equal(f.coreCalls,2);
});
test('missing hash, missing cupd and unmatched versions never select an arbitrary captured ancestor',async()=>{
  const f=fixture();await f.seed();await f.run();
  assert.equal(await f.j.base(CTX,KEY,'',1),C);assert.equal(await f.j.base(CTX,KEY,J.hash(A)),null);
  assert.equal(await f.j.base(CTX,KEY,J.hash(A),2),null);assert.equal(await f.j.base(CTX,KEY,'unknown',1),null);
  f.data.delete(f.baseline()[0]);assert.equal(await f.j.base(CTX,KEY),null);
  assert.equal(await f.j.base(CTX,KEY,J.hash(A),1),A);
});
test('capture result cannot turn a failed core or an unacknowledged pending write into saved',async()=>{
  const f=fixture();await f.seed();f.hooks.core=()=>({error:'network failed',code:'sync_network',pending:1});
  const r=await f.run();assert.equal(r.error,'network failed');assert.equal(r.pending,1);assert.equal(r.complete,undefined);assert.equal(f.queue.length,1);
});
test('dirty local input is not captured or relabelled as a confirmed ancestor',async()=>{
  const f=fixture();await f.seed();f.setLocal(D);const before=[...f.data],meta={...f.meta};
  const result=await f.run();assert.equal(result.error,undefined);assert.equal(f.coreCalls,1);
  assert.deepEqual([...f.data],before);assert.equal(f.local,D);assert.deepEqual(f.meta,meta);assert.equal(f.queue.length,1);
});
test('a core-time edit is not captured after the round under the old meta hash',async()=>{
  const f=fixture();await f.seed();f.hooks.core=()=>{f.setLocal(D);return {pending:1};};await f.run();
  assert.equal(f.local,D);assert.equal(f.captured().length,1);assert.equal(JSON.parse(f.captured()[0][1]).entry.raw,A);
});
test('remote reconciliation retains strict version rejection and does not apply an older server baseline',async()=>{
  const f=fixture();await f.seed();f.setLocal(D);f.options.pending=()=>[{wid:CTX.wid,k:KEY,h:J.hash(D)}];
  f.options.remote=async()=>[{k:KEY,v:A,cupd:1}];f.options.plan=()=>({raw:A,needsArchive:false});
  const before=[...f.data],result=await f.run();assert.equal(result.error,'AutosaveJournalVersionError');assert.equal(f.coreCalls,1);assert.equal(f.applyCalls,0);
  assert.deepEqual([...f.data],before);assert.equal(f.local,D);assert.equal(f.queue.length,1);
});
for(const mode of ['reject','noop','rewrite','readback'])test(`capture ${mode} failure blocks core and preserves old raw and pending intent`,async()=>{
  const f=fixture();await f.seed();const baseline=f.baseline(),meta={...f.meta};
  if(mode==='reject')f.hooks.cas=()=>{throw Error('quota failure');};
  if(mode==='noop')f.hooks.noop=true;
  if(mode==='rewrite')f.hooks.rewrite=v=>v+' ';
  if(mode==='readback')f.hooks.afterCas=()=>{f.hooks.get=k=>{if(k.includes(':captured:'))throw Error('read failed');};};
  const r=await f.run();assert.ok(r.error);assert.equal(f.coreCalls,0);assert.deepEqual(f.baseline(),baseline);assert.equal(f.local,A);assert.deepEqual(f.meta,meta);assert.equal(f.queue.length,1);
});
test('storage without atomic absent-only CAS does not fall back to overwriting a slot',async()=>{
  const f=fixture();await f.seed();delete f.storage.replaceIfValue;const before=[...f.data];
  assert.equal((await f.run()).error,'AutosaveJournalVerificationError');assert.equal(f.coreCalls,0);assert.deepEqual([...f.data],before);
});
test('a second tab filling the exact slot makes a losing CAS idempotently successful',async()=>{
  const f=fixture();await f.seed();f.hooks.cas=(k,v)=>f.data.set(k,v);
  assert.equal((await f.run()).error,undefined);assert.equal(f.coreCalls,1);assert.equal(f.captured().length,1);
  assert.equal(await f.j.base(CTX,KEY,J.hash(A),1),A);
});
test('a second tab occupying the same slot with a different body is never overwritten, even on a hash collision',async()=>{
  const f=fixture({hash:()=> 'synthetic-collision'});f.setMeta({h:'synthetic-collision',c:1});await f.seed();
  f.hooks.cas=(k,v)=>{const other=JSON.parse(v);other.entry.raw=D;f.data.set(k,JSON.stringify(other));};const baseline=f.baseline();
  const r=await f.run();assert.equal(r.error,'AutosaveJournalCollisionError');assert.equal(f.coreCalls,0);assert.deepEqual(f.baseline(),baseline);
  assert.equal(JSON.parse(f.captured()[0][1]).entry.raw,D);
});
for(const c of [2,3])test(`a hash collision with existing ${c===3?'current':'previous'} baseline cannot create an ambiguous captured slot`,async()=>{
  const f=fixture({hash:()=> 'synthetic-collision'});await f.seed();f.setMeta({h:'synthetic-collision',c});const before=[...f.data];
  const result=await f.run();assert.equal(result.error,'AutosaveJournalCollisionError');assert.equal(f.coreCalls,0);assert.deepEqual([...f.data],before);
});
for(const point of ['before','after'])test(`owner change ${point} immutable CAS prevents old-account completion and core execution`,async()=>{
  const f=fixture();await f.seed();const wait=gate();f.hooks[point==='before'?'cas':'afterCas']=()=>wait.promise;
  const pending=f.run();await tick();f.change({uid:'new-account',seal:'new-seal'});wait.resolve();
  assert.equal((await pending).error,'AutosaveJournalOwnerError');assert.equal(f.coreCalls,0);assert.equal(f.captured().length,point==='before'?0:1);
  assert.equal(await f.j.base({uid:'new-account',wid:CTX.wid,seal:'new-seal',epoch:1},KEY,J.hash(A),1),null);
});
test('captured lookup rechecks ownership after the read and rejects copied foreign entries',async()=>{
  const f=fixture();await f.seed();await f.run();const saved=f.captured()[0],wait=gate();f.hooks.get=k=>k===saved[0]?wait.promise:undefined;
  const pending=f.j.base(CTX,KEY,J.hash(A),1);await tick();f.change({seal:'changed'});wait.resolve();await assert.rejects(pending,{name:'AutosaveJournalOwnerError'});
  delete f.hooks.get;f.change({uid:'new-account'});const ctx={uid:'new-account',wid:CTX.wid,seal:'changed',epoch:1};
  f.data.set(saved[0].replace(CTX.uid,'new-account'),saved[1]);await assert.rejects(f.j.base(ctx,KEY,J.hash(A),1),{name:'AutosaveJournalCorruptError'});
});
test('corrupt primary journal and invalid capture versions remain fatal rather than being skipped',async()=>{
  const f=fixture();await f.seed();f.data.set(f.baseline()[0],'{broken');assert.equal((await f.run()).error,'AutosaveJournalCorruptError');assert.equal(f.coreCalls,0);
  for(const c of [NaN,Infinity,-1,'1',null])await assert.rejects(f.j.capture(CTX,KEY,A,J.hash(A),c));
});

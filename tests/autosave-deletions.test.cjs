'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('../studio/autosave-merge.js');
const J=require('../studio/autosave-journal.js');
const R=require('../studio/autosave-runtime.js');
const sync=fs.readFileSync(require.resolve('../studio/sync.js'),'utf8');
const scout=fs.readFileSync(require.resolve('../studio/scout.html'),'utf8');
const PD='cs_player_del_v1',MD='cs_match_del_v1';
function fn(source,name){const a=source.indexOf('function '+name+'('),b=source.indexOf('\nfunction ',a+1);assert.ok(a>=0&&b>a,'extract '+name);return source.slice(a,b);}
function fixture(initial='{}'){
  let tombRaw=initial;
  const c=vm.createContext({MATCH_DEL_KEY:MD,SCHEDULE_KEY:'process_coach_v1',ITEMP:'sq:',PDKEY:PD,
    isItemKey:k=>k.startsWith('sq:'),isIdpPrivateKey:()=>false,isIdpPubKey:()=>false,
    localStorage:{getItem:k=>k===PD?tombRaw:null},store:{get:k=>k===PD?JSON.parse(tombRaw):null}
  });
  vm.runInContext(['autosavePrepare','itemsDeletedLive'].map(n=>fn(sync,n)).concat(['plTombs','plTombApply'].map(n=>fn(scout,n))).join('\n'),c);
  return {c,set:raw=>{tombRaw=raw;},prepare(key,local,remote,base=null,kind='conflict'){
    const plan=M.plan({key,local,remote,base});return c.autosavePrepare({k:key,channel:'team',kind},plan,base,local,{k:key,v:remote,cupd:2});
  }};
}

for(const key of [PD,MD])test(`${key}: unknown-base server fallback never drops positive local deletion markers`,()=>{
  const f=fixture(),local=' {"p":123} \n',remote='{}',plan=f.prepare(key,local,remote);
  assert.deepEqual(JSON.parse(plan.raw),{p:123});assert.equal(plan.needsArchive,true);assert.equal(plan.reason,'deletion-markers-preserved');
});
test('the reported actual player-filter revival remains closed after applying the reconciled deletion map',()=>{
  const f=fixture('{"p":123}'),player={id:'p',name:'Synthetic retained deletion'},live=JSON.stringify(player);
  assert.equal(f.c.plTombApply([player]).length,0);assert.equal(f.c.itemsDeletedLive('sq:p',live),true);
  const plan=f.prepare(PD,'{"p":123}','{}');f.set(plan.raw);
  assert.equal(f.c.plTombApply([player]).length,0);assert.equal(f.c.itemsDeletedLive('sq:p',live),true);
});
for(const key of [PD,MD])test(`${key}: independent deletions and timestamp conflicts keep every marker and the latest time`,()=>{
  const f=fixture(),plan=f.prepare(key,'{"local":50,"both":100}','{"remote":80,"both":90}','{"both":90}');
  assert.deepEqual(JSON.parse(plan.raw),{remote:80,both:100,local:50});assert.equal(plan.needsArchive,true);
  const swapped=f.prepare(key,'{"both":90,"local":50}','{"both":100,"remote":80}','{"both":90}');
  assert.deepEqual(JSON.parse(swapped.raw),{both:100,remote:80,local:50});
});
for(const key of [PD,MD])test(`${key}: legacy bulk holds use deletion preservation before generic server-wins handling`,()=>{
  const f=fixture(),plan=f.prepare(key,'{"p":100}','{}',null,undefined);
  // Invoke the actual legacy record shape (no kind property) explicitly.
  const legacy=f.c.autosavePrepare({k:key,channel:'team'},M.plan({base:null,local:'{"p":100}',remote:'{}'}),null,'{"p":100}',{v:'{}',cupd:2});
  assert.deepEqual(JSON.parse(plan.raw),{p:100});assert.deepEqual(JSON.parse(legacy.raw),{p:100});assert.equal(legacy.needsArchive,true);
});
for(const key of [PD,MD])test(`${key}: identical maps are idempotent and do not create redundant conflict originals`,()=>{
  const f=fixture(),raw='{"p":12,"q":34}',plan=f.prepare(key,raw,raw,raw);
  assert.equal(plan.raw,raw);assert.equal(plan.needsArchive,false);
  const again=f.prepare(key,plan.raw,raw,raw);assert.equal(again.raw,raw);assert.equal(again.needsArchive,false);
});
for(const key of [PD,MD])test(`${key}: malformed map shapes and invalid timestamps cannot be applied`,()=>{
  const f=fixture();
  for(const raw of ['{','null','[]','true','1','"text"','{"p":0}','{"p":-1}','{"p":"123"}','{"p":null}','{"p":{}}','{"":123}','{"p":1e400}']){
    assert.equal(f.prepare(key,raw,'{}'),null,'invalid local '+raw);
    assert.equal(f.prepare(key,'{}',raw),null,'invalid remote '+raw);
  }
});
test('deletion merge never mutates the supplied snapshots or prototypes',()=>{
  const f=fixture(),local=' {"p":12} ',remote=' {"q":34} ',before={local,remote};
  f.prepare(PD,local,remote);assert.deepEqual({local,remote},before);assert.equal(Object.prototype.polluted,undefined);
  assert.equal(f.prepare(PD,'{}','{"__proto__":123}'),null);
});

function runtimeFixture(failArchive=false){
  const localOriginal=' {"p":123,"local":456} \n',remoteOriginal=' {"remote":789} ',f=fixture(localOriginal);
  const ctx={uid:'synthetic-owner',wid:'synthetic-team',seal:'same-owner',epoch:1},saved=new Map(),events=[];
  let local=localOriginal,applied=0,reviewed=true;
  const journal=J.create({context:()=>ctx,randomUUID:()=> '00000000-0000-4000-8000-000000000001',storage:{
    async get(k){events.push('read');return saved.has(k)?{value:saved.get(k)}:null;},
    async set(k,v,current){current();events.push('write');if(failArchive&&k.includes(':archive:'))throw Error('synthetic quota failure');saved.set(k,v);return true;},
    async keys(){return [...saved.keys()];}
  }});
  const review={k:PD,wid:ctx.wid,channel:'team',kind:'conflict',h:J.hash(localOriginal)};
  const runtime=R.create({context:()=>ctx,hash:J.hash,read:async()=>local,version:()=>({h:'',c:0}),confirmed:()=>[],journal:()=>journal,
    pending:()=>reviewed?[review]:[],reviewCurrent:()=>reviewed,remote:async()=>[{k:PD,v:remoteOriginal,cupd:2}],plan:M.plan,
    prepare:(...args)=>f.c.autosavePrepare(...args),
    async apply(_r,expected,candidate){
      assert.equal(local,expected);const archive=[...saved.values()].map(JSON.parse).find(r=>r.kind==='archive');
      assert.equal(archive.localRaw,localOriginal);assert.equal(archive.remoteRaw,remoteOriginal);
      assert.ok(events.filter(e=>e==='read').length>=2,'archive was read back before apply');
      local=candidate;f.set(local);reviewed=false;applied++;events.push('apply');return true;
    },core:async()=>({}),fail:e=>({error:e.message})
  });
  return {runtime,events,get local(){return local;},get applied(){return applied;},localOriginal,remoteOriginal,saved,f};
}
test('actual runtime archives both exact originals before applying the deletion-preserving candidate',async()=>{
  const h=runtimeFixture(),result=await h.runtime.reconcile();
  assert.deepEqual(result,{changed:1,archived:1});assert.equal(h.applied,1);
  assert.deepEqual(JSON.parse(h.local),{remote:789,p:123,local:456});assert.equal(h.f.c.plTombApply([{id:'p'}]).length,0);
  const original=[...h.saved.values()].map(JSON.parse).find(r=>r.kind==='archive');
  assert.equal(original.localRaw,h.localOriginal);assert.equal(original.remoteRaw,h.remoteOriginal);
});
test('archive failure leaves the original deletion filter intact and never applies or acknowledges a replacement',async()=>{
  const h=runtimeFixture(true);await assert.rejects(h.runtime.reconcile(),/synthetic quota failure/);
  assert.equal(h.applied,0);assert.equal(h.local,h.localOriginal);assert.equal(h.saved.size,0);
  assert.equal(h.f.c.plTombApply([{id:'p'}]).length,0);assert.equal(h.events.includes('apply'),false);
});

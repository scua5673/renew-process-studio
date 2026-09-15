'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sync=fs.readFileSync(require.resolve('../studio/sync.js'),'utf8');
const storage=fs.readFileSync(require.resolve('../studio/storage.js'),'utf8');
function section(source,from,to){const a=source.indexOf(from),b=source.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,from);return source.slice(a,b);}
const code=section(sync,'function wipeTeamCacheSoft(){','function cacheWipedFlag(){')+'\n'+
  section(sync,'function holdConflictContext(){','function holdConflictSame(')+'\n'+
  section(storage,'  function idbDelIfValue(','  /* 늦게 끝난 이전 워크스페이스')+'\n'+
  section(storage,'  function afterMigrate(fn)','\n\n  window.storage=')+'\n'+
  'window.storage={'+storage.match(/^    delIfValue:function[^\n]+/m)[0]+'};';
const KEY='scout_tool_v1',OWNER='ps_cache_owner_v1';
const clean=JSON.stringify({players:[{id:'p',status:'ok'}],meta:{participationDays:{'2026-09-14':{p:{s:'ok',kind:'train',at:1}}}}});
const edited=JSON.stringify({players:[{id:'p',status:'injury'}],meta:{participationDays:{'2026-09-14':{p:{s:'ok',kind:'train',at:1}},'2026-09-15':{p:{s:'injury',kind:'train',at:2}}}}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function gate(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function harness(){
  const local=new Map([[KEY,clean],[OWNER,'owner-A']]),disk=new Map([[KEY,clean]]),deletes=[],diagnostics=[],jobs=[],baseWrites=[];
  const state={uid:'A',wid:'team-A',epoch:'one',guard:'',unlocked:true,pending:0,meta:{h:{[KEY]:clean},c:{[KEY]:1},r:{keep:1}},base:clean};
  const hooks={};
  const c={Promise,Date,Error,STORE:'kv',OWNERKEY:OWNER,CACHE_WIPE:true,CACHE_FLAG:'wiped',MATCH_KEY:'matches',signOutEpoch:0,migrated:Promise.resolve(),
    getSess:()=>state.uid?{uid:state.uid}:null,activeWs:()=>state.wid,dataUnlocked:()=>state.unlocked,
    workspaceSwitchEpochRaw:()=>state.epoch,workspaceSwitchGuardRaw:()=>state.guard,wipeAllowedNow:()=>true,
    pendingInfo:()=>({count:state.pending}),hash:v=>v,teamCacheKeys:()=>[KEY],idbBacked:()=>true,
    meta:()=>structuredClone(state.meta),setMeta:m=>{state.meta=m;},syncBaseSet:(...args)=>baseWrites.push(args),
    syncIssue:(code,stage,message)=>Object.assign(Error(message),{code,stage}),syncDiagnostic:(stage,e)=>diagnostics.push([stage,e.message]),
    localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)},
    async open(){if(hooks.open)await hooks.open();if(hooks.fail)throw Error('IDB unavailable');return {transaction(){
      let aborted=false;const queued=[];
      const t={error:null,abort(){aborted=true;setImmediate(()=>t.onabort&&t.onabort());},objectStore:()=>({
        get(k){const req={};setImmediate(async()=>{
          req.result=disk.get(k);if(hooks.read)await hooks.read();
          if(req.onsuccess)req.onsuccess();if(!aborted){queued.forEach(f=>f());if(t.oncomplete)t.oncomplete();}
        });return req;},
        delete(k){queued.push(()=>{disk.delete(k);deletes.push(k);});}
      })};return t;
    }};}
  };
  c.window=c;vm.createContext(c);vm.runInContext(code,c);
  const real=c.storage.delIfValue;c.storage.delIfValue=(...args)=>{const p=real(...args);jobs.push(p);return p;};
  return {c,state,local,disk,deletes,diagnostics,baseWrites,hooks,
    async settle(){await Promise.allSettled(jobs);await tick();},
    change(mode){if(mode==='account'){state.uid='B';state.wid='team-B';local.set(OWNER,'owner-B');}
      if(mode==='same-uid-team'){state.wid='team-B';local.set(OWNER,'owner-B');}
      if(mode==='seal')local.set(OWNER,'new-seal');if(mode==='epoch')state.epoch='two';if(mode==='guard')state.guard='switching';
      if(mode==='logout')state.uid='';if(mode==='A-B-A'){state.epoch='three';c.signOutEpoch++;}}
  };
}

test('normal acknowledged team cache is removed without deleting confirmed merge ancestors or metadata',async()=>{
  const h=harness(),before=structuredClone(h.state.meta);assert.equal(h.c.wipeTeamCacheSoft(),1);await h.settle();
  assert.equal(h.local.has(KEY),false);assert.equal(h.disk.has(KEY),false);assert.deepEqual(h.deletes,[KEY]);
  assert.equal(h.local.has('wiped'),true);assert.equal(h.state.base,clean);assert.deepEqual(h.baseWrites,[]);assert.deepEqual(h.state.meta,before);assert.deepEqual(h.diagnostics,[]);
});

for(const boundary of ['migration','open','atomic read'])test('new participation saved during delayed '+boundary+' survives the closing tab cleanup',async()=>{
  const h=harness(),g=gate();if(boundary==='migration')h.c.migrated=g.promise;if(boundary==='open')h.hooks.open=()=>g.promise;if(boundary==='atomic read')h.hooks.read=()=>g.promise;
  h.c.wipeTeamCacheSoft();await tick();h.local.set(KEY,edited);h.disk.set(KEY,edited);g.resolve();await h.settle();
  assert.equal(h.local.get(KEY),edited);assert.equal(h.disk.get(KEY),edited);assert.deepEqual(h.deletes,[]);assert.deepEqual(h.baseWrites,[]);
});

for(const change of ['account','same-uid-team','seal','epoch','guard','logout','A-B-A'])test('identical raw under changed '+change+' is never deleted at the atomic read boundary',async()=>{
  const h=harness(),g=gate();h.hooks.read=()=>g.promise;h.c.wipeTeamCacheSoft();await tick();h.change(change);g.resolve();await h.settle();
  assert.equal(h.disk.get(KEY),clean);assert.deepEqual(h.deletes,[]);assert.deepEqual(h.baseWrites,[]);
});

test('same-owner identical local mirror reappearance cancels a pending delete',async()=>{
  const h=harness(),g=gate();h.hooks.open=()=>g.promise;h.c.wipeTeamCacheSoft();await tick();h.local.set(KEY,clean);g.resolve();await h.settle();
  assert.equal(h.local.get(KEY),clean);assert.equal(h.disk.get(KEY),clean);assert.deepEqual(h.deletes,[]);
});

test('a newer IDB-only raw survives exact-value comparison even without a local mirror',async()=>{
  const h=harness(),g=gate();h.hooks.open=()=>g.promise;h.c.wipeTeamCacheSoft();await tick();h.disk.set(KEY,edited);g.resolve();await h.settle();
  assert.equal(h.disk.get(KEY),edited);assert.deepEqual(h.deletes,[]);assert.deepEqual(h.diagnostics,[]);
});

test('new pending work cancels delayed cleanup even before its local mirror is published',async()=>{
  const h=harness(),g=gate();h.hooks.open=()=>g.promise;h.c.wipeTeamCacheSoft();h.state.pending=1;g.resolve();await h.settle();assert.equal(h.disk.get(KEY),clean);assert.deepEqual(h.deletes,[]);
});

test('dirty or pending team drafts are never scheduled for cleanup',async()=>{
  for(const mode of ['dirty','pending']){const h=harness();if(mode==='dirty')h.local.set(KEY,edited);else h.state.pending=1;
    assert.equal(h.c.wipeTeamCacheSoft(),0);await h.settle();assert.equal(h.local.get(KEY),mode==='dirty'?edited:clean);assert.equal(h.disk.get(KEY),clean);assert.deepEqual(h.deletes,[]);assert.deepEqual(h.baseWrites,[]);}
});

test('unavailable conditional-delete API preserves both local copies',async()=>{
  const h=harness();delete h.c.storage.delIfValue;assert.equal(h.c.wipeTeamCacheSoft(),0);assert.equal(h.local.get(KEY),clean);assert.equal(h.disk.get(KEY),clean);
});

test('IDB failure leaves the durable copy and merge base and handles its rejection',async()=>{
  const h=harness();h.hooks.fail=true;h.c.wipeTeamCacheSoft();await h.settle();assert.equal(h.disk.get(KEY),clean);assert.equal(h.state.base,clean);assert.deepEqual(h.baseWrites,[]);assert.equal(h.diagnostics.length,1);
});

test('a newer confirmed baseline and metadata survive while the earlier cache delete waits',async()=>{
  const h=harness(),g=gate();h.hooks.open=()=>g.promise;h.c.wipeTeamCacheSoft();h.state.base=edited;h.state.meta.h[KEY]=edited;h.state.meta.c[KEY]=2;h.local.set(KEY,edited);h.disk.set(KEY,edited);g.resolve();await h.settle();
  assert.equal(h.state.base,edited);assert.equal(h.state.meta.h[KEY],edited);assert.equal(h.state.meta.c[KEY],2);assert.deepEqual(h.baseWrites,[]);assert.deepEqual(h.deletes,[]);
});

test('existing two-argument conditional deletion remains compatible',async()=>{
  const h=harness();assert.equal(await h.c.storage.delIfValue(KEY,'other'),false);assert.equal(h.disk.get(KEY),clean);
  assert.equal(await h.c.storage.delIfValue(KEY,clean),true);assert.equal(h.disk.has(KEY),false);
});

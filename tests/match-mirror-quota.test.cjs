'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const fixture=path.join(__dirname,'team-data-consistency.test.cjs'),fixtureSource=fs.readFileSync(fixture,'utf8');
const declarations=fixtureSource.slice(0,fixtureSource.indexOf('\nconst pushed='));
const {harness}=new Function('require','__dirname',declarations+'\nreturn {harness};')(createRequire(fixture),__dirname);
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
function fn(name){const a=source.indexOf('function '+name+'('),b=source.indexOf('\nfunction ',a+1);assert.ok(a>=0&&b>a,name);return source.slice(a,b);}
const KEY='cs_team_matches_v1',META='ps_sync_meta';
const doc=attack=>JSON.stringify({version:1,matches:[{id:'fixture-match',date:'2026-11-03',opponent:'synthetic opponent',attack,phaseBoards:{cur:'atk',boards:{atk:{us:[],opp:[]}}}}]});
const OLD=doc('old confirmed preparation'),NEW=doc('new server preparation'),C=doc('new native input');
const quota=()=>Object.assign(Error('fixture MATCH mirror quota'),{name:'QuotaExceededError'});
function gate(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function setup(options={}){
  const old=options.empty?null:OLD,h=harness({key:KEY,server:NEW,cupd:2,mirror:old,idb:old,...options});
  if(old!==null)h.baseline(OLD,1);
  h.local.set('ps_sync_session','{"uid":"coach-a"}');
  // Production MATCH has no merge base. The generic fixture's Map must not
  // manufacture provenance for a pre-existing split or a rollback.
  vm.runInContext(['isMergeBaseKey','syncBaseGet','syncBaseStore','syncBaseSet','classifySyncError'].map(fn).join('\n'),h.c);
  assert.equal(h.c.isMergeBaseKey(KEY),false);assert.equal(h.c.syncBaseGet(KEY),null);
  const fault=quota(),attempts=[],rollbacks=[];let full=true;
  h.hooks.localWrite=(k,v)=>{if(k===KEY){attempts.push(v);if(full)throw fault;}};
  h.hooks.idbReplace=(k,expected,value)=>{if(k===KEY)rollbacks.push({expected,value});};
  return Object.assign(h,{fault,attempts,rollbacks,releaseQuota(){full=false;}});
}
function preserved(h,mirror=OLD,idb=OLD){
  assert.equal(h.local.get(KEY)??null,mirror);assert.equal(h.idb.get(KEY)??null,idb);
  assert.equal(h.server.get(KEY).v,NEW);assert.equal(h.ready(),false);
  assert.equal(h.requests.filter(r=>r.stage.startsWith('kv_push')).length,0);
}
function originalQuota(result,h){assert.equal(result.code,'sync_storage');assert.equal(result.error,String(h.fault));}

test('a quota pull rolls back only its exact IDB write and the next round recovers after quota clears',async()=>{
  const h=setup(),first=await h.run();originalQuota(first,h);preserved(h);
  assert.deepEqual(h.rollbacks,[{expected:NEW,value:OLD}]);assert.equal(h.attempts.length,1);
  assert.equal(h.c.meta().h[KEY],h.c.hash(OLD));assert.equal(h.c.meta().c[KEY],1);
  h.releaseQuota();const second=await h.run();assert.equal(second.error,undefined,JSON.stringify(h.errors));
  assert.equal(h.local.get(KEY),NEW);assert.equal(h.idb.get(KEY),NEW);assert.equal(h.server.get(KEY).v,NEW);
  assert.equal(h.ready(),true);assert.equal(h.attempts.length,2);assert.equal(h.rollbacks.length,1);
  assert.equal(h.c.meta().h[KEY],h.c.hash(NEW));assert.equal(h.c.meta().c[KEY],2);assert.equal(h.queue.length,0);
});

test('persistent quota retries without stranding a split or acknowledging an existing pending intent',async()=>{
  const h=setup();await h.mark();const pending=h.queue;
  for(let round=0;round<2;round++){originalQuota(await h.run(),h);preserved(h);assert.deepEqual(h.queue,pending);}
  assert.equal(h.attempts.length,2);assert.equal(h.rollbacks.length,2);
});

test('a first pull can roll back an exact previously absent IDB value without inventing readiness',async()=>{
  const h=setup({empty:true});originalQuota(await h.run(),h);preserved(h,null,null);
  assert.deepEqual(h.rollbacks,[{expected:NEW,value:null}]);h.releaseQuota();
  const result=await h.run();assert.equal(result.error,undefined,JSON.stringify(h.errors));assert.equal(h.ready(),true);
  assert.equal(h.local.get(KEY),NEW);assert.equal(h.idb.get(KEY),NEW);
});

test('read-only match recipients can retry a failed pull without acquiring edit permission',async()=>{
  const h=setup({role:'player',teamRole:'member'});originalQuota(await h.run(),h);preserved(h);h.releaseQuota();
  const result=await h.run();assert.equal(result.error,undefined,JSON.stringify(h.errors));assert.equal(h.ready(),true);
  assert.equal(h.state.role,'player');assert.equal(h.local.get(KEY),NEW);assert.equal(h.idb.get(KEY),NEW);
});

for(const shape of [{name:'NS_ERROR_DOM_QUOTA_REACHED'},{name:'Error',code:22},{name:'Error',code:1014}])test('legacy quota shape '+JSON.stringify(shape)+' keeps the same rollback contract',async()=>{
  const h=setup();Object.assign(h.fault,shape);originalQuota(await h.run(),h);preserved(h);assert.equal(h.rollbacks.length,1);
});

for(const mode of ['security','readback'])test('a '+mode+' mirror failure does not use the quota-only rollback',async()=>{
  const h=setup();
  if(mode==='security')h.fault.name='SecurityError';
  if(mode==='security')h.fault.message='fixture denied mirror access';
  else{const set=h.c.localStorage.setItem;h.c.localStorage.setItem=(k,v)=>{if(k!==KEY)set(k,v);};}
  const result=await h.run();assert.ok(result.error);preserved(h,OLD,NEW);assert.equal(h.rollbacks.length,0);
  if(mode==='security')assert.equal(result.error,String(h.fault));
});

for(const mirror of [OLD,C])test('a pre-existing split retains its '+(mirror===OLD?'old':'newer')+' mirror and pending intent without a fabricated MATCH base',async()=>{
  const h=setup({mirror,idb:NEW});h.base.set(KEY,mirror);assert.equal(h.c.syncBaseGet(KEY),null);
  await h.c.outboxMark('team-a',KEY,h.c.hash(mirror),'native intent');const pending=h.queue;
  const result=await h.run();assert.equal(result.pushed,0);preserved(h,mirror,NEW);
  assert.equal(h.attempts.length,0);assert.equal(h.rollbacks.length,0);assert.deepEqual(h.queue,pending);
  assert.ok(h.errors.some(e=>e.stage==='match-write-not-queued'));
});

for(const mode of ['missing','false','throws'])test('rollback CAS '+mode+' preserves the original quota and never falls back to an unchecked write',async()=>{
  const h=setup();
  if(mode==='missing')delete h.c.storage.replaceIfValue;
  if(mode==='false')h.c.storage.replaceIfValue=async(k,expected,value,current)=>{current();return false;};
  if(mode==='throws')h.hooks.idbReplace=()=>{throw Error('fixture rollback storage failure');};
  originalQuota(await h.run(),h);preserved(h,OLD,NEW);
  if(mode==='throws')assert.ok(h.errors.some(e=>e.stage==='match-mirror-rollback'&&e.message.includes('fixture rollback storage failure')));
});

const changes={
  'mirror input':h=>h.local.set(KEY,C),
  'IDB input':h=>h.idb.set(KEY,C),
  'both native copies':h=>{h.local.set(KEY,C);h.idb.set(KEY,C);},
  owner:h=>h.switch(),
  permissions:h=>{h.state.role='staff';h.local.set('cs_perms_v1','{"defaultRole":"staff"}');},
  'workspace role':h=>{h.state.teamRole='member';},
  'persisted metadata':h=>{const m=h.c.meta();m.h[KEY]=h.c.hash(C);h.c.setMeta(m);h.base.set(KEY,C);},
};
for(const [name,change]of Object.entries(changes))test('rollback waits for atomic CAS and preserves a concurrent '+name,async()=>{
  const h=setup(),entered=gate(),release=gate();let settled=false;
  h.hooks.idbReplace=async()=>{entered.resolve();await release.promise;};
  const work=h.run().then(result=>{settled=true;return result;});await entered.promise;
  assert.equal(settled,false);assert.equal(h.ready(),false);assert.equal(h.idb.get(KEY),NEW);
  change(h);const mirror=h.local.get(KEY)??null,idb=h.idb.get(KEY)??null;
  release.resolve();originalQuota(await work,h);
  // Metadata does not participate in the rollback guard: only the captured
  // body is restored, while the external metadata/base copies stay untouched.
  preserved(h,mirror,name==='persisted metadata'?OLD:idb);
  if(name==='persisted metadata'){assert.equal(h.c.meta().h[KEY],h.c.hash(C));assert.equal(h.base.get(KEY),C);}
});

test('a native edit after rollback commit remains intact when the original quota reaches the failure path',async()=>{
  const h=setup(),replace=h.c.storage.replaceIfValue;
  h.c.storage.replaceIfValue=async(...args)=>{const result=await replace(...args);h.local.set(KEY,C);h.idb.set(KEY,C);return result;};
  originalQuota(await h.run(),h);preserved(h,C,C);assert.equal(h.rollbacks.length,1);
});

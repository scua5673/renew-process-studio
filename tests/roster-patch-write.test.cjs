'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
// Reuse the existing actual PSItems function harness without registering its tests.
const fixture=path.join(__dirname,'roster-write-reliability.test.cjs'),source=fs.readFileSync(fixture,'utf8');
const box={require:createRequire(fixture),__dirname,module:{exports:{}},console};
vm.runInNewContext(source.slice(0,source.indexOf("const p=(id,name)"))+'\nmodule.exports={harness};',box,{filename:fixture});
const {harness:actualHarness}=box.module.exports,p=(id,name)=>({id,name}),raw=JSON.stringify,tick=()=>new Promise(r=>setImmediate(r));
function harness(){const h=actualHarness();h.basePlayers=[];return h;}
function seed(h,players){h.basePlayers=JSON.parse(raw(players));const idx={};for(const row of players){h.disk.set('sq:'+row.id,raw(row));idx[row.id]=raw(row);}h.local.set('idx:team-a',raw(idx));}
const options=(h,...changedIds)=>({changedIds,basePlayers:h.basePlayers});

test('patch writes only selected IDs and preserves unmentioned live rows, tombstones, and index entries',async()=>{
  const h=harness(),a=p('a','A'),b=p('b','B');seed(h,[a,b]);h.disk.set('sq:tomb',raw({_del:100}));h.disk.set('sq:legacy','LEGACY EXACT');
  h.hooks.read=k=>{if(k!=='sq:a')throw Error('unrelated row must not be read');};
  await h.c.itemsWriteReady([p('a','Changed A'),p('b','STALE B')],options(h,'a'));
  assert.deepEqual(Array.from(h.writes,x=>x.k),['sq:a']);assert.equal(h.disk.get('sq:b'),raw(b));assert.equal(h.disk.get('sq:tomb'),raw({_del:100}));assert.equal(h.disk.get('sq:legacy'),'LEGACY EXACT');
  assert.equal(JSON.parse(h.local.get('idx:team-a')).b,raw(b));
});
test('empty patch and a shorter snapshot never infer deletion or create a bulk-delete hold',async()=>{
  const h=harness();seed(h,['a','b','c','d','e','f'].map(id=>p(id,id)));const before=[...h.disk],index=h.local.get('idx:team-a');
  await h.c.itemsWriteReady([],options(h));assert.deepEqual([...h.disk],before);assert.equal(h.local.get('idx:team-a'),index);assert.equal(h.local.has('hold'),false);
  await h.c.itemsWriteReady([p('a','Edited')],options(h,'a'));assert.equal(h.disk.size,6);assert.equal(h.local.has('hold'),false);assert.equal(Object.keys(JSON.parse(h.local.get('idx:team-a'))).length,6);
});
test('one patch can update a player and explicitly delete an unindexed player without touching others',async()=>{
  const h=harness(),b=p('b','B');seed(h,[p('a','A'),b]);h.disk.set('sq:removed',raw(p('removed','Imported')));h.basePlayers.push(p('removed','Imported'));
  const result=await h.c.itemsWriteReady([p('a','Edited A'),b],{basePlayers:h.basePlayers,changedIds:['a'],deletedIds:['removed']});
  assert.equal(result.wrote,1);assert.equal(result.gone,1);assert.equal(h.disk.get('sq:a'),raw(p('a','Edited A')));assert.ok(JSON.parse(h.disk.get('sq:removed'))._del);assert.equal(h.disk.get('sq:b'),raw(b));
  assert.deepEqual(Array.from(h.writes,x=>x.k),['sq:a','sq:removed']);assert.deepEqual(Object.keys(JSON.parse(h.local.get('idx:team-a'))),['a','b']);
});
test('an unchanged index hash cannot authorize replacing a newer actual row',async()=>{
  const h=harness(),a=p('a','A');seed(h,[a]);h.disk.set('sq:a',raw(p('a','Other local value')));
  await assert.rejects(h.c.itemsWriteReady([a],options(h,'a')),e=>e.psStage==='items_write_stale_job');assert.equal(h.disk.get('sq:a'),raw(p('a','Other local value')));assert.equal(h.writes.length,0);
});
test('the final index update preserves another tab index edit during the row transaction',async()=>{
  const h=harness();seed(h,[p('a','A'),p('b','B')]);h.hooks.after=()=>h.local.set('idx:team-a',raw({a:'previous',b:'NEW B HASH',fresh:'NEW ROW HASH'}));
  await h.c.itemsWriteReady([p('a','Edited A')],options(h,'a'));assert.deepEqual(JSON.parse(h.local.get('idx:team-a')),{a:raw(p('a','Edited A')),b:'NEW B HASH',fresh:'NEW ROW HASH'});
});
test('invalid patch IDs or combining patch and strict recovery fails before writes',async()=>{
  for(const [players,opts] of [
    [[p('a','A')],{changedIds:null}],[[p('a','A')],{changedIds:['absent']}],[[p('a','A')],{changedIds:['a','a']}],[[p('a','A'),p('a','Duplicate')],{changedIds:['a']}],
    [[{id:'a',name:'Candidate',type:'target'}],{changedIds:['a']}],[[{id:'a',name:'Deleted',_del:100}],{changedIds:['a']}],[[p('a','')],{changedIds:['a']}],
    [[p('a','A')],{changedIds:['a'],deletedIds:['a']}],[[p('a','A')],{changedIds:['a'],expectedRows:[]}],[[p('__proto__','Bad')],{changedIds:['__proto__']}],
    [[],{changedIds:[],deletedIds:['constructor']}],[[p('a','A')],{changedIds:['a'],basePlayers:null}]
  ]){const h=harness();await assert.rejects(h.c.itemsWriteReady(players,{basePlayers:[],...opts}));assert.equal(h.writes.length,0);assert.equal(h.c._itemsActiveJobs.length,0);}
  const h=harness();await assert.rejects(h.c.itemsWriteReady([p('a','A')],{changedIds:['a']}));assert.equal(h.writes.length,0);
});
test('a failed patch survives an unrelated successful patch and flush retries only the original IDs',async()=>{
  const h=harness();seed(h,[p('a','A'),p('b','B')]);h.hooks.write=k=>{if(k==='sq:a')throw Error('disk A');};
  await assert.rejects(h.c.itemsWriteReady([p('a','Edit A'),p('b','Old B')],options(h,'a')),/disk A/);
  await h.c.itemsWriteReady([p('a','Old A'),p('b','Edit B')],options(h,'b'));assert.equal(h.c._itemsPatchFailures.length,1);assert.equal(h.c.itemsWriteBusy(),true);
  await assert.rejects(h.c.itemsWriteFlush(),/disk A/);delete h.hooks.write;await h.c.itemsWriteFlush();
  assert.equal(h.disk.get('sq:a'),raw(p('a','Edit A')));assert.equal(h.disk.get('sq:b'),raw(p('b','Edit B')));assert.equal(h.c.itemsWriteBusy(),false);
});
test('multiple failures remain independent and retry their own partial writes',async()=>{
  const h=harness();seed(h,[p('a','A'),p('b','B'),p('c','C')]);h.hooks.write=k=>{if(k!=='sq:a')throw Error('disk');};
  await assert.rejects(h.c.itemsWriteReady([p('a','Edit A'),p('b','Edit B')],options(h,'a','b')),/disk/);
  await assert.rejects(h.c.itemsWriteReady([p('c','Edit C')],options(h,'c')),/disk/);assert.equal(h.c._itemsPatchFailures.length,2);
  delete h.hooks.write;await h.c.itemsWriteFlush();assert.equal(h.writes.filter(x=>x.k==='sq:a').length,1);for(const id of ['a','b','c'])assert.equal(JSON.parse(h.disk.get('sq:'+id)).name,'Edit '+id.toUpperCase());assert.equal(h.c.itemsWriteBusy(),false);
});
test('a newer same-ID patch supersedes only its part of an older failed patch',async()=>{
  const h=harness();seed(h,[p('a','A'),p('b','B')]);h.hooks.write=()=>{throw Error('disk');};
  await assert.rejects(h.c.itemsWriteReady([p('a','Old request A'),p('b','Keep B')],options(h,'a','b')),/disk/);delete h.hooks.write;
  await h.c.itemsWriteReady([p('a','LATEST A')],options(h,'a'));assert.deepEqual(Array.from(h.c._itemsPatchFailures[0].changedIds),['b']);
  await h.c.itemsWriteFlush();assert.equal(h.disk.get('sq:a'),raw(p('a','LATEST A')));assert.equal(h.disk.get('sq:b'),raw(p('b','Keep B')));assert.equal(h.c.itemsWriteBusy(),false);
});
test('a later explicit delete retires a failed edit for that ID without reviving it on retry',async()=>{
  const h=harness();seed(h,[p('a','A'),p('b','B')]);h.hooks.write=()=>{throw Error('disk');};
  await assert.rejects(h.c.itemsWriteReady([p('a','Old edit'),p('b','Keep edit')],options(h,'a','b')),/disk/);delete h.hooks.write;
  await h.c.itemsWriteReady([p('b','B')],{basePlayers:h.basePlayers,changedIds:[],deletedIds:['a']});const tomb=h.disk.get('sq:a');
  await h.c.itemsWriteFlush();assert.equal(h.disk.get('sq:a'),tomb);assert.ok(JSON.parse(tomb)._del);assert.equal(h.disk.get('sq:b'),raw(p('b','Keep edit')));assert.equal(h.c.itemsWriteBusy(),false);
});
test('a newer live edit retires only its ID from an older failed mixed update and deletion',async()=>{
  const h=harness();seed(h,[p('a','A'),p('b','B'),p('c','C')]);h.hooks.write=()=>{throw Error('disk');};
  await assert.rejects(h.c.itemsWriteReady([p('a','Keep A')],{basePlayers:h.basePlayers,changedIds:['a'],deletedIds:['b','c']}),/disk/);delete h.hooks.write;
  await h.c.itemsWriteReady([p('b','Retain B')],options(h,'b'));assert.deepEqual(Array.from(h.c._itemsPatchFailures[0].deletedIds),['c']);
  await h.c.itemsWriteFlush();assert.equal(h.disk.get('sq:a'),raw(p('a','Keep A')));assert.equal(h.disk.get('sq:b'),raw(p('b','Retain B')));assert.ok(JSON.parse(h.disk.get('sq:c'))._del);
});
test('same-tab serial patches accept proven predecessor writes and never replay a superseded failure',async()=>{
  const h=harness();seed(h,[p('a','A')]);let entered,release,once=true;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  h.hooks.write=async()=>{if(once){once=false;entered();await gate;}};
  const first=h.c.itemsWriteReady([p('a','First')],options(h,'a'));await ready;const second=h.c.itemsWriteReady([p('a','Second')],options(h,'a'));await tick();release();await first;await second;await h.c.itemsWriteFlush();
  assert.equal(h.disk.get('sq:a'),raw(p('a','Second')));assert.equal(h.c.itemsWriteBusy(),false);
});
test('a newer third-party row is never adopted on first attempt or patch retry',async()=>{
  const h=harness();seed(h,[p('a','A')]);let entered,release;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);h.hooks.ready=async()=>{entered();await gate;};
  const work=h.c.itemsWriteReady([p('a','Mine')],options(h,'a'));await ready;const newer=raw(p('a','Other tab'));h.disk.set('sq:a',newer);release();
  await assert.rejects(work,e=>e.psStage==='items_write_stale_job');await assert.rejects(h.c.itemsWriteFlush(),e=>e.psStage==='items_write_stale_job');assert.equal(h.disk.get('sq:a'),newer);assert.equal(h.writes.length,0);assert.equal(h.c.itemsWriteBusy(),true);
});
test('stale deletion transfers exact originals to review without blocking unrelated patch synchronization',async()=>{
  const h=harness();seed(h,[p('a','A'),p('b','B')]);let once=true;h.hooks.write=k=>{if(k==='sq:a'&&once){once=false;h.disk.set(k,raw(p('a','Later')));}};
  const result=await h.c.itemsWriteReady([p('b','Edit B')],{basePlayers:h.basePlayers,changedIds:['b'],deletedIds:['a']});
  assert.deepEqual(Array.from(result.reviewedDeletes),['a']);assert.equal(h.c.itemsDeleteReviews().length,1);assert.equal(h.c.itemsDeleteReviews()[0].expected,raw(p('a','A')));
  await h.c.itemsWriteFlush();assert.equal(h.c._itemsPatchFailures.length,0);assert.equal(h.c.itemsWriteBusy(),false);assert.equal(JSON.parse(h.disk.get('sq:a')).name,'Later');assert.equal(JSON.parse(h.disk.get('sq:b')).name,'Edit B');
});
test('a live-row conflict in a mixed patch is not swallowed as a successful deletion review',async()=>{
  const h=harness();seed(h,[p('a','A'),p('b','B')]);h.disk.set('sq:a',raw(p('a','Later A')));
  await assert.rejects(h.c.itemsWriteReady([p('a','Mine A')],{basePlayers:h.basePlayers,changedIds:['a'],deletedIds:['b']}),e=>e.psItemId==='a');
  assert.equal(h.c.itemsDeleteReviews().length,0);assert.equal(h.c._itemsPatchFailures.length,1);assert.equal(h.disk.get('sq:b'),raw(p('b','B')));
});
test('held selected row never reports a successful patch or successful retry',async()=>{
  const h=harness();seed(h,[p('a','A')]);h.c.itemsReviewKeys=()=>({'sq:a':1});
  await assert.rejects(h.c.itemsWriteReady([p('a','Mine')],options(h,'a')),e=>e.psStage==='items_patch_unconfirmed');await assert.rejects(h.c.itemsWriteFlush(),e=>e.psStage==='items_patch_unconfirmed');assert.equal(h.writes.length,0);assert.equal(h.c.itemsWriteBusy(),true);
});
test('scope changes drop obsolete retries without writing to the next account or team',async()=>{
  const h=harness();seed(h,[p('a','A')]);h.hooks.write=()=>{throw Error('disk');};await assert.rejects(h.c.itemsWriteReady([p('a','Mine')],options(h,'a')),/disk/);
  h.move();delete h.hooks.write;h.disk.set('sq:a','NEW TEAM');await h.c.itemsWriteFlush();assert.equal(h.disk.get('sq:a'),'NEW TEAM');assert.equal(h.writes.length,0);assert.equal(h.c.itemsWriteBusy(),false);assert.equal(h.c._itemsPatchFailures.length,0);
});
test('server capability failure keeps a patch unconfirmed and retryable',async()=>{
  const h=harness();h.unready();await assert.rejects(h.c.itemsWriteReady([p('a','Mine')],options(h,'a')),e=>e.psCode==='sync_confirm_missing');await assert.rejects(h.c.itemsWriteFlush(),e=>e.psCode==='sync_confirm_missing');assert.equal(h.writes.length,0);assert.equal(h.c.itemsWriteBusy(),true);
});
test('legacy full-snapshot and strict recovery behavior remains available without changedIds',async()=>{
  const h=harness();seed(h,[p('a','A'),p('b','B')]);await h.c.itemsWriteReady([p('a','A')]);assert.ok(JSON.parse(h.disk.get('sq:b'))._del);
  const other=harness();seed(other,[p('a','A')]);await other.c.itemsWriteReady([p('a','A'),p('b','Recovered')],{expectedRows:[{id:'a',raw:raw(p('a','A'))}]});assert.equal(other.disk.get('sq:b'),raw(p('b','Recovered')));
});

test('snapshot baseline prevents stale screen fields from overwriting an already newer IDB row',async()=>{
  const h=harness(),base={id:'a',name:'A',memo:'old',rating:1};seed(h,[base]);const newer={...base,rating:5};h.disk.set('sq:a',raw(newer));
  await assert.rejects(h.c.itemsWriteReady([{...base,memo:'my edit'}],options(h,'a')),e=>e.psStage==='items_write_stale_job');assert.equal(h.disk.get('sq:a'),raw(newer));assert.equal(h.writes.length,0);
});
test('missing baseline permits new rows only when the exact ID is absent',async()=>{
  const h=harness();await h.c.itemsWriteReady([p('new','New')],options(h,'new'));assert.equal(h.disk.get('sq:new'),raw(p('new','New')));
  const other=harness();other.disk.set('sq:new',raw(p('new','Existing other')));await assert.rejects(other.c.itemsWriteReady([p('new','New')],options(other,'new')),e=>e.psStage==='items_write_stale_job');assert.equal(other.disk.get('sq:new'),raw(p('new','Existing other')));
});
test('read-only and permission changes before CAS reject without any row or index mutation',async()=>{
  for(const phase of ['initial','server wait','transaction wait','same-role permissions']){
    const h=harness();seed(h,[p('a','A')]);const index=h.local.get('idx:team-a');
    if(phase==='initial')h.setRole('player');else if(phase==='server wait')h.hooks.ready=()=>h.setRole('player');else if(phase==='transaction wait')h.hooks.write=()=>h.setRole('player');else h.hooks.write=()=>h.local.set('perms','CHANGED PERMISSIONS');
    await assert.rejects(h.c.itemsWriteReady([p('a','Mine')],options(h,'a')),e=>e.psCode==='sync_workspace_changed');assert.equal(h.writes.length,0);assert.equal(h.disk.get('sq:a'),raw(p('a','A')));assert.equal(h.local.get('idx:team-a'),index);await h.c.itemsWriteFlush();assert.equal(h.c.itemsWriteBusy(),false);
  }
});

const storageSource=fs.readFileSync(path.join(__dirname,'../studio/storage.js'),'utf8');
function section(s,a,b){const from=s.indexOf(a),to=s.indexOf(b,from+a.length);assert.ok(from>=0&&to>from,a);return s.slice(from,to);}
function actualCas(h,boundary){
  let entered,release;const wait=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  h.c.STORE='kv';h.c.migrated=boundary==='migration'?gate:Promise.resolve();
  h.c.open=async()=>{
    if(boundary==='open'){entered();await gate;}
    return {transaction(){let aborted=false;const pending=[];const t={
      abort(){aborted=true;setImmediate(()=>t.onabort&&t.onabort());},
      objectStore:()=>({get(k){const r={};setImmediate(async()=>{if(boundary==='atomic read'){entered();await gate;}r.result=h.disk.get(k);r.onsuccess();if(!aborted){pending.forEach(f=>f());t.oncomplete();}});return r;},
        put(v,k){pending.push(()=>{h.disk.set(k,v);h.writes.push({k,value:v});});},delete(k){pending.push(()=>h.disk.delete(k));}})};return t;}};
  };
  vm.runInContext(section(storageSource,'  function idbReplaceIfValue(','  function idbKeys(')+'\n'+section(storageSource,'  function afterMigrate(fn)','\n\n  window.storage=')+'\nwindow.storage={...window.storage,'+storageSource.match(/^    replaceIfValue:function[^\n]+/m)[0]+'};',h.c);
  return {wait:boundary==='migration'?tick():wait,release};
}
for(const boundary of ['migration','open','atomic read'])test('actual storage facade rejects revoked permission after '+boundary+' without issuing a put',async()=>{
  const h=harness();seed(h,[p('a','A')]);const g=actualCas(h,boundary),work=h.c.itemsWriteReady([p('a','Mine')],options(h,'a'));
  await g.wait;h.setRole('player');g.release();await assert.rejects(work,e=>e.psCode==='sync_workspace_changed');assert.equal(h.disk.get('sq:a'),raw(p('a','A')));assert.equal(h.writes.length,0);
});
test('actual atomic storage retains backward-compatible three-argument CAS semantics',async()=>{
  const h=harness();seed(h,[p('a','A')]);actualCas(h,'none');assert.equal(await h.c.storage.replaceIfValue('sq:a','wrong','new'),false);assert.equal(await h.c.storage.replaceIfValue('sq:a',raw(p('a','A')),'new'),true);assert.equal(h.disk.get('sq:a'),'new');
});
test('pending roster originals are detected and cleared by the explicit account cleanup classification',()=>{
  const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8'),c=vm.createContext({WSKEY:'ws',WLKEY:'wl',MKEY:'meta',OWNERKEY:'owner',KEYS:[],CONTENT:[],LIBKEY:'lib',TOMBKEY:'tomb'});
  vm.runInContext(section(sync,'function sensitiveLocalKey(','function removeLocalVerified('),c);
  const key='ps_roster_pending_v1:account-a:team-a:request';assert.equal(c.sensitiveLocalKey(key),true);assert.equal(c.accountContentProbe(key),true);assert.equal(c.sensitiveLocalKey('ps_roster_pending_not_ours'),false);
});

test('disabled item channel is an unconfirmed retained patch rather than a successful flush',async()=>{
  const h=harness();seed(h,[p('a','A')]);h.local.set('ps_items_write','0');await assert.rejects(h.c.itemsWriteReady([p('a','Mine')],options(h,'a')),e=>e.psCode==='sync_confirm_missing');await assert.rejects(h.c.itemsWriteFlush(),e=>e.psCode==='sync_confirm_missing');assert.equal(h.c.itemsWriteBusy(),true);assert.equal(h.writes.length,0);
  h.local.delete('ps_items_write');await h.c.itemsWriteFlush();assert.equal(h.disk.get('sq:a'),raw(p('a','Mine')));assert.equal(h.c.itemsWriteBusy(),false);
});
test('an empty patch does not report completion for an obsolete owner',async()=>{
  const h=harness(),work=h.c.itemsWriteReady([],options(h));h.move();await assert.rejects(work,e=>e.psCode==='sync_workspace_changed');assert.equal(h.writes.length,0);
});

test('a newer edit can follow a failed patch partial write while preserving its other failed IDs',async()=>{
  const h=harness();seed(h,[p('a','A'),p('b','B')]);h.hooks.write=k=>{if(k==='sq:b')throw Error('disk B');};
  await assert.rejects(h.c.itemsWriteReady([p('a','First A'),p('b','Keep B')],options(h,'a','b')),/disk B/);assert.equal(h.disk.get('sq:a'),raw(p('a','First A')));
  await h.c.itemsWriteReady([p('a','LATEST A')],options(h,'a'));assert.deepEqual(Array.from(h.c._itemsPatchFailures[0].changedIds),['b']);
  delete h.hooks.write;await h.c.itemsWriteFlush();assert.equal(h.disk.get('sq:a'),raw(p('a','LATEST A')));assert.equal(h.disk.get('sq:b'),raw(p('b','Keep B')));assert.equal(h.c.itemsWriteBusy(),false);
});
test('failed-patch predecessor does not authorize another writer value after its partial write',async()=>{
  const h=harness();seed(h,[p('a','A'),p('b','B')]);h.hooks.write=k=>{if(k==='sq:b')throw Error('disk B');};
  await assert.rejects(h.c.itemsWriteReady([p('a','First A'),p('b','Keep B')],options(h,'a','b')),/disk B/);h.disk.set('sq:a',raw(p('a','OTHER WRITER')));
  await assert.rejects(h.c.itemsWriteReady([p('a','LATEST A')],options(h,'a')),e=>e.psStage==='items_write_stale_job');assert.equal(h.disk.get('sq:a'),raw(p('a','OTHER WRITER')));
});

test('reloaded pending history can finish a newer edit after an earlier partial commit',async()=>{
  const h=harness(),baseA=p('a','A'),firstA=p('a','First A');seed(h,[baseA,p('b','B')]);h.hooks.write=k=>{if(k==='sq:b')throw Error('disk B');};
  await assert.rejects(h.c.itemsWriteReady([firstA,p('b','Keep B')],options(h,'a','b')),/disk B/);
  const after=harness();after.basePlayers=h.basePlayers;for(const [k,v]of h.local)after.local.set(k,v);for(const [k,v]of h.disk)after.disk.set(k,v);
  await after.c.itemsWriteReady([p('a','Latest A'),p('b','Keep B')],{...options(after,'a','b'),baseHistory:[{id:'a',players:[firstA]}]});
  assert.equal(after.disk.get('sq:a'),raw(p('a','Latest A')));assert.equal(after.disk.get('sq:b'),raw(p('b','Keep B')));assert.equal(after.c.itemsWriteBusy(),false);
});
test('durable authored history never authorizes a newer unrecorded third-party row',async()=>{
  const h=harness(),base=p('a','A'),authored=p('a','First A'),remote={...authored,memo:'Unseen other device field'};seed(h,[base]);h.disk.set('sq:a',raw(remote));
  await assert.rejects(h.c.itemsWriteReady([p('a','Latest A')],{...options(h,'a'),baseHistory:[{id:'a',players:[authored]}]}),e=>e.psStage==='items_write_stale_job');assert.equal(h.disk.get('sq:a'),raw(remote));
});
test('durable history rejects cross-ID, deletion, candidate, duplicate, and malformed records',async()=>{
  for(const baseHistory of [{},[{id:'b',players:[p('b','B')]}],[{id:'a',players:[p('b','B')]}],[{id:'a',players:[{id:'a',_del:100}]}],[{id:'a',players:[{id:'a',type:'target'}]}],[{id:'a',players:[]} ,{id:'a',players:[]}],[{id:'a',players:null}]]){
    const h=harness();seed(h,[p('a','A')]);await assert.rejects(h.c.itemsWriteReady([p('a','Mine')],{...options(h,'a'),baseHistory}),e=>e.psStage==='items_patch_history');assert.equal(h.writes.length,0);
  }
});

function absence(h,{rows=[],status=200,token,reply,json}={}){
  const calls=[];h.c.BASE='https://synthetic.invalid';h.c.ensureToken=async()=>{if(token)await token();return 'SYNTHETIC_TOKEN';};h.c.hj=at=>({Authorization:'Bearer '+at});h.c.syncHttpError=(stage,s)=>Object.assign(Error('HTTP '+s),{psStage:stage});
  h.c.syncFetch=async(stage,url,options)=>{calls.push({stage,url,options});if(reply)await reply();return {ok:status===200,status,async json(){if(json)await json();return rows;}};};return calls;
}
test('legacy main-only player seeds one row only after authenticated exact-key remote absence',async()=>{
  const h=harness(),base=p('legacy','Legacy');h.basePlayers=[base];const calls=absence(h);await h.c.itemsWriteReady([p('legacy','Edited')],options(h,'legacy'));
  assert.equal(h.disk.get('sq:legacy'),raw(p('legacy','Edited')));assert.equal(calls.length,1);assert.equal(calls[0].stage,'items_patch_absence');
  const url=new URL(calls[0].url);assert.equal(url.searchParams.get('workspace_id'),'eq.team-a');assert.equal(url.searchParams.get('k'),'eq.sq:legacy');assert.equal(url.searchParams.get('select'),'k,v,cupd');assert.equal(url.searchParams.get('limit'),'2');assert.equal(calls[0].options.headers.Authorization,'Bearer SYNTHETIC_TOKEN');
});
test('local absence with an existing remote row never adopts that row as a new edit base',async()=>{
  const h=harness();h.basePlayers=[p('legacy','Old')];const server=raw(p('legacy','Remote newest'));absence(h,{rows:[{k:'sq:legacy',v:server,cupd:2}]});
  await assert.rejects(h.c.itemsWriteReady([p('legacy','Mine')],options(h,'legacy')),e=>e.psStage==='items_write_stale_job');assert.equal(h.disk.has('sq:legacy'),false);assert.equal(h.writes.length,0);assert.equal(h.c.itemsWriteBusy(),true);
});
for(const condition of ['HTTP failure','malformed response','offline'])test('legacy exact-key absence '+condition+' retains the original pending edit',async()=>{
  const h=harness();h.basePlayers=[p('legacy','Old')];const cfg=condition==='HTTP failure'?{status:503}:condition==='malformed response'?{rows:null}:{reply:()=>{throw Error('offline');}};absence(h,cfg);
  await assert.rejects(h.c.itemsWriteReady([p('legacy','Mine')],options(h,'legacy')));assert.equal(h.writes.length,0);assert.equal(h.c.itemsWriteBusy(),true);assert.equal(h.c._itemsPatchFailures[0].expected.legacy,raw(p('legacy','Old')));
});
for(const boundary of ['token','reply','json'])test('legacy absence verification stops after permission changes during '+boundary,async()=>{
  const h=harness();h.basePlayers=[p('legacy','Old')];absence(h,{[boundary]:()=>h.setRole('player')});await assert.rejects(h.c.itemsWriteReady([p('legacy','Mine')],options(h,'legacy')),e=>e.psCode==='sync_workspace_changed');assert.equal(h.writes.length,0);assert.equal(h.disk.has('sq:legacy'),false);
});
test('another tab filling the exact IDB key during absence verification wins the subsequent CAS',async()=>{
  const h=harness();h.basePlayers=[p('legacy','Old')];const newer=raw(p('legacy','Other tab'));absence(h,{json:()=>h.disk.set('sq:legacy',newer)});
  await assert.rejects(h.c.itemsWriteReady([p('legacy','Mine')],options(h,'legacy')),e=>e.psStage==='items_write_cas');assert.equal(h.disk.get('sq:legacy'),newer);assert.equal(h.writes.length,0);
});
test('new-row null baseline makes no additional absence network request',async()=>{
  const h=harness(),calls=absence(h);await h.c.itemsWriteReady([p('new','New')],options(h,'new'));assert.equal(calls.length,0);assert.equal(h.disk.get('sq:new'),raw(p('new','New')));
});

test('actual durable outbox stage A, stage B, late ACK A and reload authorize only recorded intermediate row A',async()=>{
  const {create}=require('../studio/roster-outbox.js'),h=harness(),original=p('a','Original'),first=p('a','First'),latest=p('a','Latest');seed(h,[original]);
  function client(target){const ls=target.c.localStorage;Object.defineProperty(ls,'length',{configurable:true,get:()=>target.local.size});ls.key=i=>[...target.local.keys()][i]??null;return create({storage:ls,owner:()=>({uid:'coach-a',wid:'team-a'})});}
  function request(receipt){return {players:receipt.rows.filter(r=>!r.deleted).map(r=>r.player),options:{changedIds:receipt.rows.filter(r=>!r.deleted).map(r=>r.id),deletedIds:receipt.rows.filter(r=>r.deleted).map(r=>r.id),basePlayers:receipt.rows.filter(r=>r.base!==null).map(r=>r.base),baseHistory:receipt.rows.map(r=>({id:r.id,players:r.history||[]}))}};}
  const outbox=client(h),a=outbox.stage({players:[first],basePlayers:[original],changedIds:['a'],deletedIds:[]}),reqA=request(a);
  await h.c.itemsWriteReady(reqA.players,reqA.options);
  outbox.stage({players:[latest],basePlayers:[first],changedIds:['a'],deletedIds:[]});assert.equal(outbox.ack(a),1);assert.equal(h.local.has(a.keys[0]),false);
  const reloaded=harness();for(const [k,v]of h.local)reloaded.local.set(k,v);for(const [k,v]of h.disk)reloaded.disk.set(k,v);
  const resumed=client(reloaded),receipt=resumed.read(),reqB=request(receipt);assert.deepEqual(reqB.options.basePlayers,[original]);assert.deepEqual(reqB.options.baseHistory,[{id:'a',players:[first]}]);
  assert.equal(reloaded.disk.get('sq:a'),raw(first));await reloaded.c.itemsWriteReady(reqB.players,reqB.options);assert.equal(reloaded.disk.get('sq:a'),raw(latest));assert.equal(resumed.ack(receipt),1);assert.equal(resumed.pending(),false);
});

test('new patch writer rejects old storage facades before reading or writing player data',async()=>{
  for(const capability of [undefined,0,'1',2]){
    const h=harness();seed(h,[p('a','A')]);h.c.storage.conditionalGuardVersion=capability;let reads=0;h.hooks.read=()=>reads++;
    await assert.rejects(h.c.itemsWriteReady([p('a','Mine')],options(h,'a')),e=>e.psStage==='items_patch_permission');
    assert.equal(reads,0);assert.equal(h.writes.length,0);assert.equal(h.c._itemsActiveJobs.length,0);assert.equal(h.disk.get('sq:a'),raw(p('a','A')));
  }
});
test('storage capability changes while a patch waits stop its actual CAS',async()=>{
  for(const phase of ['readiness','transaction']){
    const h=harness();seed(h,[p('a','A')]);h.hooks[phase==='readiness'?'ready':'write']=()=>{h.c.storage.conditionalGuardVersion=0;};
    await assert.rejects(h.c.itemsWriteReady([p('a','Mine')],options(h,'a')),e=>e.psCode==='sync_workspace_changed');assert.equal(h.writes.length,0);assert.equal(h.disk.get('sq:a'),raw(p('a','A')));
  }
});
test('shipped public storage and PSItems objects expose the supported guard and patch capabilities',()=>{
  const c=vm.createContext({window:{}});vm.runInContext(section(storageSource,'  window.storage={','\n\n  /* 1.618'),c);assert.equal(c.window.storage.conditionalGuardVersion,1);
  const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8'),h=harness();
  for(const name of ['itemsAudit','itemsPushAllowed','itemsHoldOpen','itemsReadAll','itemsActive'])h.c[name]=()=>{};
  vm.runInContext(section(sync,'try{ window.PSItems={','\n\nfunction matchMirrorWriteExact'),h.c);assert.equal(h.c.PSItems.patchVersion,1);assert.equal(h.c.PSItems.writeReady,h.c.itemsWriteReady);
});

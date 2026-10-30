'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const J=require('../studio/autosave-journal.js');
const Q=require('../studio/sync-items-stale.js');
const Confirmation=require('../studio/sync-confirmation.js');
const KEY='process_coach_v1',RAW='{"weeks":{},"memo":"synthetic exact schedule"}',CARRIERS=['scout_tool_v1','cs_squad_v1','cs_team_attrs_v1'];
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(){
 let owner={uid:'synthetic-ready-coach',wid:'synthetic-ready-team',seal:'ready-seal-a',epoch:'ready-epoch-a',signout:0},uuid=0;
 let permission=JSON.stringify({role:'admin',edit:{team:true,scout:true}});
 const disk=new Map([['sq:p1','{"id":"p1","memo":"device B"}']]),hooks={},calls=[];
 const context=()=>({...owner}),current=o=>!!o&&JSON.stringify(o)===JSON.stringify(owner),metadata={h:{},c:{}};
 const storage={async get(k){calls.push(['get',k]);return disk.has(k)?{value:disk.get(k)}:null;},async keys(prefix){calls.push(['keys',prefix]);if(hooks.keys)await hooks.keys(prefix);return [...disk.keys()];},async set(k,v,guard){calls.push(['set',k]);if(guard&&guard()===false)throw Error('synthetic storage owner changed');disk.set(k,v);return true;}};
 const journal=J.create({storage,context,hash:J.hash,randomUUID:()=> '00000000-0000-4000-8000-'+String(++uuid).padStart(12,'0'),now:()=>1000+uuid});
 const q=Q.create({context,current,permission:()=>permission,journal:()=>journal,storage,hash:J.hash});
 const confirmation=Confirmation.create({key:KEY,context:()=>({...owner,permission,role:'owner'}),busy:()=>false,state:()=>q.state({kind:'ok',n:0,review:0,at:1}),hash:J.hash,meta:()=>metadata});
 function receipt(){const round=confirmation.begin();confirmation.observe(round,owner.wid,[{workspace_id:owner.wid,k:KEY,v:RAW,cupd:7}],[KEY],'pull');metadata.h[KEY]=J.hash(RAW);metadata.c[KEY]=7;confirmation.finish(round,{pending:0,skipped:[],held:[],deferred:[],scheduleDeferred:false});}
 const confirmed=()=>confirmation.confirmedValue(KEY,RAW);
 const job=()=>({owner:{...owner},players:[{id:'p1',memo:'authored A'}],expected:{p1:'{"id":"p1","memo":"base"}'},sequence:1,at:50,patch:true,permission,written:[],changedIds:['p1'],deletedIds:[]});
 return {q,confirmation,receipt,confirmed,disk,metadata,calls,hooks,job,owner:()=>({...owner}),move:change=>owner={...owner,...change},setPermission:value=>permission=value};
}
function allFenced(h){for(const key of [...CARRIERS,'sq:p1','sq:unrelated'])assert.equal(h.q.fenced(key),true,key);}

test('readiness: known same-owner pure journal refresh keeps an exact confirmed schedule while its keys read waits',async()=>{
 const h=fixture();await h.q.load();h.receipt();assert.equal(h.confirmed(),true);
 const before={owner:h.owner(),meta:JSON.stringify(h.metadata),body:h.disk.get('sq:p1')},gate=deferred(),entered=deferred();h.hooks.keys=async()=>{entered.resolve();await gate.promise;};
 const reading=h.q.load();await entered.promise;const during=h.confirmed();gate.resolve();assert.equal(await reading,0);assert.equal(h.confirmed(),true);
 assert.deepEqual(h.owner(),before.owner);assert.equal(JSON.stringify(h.metadata),before.meta);assert.equal(h.disk.get('sq:p1'),before.body);assert.equal(h.calls.filter(([kind])=>kind==='set').length,0);
 assert.equal(during,true,'same-owner read-only refresh must not invalidate an unchanged exact server receipt');
});

test('readiness: first unknown journal load cannot confirm an observed server schedule or expose row projections',()=>{
 const h=fixture();h.receipt();const calls=h.calls.length;assert.equal(h.confirmed(),false);allFenced(h);assert.ok(h.q.count()>0);assert.equal(h.calls.length,calls,'confirmation and fences perform no extra I/O');
});

test('readiness: a new owner generation cannot inherit the previous ready snapshot or exact server receipt',async()=>{
 const h=fixture();await h.q.load();h.receipt();assert.equal(h.confirmed(),true);h.move({seal:'ready-seal-b',epoch:'ready-epoch-b'});assert.equal(h.confirmed(),false);allFenced(h);assert.ok(h.q.count()>0);
});

test('readiness: an actual stale capture lease blocks schedule confirmation and all row projections until exact archival',async()=>{
 const h=fixture();await h.q.load();h.receipt();assert.equal(h.confirmed(),true);const gate=deferred(),entered=deferred();let first=true;
 h.hooks.keys=async()=>{if(first){first=false;entered.resolve();await gate.promise;}};const job=h.job(),error=Object.assign(Error('synthetic stale row'),{psStage:'items_write_stale_job',psItemsJob:job});const pending=h.q.capture(job,error);await entered.promise;
 assert.equal(h.confirmed(),false);allFenced(h);assert.equal(h.q.state({kind:'ok',n:0,review:0,at:1}).kind,'busy');gate.resolve();await pending;assert.equal(h.confirmed(),false);assert.equal(h.q.fenced('sq:p1'),true);assert.equal(h.disk.get('sq:p1'),'{"id":"p1","memo":"device B"}');
});

test('readiness: latest actual journal I/O failure fails closed even after a successful same-owner snapshot',async()=>{
 const h=fixture();await h.q.load();h.receipt();assert.equal(h.confirmed(),true);h.hooks.keys=()=>{throw Error('synthetic readiness journal disk failure');};await assert.rejects(h.q.load(),/synthetic readiness journal disk failure/);assert.equal(h.confirmed(),false);allFenced(h);assert.ok(h.q.count()>0);
});

test('readiness permission: a permission change during an otherwise identical read invalidates publication while null viewing permission remains read-only',async()=>{
 const viewing=fixture();viewing.setPermission(null);assert.equal(await viewing.q.load(),0);assert.equal(viewing.q.count(),0,'null write permission still permits an exact viewing snapshot');await assert.rejects(viewing.q.before(viewing.job()),'view-only snapshots never grant player write authority');
 const h=fixture();await h.q.load();h.receipt();assert.equal(h.confirmed(),true);const gate=deferred(),entered=deferred();h.hooks.keys=async()=>{entered.resolve();await gate.promise;};
 const pending=h.q.load().then(value=>({value}),error=>({error}));await entered.promise;h.setPermission(JSON.stringify({role:'viewer',edit:{team:false,scout:false}}));gate.resolve();const result=await pending;
 assert.ok(result.error,'a read begun under a different permission raw must not publish');allFenced(h);assert.ok(h.q.count()>0);assert.equal(h.confirmed(),false);
});

test('readiness late old: an older actual I/O rejection cannot invalidate a newer exact same-owner snapshot',async()=>{
 const h=fixture();await h.q.load();h.receipt();assert.equal(h.confirmed(),true);const before={body:h.disk.get('sq:p1'),owner:h.owner(),meta:JSON.stringify(h.metadata)},gate=deferred(),entered=deferred(),failure=Error('synthetic older journal I/O failure');let first=true;
 h.hooks.keys=async()=>{if(first){first=false;entered.resolve();await gate.promise;throw failure;}};const old=h.q.load().then(value=>({value}),error=>({error}));await entered.promise;
 assert.equal(await h.q.load(),0);assert.equal(h.q.count(),0);assert.equal(h.confirmed(),true);gate.resolve();assert.equal((await old).error,failure,'the old caller still receives its actual I/O failure');
 assert.equal(h.q.count(),0);assert.equal(h.confirmed(),true);for(const key of [...CARRIERS,'sq:p1','sq:unrelated'])assert.equal(h.q.fenced(key),false,key);assert.equal(h.disk.get('sq:p1'),before.body);assert.deepEqual(h.owner(),before.owner);assert.equal(JSON.stringify(h.metadata),before.meta);assert.equal(h.calls.filter(([kind])=>kind==='set').length,0);
});

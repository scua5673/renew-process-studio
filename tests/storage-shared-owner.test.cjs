'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/storage.js'),'utf8');
function section(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const code=section('  function tx(','  function idbKeys(')+'\n'+section('  function migrationOwner(','  function localKeys(')+'\n'+section('  var THUMB_KEYS=','  /* 1.618 — 한 자료')+'\n'+section('  var sharedWrites=','  /* v369 — 팀 전환')+'\nvar optimizer={'+section('    optimize:function(){','    /* ── 저장 위험 안내')+'};';
function gate(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const tick=()=>new Promise(r=>setImmediate(r)),clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)),stale=e=>e.name==='StorageOwnerChangedError';
function harness(){
 const local=new Map([['ps_sync_session','{"uid":"A"}'],['ps_active_ws','team-A'],['ps_cache_owner_v1','{"uid":"A","wid":"team-A","nonce":"one"}']]),disk=new Map(),writes=[],removals=[],hooks={},diagnostics=[];
 let txNum=0;
 const c={Promise,JSON,Object,Array,String,Date,Error,STORE:'kv',DEVICE_LOCAL:{cs_drill_lib_v1:1},AUX_IDB_PREFIX:'ps_sync_base_',
  emptyish:s=>s==null||s===''||s==='[]'||s==='{}'||s==='null',isAuxIDBKey:k=>k.startsWith('ps_sync_base_'),localKeys:p=>[...local.keys()].filter(k=>k.startsWith(p)),requestPersist:async()=>true,
  diagnostic:(stage,e)=>diagnostics.push([stage,e.name]),isQuotaErr:()=>false,warnFull(){},setTimeout:f=>setImmediate(f),CustomEvent:function(){},dispatchEvent(){},migrated:Promise.resolve(),idbKeys:async()=>[],
  localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,String(v)),removeItem(k){removals.push(k);local.delete(k);}},
  async open(){if(hooks.open)await hooks.open();return {transaction(store,mode){
   const n=++txNum;let aborted=false,pending=[],scheduled=false,reading=false;const staged=new Map();
   const t={error:null,abort(){aborted=true;setImmediate(()=>t.onabort&&t.onabort());},objectStore:()=>({
    get(k){reading=true;const req={};scheduled=true;setImmediate(async()=>{try{const captured=clone(staged.has(k)?staged.get(k):disk.get(k));if(hooks.read)await hooks.read({k,n,mode});req.result=captured;if(req.onsuccess)req.onsuccess();if(!aborted){pending.forEach(f=>f());if(t.oncomplete)t.oncomplete();}}catch(e){t.error=e;if(t.onerror)t.onerror();}});return req;},
    put(v,k){staged.set(k,clone(v));pending.push(()=>{disk.set(k,clone(v));writes.push({k,v:clone(v)});});if(!scheduled){scheduled=true;setImmediate(()=>{if(!aborted&&!reading){pending.forEach(f=>f());if(t.oncomplete)t.oncomplete();}});}},
    delete(k){staged.set(k,undefined);pending.push(()=>{disk.delete(k);writes.push({k,deleted:true});});}
   })};if(hooks.transaction)hooks.transaction({n,mode});return t;
  }};}
 };
 c.window=c;vm.createContext(c);vm.runInContext(code,c);Object.assign(c.optimizer,{localBytes:()=>[...local.values()].join('').length,largestLocal:()=>[]});
 return {c,local,disk,writes,removals,hooks,diagnostics,change(mode='account',key,value){
  if(mode==='account')local.set('ps_sync_session','{"uid":"B"}');
  if(mode==='account'||mode==='team'){local.set('ps_active_ws','team-B');local.set('ps_cache_owner_v1',JSON.stringify({uid:mode==='account'?'B':'A',wid:'team-B',nonce:'two'}));}
  if(mode==='seal')local.set('ps_cache_owner_v1','{"uid":"A","wid":"team-A","nonce":"two"}');
  if(mode==='epoch')local.set('ps_ws_switch_epoch_v1','two');if(mode==='guard')local.set('ps_ws_switch_guard_v1','{"from":"team-A","to":"team-B"}');
  if(mode==='logout')local.delete('ps_sync_session');if(key){local.set(key,value);disk.set(key,clone(value));}
 }};
}
for(const key of ['scout_tool_v1','process_coach_v1','cs_perms_v1'])for(const stage of ['migration','open','transaction'])test(key+' delayed '+stage+' cannot write an earlier account document',async()=>{
 const h=harness(),g=gate(),a='{"marker":"A"}',b='{"marker":"B"}';
 if(stage==='migration')h.c.migrated=g.promise;if(stage==='open')h.hooks.open=()=>g.promise;if(stage==='transaction')h.hooks.transaction=()=>h.change('account',key,b);
 h.c.psSaveShared(key,a);const old=h.c.sharedReady(key);const rejected=assert.rejects(old,stale);await tick();if(stage!=='transaction')h.change('account',key,b);g.resolve();await rejected;
 assert.equal(h.disk.get(key),b);assert.equal(h.local.get(key),b);assert.deepEqual(h.writes,[]);await h.c.sharedReady();
});
for(const mode of ['seal','epoch','guard','logout'])test('queued shared write rejects '+mode+' changes before its put',async()=>{
 const h=harness(),g=gate(),key='scout_tool_v1';h.hooks.open=()=>g.promise;h.c.psSaveShared(key,'A');const p=h.c.sharedReady(key),rejected=assert.rejects(p,stale);await tick();h.change(mode);g.resolve();await rejected;assert.deepEqual(h.writes,[]);
});
test('normal pending source write finishes before transition seal/guard rotation',async()=>{
 const h=harness(),g=gate(),key='scout_tool_v1';h.hooks.open=()=>g.promise;h.c.psSaveShared(key,'A');const pending=h.c.sharedReady();await tick();assert.deepEqual(h.writes,[]);g.resolve();await pending;assert.equal(h.disk.get(key),'A');h.change('guard');h.change('seal');await h.c.sharedReady();assert.equal(h.writes.length,1);
});
test('a new source write during an already-owned transition is sealed to that exact guard',async()=>{
 const h=harness();h.change('guard');h.change('seal');h.c.psSaveShared('process_coach_v1','source-drain');await h.c.sharedReady();assert.equal(h.disk.get('process_coach_v1'),'source-drain');
});
test('empty shared barrier permits a new login before the prior cache is wiped and permits logout',async()=>{
 const h=harness();h.local.set('ps_sync_session','{"uid":"B"}');await h.c.sharedReady();await h.c.sharedReady('scout_tool_v1');h.change('logout');await h.c.sharedReady();assert.deepEqual(h.writes,[]);
});
test('a new login barrier discards the old queued job while old caller remains failed',async()=>{
 const h=harness(),g=gate();h.hooks.open=()=>g.promise;h.c.psSaveShared('cs_perms_v1','A-perms');const old=h.c.sharedReady(),rejected=assert.rejects(old,stale);await tick();h.local.set('ps_sync_session','{"uid":"B"}');const bootstrap=h.c.sharedReady();g.resolve();await rejected;await bootstrap;assert.deepEqual(h.writes,[]);
});
test('same-owner disk failure retries only its exact current source',async()=>{
 const h=harness(),real=h.c.storage.set;let n=0;h.c.storage.set=(...args)=>++n===1?Promise.reject(Error('temporary')):real(...args);h.c.psSaveShared('process_coach_v1','A');await h.c.sharedReady();assert.equal(n,2);assert.equal(h.disk.get('process_coach_v1'),'A');
});
test('a failed A job is never retried under B and does not block B new saves',async()=>{
 const h=harness(),real=h.c.storage.set;h.c.storage.set=()=>Promise.reject(Error('temporary'));h.c.psSaveShared('scout_tool_v1','A');await assert.rejects(h.c.sharedReady(),/temporary/);h.change('account','scout_tool_v1','B');h.c.storage.set=real;await h.c.sharedReady();assert.deepEqual(h.writes,[]);h.c.psSaveShared('scout_tool_v1','B-new');await h.c.sharedReady();assert.equal(h.disk.get('scout_tool_v1'),'B-new');
});
test('mirror entry refuses an old event value and normal mirror preserves its current source',async()=>{
 const h=harness();h.local.set('scout_tool_v1','new');await assert.rejects(h.c.psMirrorSharedAsync('scout_tool_v1','old'),stale);assert.deepEqual(h.writes,[]);await h.c.psMirrorSharedAsync('scout_tool_v1','new');assert.equal(h.disk.get('scout_tool_v1'),'new');
});
function thumb(marker){return {marker,thumb:'<svg><pattern id="psRealGrass">'+('x'.repeat(2300))+'</pattern><path fill="url(#psRealGrass)"/></svg>'};}
test('overlapping committed writes verify their own transaction and retain the newer body',async()=>{
 const h=harness(),key='process_coach_v1';
 const results=await Promise.all([h.c.idbSet(key,'first'),h.c.idbSet(key,'newer')]);
 assert.deepEqual(results,[true,true]);assert.equal(h.disk.get(key),'newer');assert.deepEqual(h.diagnostics,[]);
});
test('an aborted transaction is never a successful save',async()=>{
 const h=harness(),e=Object.assign(new Error('abort'),{name:'AbortError'});h.disk.set('key','before');
 h.c.open=async()=>({transaction(){const t={error:e,objectStore:()=>({put(){},get(){return {result:'candidate'};}})};setImmediate(()=>t.onabort());return t;}});
 await assert.rejects(h.c.idbSet('key','candidate'),x=>x===e);assert.equal(h.disk.get('key'),'before');
});
for(const object of [false,true])for(const stage of ['read','atomic-read'])test('thumbnail cleanup '+(object?'object':'string')+' '+stage+' cannot overwrite new-owner data',async()=>{
 const h=harness(),g=gate(),key='process_coach_v1',a=object?thumb('A'):JSON.stringify(thumb('A')),b=object?{marker:'B',weeks:{B:true}}:JSON.stringify({marker:'B',weeks:{B:true}});h.disk.set(key,a);
 h.hooks.read=({mode})=>(stage==='read'?mode==='readonly':mode==='readwrite')?g.promise:undefined;const p=h.c.slimKey(key,{n:0,saved:0});await tick();h.change('account',key,b);g.resolve();await p;assert.deepEqual(h.disk.get(key),b);assert.deepEqual(h.writes,[]);
});
for(const object of [false,true])test('stable thumbnail cleanup preserves other fields for '+(object?'object':'string')+' data',async()=>{
 const h=harness(),key='process_coach_v1',a=thumb('A');a.weeks={keep:[1,2]};h.disk.set(key,object?a:JSON.stringify(a));const stat={n:0,saved:0};await h.c.slimKey(key,stat);const result=object?h.disk.get(key):JSON.parse(h.disk.get(key));assert.deepEqual(result.weeks,{keep:[1,2]});assert.equal(result.marker,'A');assert.equal(result.thumb.includes('psRealGrass'),false);assert.equal(stat.n,1);assert.equal(h.writes.length,1);
});
test('same-owner newer IDB edit wins the thumbnail CAS',async()=>{
 const h=harness(),g=gate(),key='process_coach_v1',before=JSON.stringify(thumb('A')),newer=JSON.stringify({marker:'A-newer'});h.disk.set(key,before);h.hooks.read=({mode})=>mode==='readonly'?g.promise:undefined;const p=h.c.slimKey(key,{n:0,saved:0});await tick();h.disk.set(key,newer);g.resolve();await p;assert.equal(h.disk.get(key),newer);assert.deepEqual(h.writes,[]);
});
test('optimize cannot remove a new local copy after an earlier equal IDB read',async()=>{
 const h=harness(),g=gate(),key='cs_drill_lib_v1';h.c.slimThumbs=async()=>({n:0,saved:0});h.local.set(key,'A');h.disk.set(key,'A');h.hooks.read=()=>g.promise;const p=h.c.optimizer.optimize();await tick();h.change('account',key,'B');g.resolve();await assert.rejects(p,stale);assert.equal(h.local.get(key),'B');assert.equal(h.disk.get(key),'B');assert.deepEqual(h.removals,[]);
});
test('optimize cannot fill an empty IDB row after its owner changes',async()=>{
 const h=harness(),g=gate(),key='cs_drill_lib_v1';h.c.slimThumbs=async()=>({n:0,saved:0});h.local.set(key,'A');h.hooks.read=({mode})=>mode==='readwrite'?g.promise:undefined;const p=h.c.optimizer.optimize();await tick();h.change('account',key,'B');g.resolve();await assert.rejects(p,stale);assert.equal(h.local.get(key),'B');assert.equal(h.disk.get(key),'B');assert.deepEqual(h.writes,[]);assert.deepEqual(h.removals,[]);
});
test('normal optimize migrates a device-local copy only after exact verification',async()=>{
 const h=harness(),key='cs_drill_lib_v1';h.c.slimThumbs=async()=>({n:0,saved:0});h.local.set(key,'A');const r=await h.c.optimizer.optimize();assert.equal(h.disk.get(key),'A');assert.equal(h.local.has(key),false);assert.deepEqual(Array.from(r.moved),[key]);
});
test('an optimization waiting for image migration cannot begin work on the next account',async()=>{
 const h=harness(),g=gate();h.c.PSImg={migrate:()=>g.promise};let slimmed=0;h.c.slimThumbs=async()=>{slimmed++;return {n:0,saved:0};};const p=h.c.optimizer.optimize(),rejected=assert.rejects(p,stale);h.change('account');g.resolve({moved:0});await rejected;assert.equal(slimmed,0);assert.deepEqual(h.writes,[]);
});
function installReadOnlyGate(h){
 const perms=fs.readFileSync(path.join(__dirname,'../studio/perms.js'),'utf8'),a=perms.indexOf('  function gate(section, opts){'),b=perms.indexOf('  window.PSPerms=',a);
 Object.assign(h.c,{document:{addEventListener(){},body:{classList:{add(){}}}},addEventListener(){},setInterval:()=>0,clearInterval(){},location:{reload(){}},canEdit:()=>false,sess:()=>JSON.parse(h.local.get('ps_sync_session')),perms:()=>({defaultRole:'player'}),label:()=>'',banner(){},hideControls(){},syncedKey:k=>['scout_tool_v1','process_coach_v1','cs_perms_v1'].includes(k),toast(){}});
 vm.runInContext(perms.slice(a,b),h.c);h.c.gate('team');
}
test('actual read-only permission adapter cannot make a no-op shared save look committed',async()=>{
 const h=harness(),key='scout_tool_v1';h.local.set(key,'old');h.disk.set(key,'old');installReadOnlyGate(h);
 assert.equal(h.c.psSaveShared(key,'new'),false);await assert.rejects(h.c.psSaveSharedAsync(key,'new'),/mirror write rejected/);await assert.rejects(h.c.sharedReady(key),/write rejected/);
 assert.equal(h.local.get(key),'old');assert.equal(h.disk.get(key),'old');assert.deepEqual(h.writes,[]);
});
test('undefined adapter completion is not a verified shared write',async()=>{
 const h=harness();h.c.storage.set=async()=>undefined;h.c.psSaveShared('scout_tool_v1','new');await assert.rejects(h.c.sharedReady(),/write rejected/);assert.deepEqual(h.writes,[]);
});
test('read-only wrapper preserves optional owner checks for allowed auxiliary writes and deletion',async()=>{
 const h=harness(),g=gate(),key='ps_sync_base_team-A_process_coach_v1';installReadOnlyGate(h);h.hooks.open=()=>g.promise;
 const current=h.c.migrationCurrent(key,null),p=h.c.storage.set(key,'A',current),rejected=assert.rejects(p,stale);await tick();h.change('account',key,'B');g.resolve();await rejected;assert.equal(h.disk.get(key),'B');assert.deepEqual(h.writes,[]);
 let checks=0;await assert.rejects(h.c.storage.del(key,()=>{checks++;throw Object.assign(Error('stale'),{name:'StorageOwnerChangedError'});}),stale);assert.equal(checks,1);assert.equal(h.disk.get(key),'B');
});
test('an optimization finishing persistence wait cannot report success to a new account',async()=>{
 const h=harness(),g=gate();h.c.requestPersist=()=>g.promise;let events=0;h.c.dispatchEvent=()=>events++;const p=h.c.optimizer.optimize(),rejected=assert.rejects(p,stale);await tick();h.change('account');g.resolve(true);await rejected;assert.equal(events,0);
});
test('auxiliary read verification cannot remove the next account local source',async()=>{
 const h=harness(),g=gate(),key='ps_sync_base_team-A_process_coach_v1';h.local.set(key,'A');h.disk.set(key,'A');h.hooks.read=()=>g.promise;const p=h.c.auxGet(key),rejected=assert.rejects(p,stale);await tick();h.change('account',key,'B');g.resolve();await rejected;assert.equal(h.local.get(key),'B');assert.equal(h.disk.get(key),'B');assert.deepEqual(h.removals,[]);
});
test('lazy read fallback cannot write or return old data after an account switch before its CAS',async()=>{
 const h=harness(),g=gate(),key='scout_tool_v1';h.local.set(key,'A-fallback');let opens=0;h.hooks.open=()=>++opens===2?g.promise:undefined;const p=h.c.storage.get(key),rejected=assert.rejects(p,stale);while(opens<2)await tick();h.change('account',key,'B-current');g.resolve();await rejected;assert.equal(h.disk.get(key),'B-current');assert.equal(h.local.get(key),'B-current');assert.deepEqual(h.writes,[]);
});
test('lazy fallback preserves a newer row appearing after the initial empty read',async()=>{
 const h=harness(),g=gate(),key='scout_tool_v1';h.local.set(key,'local-older');let opens=0;h.hooks.open=()=>++opens===2?g.promise:undefined;const p=h.c.storage.get(key);while(opens<2)await tick();h.disk.set(key,'newer-idb');g.resolve();assert.equal((await p).value,'newer-idb');assert.equal(h.disk.get(key),'newer-idb');assert.equal(h.local.get(key),'local-older');assert.deepEqual(h.writes,[]);
});
test('normal lazy fallback migrates a stable source and removes only its verified device-local copy',async()=>{
 const h=harness(),key='cs_drill_lib_v1';h.local.set(key,'stable');assert.equal((await h.c.storage.get(key)).value,'stable');assert.equal(h.disk.get(key),'stable');assert.equal(h.local.has(key),false);assert.equal(h.writes.length,1);
});
test('unverified login cache can be inspected without performing an implicit migration write',async()=>{
 const h=harness(),key='scout_tool_v1';h.local.set(key,'legacy');h.local.set('ps_sync_session','{"uid":"B"}');assert.equal((await h.c.storage.get(key)).value,'legacy');assert.deepEqual(h.writes,[]);assert.equal(h.local.get(key),'legacy');
});
test('an existing-row read cannot deliver the previous account response',async()=>{
 const h=harness(),g=gate(),key='cs_perms_v1';h.disk.set(key,'A');h.hooks.read=()=>g.promise;const p=h.c.storage.get(key),rejected=assert.rejects(p,stale);await tick();h.change('account',key,'B');g.resolve();await rejected;assert.deepEqual(h.writes,[]);
});

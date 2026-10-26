'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'../studio',f),'utf8'),html=read('process.html'),storage=read('storage.js');
function section(source,a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
const tick=()=>new Promise(r=>setImmediate(r)),KEY='process_coach_v1';
function harness(mode='ls'){
 const local=new Map([['ps_sync_session','{"uid":"A"}'],['ps_active_ws','team-A'],['ps_cache_owner_v1','{"uid":"A","wid":"team-A","nonce":1}'],[KEY,'old mirror']]),disk=new Map([[KEY,'old durable']]),commits=[],states=[],toasts=[],removed=[],calls={touch:0,checks:0,optimize:0},hooks={};
 const c={Promise,JSON,Date,Math,Object,Array,String,Number,Error,console,setTimeout:()=>0,
  STORE_KEY:KEY,weeksMap:{0:[{d:'월',trainings:[{slot:'S1',note:'new synthetic note'}]}]},__schedBase:null,__schedGrpWeeks:{},myTemplates:[],ddayLabel:'',seasonPlan:{},__ANCHOR:new Date(2026,9,26),__schedRev:1,__schedSavedRaw:'',__schedLocalGen:0,__schedWriteSeq:0,__schedWritePending:false,__schedWriteStartGen:0,__histRawNext:null,
  document:{getElementById:()=>null},localStorage:{getItem:k=>local.get(k)??null,setItem(k,v){if(k===KEY&&mode!=='normal')throw Object.assign(Error('synthetic small-store quota'),{name:'QuotaExceededError'});local.set(k,String(v));},removeItem(k){removed.push(k);local.delete(k);}},
  storage:{set(k,raw,current){const d=deferred();commits.push({k,raw,...d});return d.promise.then(ok=>{if(current)current();if(ok===true)disk.set(k,raw);return ok;});}},
  afterMigrate:fn=>Promise.resolve().then(fn),idbGet:k=>Promise.resolve(disk.get(k)),
  PSSaveState:{begin:s=>states.push([s,'saving']),ok:s=>states.push([s,'saved']),fail:(s,e)=>states.push([s,'failed',e?.name])},
  PSSchedule:{stampIds(){},check(){calls.checks++;return Promise.resolve(true);}},
  toast:t=>toasts.push(t),schedThumbDiet(){},saveCursor(){},pushHist(){},__schedTouch(){calls.touch++;},__schedUpdateSignal(){},__schedDrainIncoming(){}
 };
 c.window=c;c.queueMicrotask=f=>Promise.resolve().then(f);vm.createContext(c);
 vm.runInContext(section(storage,'  function migrationOwner(','  function localKeys(')+section(storage,'  var sharedWrites={},sharedLatest={};','  function auxGet(')+section(storage,'  window.psSaveShared=function','  afterMigrate(function(){'),c);
 c.PSStorage={sharedReady:c.sharedReady,sharedCommitted:c.sharedCommitted,sharedVerified:c.sharedVerified,optimize:()=>{calls.optimize++;return hooks.optimize?hooks.optimize():Promise.resolve({freed:0});}};
 vm.runInContext(section(html,'var __saveQueued=false;','function loadState(opt){'),c);
 return{c,local,disk,commits,states,toasts,removed,calls,hooks,ownerChanged(kind='team'){
  if(kind==='team'){local.set('ps_active_ws','team-B');local.set('ps_cache_owner_v1','{"uid":"A","wid":"team-B","nonce":2}');}
  if(kind==='seal')local.set('ps_cache_owner_v1','{"uid":"A","wid":"team-A","nonce":2}');
  if(kind==='epoch')local.set('ps_ws_switch_epoch_v1','2');
  if(kind==='guard')local.set('ps_ws_switch_guard_v1','{"token":"other","from":"team-A","to":"team-B"}');
 }};
}
test('schedule LS quota waits for its attempted durable write, then removes only the exact old mirror',async()=>{
 const h=harness();assert.equal(h.c.saveNow(),true,'accepted for durable confirmation');assert.equal(h.c.__schedLocalGen,1);assert.equal(h.c.psHasPending(),true);let done=false;const p=h.c.psFlushPendingReady().then(()=>done=true);
 await tick();assert.equal(done,false);assert.equal(h.commits.length,1);assert.equal(h.local.get(KEY),'old mirror');assert.equal(h.states.at(-1)[1],'saving');
 h.commits[0].resolve(true);await p;assert.equal(h.disk.get(KEY),h.commits[0].raw);assert.equal(h.local.has(KEY),false);assert.deepEqual(h.removed,[KEY]);assert.equal(h.c.psHasPending(),false);assert.equal(h.states.at(-1)[1],'saved');assert.ok(h.calls.touch>0);
});
test('failed IDB confirmation keeps the draft and transition barrier blocked without replaying stale bytes',async()=>{
 const h=harness();h.c.saveNow();await tick();h.commits[0].reject(Error('synthetic durable failure'));await tick();
 await assert.rejects(h.c.psFlushPendingReady());assert.equal(h.c.psHasPending(),true);assert.equal(h.c.__schedWritePending,true);assert.equal(h.local.get(KEY),'old mirror');assert.equal(h.disk.get(KEY),'old durable');assert.equal(h.c.weeksMap[0][0].trainings[0].note,'new synthetic note');assert.equal(h.commits.length,1);assert.equal(h.states.at(-1)[1],'failed');assert.equal(h.calls.optimize,0,'an ambiguous failed confirmation never replays an old write');
});
for(const change of ['team','seal','epoch','guard','mirror','idb'])test('durable completion cannot acknowledge changed '+change,async()=>{
 const h=harness();h.c.PSStorage.optimize=null;h.c.saveNow();await tick();
 if(change==='mirror')h.local.set(KEY,'newer mirror');else if(change!=='idb')h.ownerChanged(change);
 if(change==='idb'){const get=h.c.idbGet;h.c.idbGet=k=>get(k).then(v=>k===KEY?'newer durable':v);}
 h.commits[0].resolve(true);await tick();await assert.rejects(h.c.psFlushPendingReady());assert.deepEqual(h.removed,[]);assert.equal(h.states.filter(s=>s[1]==='saved').length,0);
});
test('an obsolete failure cannot replace the latest successful edit or its completion label',async()=>{
 const h=harness();h.c.PSStorage.optimize=null;h.c.saveNow();await tick();const barrier=h.c.psFlushPendingReady();h.c.weeksMap[0][0].trainings[0].note='latest synthetic edit';h.c.saveNow();
 h.commits[0].reject(Error('obsolete failure'));await tick();assert.equal(h.commits.length,2);h.commits[1].resolve(true);await h.c.psFlushPendingReady();
 await barrier;assert.equal(JSON.parse(h.disk.get(KEY)).weeks[0][0].trainings[0].note,'latest synthetic edit');assert.equal(h.states.at(-1)[1],'saved');assert.equal(h.c.psHasPending(),false);assert.equal(h.c.__schedLocalGen,2);
});
test('the matching quota warning recovers only after exact durable confirmation and mirror removal',async()=>{
 const h=harness(),g=deferred();let recovered=false;h.c.PSStorage.sharedRecovered=(k,raw)=>{assert.equal(k,KEY);assert.equal(h.disk.get(k),raw);assert.equal(h.local.has(KEY),false);return g.promise.then(()=>recovered=true);};
 h.c.saveNow();await tick();h.commits[0].resolve(true);await tick();assert.equal(h.c.psHasPending(),true);assert.equal(h.states.filter(s=>s[1]==='saved').length,0);g.resolve(true);await h.c.psFlushPendingReady();assert.equal(recovered,true);assert.equal(h.states.at(-1)[1],'saved');
});
test('a normal accepted schedule write also recovers its exact earlier quota failure',async()=>{
 const h=harness('normal'),g=deferred();let recovered=false;
 h.c.PSStorage.sharedRecovered=(k,raw,current)=>{assert.equal(k,KEY);assert.equal(h.disk.get(k),raw);assert.equal(h.local.get(k),raw);assert.equal(current(),true);return g.promise.then(()=>{assert.equal(current(),true);recovered=true;});};
 h.c.saveNow();await tick();h.commits[0].resolve(true);await tick();
 assert.equal(h.c.psHasPending(),true);assert.equal(h.states.filter(s=>s[1]==='saved').length,0);
 g.resolve();await h.c.psFlushPendingReady();assert.equal(recovered,true);assert.equal(h.c.psHasPending(),false);assert.equal(h.states.at(-1)[1],'saved');
});
for(const change of ['owner','edit'])test('normal quota recovery still vetoes a changed '+change,async()=>{
 const h=harness('normal'),g=deferred();let current;
 h.c.PSStorage.sharedRecovered=(k,raw,guard)=>{current=guard;return g.promise.then(()=>guard());};
 h.c.saveNow();await tick();h.commits[0].resolve(true);await tick();assert.equal(typeof current,'function');
 if(change==='owner')h.ownerChanged();else h.c.__schedWriteSeq++;
 assert.throws(()=>current(),/changed|stale|저장|이동|바뀌/);g.resolve();await tick();
 assert.equal(h.states.filter(s=>s[1]==='saved').length,0);assert.equal(h.c.psHasPending(),true);
});
for(const change of ['team','seal','epoch','guard'])test('quota tidy never retries an old draft after changed '+change,async()=>{
 const h=harness(),g=deferred();h.hooks.optimize=()=>g.promise;h.c.psSaveShared=null;h.c.saveNow();await tick();assert.equal(h.c.__schedTidying,true);assert.equal(h.c.psHasPending(),true);
 h.ownerChanged(change);g.resolve({freed:1000});await tick();await tick();await assert.rejects(h.c.psFlushPendingReady());assert.equal(h.commits.length,0);assert.equal(h.local.get(KEY),'old mirror');assert.equal(h.toasts.length,0);assert.equal(h.states.filter(s=>s[1]==='saved').length,0);
});

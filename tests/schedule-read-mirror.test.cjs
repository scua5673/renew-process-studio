'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/storage.js'),'utf8'),KEY='process_coach_v1';
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);}
function harness(){
 const local=new Map([[KEY,'old'],['ps_sync_session','{"uid":"fixture-user"}'],['ps_active_ws','fixture-team'],['ps_cache_owner_v1','fixture-owner']]);
 const disk=new Map([[KEY,'new']]),writes=[],warnings=[],queued=[];
 const state={active:false,beforeRead:null,quota:false,error:null,readError:null,current:true};
 const c={Promise,Object,String,JSON,Error,console:{warn(){}},optionalMirrorKey:'',AUX_RECOVERY:{},
  localStorage:{getItem:k=>local.get(k)??null,setItem(k,v){writes.push({key:k,raw:v,readonly:state.active});if(state.error)throw state.error;if(state.quota)throw Object.assign(Error('fixture quota'),{name:'QuotaExceededError'});local.set(k,v);}},
  isQuotaErr:e=>e?.name==='QuotaExceededError',warnFull:k=>warnings.push(k),afterMigrate:fn=>Promise.resolve().then(fn),
  open:()=>Promise.resolve({transaction(store,mode){assert.equal(mode,'readonly');assert.equal(store,'kv');state.active=true;
   const t={error:null,objectStore:()=>({get(k){const req={result:undefined};queueMicrotask(()=>{
    if(state.beforeRead)state.beforeRead();
    if(state.readError){req.error=state.readError;t.onerror({target:req});}
    else{req.result=disk.get(k);req.onsuccess?.();t.oncomplete();}
    state.active=false;for(const fn of queued.splice(0))fn();
   });return req;}}),abort(){state.active=false;}};return t;}}),
  STORE:'kv',idbErr:(ev,t)=>ev.target.error||t.error};
 vm.createContext(c);vm.runInContext(section('  function tx(mode,fn){','  /* 2.916 — IDB 가 돌려주는 오류')+'\n'+section('    var _si=localStorage.setItem.bind(localStorage);','  }catch(_){}')+'\n'+section('  function sharedReadContext(){','  function sharedCapture(')+'\n'+section('  function mirrorSchedule(raw,current){','  /* 큰 보조 사본 전용 API.'),c);
 return{c,local,disk,writes,warnings,state,current:()=>state.current,queueWriter(raw){if(state.active)queued.push(()=>disk.set(KEY,raw));else disk.set(KEY,raw);}};
}
test('an exact optional read mirrors only inside the real readonly transaction without an IDB write',async()=>{
 const h=harness(),result=await h.c.mirrorSchedule('new',h.current);assert.equal(result.ok,true);assert.equal(result.quota,false);assert.equal(result.stale,false);
 assert.equal(h.local.get(KEY),'new');assert.equal(h.disk.get(KEY),'new');assert.deepEqual(h.writes,[{key:KEY,raw:'new',readonly:true}]);assert.deepEqual(h.warnings,[]);
});
test('a newer durable body makes an old read stale without any mirror or warning',async()=>{
 const h=harness();h.state.beforeRead=()=>h.disk.set(KEY,'newer');const result=await h.c.mirrorSchedule('new',h.current);
 assert.equal(result.stale,true);assert.equal(result.ok,false);assert.equal(h.local.get(KEY),'old');assert.equal(h.disk.get(KEY),'newer');assert.deepEqual(h.writes,[]);assert.deepEqual(h.warnings,[]);
});
for(const change of ['owner','mirror','current','throw'])test('a changed '+change+' at request completion prevents the optional mirror',async()=>{
 const h=harness();h.state.beforeRead=()=>{if(change==='owner')h.local.set('ps_cache_owner_v1','another-owner');if(change==='mirror')h.local.set(KEY,'newer-local');if(change==='current')h.state.current=false;if(change==='throw')h.state.current='throw';};
 await assert.rejects(h.c.mirrorSchedule('new',()=>{if(h.state.current==='throw')throw Error('new edit');return h.current();}));
 assert.deepEqual(h.writes,[]);assert.deepEqual(h.warnings,[]);assert.equal(h.disk.get(KEY),'new');
});
test('only optional schedule quota is suppressed and its original remains intact',async()=>{
 const h=harness();h.state.quota=true;const result=await h.c.mirrorSchedule('new',h.current);
 assert.equal(result.quota,true);assert.equal(result.ok,false);assert.equal(h.local.get(KEY),'old');assert.equal(h.disk.get(KEY),'new');assert.deepEqual(h.warnings,[]);assert.equal(h.c.optionalMirrorKey,'');
 assert.throws(()=>h.c.localStorage.setItem(KEY,'authored'));assert.deepEqual(h.warnings,[KEY]);
});
test('an unrelated failed key still warns while the optional schedule mirror is running',async()=>{
 const h=harness(),native=h.c.localStorage.setItem;h.state.quota=true;h.c.localStorage.setItem=(k,v)=>{if(k===KEY)assert.throws(()=>native('scout_tool_v1','authored'));return native(k,v);};
 const result=await h.c.mirrorSchedule('new',h.current);assert.equal(result.quota,true);assert.deepEqual(h.warnings,['scout_tool_v1']);assert.equal(h.c.optionalMirrorKey,'');
});
test('permission errors reject, restore suppression and cannot masquerade as a quota recovery',async()=>{
 const h=harness();h.state.error=Object.assign(Error('permission denied'),{name:'SecurityError'});await assert.rejects(h.c.mirrorSchedule('new',h.current),/permission denied/);
 assert.equal(h.local.get(KEY),'old');assert.equal(h.c.optionalMirrorKey,'');assert.deepEqual(h.warnings,[]);
});
test('a failed durable read cannot write a mirror or clear any warning',async()=>{
 const h=harness();h.state.readError=Error('read failed');await assert.rejects(h.c.mirrorSchedule('new',h.current),/read failed/);assert.deepEqual(h.writes,[]);assert.deepEqual(h.warnings,[]);
});
test('a writer queued during the readonly check commits after the exact mirror copy',async()=>{
 const h=harness();h.state.beforeRead=()=>h.queueWriter('later');const result=await h.c.mirrorSchedule('new',h.current);
 assert.equal(result.ok,true);assert.equal(h.writes[0].raw,'new');assert.equal(h.writes[0].readonly,true);assert.equal(h.disk.get(KEY),'later');
});

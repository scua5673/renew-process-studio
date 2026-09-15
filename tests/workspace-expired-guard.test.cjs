'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(require('node:path').join(__dirname,'../studio/sync.js'),'utf8');
const part=(a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const code=part('function withWorkspaceTransitionLock(fn){','function tryWorkspaceTransitionLock(fn){')+part('function loadWorkspaces(){','function signIn(provider){')+part('function clearExpiredWorkspaceGuard(lock){','function workspaceSwitchGuardStart(from,to){');
function fixture({noLock=false,active=false,changedAccount=false,malformed=false}={}){
 const key='ps_ws_switch_guard_v1',raw=malformed?'broken':JSON.stringify({v:1,token:'old',from:'team',at:Date.now()-(active?1000:100000)});
 const data=new Map([[key,raw],['ps_ws_switch_epoch_v1','retained-epoch'],['draft','retained draft']]);let inside=false,boot=0,removed=0;
 const c={Promise,Date,JSON,isFinite,WORKSPACE_TRANSITION_LOCK:'process-studio-workspace-transition-v1',WS_SWITCH_GUARD:key,authPreparePromise:null,
 navigator:noLock?{}:{locks:{request:async(name,opts,fn)=>{inside=true;try{return await fn({name,mode:opts.mode});}finally{inside=false;}}}},
 getSess:()=>({uid:'a'}),sessionIdentitySnapshot:x=>x,authPreparationCurrent:()=>!changedAccount,dataLockError:()=>Error('locked'),expireStashes(){},
 workspaceSwitchGuardRaw:()=>data.get(key)||'',localStorage:{removeItem:k=>{assert.equal(inside,true);removed++;data.delete(k);}},
 loadWorkspacesCore:async()=>{boot++;return[];}};
 vm.createContext(c);vm.runInContext(code,c);return{c,data,key,raw,get boot(){return boot;},get removed(){return removed;}};
}
test('bootstrap clears only an expired guard while holding the transition lock, retaining epoch and data',async()=>{
 const f=fixture();await f.c.loadWorkspaces();assert.equal(f.removed,1);assert.equal(f.boot,1);assert.equal(f.data.get('ps_ws_switch_epoch_v1'),'retained-epoch');assert.equal(f.data.get('draft'),'retained draft');
});
for(const opt of [{noLock:true},{active:true},{malformed:true}])test('bootstrap preserves guard for '+JSON.stringify(opt),async()=>{
 const f=fixture(opt);await f.c.loadWorkspaces();assert.equal(f.removed,0);assert.equal(f.data.get(f.key),f.raw);
});
test('a changed account waiting for the lock cannot clear guard or bootstrap',async()=>{
 const f=fixture({changedAccount:true});await assert.rejects(f.c.loadWorkspaces(),/locked/);assert.equal(f.removed,0);assert.equal(f.boot,0);
});
test('a replaced guard is not removed even under the lock',async()=>{
 const f=fixture();let reads=0;f.c.workspaceSwitchGuardRaw=()=>++reads===1?f.raw:'new guard';await f.c.loadWorkspaces();assert.equal(f.removed,0);
});

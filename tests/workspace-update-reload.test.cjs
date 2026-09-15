'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
const code=app.slice(app.indexOf('function psReloadWorkspaceSeal(){'),app.indexOf('/* ⚠ 2.395'))+'\n'+app.slice(app.indexOf('function psAutoReloadWhenSafe(){'),app.indexOf('/* 2.627 — 새 판 띠.'));
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(options={}){
 const data=new Map([['ps_active_ws','team-a'],['ps_cache_owner_v1','owner-a'],['ps_ws_switch_epoch_v1','epoch-a']]),polls=[];
 let reloads=0,flushes=0,locked=!!options.locked;const hooks={};
 const c={Date,JSON,Promise,localStorage:{getItem:k=>data.get(k)||null},document:{hidden:!!options.hidden,querySelector:()=>null,querySelectorAll:()=>[],body:{classList:{contains:()=>false}},addEventListener(){}},
 navigator:options.noLocks?{}:{locks:{request:async(name,opts,fn)=>{assert.equal(name,'process-studio-workspace-transition-v1');assert.equal(opts.ifAvailable,true);return fn(locked?null:{});}}},
 location:{reload(){reloads++;}},psShowUpdBand(){},psFlushAllPendingReady:async()=>{flushes++;if(hooks.flush)await hooks.flush();},setTimeout:()=>0,setInterval:fn=>polls.push(fn)};
 c.window=c;vm.createContext(c);vm.runInContext(code,c);
 return {c,data,hooks,polls,get reloads(){return reloads;},get flushes(){return flushes;},unlock(){locked=false;},guard(){data.set('ps_ws_switch_guard_v1',JSON.stringify({token:'switch-a',from:'team-a',at:Date.now()}));}};
}
for(const hidden of [true,false])test('update waits through an active workspace transition even when hidden='+hidden,async()=>{
 const f=fixture({hidden});f.guard();f.c.psAutoReloadWhenSafe();await tick();assert.equal(f.reloads,0);assert.equal(f.flushes,0);
 f.data.delete('ps_ws_switch_guard_v1');f.polls[0]();await tick();assert.equal(f.reloads,1);
});
test('a bootstrap/transition lock blocks automatic update before flushing and retries later',async()=>{
 const f=fixture({locked:true,hidden:true});f.c.psAutoReloadWhenSafe();await tick();assert.equal(f.reloads,0);assert.equal(f.flushes,0);
 f.unlock();f.polls[0]();await tick();assert.equal(f.reloads,1);
});
for(const key of ['ps_active_ws','ps_cache_owner_v1','ps_ws_switch_epoch_v1'])test('a changed '+key+' while flushing cancels the update',async()=>{
 const f=fixture({noLocks:true,hidden:true});f.hooks.flush=()=>f.data.set(key,'new-owner');f.c.psAutoReloadWhenSafe();await tick();assert.equal(f.reloads,0);assert.equal(f.c.__psReloading,0);
});
test('a transition started while flushing cannot be interrupted by a reload',async()=>{
 const f=fixture({noLocks:true,hidden:true});f.hooks.flush=()=>f.guard();f.c.psAutoReloadWhenSafe();await tick();assert.equal(f.reloads,0);
});
test('failed pending storage never reloads or leaves the update permanently busy',async()=>{
 const f=fixture({hidden:true});f.hooks.flush=()=>{throw Error('storage failed');};f.c.psAutoReloadWhenSafe();await tick();assert.equal(f.reloads,0);assert.equal(f.c.__psReloading,0);
 delete f.hooks.flush;f.polls[0]();await tick();assert.equal(f.reloads,1);
});

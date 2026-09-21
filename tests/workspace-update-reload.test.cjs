'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
const code=app.slice(app.indexOf('function psReloadWorkspaceSeal(){'),app.indexOf('/* ⚠ 2.395'))+'\n'+app.slice(app.indexOf('function psUpdateStatus('),app.indexOf('</script>',app.indexOf('function psUpdateStatus(')));
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(options={}){
 const data=new Map([['ps_active_ws','team-a'],['ps_cache_owner_v1','owner-a'],['ps_ws_switch_epoch_v1','epoch-a']]),polls=[];
 let reloads=0,flushes=0,locked=!!options.locked;const hooks={},timers=[];
 const elements={};for(const id of ['updBanner','updNow','updLater','updMessage'])elements[id]={style:{display:'none'},textContent:'',addEventListener(type,fn){this[type]=fn;}};
 const c={Date,JSON,Promise,localStorage:{getItem:k=>data.get(k)||null},document:{getElementById:id=>elements[id],hidden:!!options.hidden,querySelector:()=>null,querySelectorAll:()=>[],body:{classList:{contains:()=>false}},addEventListener(){}},
 navigator:options.noLocks?{}:{locks:{request:async(name,opts,fn)=>{assert.equal(name,'process-studio-workspace-transition-v1');assert.equal(opts.ifAvailable,true);return fn(locked?null:{});}}},
 location:{reload(){reloads++;}},psShowUpdBand(){},psFlushAllPendingReady:async()=>{flushes++;if(hooks.flush)await hooks.flush();},setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},clearTimeout:t=>{if(t)t.cancelled=true;},setInterval:fn=>polls.push(fn)};
 c.window=c;vm.createContext(c);vm.runInContext(code,c);
 return {c,data,hooks,polls,elements,timers,get reloads(){return reloads;},get flushes(){return flushes;},unlock(){locked=false;},guard(){data.set('ps_ws_switch_guard_v1',JSON.stringify({token:'switch-a',from:'team-a',at:Date.now()}));}};
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

test('Later remains dismissed after repeated save failures and delayed notification',async()=>{
 const f=fixture({hidden:true});f.hooks.flush=()=>{throw Error('disk');};f.c.psAutoReloadWhenSafe();await tick();
 assert.equal(f.elements.updBanner.style.display,'flex');f.elements.updLater.click();
 for(let i=0;i<3;i++){f.polls[0]();await tick();assert.equal(f.elements.updBanner.style.display,'none');}
 f.timers.find(t=>t.ms===60000).fn();assert.equal(f.elements.updBanner.style.display,'none');assert.equal(f.reloads,0);
 delete f.hooks.flush;f.polls[0]();await tick();assert.equal(f.reloads,1,'dismissal does not disable safe updates');
});
test('manual retry reports pending save then explains failure and permits retry',async()=>{
 const f=fixture();f.c.document.activeElement={tagName:'INPUT'};f.c.psAutoReloadWhenSafe();f.c.psShowUpdBand();
 let reject;f.hooks.flush=()=>new Promise((_,r)=>reject=r);f.elements.updNow.click();await tick();
 assert.equal(f.elements.updNow.disabled,true);assert.match(f.elements.updMessage.textContent,/저장/);assert.equal(f.reloads,0);
 reject(Error('disk'));await tick();assert.equal(f.elements.updNow.disabled,false);assert.match(f.elements.updMessage.textContent,/확인하지 못해/);
 delete f.hooks.flush;f.elements.updNow.click();await tick();assert.equal(f.reloads,1);
});
test('manual reload during workspace transition explains the wait without flushing',async()=>{
 const f=fixture();f.guard();f.c.psAutoReloadWhenSafe();f.c.psShowUpdBand();f.elements.updNow.click();await tick();
 assert.match(f.elements.updMessage.textContent,/전환 중/);assert.equal(f.flushes,0);assert.equal(f.reloads,0);
});
test('a timed out save cannot cause a late reload, and retry can succeed',async()=>{
 const f=fixture({hidden:true});let resolve;f.hooks.flush=()=>new Promise(r=>resolve=r);f.c.psAutoReloadWhenSafe();await tick();
 f.timers.find(t=>t.ms===20000).fn();assert.equal(f.c.__psReloading,0);assert.match(f.elements.updMessage.textContent,/지연/);
 resolve();await tick();assert.equal(f.reloads,0);
 delete f.hooks.flush;f.elements.updNow.click();await tick();assert.equal(f.reloads,1);
});

test('manual click during an automatic save shows progress without a second flush',async()=>{
 const f=fixture({hidden:true});let resolve;f.hooks.flush=()=>new Promise(r=>resolve=r);f.c.psShowUpdBand();f.c.psAutoReloadWhenSafe();await tick();
 f.elements.updNow.click();assert.equal(f.elements.updNow.disabled,true);assert.match(f.elements.updMessage.textContent,/保存|저장/);assert.equal(f.flushes,1);
 resolve();await tick();assert.equal(f.reloads,1);
});

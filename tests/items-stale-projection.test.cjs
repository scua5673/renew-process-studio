'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Q=require('../studio/sync-items-stale.js');

function events(){
 const listeners=new Map();
 return {addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},dispatch(type,detail){for(const fn of [...(listeners.get(type)||[])])fn({...((detail&&typeof detail==='object')?detail:{}),type,detail});},listenerCount(type){return listeners.get(type)?.size||0;}};
}
function fixture(){
 const parent=events(),child=events(),timers=new Map(),notified=[],writes=[];let next=0,unlocked=true,state={kind:'ok',at:0},scope='uid-a/wid-a/seal-a/epoch-a';
 parent.PSSync={dataUnlocked:()=>unlocked,state:()=>state};child.parent=parent;
 child.setTimeout=(fn,delay)=>{assert.equal(delay,0,'projection updates are coalesced on the child next task');timers.set(++next,fn);return next;};child.clearTimeout=id=>timers.delete(id);
 child.localStorage={setItem(){writes.push('localStorage');throw Error('projection notification must not write storage');}};child.storage={set(){writes.push('IDB');throw Error('projection notification must not write storage');}};
 const flush=()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn();}};
 return {parent,child,timers,notified,writes,flush,scope:()=>scope,notify:()=>notified.push({scope,state:{...state}}),setScope:v=>scope=v,setUnlocked:v=>unlocked=v,setState:v=>state=v,complete(){parent.dispatch('ps-sync-state',state);}};
}

test('projection watcher: initial and duplicate parent completion coalesce one authorized notification',()=>{
 const h=fixture();Q.watchProjection(h.child,h.scope,h.notify);assert.equal(h.notified.length,0,'initial projection must not run synchronously');h.complete();h.complete();
 assert.equal(h.timers.size,1);h.flush();assert.equal(h.notified.length,1);assert.equal(h.notified[0].scope,h.scope());assert.equal(h.notified[0].state.at,0);assert.deepEqual(h.writes,[]);
});

test('projection watcher: busy, locked, unloaded, and owner changed after enqueue never notify',()=>{
 for(const mode of ['busy','locked','unloaded','owner-change','lock-after','busy-after','unload-after']){
  const h=fixture();if(mode==='busy')h.setState({kind:'busy',at:1});if(mode==='locked')h.setUnlocked(false);if(mode==='unloaded')h.setScope(null);
  Q.watchProjection(h.child,h.scope,h.notify);
  if(mode==='owner-change')h.setScope('uid-b/wid-b/seal-b/epoch-b');if(mode==='lock-after')h.setUnlocked(false);if(mode==='busy-after')h.setState({kind:'busy',at:2});if(mode==='unload-after')h.setScope(null);
  h.flush();assert.equal(h.notified.length,0,mode);assert.deepEqual(h.writes,[],mode);
 }
});

test('projection watcher: timestamp zero deduplicates but a later completion or separately loaded owner can project',()=>{
 const h=fixture();Q.watchProjection(h.child,h.scope,h.notify);h.flush();assert.equal(h.notified.length,1);
 h.complete();h.complete();h.flush();assert.equal(h.notified.length,1,'at=0 is a real completion identity');
 h.setState({kind:'ok',at:1});h.complete();h.complete();h.flush();assert.equal(h.notified.length,2);
 h.complete();h.flush();assert.equal(h.notified.length,2);h.setScope('uid-a/wid-b/seal-b/epoch-b');h.complete();h.flush();assert.equal(h.notified.length,3,'new complete owner scope is a distinct projection identity');assert.deepEqual(h.writes,[]);
});

test('projection watcher: pagehide and unload cancel queued work and detach the parent completion listener',()=>{
 for(const ending of ['pagehide','unload']){
  const h=fixture();Q.watchProjection(h.child,h.scope,h.notify);assert.ok(h.parent.listenerCount('ps-sync-state')>0);h.child.dispatch(ending);h.flush();assert.equal(h.notified.length,0,ending);assert.equal(h.parent.listenerCount('ps-sync-state'),0,ending);
  h.setState({kind:'ok',at:2});h.complete();assert.equal(h.timers.size,0);h.flush();assert.equal(h.notified.length,0);assert.deepEqual(h.writes,[]);
 }
});

test('projection added: a child initially unloaded recovers when its complete owner scope becomes available',()=>{
 const h=fixture();h.setScope(null);Q.watchProjection(h.child,h.scope,h.notify);assert.equal(h.timers.size,0);assert.equal(h.notified.length,0);
 h.setScope('uid-a/wid-a/seal-loaded/epoch-a');h.complete();assert.equal(h.timers.size,1);h.flush();assert.equal(h.notified.length,1);assert.equal(h.notified[0].scope,h.scope());assert.deepEqual(h.writes,[]);
});

test('projection BFCache: persisted pagehide suspends delivery and pageshow resumes one current-owner projection',()=>{
 const h=fixture();Q.watchProjection(h.child,h.scope,h.notify);h.flush();assert.equal(h.notified.length,1);
 h.child.dispatch('pagehide',{persisted:true});h.setState({kind:'ok',at:1});h.complete();h.flush();assert.equal(h.notified.length,1,'a cached hidden document must not project');
 h.child.dispatch('pageshow',{persisted:true});h.complete();h.complete();h.flush();assert.equal(h.notified.length,2,'the same cached document must resume without a new script initialization');assert.equal(h.notified[1].state.at,1);
 h.child.dispatch('pagehide',{persisted:true});h.setState({kind:'ok',at:2});h.complete();h.flush();assert.equal(h.notified.length,2);
 h.child.dispatch('pageshow',{persisted:true});h.setScope('uid-b/wid-b/seal-b/epoch-b');h.flush();assert.equal(h.notified.length,2,'a different owner cannot receive a queued restored-owner projection');
 h.complete();h.flush();assert.equal(h.notified.length,3);assert.equal(h.notified[2].scope,h.scope());h.child.dispatch('pageshow',{persisted:true});h.complete();h.flush();assert.equal(h.notified.length,3,'a resumed completion identity is still delivered once');assert.deepEqual(h.writes,[]);
});

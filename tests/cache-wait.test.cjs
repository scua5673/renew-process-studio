'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/sync.js'),'utf8');
const code=source.slice(source.indexOf('function cacheWipedFlag(){'),source.indexOf('function purgeCopies(){'));
const tick=()=>new Promise(r=>setImmediate(r));
function harness(){
 const local=new Map([['wiped','1'],['team-data','original']]),timers=new Map(),errors=[],nodes=new Map();let next=0;
 const host={appendChild:n=>nodes.set(n.id,n)};
 const c={CACHE_WIPE:true,CACHE_FLAG:'wiped',CACHE_WAIT_MS:5000,cacheWaitTimer:null,Promise,
   navigator:{onLine:true},getSess:()=>({uid:'synthetic'}),setStatus(){},renderUI(){},syncDiagnostic:(...v)=>errors.push(v),syncNow:()=>new Promise(()=>{}),
   localStorage:{getItem:k=>local.get(k)||null,removeItem:k=>local.delete(k)},
   setTimeout(fn,ms){const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
   document:{querySelector:()=>host,getElementById:id=>nodes.get(id)||null,createElement(){return {style:{},setAttribute(){},remove(){nodes.delete(this.id);},querySelector(){return this.retry||(this.retry={});}};}}
 };vm.createContext(c);vm.runInContext(code,c);
 return {c,local,timers,errors,nodes,cover:()=>nodes.get('psCacheWait'),expire(){const [id,t]=[...timers][0];timers.delete(id);t.fn();},retry(){return nodes.get('psCacheWait').retry.onclick();}};
}
test('another tab clearing the shared flag cannot strand this tab cover at timeout',()=>{
 const h=harness();h.c.cacheWaitStart();assert.equal(h.timers.size,1);h.local.delete('wiped');h.expire();
 assert.match(h.cover().innerHTML,/수신이 지연/);assert.match(h.cover().style.cssText,/pointer-events:none/);assert.doesNotMatch(h.cover().style.cssText,/inset:0/);assert.equal(h.timers.size,0);assert.equal(h.local.get('team-data'),'original');assert.deepEqual(h.errors,[]);
});
test('successful own round removes the cover even after another tab cleared the flag',()=>{
 const h=harness();h.c.cacheWaitStart();h.local.delete('wiped');h.c.cacheWaitEnd(true);assert.equal(h.cover(),undefined);assert.equal(h.timers.size,0);
});
test('slow receipt becomes a small notice within five seconds without acknowledging or deleting data',()=>{
 const h=harness();h.c.cacheWaitStart();assert.equal([...h.timers.values()][0].ms,5000);h.expire();assert.match(h.cover().innerHTML,/다시 시도/);assert.equal(h.local.get('wiped'),'1');assert.equal(h.local.get('team-data'),'original');
});
test('offline retries have a fresh bounded timer even when sync never settles',async()=>{
 const h=harness();h.c.navigator.onLine=false;h.c.cacheWaitStart();assert.match(h.cover().innerHTML,/오프라인/);assert.match(h.cover().style.cssText,/inset:0/);h.c.navigator.onLine=true;h.retry();await tick();assert.equal(h.timers.size,1);h.expire();assert.match(h.cover().innerHTML,/수신이 지연/);h.retry();await tick();assert.equal(h.timers.size,1);h.expire();assert.equal(h.timers.size,0);
});
for(const outcome of ['skip','error','locked','noauth','throw','reject'])test('retry '+outcome+' never leaves an indefinite waiting cover',async()=>{
 const h=harness();h.c.cacheWaitStart();h.expire();h.c.syncNow=()=>{if(outcome==='throw')throw Error('synthetic');if(outcome==='reject')return Promise.reject(Error('synthetic'));return Promise.resolve({[outcome]:1});};h.retry();await tick();assert.match(h.cover().innerHTML,/수신이 지연/);assert.equal(h.timers.size,0);assert.equal(h.local.get('wiped'),'1');assert.deepEqual(h.errors,[]);
});
test('retry finishing after successful sync does not recreate a removed overlay',async()=>{
 const h=harness();h.c.cacheWaitStart();h.expire();h.c.syncNow=()=>{h.c.cacheWaitEnd(true);return Promise.resolve({applied:1});};h.retry();await tick();assert.equal(h.cover(),undefined);assert.equal(h.local.has('wiped'),false);assert.equal(h.timers.size,0);
});
test('clearing or completing one tab overlay does not touch the independent account lock',()=>{
 const h=harness(),lock={id:'psDataLock',text:'account locked'};h.nodes.set(lock.id,lock);h.c.cacheWaitStart();h.expire();assert.equal(h.nodes.get(lock.id),lock);h.c.cacheWaitEnd(true);assert.equal(h.nodes.get(lock.id),lock);
});
test('no wipe flag or no session does not start a loading overlay',()=>{
 const h=harness();h.local.delete('wiped');h.c.cacheWaitStart();assert.equal(h.cover(),undefined);h.local.set('wiped','1');h.c.getSess=()=>null;h.c.cacheWaitStart();assert.equal(h.cover(),undefined);assert.equal(h.timers.size,0);
});

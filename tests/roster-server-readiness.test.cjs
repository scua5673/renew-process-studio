'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const code=source.slice(source.indexOf('var ITEMS_SRV_TTL='),source.indexOf('function itemsIdx(){'));
function fixture(saved){
 const map=new Map();if(saved)map.set('state',JSON.stringify(saved));let time=100000000,requests=0,answer=()=>Promise.resolve('team');
 const c=vm.createContext({Promise,Date:{now:()=>time},ITEMS_SRV:'state',ITEMS_ACTIVE:true,ITEMP:'sq:',syncDiagnostic(){},localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},rpc:()=>{requests++;return answer();}});vm.runInContext(code,c);
 return {c,map,advance:ms=>time+=ms,reply:fn=>answer=fn,get requests(){return requests;}};
}
test('a transient readiness failure stays closed and recovers on a later retry',async()=>{
 const h=fixture();h.reply(()=>Promise.reject(Error('offline')));assert.equal(await h.c.itemsServerCheck(),false);assert.equal(h.c.itemsPushAllowed(),false);
 h.reply(()=>Promise.resolve('team'));h.advance(29999);assert.equal(await h.c.itemsServerCheck(),false);assert.equal(h.requests,1);
 h.advance(1);assert.equal(await h.c.itemsServerCheck(),true);assert.equal(h.c.itemsPushAllowed(),true);assert.equal(h.requests,2);
});
test('legacy six-hour failure cache is rechecked immediately',async()=>{
 const h=fixture({ok:0,at:100000000-86400000+21600000,err:1});assert.equal(await h.c.itemsServerCheck(),true);assert.equal(h.requests,1);
});
test('concurrent readiness callers share one request',async()=>{
 const h=fixture();let resolve;h.reply(()=>new Promise(r=>resolve=r));const a=h.c.itemsServerCheck(),b=h.c.itemsServerCheck();await Promise.resolve();assert.equal(h.requests,1);resolve('team');assert.deepEqual(await Promise.all([a,b]),[true,true]);
});
test('a non-team scope never opens writes and is checked again after five minutes',async()=>{
 const h=fixture();h.reply(()=>Promise.resolve('public'));assert.equal(await h.c.itemsServerCheck(),false);assert.equal(h.c.itemsPushAllowed(),false);
 h.reply(()=>Promise.resolve('team'));h.advance(300000);assert.equal(await h.c.itemsServerCheck(),true);assert.equal(h.requests,2);
});
test('a cached success is reused but does not override an explicit write-off switch',async()=>{
 const h=fixture({ok:1,at:100000000});assert.equal(await h.c.itemsServerCheck(),true);assert.equal(h.requests,0);h.map.set('ps_items_write','0');assert.equal(h.c.itemsPushAllowed(),false);
});
test('a future-dated cache cannot suppress the capability check',async()=>{
 const h=fixture({ok:1,at:100000001});h.reply(()=>Promise.resolve('public'));assert.equal(await h.c.itemsServerCheck(),false);assert.equal(h.requests,1);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../studio/storage.js'),'utf8');
const code=source.slice(source.indexOf('  function open(){'),source.indexOf('  function idbKeys('));
function fixture(){
 const requests=[],dbs=[];let writes=0,transactions=0;
 const c=vm.createContext({Promise,Error,DB:'test',VER:1,STORE:'kv',dbp:null,indexedDB:{open(){const r={};requests.push(r);return r;}},isQuotaErr:()=>false,diagnostic(){}});
 vm.runInContext(code,c);
 function ready(options={}){const r=requests.at(-1),db={close(){db.closed=true;},transaction(){transactions++;if(options.closing)throw Object.assign(Error('database connection is closing'),{name:'InvalidStateError'});const t={error:null,abort(){queueMicrotask(()=>t.onabort());},objectStore(){return {put(){writes++;},get(){const request={result:'saved'};queueMicrotask(()=>options.abort?t.onabort():t.oncomplete());return request;}};}};return t;}};r.result=db;dbs.push(db);r.onsuccess();return db;}
 return {c,requests,dbs,ready,get writes(){return writes;},get transactions(){return transactions;}};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('failed open is forgotten and a later request opens a fresh connection',async()=>{const h=fixture(),a=h.c.open();h.requests[0].error=Error('internal failure');h.requests[0].onerror();await assert.rejects(a);const b=h.c.open();assert.equal(h.requests.length,2);h.ready();await b;});
for(const event of ['close','versionchange'])test(event+' invalidates only its own cached connection',async()=>{const h=fixture(),a=h.c.open(),old=h.ready();await a;old['on'+event]();const b=h.c.open();old.onclose();const next=h.ready();assert.equal(await b,next);assert.equal(await h.c.open(),next);assert.equal(h.requests.length,2);if(event==='versionchange')assert.equal(old.closed,true);});
test('blocked open rejects and closes a late successful connection',async()=>{const h=fixture(),a=h.c.open();h.requests[0].onblocked();await assert.rejects(a,/blocked/);const old=h.ready();assert.equal(old.closed,true);const b=h.c.open();h.ready();await b;});
test('connection closing before transaction creation reopens once without replaying a write',async()=>{const h=fixture(),p=h.c.idbSet('key','saved');h.ready({closing:true});await tick();assert.equal(h.requests.length,2);h.ready();assert.equal(await p,true);assert.equal(h.writes,1);assert.equal(h.transactions,2);});
test('a second closing connection fails without an infinite reopen loop',async()=>{const h=fixture(),p=h.c.idbGet('key'),failure=assert.rejects(p,{name:'InvalidStateError'});h.ready({closing:true});await tick();h.ready({closing:true});await failure;assert.equal(h.requests.length,2);assert.equal(h.writes,0);});
test('transaction abort after write never replays and always returns an Error',async()=>{const h=fixture(),p=h.c.idbSet('key','saved'),failure=assert.rejects(p,{name:'AbortError'});h.ready({abort:true});await failure;assert.equal(h.writes,1);assert.equal(h.requests.length,1);});
test('owner check runs after reopen and prevents a stale write',async()=>{const h=fixture();let owner='a';const p=h.c.idbSet('key','saved',()=>{if(owner!=='a')throw Object.assign(Error('owner changed'),{name:'StorageOwnerChangedError'});}),failure=assert.rejects(p,{name:'StorageOwnerChangedError'});h.ready({closing:true});await tick();owner='b';h.ready();await failure;assert.equal(h.writes,0);});

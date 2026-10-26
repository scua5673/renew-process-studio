'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../studio/board.html'),'utf8');
const start=html.indexOf('var _boardPrivateOwner=null,'),end=html.indexOf('var _vaultBoardContext=null',start);
const source=html.slice(start,end),Draft=require('../studio/board-draft.js');
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
function harness(){
 let owner={uid:'synthetic-owner',wid:'synthetic-personal',seal:'synthetic-seal'},quota=false,broken=false;
 const local=new Map(),idb=new Map(),writes=[],hooks={},states=[];
 const w={JSON,Math,Date,Number,String,Promise,Error,encodeURIComponent,PRIVATE_BOARD_PREFIX:'ps_private_board_draft_v1:',_bliveSaveSeq:0,PSBoardDraft:Draft,
  document:{body:{classList:{contains:()=>false}}},location:{search:''},
  localStorage:{getItem:k=>local.get(k)??null,setItem(k,v){if(quota)throw Error('synthetic LS quota');writes.push(['local',k,v]);local.set(k,v);},removeItem(k){writes.push(['remove',k]);local.delete(k);}},
  storage:{async get(k){if(hooks.get)await hooks.get(k);if(broken)throw Error('synthetic IDB unavailable');return idb.has(k)?{value:idb.get(k)}:null;},async replaceIfValue(k,b,v,guard){if(hooks.cas)await hooks.cas(k);guard();if(broken)throw Error('synthetic IDB unavailable');if((idb.get(k)??null)!==b)return false;writes.push(['idb',k,v]);idb.set(k,v);return true;}},
  PSStorage:{async sharedVerified(k,raw){if(hooks.verify)await hooks.verify(k);if(idb.get(k)!==raw)throw Error('not exact IDB');},async localRecovered(k,raw,guard){assert.equal(guard(),true);assert.equal(local.get(k),raw);}},
  PSSaveState:{begin:k=>states.push([k,'saving']),ok:k=>states.push([k,'saved']),fail:k=>states.push([k,'failed'])},
  parent:{PSSync:{boardLive:{version:2,scope:'personal',owner:()=>owner,get(){},save(){}}}}
 };w.window=w;vm.createContext(w);vm.runInContext(source,w);w._boardPrivateOwner=owner;
 const key=w.boardPrivateKey(owner),make=n=>w.boardPrivateMake(owner,JSON.stringify({snap:{players:[{id:'synthetic',x:n}]},pages:['X'.repeat(150000)]}),{raw:null,cupd:null},true,null);
 return {w,key,owner,local,idb,writes,hooks,states,make,quota(){quota=true;},broken(){broken=true;},changeOwner(){owner={...owner,seal:'new-owner-seal'};},seed(r){let raw=JSON.stringify(r);local.set(key,raw);idb.set(key,raw);w._boardPrivateHead=raw;w._boardPrivateIdbHead=raw;return raw;}};
}
test('normal private-head writes use only exact IDB and do not recreate full localStorage copies',async()=>{
 const h=harness();let r=h.make(1);await h.w.boardPrivatePersist(h.owner,r);assert.equal(h.local.has(h.key),false);assert.equal(h.w._boardPrivateDurableToken,r.token);
 r=h.make(2);await h.w.boardPrivatePersist(h.owner,r);assert.equal(h.local.has(h.key),false);assert.equal(h.writes.filter(x=>x[0]==='local').length,0);assert.equal(h.idb.get(h.key),JSON.stringify(r));
});
test('a known legacy mirror remains intact until full IDB verification and is removed only afterwards',async()=>{
 const h=harness(),old=h.seed(h.make(1)),gate=defer();h.hooks.verify=()=>gate.promise;const r=h.make(2),work=h.w.boardPrivatePersist(h.owner,r);await tick();assert.equal(h.local.get(h.key),old);assert.notEqual(h.w._boardPrivateDurableToken,r.token);gate.resolve();await work;assert.equal(h.local.has(h.key),false);assert.equal(h.idb.get(h.key),JSON.stringify(r));
});
test('a proven own CAS may become the next save baseline after a later edit invalidates its UI receipt',async()=>{
 const h=harness(),old=h.seed(h.make(1)),gate=defer();h.hooks.verify=()=>gate.promise;
 const second=h.make(2),work=h.w.boardPrivatePersist(h.owner,second);await tick();assert.equal(h.idb.get(h.key),JSON.stringify(second));
 h.w._boardPrivateEditSeq++;gate.resolve();await assert.rejects(work);assert.equal(h.local.get(h.key),old);assert.notEqual(h.w._boardPrivateDurableToken,second.token);
 delete h.hooks.verify;const third=h.make(3);await h.w.boardPrivatePersist(h.owner,third);assert.equal(h.idb.get(h.key),JSON.stringify(third));assert.equal(h.local.has(h.key),false);assert.equal(h.w._boardPrivateDurableToken,third.token);
});
for(const change of ['owner','edit','generation','mirror'])test('late private-head verification cannot clear an original after '+change+' changes',async()=>{
 const h=harness(),old=h.seed(h.make(1)),gate=defer();h.hooks.verify=()=>gate.promise;const r=h.make(2),work=h.w.boardPrivatePersist(h.owner,r);await tick();
 if(change==='owner')h.changeOwner();if(change==='edit')h.w._boardPrivateEditSeq++;if(change==='generation')h.w._boardPrivateGeneration++;if(change==='mirror')h.local.set(h.key,'synthetic concurrent source');
 gate.resolve();await assert.rejects(work);assert.equal(h.local.get(h.key),change==='mirror'?'synthetic concurrent source':old);assert.notEqual(h.w._boardPrivateDurableToken,r.token);
});
test('different known LS and IDB originals are preserved in exact recovery records before replacement',async()=>{
 const h=harness(),old=h.seed(h.make(1)),other=JSON.stringify(h.make(2));h.idb.set(h.key,other);h.w._boardPrivateIdbHead=other;
 const latest=h.make(3);await h.w.boardPrivatePersist(h.owner,latest);const kept=[...h.idb].filter(([k])=>k.includes(':kept:')).map(([,v])=>v);
 assert.ok(kept.includes(old));assert.ok(kept.includes(other));assert.equal(h.idb.get(h.key),JSON.stringify(latest));assert.equal(h.local.has(h.key),false);
});

function draftHarness(){
 const local=new Map(),idb=new Map(),writes=[],hooks={},states=[],owner={uid:'synthetic-draft',wid:'synthetic-personal'};let seq=1,generation=1,active=true,quota=false,idbFail=false,at=10;
 let raw=JSON.stringify({snap:{players:[{id:'synthetic',x:1}]},animFrames:[{thumb:'X'.repeat(90000)}],boardPages:{pages:[{name:'all original pages'}]}});
 const key='ps_private_board_draft_v1:synthetic-draft:unsaved';
 const d={context:()=>({owner,seq,generation,current:active,needed:true,blocked:false}),key:()=>key,capture:()=>({raw}),now:()=>++at,
  local:{getItem:k=>local.get(k)??null,setItem(k,v){if(quota)throw Error('synthetic LS full');writes.push(['local',k,v]);local.set(k,v);},removeItem:k=>local.delete(k)},
  storage:{async get(k){if(hooks.get)await hooks.get(k);if(idbFail)throw Error('synthetic IDB blocked');return idb.has(k)?{value:idb.get(k)}:null;},async replaceIfValue(k,b,v,guard){if(hooks.cas)await hooks.cas(k);guard();if(idbFail)throw Error('synthetic IDB failed');if((idb.get(k)??null)!==b)return false;writes.push(['idb',k,v]);idb.set(k,v);return true;},async delIfValue(k,v,guard){if(hooks.del)await hooks.del(k);guard();if(idb.get(k)!==v)return false;idb.delete(k);return true;}},
  async verifyIDB(k,v){if(hooks.verify)await hooks.verify(k);assert.equal(idb.get(k),v);},recoverLocal:async(k,v,current)=>{assert.equal(current(),true);assert.equal(local.get(k),v);},state:(s)=>states.push(s)
 };const api=Draft.create(d);
 return {api,d,key,local,idb,writes,hooks,states,get raw(){return raw;},edit(){seq++;raw=raw.replace('"x":1','"x":2');},generation(){generation++;},lock(){active=false;},quota(){quota=true;},failIDB(){idbFail=true;},restoreIDB(){idbFail=false;},observe(l,i){api.observe(owner,l,i);},record(v,t=1){return JSON.stringify({v:1,uid:owner.uid,wid:owner.wid,raw:v,at:t});}};
}
test('ordinary unsaved edits and already committed lifecycle flushes never recreate LS copies',async()=>{
 const h=draftHarness();await h.api.ready();assert.equal(h.local.has(h.key),false);assert.equal(JSON.parse(h.idb.get(h.key)).raw,h.raw);await h.api.write({lifecycle:true});assert.equal(h.writes.filter(x=>x[0]==='local').length,0);
 h.edit();await h.api.ready();assert.equal(h.local.size,0);assert.equal(JSON.parse(h.idb.get(h.key)).raw,h.raw);assert.equal(h.api.pending(),false);
});
test('two IDB-only edits in the same clock tick receive monotonically selectable draft receipts',async()=>{
 const h=draftHarness();h.d.now=()=>10;await h.api.ready();const before=JSON.parse(h.idb.get(h.key));h.edit();await h.api.ready();const after=JSON.parse(h.idb.get(h.key));assert.equal(after.raw,h.raw);assert.ok(after.at>before.at);assert.equal(h.local.size,0);
});
test('dispatched pagehide retains the full latest input synchronously while IDB is blocked, without a false transition receipt',async()=>{
 const h=draftHarness(),old=h.record('{}'),gate=defer();h.idb.set(h.key,old);h.observe(null,old);h.hooks.cas=()=>gate.promise;
 const work=h.api.write();work.catch(()=>{});await tick();const lifecycle=h.api.write({lifecycle:true});lifecycle.catch(()=>{});
 assert.equal(JSON.parse(h.local.get(h.key)).raw,h.raw);assert.equal(h.idb.get(h.key),old,'last durable original is still intact');assert.equal(h.api.pending(),true);assert.equal(h.api.snapshot().localDurable,false);
 h.lock();gate.resolve();await assert.rejects(work);assert.equal(JSON.parse(h.local.get(h.key)).raw,h.raw,'a terminated write leaves its complete reloadable lifecycle source');assert.equal(h.idb.get(h.key),old);
});
test('legacy unsaved copies are removed only after actual exact IDB verification',async()=>{
 const h=draftHarness(),old=h.record('{}'),gate=defer();h.local.set(h.key,old);h.idb.set(h.key,old);h.observe(old,old);h.hooks.verify=()=>gate.promise;
 const work=h.api.ready();await tick();assert.equal(h.local.get(h.key),old);assert.equal(h.api.pending(),true);gate.resolve();await work;assert.equal(h.local.has(h.key),false);assert.equal(JSON.parse(h.idb.get(h.key)).raw,h.raw);
});
test('a newer unsaved edit can advance its own committed CAS after the older exact receipt becomes stale',async()=>{
 const h=draftHarness(),old=h.record('{}'),gate=defer();h.local.set(h.key,old);h.idb.set(h.key,old);h.observe(old,old);h.hooks.verify=()=>gate.promise;
 const work=h.api.write();await tick();assert.notEqual(h.idb.get(h.key),old);h.edit();gate.resolve();await assert.rejects(work);assert.equal(h.local.get(h.key),old);assert.equal(h.api.pending(),true);
 delete h.hooks.verify;await h.api.ready();assert.equal(JSON.parse(h.idb.get(h.key)).raw,h.raw);assert.equal(h.local.has(h.key),false);assert.equal(h.api.pending(),false);
});
for(const phase of ['cas','verify'])test('a later edit can advance its own lifecycle LS source while the earlier '+phase+' is pending',async()=>{
 const h=draftHarness(),old=h.record('{}'),gate=defer();h.idb.set(h.key,old);h.observe(null,old);h.hooks[phase]=()=>gate.promise;
 const first=h.api.write();first.catch(()=>{});await tick();h.api.write({lifecycle:true}).catch(()=>{});const local=h.local.get(h.key);assert.equal(JSON.parse(local).raw,h.raw);
 h.edit();const latest=h.api.write();gate.resolve();await assert.rejects(first);await latest;assert.equal(h.api.pending(),false);assert.equal(JSON.parse(h.idb.get(h.key)).raw,h.raw);assert.equal(h.local.has(h.key),false);
});
test('different unsaved originals and the current edit survive separately, with transition blocked',async()=>{
 const h=draftHarness(),old=h.record('{"source":"LS"}'),other=h.record('{"source":"IDB"}',2);h.local.set(h.key,old);h.idb.set(h.key,other);h.observe(old,other);
 await assert.rejects(h.api.ready());assert.equal(h.local.get(h.key),old);assert.equal(h.idb.get(h.key),other);assert.equal(h.api.pending(),true);assert.ok([...h.idb].some(([k,v])=>k.includes(':kept:')&&JSON.parse(v).raw===h.raw));
});
test('a synchronous lifecycle recovery does not overwrite a previously unobserved LS original',async()=>{
 const h=draftHarness(),old=h.record('{"source":"unobserved"}'),gate=defer();h.local.set(h.key,old);h.hooks.get=()=>gate.promise;
 const work=h.api.write({lifecycle:true});work.catch(()=>{});assert.equal(h.local.get(h.key),old);assert.ok([...h.local].some(([k,v])=>k.includes(':kept:')&&JSON.parse(v).raw===h.raw));h.lock();gate.resolve();await assert.rejects(work);
});
test('unsaved both-store failure leaves the original receipt and failed pending status',async()=>{
 const h=draftHarness(),old=h.record('{}');h.idb.set(h.key,old);h.observe(null,old);h.failIDB();h.quota();await assert.rejects(h.api.write({lifecycle:true}));assert.equal(h.idb.get(h.key),old);assert.equal(h.api.pending(),true);assert.equal(h.api.snapshot().failed,true);assert.equal(h.states.at(-1),'fail');
});
test('a generation change during unsaved verification cannot delete the previous LS source',async()=>{
 const h=draftHarness(),old=h.record('{}'),gate=defer();h.local.set(h.key,old);h.idb.set(h.key,old);h.observe(old,old);h.hooks.verify=()=>gate.promise;const work=h.api.ready();await tick();h.generation();gate.resolve();await assert.rejects(work);assert.equal(h.local.get(h.key),old);assert.equal(h.api.pending(),true);
});
test('clearing a saved draft uses exact IDB CAS and preserves another tab original',async()=>{
 const h=draftHarness();await h.api.ready();const other=h.record('{"source":"other tab"}',100);h.idb.set(h.key,other);await h.api.clear({uid:'synthetic-draft',wid:'synthetic-personal'});assert.equal(h.idb.get(h.key),other);
});
test('discard cancels an in-flight draft read so its old job cannot recreate the discarded source',async()=>{
 const h=draftHarness(),gate=defer();h.hooks.get=()=>gate.promise;const work=h.api.write();work.catch(()=>{});await tick();
 await h.api.clear({uid:'synthetic-draft',wid:'synthetic-personal'});gate.resolve();await assert.rejects(work);assert.equal(h.idb.has(h.key),false);assert.equal(h.local.has(h.key),false);assert.equal(h.writes.filter(x=>x[0]==='idb').length,0);assert.equal(h.api.snapshot().localDurable,false);
});
test('discard during exact readback removes only the committed owned draft and never restores it',async()=>{
 const h=draftHarness(),gate=defer();h.hooks.verify=()=>gate.promise;const work=h.api.write();work.catch(()=>{});await tick();assert.equal(h.idb.has(h.key),true);
 await h.api.clear({uid:'synthetic-draft',wid:'synthetic-personal'});gate.resolve();await assert.rejects(work);assert.equal(h.idb.has(h.key),false);assert.equal(h.local.has(h.key),false);assert.equal(h.api.snapshot().localDurable,false);
});
test('an actual IDB failure falls back to a complete verified local record without an IDB receipt',async()=>{
 const h=harness();h.broken();const r=h.make(4);await h.w.boardPrivatePersist(h.owner,r);assert.equal(h.local.get(h.key),JSON.stringify(r));assert.equal(h.idb.has(h.key),false);assert.equal(h.w._boardPrivateDurableToken,r.token);
});
test('failure of both stores keeps the previous durable record and never acknowledges the new token',async()=>{
 const h=harness(),old=h.seed(h.make(1));h.broken();h.quota();const r=h.make(5);await assert.rejects(h.w.boardPrivatePersist(h.owner,r));assert.equal(h.local.get(h.key),old);assert.equal(h.idb.get(h.key),old);assert.notEqual(h.w._boardPrivateDurableToken,r.token);
});

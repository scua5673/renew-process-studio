'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Draft=require('../studio/board-draft.js');
const tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
function fixture(){
 let owner={uid:'synthetic-source',wid:'synthetic-personal',seal:'synthetic-owner-seal',active:'synthetic-team',epoch:1},seq=1,generation=1,view='board',current=true,paused=false,needed=true,blocked=false,at=100,captures=0;
 let raw=JSON.stringify({view:'board',snap:{players:[{id:'synthetic',x:521}]},boardPages:{pages:[{name:'all original pages',anim:{frames:[{snap:{x:1}},{snap:{x:2}}]}}]}});
 const local=new Map(),idb=new Map(),writes=[],reads=[],states=[],hooks={},key='ps_private_board_draft_v1:synthetic-source:unsaved';
 const d={context:()=>({owner,seq,generation,view,current,paused,needed,blocked:blocked||view!=='board'&&view!=='match',borrowed:view!=='board'&&view!=='match'}),key:()=>key,now:()=>++at,
  capture(){captures++;assert.ok(view==='board'||view==='match','borrowed canvas must never be captured');return {raw};},
  local:{getItem:k=>local.get(k)??null,setItem(k,v){if(hooks.local)hooks.local(k);writes.push(['ls',k,v]);local.set(k,v);},removeItem(k){writes.push(['remove',k]);local.delete(k);}},
  storage:{async get(k){reads.push(['get',k]);if(hooks.get)await hooks.get(k);return idb.has(k)?{value:idb.get(k)}:null;},async peek(k){reads.push(['peek',k]);if(hooks.peek)await hooks.peek(k);return idb.has(k)?{value:idb.get(k)}:null;},async replaceIfValue(k,b,v,guard){if(hooks.cas)await hooks.cas(k);guard();if((idb.get(k)??null)!==b)return false;writes.push(['idb',k,v]);idb.set(k,v);return true;}},
  async verifyIDB(k,v){reads.push(['verify',k]);if(hooks.verify)await hooks.verify(k);assert.equal(idb.get(k),v);},state:(kind,e)=>states.push({kind,e})};
 const api=Draft.create(d);
 return {api,d,key,local,idb,writes,reads,states,hooks,get raw(){return raw;},captures:()=>captures,borrow(target='session'){view=target;},pause(valid){current=false;paused=valid;},returnToBoard(){view='board';current=true;paused=false;},edit(){seq++;raw=raw.replace('521','999');},mutateBorrowed(){raw='synthetic unrelated borrowed canvas';},restoreBody(v){raw=v;},generation(){generation++;},owner(){owner={...owner,seal:'different-seal'};},notNeeded(){needed=false;},block(){blocked=true;},record(v,t=1){return JSON.stringify({v:1,uid:owner.uid,wid:owner.wid,raw:v,at:t});}};
}
async function exit(h){const work=h.api.write({lifecycle:true,exitTarget:'session'});work.catch(()=>{});h.borrow();await work.catch(()=>{});return h.local.get(h.key)||h.idb.get(h.key);}
test('a working-view exit certificate is not an ACK and only exact reloadable local receipt can confirm it',async()=>{
 const h=fixture(),source=h.raw,record=await exit(h);assert.equal(JSON.parse(record).raw,source);assert.equal(h.api.snapshot().localDurable,false);assert.equal(h.api.pending(),true);assert.equal(!!h.api.snapshot().sourceSuspended,false);
 const writes=h.writes.length,captures=h.captures(),reads=h.reads.length;h.mutateBorrowed();await h.api.ready();assert.equal(h.captures(),captures);assert.equal(h.writes.length,writes);assert.ok(h.reads.slice(reads).every(x=>x[0]!=='get'),'certificate verification must not invoke migration reads');assert.equal(h.api.pending(),false);assert.equal(h.api.snapshot().localDurable,true);assert.equal(!!h.api.snapshot().sourceSuspended,true);assert.equal(h.api.snapshot().serverConfirmed,false);assert.equal(h.local.get(h.key),record);assert.equal(h.idb.has(h.key),false);
 h.restoreBody(source);h.returnToBoard();await h.api.ready();assert.equal(!!h.api.snapshot().sourceSuspended,false);assert.equal(h.api.pending(),false);assert.equal(JSON.parse(h.idb.get(h.key)).raw,source);assert.equal(h.local.size,0);
});
test('an already exact IDB source can suspend without recreating a large LS copy',async()=>{
 const h=fixture();await h.api.ready();const record=h.idb.get(h.key);await exit(h);const writes=h.writes.length;await h.api.ready();assert.equal(h.idb.get(h.key),record);assert.equal(h.local.size,0);assert.equal(h.writes.length,writes);assert.equal(!!h.api.snapshot().sourceSuspended,true);
});
test('an ordinary save never certifies a later borrowed view',async()=>{
 const h=fixture();await h.api.ready();h.borrow();await assert.rejects(h.api.ready());assert.equal(h.api.pending(),true);assert.equal(!!h.api.snapshot().sourceSuspended,false);
});
for(const invalidation of ['edit','generation','owner','clear'])test('a source certificate cannot survive '+invalidation,async()=>{
 const h=fixture();await exit(h);if(invalidation==='clear'){h.returnToBoard();await h.api.clear(h.d.context().owner);h.borrow();}else h[invalidation]();
 const writes=h.writes.length;await assert.rejects(h.api.ready());assert.equal(h.writes.length,writes);assert.equal(h.api.pending(),true);assert.equal(!!h.api.snapshot().sourceSuspended,false);
});
test('missing and divergent receipt originals are never recreated by readonly source verification',async()=>{
 for(const kind of ['missing','foreign']){const h=fixture();await exit(h);if(kind==='missing')h.local.clear();else h.local.set(h.key,h.record('{"synthetic":"foreign"}',999));const original=h.local.get(h.key),writes=h.writes.length;await assert.rejects(h.api.ready());assert.equal(h.writes.length,writes);assert.equal(h.local.get(h.key),original);assert.equal(h.idb.size,0);assert.equal(h.api.pending(),true);assert.equal(!!h.api.snapshot().sourceSuspended,false);}
});
test('a proven source pause can only recheck a certificate that was already confirmed before the guard',async()=>{
 const h=fixture();await exit(h);await h.api.ready();h.pause(true);const writes=h.writes.length;await h.api.ready();assert.equal(h.writes.length,writes);assert.equal(h.api.pending(),false);
 const invalid=fixture();await exit(invalid);await invalid.api.ready();invalid.pause(false);await assert.rejects(invalid.api.ready());assert.equal(invalid.api.pending(),true);
 const unconfirmed=fixture();await exit(unconfirmed);unconfirmed.pause(true);await assert.rejects(unconfirmed.api.ready());assert.equal(unconfirmed.api.pending(),true);
});
test('actual I/O failure stays failed until a fresh exact source receipt proves recovery',async()=>{
 const h=fixture();await exit(h);h.hooks.peek=async()=>{throw Error('synthetic real peek I/O failure');};await assert.rejects(h.api.ready(),/synthetic real peek I\/O failure/);assert.equal(h.api.snapshot().failed,true);assert.equal(h.api.pending(),true);const reads=h.reads.length;await assert.rejects(h.api.ready(),/synthetic real peek I\/O failure/);assert.ok(h.reads.length>reads);assert.equal(!!h.api.snapshot().sourceSuspended,false);delete h.hooks.peek;const writes=h.writes.length;await h.api.ready();assert.equal(h.writes.length,writes);assert.equal(h.api.pending(),false);assert.equal(h.api.snapshot().failed,false);
 h.returnToBoard();await h.api.ready();assert.equal(h.api.pending(),false);assert.equal(h.api.snapshot().failed,false);
});
test('a newer foreign IDB source cannot be certified through a matching owned LS fallback',async()=>{
 const h=fixture();await exit(h);const foreign=h.record('{"synthetic":"foreign source"}',999);h.idb.set(h.key,foreign);const writes=h.writes.length;await assert.rejects(h.api.ready(),e=>e.psConflict===true);assert.equal(h.idb.get(h.key),foreign);assert.equal(h.writes.length,writes);assert.equal(h.api.pending(),true);assert.equal(h.api.snapshot().failed,true);h.idb.delete(h.key);await assert.rejects(h.api.ready(),e=>e.psConflict===true);assert.equal(h.api.pending(),true,'a cert alone never clears a known foreign conflict');
});
test('blocked and unneeded write calls cannot create a source certificate',async()=>{
 for(const kind of ['block','notNeeded']){const h=fixture();h[kind]();assert.equal(await h.api.write({lifecycle:true,exitTarget:'session'}),false);h.borrow();if(kind==='notNeeded')continue;await assert.rejects(h.api.ready());assert.equal(!!h.api.snapshot().sourceSuspended,false);assert.equal(h.writes.length,0);}
});
test('an older readonly receipt cannot clear a newer real I/O failure',async()=>{
 const h=fixture();await exit(h);const gate=deferred();let calls=0;h.hooks.peek=async()=>{if(++calls===1)await gate.promise;else throw Error('synthetic newer read failure');};const old=h.api.ready();old.catch(()=>{});await tick();await assert.rejects(h.api.ready(),/synthetic newer read failure/);gate.resolve();await assert.rejects(old);assert.equal(h.api.snapshot().failed,true);assert.equal(h.api.pending(),true);assert.equal(!!h.api.snapshot().sourceSuspended,false);
});
test('an older readonly failure cannot invalidate a newer exact source receipt',async()=>{
 const h=fixture();await exit(h);const gate=deferred();let calls=0;h.hooks.peek=async()=>{if(++calls===1)await gate.promise;};const old=h.api.ready();old.catch(()=>{});await tick();await h.api.ready();gate.reject(Error('synthetic older read failure'));await assert.rejects(old,/synthetic older read failure/);assert.equal(h.api.snapshot().failed,false);assert.equal(h.api.pending(),false);assert.equal(h.api.snapshot().localDurable,true);
});
test('a late suspended read cannot invalidate a newer full working-board verification',async()=>{
 const h=fixture();await exit(h);const gate=deferred();h.hooks.peek=()=>gate.promise;const old=h.api.ready();old.catch(()=>{});await tick();h.returnToBoard();await h.api.ready();gate.resolve();await assert.rejects(old);assert.equal(h.api.snapshot().failed,false);assert.equal(h.api.pending(),false);assert.equal(h.api.snapshot().localDurable,true);assert.equal(JSON.parse(h.idb.get(h.key)).raw,h.raw);
});
test('a same-job lifecycle fallback joins the in-flight write without cancelling its exact ready receipt',async()=>{
 const h=fixture(),gate=deferred();h.hooks.cas=()=>gate.promise;const ready=h.api.ready();ready.catch(()=>{});await tick();const lifecycle=h.api.write({lifecycle:true});lifecycle.catch(()=>{});assert.ok(h.local.has(h.key),'pagehide preserves the complete synchronous fallback while IDB is pending');gate.resolve();await lifecycle;await ready;assert.equal(h.api.pending(),false);assert.equal(h.api.snapshot().failed,false);assert.equal(h.api.snapshot().localDurable,true);assert.equal(JSON.parse(h.idb.get(h.key)).raw,h.raw);assert.equal(h.local.has(h.key),false);
});

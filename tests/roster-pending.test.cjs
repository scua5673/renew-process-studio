'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Outbox=require('../studio/roster-outbox.js'),Pending=require('../studio/roster-pending.js');
const MAIN='scout_tool_v1',TOMBS='cs_player_del_v1';
const p=(id,name)=>({id,name,type:'ours',memo:'exact original'});
const quota=()=>Object.assign(Error('synthetic localStorage quota'),{name:'QuotaExceededError'});
function gate(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function fixture(){
  const ls=new Map([[MAIN,'{"players":[]}'],[TOMBS,'{}']]),idb=new Map(),calls={peek:[],keys:[],put:[],del:[]};
  let who={uid:'coach-a',wid:'team-a'},permission='edit',epoch=1,canEdit=true,localFull=false,localError=null;
  const hooks={put:null,del:null,peek:null,keys:null};
  const local={
    get length(){return ls.size;},key:i=>[...ls.keys()][i]??null,getItem:k=>ls.has(k)?ls.get(k):null,
    setItem(k,v){if(localError&&k.includes(':b:'))throw localError;if(localFull&&k.includes(':b:'))throw quota();ls.set(k,String(v));},
    removeItem:k=>ls.delete(k),
  };
  const storage={
    conditionalGuardVersion:1,
    async keys(prefix){calls.keys.push(prefix);if(hooks.keys)await hooks.keys(prefix);return [...idb.keys()].filter(k=>k.startsWith(prefix));},
    async peek(k){calls.peek.push(k);if(hooks.peek)await hooks.peek(k);return idb.has(k)?{value:idb.get(k)}:null;},
    async setIfValues(k,expected,raw,checks,current){
      calls.put.push({k,expected,raw,checks});current();if(hooks.put)await hooks.put(k,expected,raw);current();
      if((idb.get(k)??null)!==expected)return false;
      for(const [key,value]of Object.entries(checks))if((idb.get(key)??null)!==value)return false;
      idb.set(k,raw);assert.equal(idb.get(k),raw);current();return true;
    },
    async delIfValue(k,raw,current){
      calls.del.push({k,raw});current();if(hooks.del){const result=await hooks.del(k,raw);if(result===false)return false;}current();
      if(idb.get(k)!==raw)return false;idb.delete(k);return true;
    },
  };
  const owner=()=>who;
  const stamp=()=>JSON.stringify([who&&who.uid,who&&who.wid,permission,epoch,local.getItem('ps_ws_switch_guard_v1')]);
  const options={outbox:Outbox,local,storage,owner,stamp,editable:()=>canEdit};
  return {ls,idb,calls,hooks,local,storage,options,bridge:Pending.create(options),clone:()=>Pending.create(options),
    full(v=true){localFull=v;},localError(v){localError=v;},owner(v){who=v;epoch++;},permission(v){permission=v;},editable(v){canEdit=v;},epoch(){epoch++;}};
}
const stage=(b,player,base=[])=>b.stage({players:[player],basePlayers:base,changedIds:[player.id],deletedIds:[]});
const batchKeys=f=>[...f.ls.keys()].filter(k=>k.startsWith(Outbox.prefix)&&k.includes(':b:'));

test('the ordinary native outbox still stages, ACKs and cleans up entirely in localStorage',async()=>{
  const f=fixture(),b=f.bridge;assert.equal(b.prepared(),false);assert.equal(b.pending(),true);
  await b.prepare();assert.equal(b.prepared(),true);assert.equal(b.hasRescue(),false);
  const receipt=stage(b,p('new','native'));assert.equal(b.pending(),true);assert.equal(f.calls.put.length,0);
  assert.equal(b.ack(receipt),1);assert.equal(b.pending(),false);assert.deepEqual(batchKeys(f),[]);assert.equal(f.idb.size,0);
  assert.equal([...f.ls.keys()].some(k=>k.startsWith(Outbox.prefix)),false);
});

test('a first batch quota preserves its exact native receipt without writing MAIN and promotes before ACK',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();const receipt=stage(b,p('new','B'));
  assert.equal(b.hasRescue(),true);assert.equal(b.pending(),true);assert.equal(f.local.getItem(MAIN),'{"players":[]}');
  assert.equal(b.overlay([])[0].name,'B');assert.throws(()=>b.ack(receipt));assert.throws(()=>b.settle(receipt,()=>true));
  await b.ready();assert.equal(f.idb.size,1);const [key,raw]=[...f.idb][0];
  assert.equal(key,receipt.keys[0]);assert.equal(f.calls.put[0].expected,null);assert.deepEqual(f.calls.put[0].checks,{});
  assert.equal(JSON.parse(raw).rows[0].token,receipt.rows[0].token);assert.equal(f.local.getItem(key),null);
  f.full(false);await b.promote();assert.equal(f.local.getItem(key),raw);assert.equal(f.idb.size,0);assert.equal(b.hasRescue(),false);
  assert.equal(b.ack(receipt),1);assert.equal(b.pending(),false);
  const reopened=f.clone();await reopened.prepare();assert.equal(reopened.pending(),false);assert.deepEqual(reopened.overlay([]),[]);
});

test('a distinct newer C keeps B and its earliest base while B preservation is in flight',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();const entered=gate(),release=gate();let count=0;
  f.hooks.put=async()=>{if(++count===1){entered.resolve();await release.promise;}};
  const first=stage(b,p('new','B'));await entered.promise;const latest=stage(b,p('new','C'),[p('new','B')]);
  assert.equal(latest.rows[0].base,null);assert.equal(latest.rows[0].history[0].name,'B');
  release.resolve();await b.ready();assert.equal(f.idb.size,2);assert.equal(b.read().rows[0].player.name,'C');
  assert.equal(b.read().rows[0].sources.length,2);assert.equal(b.read().rows[0].base,null);
  assert.equal(JSON.parse(f.idb.get(first.keys[0])).rows[0].player.name,'B');
  f.full(false);await b.promote();assert.equal(f.idb.size,0);assert.equal(b.ack(latest),1);assert.equal(b.pending(),false);
});

test('both-store failure remains cached and failed; explicit prepare can retry the same immutable original',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();const failed=Error('synthetic IDB quota');f.hooks.put=()=>{throw failed;};
  const receipt=stage(b,p('new','B'));await assert.rejects(b.ready(),e=>e===failed);
  assert.equal(b.failure(),failed);assert.equal(b.hasRescue(),true);assert.equal(b.overlay([])[0].name,'B');assert.equal(f.idb.size,0);
  assert.throws(()=>b.ack(receipt));f.hooks.put=null;await b.prepare();await b.ready();
  assert.equal(f.calls.put.length,2);assert.equal(f.calls.put[0].k,f.calls.put[1].k);assert.equal(f.calls.put[0].raw,f.calls.put[1].raw);
  f.full(false);await b.promote();assert.equal(b.ack(receipt),1);assert.equal(b.pending(),false);
});

test('an IDB key collision preserves both originals and never treats false CAS as a receipt',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();f.hooks.put=(k)=>{f.idb.set(k,'different original');};
  const receipt=stage(b,p('new','B'));await assert.rejects(b.ready(),/원문/);
  assert.equal(b.read().rows[0].player.name,'B');assert.equal(f.idb.get(receipt.keys[0]),'different original');
  await assert.rejects(b.prepare(),/다릅니다/);assert.equal(b.prepared(),false);assert.equal(b.hasRescue(),true);assert.equal(f.calls.del.length,0);
});

test('cold preparation hydrates only this owner and validates with the native outbox parser',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();stage(b,p('new','B'));await b.ready();
  const owned=[...f.idb][0],foreign=owned[0].replace('coach-a:team-a:','coach-b:team-b:');f.idb.set(foreign,'foreign unparsed private bytes');
  const reopened=f.clone();await reopened.prepare();assert.equal(reopened.overlay([])[0].name,'B');assert.equal(reopened.hasRescue(),true);
  assert.equal(f.calls.peek.includes(foreign),false);
  f.idb.set(owned[0],'{broken');const broken=f.clone();await assert.rejects(broken.prepare(),/원문/);assert.equal(broken.prepared(),false);assert.equal(broken.pending(),true);
});

test('a preparation read failure keeps boot closed and does not overwrite any original',async()=>{
  const f=fixture(),b=f.bridge,originals=[...f.ls];f.hooks.keys=()=>{throw Error('synthetic IDB read failure');};
  await assert.rejects(b.prepare(),/read failure/);assert.equal(b.prepared(),false);assert.equal(b.pending(),true);
  assert.throws(()=>b.read());assert.deepEqual([...f.ls],originals);assert.equal(f.calls.put.length,0);
  f.hooks.keys=null;await b.prepare();assert.equal(b.prepared(),true);assert.equal(b.pending(),false);
});

test('changing accounts cannot read or promote another owner cache',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();stage(b,p('new','private A'));await b.ready();
  f.owner({uid:'coach-b',wid:'team-b'});await b.prepare();assert.deepEqual(b.overlay([]),[]);assert.equal(b.hasRescue(),false);
  assert.equal(f.calls.keys.at(-1),Outbox.prefix+'coach-b:team-b:');assert.equal(f.idb.size,1);
  f.owner({uid:'coach-a',wid:'team-a'});assert.equal(b.prepared(),false);await b.prepare();assert.equal(b.overlay([])[0].name,'private A');
});

for(const [name,change]of Object.entries({
  owner:f=>f.owner({uid:'other',wid:'other'}),permission:f=>f.permission('changed'),editable:f=>f.editable(false),
  switch:f=>f.ls.set('ps_ws_switch_guard_v1','switching'),main:f=>f.ls.set(MAIN,'{"players":[{"id":"C"}]}'),
  tombs:f=>f.ls.set(TOMBS,'{"new":1}'),
  'previous immutable batch':f=>f.ls.set(f.previousKey,'changed previous bytes'),
}))test('capture rejects a concurrent '+name+' change while retaining its original cache',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();
  if(name==='previous immutable batch'){const old=stage(b,p('old','A'));f.previousKey=old.keys[0];}
  f.full();const entered=gate(),release=gate();f.hooks.put=async()=>{entered.resolve();await release.promise;};
  stage(b,p('new','B'));await entered.promise;const waiting=b.ready();change(f);release.resolve();await assert.rejects(waiting);
  assert.equal(f.idb.size,0);assert.equal(f.calls.del.length,0);
  if(name!=='owner'&&name!=='permission'&&name!=='switch')assert.equal(b.hasRescue(),true);
});

test('a non-quota local failure is not accepted as an IDB rescue batch',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();const denied=Object.assign(Error('denied'),{name:'SecurityError'});f.localError(denied);
  assert.throws(()=>stage(b,p('new','B')),e=>e===denied);assert.equal(b.hasRescue(),false);assert.equal(f.calls.put.length,0);
});

for(const mode of ['false','throw'])test('promotion delete '+mode+' leaves an exact LS copy pending and ACK blocked',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();const receipt=stage(b,p('new','B'));await b.ready();const raw=f.idb.get(receipt.keys[0]);
  f.full(false);f.hooks.del=()=>{if(mode==='false')return false;throw Error('synthetic deletion failure');};
  await assert.rejects(b.promote());assert.equal(f.local.getItem(receipt.keys[0]),raw);assert.equal(f.idb.get(receipt.keys[0]),raw);
  assert.equal(b.hasRescue(),true);assert.throws(()=>b.ack(receipt));f.hooks.del=null;
  await b.promote();assert.equal(f.idb.size,0);assert.equal(b.ack(receipt),1);
});

test('an interrupted committed deletion stays pending until a later exact absence read',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();const receipt=stage(b,p('new','B'));await b.ready();f.full(false);
  f.hooks.del=k=>{f.idb.delete(k);throw Error('completion interrupted');};await assert.rejects(b.promote(),/interrupted/);
  assert.equal(b.hasRescue(),true);assert.equal(f.idb.size,0);assert.throws(()=>b.ack(receipt));f.hooks.del=null;
  await b.promote();assert.equal(f.calls.del.length,1,'retry confirms absence instead of an unchecked deletion');
  assert.equal(b.hasRescue(),false);assert.equal(b.ack(receipt),1);
});

test('promotion refuses a conflicting local batch without deleting the IDB original',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();const receipt=stage(b,p('new','B'));await b.ready();
  f.ls.set(receipt.keys[0],'conflicting local original');f.full(false);await assert.rejects(b.promote(),/다릅니다/);
  assert.equal(f.calls.del.length,0);assert.equal(f.idb.size,1);assert.equal(f.local.getItem(receipt.keys[0]),'conflicting local original');
});

test('a foreign LS original arriving during promotion peek is preserved instead of overwritten',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();const receipt=stage(b,p('new','B'));await b.ready();f.full(false);
  const key=receipt.keys[0],raw=f.idb.get(key),entered=gate(),release=gate();
  assert.equal(f.local.getItem(key),null);
  f.hooks.peek=async k=>{if(k===key){entered.resolve();await release.promise;}};
  const promoting=b.promote();await entered.promise;f.ls.set(key,'foreign LS original written during peek');release.resolve();
  await assert.rejects(promoting,/다릅니다/);assert.equal(f.local.getItem(key),'foreign LS original written during peek');
  assert.equal(f.idb.get(key),raw);assert.equal(f.calls.del.length,0);assert.equal(b.hasRescue(),true);assert.throws(()=>b.ack(receipt));
});

for(const [name,refresh]of Object.entries({epoch:f=>f.epoch(),permissions:f=>f.permission('refreshed edit scope')}))test('explicit prepare refreshes a same-owner '+name+' only after exact IDB verification',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();const receipt=stage(b,p('new','B'));await b.ready();
  const original=f.idb.get(receipt.keys[0]),puts=f.calls.put.length;refresh(f);assert.equal(b.prepared(),false);
  await b.prepare();await b.ready();assert.equal(b.prepared(),true);assert.equal(f.idb.get(receipt.keys[0]),original);
  assert.equal(f.calls.put.length,puts,'scope refresh does not replace an immutable original');
  f.full(false);await b.promote();assert.equal(b.hasRescue(),false);assert.equal(f.idb.size,0);assert.equal(b.ack(receipt),1);
});

test('permission downgrade preparation retains rescue originals without starting a write or promotion',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();const receipt=stage(b,p('new','B'));await b.ready();
  const key=receipt.keys[0],original=f.idb.get(key),puts=f.calls.put.length;
  f.permission('read only');f.editable(false);await b.prepare();assert.equal(b.prepared(),true);assert.equal(b.overlay([])[0].name,'B');
  await assert.rejects(b.promote());assert.throws(()=>b.ack(receipt));assert.equal(f.calls.put.length,puts);assert.equal(f.calls.del.length,0);
  assert.equal(f.local.getItem(key),null);assert.equal(f.idb.get(key),original);assert.equal(b.hasRescue(),true);
  f.permission('edit again');f.editable(true);await b.prepare();f.full(false);await b.promote();assert.equal(b.ack(receipt),1);
});

test('permission downgrade does not retry a previously failed IDB preservation write',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();f.hooks.put=()=>{throw Error('IDB unavailable');};
  stage(b,p('new','B'));await assert.rejects(b.ready(),/unavailable/);const puts=f.calls.put.length;
  f.permission('read only');f.editable(false);f.hooks.put=null;await b.prepare();
  assert.equal(b.prepared(),true);assert.equal(b.overlay([])[0].name,'B');assert.equal(f.calls.put.length,puts);assert.equal(f.idb.size,0);
  await assert.rejects(b.ready(),/unavailable/);assert.equal(b.hasRescue(),true);
});

test('a later distinct C can be staged while promotion waits without permitting an early ACK',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();stage(b,p('new','B'));await b.ready();f.full(false);
  const entered=gate(),release=gate();f.hooks.del=async()=>{entered.resolve();await release.promise;};
  const promoting=b.promote();await entered.promise;const latest=stage(b,p('new','C'),[p('new','B')]);
  assert.throws(()=>b.ack(latest));release.resolve();await promoting;assert.equal(b.read().rows[0].player.name,'C');
  assert.equal(b.ack(latest),1);assert.equal(b.pending(),false);assert.equal(f.idb.size,0);
});

test('permission changing during deletion prevents retirement and keeps both original copies',async()=>{
  const f=fixture(),b=f.bridge;await b.prepare();f.full();const receipt=stage(b,p('new','B'));await b.ready();f.full(false);
  const entered=gate(),release=gate();f.hooks.del=async()=>{entered.resolve();await release.promise;};
  const promoting=b.promote();await entered.promise;f.permission('read-only');release.resolve();await assert.rejects(promoting);
  assert.equal(f.idb.size,1);assert.equal(f.local.getItem(receipt.keys[0]),f.idb.get(receipt.keys[0]));assert.equal(b.hasRescue(),true);
});

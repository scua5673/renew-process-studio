'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create,install}=require('../studio/board-draft.js');
const Guest=require('../studio/board-guest.js');
const tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function harness(){
 const local=new Map(),idb=new Map(),hooks={},writes=[];
 let owner={uid:'synthetic-account-a',wid:'personal-a',active:'team-a',seal:'source-a',switchEpoch:'0'},seq=1,current=true,quota=false,blocked=false;
 let raw=JSON.stringify({snap:{players:[{id:'synthetic',x:521}]},view:'board',boardPages:{pages:[{snap:{players:[{x:521}]}},{snap:{players:[{x:522}]}}]},animFrames:[{snap:{players:[{x:521}]}},{snap:{players:[{x:530}]}}]});
 const d={context:()=>({owner,seq,current,blocked,needed:true}),capture:()=>({raw}),key:o=>'ps_private_board_draft_v1:'+o.uid+':unsaved',now:()=>123,
  local:{getItem:k=>local.get(k)??null,setItem(k,v){if(quota)throw Error('synthetic quota');writes.push('local');local.set(k,v);}},
  storage:{async get(k){if(hooks.get)await hooks.get(k);return idb.has(k)?{value:idb.get(k)}:null;},async replaceIfValue(k,b,v,guard){if(hooks.cas)await hooks.cas(k);guard();if((idb.get(k)??null)!==b)return false;writes.push('idb');idb.set(k,v);return true;}},
  async verifyIDB(k,record){if(idb.get(k)!==record)throw Error('IDB record is not durable');}
 };
 const api=create(d),key=d.key(owner);
 return {api,d,local,idb,hooks,writes,key,raw,quota(){quota=true;},available(){quota=false;},lock(){current=false;},block(){blocked=true;},prepare(){blocked=false;},change(){owner={...owner,uid:'synthetic-account-b',seal:'source-b'};},edit(){seq++;},mutate(){raw=raw.replace('521','999');},record:()=>local.get(key)||idb.get(key)};
}
test('immediate unsaved full board is durable before the guard and the guarded barrier only verifies it',async()=>{
 const h=harness();assert.equal(h.api.pending(),true);await h.api.ready();assert.equal(h.api.pending(),false);
 assert.equal(JSON.parse(h.record()).raw,h.raw);assert.deepEqual(h.writes,['local']);
 h.lock();await h.api.ready();assert.deepEqual(h.writes,['local'],'guarded verification makes no writes');
 h.edit();await assert.rejects(h.api.ready(),/초안/);assert.deepEqual(h.writes,['local'],'new guarded changes cannot reuse the old receipt');
});
test('quota fallback waits for exact IDB CAS and its readback rather than a queued write',async()=>{
 const h=harness(),g=deferred();h.quota();h.hooks.cas=()=>g.promise;let settled=false;
 const work=h.api.ready().then(()=>{settled=true;});await tick();assert.equal(settled,false);assert.equal(h.api.pending(),true);assert.equal(h.record(),undefined);
 g.resolve();await work;assert.equal(JSON.parse(h.idb.get(h.key)).raw,h.raw);assert.equal(h.api.pending(),false);
 h.lock();await h.api.ready();assert.deepEqual(h.writes,['idb']);
});
test('failure of both stores remains pending and a later retry must really persist',async()=>{
 const h=harness();h.quota();h.hooks.get=()=>{throw Error('synthetic IDB unavailable');};
 await assert.rejects(h.api.ready());assert.equal(h.api.pending(),true);assert.equal(h.record(),undefined);
 delete h.hooks.get;await h.api.ready();assert.equal(h.api.pending(),false);assert.equal(JSON.parse(h.record()).raw,h.raw);
});
for(const phase of ['read','cas','verify'])test('an owner change during '+phase+' cannot write or acknowledge the old draft',async()=>{
 const h=harness(),g=deferred();h.quota();let reads=0;
 if(phase==='cas')h.hooks.cas=()=>g.promise;
 else h.hooks.get=()=>++reads===(phase==='read'?1:2)?g.promise:undefined;
 const work=h.api.ready();await tick();h.change();g.resolve();await assert.rejects(work,/초안/);
 assert.equal(h.api.pending(),true);if(phase!=='verify')assert.equal(h.idb.size,0);assert.equal(h.local.size,0);
});
test('a newer local source while the IDB write waits is preserved',async()=>{
 const h=harness(),g=deferred();h.quota();h.hooks.cas=()=>g.promise;
 const work=h.api.ready();await tick();h.local.set(h.key,'another tab source');g.resolve();await assert.rejects(work,/초안/);
 assert.equal(h.local.get(h.key),'another tab source');assert.equal(h.idb.size,0);
});
test('an IDB CAS conflict cannot replace another draft or claim durability',async()=>{
 const h=harness(),g=deferred();h.quota();h.hooks.cas=()=>g.promise;
 const work=h.api.ready();await tick();h.idb.set(h.key,'another tab draft');g.resolve();await assert.rejects(work,/초안/);
 assert.equal(h.idb.get(h.key),'another tab draft');assert.equal(h.api.pending(),true);
});
test('a later IDB read must match the entire record before durability is reported',async()=>{
 const h=harness();h.quota();let reads=0;h.hooks.get=()=>{if(++reads===2)h.idb.set(h.key,'unconfirmed different record');};
 await assert.rejects(h.api.ready(),/초안/);assert.equal(h.api.pending(),true);assert.equal(h.idb.get(h.key),'unconfirmed different record');
});
test('a changed receipt under the guard fails closed without rewriting it',async()=>{
 const h=harness();await h.api.ready();h.lock();h.local.set(h.key,'other source');await assert.rejects(h.api.ready(),/초안/);assert.deepEqual(h.writes,['local']);
});
test('lifecycle draft writing still leaves the full local copy synchronously',async()=>{
 const h=harness(),g=deferred();h.hooks.get=()=>g.promise;const work=h.api.write();
 assert.equal(JSON.parse(h.local.get(h.key)).raw,h.raw);assert.equal(h.api.pending(),true);g.resolve();await work;
});
for(const quota of [false,true])test('a future IDB draft prevents confirmation and is never overwritten, quota '+quota,async()=>{
 const h=harness();if(quota)h.quota();const other=JSON.stringify({v:1,uid:'synthetic-account-a',wid:'personal-a',raw:'{}',at:999999});h.idb.set(h.key,other);
 await assert.rejects(h.api.ready(),/초안/);assert.equal(h.api.pending(),true);assert.equal(h.idb.get(h.key),other);assert.ok(!h.writes.includes('idb'));
});
test('a full snapshot mutation without a seq change cannot reuse a guarded receipt',async()=>{
 const h=harness();await h.api.ready();h.mutate();h.lock();await assert.rejects(h.api.ready(),/초안/);assert.deepEqual(h.writes,['local']);
});
test('temporary capture locks block a dirty transition rather than treating it as clean',async()=>{
 const h=harness();h.block();await assert.rejects(h.api.ready(),/초안/);assert.equal(h.api.pending(),true);assert.equal(h.record(),undefined);
});
test('playback is restored to the editing snapshot before the transition captures it',async()=>{
 const h=harness();h.block();h.d.prepare=()=>h.prepare();await h.api.ready();assert.equal(JSON.parse(h.record()).raw,h.raw);
});
test('a malformed future IDB body is ignored exactly as the normal draft reader ignores it',async()=>{
 const h=harness();h.idb.set(h.key,JSON.stringify({v:1,uid:'synthetic-account-a',wid:'personal-a',raw:'invalid JSON',at:999999}));
 await h.api.ready();assert.equal(JSON.parse(h.local.get(h.key)).raw,h.raw);
});
test('quota confirmation captures a bounded number of complete snapshots',async()=>{
 const h=harness();h.quota();let captures=0;const capture=h.d.capture;h.d.capture=()=>{captures++;return capture();};await h.api.ready();
 assert.ok(captures<=10,'snapshot checks are bounded per explicit transition');
});
test('the frame barrier cancels a queued derived preview before capturing its durable source',async()=>{
 const h=harness(),cleared=[];
 const w={_boardPrivateOwner:{uid:'synthetic-account-a',wid:'personal-a'},_boardPrivateLoaded:true,_boardPrivateEditSeq:1,_boardDraftT:11,_boardPreviewTimer:12,
  document:{body:{classList:{contains:()=>false}}},boardDraftWriteNow(){},boardManualChanged:()=>true,boardPrivateCurrent:()=>true,
  boardLiveCapture:()=>({raw:h.raw}),boardDraftKey:()=>h.key,restoreAnimBeforeCapture(){},clearTimeout:t=>cleared.push(t),localStorage:h.d.local,storage:h.d.storage,PSStorage:{sharedReady:async()=>true,sharedVerified:h.d.verifyIDB}};
 install(w);await w.psFlushPendingReady();assert.ok(cleared.includes(11));assert.ok(cleared.includes(12));assert.equal(w._boardPreviewTimer,null);assert.equal(w.psHasPending(),false);
});

function adoptedBoard(){
 const owner={uid:'synthetic-account-a',wid:'personal-a',active:'team-a',seal:'original-seal',switchEpoch:'0'};
 let liveOwner=owner;
 const h=harness(),guestRaw=Guest.encode(h.raw,1);h.idb.set(Guest.KEY,guestRaw);
 h.local.set('ps_sync_session',JSON.stringify({uid:owner.uid}));h.local.set('ps_cache_owner_v1',JSON.stringify(owner));h.local.set('ps_active_ws','team-a');
 const w={location:{search:''},parent:{PSSync:{session:()=>({uid:owner.uid})}},document:{body:{classList:{contains:()=>false}}},
  _boardPrivateOwner:null,_boardPrivateLoaded:false,_boardPrivateEditSeq:0,_boardPrivateGeneration:0,_boardPrivateRecord:null,_boardPrivateBase:null,_boardPrivateHead:null,_boardPrivateIdbHead:null,_boardManualDirty:false,_boardUserTouched:false,
  localStorage:h.d.local,storage:h.d.storage,PSStorage:{sharedReady:async()=>true,sharedVerified:h.d.verifyIDB},clearTimeout(){},toast(){},
  boardPrivateOwner:()=>liveOwner,boardPrivateCurrent:o=>!!o&&liveOwner===o,
  boardManualChanged(){return this._boardManualDirty&&this._boardUserTouched;},boardManualStatus(){},boardDraftRead:async()=>null,
  boardLiveApply(live){this.canvas=live.snap;},boardLiveCapture(){return {raw:JSON.stringify({snap:this.canvas,view:'board'})};},boardDraftKey:()=>h.key,boardDraftWriteNow(){throw Error('unsafe original draft writer was reached');},
  boardSaveExplicit:async()=>true,boardSaveOne:async()=>true,
  boardSaveLive(){this._boardPrivateEditSeq++;this._boardManualDirty=true;this._boardUserTouched=true;},
  restoreLiveBoard(){this._boardPrivateOwner=liveOwner;this._boardPrivateLoaded=true;this._boardPrivateBase={raw:null,cupd:null};return Promise.resolve(true);},
  boardPrivateAuthChanged(){this._boardPrivateLoaded=false;},restoreAnimBeforeCapture(){}
 };
 Guest.mount(w,{lex:()=>({applying:false,playing:false})});install(w);
 return {h,w,guestRaw,lock(){liveOwner=null;w.boardPrivateAuthChanged();}};
}
test('the real guest adoption predicate keeps an unchanged adopted board in its slot through a source guard',async()=>{
 const {w,h,guestRaw,lock}=adoptedBoard();await w.restoreLiveBoard();
 assert.equal(w.__psBoardGuest.adopted(),true);assert.equal(w.__psBoardGuest.draftSuppressed(),true);
 await w.boardDraftWriteNow();await w.psFlushPendingReady();
 assert.equal(h.local.has(h.key),false);assert.equal(h.idb.has(h.key),false);assert.equal(h.idb.get(Guest.KEY),guestRaw);
 lock();assert.equal(w.__psBoardGuest.adopted(),false,'the existing guest auth wrapper clears its transient adoption flag');
 await w.psFlushPendingReady();assert.equal(w.psHasPending(),false);assert.equal(h.local.has(h.key),false);assert.equal(h.idb.get(Guest.KEY),guestRaw,'the original guest source remains durable');
});
test('a later real edit to an adopted guest board requires an exact durable draft before the source guard',async()=>{
 const {w,h,guestRaw,lock}=adoptedBoard();await w.restoreLiveBoard();
 assert.equal(w.__psBoardGuest.draftSuppressed(),true);w.canvas.players[0].x=777;w.boardSaveLive();
 assert.equal(w.__psBoardGuest.adopted(),true,'adopted alone must not suppress later user changes');assert.equal(w.__psBoardGuest.draftSuppressed(),false);
 assert.equal(w.psHasPending(),true);await w.psFlushPendingReady();
 const draft=h.local.get(h.key);assert.equal(JSON.parse(JSON.parse(draft).raw).snap.players[0].x,777);assert.equal(h.idb.get(Guest.KEY),guestRaw);
 lock();await w.psFlushPendingReady();assert.equal(h.local.get(h.key),draft,'the guarded barrier only verifies the later edit');
});

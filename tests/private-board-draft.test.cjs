'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
function part(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j);}
const helpers=part('var _boardPrivateOwner=null,','/* 보관함 작전판은 같은 캔버스를 빌려 쓴다.');
const writer=part('function _boardLiveWriteNow(recovery){','function restoreAnimBeforeCapture(){');
const restore=part('async function restoreLiveBoard(){','/* 배치 저장·배치 라이브러리 제거');
const copy=x=>x==null?x:JSON.parse(JSON.stringify(x));
const snap=x=>({players:[{id:1,x,y:50}],equipment:[],drawings:[],ball:null,pitchN:1,orientation:'h'});
const payload=x=>JSON.stringify({snap:snap(x),view:'board',animFrames:[{snap:snap(x)},{snap:snap(x+1)}],animActive:1,meetSlides:[],boardPages:{pages:[{name:'one',snap:snap(x)},{name:'two',snap:snap(x+2)}],idx:1},_savedAt:x});
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
async function ticks(){for(let i=0;i<70;i++)await Promise.resolve();}
function harness(options={}){
 let owner={uid:'synthetic-user-a',wid:'personal-a',active:'team-a',seal:'seal-a',epoch:0,switchSeal:'',switchEpoch:'1'},server={raw:null,cupd:null},getter=null,saver=null;
 const ls=new Map(options.ls||[]),idb=new Map(options.idb||[]),reads=[],writes=[],saves=[],messages=[],events={},timers=[];
 const nodes={animBar:{classList:{contains:()=>false}},hint:{style:{}}};
 const c={psPhoneBoardReadOnly:()=>false,PSBoardDraft:require('../studio/board-draft.js'),console,JSON,Math,Date,Object,Array,Number,String,Promise,Error,URLSearchParams,encodeURIComponent,location:{origin:'https://private-board.invalid',search:''},
  PRIVATE_BOARD_PREFIX:'ps_private_board_draft_v1:',EDRAFT_KEY:'cs_editor_draft_v1',_bliveSaveSeq:0,_bliveDirty:false,_bliveApplying:false,_bliveT:null,
  _vaultBoardContext:null,_vaultBoardRestoring:false,animPlaying:false,matchActive:false,anim:{slides:[],frames:[]},animActive:0,
  state:snap(0),undoStack:[],redoStack:[],autoOrient:true,
  document:{body:{classList:{contains:()=>false}},addEventListener(){}},
  setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},
  localStorage:{getItem(k){reads.push(['ls',k]);return ls.get(k)??null;},setItem(k,v){if(options.quota)throw Error('synthetic quota');writes.push(['ls',k,String(v)]);ls.set(k,String(v));},removeItem(k){assert.ok(k.startsWith('ps_private_board_draft_v1:'),'only an owner-guarded private copy may be removed');ls.delete(k);}},
  storage:{async get(k){reads.push(['idb',k]);return idb.has(k)?{value:idb.get(k)}:null;},async peek(k){reads.push(['peek',k]);return idb.has(k)?{value:idb.get(k)}:null;},async set(k,v,current){if(current)current();writes.push(['idb',k,v]);idb.set(k,v);return true;},async replaceIfValue(k,b,v,current){if(current)current();if((idb.get(k)??null)!==b)return false;idb.set(k,v);return true;}},
  store:{async get(){return null;}},$:id=>nodes[id]||null,toast:m=>messages.push(m),captureSnap(){return copy(c.state);},loadSnap(s){c.state=copy(s);},
  dc:copy,renderTokens(){},renderDrawings(){},updateDelUI(){},restoreAnimBeforeCapture(){},renderAnimFrames(){},
  setView(v){c.__csView=v;},addEventListener(type,fn){(events[type]||(events[type]=[])).push(fn);},
 };
 c.PSStorage={sharedVerified:async(k,raw)=>{assert.equal(idb.get(k),raw);},localRecovered:async(k,raw,current)=>{assert.equal(current(),true);assert.equal(ls.get(k),raw);}};
 c.window=c;c.__csView='board';c.__animFrames=()=>copy(c.anim.frames);c.__animReset=()=>{c.anim.frames=[];c.animActive=-1;};c.__animRestore=(frames,i)=>{c.anim.frames=copy(frames);c.animActive=i;};
 c.__psPages={liveVal:()=>c.pages||null,restoreContext(p){c.pages=copy(p);}};
 c.parent={postMessage:m=>messages.push(m),PSSync:{boardLive:{version:2,scope:'personal',owner:()=>copy(owner),async get(){if(getter)return getter();return {ok:true,uid:owner.uid,wid:owner.wid,...server};},async save(raw,opts){saves.push({raw,opts:copy(opts)});if(saver)return saver(raw,opts);assert.deepEqual(copy(opts),{uid:owner.uid,wid:owner.wid,expected_raw:server.raw,expected_cupd:server.cupd});server={raw,cupd:(server.cupd||0)+1};return {ok:true,uid:owner.uid,wid:owner.wid,...server};}}}};
 vm.createContext(c);vm.runInContext(helpers+writer+restore,c);
 return {c,ls,idb,reads,writes,saves,messages,events,timers,key:()=>c.PRIVATE_BOARD_PREFIX+encodeURIComponent(owner.uid),owner:()=>copy(owner),server:()=>copy(server),setServer(r){server=copy(r);},get(fn){getter=fn;},save(fn){saver=fn;},switch(o){owner={...owner,...o};},async boot(){assert.equal(await c.restoreLiveBoard(),true);},record(){return JSON.parse(ls.get(this.key())||idb.get(this.key())||'null');}};
}

function startupPageRestore(h){
 const load=part('function loadIdx(i,keep){','function _lookStampPages(){'),consume=part('function _consumePending(){','try{ window.__psPagesConsume=');
 h.c.renderTokens=()=>h.c.boardSaveLive();h.c.renderDrawings=()=>h.c.boardSaveLive();
 vm.runInContext('var pages=null,idx=0,_inVault=false;var _clone=dc;function clearHistory(){}function render(){}'+load+consume,h.c);
}
test('startup page replay restores an existing capture lock on both return and exception',()=>{
 const api=require('../studio/board-draft.js');for(const previous of [undefined,0,true,'nested capture'])for(const throws of [false,true]){
  const w={__capLock:previous},load=i=>{assert.equal(i,7);assert.equal(w.__capLock,1);if(throws)throw Error('synthetic page replay error');return 'replayed';};
  if(throws)assert.throws(()=>api.restorePage(w,load,7),/synthetic page replay error/);else assert.equal(api.restorePage(w,load,7),'replayed');assert.equal(w.__capLock,previous);
 }
});
test('startup page replay is derived rendering and does not advance the private edit sequence',async()=>{
 const h=harness();startupPageRestore(h);await h.boot();h.c.__pendingBoardPages=JSON.parse(payload(100)).boardPages;
 const seq=h.c._boardPrivateEditSeq;h.c._consumePending();assert.equal(h.c._boardPrivateEditSeq,seq);assert.equal(h.c.boardManualChanged(),false);assert.equal(h.c.__capLock,undefined);
});
for(const view of ['session','meeting','synthetic-borrowed-view'])test('inputs in '+view+' never advance or store a private working-board edit',async()=>{
 const h=harness();await h.boot();h.c.PSBoardDraft.install(h.c);const seq=h.c._boardPrivateEditSeq,writes=h.writes.length;
 h.c.__csView=view;h.c.state=snap(999);h.c._boardUserTouched=true;h.c.boardSaveLive();assert.equal(h.c._boardPrivateEditSeq,seq);assert.equal(await h.c.__psBoardDraft.write(),false);assert.equal(h.writes.length,writes);assert.equal(h.c.__psBoardDraft.snapshot().blocked,true);
});
for(const view of ['board','match'])test('real '+view+' inputs still advance and durably preserve the private edit',async()=>{
 const h=harness();await h.boot();h.c.PSBoardDraft.install(h.c);const seq=h.c._boardPrivateEditSeq;h.c.__csView=view;h.c.state=snap(999);h.c._boardUserTouched=true;h.c.boardSaveLive();assert.ok(h.c._boardPrivateEditSeq>seq);await h.c.psFlushPendingReady();assert.equal(h.c.psHasPending(),false);const record=JSON.parse(h.idb.get(h.c.boardDraftKey(h.owner())));assert.equal(JSON.parse(record.raw).snap.players[0].x,999);assert.equal(JSON.parse(record.raw).view,view);
});
for(const userEdit of [false,true])test('startup page replay during an exact head receipt '+(userEdit?'preserves a later real edit and rejects the stale receipt':'keeps full draft recovery available'),async()=>{
 const h=harness();startupPageRestore(h);const o=h.owner(),key=h.key()+':unsaved',draft=JSON.stringify({v:1,uid:o.uid,wid:o.wid,raw:payload(521),at:Date.now()});h.idb.set(key,draft);h.setServer({raw:payload(100),cupd:1});
 const gate=deferred(),verify=h.c.PSStorage.sharedVerified;let waiting=false;h.c.PSStorage.sharedVerified=async(k,raw)=>{await verify(k,raw);if(k===h.key()){waiting=true;await gate.promise;}};
 const work=h.c.restoreLiveBoard();await ticks();assert.equal(waiting,true);const seq=h.c._boardPrivateEditSeq;h.c._consumePending();
 if(userEdit){h.c.state=snap(999);h.c._boardUserTouched=true;h.c.boardSaveLive();}
 gate.resolve();const restored=await work;await ticks();assert.equal(h.idb.get(key),draft,'the complete previous draft stays exact');
 if(userEdit){assert.equal(restored,false);assert.ok(h.c._boardPrivateEditSeq>seq);assert.equal(h.c.state.players[0].x,999);assert.equal(!!h.c.__boardDraftPending,false);assert.equal(h.c.boardManualChanged(),true);}
 else{assert.equal(restored,true);assert.equal(h.c._boardPrivateEditSeq,seq);assert.equal(h.c.__boardDraftPending.raw,JSON.parse(draft).raw);assert.equal(h.c.__psBoardPrivatePersistence.pending,false);assert.equal(h.c.__psBoardPrivatePersistence.failed,false);}
});

test('legacy team live, recovery and snapshots are neither read nor promoted, even with future timestamps',async()=>{
 const old=payload(900000),legacy=['cs_board_live_v1','cs_board_recovery_v1','cs_snap_board_v1','cs_snap_match_v2'];
 const h=harness({ls:legacy.map(k=>[k,old]),idb:legacy.map(k=>[k,old])});await h.boot();
 assert.equal(h.c.state.players.length,0);assert.equal(h.saves.length,0);assert.ok(h.reads.every(([,k])=>!legacy.includes(k)));for(const k of legacy){assert.equal(h.ls.get(k),old);assert.equal(h.idb.get(k),old);}
});
test('explicit personal remote reply restores full snapshot, animation and pages',async()=>{
 const h=harness();h.setServer({raw:payload(12),cupd:7});await h.boot();assert.equal(h.c.state.players[0].x,12);assert.equal(h.c.anim.frames.length,2);assert.equal(h.c.pages.idx,1);assert.equal(h.record().pending,false);assert.equal(h.record().base.cupd,7);
});
test('edits remain unsaved until explicit save',async()=>{
 const h=harness();await h.boot();h.c.state=snap(22);h.c.boardSaveLive();assert.equal(h.record(),null);assert.equal(h.saves.length,0);await h.c.boardSaveExplicit();assert.equal(h.record().pending,false);assert.equal(h.saves.length,1);assert.equal(h.saves[0].opts.expected_raw,null);
});
test('same account resumes a private working board across a team switch',async()=>{
 const h=harness();await h.boot();h.c.state=snap(25);h.c.boardSaveLive();await h.c.boardSaveExplicit();const pending=copy(h.record());await ticks();h.switch({active:'team-b',seal:'seal-b',switchEpoch:'2'});h.c.boardPrivateAuthChanged();await ticks();assert.equal(h.c.state.players[0].x,25);assert.equal(h.record().uid,pending.uid);assert.equal(h.record().wid,'personal-a');
});
async function guardedDraft(){
 const h=harness(),initial=h.owner();h.switch({seal:JSON.stringify({uid:initial.uid,wid:initial.active})});await h.boot();h.c.state=snap(521);h.c._boardUserTouched=true;h.c.boardSaveLive();h.c.boardDraftWriteNow=()=>false;h.c.boardDraftKey=o=>h.c.boardPrivateKey(o)+':unsaved';
 h.c.PSBoardDraft.install(h.c);await h.c.psFlushPendingReady();
 const o=h.owner(),g={v:1,token:'synthetic-switch',from:o.active,to:'team-b',epoch:'synthetic-switch:epoch',at:Date.now()};
 h.ls.set('ps_active_ws',o.active);h.ls.set('ps_cache_owner_v1',o.seal);h.ls.set('ps_ws_switch_epoch_v1',g.epoch);h.ls.set('ps_ws_switch_guard_v1',JSON.stringify(g));
 h.c.parent.PSSync.session=()=>({uid:o.uid});h.c.parent.PSSync.boardLive.owner=()=>null;
 return {h,o,g,generation:h.c._boardPrivateGeneration,draft:h.idb.get(h.c.boardDraftKey(o))};
}
async function certifiedWorkingExit(options={}){
 const h=harness(),initial=h.owner();h.switch({seal:JSON.stringify({uid:initial.uid,wid:initial.active})});await h.boot();h.c.state=snap(521);h.c._boardUserTouched=true;h.c.boardSaveLive();
 vm.runInContext(part('function boardFlushLive(){','try{window.__boardFlushLive=boardFlushLive;}'),h.c);
 if(options.flush)h.c.psFlushPendingReady=options.flush;if(options.has)h.c.psHasPending=options.has;if(options.shared)h.c.PSStorage.sharedReady=options.shared;
 h.c.PSBoardDraft.install(h.c);const result=h.c.boardFlushLive('session');h.c.__csView='session';await result;await ticks();await h.c.psFlushPendingReady();return h;
}
function actualSourcePause(h,change){
 const o=h.owner(),g={v:1,token:'synthetic-cert-switch',from:o.active,to:'team-b',epoch:'synthetic-cert-epoch',at:Date.now()};
 h.ls.set('ps_active_ws',o.active);h.ls.set('ps_cache_owner_v1',JSON.stringify({uid:o.uid,wid:o.active,nonce:'actual recertification'}));h.ls.set('ps_ws_switch_epoch_v1',g.epoch);h.ls.set('ps_ws_switch_guard_v1',JSON.stringify(g));h.c.parent.PSSync.session=()=>({uid:o.uid});h.c.parent.PSSync.boardLive.owner=()=>null;if(change)change(h,o,g);h.c.boardPrivateAuthChanged();
}
test('certified borrowed source uses the actual valid source-pause proof for readonly team-switch verification',async()=>{
 const h=await certifiedWorkingExit(),raw=h.ls.get(h.c.boardDraftKey(h.owner()))||h.idb.get(h.c.boardDraftKey(h.owner()));assert.equal(h.c.__psBoardDraft.snapshot().sourceSuspended,true);actualSourcePause(h);const writes=h.writes.length;await h.c.psFlushPendingReady();assert.equal(h.c.psHasPending(),false);assert.equal(h.writes.length,writes);assert.equal(h.ls.get(h.c.boardDraftKey(h.owner()))||h.idb.get(h.c.boardDraftKey(h.owner())),raw);
});
for(const kind of ['missing marker','expired marker','wrong epoch','wrong active team','foreign seal'])test('borrowed source cannot use an unproven '+kind+' pause',async()=>{
 const h=await certifiedWorkingExit();actualSourcePause(h,(h,o,g)=>{if(kind==='missing marker')h.ls.delete('ps_ws_switch_guard_v1');if(kind==='expired marker')h.ls.set('ps_ws_switch_guard_v1',JSON.stringify({...g,at:Date.now()-90001}));if(kind==='wrong epoch')h.ls.set('ps_ws_switch_epoch_v1','unproven epoch');if(kind==='wrong active team')h.ls.set('ps_active_ws','other team');if(kind==='foreign seal')h.ls.set('ps_cache_owner_v1',JSON.stringify({uid:'foreign user',wid:o.active}));});const writes=h.writes.length;await assert.rejects(h.c.psFlushPendingReady());assert.equal(h.writes.length,writes);assert.equal(h.c.psHasPending(),true);
});
test('a certified private receipt never bypasses the original editor or shared storage barriers',async()=>{
 let nativeError=null,sharedError=null,otherPending=false;const h=await certifiedWorkingExit({flush:()=>nativeError?Promise.reject(nativeError):true,shared:()=>sharedError?Promise.reject(sharedError):true,has:()=>otherPending});
 nativeError=Error('synthetic editor pending');await assert.rejects(h.c.psFlushPendingReady(),/synthetic editor pending/);nativeError=null;sharedError=Error('synthetic shared storage failure');await assert.rejects(h.c.psFlushPendingReady(),/synthetic shared storage failure/);sharedError=null;otherPending=true;assert.equal(h.c.psHasPending(),true);otherPending=false;await h.c.psFlushPendingReady();assert.equal(h.c.psHasPending(),false);
});
test('the synchronous view-exit hook retains the original receiver, arguments, return and thrown error',async()=>{
 for(const throws of [false,true]){const h=harness();await h.boot();const receiver={},result={},failure=Error('synthetic view-exit failure');let seen;h.c.boardFlushLive=function(...args){seen={receiver:this,args};if(throws)throw failure;return result;};h.c.PSBoardDraft.install(h.c);if(throws)assert.throws(()=>h.c.boardFlushLive.call(receiver,'session',7),e=>e===failure);else assert.equal(h.c.boardFlushLive.call(receiver,'session',7),result);assert.equal(seen.receiver,receiver);assert.deepEqual(seen.args,['session',7]);}
});
test('the actual intentional source guard suspends writes without invalidating an unchanged exact draft receipt',async()=>{
 const {h,o,generation,draft}=await guardedDraft(),before=h.writes.length;h.c.boardPrivateAuthChanged();
 assert.equal(h.c._boardPrivateLoaded,false);assert.equal(h.c.boardPrivateCurrent(o),false);assert.equal(h.c._boardPrivateGeneration,generation,'a proven source suspension preserves the existing read-only receipt generation');
 await h.c.psFlushPendingReady();assert.equal(h.c.psHasPending(),false);assert.equal(h.writes.length,before,'guarded receipt verification performs no new writes');assert.equal(h.idb.get(h.c.boardDraftKey(o)),draft);
 h.c.state=snap(522);await assert.rejects(h.c.psFlushPendingReady(),/초안/);assert.equal(h.writes.length,before,'a changed guarded body cannot reuse the receipt or write');
});
test('a real same-source cache recertification under the guard preserves only the exact read-only draft receipt',async()=>{
 const {h,o,generation,draft}=await guardedDraft(),before=h.writes.length;h.ls.set('ps_cache_owner_v1',JSON.stringify({uid:o.uid,wid:o.active,at:Date.now(),nonce:'synthetic-recertification'}));h.c.boardPrivateAuthChanged();
 assert.equal(h.c._boardPrivateGeneration,generation);assert.equal(h.c._boardPrivateLoaded,false);assert.equal(h.c.boardPrivateCurrent(o),false);await h.c.psFlushPendingReady();assert.equal(h.c.psHasPending(),false);assert.equal(h.writes.length,before);assert.equal(h.idb.get(h.c.boardDraftKey(o)),draft);
});
for(const invalid of ['absent','expired','from','to','epoch','seal','seal-uid','seal-team','old-seal','active','malformed'])test('an unproven '+invalid+' suspension still invalidates the old draft generation',async()=>{
 const {h,o,g,generation}=await guardedDraft();
 if(invalid==='absent')h.ls.delete('ps_ws_switch_guard_v1');if(invalid==='expired')g.at-=100000;if(invalid==='from')g.from='other-team';if(invalid==='to')g.to=g.from;
 if(['expired','from','to'].includes(invalid))h.ls.set('ps_ws_switch_guard_v1',JSON.stringify(g));if(invalid==='epoch')h.ls.set('ps_ws_switch_epoch_v1','other-epoch');if(invalid==='seal')h.ls.set('ps_cache_owner_v1','other-seal');if(invalid==='seal-uid')h.ls.set('ps_cache_owner_v1',JSON.stringify({uid:'other-account',wid:o.active}));if(invalid==='seal-team')h.ls.set('ps_cache_owner_v1',JSON.stringify({uid:o.uid,wid:'other-team'}));if(invalid==='old-seal')h.c._boardPrivateOwner.seal='malformed-old-seal';if(invalid==='active')h.ls.set('ps_active_ws','other-team');if(invalid==='malformed')h.ls.set('ps_ws_switch_guard_v1','{');
 h.c.boardPrivateAuthChanged();assert.ok(h.c._boardPrivateGeneration>generation);await assert.rejects(h.c.psFlushPendingReady(),/초안/);
});
test('account switch clears previous canvas, pages, animation and undo without reading previous account drafts',async()=>{
 const h=harness();h.setServer({raw:payload(31),cupd:3});await h.boot();const old=copy(h.record());h.c.undoStack=[snap(90)];h.switch({uid:'synthetic-user-b',wid:'personal-b',seal:'seal-b'});h.setServer({raw:null,cupd:null});h.c.boardPrivateAuthChanged();assert.equal(h.c.state.players.length,0);assert.equal(h.c.anim.frames.length,0);assert.equal(h.c.pages,null);assert.equal(h.c.undoStack.length,0);await ticks();assert.equal(JSON.parse(h.ls.get('ps_private_board_draft_v1:synthetic-user-a')||h.idb.get('ps_private_board_draft_v1:synthetic-user-a')).raw,old.raw);
});
test('late personal GET cannot replace a gesture made while the request was pending',async()=>{
 const h=harness(),d=deferred(),o=h.owner();h.get(()=>d.promise);const boot=h.c.restoreLiveBoard();await ticks();h.c.state=snap(42);h.c.boardSaveLive();d.resolve({ok:true,uid:o.uid,wid:o.wid,raw:payload(88),cupd:8});assert.equal(await boot,false);assert.equal(h.c.state.players[0].x,42);assert.equal(h.record(),null);assert.equal(h.c._boardManualDirty,true);assert.equal(h.saves.length,0);
});
test('late personal GET from account A cannot install data after account B is selected',async()=>{
 const h=harness(),d=deferred(),o=h.owner();h.get(()=>d.promise);const boot=h.c.restoreLiveBoard();await ticks();h.switch({uid:'synthetic-user-b',wid:'personal-b',seal:'seal-b'});h.c.state=snap(99);d.resolve({ok:true,uid:o.uid,wid:o.wid,raw:payload(77),cupd:1});assert.equal(await boot,false);assert.equal(h.c.state.players[0].x,99);assert.equal(h.writes.length,0);
});
test('A acknowledgement preserves a newer B draft and submits B only against confirmed A',async()=>{
 const h=harness(),d=deferred(),o=h.owner();await h.boot();let n=0;h.save(async(raw,opts)=>{n++;if(n===1)return d.promise;assert.equal(opts.expected_raw,h.saves[0].raw);assert.equal(opts.expected_cupd,4);return {ok:true,uid:o.uid,wid:o.wid,raw,cupd:5};});h.c.state=snap(1);const work=h.c._boardLiveWriteNow(false);await ticks();h.c.state=snap(2);h.c.boardSaveLive();await h.c._boardLiveWriteNow(false,true);assert.equal(JSON.parse(h.record().raw).snap.players[0].x,2);d.resolve({ok:true,uid:o.uid,wid:o.wid,raw:h.saves[0].raw,cupd:4});await work;assert.equal(h.record().pending,false);assert.equal(JSON.parse(h.record().raw).snap.players[0].x,2);assert.equal(h.saves.length,2);
});
test('lost reply keeps the exact A attempt plus newer B draft across reload',async()=>{
 const h=harness(),d=deferred();await h.boot();h.save(()=>d.promise);h.c.state=snap(51);const w=h.c._boardLiveWriteNow(false);await ticks();h.c.state=snap(52);h.c.boardSaveLive();h.c._boardLiveWriteNow(false,true);d.reject(Error('synthetic lost reply'));await w;assert.equal(h.record().pending,true);const attempted=h.saves[0];assert.equal(h.record().attempt.raw,attempted.raw);
 await ticks();const reload=harness({ls:[...h.ls],idb:[...h.idb]});let n=0;const o=reload.owner();reload.save(async(raw,opts)=>{n++;if(n===1){assert.equal(raw,attempted.raw);assert.deepEqual(copy(opts),attempted.opts);}else{assert.equal(JSON.parse(raw).snap.players[0].x,52);assert.equal(opts.expected_raw,attempted.raw);}return {ok:true,uid:o.uid,wid:o.wid,raw,cupd:10+n};});await reload.boot();await ticks();assert.equal(reload.saves.length,2);assert.equal(reload.record().pending,false);
});
test('wrong acknowledgement retains the full immutable attempt and never claims saved',async()=>{
 const h=harness();await h.boot();h.save(async()=>({ok:true,uid:'other',wid:'personal-a',raw:payload(9),cupd:3}));h.c.state=snap(61);assert.equal(await h.c._boardLiveWriteNow(false),false);assert.equal(h.record().pending,true);assert.ok(h.record().attempt);assert.ok(!h.messages.includes('내 보드에 자동 저장됨'));
});
test('account change during save cannot clear a newer account draft or post a saved notification',async()=>{
 const h=harness(),d=deferred(),o=h.owner();await h.boot();h.save(()=>d.promise);h.c.state=snap(70);const w=h.c._boardLiveWriteNow(false);await ticks();const saved=copy(h.record());h.switch({uid:'synthetic-user-b',wid:'personal-b',seal:'seal-b'});d.resolve({ok:true,uid:o.uid,wid:o.wid,raw:h.saves[0].raw,cupd:2});assert.equal(await w,false);assert.equal(JSON.parse(h.ls.get('ps_private_board_draft_v1:synthetic-user-a')||h.idb.get('ps_private_board_draft_v1:synthetic-user-a')).token,saved.token);assert.ok(!h.messages.some(m=>m&&m.type==='boardLiveSaved'));
});
test('server pull events require both the real parent source and matching origin',async()=>{
 const h=harness();await h.boot();let calls=0;h.c.boardApplyServerLive=()=>{calls++;};const f=h.events.message[0];f({source:{},origin:h.c.location.origin,data:{source:'app',type:'boardLivePulled'}});f({source:h.c.parent,origin:'https://other.invalid',data:{source:'app',type:'boardLivePulled'}});assert.equal(calls,0);f({source:h.c.parent,origin:h.c.location.origin,data:{source:'app',type:'boardLivePulled'}});assert.equal(calls,1);
});
test('localStorage quota uses verified full IndexedDB data without discarding animation or pages',async()=>{
 const h=harness({quota:true});await h.boot();h.c.state=snap(80);h.c.anim.frames=[{snap:snap(80)},{snap:snap(81)}];h.c.pages={pages:[{snap:snap(80)},{snap:snap(81)}],idx:1};assert.equal(await h.c._boardLiveWriteNow(false),true);const r=h.record();assert.equal(JSON.parse(r.raw).animFrames.length,2);assert.equal(JSON.parse(r.raw).boardPages.pages.length,2);
});
test('another tab changing the draft prevents a late ACK from overwriting that draft',async()=>{
 const h=harness(),d=deferred(),o=h.owner();await h.boot();h.save(()=>d.promise);h.c.state=snap(90);const w=h.c._boardLiveWriteNow(false);await ticks();const other={...h.record(),raw:payload(99),token:'other-tab',seq:Date.now()+100};h.ls.set(h.key(),JSON.stringify(other));d.resolve({ok:true,uid:o.uid,wid:o.wid,raw:h.saves[0].raw,cupd:8});assert.equal(await w,false);assert.equal(h.record().token,'other-tab');assert.ok([...h.ls.keys(),...h.idb.keys()].some(k=>k.includes(':kept:')));
});

test('the complete board source has no legacy live/recovery/snapshot/stash automatic reads or writes',()=>{
 assert.ok(!/(?:getItem|setItem|removeItem|store\.(?:get|set))\(["']cs_(?:board_live|board_recovery|snap_board|snap_match|board_stash)_v\d+["']/.test(html));
});
test('failure of both local stores never claims the draft was safely stored',async()=>{
 const h=harness({quota:true});await h.boot();h.c.storage.replaceIfValue=async()=>{throw Error('synthetic IDB failure');};h.c.state=snap(105);assert.equal(await h.c._boardLiveWriteNow(false),false);assert.ok(h.messages.includes('기기에 저장하지 못했습니다 — 앱을 닫지 말고 다시 시도해 주세요'));assert.equal(h.saves.length,0);let prevented=false;h.events.beforeunload[0]({preventDefault(){prevented=true;}});assert.equal(prevented,true);
});

test('offline first edit resumes after reload only when the server confirms no personal board exists',async()=>{
 const h=harness();h.get(async()=>{throw Error('synthetic offline');});assert.equal(await h.c.restoreLiveBoard(),false);h.c.state=snap(112);await h.c._boardLiveWriteNow(false);assert.equal(h.record().pending,true);assert.equal(h.record().base,null);await ticks();
 const reload=harness({ls:[...h.ls],idb:[...h.idb]});await reload.boot();await ticks();assert.equal(reload.saves.length,1);assert.equal(JSON.parse(reload.saves[0].raw).snap.players[0].x,112);assert.equal(reload.record().pending,false);assert.equal(reload.saves[0].opts.expected_raw,null);
 const existing=harness({ls:[...h.ls],idb:[...h.idb]});existing.setServer({raw:payload(200),cupd:10});await existing.boot();await ticks();assert.equal(existing.c.state.players[0].x,112);assert.equal(existing.record().pending,true);assert.equal(existing.record().base,null);assert.equal(existing.saves.length,0);
});
test('a parent pull notice bearing another personal owner is ignored',async()=>{
 const h=harness();await h.boot();let calls=0;h.c.boardApplyServerLive=()=>{calls++;};const f=h.events.message[0],base={source:h.c.parent,origin:h.c.location.origin};
 for(const owner of [{uid:'someone-else',wid:'personal-a'},{uid:'synthetic-user-a',wid:'another-team'}])f({...base,data:{source:'app',type:'boardLivePulled',...owner}});
 assert.equal(calls,0);f({...base,data:{source:'app',type:'boardLivePulled',uid:'synthetic-user-a',wid:'personal-a'}});assert.equal(calls,1);
});

test('online retry confirms an empty server without reloading or replacing the visible draft',async()=>{
 const h=harness();h.get(async()=>{throw Error('synthetic offline');});assert.equal(await h.c.restoreLiveBoard(),false);h.c.state=snap(120);await h.c._boardLiveWriteNow(false);assert.equal(h.record().base,null);h.get(null);const before=copy(h.c.state);assert.equal(await h.c.boardPrivateRetry(),true);assert.deepEqual(copy(h.c.state),before);assert.equal(h.record().pending,false);assert.equal(h.saves.length,1);
});

test('IDB-only drafts from another tab are not adopted as a new write baseline',async()=>{
 const h=harness({quota:true});await h.boot();const other={v:1,uid:'synthetic-user-a',wid:'personal-a',raw:payload(130),base:{raw:null,cupd:null},pending:true,attempt:null,token:'other-durable-tab',seq:1};h.idb.set(h.key(),JSON.stringify(other));h.c.state=snap(140);assert.equal(await h.c._boardLiveWriteNow(false),false);assert.deepEqual(JSON.parse(h.idb.get(h.key())),other);assert.equal(h.saves.length,0);assert.ok(h.messages.includes('기기에 저장하지 못했습니다 — 앱을 닫지 말고 다시 시도해 주세요'));
});

function otherDraft(h){const r={...h.record(),raw:payload(999),token:'other-tab',seq:Date.now()+100};h.ls.set(h.key(),JSON.stringify(r));return JSON.stringify(r);}
const keptKeys=h=>[...new Set([...h.ls.keys(),...h.idb.keys()].filter(k=>k.includes(':kept:')))];
test('100 conflict retries keep one complete recovery draft without changing the other tab',async()=>{
 const h=harness();await h.boot();h.c.state=snap(10);await h.c._boardLiveWriteNow(false);const other=otherDraft(h),saved=h.saves.length;
 for(let i=0;i<100;i++){h.c.state=snap(150+i);assert.equal(await h.c._boardLiveWriteNow(false),false);}
 assert.equal(h.ls.get(h.key()),other);assert.equal(h.saves.length,saved);assert.equal(keptKeys(h).length,1);
 const key=keptKeys(h)[0],r=JSON.parse(h.idb.get(key));assert.equal(JSON.parse(r.raw).snap.players[0].x,249);assert.equal(h.ls.has(key),false);assert.notEqual(h.c._boardPrivateDurableToken,r.token,'a recovery branch is not the reload-selected head receipt');
});
test('quota while protecting a conflict retains all pages in IndexedDB',async()=>{
 const opts={};const h=harness(opts);await h.boot();h.c.state=snap(10);await h.c._boardLiveWriteNow(false);const other=otherDraft(h);opts.quota=true;
 h.c.state=snap(42);h.c.pages={pages:[{snap:snap(42)},{snap:snap(43)}],idx:1};await h.c._boardLiveWriteNow(false);
 const r=JSON.parse(h.idb.get(keptKeys(h)[0]));assert.equal(JSON.parse(r.raw).boardPages.pages.length,2);assert.equal(h.ls.get(h.key()),other);assert.notEqual(h.c._boardPrivateDurableToken,r.token,'recovery does not acknowledge the ordinary head');
});
test('recovery storage failure retains one local draft and never claims cloud saved',async()=>{
 const h=harness();await h.boot();h.c.state=snap(10);await h.c._boardLiveWriteNow(false);otherDraft(h);h.c.storage.replaceIfValue=async()=>{throw Error('disk full');};
 for(let i=0;i<5;i++){h.c.state=snap(70+i);await h.c._boardLiveWriteNow(false);}
 assert.equal(keptKeys(h).length,1);assert.equal(JSON.parse(JSON.parse(h.ls.get(keptKeys(h)[0])).raw).snap.players[0].x,74);assert.equal(h.c._bliveDirty,true);
});
test('old recovery copies are untouched when a new editor creates its own branch',async()=>{
 const oldKey='ps_private_board_draft_v1:synthetic-user-a:kept:old';const h=harness({ls:[[oldKey,'original recovery']]});await h.boot();h.c.state=snap(10);await h.c._boardLiveWriteNow(false);otherDraft(h);h.c.state=snap(60);await h.c._boardLiveWriteNow(false);assert.equal(h.ls.get(oldKey),'original recovery');assert.equal(keptKeys(h).length,2);
});
test('account switch during conflict preservation cannot write an old draft or report it durable',async()=>{
 const h=harness();await h.boot();h.c.state=snap(10);await h.c._boardLiveWriteNow(false);otherDraft(h);const d=deferred(),original=h.c.storage.get;h.c.storage.get=k=>k.includes(':kept:')?d.promise:original(k);
 h.c.state=snap(60);const work=h.c._boardLiveWriteNow(false);await ticks();const token=h.c._boardPrivateRecord.token;h.switch({uid:'synthetic-user-b',wid:'personal-b'});d.resolve(null);await work;assert.notEqual(h.c._boardPrivateDurableToken,token);assert.ok([...h.idb.keys()].every(k=>!k.includes(':kept:')));
});

test('failed first server read preserves the visible canvas, animation, pages and undo',async()=>{
 const h=harness();h.c.state=snap(33);h.c.anim.frames=[{snap:snap(34)}];h.c.pages={pages:[{snap:snap(35)}],idx:0};h.c.undoStack=[snap(36)];h.get(async()=>{throw Error('offline');});
 assert.equal(await h.c.restoreLiveBoard(),false);assert.equal(h.c.state.players[0].x,33);assert.equal(h.c.anim.frames[0].snap.players[0].x,34);assert.equal(h.c.pages.pages[0].snap.players[0].x,35);assert.equal(h.c.undoStack[0].players[0].x,36);assert.equal(h.saves.length,0);assert.equal(h.ls.has(h.key()),false);
 h.c.boardSaveLive();await ticks();assert.equal(h.record(),null);assert.equal(h.saves.length,0);
});
test('a no-op local cleanup does not strand the verified recovery branch',async()=>{
 const h=harness();await h.boot();h.c.state=snap(10);await h.c._boardLiveWriteNow(false);otherDraft(h);h.c.localStorage.removeItem=()=>{};
 for(let i=0;i<3;i++){h.c.state=snap(80+i);await h.c._boardLiveWriteNow(false);}
 assert.equal(keptKeys(h).length,1);assert.equal(JSON.parse(JSON.parse(h.idb.get(keptKeys(h)[0])).raw).snap.players[0].x,82);
});

test('unsaved movement cannot overwrite the last explicit save on server refresh',async()=>{
 const h=harness();await h.boot();h.c.state=snap(10);h.c.boardSaveLive();assert.equal(await h.c.boardSaveExplicit(),true);
 const saved=copy(h.record());h.c.state=snap(20);h.c.boardSaveLive();await h.c.boardApplyServerLive();
 assert.deepEqual(h.record(),saved);assert.equal(h.c.state.players[0].x,20);assert.equal(h.c._boardManualDirty,true);assert.equal(h.saves.length,1);
});
test('failed explicit capture retains unsaved status and the previous saved version',async()=>{
 const h=harness();await h.boot();h.c.state=snap(10);await h.c.boardSaveExplicit();const saved=copy(h.record());
 h.c.state=snap(20);h.c.boardSaveLive();h.c.captureSnap=()=>{throw Error('capture failed');};
 assert.equal(await h.c.boardSaveExplicit(),false);assert.equal(h.c._boardManualDirty,true);assert.deepEqual(h.record(),saved);
});
test('movement during explicit saving stays unsaved after the old acknowledgement',async()=>{
 const h=harness(),d=deferred(),o=h.owner();await h.boot();h.c.state=snap(10);h.c.boardSaveLive();h.save(()=>d.promise);
 const work=h.c.boardSaveExplicit();await ticks();h.c.state=snap(20);h.c.boardSaveLive();
 d.resolve({ok:true,uid:o.uid,wid:o.wid,raw:h.saves[0].raw,cupd:1});await work;
 assert.equal(h.c._boardManualDirty,true);assert.equal(h.c.state.players[0].x,20);assert.equal(JSON.parse(h.record().raw).snap.players[0].x,10);assert.equal(h.saves.length,1);
});
test('the board snapshot confirms only an exact durable server receipt and never a later edit or owner',async()=>{
 const h=harness();h.c.PSBoardDraft.install(h.c);await h.boot();h.c.state=snap(20);h.c._boardUserTouched=true;h.c.boardSaveLive();await h.c.boardSaveExplicit();
 assert.equal(h.c.__psBoardDraft.snapshot().privateServerConfirmed,true);assert.equal(h.c.__psBoardPrivateReceipt.source,'ack');
 h.c.state=snap(21);h.c._boardUserTouched=true;h.c.boardSaveLive();assert.equal(h.c.__psBoardDraft.snapshot().privateServerConfirmed,false);
 h.switch({uid:'synthetic-user-b',wid:'personal-b'});const next=h.c.__psBoardDraft.snapshot();assert.equal(next.unknown,true);assert.equal(next.privateServerConfirmed,false);assert.equal(next.privateLocalDurable,false);
});
test('a loaded GET receipt confirms its exact durable source, but a modified base or local status cannot',async()=>{
 const h=harness();h.c.PSBoardDraft.install(h.c);h.setServer({raw:payload(25),cupd:7});await h.boot();assert.equal(h.c.__psBoardDraft.snapshot().privateServerConfirmed,true);assert.equal(h.c.__psBoardPrivateReceipt.source,'get');
 h.c._boardPrivateRecord.base.cupd=8;assert.equal(h.c.__psBoardDraft.snapshot().privateServerConfirmed,false);h.c.__psBoardPrivateReceipt=null;assert.equal(h.c.__psBoardDraft.snapshot().privateServerConfirmed,false);
});

function holdPrivateHead(h,phase){
 const d=deferred();let held=false;const stop=async()=>{if(held)return;held=true;await d.promise;};
 if(phase==='read'){const get=h.c.storage.get;h.c.storage.get=async k=>{const value=await get(k);if(k===h.key())await stop();return value;};}
 if(phase==='cas'){const cas=h.c.storage.replaceIfValue;h.c.storage.replaceIfValue=async(k,b,v,current)=>{if(k===h.key())await stop();return cas(k,b,v,current);};}
 if(phase==='verify'){const verify=h.c.PSStorage.sharedVerified;h.c.PSStorage.sharedVerified=async(k,raw)=>{await verify(k,raw);if(k===h.key())await stop();};}
 return {get held(){return held;},release:()=>d.resolve()};
}
async function boundedPrivate(work){
 let timeout;try{return await Promise.race([work,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('private board save did not settle')),1000);})]);}finally{clearTimeout(timeout);}
}
for(const phase of ['read','cas','verify'])test('same-owner automatic retry joins the explicit '+phase+' head receipt without self-conflict',async()=>{
 const h=harness();await h.boot();h.c.state=snap(345);h.c._boardUserTouched=true;h.c.boardSaveLive();const gate=holdPrivateHead(h,phase),saving=h.c.boardSaveExplicit({quiet:true});await ticks();assert.equal(gate.held,true);
 const retry=h.c.boardApplyServerLive(),join=h.c.boardPrivateSend(h.owner());await ticks();gate.release();const result=await boundedPrivate(Promise.all([saving,retry,join]));await ticks();
 assert.deepEqual(result,[true,true,true]);assert.equal(h.saves.length,1,'one explicit intent has one actual server submission');assert.equal(h.c._boardPrivateRecord.pending,false);assert.equal(h.c._boardPrivateRecord.token,h.c._boardPrivateDurableToken);assert.equal(h.idb.get(h.key()),JSON.stringify(h.c._boardPrivateRecord));assert.equal(h.server().raw,h.c._boardPrivateRecord.raw);assert.equal(JSON.parse(h.server().raw).snap.players[0].x,345);assert.equal(h.c._boardManualDirty,false);assert.ok(!h.messages.some(m=>typeof m==='string'&&m.includes('기기에 저장하지 못했습니다')));
});
for(const medium of ['ls','idb'])test('automatic retry cannot turn a foreign '+medium+' head into overwrite permission',async()=>{
 const h=harness();await h.boot();h.c.state=snap(345);h.c._boardUserTouched=true;h.c.boardSaveLive();const key=h.key(),gate=holdPrivateHead(h,'verify'),saving=h.c.boardSaveExplicit({quiet:true});await ticks();assert.equal(gate.held,true);
 const retry=h.c.boardApplyServerLive();await ticks();const foreign=JSON.stringify({...h.c._boardPrivateRecord,raw:payload(999),token:'synthetic-other-window',seq:Date.now()+100});h[medium].set(key,foreign);gate.release();const result=await boundedPrivate(Promise.all([saving,retry]));
 assert.deepEqual(result,[false,false]);assert.equal(h[medium].get(key),foreign);assert.equal(h.saves.length,0);assert.equal(h.c._boardPrivateRecord.pending,true);assert.notEqual(h.c._boardPrivateDurableToken,h.c._boardPrivateRecord.token);assert.equal(h.c.state.players[0].x,345);assert.ok(!h.messages.some(m=>m&&m.type==='boardLiveSaved'));
});
test('an owner change while an explicit receipt and retry wait cannot send or acknowledge the old board',async()=>{
 const h=harness();await h.boot();h.c.state=snap(345);h.c.boardSaveLive();const key=h.key(),gate=holdPrivateHead(h,'verify'),saving=h.c.boardSaveExplicit({quiet:true});await ticks();assert.equal(gate.held,true);const exactOld=h.idb.get(key),retry=h.c.boardApplyServerLive();await ticks();h.switch({uid:'synthetic-user-b',wid:'personal-b',seal:'seal-b'});gate.release();const result=await boundedPrivate(Promise.all([saving,retry]));
 assert.deepEqual(result,[false,false]);assert.equal(h.saves.length,0);assert.equal(h.idb.get(key),exactOld);assert.equal(h.idb.has(h.key()),false);assert.equal(h.ls.has(h.key()),false);assert.ok(!h.messages.some(m=>m&&m.type==='boardLiveSaved'));
});
test('both-store failure during an explicit receipt and retry remains pending without a server acknowledgement',async()=>{
 const h=harness({quota:true});await h.boot();h.c.state=snap(345);h.c.boardSaveLive();const d=deferred(),original=h.c.storage.get;let held=false;
 h.c.storage.get=async k=>{if(k!==h.key())return original(k);if(!held){held=true;await d.promise;}throw Error('synthetic actual IDB failure');};
 const saving=h.c.boardSaveExplicit({quiet:true});await ticks();assert.equal(held,true);const retry=h.c.boardApplyServerLive();await ticks();d.resolve();const result=await boundedPrivate(Promise.all([saving,retry]));
 assert.deepEqual(result,[false,false]);assert.equal(h.saves.length,0);assert.equal(h.c._boardPrivateRecord.pending,true);assert.notEqual(h.c._boardPrivateDurableToken,h.c._boardPrivateRecord.token);assert.equal(h.c._boardManualDirty,true);assert.ok(!h.messages.some(m=>m&&m.type==='boardLiveSaved'));assert.equal(h.idb.has(h.key()),false);assert.equal(h.ls.has(h.key()),false);
});

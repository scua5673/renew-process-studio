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
async function ticks(){for(let i=0;i<15;i++)await Promise.resolve();}
function harness(options={}){
 let owner={uid:'synthetic-user-a',wid:'personal-a',active:'team-a',seal:'seal-a',epoch:0,switchSeal:'',switchEpoch:'1'},server={raw:null,cupd:null},getter=null,saver=null;
 const ls=new Map(options.ls||[]),idb=new Map(options.idb||[]),reads=[],writes=[],saves=[],messages=[],events={},timers=[];
 const nodes={animBar:{classList:{contains:()=>false}},hint:{style:{}}};
 const c={console,JSON,Math,Date,Object,Array,Number,String,Promise,Error,URLSearchParams,encodeURIComponent,location:{origin:'https://private-board.invalid',search:''},
  PRIVATE_BOARD_PREFIX:'ps_private_board_draft_v1:',EDRAFT_KEY:'cs_editor_draft_v1',_bliveSaveSeq:0,_bliveDirty:false,_bliveApplying:false,_bliveT:null,
  _vaultBoardContext:null,_vaultBoardRestoring:false,animPlaying:false,matchActive:false,anim:{slides:[],frames:[]},animActive:0,
  state:snap(0),undoStack:[],redoStack:[],autoOrient:true,
  document:{body:{classList:{contains:()=>false}},addEventListener(){}},
  setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},
  localStorage:{getItem(k){reads.push(['ls',k]);return ls.get(k)??null;},setItem(k,v){if(options.quota)throw Error('synthetic quota');writes.push(['ls',k,String(v)]);ls.set(k,String(v));},removeItem(k){assert.ok(k.includes(':kept:'),'only a verified recovery copy may be removed');ls.delete(k);}},
  storage:{async get(k){reads.push(['idb',k]);return idb.has(k)?{value:idb.get(k)}:null;},async set(k,v,current){if(current)current();writes.push(['idb',k,v]);idb.set(k,v);return true;},async replaceIfValue(k,b,v,current){if(current)current();if((idb.get(k)??null)!==b)return false;idb.set(k,v);return true;}},
  store:{async get(){return null;}},$:id=>nodes[id]||null,toast:m=>messages.push(m),captureSnap(){return copy(c.state);},loadSnap(s){c.state=copy(s);},
  dc:copy,renderTokens(){},renderDrawings(){},updateDelUI(){},restoreAnimBeforeCapture(){},renderAnimFrames(){},
  setView(v){c.__csView=v;},addEventListener(type,fn){(events[type]||(events[type]=[])).push(fn);},
 };
 c.window=c;c.__csView='board';c.__animFrames=()=>copy(c.anim.frames);c.__animReset=()=>{c.anim.frames=[];c.animActive=-1;};c.__animRestore=(frames,i)=>{c.anim.frames=copy(frames);c.animActive=i;};
 c.__psPages={liveVal:()=>c.pages||null,restoreContext(p){c.pages=copy(p);}};
 c.parent={postMessage:m=>messages.push(m),PSSync:{boardLive:{version:2,scope:'personal',owner:()=>copy(owner),async get(){if(getter)return getter();return {ok:true,uid:owner.uid,wid:owner.wid,...server};},async save(raw,opts){saves.push({raw,opts:copy(opts)});if(saver)return saver(raw,opts);assert.deepEqual(copy(opts),{uid:owner.uid,wid:owner.wid,expected_raw:server.raw,expected_cupd:server.cupd});server={raw,cupd:(server.cupd||0)+1};return {ok:true,uid:owner.uid,wid:owner.wid,...server};}}}};
 vm.createContext(c);vm.runInContext(helpers+writer+restore,c);
 return {c,ls,idb,reads,writes,saves,messages,events,timers,key:()=>c.PRIVATE_BOARD_PREFIX+encodeURIComponent(owner.uid),owner:()=>copy(owner),server:()=>copy(server),setServer(r){server=copy(r);},get(fn){getter=fn;},save(fn){saver=fn;},switch(o){owner={...owner,...o};},async boot(){assert.equal(await c.restoreLiveBoard(),true);},record(){return JSON.parse(ls.get(this.key())||idb.get(this.key())||'null');}};
}

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
test('account switch clears previous canvas, pages, animation and undo without reading previous account drafts',async()=>{
 const h=harness();h.setServer({raw:payload(31),cupd:3});await h.boot();const old=copy(h.record());h.c.undoStack=[snap(90)];h.switch({uid:'synthetic-user-b',wid:'personal-b',seal:'seal-b'});h.setServer({raw:null,cupd:null});h.c.boardPrivateAuthChanged();assert.equal(h.c.state.players.length,0);assert.equal(h.c.anim.frames.length,0);assert.equal(h.c.pages,null);assert.equal(h.c.undoStack.length,0);await ticks();assert.equal(JSON.parse(h.ls.get('ps_private_board_draft_v1:synthetic-user-a')).raw,old.raw);
});
test('late personal GET cannot replace a gesture made while the request was pending',async()=>{
 const h=harness(),d=deferred(),o=h.owner();h.get(()=>d.promise);const boot=h.c.restoreLiveBoard();await ticks();h.c.state=snap(42);h.c.boardSaveLive();d.resolve({ok:true,uid:o.uid,wid:o.wid,raw:payload(88),cupd:8});assert.equal(await boot,false);assert.equal(h.c.state.players[0].x,42);assert.equal(h.record(),null);assert.equal(h.c._boardManualDirty,true);assert.equal(h.saves.length,0);
});
test('late personal GET from account A cannot install data after account B is selected',async()=>{
 const h=harness(),d=deferred(),o=h.owner();h.get(()=>d.promise);const boot=h.c.restoreLiveBoard();await ticks();h.switch({uid:'synthetic-user-b',wid:'personal-b',seal:'seal-b'});h.c.state=snap(99);d.resolve({ok:true,uid:o.uid,wid:o.wid,raw:payload(77),cupd:1});assert.equal(await boot,false);assert.equal(h.c.state.players[0].x,99);assert.equal(h.writes.length,0);
});
test('A acknowledgement preserves a newer B draft and submits B only against confirmed A',async()=>{
 const h=harness(),d=deferred(),o=h.owner();await h.boot();let n=0;h.save(async(raw,opts)=>{n++;if(n===1)return d.promise;assert.equal(opts.expected_raw,h.saves[0].raw);assert.equal(opts.expected_cupd,4);return {ok:true,uid:o.uid,wid:o.wid,raw,cupd:5};});h.c.state=snap(1);const work=h.c._boardLiveWriteNow(false);await ticks();h.c.state=snap(2);h.c.boardSaveLive();h.c._boardLiveWriteNow(false,true);assert.equal(JSON.parse(h.record().raw).snap.players[0].x,2);d.resolve({ok:true,uid:o.uid,wid:o.wid,raw:h.saves[0].raw,cupd:4});await work;assert.equal(h.record().pending,false);assert.equal(JSON.parse(h.record().raw).snap.players[0].x,2);assert.equal(h.saves.length,2);
});
test('lost reply keeps the exact A attempt plus newer B draft across reload',async()=>{
 const h=harness(),d=deferred();await h.boot();h.save(()=>d.promise);h.c.state=snap(51);const w=h.c._boardLiveWriteNow(false);await ticks();h.c.state=snap(52);h.c.boardSaveLive();h.c._boardLiveWriteNow(false,true);d.reject(Error('synthetic lost reply'));await w;assert.equal(h.record().pending,true);const attempted=h.saves[0];assert.equal(h.record().attempt.raw,attempted.raw);
 await ticks();const reload=harness({ls:[...h.ls],idb:[...h.idb]});let n=0;const o=reload.owner();reload.save(async(raw,opts)=>{n++;if(n===1){assert.equal(raw,attempted.raw);assert.deepEqual(copy(opts),attempted.opts);}else{assert.equal(JSON.parse(raw).snap.players[0].x,52);assert.equal(opts.expected_raw,attempted.raw);}return {ok:true,uid:o.uid,wid:o.wid,raw,cupd:10+n};});await reload.boot();await ticks();assert.equal(reload.saves.length,2);assert.equal(reload.record().pending,false);
});
test('wrong acknowledgement retains the full immutable attempt and never claims saved',async()=>{
 const h=harness();await h.boot();h.save(async()=>({ok:true,uid:'other',wid:'personal-a',raw:payload(9),cupd:3}));h.c.state=snap(61);assert.equal(await h.c._boardLiveWriteNow(false),false);assert.equal(h.record().pending,true);assert.ok(h.record().attempt);assert.ok(!h.messages.includes('내 보드에 자동 저장됨'));
});
test('account change during save cannot clear a newer account draft or post a saved notification',async()=>{
 const h=harness(),d=deferred(),o=h.owner();await h.boot();h.save(()=>d.promise);h.c.state=snap(70);const w=h.c._boardLiveWriteNow(false);await ticks();const saved=copy(h.record());h.switch({uid:'synthetic-user-b',wid:'personal-b',seal:'seal-b'});d.resolve({ok:true,uid:o.uid,wid:o.wid,raw:h.saves[0].raw,cupd:2});assert.equal(await w,false);assert.equal(JSON.parse(h.ls.get('ps_private_board_draft_v1:synthetic-user-a')).token,saved.token);assert.ok(!h.messages.some(m=>m&&m.type==='boardLiveSaved'));
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
 const key=keptKeys(h)[0],r=JSON.parse(h.idb.get(key));assert.equal(JSON.parse(r.raw).snap.players[0].x,249);assert.equal(h.ls.has(key),false);assert.equal(h.c._boardPrivateDurableToken,r.token);
});
test('quota while protecting a conflict retains all pages in IndexedDB',async()=>{
 const opts={};const h=harness(opts);await h.boot();h.c.state=snap(10);await h.c._boardLiveWriteNow(false);const other=otherDraft(h);opts.quota=true;
 h.c.state=snap(42);h.c.pages={pages:[{snap:snap(42)},{snap:snap(43)}],idx:1};await h.c._boardLiveWriteNow(false);
 const r=JSON.parse(h.idb.get(keptKeys(h)[0]));assert.equal(JSON.parse(r.raw).boardPages.pages.length,2);assert.equal(h.ls.get(h.key()),other);assert.equal(h.c._boardPrivateDurableToken,r.token);
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

'use strict';
/* 3.038 — 저장 안 한 작전판의 기기 초안(피드백 UX-1 «저장 안 한 작전판이 새로고침 한 번에 사라지는데, 그동안 «저장됨»이 떠 있다»).
   «보드 저장» 전의 화면은 이 기기에만 초안으로 남고, 다시 열면 «되살리기»를 권하며, 셸은 «보드 · 저장 전»을 띄운다.
   개인 보드 기록(ps_private_board_draft_v1:<uid>)과 서버는 건드리지 않는다 — tests/private-board-draft 가 지키는 규칙 그대로. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8'),app=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
function part(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j);}
const helpers=part('var _boardPrivateOwner=null,','/* 보관함 작전판은 같은 캔버스를 빌려 쓴다.');
const writer=part('function _boardLiveWriteNow(recovery){','function restoreAnimBeforeCapture(){');
const flush=part('function boardFlushLive(){','async function restoreLiveBoard(){');   /* pagehide·visibilitychange 가 부르는 flush — writer 와 restore 사이에 있다 */
const restore=part('async function restoreLiveBoard(){','/* 배치 저장·배치 라이브러리 제거');
const copy=x=>x==null?x:JSON.parse(JSON.stringify(x));
const snap=x=>({players:[{id:1,x,y:50}],equipment:[],drawings:[],ball:null,pitchN:1,orientation:'h'});
const payload=(x,savedAt)=>JSON.stringify({snap:snap(x),view:'board',matchActive:false,meetSlides:[],animFrames:null,animActive:0,boardPages:null,boardLink:null,_savedAt:savedAt});
async function ticks(){for(let i=0;i<20;i++)await Promise.resolve();}
function harness(options={}){
 let owner={uid:options.uid||'synthetic-user-a',wid:options.wid||'personal-a',active:'team-a',seal:'seal-a',epoch:0,switchSeal:'',switchEpoch:'1'};
 let server=options.serverRaw?{raw:options.serverRaw,cupd:3}:{raw:null,cupd:null};
 const ls=new Map(options.ls||[]),idb=new Map(options.idb||[]),messages=[],timers=[],removed=[];
 const c={PSBoardDraft:require('../studio/board-draft.js'),console,JSON,Math,Date,Object,Array,Number,String,Promise,Error,URLSearchParams,encodeURIComponent,location:{origin:'https://unsaved-draft.invalid',search:''},
  PRIVATE_BOARD_PREFIX:'ps_private_board_draft_v1:',EDRAFT_KEY:'cs_editor_draft_v1',_bliveSaveSeq:0,_bliveDirty:false,_bliveApplying:false,_bliveT:null,
  _vaultBoardContext:null,_vaultBoardRestoring:false,animPlaying:false,matchActive:false,anim:{slides:[],frames:[]},animActive:0,
  state:snap(0),undoStack:[],redoStack:[],autoOrient:true,
  document:{body:{classList:{contains:()=>false}},addEventListener(){}},
  setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},
  localStorage:{getItem(k){return ls.get(k)??null;},setItem(k,v){if(options.quota)throw Error('synthetic quota');ls.set(k,String(v));},removeItem(k){removed.push(k);ls.delete(k);}},
  storage:{async get(k){return idb.has(k)?{value:idb.get(k)}:null;},async set(k,v,current){if(current)current();idb.set(k,v);return true;},async replaceIfValue(k,b,v,current){if(current)current();if((idb.get(k)??null)!==b)return false;idb.set(k,v);return true;},async del(k){removed.push('idb:'+k);idb.delete(k);},async delIfValue(k,raw,current){current();if(idb.get(k)!==raw)return false;removed.push('idb:'+k);idb.delete(k);return true;}},
  store:{async get(){return null;}},toast:m=>messages.push(m),captureSnap(){return copy(c.state);},loadSnap(s){c.state=copy(s);},
  dc:copy,renderTokens(){},renderDrawings(){},updateDelUI(){},restoreAnimBeforeCapture(){},renderAnimFrames(){},kitPropagateIfChanged(){},
  setView(v){c.__csView=v;},addEventListener(){},
 };
 c.PSStorage={sharedVerified:async(k,raw)=>{assert.equal(idb.get(k),raw);},sharedReady:async()=>true,localRecovered:async(k,raw,current)=>{assert.equal(current(),true);assert.equal(ls.get(k),raw);}};
 c.window=c;c.__csView='board';c.__animFrames=()=>copy(c.anim.frames);c.__animReset=()=>{c.anim.frames=[];c.animActive=-1;};c.__animRestore=(frames,i)=>{c.anim.frames=copy(frames);c.animActive=i;};
 c.__psPages={liveVal:()=>c.pages||null,restoreContext(p){c.pages=copy(p);}};
 c.parent={postMessage:m=>messages.push(m),PSSync:{boardLive:{version:2,scope:'personal',owner:()=>copy(owner),async get(){return {ok:true,uid:owner.uid,wid:owner.wid,...server};},async save(raw){server={raw,cupd:(server.cupd||0)+1};return {ok:true,uid:owner.uid,wid:owner.wid,...server};}}}};
 vm.createContext(c);vm.runInContext(helpers+writer+flush+restore,c);c.PSBoardDraft.install(c);
 const key=()=>c.PRIVATE_BOARD_PREFIX+encodeURIComponent(owner.uid);
 return {c,ls,idb,messages,timers,removed,key,draftKey:()=>key()+':unsaved',
  async boot(){assert.equal(await c.restoreLiveBoard(),true);await ticks();},
  edit(x){c.state=snap(x);c._boardUserTouched=true;c.boardSaveLive();},
  async fire(){timers.splice(0).forEach(t=>t.fn());await c.__psBoardDraft.ready();await ticks();},
  draft(){const raw=ls.get(this.draftKey())??idb.get(this.draftKey())??null;return raw?JSON.parse(raw):null;},
  record(){return JSON.parse(ls.get(key())||idb.get(key())||'null');}};
}

test('an unsaved edit becomes a device draft; reopening offers it; restoring marks the board unsaved; saving clears it',async()=>{
 const h=harness();await h.boot();
 h.edit(5);assert.equal(h.draft(),null,'nothing before the debounce');await h.fire();
 const d=h.draft();assert.ok(d&&d.v===1&&d.uid==='synthetic-user-a'&&JSON.parse(d.raw).snap.players[0].x===5,'the draft holds the unsaved board');
 assert.equal(h.record(),null,'the private board record is untouched (no automatic save)');
 const r=harness({ls:[...h.ls],idb:[...h.idb]});await r.boot();
 assert.equal(r.c.state.players.length,0,'the saved (empty) board is shown first');
 assert.ok(r.c.__boardDraftPending&&r.c.__boardDraftPending.at===d.at,'the draft is offered');
 assert.equal(r.c.boardManualChanged(),false,'offering alone does not mark the board changed');
 assert.equal(r.c.__boardDraftRestore(),true);
 assert.equal(r.c.state.players[0].x,5);assert.equal(r.c.boardManualChanged(),true,'restored work counts as unsaved');
 assert.ok(r.messages.some(m=>m&&m.type==='boardDirty'&&m.changed===true),'the shell is told about the unsaved board');
 assert.equal(r.c.__boardDraftPending,null);
 assert.equal(await r.c.boardSaveExplicit(),true);
 assert.equal(r.draft(),null,'saving clears the draft');assert.ok(r.removed.includes(r.draftKey())||r.removed.includes('idb:'+r.draftKey()));assert.equal(r.record().pending,false);
 assert.ok(r.messages.some(m=>m&&m.type==='boardDirty'&&m.changed===false),'and the shell is told it is saved');
});
test('a draft older than the saved board, or identical to it, is dropped without an offer',async()=>{
 const now=Date.now();
 const old=harness({serverRaw:payload(12,now),ls:[['ps_private_board_draft_v1:synthetic-user-a:unsaved',JSON.stringify({v:1,uid:'synthetic-user-a',wid:'personal-a',raw:payload(3,now-9000),at:now-5000})]]});
 await old.boot();assert.equal(old.c.__boardDraftPending,null);assert.equal(old.draft(),null,'stale draft removed');assert.equal(old.c.state.players[0].x,12);
 const same=harness({serverRaw:payload(12,now-5000),ls:[['ps_private_board_draft_v1:synthetic-user-a:unsaved',JSON.stringify({v:1,uid:'synthetic-user-a',wid:'personal-a',raw:payload(12,now-5000),at:now})]]});
 await same.boot();assert.equal(same.c.__boardDraftPending,null);assert.equal(same.draft(),null,'identical draft removed');
 const newer=harness({serverRaw:payload(12,now-5000),ls:[['ps_private_board_draft_v1:synthetic-user-a:unsaved',JSON.stringify({v:1,uid:'synthetic-user-a',wid:'personal-a',raw:payload(40,now-1000),at:now})]]});
 await newer.boot();assert.ok(newer.c.__boardDraftPending,'a newer, different draft is offered');assert.equal(newer.c.state.players[0].x,12,'but the saved board stays on screen until «되살리기»');
});
test('drafts belong to one account: another account never sees or removes them',async()=>{
 const a=harness();await a.boot();a.edit(7);await a.fire();assert.ok(a.draft());
 const b=harness({uid:'synthetic-user-b',wid:'personal-b',ls:[...a.ls],idb:[...a.idb]});await b.boot();
 assert.equal(b.c.__boardDraftPending,null);assert.equal(b.ls.get(a.draftKey()),a.ls.get(a.draftKey()),'A draft untouched');assert.deepEqual(b.removed,[]);
});
test('hiding the tab or closing writes the draft at once, without touching the private record',async()=>{
 const h=harness();await h.boot();h.edit(7);assert.equal(h.draft(),null);
 await h.c.boardFlushLive();
 assert.equal(JSON.parse(h.draft().raw).snap.players[0].x,7);assert.equal(h.record(),null);
});
test('a render that the coach did not touch leaves no draft, and a full localStorage falls back to IndexedDB',async()=>{
 const h=harness();await h.boot();h.c.state=snap(9);h.c.boardSaveLive();await h.fire();assert.equal(h.draft(),null,'dirty without a user gesture is not a draft');
 const q=harness({quota:true});await q.boot();q.edit(11);await q.fire();await ticks();
 assert.ok(q.idb.has(q.draftKey())&&!q.ls.has(q.draftKey()),'IndexedDB copy');
 const r=harness({ls:[...q.ls],idb:[...q.idb]});await r.boot();assert.ok(r.c.__boardDraftPending,'offered from IndexedDB');
});
test('the save strip and the shell say what to do instead of «저장됨» over unsaved work',()=>{
 assert.match(html,/chg\?"저장 안 한 변경 있음"/,'strip wording (CP-6)');assert.doesNotMatch(html,/"변경됨 · 저장 안 함"/);
 assert.match(html,/class="sb-vault" title="보관함에 항목으로 저장">보관함 저장<\/button>/,'phone strip names the action like the iPad button (CP-14)');
 assert.match(app,/d\.type==='boardDirty'\)\{ var _bd=!!d\.changed;/,'shell receives boardDirty');
 assert.match(app,/if\(!localSaveStatus&&window\.__psBoardDirty&&scope&&out\.kind!=='bad'&&out\.kind!=='busy'&&out\.kind!=='held'\)return \{kind:'pending',text:'보드 · 저장 전'/,'legacy shell fallback still marks the board unsaved');
 assert.match(app,/PSAutosaveStatus\.combine\(out,localSaveStatus&&localSaveStatus\.read\(\)\)/,'the current observer combines exact child durability first');
});

/* ── 3.038 코드 리뷰에서 확인된 경로 ── */
const now=Date.now();
const newerDraft=(x,at)=>[['ps_private_board_draft_v1:synthetic-user-a:unsaved',JSON.stringify({v:1,uid:'synthetic-user-a',wid:'personal-a',raw:payload(x,now-1000),at:at||now})]];
test('the draft is never restored onto a borrowed canvas (vault edit, saving) and stays stored until the working board is back',async()=>{
 const h=harness({serverRaw:payload(12,now-5000),ls:newerDraft(40)});await h.boot();assert.ok(h.c.__boardDraftPending);
 h.c._vaultBoardContext={id:'vault-item'};
 assert.equal(h.c.__boardDraftRestore(),false);assert.equal(h.c.state.players[0].x,12,'vault canvas untouched');assert.equal(h.c.boardManualChanged(),false);assert.ok(h.draft(),'draft kept');
 h.c._vaultBoardContext=null;h.c._boardManualSaving={uid:'x'};
 assert.equal(h.c.__boardDraftRestore(),false,'refused while an explicit save is running');
 h.c._boardManualSaving=false;
 assert.equal(h.c.__boardDraftRestore(),true);assert.equal(h.c.state.players[0].x,40);
});
test('a restore bumps the edit sequence so an in-flight save cannot mark it saved',async()=>{
 const h=harness({serverRaw:payload(12,now-5000),ls:newerDraft(40)});await h.boot();
 const seq=h.c._boardPrivateEditSeq;assert.equal(h.c.__boardDraftRestore(),true);assert.equal(h.c._boardPrivateEditSeq,seq+1);
});
test('starting to edit withdraws the offer; the newer edits become the draft and a late click cannot replace them',async()=>{
 const h=harness({serverRaw:payload(12,now-5000),ls:newerDraft(40)});await h.boot();assert.ok(h.c.__boardDraftPending);
 h.edit(99);assert.equal(h.c.__boardDraftPending,null,'offer withdrawn on the first edit');
 assert.equal(h.c.__boardDraftRestore(),false);assert.equal(h.c.state.players[0].x,99);
 await h.fire();assert.equal(JSON.parse(h.draft().raw).snap.players[0].x,99,'the stored draft is the newest work');
});
test('an explicit save while the offer is showing withdraws it first',async()=>{
 const h=harness({serverRaw:payload(12,now-5000),ls:newerDraft(40)});await h.boot();assert.ok(h.c.__boardDraftPending);
 const p=h.c.boardSaveExplicit();assert.equal(h.c.__boardDraftPending,null,'bar withdrawn before the save awaits');
 assert.equal(h.c.__boardDraftRestore(),false);await p;
 assert.ok(h.messages.some(m=>typeof m==='string'&&/이전 작업은 버렸어요/.test(m)),'the save says the old draft was dropped');
});
test('when localStorage fills up the stale small-store copy is removed and the newer IndexedDB draft wins',async()=>{
 const opts={};const h=harness(opts);await h.boot();h.edit(5);await h.fire();assert.ok(h.idb.has(h.draftKey())&&!h.ls.has(h.draftKey()));
 opts.quota=true;h.edit(6);await h.fire();await ticks();
 assert.equal(h.ls.has(h.draftKey()),false,'stale localStorage copy removed');assert.equal(JSON.parse(JSON.parse(h.idb.get(h.draftKey())).raw).snap.players[0].x,6);
 const both=harness({ls:[[h.draftKey(),JSON.stringify({v:1,uid:'synthetic-user-a',wid:'personal-a',raw:payload(1,now-9000),at:now-9000})]],idb:[[h.draftKey(),JSON.stringify({v:1,uid:'synthetic-user-a',wid:'personal-a',raw:payload(2,now-1000),at:now-1000})]]});
 await both.boot();assert.equal(JSON.parse(both.c.__boardDraftPending.raw).snap.players[0].x,2,'the newer of the two stores is offered');
});
test('restoring from the match view switches to the working board and keeps the match canvas',async()=>{
 const h=harness({serverRaw:payload(12,now-5000),ls:newerDraft(40)});await h.boot();
 h.c.__csView='match';h.c.state=snap(70);
 assert.equal(h.c.__boardDraftRestore(),true);assert.equal(h.c.__csView,'board');assert.equal(h.c.state.players[0].x,40);
 assert.equal(h.c.__viewSnaps.match.players[0].x,70,'match canvas kept');
});
test('the shell reads the board state on frame load, players get their own coach marks, and leftover greys are gone',()=>{
 assert.match(app,/_fbd\.addEventListener\('load',function\(\)\{ var chg=false; try\{ var bw=_fbd\.contentWindow; chg=!!\(bw&&typeof bw\.boardManualChanged==='function'&&bw\.boardManualChanged\(\)\);/);
 const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8'),idp=fs.readFileSync(path.join(__dirname,'../studio/idp.html'),'utf8');
 assert.match(sync,/idpDailyMine:function\(\)\{ var w=activeWs\(\); if\(!w\)return Promise\.resolve\(null\); return rpc\('ps_idp_daily_mine',\{wid:w\}\)/);
 assert.match(idp,/localStorage\.getItem\(isCoach\(\)\?DAILY_KEY:DAILY_MINE_KEY\)/,'players read their own copy');
 assert.match(idp,/api\.idpDailyMine\(\)\.then/);
 const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
 assert.doesNotMatch(R('studio/scout.html'),/\.ck\{[^}]*--faint:#8A9099/i,'scout cockpit light grey');
 for(const f of ['studio/process.html','studio/gamemodel.html'])assert.doesNotMatch(R(f),/--text-3:#7C838D!important/i,f);
 assert.doesNotMatch(R('start/idp.html'),/#8A9099/i,'start/idp.html');
});

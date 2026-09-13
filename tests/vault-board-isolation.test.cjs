"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
function part(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
const contextSource=part('var _vaultBoardContext=null,','function autoSaveAnimFrame()');
const pagesSource=part('  window.__psPages={','\n})();\n</script>');
const openSource=part('  function openItem(d, readOnly){','  function newBoardItem(type){');
const closeSource=part('  window.__vaultBoardLeave=function(){','  function doViewSaveBack(){');
const defaultSource=part('window.boardShowDefault=function(){','\n/* 1.693');
const wrapperSource=part('  var _osetView=setView;','  // 신규 드릴에 현재 폴더 자동 지정');
const copy=o=>o==null?o:JSON.parse(JSON.stringify(o));
function snap(x){return {players:x==null?[]:[{id:1,x,y:50}],equipment:[],drawings:[],ball:null,pitchN:1,orientation:'h'};}
function item(x){return{type:'board',libId:'synthetic-'+x,name:'합성 작전판',snap:snap(x),frames:[{snap:snap(x)},{snap:snap(x+1)}],pages:[{snap:snap(x),name:'첫 페이지'},{snap:snap(x+10),name:'둘째 페이지'}]};}
function harness({empty=false,view='board',withPages=true}={}){
 const timers=[],nodes={},events=[],writes=[],ls=new Map([['ps_cache_owner_v1','synthetic-owner-seal']]);let uid='synthetic-user-a',wid='synthetic-workspace-a';
 function node(){return{style:{},classList:{set:new Set(),contains(x){return this.set.has(x);},add(x){this.set.add(x);},remove(x){this.set.delete(x);},toggle(x,on){if(on===undefined)on=!this.set.has(x);if(on)this.set.add(x);else this.set.delete(x);return on;}}};}
 for(const id of ['animBar','hint','vCreateBar','vCreateSave','vCreateSub','vCreateCancel'])nodes[id]=node();nodes.animBar.classList.add('on');
 const original=snap(empty?null:10),frames=[{snap:snap(5)},{snap:copy(original)}];
 const c=vm.createContext({console,JSON,Object,Array,String,Number,Math,Date,Promise,Error,Set,URLSearchParams,location:{search:''},
   document:{body:node(),getElementById:id=>nodes[id]||null},localStorage:{getItem:k=>ls.get(k)||null,setItem(k,v){ls.set(k,v);}},
   psCurrentUser:()=>({uid,at:'synthetic-public-token'}),psActiveWs:()=>({id:wid}),psVaultUnlocked:()=>true,psVaultRequireLogin:()=>true,
   setTimeout(fn,ms){const t={fn,ms,canceled:false};timers.push(t);return t;},clearTimeout(t){if(t)t.canceled=true;},
   state:copy(original),anim:{frames:copy(frames),slides:[],title:'원래 장면',titleColor:'#123456'},animActive:1,animHold:1.2,animLoop:true,autoOrient:false,
   undoStack:[{board:snap(3),anim:{frames:copy(frames),active:0}}],redoStack:[{board:snap(4)}],_bliveT:null,
   captureSnap(){return copy(c.state);},loadSnap(s){c.state=copy(s);events.push('load:'+((s.players||[])[0]||{}).x);},dc:copy,
   boardFlushLive(){writes.push({snap:copy(c.state),frames:copy(c.anim.frames)});return writes.at(-1);},
   restoreAnimBeforeCapture(){events.push('stop-playback');},renderTokens(){},renderDrawings(){},updateDelUI(){},renderAnimFrames(){},renderOnion(){},syncLoopUI(){},syncAnimTiming(){},_animFitPad(){},clearHistory(){c.undoStack=[];c.redoStack=[];},render(){},_clone:copy,
   pages:withPages?[{snap:snap(2),name:'첫 작업 페이지'},{snap:copy(original),name:'마지막 작업 페이지'}]:null,idx:withPages?1:0,_inVault:false,_livePages:null,
   setView(v){events.push('view:'+v);c.__csView=v;},showViewBar(name,ro){c.__vaultEdit=true;c.__vaultReadOnly=ro;c.__vaultViewMode=true;},
   hideCreateBar(){c.__vaultEdit=false;c.__vaultReadOnly=false;},exitVaultFull(){events.push('exit-full');},libFilter:{folder:'__all'},toggleSave(){},
   openLibDrawEditor(id,ro){events.push('training:'+ro);},showCreateBar(){},curType:()=> 'board',
   parent:{postMessage(m){events.push(m.type+':'+(m.app||''));}},$:id=>nodes[id]||null,$id:id=>nodes[id]||null});
 c.window=c;c.__csView=view;c.__viewSnaps=view==='board'?{}:{board:copy(original)};
 c.__animGet=()=>({frames:copy(c.anim.frames),active:c.animActive,hold:c.animHold,title:c.anim.title,titleColor:c.anim.titleColor});
 if(c.pages)c.pages[c.idx].anim=c.__animGet();
 c.__animReset=()=>{c.anim.frames=[];c.animActive=-1;c.anim.title='';c.animHold=.6;c.animLoop=false;nodes.animBar.classList.remove('on');};
 c.__animLoad=fr=>{c.anim.frames=copy(fr);c.animActive=0;c.state=copy(fr[0].snap);nodes.animBar.classList.add('on');};
 c.__vaultAutoSaveCancel=()=>events.push('cancel-vault-save');c.__vaultAutoSaveFlush=()=>events.push('flush-vault-save');
 vm.runInContext(contextSource+pagesSource+openSource+closeSource+defaultSource,c);
 const before=()=>({snap:copy(c.state),anim:copy(c.__animGet()),loop:c.animLoop,pages:copy(c.pages),idx:c.idx,undo:copy(c.undoStack),redo:copy(c.redoStack)});
 return{c,timers,nodes,events,writes,ls,before,run(ms){for(const t of timers.filter(t=>t.ms===ms&&!t.canceled)){t.canceled=true;t.fn();}},switchOwner(){uid='synthetic-user-b';wid='synthetic-workspace-b';ls.set('ps_cache_owner_v1','different-seal');},installWrapper(){vm.runInContext(wrapperSource,c);}};
}
test('returning from a library board restores live snap, active scene, pages/index and undo/redo together',()=>{
 const h=harness(),before=h.before();h.c.openItem(item(80),true);assert.equal(h.c.state.players[0].x,80);h.c.boardShowDefault();
 assert.deepEqual(h.before(),before);assert.equal(h.c._vaultBoardContext,null);assert.equal(h.c.__vaultEdit,false);
});
test('a deliberately empty working board is restored even without any prior viewSnaps entry',()=>{
 const h=harness({empty:true,withPages:false}),before=h.before();h.c.openItem(item(90),true);h.c.boardShowDefault();assert.deepEqual(h.before(),before);assert.equal(h.c.state.players.length,0);
});
test('opening another library item retains the first live context and rejects prior item timers',()=>{
 const h=harness(),before=h.before();h.c.openItem(item(80),true);const old=h.timers.slice();h.c.openItem(item(200),true);
 for(const t of old)t.fn();assert.equal(h.c.state.players[0].x,200);assert.equal(h.c.pages[0].snap.players[0].x,200);assert.equal(h.c.__vaultHydrating,true);
 h.c.boardShowDefault();assert.deepEqual(h.before(),before);
});
test('all delayed board and page restoration callbacks are inert after close',()=>{
 const h=harness(),before=h.before();h.c.openItem(item(80),true);h.c.doViewClose();for(const t of h.timers)t.fn();assert.deepEqual(h.before(),before);assert.equal(h.c._inVault,false);
});
test('page selection inside the library cannot change the original active page index or its scene set',()=>{
 const h=harness(),before=h.before();h.c.openItem(item(80),true);h.c.idx=0;h.c.pages[0].snap=snap(999);h.c.animActive=0;h.c.boardShowDefault();assert.deepEqual(h.before(),before);
});
test('library page context stores the latest working snap in the active page without mutating input pages',()=>{
 const h=harness();h.c.pages[1].snap=snap(1);const old=copy(h.c.pages),saved=copy(h.c.__psPages.captureContext(snap(42),h.c.__animGet()));
 assert.deepEqual(copy(h.c.pages),old);assert.equal(saved.idx,1);assert.equal(saved.pages[1].snap.players[0].x,42);assert.equal(saved.pages[1].anim.active,1);
});
test('live write, delayed save and hidden-page flush cannot serialize borrowed library state',()=>{
 const h=harness();h.c.openItem(item(80),true);const writes=copy(h.writes);
 vm.runInContext(part('function _boardLiveWriteNow(recovery){','function boardSaveLive(){')+part('function boardSaveLive(){','function restoreAnimBeforeCapture(){')+part('function boardFlushLive(){','try{window.__boardFlushLive='),h.c);
 assert.equal(h.c._boardLiveWriteNow(true),null);assert.equal(h.c.boardFlushLive(),null);h.c.boardSaveLive();assert.deepEqual(h.writes,writes);
});
test('readonly close cancels library autosave while edit close retains its existing flush',()=>{
 for(const ro of [true,false]){const h=harness();h.c.openItem(item(80),ro);h.events.length=0;h.c.__vaultBoardLeave();assert.equal(h.events.includes('flush-vault-save'),!ro);assert.equal(h.events.includes('cancel-vault-save'),ro);}
});
test('session navigation restores borrowed state before the original view transition runs',()=>{
 const h=harness(),before=h.before();h.installWrapper();h.c.openItem(item(80),true);h.events.length=0;h.c.setView('session');
 assert.deepEqual(h.before(),before);assert.ok(h.events.indexOf('load:10')<h.events.indexOf('view:session'));
});
test('a same-account owner context is retained across harmless token refresh',()=>{
 const h=harness(),before=h.before();h.c.openItem(item(80),true);h.c.psCurrentUser=()=>({uid:'synthetic-user-a',at:'refreshed-synthetic-token'});h.c.boardShowDefault();assert.deepEqual(h.before(),before);
});
test('account/workspace changes never restore a former account board or its undo history',()=>{
 const h=harness();h.c.openItem(item(80),false);const writes=copy(h.writes);h.switchOwner();h.events.length=0;h.c.vaultBoardCheckOwner();
 assert.equal(h.c.state.players.length,0);assert.equal(h.c.anim.frames.length,0);assert.equal(h.c.pages,null);assert.equal(h.c.undoStack.length,0);assert.equal(h.c.redoStack.length,0);assert.equal(h.events.includes('flush-vault-save'),false);assert.deepEqual(h.writes,writes);
});
test('an owner change invalidates pending hydration before any callback can alter the canvas',()=>{
 const h=harness();h.c.openItem(item(80),true);h.switchOwner();h.c.state=snap(333);for(const t of h.timers)t.fn();assert.equal(h.c.state.players[0].x,333);
});
test('failed restoration retains the original context and blocks live writes until a retry succeeds',()=>{
 const h=harness(),before=h.before();h.c.openItem(item(80),true);const load=h.c.loadSnap;h.c.loadSnap=()=>{throw Error('synthetic render failure');};assert.throws(()=>h.c.vaultBoardRestore());assert.ok(h.c._vaultBoardContext);h.c.loadSnap=load;h.c.vaultBoardRestore();assert.deepEqual(h.before(),before);
});
test('the existing training viewer stays outside the board-context lifecycle',()=>{
 const h=harness();h.c.openItem({type:'train',libId:'synthetic-training'},true);assert.equal(h.c._vaultBoardContext,null);assert.equal(h.events.includes('training:true'),true);assert.equal(h.writes.length,0);
});
test('opening training after a library board restores the live context before its separate editor begins',()=>{
 const h=harness(),before=h.before();h.c.openItem(item(80),true);h.events.length=0;h.c.openItem({type:'train',libId:'synthetic-training'},true);assert.deepEqual(h.before(),before);assert.ok(h.events.indexOf('load:10')<h.events.indexOf('training:true'));
});

test('an explicit main-board return cancels a queued library edit even after the viewer has already closed',()=>{
 const h=harness(),before=h.before();h.nodes.vCreateEdit={};h.c.__vvItem=item(80);h.c.openItem(item(80),true);let reopened=0;h.c.openItemEdit=()=>{reopened++;};
 vm.runInContext(part('    $id("vCreateEdit").onclick=function(e){','    return bar;'),h.c);
 h.nodes.vCreateEdit.onclick({stopPropagation(){}});h.c.boardShowDefault();h.run(80);assert.equal(reopened,0);assert.deepEqual(h.before(),before);
});
test('the ordinary view-to-edit handoff still opens when no newer navigation intervenes',()=>{
 const h=harness();h.nodes.vCreateEdit={};h.c.__vvItem=item(80);h.c.openItem(item(80),true);let reopened=0;h.c.openItemEdit=()=>{reopened++;};
 vm.runInContext(part('    $id("vCreateEdit").onclick=function(e){','    return bar;'),h.c);
 h.nodes.vCreateEdit.onclick({stopPropagation(){}});h.run(80);assert.equal(reopened,1);
});
test('the animation bar open state survives board-to-library-to-board navigation',()=>{
 const h=harness();h.c.document.querySelectorAll=()=>[];h.c.document.documentElement={dataset:{}};h.c.exitMatch=()=>{};h.c.renderSession=()=>{};h.c.boardSaveLive=()=>{};
 vm.runInContext(part('function setView(v){','/* ===== 경기 모드 — 러닝 클락 ===== */'),h.c);
 h.c.setView('session');assert.equal(h.nodes.animBar.classList.contains('on'),false);assert.equal(h.c._liveBoardAnimOpen,true);
 h.c.openItem(item(80),true);assert.equal(h.c._vaultBoardContext.animOpen,true);h.c.doViewClose();h.c.setView('session');h.c.boardShowDefault();assert.equal(h.nodes.animBar.classList.contains('on'),true);assert.equal(h.c.animActive,1);
});

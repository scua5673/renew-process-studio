'use strict';
/* 보관함에서 연 작전판 · 패턴북 — 둘러보기만 하고 나가면 «버리고 나갈까요?»를 묻지 않는다(studio/board-vault-browse.js · 처음 고침 3.001 840dfa9).
   열린 모습이 «저장된 지문»이고(항목 전체 — 모든 페이지), 페이지 옮기기 · 장면 고르기 · 재생 · 썸네일 뜨기는 지문을 흔들지 않는다.
   정말 고치면(어느 페이지든 · 누르기 없이 바뀌었든) «변경 있음». 브라우저 시험: tests/browser/vault-browse.mjs */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const VB=require('../studio/board-vault-browse.js');
const board=fs.readFileSync(path.join(root,'studio/board.html'),'utf8');
const dc=o=>JSON.parse(JSON.stringify(o));
const pl=(x,o)=>Object.assign({players:[{id:1,team:'blue',num:8,x,y:300}],equipment:[],drawings:[],ball:null,pitchN:1,area:'full',tokenScale:1},o||{});
const LOOK={tokenScale:1,label:'num',tokV:2};   /* __lookNow 의 칸(보드 설정) — tokV 표식도 여기 */

/* ── 지문(순수 함수) ── */
function env(o){ const e=Object.assign({snap:Object.assign(pl(100),{label:'num'}),frames:[{snap:pl(100),dur:1},{snap:pl(400),dur:1,cap:'전진'}],active:0,hold:.6,title:'',titleColor:'#e23b3b',
  pages:[{name:'A',snap:pl(100),thumb:'<svg/>',anim:{frames:[],active:0}},{name:'B',mo:'',snap:pl(600),thumb:'<svg/>',anim:{frames:[{snap:pl(600),dur:1,thumb:'<svg/>'},{snap:pl(900),dur:1}],active:0,hold:.6}}],idx:0,look:LOOK,bk:''},o||{});
  return e; }
test('which page or scene is on screen is not an edit — the board stands in for the current scene',()=>{
  const a=env(),b=env({active:1,snap:Object.assign(pl(400),{label:'num'})});
  b.frames[0].snap=Object.assign(pl(100),{label:'num',tokV:2});   /* 장면을 옮기면 판이 그 장면에 담긴다(보드 설정까지) */
  assert.equal(VB.itemSig(a),VB.itemSig(b));
});
test('thumbnails, board links, empty holders and re-stamped board settings on other pages are not edits',()=>{
  const base=VB.itemSig(env());
  const cases={
    'a scene thumbnail':e=>{e.frames[1].thumb='<svg>x</svg>';},
    'a page thumbnail':e=>{e.pages[1].thumb='';e.pages[1].anim.frames[0].thumb='';},
    'a board link':e=>{e.pages[1].vlink={libId:'V1'};},
    'an empty motion-path holder':e=>{e.frames[1].curves={};e.frames[0].hl=[];},
    'board settings written onto every page and scene':e=>{e.pages[1].snap.label='num';e.pages[1].anim.frames[1].snap.tokenScale=1;e.pages[1].snap.tokenScale=1.5;},
    'the current page\'s stale copy':e=>{e.pages[0].snap=pl(999);e.pages[0].anim={frames:[{snap:pl(1)}]};}
  };
  for(const [name,f] of Object.entries(cases)){ const e=env(); f(e); assert.equal(VB.itemSig(e),base,name); }
});
test('everything a save writes is in the fingerprint',()=>{
  const base=VB.itemSig(env());
  const cases={
    'the board':e=>{e.snap.players[0].x+=5;},
    'a board setting':e=>{e.snap.label='name';},
    'a pitch setting':e=>{e.snap.area='half';},
    'a non-active scene':e=>{e.frames[1].snap.players[0].x+=5;},
    'a scene\'s own pitch':e=>{e.frames[1].snap.area='half';},
    'a scene caption':e=>{e.frames[1].cap='라인 사이로';},
    'a scene speed':e=>{e.frames[0].moveSpeed=2;},
    'a motion path':e=>{e.frames[0].curves={'1':{cx:1,cy:2}};},
    'a stage label':e=>{e.frames[1].sg='전진';},
    'a scene added':e=>{e.frames.push({snap:pl(700),dur:1});},
    'a scene removed':e=>{e.frames.pop();},
    'the hold time':e=>{e.hold=1;},
    'the title':e=>{e.title='코너킥';},
    'another page\'s board':e=>{e.pages[1].snap.players[0].x+=5;},
    'another page\'s pitch':e=>{e.pages[1].snap.area='half';},
    'another page\'s scene':e=>{e.pages[1].anim.frames[1].snap.players[0].x+=5;},
    'a page name':e=>{e.pages[0].name='A2';},
    'another page name':e=>{e.pages[1].name='B2';},
    'a phase slot':e=>{e.pages[1].mo='set';},
    'page order':e=>{e.pages.reverse();e.idx=1;},
    'a page added':e=>{e.pages.push({name:'C',snap:pl(1)});},
    'book text':e=>{e.bk='x';}
  };
  for(const [name,f] of Object.entries(cases)){ const e=env(); f(e); assert.notEqual(VB.itemSig(e),base,name); }
});
test('a page move is only «the same pages, in the same order, another one shown»',()=>{
  const a={},b={},c={},pages=[a,b,c],pre={ref:pages,order:pages.slice(),idx:0,vid:'V'};
  assert.equal(VB.isSwitch(pre,{pages,idx:1,vid:'V'}),true);
  assert.equal(VB.isSwitch(pre,{pages,idx:0,vid:'V'}),false,'nothing moved');
  assert.equal(VB.isSwitch(pre,{pages,idx:1,vid:'W'}),false,'another item');
  assert.equal(VB.isSwitch(pre,{pages:pages.slice(),idx:1,vid:'V'}),false,'another page list (restore · open)');
  const re=[a,c,b]; assert.equal(VB.isSwitch({ref:re,order:[a,b,c],idx:0,vid:'V'},{pages:re,idx:2,vid:'V'}),false,'reordered');
  const added=[a,b,c]; const pre2={ref:added,order:added.slice(),idx:0,vid:'V'}; added.push({}); assert.equal(VB.isSwitch(pre2,{pages:added,idx:3,vid:'V'}),false,'a page added');
});

/* ── 붙임(가짜 작전판) — board.html 의 진짜 __vaultAutoSaveSchedule 위에서 ── */
const schedSrc=(()=>{ const a=board.indexOf('  window.__vaultAutoSaveSchedule=function(){'),b=board.indexOf('  window.__vaultAutoSaveCancel=function(){',a); assert.ok(a>0&&b>a,'__vaultAutoSaveSchedule'); return board.slice(a,b); })();
const modSrc=fs.readFileSync(path.join(root,'studio/board-vault-browse.js'),'utf8');
function fakeBoard(opt){
  opt=opt||{};
  const listeners={doc:{},win:{}},status=[];
  const c={JSON,Object,Array,Math,Promise,String,status,
    setTimeout:(f)=>0,clearTimeout(){},
    location:{pathname:'/test'},
    curType:()=>opt.type||'board',_vaultAutoStatus:t=>status.push(t),_vaultAutoRun(){},_vaultAutoWriting:false,_vaultAutoAgain:false,_vaultAutoT:null,
    state:pl(100),anim:{frames:[],title:'',titleColor:'#e23b3b'},animActive:-1,animHold:.6,animPlaying:false,
    pages:null,idx:0,stops:0};
  c.window=c;
  c.document={readyState:'complete',addEventListener:(t,f)=>{(listeners.doc[t]=listeners.doc[t]||[]).push(f);}};
  c.addEventListener=(t,f)=>{(listeners.win[t]=listeners.win[t]||[]).push(f);};
  c.fire=(where,t,e)=>{(listeners[where][t]||[]).forEach(f=>f(e||{}));};
  c.captureSnap=()=>{ if(c.broken)throw Error('boom'); return Object.assign(dc(c.state),{tokV:2}); };
  c.__lookNow=()=>({tokenScale:c.state.tokenScale});
  c.__psPages={pg:()=>c.pages,book:{idx:()=>c.idx}};
  c.restoreAnimBeforeCapture=()=>{ if(c.animPlaying){c.animPlaying=false;c.stops++;c.state=dc(c.beforePlay);} };
  c.selectAnimFrame=i=>{ c.anim.frames[c.animActive].snap=c.captureSnap(); c.animActive=i; const s=dc(c.anim.frames[i].snap); c.state.players=s.players; c.state.ball=s.ball; c.boardSaveLive(); return true; };
  c.boardSaveLive=()=>{ c.window.__vaultAutoSaveSchedule(); };
  c.__vaultEditSig=()=>'old';
  Object.assign(c,{__csView:opt.type||'board',__vaultEdit:true,__curVaultId:'VB',__vaultReadOnly:!!opt.ro,__vaultPending:null,__vaultManualDirty:false,__vaultSavedSig:null});
  vm.createContext(c);
  vm.runInContext(schedSrc,c);   /* 본문의 자동 저장 길 — 브라우저에서는 모듈이 먼저 읽히고 DOMContentLoaded 에 감싼다. 여기서는 본문이 이미 돈 뒤 */
  vm.runInContext(modSrc,c);
  c.api=c.PSVaultBrowse.mount(c);
  return c;
}
/* 페이지가 셋인 항목을 연다(openItem 처럼 __vaultHydrating 을 켰다 끈다) */
function open(c,opt){
  opt=opt||{};
  c.__vaultHydrating=true;
  c.pages=[{name:'A',snap:pl(100),anim:{frames:[{snap:pl(100),dur:1},{snap:pl(400),dur:1}],active:0,hold:.6}},{name:'B',snap:pl(600)},{name:'C',snap:pl(300),anim:{frames:[{snap:pl(300),dur:1},{snap:pl(800),dur:1}],active:0,hold:.6}}];
  c.idx=0; c.state=pl(100); c.anim.frames=dc(c.pages[0].anim.frames); c.animActive=0;
  if(opt.touch)c.fire('doc','pointerdown');
  c.__vaultHydrating=false;
}
/* 페이지 띠의 switchTo 처럼: restoreAnimBeforeCapture → 지금 페이지 담기 → 옮기기 → persist(boardSaveLive) */
function switchTo(c,i){
  c.restoreAnimBeforeCapture();
  const p=c.pages[c.idx]; p.snap=c.captureSnap(); p.thumb='<svg/>'; p.anim=c.anim.frames.length?{frames:dc(c.anim.frames),active:c.animActive,hold:c.animHold}:null;
  c.idx=i; const q=c.pages[i]; c.state=dc(q.snap); c.anim.frames=dc((q.anim&&q.anim.frames)||[]); c.animActive=c.anim.frames.length?0:-1;
  c.boardSaveLive();
}
const exit=c=>c.fire('win','click',{target:{closest:sel=>/#vCreateCancel/.test(sel)?{}:null}});

test('opening takes the fingerprint once the item has settled · browsing pages and scenes stays clean',async()=>{
  const c=fakeBoard(); assert.equal(c.api.state().hooked,true,'hooked right away (the board script already ran)');
  open(c); assert.ok(c.__vaultSavedSig,'fingerprint taken when hydration ends');
  c.__vaultAutoSaveSchedule(); assert.equal(c.__vaultManualDirty,false,'a press that changes nothing');
  switchTo(c,1); assert.equal(c.__vaultManualDirty,false,'page B');
  await Promise.resolve();
  switchTo(c,2); assert.equal(c.__vaultManualDirty,false,'page C');
  await Promise.resolve();
  c.selectAnimFrame(1); assert.equal(c.__vaultManualDirty,false,'another scene');
  c.__vaultAutoSaveSchedule(); assert.equal(c.__vaultManualDirty,false);
  switchTo(c,0); await Promise.resolve();
  exit(c); assert.equal(c.__vaultManualDirty,false,'leaving asks nothing');
  assert.deepEqual(c.status,[]);
});
test('a real edit on any page is «변경 있음» — before or after moving, with or without a press',async()=>{
  { const c=fakeBoard(); open(c); switchTo(c,1); await Promise.resolve();
    c.state.players[0].x+=50; c.__vaultAutoSaveSchedule(); assert.equal(c.__vaultManualDirty,true,'pressed after the edit');
    assert.deepEqual(c.status,['변경 사항 있음 · 저장 버튼을 눌러 주세요']); switchTo(c,0); assert.equal(c.__vaultManualDirty,true,'stays unsaved'); }
  { const c=fakeBoard(); open(c); switchTo(c,1); await Promise.resolve();
    c.state.players[0].x+=50; /* 아무 누르기 없이 */ switchTo(c,0); assert.equal(c.__vaultManualDirty,true,'checked right before the page move'); }
  { const c=fakeBoard(); open(c);
    c.state.players[0].x+=50; c.selectAnimFrame(1); assert.equal(c.__vaultManualDirty,true,'checked right before the scene move'); }
  { const c=fakeBoard(); open(c); c.anim.frames[1].cap='새 자막'; assert.equal(c.__vaultManualDirty,false); exit(c); assert.equal(c.__vaultManualDirty,true,'checked when leaving'); }
  { const c=fakeBoard(); open(c); c.pages[2].name='C2'; c.fire('win','beforeunload'); assert.equal(c.__vaultManualDirty,true,'checked before the window closes'); }
});
test('only a real page move re-takes the fingerprint — a later change in another task is not swallowed',async()=>{
  const c=fakeBoard(); open(c);
  c.restoreAnimBeforeCapture();   /* 저장 · 내보내기 길도 부른다 */
  await Promise.resolve();
  c.idx=1; c.state=dc(c.pages[1].snap); c.anim.frames=[]; c.animActive=-1;   /* 옮기기 같은 모양이지만 다른 차례 */
  c.boardSaveLive(); assert.equal(c.__vaultManualDirty,true);
  const d=fakeBoard(); open(d);
  d.restoreAnimBeforeCapture(); const p=d.pages; [p[1],p[2]]=[p[2],p[1]]; d.idx=2; d.boardSaveLive();
  assert.equal(d.__vaultManualDirty,true,'reordered in the same task');
});
test('a board shown for a moment (playing · exporting · thumbnails) is not compared — leaving puts it back first',()=>{
  const c=fakeBoard(); open(c); const sig0=c.__vaultSavedSig;
  c.beforePlay=dc(c.state); c.animPlaying=true; c.state.players[0].x+=200; c.__vaultAutoSaveSchedule();
  assert.equal(c.__vaultManualDirty,false); assert.equal(c.__vaultSavedSig,sig0);
  exit(c); assert.equal(c.stops,1,'the play is stopped before comparing'); assert.equal(c.__vaultManualDirty,false,'back as it was');
  for(const k of ['__animExport','__psThumbCapturing']){ const d=fakeBoard(); open(d); d[k]=true; d.state.players[0].x+=200; d.__vaultAutoSaveSchedule(); assert.equal(d.__vaultManualDirty,false,k); d[k]=false; d.state.players[0].x-=200; d.__vaultAutoSaveSchedule(); assert.equal(d.__vaultManualDirty,false,k+' — back'); }
});
test('the old way stays where the fingerprint cannot be trusted',()=>{
  { const c=fakeBoard(); open(c,{touch:true}); assert.equal(c.__vaultSavedSig,null,'touched while opening'); c.__vaultAutoSaveSchedule(); assert.equal(c.__vaultManualDirty,true,'every press is «변경 있음» as before'); }
  { const c=fakeBoard(); c.broken=true; open(c); assert.equal(c.__vaultSavedSig,null,'no fingerprint when the board cannot be read'); c.broken=false; c.__vaultAutoSaveSchedule(); assert.equal(c.__vaultManualDirty,true); }
  { const c=fakeBoard(); open(c); c.broken=true; c.__vaultAutoSaveSchedule(); assert.equal(c.__vaultManualDirty,true,'a fingerprint that fails to compare counts as changed'); }
  { const c=fakeBoard({ro:true}); open(c); assert.equal(c.__vaultSavedSig,null,'view-only'); }
  { const c=fakeBoard({type:'meeting'}); c.__csView='meeting'; open(c); assert.equal(c.__vaultSavedSig,null,'meetings save themselves'); }
  { const c=fakeBoard(); c.__vaultHydrating=true; assert.equal(c.__vaultSavedSig,null); c.__vaultSavedSig='stale'; c.__vaultHydrating=false; c.__vaultHydrating=true; assert.equal(c.__vaultSavedSig,null,'a new item drops the last one\'s fingerprint'); }
});
test('wiring: the module loads before the board script and is cached · the board still raises and clears __vaultHydrating · the page strip still starts a move with restoreAnimBeforeCapture',()=>{
  const tag='<script src="board-vault-browse.js"></script>',at=board.indexOf(tag);
  assert.ok(at>0,'script tag'); assert.ok(at<board.indexOf('window.__vaultAutoSaveSchedule=function(){'),'before the board script');
  assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes("'/studio/board-vault-browse.js'"),'sw.js CORE');
  assert.match(board,/\n    window\.__vaultHydrating=true;\n/);
  assert.match(board,/setTimeout\(function\(\)\{if\(stillOpen\(\)\)window\.__vaultHydrating=false;\},420\);/);
  assert.match(board,/function switchTo\(i\)\{ if\(!pages\|\|i===idx\|\|!pages\[i\]\)return;[^\n]*?restoreAnimBeforeCapture\(\);capture\(\);[^\n]*?persist\(\); \}/);
  assert.match(board,/function persist\(\)\{ try\{ window\.boardSaveLive && window\.boardSaveLive\(\); \}catch\(_\)\{\} \}/);
  assert.match(board,/try\{if\(!_vaultAutoWriting\)window\.__vaultAutoSaveSchedule\(\);\}catch\(_\)\{\}/,'boardSaveLive asks the vault schedule');
  assert.match(board,/function doViewClose\(\)\{\n    if\(window\.__vaultManualDirty\)\{psConfirm\("저장하지 않은 변경 사항을 버리고 나갈까요\?"/);
  assert.match(board,/var _sig0=\(window\.__vaultEditSig&&window\.__vaultEditSig\(\)\)\|\|null;/,'«저장» takes its fingerprint through window.__vaultEditSig');
  for(const id of ['vCreateCancel','vvClose','vCreateBackMatch'])assert.ok(board.includes('id="'+id+'"'),id);
  assert.match(board,/\nfunction restoreAnimBeforeCapture\(\)\{/); assert.match(board,/\nfunction selectAnimFrame\(i,focus\)\{/); assert.match(board,/\nfunction captureSnap\(\)\{/);
});

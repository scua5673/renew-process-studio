'use strict';
/* 3.001 — 보관함에서 연 작전판(여러 페이지·패턴북)은 페이지·시퀀스를 옮기기만 해도 «변경 사항 있음»이 되어,
   아무것도 안 고치고 «나가기»를 누르면 «저장하지 않은 변경 사항을 버리고 나갈까요?»가 떴다.
   이제 열린 모습이 «저장된 지문»이고(항목 전체 — 모든 페이지), 페이지 옮기기·장면 고르기·재생·썸네일 뜨기는 지문을 흔들지 않는다.
   정말 고치면(어느 페이지든) 그대로 «변경 있음». 브라우저 시험: tests/browser/patternbook.mjs 6b. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const slice=(a,b)=>{const i=src.indexOf(a);assert.ok(i>=0,a);const j=src.indexOf(b,i+a.length);assert.ok(j>i,b);return src.slice(i,j);};
const sigCode=slice('  window.__vaultEditSig=function(){','  window.__vaultAutoSaveSchedule=function(){');
const autoCode=slice('  window.__vaultAutoSaveSchedule=function(){','  window.__vaultAutoSaveCancel=function(){');
const pagesSig=slice('    editSig:function(){','\n');
const dc=o=>JSON.parse(JSON.stringify(o));
const pl=x=>({players:[{id:1,team:'blue',num:8,x,y:300}],equipment:[],drawings:[],ball:null});

/* 판(state)·장면(anim)·페이지(__psPages)를 흉내 낸 작은 보드. captureSnap 은 판 설정 + 내용 */
function board(type){
  const status=[],timers=[];
  const c={JSON,Object,Array,Math,status,timers,
    setTimeout(fn,ms){timers.push(ms);return timers.length;},clearTimeout(){},
    curType:()=>type||'board',_vaultAutoStatus:t=>status.push(t),_vaultAutoRun(){},_vaultAutoWriting:false,_vaultAutoAgain:false,_vaultAutoT:null,
    state:Object.assign({look:'circle'},pl(100)),
    captureSnap(){return dc({players:c.state.players,equipment:c.state.equipment,drawings:c.state.drawings,ball:c.state.ball,look:c.state.look});},
    anim:{frames:[{snap:pl(100),dur:1},{snap:pl(400),dur:1}],title:'',titleColor:'#e23b3b'},animActive:0,animHold:.6,animPlaying:false,
    pages:[{name:'빌드업 A',snap:pl(100),anim:{frames:[]}},{name:'코너킥 니어',snap:pl(600),thumb:'<svg/>',anim:{frames:[{snap:pl(600),dur:1,thumb:'<svg/>'}]}}],idx:0};
  c.window=c;Object.assign(c,{__vaultEdit:true,__curVaultId:'VBOOK',__vaultReadOnly:false,__vaultPending:null,__vaultHydrating:false,__vaultManualDirty:false,__vaultSavedSig:null});
  vm.createContext(c);
  vm.runInContext('window.__psPages={'+pagesSig+'};'+sigCode+autoCode,c);
  /* 장면 고르기(selectAnimFrame): 지금 판을 장면에 확정하고 그 장면을 판에 올린다 */
  c.select=i=>{c.anim.frames[c.animActive].snap=Object.assign(c.captureSnap(),{look:'stamped'});c.animActive=i;const s=dc(c.anim.frames[i].snap);c.state.players=s.players;c.state.ball=s.ball;};
  /* 페이지 옮기기(switchTo): capture → 다음 페이지를 판에. 옮기는 동안 boardSaveLive 가 __vaultAutoSaveSchedule 을 부른다 */
  c.switchTo=i=>c.__vaultBrowse(()=>{const p=c.pages[c.idx];p.snap=c.captureSnap();p.anim={frames:dc(c.anim.frames),active:c.animActive};p.thumb='<svg/>';
    c.idx=i;const q=c.pages[i];c.state.players=dc(q.snap.players);c.anim.frames=dc((q.anim&&q.anim.frames)||[]);c.animActive=c.anim.frames.length?0:-1;c.__vaultAutoSaveSchedule();});
  return c;
}

test('an opened item is clean until something really changes — on any page',()=>{
  const c=board();c.__vaultEditBaseline();assert.ok(c.__vaultSavedSig);
  c.__vaultAutoSaveSchedule();assert.equal(c.__vaultManualDirty,false,'a click that changes nothing');
  c.switchTo(1);assert.equal(c.__vaultManualDirty,false,'moving to page 2');
  c.switchTo(0);assert.equal(c.__vaultManualDirty,false,'and back');
  c.select(1);c.__vaultAutoSaveSchedule();assert.equal(c.__vaultManualDirty,false,'choosing another scene (the scene commit stamps board settings into scenes — not an edit)');
  c.anim.frames[1].curves={};c.anim.frames[0].thumb='<svg>new</svg>';c.__vaultAutoSaveSchedule();assert.equal(c.__vaultManualDirty,false,'an empty motion-path holder and a new thumbnail are not edits');
  c.switchTo(1);c.state.players[0].x+=50;c.__vaultAutoSaveSchedule();
  assert.equal(c.__vaultManualDirty,true,'a real edit on page 2');assert.equal(c.__vaultSavedSig,null,'the fingerprint is dropped once it differs (2.975)');
  assert.deepEqual(c.status,['변경 사항 있음 · 저장 버튼을 눌러 주세요']);
  c.switchTo(0);assert.equal(c.__vaultManualDirty,true,'moving away keeps it unsaved');
});

test('the fingerprint covers what a save writes: other pages, names, scene fields, scene titles',()=>{
  const cases={
    'another page\'s content':c=>{c.pages[1].snap.players[0].x+=10;},
    'another page\'s scenes':c=>{c.pages[1].anim.frames[0].snap.players[0].x+=10;},
    'a page name':c=>{c.pages[0].name='빌드업 B';},
    'a phase slot':c=>{c.pages[1].mo='set';},
    'page order':c=>{c.pages.reverse();c.idx=1;},
    'a scene caption':c=>{c.anim.frames[1].cap='라인 사이로';},
    'a non-active scene':c=>{c.anim.frames[1].snap.players[0].x+=10;},
    'a scene added':c=>{c.anim.frames.push({snap:pl(700),dur:1});},
    'the animation title':c=>{c.anim.title='코너킥';},
    'board settings':c=>{c.state.look='square';}
  };
  for(const [name,edit] of Object.entries(cases)){
    const c=board();c.__vaultEditBaseline();edit(c);c.__vaultAutoSaveSchedule();assert.equal(c.__vaultManualDirty,true,name);
  }
});

test('page moves are watched as a whole: an unnoticed change before the move still counts, nothing schedules mid-move',()=>{
  const c=board();c.__vaultEditBaseline();
  c.state.players[0].x+=30;   /* 고쳤는데 아직 아무도 묻지 않았다 */
  c.switchTo(1);assert.equal(c.__vaultManualDirty,true);assert.equal(c.__vaultSavedSig,null);
  const d=board();d.__vaultEditBaseline();const sig0=d.__vaultSavedSig;
  d.switchTo(1);assert.notEqual(d.__vaultSavedSig,sig0,'the moved-to page becomes the new fingerprint');assert.equal(d.__vaultSavedSig,d.__vaultEditSig());
  const e=board();e.__vaultEditBaseline();e.__vaultManualDirty=true;e.__vaultSavedSig=null;e.switchTo(1);assert.equal(e.__vaultManualDirty,true,'already dirty stays dirty');
});

test('a board shown for a moment (playing · exporting · a scene thumbnail) is not an edit',()=>{
  for(const flag of ['animPlaying','__animExport','__psThumbSwap']){
    const c=board();c.__vaultEditBaseline();const sig0=c.__vaultSavedSig;
    c[flag]=flag==='__psThumbSwap'?1:true;c.state.players[0].x+=200;c.__vaultAutoSaveSchedule();
    assert.equal(c.__vaultManualDirty,false,flag);assert.equal(c.__vaultSavedSig,sig0,flag+' keeps the fingerprint');
    c[flag]=flag==='__psThumbSwap'?0:false;c.state.players[0].x-=200;c.__vaultAutoSaveSchedule();assert.equal(c.__vaultManualDirty,false,flag+' — back as it was');
  }
});

test('no fingerprint is taken while opening, for view-only items, or for auto-saved types',()=>{
  const h=board();h.__vaultHydrating=true;h.__vaultEditBaseline();assert.equal(h.__vaultSavedSig,null);
  const r=board();r.__vaultReadOnly=true;r.__vaultEditBaseline();assert.equal(r.__vaultSavedSig,null);
  const m=board('match');m.__vaultEditBaseline();assert.equal(m.__vaultSavedSig,null);
  m.switchTo(1);assert.deepEqual(m.timers,[850],'a match item still auto-saves after a page move');assert.equal(m.__vaultManualDirty,false);
});

test('wiring: opening takes the fingerprint when hydration ends · page moves go through __vaultBrowse · thumbnails raise __psThumbSwap',()=>{
  assert.match(src,/window\.__vaultHydrating=true;window\.__vaultSavedSig=null;/,'a new item starts without a fingerprint');
  assert.match(src,/setTimeout\(function\(\)\{if\(stillOpen\(\)\)\{window\.__vaultHydrating=false;try\{window\.__vaultEditBaseline\(\);\}catch\(_\)\{\}\}\},420\);/,'the fingerprint is taken when the opening load settles');
  const sw=slice('  function switchTo(i){','\n  function del(i)');
  assert.match(sw,/^  function switchTo\(i\)\{ if\(!pages\|\|i===idx\|\|!pages\[i\]\)return; try\{ if\(window\.__bkMap\)window\.__bkMap\.close\(\); \}catch\(_\)\{\} capture\(\);/,'2.990 prefix kept');
  assert.match(sw,/var go=function\(\)\{ idx=i; loadIdx\(idx\);clearHistory\(\);render\(\); persist\(\); \};\s+if\(window\.__vaultBrowse\)window\.__vaultBrowse\(go\); else go\(\); \}/);
  const th=slice('window.__snapToThumb=function(snap,opts){','\n};');
  assert.match(th,/window\.__psThumbSwap=\(window\.__psThumbSwap\|\|0\)\+1;\s+try\{ loadSnap\(snap\|\|\{\}\); return boardThumbSVG\(\); \}/);
  assert.match(th,/finally\{ try\{ loadSnap\(cur\); \}catch\(_\)\{\} window\.__psThumbSwap=Math\.max\(0,\(window\.__psThumbSwap\|\|1\)-1\); \}/,'released after the board is put back');
});

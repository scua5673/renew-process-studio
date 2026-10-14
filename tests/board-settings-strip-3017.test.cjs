const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
const notes=require('../studio/release-notes.js');

/* 3.017 — 사용자 «보드 설정이 잘 안 보인다» → 1안: 위 띠의 «보드 저장» 옆에 «보드 설정» */
test('3.017 the page strip carries a labelled «보드 설정» button right after «보드 저장»',()=>{
  const at=board.indexOf('if(manualSave&&(window.innerWidth||0)>=640)box.appendChild(manualSave);');
  const bs=board.indexOf('bs.id="bpBoardSettings"'),vs=board.indexOf('if(vaultSave&&(window.innerWidth||0)>=640)box.appendChild(vaultSave);');
  assert.ok(at>0&&bs>at&&vs>bs,'order: 보드 저장 → 보드 설정 → 보관함 저장');
  assert.match(board,/if\(\(window\.innerWidth\|\|0\)>=640&&!_bkNarrow&&document\.getElementById\("viewBtn"\)\)\{/,'not on the phone strip or the narrow pattern-book strip');
  assert.match(board,/<circle cx="12" cy="12" r="3"\/><\/svg><span>보드 설정<\/span>';/,'gear icon with a visible label');
  assert.match(board,/bs\.setAttribute\("aria-haspopup","dialog"\); bs\.setAttribute\("aria-controls","cmd-board-settings-pop"\);/);
  assert.match(board,/bs\.onclick=function\(e\)\{ e\.stopPropagation\(\); _bsToggle\(\); _bsSync\(\); \};/);
});

test('3.017 the strip button opens the same panel and shows when it is open',()=>{
  assert.match(board,/function _bsToggle\(\)\{ try\{ if\(window\.__psToggleBoardSettings\)window\.__psToggleBoardSettings\("toggle"\); else \{ var vb=document\.getElementById\("viewBtn"\); if\(vb\)vb\.click\(\); \} \}catch\(_\)\{\} \}/);
  assert.match(board,/b\.setAttribute\("aria-expanded",_bsOpen\(\)\?"true":"false"\)/);
  assert.match(board,/p\.__bpObs=new MutationObserver\(_bsSync\); p\.__bpObs\.observe\(p,\{attributes:true,attributeFilter:\["aria-hidden"\]\}\)/,'follows the panel however it is opened or closed');
  assert.ok(board.includes('#boardPageStrip .bp-set[aria-expanded="true"]{background:#E9EDF5;border-color:#C3CCDD;color:var(--ps-navy-h,#1D2D50);}'),'열린 동안은 눌린 모양(3.020 메인색 네이비)');
});

test('3.017 clicking the strip button is not an «outside» click for the panel or the scene selection',()=>{
  assert.match(board,/t\.closest\("\.cmenu-pop,\.popmenu,#colorPop,#animFrameMenu,#bpBoardSettings"\)\)return;/);
  assert.match(board,/e\.target\.closest\("#animFrames,#animFrameMenu,#cmd-board-settings-pop,\.cmd-board-settings-wrap,#bpBoardSettings"\)/);
});

test('3.017 the dock icon and the shortcut still open board settings',()=>{
  assert.match(board,/view\.title="보드 설정";view\.setAttribute\("aria-label","보드 설정"\)/);
  assert.match(board,/if\(id==="boardSettings"\)\{ try\{ if\(window\.__psToggleBoardSettings\)window\.__psToggleBoardSettings\("toggle"\);/);
});

test('3.017 release note points to the new place',()=>{
  const e=notes.entries().find(x=>x.id==='2026-10-14-v3-017-settings-button');
  assert.ok(e,'3.017 entry');
  assert.ok(e.changes.some(c=>/«보드 저장» 바로 옆에 «보드 설정»/.test(c)));
});

const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
const notes=require('../studio/release-notes.js');

/* 3.014 — 오류 제보 88a82188 «첫 화면 보드 초기화 하는 게 있으면 좋겠다 · 전 작업이 계속 남아 있다» */
test('3.014 «새 보드» clears the page canvas to the «새 보드 기본 세팅» (or an empty pitch) and drops its history',()=>{
  const fn=/function boardNewCanvas\(\)\{[\s\S]*?\n\}\n/.exec(board);assert.ok(fn,'boardNewCanvas');
  assert.match(fn[0],/window\.__animReset&&window\.__animReset\(\)/,'scenes go');
  assert.match(fn[0],/d=boardDefaultRead\(\)/,'uses the saved new-board default');
  assert.match(fn[0],/loadSnap\(d\|\|\{players:\[\],equipment:\[\],drawings:\[\],ball:\{x:CX,y:CY\},pitchN:1\}\)/,'empty pitch otherwise');
  assert.match(fn[0],/undoStack\.length=0;redoStack\.length=0;/,'no undo back into the old board');
  assert.match(board,/window\.__boardNewCanvas=boardNewCanvas;/);
});

test('3.014 «새 보드» saves at once without writing the empty board into linked vault items',()=>{
  assert.match(board,/async function boardSaveExplicit\(o\)\{[^\n]*\n  o=\(o&&typeof o==="object"&&!o\.type\)\?o:\{\};/,'click events are not options');
  assert.match(board,/var _wb=\[\]; if\(!o\.noLink\)\{ try\{ _wb=await boardLinkWriteBack\(false\); \}/,'noLink skips the vault write-back');
  assert.match(board,/else if\(!o\.quiet\)toast\(_wbt\?\("보드에 저장됨 ✓"/,'quiet keeps the success toast for the caller');
  const nb=/function newBoard\(\)\{[\s\S]*?\n  \}\n/.exec(board);assert.ok(nb,'newBoard');
  assert.match(nb[0],/pages=null; idx=0; _singleLink=null;/,'one page, no vault link');
  assert.match(nb[0],/_nbSave\("새 보드로 시작했어요"/);
  assert.match(board,/function _nbSave\(msg\)\{ var s=window\.__boardSaveExplicit; Promise\.resolve\(s\?s\(\{noLink:true,quiet:true\}\):false\)/);
});

test('3.014 «새 보드» says what goes, skips the question on an empty board and keeps «↶ 이전 보드» for a minute',()=>{
  const nb=/function newBoard\(\)\{[\s\S]*?\n  \}\n/.exec(board)[0];
  assert.match(nb,/if\(!c\.any&&c\.n<=1&&!c\.sc\)\{ go\(\); return; \}/,'nothing to lose → no dialog');
  assert.match(nb,/psConfirm\("지금 보드를 비우고 새 보드로 시작할까요\?[\s\S]*보관함에 저장한 자료는 그대로예요[\s\S]*«↶ 이전 보드»로 되살릴 수 있어요",go\)/);
  assert.match(board,/var _nbUndo=null,_nbT=0,NB_UNDO_MS=60000;/);
  assert.match(nb,/_nbT=setTimeout\(function\(\)\{ _nbUndo=null; try\{render\(\);\}catch\(_\)\{\} \},NB_UNDO_MS\)/,'the undo button leaves after a minute');
  const un=/function newBoardUndo\(\)\{[\s\S]*?\n  \}\n/.exec(board);assert.ok(un,'newBoardUndo');
  assert.match(un[0],/_singleLink=p\.link\?_clone\(p\.link\):null;/,'the vault link comes back too');
  assert.match(un[0],/if\(_nbSig\(\)!==u\.fresh\)\{ psConfirm\("이전 보드를 되살릴까요\?\\n새 보드에 그린 것은 사라져요\.",back\); return; \}/,'asks again once the new board has work');
});

test('3.014 the page strip shows «새 보드» only on the live work board',()=>{
  assert.match(board,/function _nbAvailable\(\)\{ return !_lent&&!_inVault&&!window\.__vaultEdit&&!window\.__vaultBook&&!window\.__vaultReadOnly&&isBoardView\(\); \}/);
  assert.match(board,/if\(_nbAvailable\(\)\)\{\n      var nb=document\.createElement\("button"\); nb\.type="button"; nb\.className="bp-add"; nb\.id="bpNewBoard";/);
  assert.match(board,/nu\.id="bpNewBoardUndo";\n        nu\.textContent="↶ 이전 보드";/);
});

test('3.014 release note explains «새 보드» and «↶ 이전 보드»',()=>{
  const e=notes.entries()[0];
  assert.equal(e.id,'2026-10-13-v3-014-new-board');
  assert.ok(e.changes.some(c=>/«새 보드»/.test(c))&&e.changes.some(c=>/«↶ 이전 보드»/.test(c))&&e.changes.some(c=>/보관함에 저장한 자료는 그대로/.test(c)));
});

const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');

/* 3.016 — 사용자 «토큰 크기가 다른 작업물들 불러올 때 막 변경되는데 변경되지 않게 · 작업물마다 보드 설정 했던 것들 전부 각각 저장되게» */
test('3.016 moving between pages of one work keeps the board settings; opening a work uses its own',()=>{
  assert.match(board,/function loadIdx\(i,keep\)\{ try\{ window\.loadSnap\(pages\[i\]\.snap\|\|\{\},keep\?\{keepLook:true\}:undefined\);/);
  assert.match(board,/if\(keep\)_lookStampPages\(\); \}/,'the page and its scenes get the current settings');
  for(const s of [
    'idx++; loadIdx(idx,true);clearHistory();',                         // ＋ 페이지
    'pages.splice(i+1,0,_cp); idx=i+1; loadIdx(idx,true);',              // 복제
    '/* 2.990 — 시퀀스를 고르면 국면 지도는 걷힌다 */ idx=i; loadIdx(idx,true);', // 고르기
    'else if(idx===i)idx=Math.max(0,i-1); loadIdx(idx,true);',           // 지우기
    '      idx=at+1; loadIdx(idx,true);clearHistory();render();persist();', // 미팅 세트
    'pages.splice(_at,0,p); idx=_at; loadIdx(idx,true);',                // 패턴북 시퀀스 더하기
    '        idx=at; loadIdx(idx,true);clearHistory();render(); _bkTouch(); return arr.length; },' // 작전판에서 가져온 시퀀스
  ])assert.ok(board.includes(s),s);
  /* 작업물을 새로 열 때는 그 작업물의 설정 */
  assert.ok(board.includes('window.__pendingBoardPages=null; loadIdx(idx);clearHistory();'),'reload keeps each work its own settings');
  assert.match(board,/if\(reloadFirst\)loadIdx\(idx\); \}/,'opening vault pages');
  assert.match(board,/if\(pages\)loadIdx\(idx\);\n/,'«↶ 이전 보드» restores that work as it was');
});

test('3.016 every page (and its scenes) carries the one setting of the work',()=>{
  const fn=/function _lookStampPages\(\)\{[\s\S]*?\n    try\{ window\.__lookStampScenes&&window\.__lookStampScenes\(\); \}catch\(_\)\{\} \}/.exec(board);assert.ok(fn,'_lookStampPages');
  assert.match(fn[0],/pages\.forEach\(function\(p\)\{ if\(!p\)return; st\(p\.snap\); try\{ if\(p\.anim&&Array\.isArray\(p\.anim\.frames\)\)p\.anim\.frames\.forEach\(function\(f\)\{ if\(f\)st\(f\.snap\); \}\); \}catch\(_\)\{\} \}\);/);
  assert.match(board,/pages\[idx\]\.snap=snap;pages\[idx\]\.thumb=thumb;pages\[idx\]\.anim=animation;\n    if\(pages\.length>1\)_lookStampPages\(\);/,'stamped whenever the current page is captured (save · export · thumbnails)');
  assert.match(board,/window\.__lookStampScenes=function\(\)\{ lookStampScenes\(\); \};/);
});

test('3.016 «보드 가져오기» brings the content, not the other work’s settings',()=>{
  const fn=/async function openBoardImport\(\)\{[\s\S]*?\n\}\n/.exec(board);assert.ok(fn);
  assert.match(fn[0],/try\{ loadSnap\(snap,\{keepLook:true\}\); \}catch\(_\)\{\}/);
  assert.ok(!/try\{ loadSnap\(snap\); \}catch\(_\)\{\}/.test(fn[0]),'no plain load left');
  assert.match(fn[0],/__animLoad\(d\.frames\); \} else if\(window\.__animReset\)\{ __animReset\(\); \} \}catch\(_\)\{\}\n      try\{ lookStampScenes\(\); \}catch\(_\)\{\}/,'imported scenes play at the board’s size');
});

test('3.016 the «보드 저장» write-back keeps the linked work’s own settings',()=>{
  assert.match(board,/function lookKeepOf\(dst,src\)\{ if\(!dst\|\|typeof dst!=="object"\|\|!src\)return dst; lookKeys\(\)\.concat\(\["tokV"\]\)\.forEach\(function\(k\)\{ if\(Object\.prototype\.hasOwnProperty\.call\(src,k\)\)dst\[k\]=src\[k\]; else delete dst\[k\]; \}\); return dst; \}/);
  const fn=/async function boardLinkWriteBack\(onlyCurrent\)\{[\s\S]*?\n\}\n/.exec(board);assert.ok(fn);
  assert.match(fn[0],/snap=lookKeepOf\(dc\(snap\),_own\);/,'a copy — the board’s own page is not touched');
  assert.match(fn[0],/anim=dc\(anim\); anim\.frames\.forEach\(function\(f\)\{ if\(f\)lookKeepOf\(f\.snap,_own\); \}\);/);
  assert.match(fn[0],/frames=dc\(frames\); frames\.forEach\(function\(f\)\{ if\(f\)lookKeepOf\(f\.snap,_own\); \}\);/);
  assert.match(fn[0],/if\(JSON\.stringify\(lookOf\(snap\)\)!==_lb\)\{ try\{ var _t=window\.__snapToThumb&&window\.__snapToThumb\(snap\); if\(_t\)thumb=_t; \}catch\(_\)\{\} \}/,'thumbnail redrawn in that work’s settings');
});

'use strict';
/* 3.078 — 레이아웃 1단계: 위쪽 막대 · 평면 토큰 크게 · 중계에서 평면으로 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const tb=require('../studio/board-topbar.js'),bc=require('../studio/board-broadcast.js');
const n=(cls,id,text)=>({classList:{contains:c=>cls.split(' ').includes(c)},id:id||'',textContent:text||''});
test('strip buttons go to the right group: first «＋ 페이지» beside the tabs, other adds into «보드 ▾», saves on the right in order',()=>{
  const kids=[n('bp-head'),n('bp-tab on'),n('bp-tab'),n('bp-add','','＋ 페이지'),n('bp-add','','미팅 세트'),n('bp-add','bpImportBoard','보드 가져오기'),n('bp-add','bpNewBoard','새 보드'),n('','vaultSave'),n('','boardManualSave'),n('bp-set','bpBoardSettings')];
  const g=tb.sortStrip(kids);
  assert.ok(g.head);assert.equal(g.tabs.length,2);assert.equal(g.add.textContent,'＋ 페이지');
  assert.deepEqual(g.menu.map(x=>x.textContent),['미팅 세트','보드 가져오기','새 보드']);
  assert.deepEqual(g.right.map(x=>x.id),['boardManualSave','bpBoardSettings','vaultSave']);
});
test('view switch reads 평면 · 3D · 중계',()=>{
  assert.equal(tb.viewOf(false,'tv'),'flat');assert.equal(tb.viewOf(true,'mid'),'3d');assert.equal(tb.viewOf(true,'tv'),'tv');
  assert.match(tb.css(),/body\.ps-dock-float #boardPageStrip\.ps-tb/,'only with the floating dock');
});
test('flat view: players and ball one step bigger, equipment and images unchanged',()=>{
  const eq=t=>t==='cone';
  assert.equal(bc.flatK({team:'blue'},true,eq),bc.FLAT_K);assert.equal(bc.flatK({team:'ball'},true,eq),bc.FLAT_K);
  assert.equal(bc.flatK({team:'cone'},true,eq),1);assert.equal(bc.flatK({team:'img'},true,eq),1);assert.equal(bc.flatK({team:'blue'},false,eq),1,'3D unchanged');
  assert.ok(bc.FLAT_K>1&&bc.FLAT_K<=1.6);
});
test('board wiring: flat factor, real scale only in 3D, script tag, cache',()=>{
  const b=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  assert.match(b,/\*phoneTokFactor\(p\)\*\(window\.__flatK\?__flatK\(p\):1\);\}/);
  assert.match(b,/function _realTokS\(p\)\{ if\(!_realScaleOn\(\)\|\|!p\|\|!document\.body\.classList\.contains\("bc-tilt3d"\)\)return 0;/);
  assert.match(b,/<script src="board-topbar\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),/'\/studio\/board-topbar\.js'/);
});

test('«사람» is 3D-only: flat boards draw the uniform, the bar offers 유니폼 · 원형 (+ 사람 in 3D)',()=>{
  assert.equal(tb.shapeShown('person',false),'shirt');assert.equal(tb.shapeShown('person',true),'person');assert.equal(tb.shapeShown('circle',false),'circle');
  const b=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  assert.doesNotMatch(b,/PERSON_BUST_D/,'no flat upper-body figure any more');
  assert.match(b,/\}else if\(\(tokShape==="shirt"\|\|tokShape==="person"\)&&!p\.coach&&!p\.shaper\)\{/);
  assert.match(tb.css(),/body:not\(\.bc-tilt3d\) #shapeSeg button\[data-s="person"\]\{display:none!important\}/);
});

test('3.079 — pattern-book keeps its page strip folded (the bar must not re-show it)',()=>{
  assert.match(tb.css(),/body\.book-mode:not\(\.focus-board\):not\(\.vault-full\):not\(\.ps-phone-work\):not\(\.ps-dock\) #boardPageStrip\.ps-tb(:not\(#tb\d\)){20}\{display:none!important\}/);
});

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
  assert.deepEqual(g.right.map(x=>x.id),['boardManualSave','bpBoardSettings','vaultSave'],'3.017 — settings right after save');
});
test('view switch reads 평면 · 3D (3.096 — 중계는 뺐다: 옛 tv 값도 3D)',()=>{
  assert.equal(tb.viewOf(false,'tv'),'flat');assert.equal(tb.viewOf(true,'mid'),'3d');assert.equal(tb.viewOf(true,'tv'),'3d');
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
  assert.match(b,/function _realTokS\(p\)\{ if\(!\(_realScaleOn\(\)\|\|typeof tokShape!=="undefined"&&tokShape==="person"\)\|\|!p\|\|!document\.body\.classList\.contains\("bc-tilt3d"\)\)return 0;/);
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
test('3.083 — no resize loop when the bar cannot build (community viewer), clears the vault edit header and the formation door',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../studio/board-topbar.js'),'utf8');
  assert.match(src,/if \(s\.classList\.contains\('ps-tb'\) !== was\) win\.setTimeout\(function \(\) \{ try \{ win\.dispatchEvent\(new win\.Event\('resize'\)\)/);
  assert.doesNotMatch(src,/else unbuild\(\); try \{ win\.dispatchEvent/);
  const css=tb.css();
  /* 3.309 — 띠는 무대 위 제 줄: vcreating 의 top:56px 는 걷었고(#boardView padding-top 56), 문(#ehDoor)은 헤더 안의 주 단추(무대 안 top 규칙은 없다) */
  assert.doesNotMatch(css,/body\.ps-dock-float\.vcreating #boardPageStrip\.ps-tb[^{]*\{top:56px!important\}/);
  assert.doesNotMatch(css,/body\.ps-dock-float #ehDoor\{top:14px!important\}/);
  assert.match(css,/#boardPageStrip\.ps-tb(:not\(#tb\d\)){10} #ehDoor\{position:static!important;/);
});
test('3.309 — no centre group any more (평면 · 3D · 선수 모양 · 실제 크기 · 선수 시점 live in 보드 설정 — user «평면과 3d 설정이 밖에 나올 필요 있을까»); «보드 설정» is a text button',()=>{
  const css=tb.css(),src=fs.readFileSync(path.join(__dirname,'../studio/board-topbar.js'),'utf8');
  assert.doesNotMatch(css,/\.tb-mid>\.tb-c/);assert.doesNotMatch(css,/\.tb-seg/);assert.doesNotMatch(css,/\.tb-grip/);
  assert.doesNotMatch(src,/mk\('div', 'tb-g tb-c'\)/);assert.doesNotMatch(src,/function draggableToolbar/);assert.doesNotMatch(src,/data-v="flat"/);assert.doesNotMatch(src,/class="tb-rsize"/);assert.doesNotMatch(src,/PSPlayerEye\.button\(\)/);
  assert.match(src,/s\.appendChild\(L\); s\.appendChild\(R\);/,'왼쪽 · 오른쪽 덩어리만');
  assert.match(css,/body:not\(\.bc-tilt3d\) #shapeSeg button\[data-s="person"\]\{display:none!important\}/,'보드 설정의 «사람»은 3D 에서만 — 그대로');
  assert.match(css,/#bpBoardSettings svg\{display:none!important\}/);assert.match(css,/#bpBoardSettings>span\{display:inline!important\}/);assert.doesNotMatch(css,/#bpBoardSettings\{width:28px!important/);
});
test('3.083 — the floating dock is hidden on the vault list (no board, editor, creation or meeting on screen)',()=>{
  const df=require('../studio/board-dock-float.js');const css=(df.css?df.css():fs.readFileSync(path.join(__dirname,'../studio/board-dock-float.js'),'utf8'));
  assert.match(fs.readFileSync(path.join(__dirname,'../studio/board-dock-float.js'),'utf8'),/body\.ps-dock-float:not\(\.board-view\):not\(\.editing\):not\(\.vcreating\):not\(\.meet-mode\):not\(\.focus-board\) /);
  void css;
});
test('3.304 — vault full screen is the show-it-on-the-TV view: the strip (page tabs · view options · right tools) is taken away, the pager moves off the dock',()=>{
  const css=tb.css();
  assert.match(css,/html\.ps-page-board body\.vault-full #boardPageStrip(:not\(#tb\d\)){20}\{display:none!important\}/,'as strong as the bar\'s own display:flex!important — the plain board.html rule lost to it');
  assert.match(css,/html body\.vault-full\.vcreating #vvPg\{left:12px!important;right:auto!important;top:12px!important;bottom:auto!important;transform:none!important\}/,'while creating · editing the dock stays (1.992) — the pager must not sit on it');
  assert.doesNotMatch(css,/body\.vault-full:not\(\.vcreating\) #vvPg/,'the read-only view keeps its bottom pager (no dock there)');
  assert.match(fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8'),/body\.vault-full #boardPageStrip\{display:none;\}/,'the original intent is still written in the board');
  assert.ok(fs.readFileSync(path.join(__dirname,'browser','run-critical.mjs'),'utf8').includes("'board-tv-clean-3304'"));
});

/* 3.306 — 사용자 11/16 «하단도구 접기 누르면 상단에 있는 것도 같이 접히는걸로 해줘» */
test('3.306 — the dock\'s «도구 접기» folds the top bar too: same strength as the bar\'s own rule, phone strips and the vault editor\'s title bar left alone',()=>{
  const c=tb.css();
  assert.match(c,/html\.ps-page-board body\.cmd-dock-folded:not\(\.ps-dock\):not\(\.ps-phone-work\) #boardPageStrip\.ps-tb(:not\(#tb\d\)){20}\{display:none!important\}/,'N+N — beats the bar\'s display:flex!important');
  assert.match(c,/body\.cmd-dock-folded:not\(\.ps-dock\):not\(\.ps-phone-work\) #ps-tb-menu\.on\{display:none\}/,'an open «보드 ▾» menu does not stay behind');
  assert.doesNotMatch(c,/cmd-dock-folded[^{]*#vCreateBar/,'save · exit of the vault editor stay reachable (the fold persists across reloads)');
  assert.doesNotMatch(c,/cmd-dock-folded[^{]*#(board|boardStage)\b/,'the pitch itself is never hidden or moved — the bar is an overlay');
  const b=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  assert.match(b,/function apply\(on,save\)\{ document\.body\.classList\.toggle\("cmd-dock-folded",!!on\);/,'one class drives both — the pill «도구 펼치기» · ⌘. bring both back');
  assert.ok(fs.readFileSync(path.join(__dirname,'browser/run-critical.mjs'),'utf8').includes("'board-fold-top-3306'"));
});

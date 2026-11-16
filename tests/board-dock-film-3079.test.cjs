'use strict';
/* 3.079 — 레이아웃 2단계: 장면 줄 + 도구 = 한 덩어리 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const fm=require('../studio/board-dock-film.js'),sk=require('../studio/board-dock-skin.js');
test('scene time = hold + move to the next scene (1 / speed); the last scene only holds',()=>{
  const fr=[{},{moveSpeed:2},{dur:1,moveSpeed:.5},{}];
  assert.equal(fm.sceneSecs(fr,0,.6),1.6);assert.equal(fm.sceneSecs(fr,1,.6),1.1);assert.equal(fm.sceneSecs(fr,2,.6),2.6);assert.equal(fm.sceneSecs(fr,3,.6),.6);
  assert.equal(fm.sceneSecs(fr,0,0),1.6,'hold falls back to 0.6 like the board');assert.equal(fm.sceneSecs(fr,0,.1),1.1,'0.1s hold (3.085 — user «0.1초까지»)');assert.equal(fm.sceneSecs(fr,0,.05),1.1,'hold at least 0.1');
  assert.equal(fm.sceneSecs(fr,0,.6,()=>2),1.1,'the board\'s own speed lookup wins');assert.equal(fm.sceneSecs(fr,9,.6),0);
  assert.equal(fm.fmtSecs(1.1),'1.1초');assert.equal(fm.fmtSecs(2),'2.0초');
});
test('one card: the dock carries the glass, both rows are see-through, the film row only when scenes are shown',()=>{
  const c=fm.css();
  assert.match(c,/body\.ps-dock-float #ps-command-dock(:not\(#fm\d+\)){16}>#animBar,/,'rows transparent');
  assert.match(c,/body\.ps-dock-float:not\(\.ps-df-anim-off\):not\(\.cmd-dock-folded\) #ps-command-dock/,'film row rules never re-show a hidden or folded scene row');
  assert.doesNotMatch(c,/#animFrames>\.anim-frame\{[^}]*margin/,'no margin on chips (the stage-start gap stays)');
  assert.match(c,/#animFrames>\.anim-frame \.aft\{display:none!important\}/,'3.304 — number chips: the picture cell is never shown');
  assert.match(sk.skinCSS('glass'),/#ps-command-dock(:not\(#lx\d+\)){14}\{background:linear-gradient/,'skin glass on the dock itself');
  assert.doesNotMatch(sk.skinCSS('glass'),/#cmd-tool-row,[^{]*>#animBar\{background/,'not on the two rows any more');
});
test('wiring: script tag after the top bar, offline cache',()=>{
  assert.match(fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8'),/<script src="board-topbar\.js"><\/script><script src="board-dock-film\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),/'\/studio\/board-dock-film\.js'/);
});
/* 3.304 — 기대를 일부러 고침: 장면 칩의 그림(3.079 — PNG 로 구워 깔던 것)을 뺐다. 사용자 «애니메이션에 썸네일은 필요없고». */
test('3.304 — scene chips are number chips: no picture, no picture work',()=>{
  const c=fm.css(),src=fs.readFileSync(path.join(__dirname,'../studio/board-dock-film.js'),'utf8');
  assert.equal(fm.fitThumb,undefined,'the thumbnail fitter is gone');
  assert.match(c,/#animFrames>\.anim-frame\{[^}]*flex:0 0 38px!important[^}]*height:34px!important/,'a compact chip');
  assert.match(c,/#animFrames>\.anim-frame\.on\{flex:0 0 58px!important/,'the current scene is wider (room for its ⋯ menu)');
  assert.match(c,/#animFrames>\.anim-frame \.afi\{position:static!important[^}]*font:800 13px\/1/,'the number is the chip');
  assert.match(c,/#animFrames>\.anim-frame \.df-dur\{position:static!important/,'the time sits under it');
  assert.doesNotMatch(c,/df-thumb|#2f6e3a/,'no picture rules, no pitch-green chip');
  assert.doesNotMatch(src,/createObjectURL|toBlob|thumbView|df-thumb/,'nothing bakes or shows a scene picture');
  assert.match(src,/var aft = c\.querySelector\('\.aft'\); if \(aft && aft\.firstChild\) aft\.textContent = '';/,'the picture cell is emptied');
});
test('3.304 — the board\'s scene-picture pass (__afWindow) is skipped only while the floating dock is on, and never edits a frame',()=>{
  const cls=new Set(['ps-dock-float']),calls=[];
  const doc={body:{classList:{contains:c=>cls.has(c)}},head:{appendChild(){}},createElement:()=>({}),getElementById:()=>null};
  const orig=function(force){calls.push(force);return 'orig';};
  const win={document:doc,__afWindow:orig,addEventListener(){},MutationObserver:function(){this.observe=()=>{};},setTimeout(){return 0;},requestAnimationFrame(){return 0;},WeakMap};
  assert.ok(fm.install(win));
  assert.notEqual(win.__afWindow,orig,'wrapped');
  assert.equal(win.__afWindow(true),undefined);assert.deepEqual(calls,[],'floating dock: no fill, no __snapToThumb board swaps');
  cls.delete('ps-dock-float');
  assert.equal(win.__afWindow(true),'orig');assert.deepEqual(calls,[true],'the old strip (narrow window · phone dock) still gets its pictures');
  cls.add('ps-dock-float');win.__afWindow();assert.deepEqual(calls,[true]);
  const again=win.__afWindow;doc.body.__psDockFilm=false;fm.install(win);assert.equal(win.__afWindow,again,'never wrapped twice');
});

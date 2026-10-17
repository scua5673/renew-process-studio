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
  assert.match(c,/\.aft>svg\{/,'only the thumbnail root svg is sized, not the ball inside');
  assert.match(sk.skinCSS('glass'),/#ps-command-dock(:not\(#lx\d+\)){14}\{background:linear-gradient/,'skin glass on the dock itself');
  assert.doesNotMatch(sk.skinCSS('glass'),/#cmd-tool-row,[^{]*>#animBar\{background/,'not on the two rows any more');
});
test('wiring: script tag after the top bar, offline cache',()=>{
  assert.match(fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8'),/<script src="board-topbar\.js"><\/script><script src="board-dock-film\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),/'\/studio\/board-dock-film\.js'/);
});
test('thumbnails: wide boards fill the chip with the whole pitch, tall boards are not cropped',()=>{
  const w=fm.fitThumb('<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 50 30" data-psvb="0 0 1110 740" preserveAspectRatio="xMidYMid meet"><g/></svg>');
  assert.match(w,/viewBox="0 0 1110 740"/);assert.match(w,/preserveAspectRatio="xMidYMid slice"/);assert.equal((w.match(/preserveAspectRatio=/g)||[]).length,1);assert.match(w,/<g\/><\/svg>$/);
  const t=fm.fitThumb('<svg viewBox="1 2 3 4" data-psvb="0 0 740 1110"><g/></svg>');
  assert.match(t,/viewBox="0 0 740 1110"/,'tall board shows the whole pitch');assert.match(t,/xMidYMid meet/,'and is not cropped');
  const n=fm.fitThumb('<svg viewBox="0 0 1110 740"><g/></svg>');assert.match(n,/xMidYMid slice/,'wide board without data-psvb still fills the chip');
  assert.match(fm.fitThumb('<svg width="9" viewBox="0 0 1110 740"><g/></svg>',156,92),/^<svg width="156" height="92" /,'raster viewport');
  assert.equal(fm.fitThumb(''),'');assert.equal(fm.fitThumb('nope'),'nope');
  assert.match(fm.css(),/\.aft>svg\{display:none!important\}/,'the inline svg is never laid out in the film row');
});

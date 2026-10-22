const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
const scout=fs.readFileSync(path.join(__dirname,'..','studio','scout.html'),'utf8');

test('3.011 오류 제보 f9cff618 — «크게 보기» sizes the picture after the title and notes are in',()=>{
  const fn=/function mmBigOpen\(m\)\{[\s\S]*?\n\}\n/.exec(scout);assert.ok(fn,'mmBigOpen');
  const show=/function show\(\)\{[\s\S]*?\n    fit\(\); \}/.exec(fn[0]);assert.ok(show,'show() ends with fit()');
  assert.ok(show[0].indexOf('.mb-cap .p')<show[0].lastIndexOf('fit();'),'notes are filled before the picture box is measured');
  assert.ok(!/host\.innerHTML='<div class="mmv-nothumb">'[^\n]*\} fit\(\);/.test(show[0]),'no early fit() before the caption');
  assert.match(fn[0],/ro=new ResizeObserver\(function\(\)\{ fit\(\); \}\); ro\.observe\(ov\.querySelector\("\.mb-stage"\)\);/,'refits when the stage changes');
  assert.match(fn[0],/if\(ro\)ro\.disconnect\(\);/,'the observer goes with the dialog');
});

test('3.011 오류 제보 f9cff618 — slideshow title, notes and scene captions keep the pitch ratio',()=>{
  for(const r of ['body.focus-board #ksHead{transform:translateX(-50%) scale(var(--ks-k,1));transform-origin:50% 0;}',
    'body.focus-board #ksOv{transform:scale(var(--ks-k,1));transform-origin:0 0;}',
    'body.focus-board #animCapBar{transform:translateX(-50%) scale(var(--ks-k,1));transform-origin:50% 100%;}'])
    assert.ok(board.includes(r),r);
  const fn=/function ksScale\(\)\{[\s\S]*?\n  \}catch\(_\)\{\} \}/.exec(board);assert.ok(fn,'ksScale');
  assert.match(board,/var KS_REF_W=1600,KS_REF_H=840,ksRaf=0;/,'PC stage reference');
  assert.match(fn[0],/if\(!b\.classList\.contains\("focus-board"\)\|\|phone\)\{ if\(b\.style\.getPropertyValue\("--ks-k"\)\)b\.style\.removeProperty\("--ks-k"\); return; \}/,'only while presenting, never on the phone layout');
  assert.match(fn[0],/var pb=window\.__pvBox, bw=\(pb&&pb\[2\]>0\)\?pb\[2\]:vb\[2\], bh=\(pb&&pb\[3\]>0\)\?pb\[3\]:vb\[3\];/,'the shown pitch range — direction and half view');
  assert.match(fn[0],/var k=Math\.max\(\.8,Math\.min\(1\.4,s\/ref\)\)/,'kept readable');
  assert.match(board,/document\.body\.classList\.toggle\("focus-board",on\);try\{window\.__ksScale&&window\.__ksScale\(\);\}catch\(_\)\{\}/,'measured on entering and leaving');
  assert.match(board,/headSync\(f\); ksScaleSoon\(\); \}/,'and on every slide');
  assert.match(board,/new MutationObserver\(ksScaleSoon\)\.observe\(_ksb,\{attributes:true,attributeFilter:\["viewBox"\]\}\)/,'and when the board refits');
});

test('3.011 — the A4 preview load does not read slide -1 while the slideshow starts',()=>{
  assert.match(board,/!communityBoardReadOnly\(\)&&anim\.slides\[index\]&&!\(anim\.slides\[index\]\.points\|\|\[\]\)\.some/);
});

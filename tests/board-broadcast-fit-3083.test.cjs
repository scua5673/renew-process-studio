// 3.083 — 중계 카메라: 실제로 재서 맞추기 · 판 상자 크기는 important · 기준 배율 고정 · 운동장 전체를 담는다
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../studio/board-broadcast.js'),'utf8');
const insp=fs.readFileSync(path.join(__dirname,'../studio/board-inspector.js'),'utf8');
test('camera box wins over the 3D width rule and is re-applied when the board clears it',()=>{
  assert.match(src,/svg\.style\.setProperty\(n, css\[n\], 'important'\)/);
  assert.match(src,/var stale = svg\.style\.getPropertyValue\('width'\) !== W \+ 'px'/);
});
test('base zoom is measured once per stage size (no 1.31 ↔ 1.42 ping-pong)',()=>{
  assert.match(src,/if \(st\.bkey !== bkey \|\| !st\.base\) \{ st\.base = Math\.min\(sw \/ vb\.width, sh \/ vb\.height\); st\.bkey = bkey; \}/);
});
test('fit measures the pitch lines and players on screen and corrects zoom and aim',()=>{
  assert.match(src,/r = typeof PR === 'function' \? PR\(\) : null/);
  assert.match(src,/function fit\(\)/);
  assert.match(src,/var scaleOk = sc >= 1 && sc <= 1\.08/);
  assert.match(src,/var TV = \{ ax: 46, yaw: 0,/);
  assert.doesNotMatch(src,/__fitLog|__tvDbg/);
});
test('inspector top goes through a CSS variable (the 2.607 watcher clears inline top)',()=>{
  assert.match(insp,/top:var\(--ps-insp-top,76px\)!important/);
  assert.match(insp,/de\.style\.setProperty\('--ps-insp-top', top \+ 'px'\)/);
  assert.doesNotMatch(insp,/ctl\.style\.setProperty\('top'/);
});

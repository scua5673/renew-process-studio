const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const notes=require('../studio/release-notes.js');

/* 3.022 · 3.023 — 사용자 «프로세스 스튜디오 처음 들어왔을 때 기본이 3D» · «훈련 만들기에서 그리드 누르면 옆에 전광판 관중석 다 사라지게» */
test('3.022 a device entering for the first time opens the board in 3D; a device that chose flat stays flat',()=>{
  const app=R('studio/app.html');
  assert.match(app,/try\{if\(localStorage\.getItem\('ps_board_tilt3d'\)===null\)localStorage\.setItem\('ps_board_tilt3d','1'\);\}catch\(_\)\{\}/,'only when nothing was chosen yet');
  assert.ok(app.indexOf("localStorage.getItem('ps_board_tilt3d')===null")<app.indexOf('id="fBoard"'),'set before the board frame loads');
  assert.match(R('studio/board.html'),/try\{ if\(localStorage\.getItem\("ps_board_tilt3d"\)==="1"\)\{ document\.body\.classList\.add\("bc-tilt3d"\);/,'the board boots in 3D on «1»');
  assert.match(R('tests/fixtures/team-app.mjs'),/if\(tilt3d!==null\)localStorage\.setItem\('ps_board_tilt3d',tilt3d\?'1':'0'\);/,'shared fixture stays flat unless a test asks for a first-time device');
});

test('3.022 a grid board draws the 3D stadium as grass only, without changing the saved setting',()=>{
  const b=R('studio/board.html');
  assert.match(b,/function tiltDecoNow\(\)\{ var t3=window\.__tilt3d\|\|\{\}; try\{ if\(isBlankSpec\(\)\)return "grass"; \}catch\(_\)\{\} return TILT_PAD\[t3\.deco\]\?t3\.deco:"full"; \}/);
  assert.match(b,/const t3=window\.__tilt3d\|\|\{\},deco=tiltDecoNow\(\),ad=/,'stadium picture');
  assert.match(b,/var t3=window\.__tilt3d\|\|\{\},deco=tiltDecoNow\(\),pads=TILT_PAD\[deco\]\|\|TILT_PAD\.full;/,'fit margins follow, so the grid board grows');
  assert.match(b,/svg\.getAttribute\("preserveAspectRatio"\),t3\.cam,deco,/,'the fit key changes with the board');
  assert.match(b,/window\.__setBoardSurface=function\(kind\)\{\n  if\(kind==="grid"\)\{ if\(isBlankSpec\(\)\)return;[\s\S]*?window\.__setPitchSpec\("grid"\+m\);/,'훈련 만들기 «바탕 › 그리드» is a grid board');
});

test('3.022 first-boot tuning closes the view menu only when it is open (it used to re-open it)',()=>{
  const app=R('studio/app.html');
  assert.match(app,/setTimeout\(function\(\)\{ try\{ var vm=doc\.getElementById\('viewMenu'\),w=doc\.defaultView; if\(vm&&vm\.classList\.contains\('on'\)\)\{ if\(w&&w\.__psBoardPopover&&w\.__psBoardPopover\.close\)w\.__psBoardPopover\.close\(\); else view\.click\(\); \} \}catch\(e\)\{\} \}, 150\);/);
  assert.doesNotMatch(app,/setTimeout\(function\(\)\{ try\{ view\.click\(\); \}catch\(e\)\{\} \}, 150\);/,'no blind toggle at the end');
});

test('3.023 five pitches: the 3D stadium wraps the whole card layout, thickness stays one-pitch',()=>{
  const b=R('studio/board.html');
  assert.match(b,/if\(multi\)\{ try\{ const rs=\[\.\.\.svg\.querySelectorAll\('#ps-multipitch \[data-pitch-rect\]'\)\]/,'cards from #ps-multipitch');
  assert.match(b,/S=multi\?Math\.min\(PW,PH\*105\/68\):PW,/,'thickness and spacing measured on one pitch');
  assert.match(b,/const gx=S\*\.068,gy=PH\*\.095,r0=S\*\.075,bt=S\*\.0105,tk=S\*\.028,sd=S\*\.34;/);
  assert.match(b,/const lenX=PW\+2\*gx-2\*r0,lenY=PH\+2\*gy-2\*r0,/,'edges still run the full layout');
  assert.match(b,/if\(\(state\.pitchN\|\|1\)>1&&deco!=="grass"\)pads=\[pads\[0\],pads\[1\],pads\[2\]\+\.03\];/,'a little more side room for the wide layout');
});

test('3.022 release note',()=>{
  const e=notes.entries().find(x=>x.id==='2026-10-14-v3-022-3d-default');
  assert.ok(e,'3.022 note');
  assert.ok(e.changes.some(c=>/3D 보기로 열립니다/.test(c)&&/«평면»/.test(c))&&e.changes.some(c=>/«그리드»/.test(c)&&/잔디만/.test(c)));
});

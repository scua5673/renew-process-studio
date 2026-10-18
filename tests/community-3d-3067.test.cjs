'use strict';
/* 3.067 — 커뮤니티 뷰어 «3D» 단추(사용자 «엘미하가 올린거 핸드폰에서 3d로 보기») · 폰 세로로 재생하면 판이 가로로 작아지던 것. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
test('뷰어의 3D 는 설정 값을 건드리지 않고 켠다 — 3.087 «보기» 고르개(board-comm-look.js)',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','studio','board-comm-look.js'),'utf8');
  assert.match(src,/win\.__commTilt = true; win\.__setTilt\(!!on, \{ transient: true, quiet: true \}\)/);
  assert.match(board,/try\{PSCommLook\.mount\(window\);\}catch\(_\)\{\}/,'글을 다 실은 뒤 고르개');
});
test('뷰어를 닫거나 다른 탭으로 가면 뷰어가 켠 3D 를 끈다 — 보드 설정 복원(3.035)보다 먼저',()=>{
  assert.match(board,/function __commTiltOff\(\)\{[^\n]*\n  if\(window\.__commTilt\)\{ window\.__commTilt=false; if\(document\.body\.classList\.contains\("bc-tilt3d"\)&&window\.__setTilt\)window\.__setTilt\(false,\{transient:true,quiet:true\}\);/);
  const off=board.indexOf('__commTiltOff();   /* 3.067 — 아래 3.035 복원보다 먼저 */'),restore=board.indexOf('var _etp=window.__edTiltPrev; window.__edTiltPrev=false;');
  assert.ok(off>0&&restore>off);
  const pv=board.indexOf('window.__commPrepView=function(');assert.ok(board.indexOf('__commTiltOff();',pv)<board.indexOf('}catch(_){} };',pv));
});
test('폰 커뮤니티 뷰어의 3D 는 운동장 여백을 줄인다',()=>{
  assert.match(board,/if\(commViewTok\(\)>1\)pads=\[Math\.min\(pads\[0\],\.05\),Math\.min\(pads\[1\],\.04\),Math\.min\(pads\[2\],\.015\)\];/);
});
test('뷰어의 판 방향은 스냅 · 재생 장면이 되돌리지 않는다',()=>{
  const ls=board.indexOf('function loadSnap(s,opts){');assert.ok(ls>0);
  assert.ok(board.slice(ls,ls+3000).includes('var _cwo=window.__commWantOrient; if(_cwo&&document.body.classList.contains("comm-viewing")){ state.orientation=_cwo;'));
  assert.ok(board.includes('var _cwo2=window.__commWantOrient; if(_cwo2&&document.body.classList.contains("comm-viewing")){ state.orientation=_cwo2;'));
  assert.match(board,/window\.__commWantOrient=null; if\(window\.innerWidth<=600&&!editMode\)\{ state\.orientation="v"; state\.spFlip=false; window\.__commWantOrient="v"; \}/);
});

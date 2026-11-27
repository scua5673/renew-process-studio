'use strict';
/* 3.320 — ① 토큰이 작전판(보이는 판 · 여백 포함) 밖으로 나가지 않는다(board-bounds.js). ② 훈련 편집기 «선수 불러오기» 토큰 세 칸 더 · 장비도.
   화면 흐름은 tests/browser/board-bounds-3320. 여기서는 모듈 수학과 board.html 배선을 본다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const B=require('../studio/board-bounds.js');
const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8'),sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
const W={__psBoardBox:[-50,-20,1150,720]};   /* 운동장 1050×680 + 여백 */

test('clampTo — 판 안은 그대로, 밖은 가장자리(토큰 원이 다 보이는 자리)로, 판이 토큰보다 작으면 가운데',()=>{
  assert.deepEqual(B.clampTo({x:300,y:300},10,W),{x:300,y:300});
  assert.deepEqual(B.clampTo({x:-900,y:300},10,W),{x:-40,y:300});
  assert.deepEqual(B.clampTo({x:5000,y:-800},10,W),{x:1090,y:-10});
  assert.deepEqual(B.clampTo({x:5000,y:5000},0,W),{x:1100,y:700},'반지름 0 이면 판 가장자리까지');
  assert.deepEqual(B.clampTo({x:9,y:9},200,{__psBoardBox:[0,0,100,100]}),{x:50,y:50},'판이 토큰보다 작으면 가운데');
  assert.deepEqual(B.clampTo({x:-900,y:300},10,{}),{x:-900,y:300},'판을 모르면 손대지 않는다');
  assert.equal(B.clampTo(null,10,W),null);
});

test('clampDelta — 묶음을 같은 거리로 옮길 때 하나도 밖으로 안 나가게 dx·dy 를 자른다',()=>{
  const r=()=>10;
  assert.deepEqual(B.clampDelta([{x:100,y:100},{x:1000,y:600}],500,300,r,W),{x:90,y:90},'오른쪽 끝 토큰이 먼저 걸린다');
  assert.deepEqual(B.clampDelta([{x:100,y:100},{x:1000,y:600}],-500,-300,r,W),{x:-140,y:-110},'왼쪽 끝 토큰이 먼저 걸린다');
  assert.deepEqual(B.clampDelta([{x:100,y:100}],5,-5,r,W),{x:5,y:-5},'안에서는 그대로');
  assert.deepEqual(B.clampDelta([],500,300,r,W),{x:500,y:300},'토큰이 없으면(그림만) 그대로');
  assert.deepEqual(B.clampDelta([{x:-2000,y:300},{x:900,y:300}],-50,0,r,W),{x:-50,y:0},'이미 밖에 있던 묶음은 막지 않는다');
  assert.deepEqual(B.clampDelta([{x:-2000,y:300}],-50,0,r,W),{x:1960,y:0},'밖에 있는 토큰 하나는 안으로만');
  assert.deepEqual(B.clampDelta([{x:100,y:100}],500,0,r,{}),{x:500,y:0},'판을 모르면 손대지 않는다');
});

test('board.html 배선 — 모듈 로드 · 판 적기 · 끌기 · 묶음 끌기 · 방향키',()=>{
  assert.match(board,/<script src="board-vault-draft\.js"><\/script><script src="board-bounds\.js"><\/script>/);
  assert.match(sw,/'\/studio\/board-bounds\.js'/,'sw 가 미리 받는다');
  assert.match(board,/FILL_X=fx;FILL_Y=fy;FILL_W=fw;FILL_H=fh;\{var _wb=worldBounds\(\);window\.__psBoardBox=\[_wb\.minX,_wb\.minY,_wb\.maxX-_wb\.minX,_wb\.maxY-_wb\.minY\];\}/,'판은 운동장 좌표(worldBounds — 세로 보기 보정)');
  assert.match(board,/PSBoardBounds\.clampTo\(s,21\*_tokScaleOf\(p\)\);\s*\/\*[^*]*\*\/\n\s*p\.x=s\.x;p\.y=s\.y;if\(kind==="ball"\)/,'끌기: 자른 뒤에 넣는다');
  assert.match(board,/const _cb=PSBoardBounds\.clampDelta\(grp\.filter\(it=>!it\.draw&&!it\.locked\)\.map\(it=>\(\{x:it\.x0,y:it\.y0,o:it\.o\}\)\),dx,dy,q=>21\*_tokScaleOf\(q\.o\)\);dx=_cb\.x;dy=_cb\.y;/,'묶음 끌기: 그림은 안 세고 토큰 출발 자리로');
  assert.match(board,/var _cb=PSBoardBounds\.clampDelta\(_items\.filter\(function\(o\)\{return typeOfItem\(o\)!=="drawing";\}\)\.map\(function\(o\)\{return \{x:o\.x,y:o\.y,o:o\};\}\),_dx,_dy,function\(q\)\{return 21\*_tokScaleOf\(q\.o\);\}\);_dx=_cb\.x;_dy=_cb\.y;/,'방향키: 세로 보기 보정 뒤에 자른다');
  const nudge=board.indexOf('_dx=_cb.x;_dy=_cb.y;'),push=board.indexOf('if(!window.__nudgeT)pushUndo();');
  assert.ok(nudge>0&&push>nudge,'자르기가 pushUndo 앞');
});

test('선수 불러오기는 어디서나 [3]×0.68(3.382 — 편집기가 저장한 크기 그대로 그려서 화면 · 인쇄가 한 크기) · 판 위 자리에 입힐 땐 그대로 · 편집기 장비 놓기도 같은 함수',()=>{
  assert.match(board,/var LOAD_TOK_STEP=3,LOAD_TOK_K=0\.68;\nfunction _editorTokBoost\(\)\{var L=tokScaleLevels\(\),t=Math\.round\(L\[LOAD_TOK_STEP\]\*LOAD_TOK_K\*100\)\/100;if\(\(state\.tokenScale\|\|L\[0\]\)<t-0\.001\)state\.tokenScale=t;\}/);
  /* 3.382 — 편집기의 화면용 ×0.68(2.705)과 썸네일 · 내보내기의 ×1/0.68 보정이 없다(사용자 «출력될때와 훈련만들기 보드에서 토큰 크기가 다르게 보여» → «화면 크기로») */
  assert.match(board,/function _normTokS\(p\)\{const _cv=commViewTok\(\);const _ed=_cv\?_cv:1;/,'편집기도 저장한 크기 그대로 그린다');
  assert.match(board,/function _tokScaleOf\(p\)\{[^\n]*\n\s*var _cv=commViewTok\(\);var _ed=_cv\?_cv:1;/,'잡는 자리도 같은 크기');
  assert.doesNotMatch(board,/scale\("?\+\(1\/0\.68\)|scale\('\+\(1\/0\.68\)/,'썸네일 · 내보내기의 되돌리기 보정이 없다');
  assert.doesNotMatch(board,/\?0\.68:1/,'편집기 화면 배수가 남지 않았다');
  assert.match(board,/try\{ if\(!opts\.boardToks\)_editorTokBoost\(\); \}catch\(_\)\{\}/,'개인 선수단(applySquadToBoard) — 편집기 · 작전판 같은 칸');
  assert.doesNotMatch(board,/_tl\[document\.body\.classList\.contains\("editing"\)\?1:2\]/,'편집기 · 작전판 칸을 따로 두지 않는다');
  assert.match(board,/state\.equipment\.push\(\{id:uid\+\+,team:val,x:u\.x,y:u\.y,color:_ec,src:\(extra&&extra\.src\)\|\|null\}\);if\(document\.body\.classList\.contains\("editing"\)\)_editorTokBoost\(\);/);
  assert.match(board,/pushUndo\(\);if\(!cur\.length\)_editorTokBoost\(\);[^\n]*\n\s*PSTeamLoad\.kit\(state,t\.kit,side,KIT_PATS\);/,'저장 팀 불러오기 — 새로 올릴 때만');
  const imp=fs.readFileSync(path.join(__dirname,'../studio/board-scout-import.js'),'utf8');
  assert.match(imp,/win\.pushUndo\(\);cur\.forEach\(function\(p,i\)\{L\.dress\(p,list\[plan\.pick\[i\]\]\);\}\);\n\s*if\(!cur\.length&&typeof win\._editorTokBoost==='function'\)win\._editorTokBoost\(\);/,'팀 명단 창(board-scout-import apply)도 편집기 · 작전판에서 새로 올릴 때 같은 칸');
  assert.match(board,/function tokScaleLevels\(\)\{[^\n]*return \[b,b\*1\.25,o,o\*1\.25,o\*1\.55,o\*1\.9,o\*2\.3\];/,'사다리 7단 — [3] 은 예전 기본 ×1.25');
});

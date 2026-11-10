'use strict';
/* 3.271 — 제보 0033117a «토큰 포지션 관련»: «토큰을 우클릭할 시, 이름과 번호처럼 포지션은 한번 더 클릭하지 않아도 바로 나와야».
   포지션 고르개(#posCtl · #posSel — 원래 요소, 저장 · 되돌리기는 board.html 의 change 처리기 그대로)를 접힌 «주발 · 장면»에서
   이름 · 번호 줄(.ps-sm-identity)로 옮긴다. 실제 판은 tests/browser/board-position-direct-3271.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const js=read('studio/board-selection-menu.js'),css=read('studio/board-selection-menu.css'),b=read('studio/board.html');

test('포지션 고르개는 이름 · 번호와 같은 줄에 — 원래 요소를 옮길 뿐 새로 만들지 않는다',()=>{
  assert.match(js,/label\('이름',identity\);label\('번호',identity\);var posLabel=label\('포지션',identity\);/,'이름 · 번호 · 포지션 이름표');
  assert.match(js,/\['nameCtl','numCtl','posCtl'\]\.forEach\(id=>move\(id,/,'한 명이면 identity 로(여럿이면 예전 자리)');
  assert.doesNotMatch(js,/createElement\('select'\)|el\('select'/,'select 를 새로 만들지 않는다');
  assert.doesNotMatch(js,/(?<!dataset)\.pos\s*=[^=]|psSyncTokenAll|pushUndo/,'저장 · 되돌리기는 원래 처리기 몫');
  assert.equal((b.match(/id="posSel"/g)||[]).length,1);
  assert.match(b,/ps\.addEventListener\("change",function\(\)\{ var v=ps\.value; if\(v==="__mixed"\)return; var ts=selectedPlayers\(false\); if\(!ts\.length\)return; try\{pushUndo\(\);\}catch\(_\)\{\}/,'원래 처리기: 되돌리기 기록 → 모든 장면 · 페이지 → 저장');
});

test('접힌 칸 이름에서 «포지션»을 뺀다 · 포지션이 없는 토큰(코치)은 두 칸 그대로',()=>{
  assert.match(js,/text\(summary,many\?'반전 · 겹침 순서 · 장면':'주발 · 장면'\)/);
  assert.doesNotMatch(js,/'포지션 · 주발 · 장면'/);
  assert.match(js,/identity\.dataset\.pos/,'포지션 칸이 있을 때만 세 칸');
  assert.match(js,/hide\(posLabel,/);
});

test('세 칸 격자 — 넓은 화면 · 폰 아래 시트 둘 다',()=>{
  const root=css.match(/\.ps-selection-menu(?::not\(#sm\d+\))+/)[0],flat=css.split(root).join('§');
  assert.match(flat,/§ \.ps-sm-identity\[data-pos=true\]\{grid-template-columns:minmax\(0,1fr\) \d+px \d+px\}/);
  assert.match(flat,/§\.ps-sm-mobile \.ps-sm-identity\[data-pos=true\]\{grid-template-columns:minmax\(0,1fr\) \d+px \d+px\}/,'폰 시트는 글자가 16px 이라 더 넓게');
  assert.match(flat,/§ #nameCtl,§ #numCtl,§ #posCtl\{/,'세 칸이 같은 모양');
});

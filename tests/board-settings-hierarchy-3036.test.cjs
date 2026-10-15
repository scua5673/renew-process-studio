'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const board=R('studio/board.html');
const notes=require('../studio/release-notes.js');

/* 3.037(3.036 으로 준비했다가 #403 이 먼저 3.036 을 써서 판을 올렸다) — 사용자 «보드 설정 위계를 잘 만들어보자 — 메뉴들이 좀 안 맞게 막 들어간 것 같아» (추천안 승인).
   옛 다섯 탭(배치 · 보기 · 운동장 · 선수 · 단축키)은 «보기»에 기기 줄 일곱과 보드 줄 여덟이 섞이고, 포메이션이 두 곳, «선수»가 두 뜻, «그리드»가 네 뜻이었다.
   이제 네 탭 — 운동장 · 선수 표시 · 배치 | 내 화면. 탭 하나 = 저장 범위 하나. */
const fn=/function buildBoardSettings\(\)\{[\s\S]*?\n  \}\n  function mountTools/.exec(board);
const bs=fn&&fn[0];

test('3.036 four tabs in order — 운동장 · 선수 표시 · 배치 | 내 화면 — with the old keys aliased',()=>{
  assert.ok(bs,'buildBoardSettings');
  assert.match(bs,/var pitchTab=make\("button","cmd-board-settings-pitch-tab",null,"운동장"\),lookTab=make\("button","cmd-board-settings-look-tab",null,"선수 표시"\);/);
  assert.match(bs,/var formTab=make\("button","cmd-board-settings-form-tab",null,"배치"\);/);
  assert.match(bs,/var viewTab=make\("button","cmd-board-settings-view-tab",null,"내 화면"\);viewTab\.classList\.add\("bs-tab-me"\);/);
  assert.match(bs,/\[pitchTab,lookTab,formTab,viewTab\]\.forEach\(function\(b\)\{b\.type="button";b\.setAttribute\("role","tab"\);tabs\.appendChild\(b\);\}\);/,'tab order');
  assert.doesNotMatch(bs,/cmd-board-settings-layout-tab|cmd-board-settings-keys-tab/,'no fifth tab, no «선수» tab');
  assert.match(bs,/var ALIAS=\{layout:"form",keys:"view"\};/,'old keys still work (__psOpenFormation · shell · tests)');
  assert.match(bs,/name=ALIAS\[name\]\|\|name; if\(name!=="pitch"&&name!=="look"&&name!=="form"&&name!=="view"\)name="pitch";/,'unknown → 운동장');
  assert.match(bs,/var order=\["pitch","look","form","view"\]/,'arrow keys follow the tab order');
  assert.match(bs,/formPane\.hidden=!isForm;layoutPane\.hidden=!isForm;viewPane\.hidden=isForm;keysPane\.hidden=!isView;/,'배치 = card + #moreMenu · 내 화면 = view rows + keys');
});

test('3.036 one tab is one storage scope — the scope chip says so, the tab memory is per context',()=>{
  assert.match(bs,/var scopeChip=make\("span",null,"cmd-board-settings-scope","이 보드에 저장"\);/);
  assert.match(bs,/function scopeOf\(name\)\{ if\(name==="form"\)return \["바로 적용",[^\]]*\]; if\(name==="view"\)return \["이 기기에만",[^\]]*\];\n      return document\.body\.classList\.contains\("editing"\)\?\["이 훈련에 저장",[^\]]*\]:\["이 보드에 저장",[^\]]*\]; \}/);
  assert.match(bs,/function tabKey\(\)\{ return document\.body\.classList\.contains\("editing"\)\?"ps_board_settings_tab_editor_v1":"ps_board_settings_tab_v2"; \}/);
  assert.match(bs,/\(\{view:"look",layout:"form",keys:"view",form:"form",pitch:"pitch"\}\)\[o\]/,'the old memory migrates once — «보기» → «선수 표시»');
  assert.match(bs,/close\.title="보드 설정 닫기"/);
  assert.match(board,/window\.__psReplaceBoardSettings=function\(\)\{try\{ var p=id\("cmd-board-settings-pop"\); if\(p&&p\.__psSelectTab&&p\.__psSavedTab\)p\.__psSelectTab\(p\.__psSavedTab\(\)\); \}catch\(_\)\{\}/,'editor open/close re-selects the context tab and chip');
  /* id → storage: pitch/look rows are board keys (lookKeys / captureSnap), view rows are device keys */
  for(const k of ['pitchSpec','pitchTheme','grassM','lines','gridType','trainGridM','grassTone','pitchView','pitchN'])assert.ok(new RegExp('\\b'+k+'\\b').test(board),k);
  for(const [id,key] of [['tiltSeg','ps_board_tilt3d'],['tiltCamSeg','ps_tilt3d_opts_v1'],['dragSnapSeg','cs_drag_snap_v1'],['cmd-board-default-row','cs_board_default_v1']]){
    assert.ok(board.includes(id)&&board.includes(key),id+' ↔ '+key);
  }
});

test('3.036 the plan finds rows by control id; leftovers land on «선수 표시» with a warning',()=>{
  assert.match(bs,/var rowOf=function\(x\)\{ if\(typeof x!=="string"\)return x; var e=document\.getElementById\(x\); return e\?\(e\.closest\("\.menurow"\)\|\|e\):null; \};/);
  assert.match(bs,/if\(sec\[0\]==="board"\)\{first\.pitch=1;first\.look=1;\}/,'«내 스타일» is the first section of both board tabs');
  assert.match(bs,/r\.setAttribute\("data-bs-tab","look"\); viewMenu\.appendChild\(r\); try\{console\.warn\("boardSettings: PLAN 에 없는 줄/);
  assert.match(bs,/var DESK_LBL=\{labelSeg:"칩 글자",chip3dSeg:"입체 칩",zonePreset:"전술 구역",tiltDecoSeg:"꾸밈"\};/,'desktop-only relabels — the static markup and the phone sheet keep theirs');
  assert.match(bs,/if\(c0\)c0\.textContent="끄기"; if\(c1\)c1\.textContent="켜기";/,'«평면» only means 보드 보기 now');
  assert.match(bs,/if\(reset\)reset\.textContent="보드 초기화";/);
  assert.match(bs,/summary=make\("summary",null,null,"지우기·초기화"\)/);
  assert.match(bs,/defaultRow\.appendChild\(make\("span",null,"menulbl","기본값"\)\);/);
  assert.doesNotMatch(bs,/formPane\.appendChild\(defaultRow\)/,'the new-board default is a device value → «내 화면 › 새 보드»');
  assert.match(bs,/row\.setAttribute\("aria-label","내 스타일"\)/);
  assert.match(board,/shapeCycle:"선수 모양 바꾸기",labelCycle:"칩 글자\(번호·포지션\) 바꾸기",lineToggle:"라인 표시·숨김",gridCycle:"전술 구역 바꾸기",/,'shortcut names follow');
});

test('3.036 배치 tab — one formation card, «선발 11명» back beside [배치], saved team as a row, the leaked selects hidden',()=>{
  assert.match(bs,/function tidyMoreMenu\(\)\{/);
  assert.match(bs,/\["formHome","formAway"\]\.forEach\(function\(k\)\{ var e=id\(k\),r=e&&e\.closest\("\.menurow"\); if\(r\)\{ r\.classList\.add\("cmd-settings-state-source"\); r\.hidden=true; \} \}\);/,'design-v2.css «.menurow display:flex!important» leaked them back');
  assert.match(board,/html body #cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop \.menurow\.cmd-settings-state-source\{display:none!important\}/);
  assert.match(bs,/var h=make\("div","bsLoadSec","bs-sec bs-first","선수 불러오기"\);/);
  assert.match(bs,/var r2=make\("div","bsSavedTeamRow","menurow"\); r2\.appendChild\(make\("span",null,"menulbl","저장 팀"\)\); alb\.textContent="불러오기";/);
  assert.match(bs,/var acts=make\("div","ehActs","eh-acts"\); eg\.replaceWith\(acts\); acts\.appendChild\(eg\);[^\n]*acts\.appendChild\(lsb\);/,'«선발 11명» (hidden by the 1.841 :has(>#squadBtn) rule) moves into the card');
  assert.match(bs,/if\(isForm\)\{ehIntoPanel\(\);tidyMoreMenu\(\);\} else ehGoHome\(\);/);
  assert.match(bs,/formPane\.insertBefore\(e,formPane\.firstChild\); \}/,'the card is the first thing on the tab');
  assert.match(board,/#emptyHint>#ehGo,#emptyHint>\.eh-acts\{position:sticky;bottom:0;z-index:2\}/);
  assert.match(board,/:not\(\[data-bs-tab="form"\]\) \.cmd-board-settings-danger,/,'지우기·초기화 belongs to 배치');
});

test('3.036 내 화면 — keys collapsed under it, 3D rows only in 3D (title too), hints and context rules',()=>{
  assert.match(bs,/var det=make\("details",null,"bs-keys"\),sum=make\("summary",null,null,"단축키"\);/);
  assert.match(bs,/det\.addEventListener\("toggle",function\(\)\{ if\(det\.open\)keysPane\.__psRemount\(\); \}\);/);
  assert.match(bs,/if\(orig==="keys"&&keysPane\.__psDetails\)keysPane\.__psDetails\.open=true;/,'the old «단축키» tab key opens the fold');
  assert.match(board,/html body:not\(\.bc-tilt3d\) #cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop \.bs-sec\.ps-tilt-row\{display:none!important\}/);
  assert.match(bs,/var editorHint=make\("div","bsEditorHint","bs-hint","훈련 편집기는 평면으로 열려요 · 나가면 원래대로"\),snapHint=make\("div","bsSnapHint","bs-hint","운동장 › 훈련 격자 칸에 붙어요"\),blankHint=make\("div","bsBlankHint","bs-hint","그리드 크기 · 모양은 오른쪽 «바탕»에서 고쳐요"\);/);
  assert.match(board,/html body\.editing #cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop :is\(#pitchSpecSeg \[data-spec\^="grid"\],#squadGrpRow,#bsLoadSec,#bsSavedTeamRow,#cmd-board-default-row,#bsDefaultHint,\.bs-sec-newboard\)\{display:none!important\}/,'the editor panel (바탕 · 선수단 올리기) owns these');
  assert.match(board,/html body\.editing\.ps-blank-spec #cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop :is\(#pitchSpecRow,#bsGrassRow,#bsLineRow,#grassToneBRow,#grassTonePRow,#cmd-board-settings-pitchview,#cmd-board-settings-pvside,#cmd-board-settings-pitchn\)\{display:none!important\}/,'a grid board hides the rows that do nothing on it');
  assert.match(board,/document\.body\.classList\.toggle\("ps-blank-spec",_bl\); var _dr=document\.getElementById\("tiltDecoRow"\); if\(_dr\)_dr\.classList\.toggle\("ps-deco-off",_bl\);/);
  assert.match(board,/window\.__syncTrainGridRowUI=function\(\)\{ try\{ var on=\(document\.documentElement\.dataset\.pitch\|\|""\)==="train"; document\.querySelectorAll\("\.menurow\.ps-train-row"\)\.forEach\(function\(r\)\{ r\.classList\.toggle\("ps-train-off",!on\); \}\); \}catch\(_\)\{\} \};/);
  assert.match(board,/function applyPitchState\(theme, custom\)\{\n    try\{ setTimeout\(function\(\)\{ try\{ if\(window\.__syncTrainGridRowUI\)window\.__syncTrainGridRowUI\(\); \}catch\(_\)\{\} \},0\); \}catch\(_\)\{\}/);
});

test('3.036 release note and cache',()=>{
  const e=notes.entries().find(x=>x.id==='2026-10-15-v3-037-board-settings-tabs');assert.ok(e);
  assert.match(e.title,/v3\.037/);assert.equal(e.changes.length,5);
  assert.match(e.changes[0],/운동장.*선수 표시.*배치.*내 화면/);assert.match(e.changes[2],/내 스타일/);assert.match(e.changes[3],/선발 11명/);
  assert.match(R('sw.js'),/const CACHE = 'process-3\.037';/);
  assert.match(R('studio/app.html'),/window\.PS_BUILD='3\.037';/);
});

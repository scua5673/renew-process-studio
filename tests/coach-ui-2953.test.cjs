'use strict';
/* 2.953 — 코치 점검(10/7) 화면 다듬기. 동작이 아니라 자리·무게를 바꾼 판이라 원문 규칙으로 지킨다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'../studio',f),'utf8');
const SC=read('scout.html'),P=read('process.html'),B=read('board.html');

test('match prep: the toolbar sits above the pitch and clear buttons are small and last',()=>{
  assert.ok(/#mb2Card\{grid-template-areas:"tray phases" "tray squad" "tray bar" "tray pitch"!important\}/.test(SC));
  assert.ok(/#obCard\{grid-template-areas:"tray phases" "tray squad" "tray bar" "tray pitch" "tray fbar"!important\}/.test(SC));
  assert.ok(!/\.mb2-clear-lite\{[^}]*font:700 12px\/1 inherit/.test(SC),'잘못된 단축 속성(통째로 무시돼 16px)이 없다');
  assert.ok(/\.mb2-bar>#mb2Clear\{order:99\}/.test(SC)&&/\.mb2-opp-tools>#mb2ClearOp\{order:99\}/.test(SC));
});

test('match prep: empty meeting and carry cards fold to one line; exits say what they do',()=>{
  assert.ok(/_cc\.classList\.toggle\("is-empty",!h\)/.test(SC),'상대에서 넘어온 것');
  assert.ok(/card\.classList\.toggle\("is-empty",!list\.length\)/.test(SC),'이 경기 미팅');
  assert.ok(/id="matchCancelBtn" title="[^"]+">되돌리기<\/button>/.test(SC),'취소 → 되돌리기');
  assert.ok(/id="matchBackBtn" title="고친 것은 자동으로 저장돼 있어요/.test(SC));
});

test('week board marks today; phone scrolls there once per week',()=>{
  assert.ok(/\(isTd\?' is-today':''\)/.test(P)&&P.includes('<i class="wks-today">오늘</i>'));
  assert.ok(/window\.__wksTodayScrolled!==wk/.test(P),'편집할 때마다 끌어올리지 않는다');
  assert.ok(/\.wks-day\.is-today\{/.test(P));
});

test('quiet defaults: available chips, vault list buttons, board save; empty session has a door',()=>{
  assert.ok(/#availView \.av-chip\.ok:not\(#_\)\{background:transparent;/.test(SC),'정상은 조용히');
  assert.ok(/#drillFiles \.vx-items\.vx-list \.vcard \.vc-act\.view,#drillFiles \.vx-items\.vx-list \.vcard \.vc-act\.edit\{background:transparent;/.test(B));
  assert.ok(/b\.classList\.toggle\('dirty',!!_chg\)/.test(B)&&/#boardManualSave\.dirty\{background:var\(--blue,#3a6df0\)!important/.test(B),'보드 저장은 바뀐 게 있을 때만 파랑');
  assert.ok(SC.includes('class="ck-fill" data-ck="session">세션 채우기 →</button>'));
});

test('phone: no formation door on the view-only board, compact match header',()=>{
  assert.ok(/body\.ps-phone-work #ehDoor\{display:none!important\}/.test(B));
  assert.ok(/#matchView \.match-head \.tm-subtitle\{display:none!important\}/.test(SC));
  assert.ok(/\.match-shell \.mrec\{display:grid!important;grid-template-columns:1fr 1fr/.test(SC));
});

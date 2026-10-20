'use strict';
// 3.123 — 오류 제보 b4578ca1: «보드 가져오기»가 장면 29개를 만든 페이지를 덮었다.
// 이제 지금 페이지에 내용이 있으면 새 페이지로 가져온다(board-import-safe.js). 화면 흐름은 tests/browser/board-import-safe-3123.mjs.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const S=require('../studio/board-import-safe.js');
const root=path.join(__dirname,'..');

test('지킬 내용: 선수 · 장비 · 그림 · 장면 2개 이상', ()=>{
  const blank={players:[],equipment:[],drawings:[],ball:null};
  assert.equal(S.hasContent(blank,{frames:[]}),false,'새 빈 페이지');
  assert.equal(S.hasContent(blank,{frames:[{snap:blank}]}),false,'장면 하나는 판 그대로');
  assert.equal(S.hasContent(blank,null),false);
  assert.equal(S.hasContent({...blank,players:[{id:1}]},null),true,'선수');
  assert.equal(S.hasContent({...blank,equipment:[{id:1}]},null),true,'장비');
  assert.equal(S.hasContent({...blank,drawings:[{id:1}]},null),true,'그림');
  assert.equal(S.hasContent(blank,{frames:[{},{}]}),true,'장면 둘');
  assert.equal(S.hasContent(null,null),true,'판을 모르면 지킨다');
});

test('안내 글: 새 동작 · 맥이 아니면 Ctrl+Z', ()=>{
  const desc='보관함의 작전판만 보입니다 · 지금 페이지에 올리고, «보드 저장»하면 이 자료도 같은 내용으로 저장돼요(연결 표시의 ×로 끊기) · ⌘Z 로 되돌리기';
  const mac=S.texts(desc,true),win=S.texts(desc,false);
  assert.match(mac,/지금 페이지에 내용이 있으면 새 페이지로 가져와요\(원래 페이지는 그대로\) · «보드 저장»하면 이 자료도/);
  assert.match(mac,/⌘Z 로 되돌리기/);
  assert.match(win,/Ctrl\+Z 로 되돌리기/);
  assert.doesNotMatch(win,/⌘Z/);
  assert.equal(S.texts('보관함에 저장한 작전판을 골라 지금 페이지에 올립니다 (⌘Z 로 되돌리기)',true),'보관함에 저장한 작전판을 골라 가져옵니다 — 지금 페이지에 내용이 있으면 새 페이지로 (⌘Z 로 되돌리기)');
  assert.equal(S.texts('«판» 가져옴 · ⌘Z 되돌리기',false),'«판» 가져옴 · Ctrl+Z 되돌리기','알림');
  assert.equal(S.texts(null,false),'');
});

test('맥 판정', ()=>{
  assert.equal(S.isMac({platform:'MacIntel'}),true);
  assert.equal(S.isMac({platform:'iPhone'}),true);
  assert.equal(S.isMac({platform:'Win32'}),false);
  assert.equal(S.isMac({platform:'',userAgent:'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'}),true);
  assert.equal(S.isMac(null),false);
});

test('작전판이 이 모듈을 읽고, 앱이 오프라인에도 싣는다', ()=>{
  const html=fs.readFileSync(path.join(root,'studio/board.html'),'utf8');
  assert.ok(html.includes('<script src="board-import-safe.js"></script>'));
  // board.html 본문이 감쌀 대상을 그대로 가지고 있다 — 이름이나 글이 바뀌면 이 모듈도 고친다
  assert.ok(/async function openBoardImport\(\)/.test(html),'openBoardImport 는 함수 선언(window 속성)');
  assert.ok(html.includes('지금 페이지에 올리고, «보드 저장»하면 이 자료도'),'창 안내 글');
  assert.ok(html.includes('보관함에 저장한 작전판을 골라 지금 페이지에 올립니다'),'단추 설명 글');
  assert.ok(html.includes('add1.textContent="＋ "+_pw;'),'«＋ 페이지» 단추');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.ok(sw.includes("'/studio/board-import-safe.js'"));
});

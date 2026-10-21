'use strict';
// 3.137 — 오류 제보 0917a39f «저장 누르면 연결된 보관함에 저장이 된다고 했는데 그런 설정이 없고 보관함에 작성한 보드가 저장이 안 됩니다».
// 작업 보드 «저장»이 보관함에 담을지 다시 묻는 길(studio/board-save-ask.js). 화면 흐름은 tests/browser/board-vault-save.mjs.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const A=require('../studio/board-save-ask.js');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('다른 페이지에 내용이 있으면 빈 판이 아니다',()=>{
  const empty={snap:{players:[],equipment:[],drawings:[]},anim:{frames:[{}]}};
  const full={snap:{players:[{id:1}]}};
  assert.equal(A.otherPagesContent(null,0),false,'한 페이지 보드');
  assert.equal(A.otherPagesContent([empty,empty],0),false);
  assert.equal(A.otherPagesContent([full,empty],1),true,'빈 2페이지에서 저장 — 1페이지에 선수');
  assert.equal(A.otherPagesContent([full,empty],0),false,'지금 페이지는 본문이 본다');
  assert.equal(A.pageHasContent({snap:{},anim:{frames:[{},{}]}}),true,'장면 둘 이상도 내용');
  assert.equal(A.pageHasContent({snap:{drawings:[{}]}}),true);
  assert.equal(A.pageHasContent(null),false);
});

test('단추 설명 — «연결 설정»이 있는 것처럼 읽히던 글을 바로잡는다',()=>{
  const html=read('studio/board.html');
  assert.ok(html.includes(A.TIP_OLD),'본문의 단추 설명(바꿀 글)이 그대로 있다');
  const t=A.tip('보드를 저장하고, '+A.TIP_OLD);
  assert.ok(t.includes('«보드 가져오기»로 가져온 페이지면')&&t.includes('한 번 더'),t);
  assert.equal(A.tip('다른 글'),'다른 글');
  assert.match(A.DECLINED,/한 번 더 누르세요/);
});

test('감싸는 본문 이름이 그대로 · 본문보다 먼저 읽고 DOMContentLoaded 에 감싼다',()=>{
  const html=read('studio/board.html');
  for(const s of ['async function boardSaveOne(','function _boardSnapEmpty(','function boardManualChanged(','function boardManualStatus(','var _boardVaultDeclined=false;','_boardVaultDeclined=true;','try{window.__vaultSave=vaultSaveCurrent;}catch(_){}'])
    assert.ok(html.includes(s),s);
  assert.ok(html.includes('empty=_boardSnapEmpty(captureSnap())'),'빈 판 판정은 한 번 — 그 한 번만 바꾼다');
  assert.ok(html.includes('<script src="board-guest.js"></script><script src="board-save-ask.js"></script>'));
  assert.ok(html.indexOf('<script src="board-save-ask.js">')<html.indexOf('async function boardSaveOne('));
  assert.ok(read('studio/board-save-ask.js').includes("doc.addEventListener('DOMContentLoaded', hook)"));
  assert.ok(read('sw.js').includes("'/studio/board-save-ask.js'"));
});

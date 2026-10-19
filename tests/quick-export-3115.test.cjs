'use strict';
/* 3.115 — 작전판 빠른 내보내기(studio/board-quick-export.js). 오류 제보 0077af18 «화면 캡쳐했을때 걸리적 거려요» —
   캡처하면 위쪽 막대(평면 · 3D · 선수 모양)가 판 가운데 찍혔다. 위쪽 막대 오른쪽 «내보내기» → PNG 이미지 · PDF 문서(A4 한 장).
   실제로 파일이 받아지는 것은 tests/browser/board-quick-export.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const QX=require('../studio/board-quick-export.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('PDF page: landscape board → landscape A4, portrait board → portrait A4; picture keeps its shape inside the margins',()=>{
  for(const [w,h,land] of [[1316,860,true],[860,1316,false],[1000,1000,true],[2400,600,true]]){
    const L=QX.layout(w,h,true);
    assert.equal(L.land,land,w+'x'+h);
    assert.deepEqual([L.W,L.H],land?[1123,794]:[794,1123]);
    assert.ok(Math.abs(L.dw/L.dh-w/h)<1e-9,'비율 그대로');
    assert.ok(L.x>=36-1e-9&&L.x+L.dw<=L.W-36+1e-9,'좌우 여백 안 '+JSON.stringify(L));
    assert.ok(L.ty<L.y&&L.ty>=36&&L.y+L.dh<=L.H-36+1e-9,'제목은 그림 위, 그림은 아래 여백 안 '+JSON.stringify(L));
    assert.equal(L.tx,L.x,'제목은 그림 왼쪽 끝에 맞춘다');
    assert.ok(Math.abs((L.ty-17-36)-(L.H-36-(L.y+L.dh)))<1e-6,'제목 + 그림 덩어리가 종이 가운데');
  }
  const N=QX.layout(1316,860,false);assert.equal(N.y,N.ty-17,'제목이 없으면 그림이 그 자리부터');
  assert.ok(QX.layout(0,0,true).dw>0,'크기를 모르면 1 로 본다');
});
test('title is the file name: «작전판 - 페이지» → «작전판 · 페이지»',()=>{
  assert.equal(QX.titleOf('U12 빌드업 - 페이지 2'),'U12 빌드업 · 페이지 2');
  assert.equal(QX.titleOf('작전판'),'작전판');assert.equal(QX.titleOf(''),'');
});
test('menu offers PNG then PDF with plain words',()=>{
  assert.deepEqual(QX.ITEMS.map(i=>[i.k,i.badge,i.label]),[['png','PNG','PNG 이미지'],['pdf','PDF','PDF 문서']]);
  const css=QX.css();
  assert.match(css,/#ps-tb-export\{position:fixed;z-index:430;display:none/);assert.match(css,/#ps-tb-export\.on\{display:block\}/);
  assert.match(css,/body\.fmdark #ps-tb-export/,'다크 모드');
});
test('top bar puts «내보내기» in the right group after the vault link and before «저장», ink-coloured',()=>{
  const tb=read('studio/board-topbar.js');
  assert.match(tb,/g\.right\.forEach\(function \(n\) \{ R\.appendChild\(n\); \}\);\n\s+exportBtn\(R\);/);
  assert.match(tb,/var R0 = \['bpLinkChip', 'tbExport', 'boardManualSave', 'bpBoardSettings', 'vaultSave'\];/);
  assert.match(tb,/var lk = R\.querySelector\(':scope>#bpLinkChip'\); R\.insertBefore\(b, lk \? lk\.nextSibling : R\.firstChild\);/);
  // 흐린 단추 규칙은 :not(#…) 둘 — 이기려면 id 셋
  assert.match(tb,/'>\.tb-r button#tbExport:not\(#vaultSave\):not\(#boardManualSave\)\{color:' \+ ink/);
});
test('PDF uses the board picture (no floating buttons), the shared A4 assembler and the save dialog before building',()=>{
  const s=read('studio/board-quick-export.js');
  assert.match(s,/var o = win\.boardImageXML\(\)/);
  assert.match(s,/win\._jpegPagesToPdf\(\[\{ data: bytes, w: pw, h: ph \}\], L\.land\)/);
  const pick=s.indexOf('win._ppbPickSaveTarget(fname)'),build=s.indexOf('win.boardImageXML()');
  assert.ok(pick>0&&pick<build,'저장 창을 먼저 연다(누른 순간에만 열린다)');
  assert.match(s,/if \(target === false\) return;/,'취소하면 아무것도 저장하지 않는다');
  assert.match(s,/'로그인하면 PNG · PDF 로 내보낼 수 있어요'/);
  assert.match(s,/700 " \+ FS \+ "px 'Pretendard Variable',Pretendard,/,'캔버스 글꼴도 Pretendard 먼저');
  const b=read('studio/board.html');
  for(const fn of ['boardImageXML','_jpegPagesToPdf','_ppbPickSaveTarget','_pdfSafeName','_animDefaultBase','exportPNG','psVaultUnlocked','deselect'])
    assert.match(b,new RegExp('\\n(async )?function '+fn+'\\('),fn+' 는 전역 함수(모듈이 window 로 부른다)');
});
test('wiring: script tag, service worker core, board budget',()=>{
  const b=read('studio/board.html');
  assert.match(b,/<script src="board-vault-import\.js"><\/script><script src="board-quick-export\.js"><\/script>/);
  assert.match(read('sw.js'),/'\/studio\/board-quick-export\.js'/);
  assert.ok(Buffer.byteLength(b)<=2560000,'board.html budget '+Buffer.byteLength(b));
  assert.match(read('tests/browser/run-critical.mjs'),/'board-quick-export'/);
});

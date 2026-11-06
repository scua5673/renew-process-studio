'use strict';
/* 3.265 — 개인 노트 «내보내기»(코치 «맥북에서 개인 노트를 파일로 저장해서 프린트할 수 있나요?» → 목업 A안).
   위쪽 막대 제목 옆 «내보내기 ▾»: PDF로 저장(모든 페이지 · 손글씨 · 파일로 바로) · 인쇄 · 이미지 저장.
   «노트 선택» 팝오버의 같은 두 항목은 숨기고, 메모 보기에서는 단추를 숨기고, 폰은 제목 줄 끝에 아이콘만.
   실제 화면 · 파일은 tests/browser/note-export.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const N=require('../studio/note-export.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const latin=async b=>Buffer.from(await b.arrayBuffer()).toString('latin1');
const JPG=new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,1,255,217]);

test('메뉴 — PDF로 저장 · 인쇄 · 이미지 저장, 무엇을 담는지 한 줄씩',()=>{
  assert.deepEqual(N.ITEMS.map(i=>i[0]),['pdf','print','png']);
  assert.deepEqual(N.ITEMS.map(i=>i[1]),['PDF로 저장','인쇄','이미지 저장']);
  const h=N.menuHTML();assert.equal((h.match(/role="menuitem"/g)||[]).length,3);assert.match(h,/data-nx="pdf"><b>PDF로 저장<\/b><span>모든 페이지 · 손글씨 포함 · 파일로 바로<\/span>/);
});

test('파일 이름 — 노트 제목(파일에 못 쓰는 글자는 _) · 제목이 없으면 «훈련노트»',()=>{
  assert.equal(N.fileName('화요일 훈련 메모'),'화요일 훈련 메모.pdf');
  assert.equal(N.fileName('a/b:c*?'),'a_b_c__.pdf');
  assert.equal(N.fileName('   '),'훈련노트.pdf');assert.equal(N.fileName(null),'훈련노트.pdf');
});

test('PDF — 찍은 장마다 한 쪽, 노트 방향대로 A4 가로 · 세로(일정 PDF 와 같은 조립)',async()=>{
  const land=await latin(N.pdfFrom([{data:JPG,w:2828,h:2000},{data:JPG,w:2828,h:2000}],true));
  assert.ok(land.startsWith('%PDF-1.4'));assert.equal((land.match(/\/Type \/Page /g)||[]).length,2);
  assert.equal((land.match(/MediaBox \[0 0 841\.89 595\.28\]/g)||[]).length,2,'가로 A4');
  assert.match(land,/\/Width 2828 \/Height 2000 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode/);
  const port=await latin(N.pdfFrom([{data:JPG,w:2000,h:2828}],false));
  assert.equal((port.match(/MediaBox \[0 0 595\.28 841\.89\]/g)||[]).length,1,'세로 A4');
});

test('모양 — 노트 선택의 같은 두 항목 숨김 · 메모 보기에선 숨김 · 폰은 제목 줄 끝 아이콘',()=>{
  assert.ok(N.CSS.includes('.tplp-act[data-click="pngB"],.tplp-act[data-click="printB"]{display:none!important}'));
  assert.ok(N.CSS.includes('body.memo-mode .ps-nx{display:none!important}'));
  assert.match(N.CSS,/@media \(max-width:767px\)\{\.ps-nx-btn \.ps-nx-lb,\.ps-nx-btn \.ps-nx-caret\{display:none\}/);
  assert.match(N.CSS,/body\.note-dock \.bar>#nTitle:not\(#_\)\{flex:1 1 calc\(100% - 64px\)!important/,'제목은 «한 줄 − 단추» — 0 이면 첫 줄로 끼어 눌린다');
  const src=read('studio/note-export.js');
  assert.match(src,/var CLICK=\{print:'printB',png:'pngB'\};/,'인쇄 · 이미지는 원래 단추를 누른다(동작 그대로)');
  assert.match(src,/g\.fillStyle='#fff';g\.fillRect\(0,0,c\.width,c\.height\);g\.drawImage\(canvas,0,0\);/,'JPEG 는 흰 종이 위에(빈 곳이 검게 나오지 않게)');
  assert.match(src,/win\.pageCanvas\(i\)/,'인쇄 · 이미지와 같은 그림(양식 · 가져온 배경 · 손글씨)');
  assert.match(src,/t=\(ti&&ti\.value\.trim\(\)\)\|\|n\.title;/,'이름은 제목 칸에 보이는 글 — note.title 은 saveSoon 뒤에야 바뀐다');
});

test('배선 — 노트 화면 끝(perms.js 다음)에 일정 PDF 모듈과 함께 · sw.js CORE · 브라우저 시험 묶음',()=>{
  const h=read('studio/note.html');
  assert.ok(h.includes('<script src="perms.js"></script>\n<script src="pdf-export.js"></script><script src="note-export.js"></script>'));
  const sw=read('sw.js');assert.ok(sw.includes("'/studio/pdf-export.js', '/studio/note-export.js'"));
  assert.ok(read('tests/browser/run-critical.mjs').includes("suites.entry.push('note-export')"));
});

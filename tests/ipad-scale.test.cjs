'use strict';
/* 2.922 — 아이패드 화면 크기. 폭 1100 고정은 기기 폭에 맞춰 늘려 그려 11인치 가로 1.07배·13인치 가로 1.24배로
   글자·아이콘·도크가 전부 컸다. 가로일 때만 «기기 폭 ÷ 배율»(보통 1배 · 작게 0.9배), 크게 = 예전 1100. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
const src=html.match(/function psPadViewportWidth\(size,landscapeW,landscape\)\{[\s\S]*?\n  \}/);
assert.ok(src,'psPadViewportWidth 가 app.html 에 있다');
const width=new Function(src[0]+'\nreturn psPadViewportWidth;')();
const IPAD={mini:1133,air11:1180,pro11:1194,pro13:1366};
test('크게 = 예전 그대로 1100(가로·세로 모두)',()=>{
  for(const w of Object.values(IPAD)){assert.equal(width('l',w,true),1100);assert.equal(width('l',w,false),1100);}
});
test('세로는 어느 크기든 1100 — 이미 0.75~0.93배라 더 줄이지 않는다',()=>{
  for(const w of Object.values(IPAD))for(const s of ['l','m','s'])assert.equal(width(s,w,false),1100);
});
test('보통 = 1배: 화면 폭 그대로(모델마다 같은 실제 크기)',()=>{
  for(const w of Object.values(IPAD))assert.equal(width('m',w,true),w);
  assert.ok(IPAD.pro13/1100>1.2,'예전 13인치는 1.24배였다');
});
test('작게 = 0.9배',()=>{
  assert.equal(width('s',IPAD.air11,true),1311);assert.equal(width('s',IPAD.pro13,true),1518);
  for(const w of Object.values(IPAD))assert.ok(Math.abs(w/width('s',w,true)-0.9)<0.001);
});
test('폭을 모르거나 이상하게 좁으면 1100 밑으로 내려가지 않는다',()=>{
  assert.equal(width('m',0,true),1100);assert.equal(width('m',NaN,true),1100);assert.equal(width('m',1024,true),1100);
});
test('설정 행은 기기 탭에 있고 아이패드가 아니면 숨는다',()=>{
  assert.match(html,/id="psPadScaleRow"[\s\S]{0,200}data-pad-scale="l">크게[\s\S]{0,80}data-pad-scale="m">보통[\s\S]{0,80}data-pad-scale="s">작게/);
  assert.match(html,/device:\['psPwaStatus','psPadScaleSw',/);
  assert.match(html,/html:not\(\[data-ps-device="ipad"\]\) #gearPop #psPadScaleRow\{display:none!important\}/);
  assert.match(html,/vp\.setAttribute\('content','width='\+psPadViewportWidth\(dev\.pad\?psPadScale\(\):'l'/,'아이패드가 아니면 늘 예전 1100');
});
test('아이패드 도크 = 컴퓨터와 같은 치수(줄 36 · 버튼 30 · 아이콘 17 · 글자 숨김), 기기 표식으로만',()=>{
  const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  const i=board.indexOf('<style id="ps-2922-ipad-dock">');assert.ok(i>0);
  const blk=board.slice(i,board.indexOf('</style>',i)).replace(/\/\*[\s\S]*?\*\//g,'');   /* 주석은 빼고 규칙만 */
  const D='html.ps-page-board body.ps-ipad-work:not(.ps-dock):not(.cmd-dock-folded) #ps-command-dock';
  assert.ok(blk.includes(D+':not(#_)'.repeat(9)),'기기 표식(ps-iPad-work)만 보고 폰 도크·접힌 도크는 뺀다');
  assert.doesNotMatch(blk,/pointer|hover/,'포인터 미디어에 기대지 않는다');
  for(const need of ['min-height:36px','grid-template-rows:auto auto','height:30px','width:30px','width:17px','#viewBtn,#cmd-export-btn)>span{display:none','padding:0!important;margin:0!important'])
    assert.ok(blk.includes(need),need);
  assert.ok(board.indexOf('<style id="ps-2751-dock-alignment">')<i,'컴퓨터 배치 블록 뒤에 온다');
});

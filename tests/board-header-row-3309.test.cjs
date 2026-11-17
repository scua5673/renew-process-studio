'use strict';
/* 3.309 — 작전판 위쪽 띠를 운동장 밖 제 줄(헤더)로(사용자 11/17 «도구들을 운동장과 겹치지 않게» · 목업 A안). board-topbar.js 의 CSS 글자 · topInset · 배선을 본다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const tb=require('../studio/board-topbar.js');
const SRC=fs.readFileSync(path.join(root,'studio/board-topbar.js'),'utf8');

test('the strip is a row of its own: relative, 52px, opaque, clickable — not a transparent absolute layer',()=>{
  const css=tb.css();
  const S=/html\.ps-page-board body\.ps-dock-float #boardPageStrip\.ps-tb(:not\(#tb\d\)){10}\{([^}]*)\}/.exec(css);assert.ok(S,'strip rule');
  const d=S[2];
  for(const k of ['position:relative!important','top:auto!important','height:52px!important','width:100%!important','background:var(--panel,#fff)!important','border-bottom:1px solid var(--line,#E3E6EA)!important','pointer-events:auto!important','align-items:center!important'])assert.ok(d.includes(k),k+' in '+d);
  for(const k of ['position:absolute','background:transparent!important','pointer-events:none'])assert.ok(!d.includes(k),'no more '+k);
  assert.doesNotMatch(css,/body\.ps-dock-float\.vcreating #boardPageStrip\.ps-tb[^{]*\{top:56px!important\}/,'vcreating 는 #boardView 의 padding-top 56 이 받는다');
  assert.match(css,/body\.ps-dock-float #ehDoor\{top:14px!important\}/);
  /* 스킨 규칙 뒤에서 덩어리 꾸밈을 걷고 띠 바탕이 스킨을 따른다 */
  const glass=css.indexOf("body.ps-dock-float.ps-skin-glass #boardPageStrip.ps-tb"),strip=css.lastIndexOf('>.tb-g{background:transparent!important;border:0!important;box-shadow:none!important');
  assert.ok(glass>0&&strip>glass,'덩어리 걷기는 스킨 규칙 뒤에');
  assert.match(css,/body\.ps-dock-float\.ps-skin-glass #boardPageStrip\.ps-tb(:not\(#tb\d\)){10}\{background:rgba\(24,28,38,\.98\)!important/);
  assert.match(css,/\.ps-skin-flat\.fmdark #boardPageStrip\.ps-tb(:not\(#tb\d\)){10}\{background:#1B1E23!important/);
});

test('topInset reserves nothing for the strip any more (only the empty-board formation door, portrait), same signature for applyView',()=>{
  const fake=(cls)=>({ownerDocument:{body:{classList:{contains:c=>cls.includes(c)}},defaultView:{},getElementById:()=>null},parentElement:{}});
  assert.equal(tb.topInset(null,'v'),0);assert.equal(tb.topInset(fake(['ps-dock-float']),'h'),0,'가로 판은 늘 0');
  assert.equal(tb.topInset(fake([]),'v'),0,'떠 있는 도크가 아니면 0');assert.equal(tb.topInset(fake(['ps-dock-float']),'v'),0,'문이 없으면 0 — 띠 몫의 예약은 없다');
  assert.match(SRC,/var stage = svg\.parentElement, door = doc\.getElementById\('ehDoor'\);/,'남는 예약은 문(#ehDoor)뿐');
  assert.doesNotMatch(SRC,/strip\.querySelectorAll\(':scope>\.tb-g'\)\);\n\s+var door/,'띠 덩어리는 더 이상 재지 않는다');
  assert.match(fs.readFileSync(path.join(root,'studio/board.html'),'utf8'),/PSTopBar\.topInset\(svg,o\)/,'applyView 가 그대로 부른다');
});

test('the brand says where (link · training · meeting · vault edit · work board) and which page, set as text',()=>{
  assert.match(SRC,/function whereLabel\(\)/);assert.match(SRC,/function pageLabel\(\)/);assert.match(SRC,/function paintBrand\(\)/);
  assert.match(SRC,/if \(body\.classList\.contains\('editing'\)\) return '훈련';/);
  assert.match(SRC,/if \(body\.classList\.contains\('meet-mode'\)\) return '미팅';/);
  assert.match(SRC,/if \(body\.classList\.contains\('vcreating'\)\) return '보관함 편집';/);
  assert.match(SRC,/replace\(\/\^보관함 연결:\\s\*\/, ''\)/,'연결 칩의 aria-label 에서 이름');
  assert.match(SRC,/return '작업 보드';/);
  assert.match(SRC,/w\.textContent = whereLabel\(\); if \(p\) p\.textContent = pageLabel\(\);/,'textContent — 자료 이름은 사용자 글');
  assert.match(SRC,/<span class="tb-where"><\/span><span class="tb-page"><\/span>/);
  assert.match(SRC,/function paintView\(\) \{\n\s+paintBrand\(\);/);
  assert.match(SRC,/attributeFilter: \['class', 'aria-label'\]/,'탭 .on · 연결 칩이 바뀌면 다시');
});

test('3.309 release note, build pins, browser test registered',()=>{
  const notes=require('../studio/release-notes.js'),e=notes.entries().find(x=>x.id==='2026-11-17-v3-309-board-header');assert.ok(e);assert.match(e.title,/v3\.309/);assert.equal(e.changes.length,3);
  const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([0-9.]+)'/)[1];assert.ok(Number(build)>=3.309);
  assert.match(fs.readFileSync(path.join(root,'sw.js'),'utf8'),new RegExp("const CACHE = 'process-"+build.replace(/\./g,'\\.')+"';"));
  assert.ok(fs.readFileSync(path.join(__dirname,'browser','run-critical.mjs'),'utf8').includes("'board-header-row-3309'"));
});

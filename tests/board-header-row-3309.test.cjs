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
  /* 빈 판의 «포메이션으로 시작» 문은 헤더 안의 주 단추(무대 안 top 규칙은 없다). display 엔 !important 없음 — board.html 의 인라인 display:none(선수가 놓이면)이 이긴다 */
  assert.doesNotMatch(css,/body\.ps-dock-float #ehDoor\{top:14px!important\}/,'문은 무대 안이 아니라 헤더에');
  assert.match(css,/#boardPageStrip\.ps-tb(:not\(#tb\d\)){10} #ehDoor\{position:static!important;[^}]*display:inline-flex;/,'문은 헤더의 단추 — display 는 !important 없이');
  assert.match(css,/\.ps-skin-glass #boardPageStrip\.ps-tb(:not\(#tb\d\)){10} #ehDoor\{background:linear-gradient/,'문은 주 단추 모양');
  /* «배치 도구»(board-training-edit.js)는 헤더가 아니라 «보드 ▾» 메뉴에 — 편집 못 할 때의 hidden 이 메뉴 단추 규칙(display:flex!important)에 지지 않게 */
  assert.match(css,/#ps-tb-menu>button\[hidden\]\{display:none!important\}/);
  const te=fs.readFileSync(path.join(root,'studio/board-training-edit.js'),'utf8');
  assert.match(te,/var host=\(menu&&!additive&&!freeOnce\)\?menu:\(doc\.querySelector\('#boardPageStrip \.tb-r'\)\|\|doc\.getElementById\('boardStage'\)\);/,'헤더면 메뉴 · 선택 마침 · 자유 이동 대기 중엔 헤더 오른쪽');
  assert.match(te,/observe\(menu,\{childList:true\}\)/,'띠를 다시 세워 메뉴가 비면 되돌아온다');
  assert.match(te,/var anchor=\(toggle\.classList\.contains\('pe-menu'\)&&!toggle\.offsetParent\)\?\(doc\.getElementById\('tbBrand'\)\|\|toggle\):toggle;/,'패널은 닫힌 메뉴 안 단추 대신 «보드 ▾» 아래');
  /* 스킨 규칙 뒤에서 덩어리 꾸밈을 걷고 띠 바탕이 스킨을 따른다 */
  const glass=css.indexOf("body.ps-dock-float.ps-skin-glass #boardPageStrip.ps-tb"),strip=css.lastIndexOf('>.tb-g{background:transparent!important;border:0!important;box-shadow:none!important');
  assert.ok(glass>0&&strip>glass,'덩어리 걷기는 스킨 규칙 뒤에');
  assert.match(css,/body\.ps-dock-float\.ps-skin-glass #boardPageStrip\.ps-tb(:not\(#tb\d\)){10}\{background:rgba\(24,28,38,\.98\)!important/);
  assert.match(css,/\.ps-skin-flat\.fmdark #boardPageStrip\.ps-tb(:not\(#tb\d\)){10}\{background:#1B1E23!important/);
});

test('topInset reserves nothing for the strip, nor for the formation door once it sits in the header; only a door still standing in the stage (portrait) counts',()=>{
  const fake=(cls)=>({ownerDocument:{body:{classList:{contains:c=>cls.includes(c)}},defaultView:{},getElementById:()=>null},parentElement:{}});
  assert.equal(tb.topInset(null,'v'),0);assert.equal(tb.topInset(fake(['ps-dock-float']),'h'),0,'가로 판은 늘 0');
  assert.equal(tb.topInset(fake([]),'v'),0,'떠 있는 도크가 아니면 0');assert.equal(tb.topInset(fake(['ps-dock-float']),'v'),0,'문이 없으면 0 — 띠 몫의 예약은 없다');
  assert.match(SRC,/var stage = svg\.parentElement, door = doc\.getElementById\('ehDoor'\);/,'남는 예약은 무대 안에 서 있는 문(#ehDoor)뿐');
  assert.match(SRC,/if \(!stage \|\| !door \|\| !stage\.contains\(door\)\) return 0;/,'문이 헤더(무대 밖)면 0');
  const withDoor=(inStage)=>{const door={getBoundingClientRect:()=>({width:120,height:30,left:300,right:420,top:80,bottom:110})};const stage={contains:x=>inStage&&x===door,getBoundingClientRect:()=>({left:0,right:800,top:60,bottom:700})};return {ownerDocument:{body:{classList:{contains:c=>c==='ps-dock-float'}},defaultView:{getComputedStyle:()=>({paddingTop:'0px'})},getElementById:id=>id==='ehDoor'?door:null},parentElement:stage};};
  assert.equal(tb.topInset(withDoor(false),'v'),0,'문이 헤더에 있으면 세로 판도 0');assert.equal(tb.topInset(withDoor(true),'v'),58,'문이 아직 무대 안이면 그 높이만(110 + 8 - 60)');
  assert.match(SRC,/function adoptDoor\(L\)/);assert.match(SRC,/function restoreDoor\(\)/);assert.match(SRC,/var doorHome = null, doorNode = null;/,'띠를 innerHTML 로 다시 그릴 때 버려진 문을 되살리려면 노드를 붙들어 둔다');assert.match(SRC,/var d = doc\.getElementById\('ehDoor'\) \|\| doorNode;/);assert.match(SRC,/if \(typeof win\.updateEmptyHint === 'function'\) win\.updateEmptyHint\(\);/,'떨어져 있던 사이 놓친 보임 · 숨김');assert.match(SRC,/L\.appendChild\(brand\); adoptDoor\(L\);/,'헤더를 세울 때 문을 «어디» 옆으로');assert.match(SRC,/menu\.classList\.remove\('on'\); restoreDoor\(\);/,'좁은 창(띠를 되돌릴 때) 문도 무대로');
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
  const notes=require('../studio/release-notes.js'),e=notes.entries().find(x=>x.id==='2026-11-17-v3-309-board-header');assert.ok(e);assert.match(e.title,/v3\.309/);assert.equal(e.changes.length,5);
  const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([0-9.]+)'/)[1];assert.ok(Number(build)>=3.309);
  assert.match(fs.readFileSync(path.join(root,'sw.js'),'utf8'),new RegExp("const CACHE = 'process-"+build.replace(/\./g,'\\.')+"';"));
  assert.ok(fs.readFileSync(path.join(__dirname,'browser','run-critical.mjs'),'utf8').includes("'board-header-row-3309'"));
});

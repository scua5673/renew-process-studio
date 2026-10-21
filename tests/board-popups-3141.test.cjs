'use strict';
/* 3.141 — 작전판에서 뜨는 것들을 한 결로(studio/board-popups.js, 사용자 «디자인들 특히 신경써줘 · 보드만들면서 뜨는 것들 전부 잘 정리해줘»).
   선택 옆 패널(그림 · 글 · 묶음)은 밝은 카드 · «맨 뒤»는 «맨 앞»과 한 줄 · 알림은 도구 띠를 가리지 않는다 · 메뉴들은 같은 카드.
   실제 판은 tests/browser/board-popups-3141.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../studio/board-popups.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('알림 자리 — 보이는 띠가 있으면 그 맨 위보다 12px 위, 없으면 원래 자리(null)',()=>{
  assert.equal(P.toastBottom(800,[]),null);
  assert.equal(P.toastBottom(800,[585]),800-585+12);
  assert.equal(P.toastBottom(800,[585,620]),800-585+12,'여럿이면 가장 위의 띠');
  assert.equal(P.toastBottom(900,null),null);
});

test('선택 옆 패널 규칙 — 선수 패널(.ps-insp-on) · 폰(.ps-dock)은 빼고, id 여섯으로 1.846 · 2.980 규칙을 이긴다',()=>{
  const c=P.css();
  const N='html.ps-page-board body:not(.ps-dock):not(.ps-insp-on) .sel-ctl.sel-ctl.sel-near:not(#_):not(#__):not(#___):not(#____):not(#_____):not(#______)';
  assert.ok(c.includes(N+'{width:224px!important;max-width:224px!important'),'카드 폭');
  assert.ok(c.includes(N+'>#dupSelBtn,'+N+'>#frontSelBtn,'+N+'>#backSelBtn{grid-column:span 2!important'),'복제 · 맨 앞 · 맨 뒤 한 줄');
  assert.ok(c.includes(N+'>#mirHBtn,'+N+'>#mirVBtn{grid-column:span 3!important'),'좌우 · 상하 한 줄');
  assert.ok(c.includes(N+'>#delSelBtn{color:var(--pop-danger)'),'삭제는 빨강');
  assert.ok(c.includes('[data-kind="multi"]>:is(#ringCtl,'),'묶음의 토글은 한 줄 셋');
  assert.ok(c.includes('body.ps-shape-menu-on .sel-ctl.sel-ctl.sel-near:not(#_):not(#__):not(#___):not(#____):not(#_____):not(#______){display:none!important}'),'도형 메뉴가 열리면 옆 패널은 숨긴다');
  // 토큰은 밝은 카드 + 다크 · 글래스
  assert.ok(/html\.ps-page-board body\{--pop-bg:/.test(c)&&/body\.fmdark,html\.ps-page-board body\.ps-dock-float\.ps-skin-glass\{--pop-bg:/.test(c));
  for(const s of ['.anim-frame-menu{','#ps-tb-menu{','#lsPop{'])assert.ok(c.includes(s+'background:var(--pop-')||c.includes(s+'min-width:150px'),s);
  assert.ok(!/renderTokens\(/.test(read('studio/board-popups.js')),'켜질 때 renderTokens 를 부르지 않는다(3.120)');
});

test('도형 메뉴(board-shape-menu.js)는 같은 토큰을 쓰고, 열릴 때 body.ps-shape-menu-on · 복제 · 고정 · 내용 수정',()=>{
  const s=read('studio/board-shape-menu.js');
  assert.ok(s.includes('var(--pop-bg,')&&s.includes('var(--pop-well,'),'공통 토큰(없으면 선 스타일 값)');
  assert.ok(s.includes("classList.add('ps-shape-menu-on')")&&s.includes("classList.remove('ps-shape-menu-on')"));
  assert.ok(s.includes('data-act="dup"')&&s.includes('data-act="lock"')&&s.includes('data-act="edit"'));
});

test('가짜 창 — toast 를 감싸 띠가 보이면 알림을 그 위로, 띠가 닫히면 원래 자리로',()=>{
  let toasts=0;const opts={id:'ps-df-opts',cls:'on',disp:'flex',top:585,h:50,obs:null};
  const toastEl={id:'cs-ftoast',style:{bottom:'84px',props:{},setProperty(k,v,p){this[k]=v;this.props[k]=p||'';}}};
  const byId={'ps-df-opts':{getBoundingClientRect:()=>({top:opts.top,width:300,height:opts.h}),id:'ps-df-opts'},'cs-ftoast':toastEl};
  const doc={readyState:'complete',head:{appendChild(){}},documentElement:{clientHeight:800},getElementById:id=>byId[id]||null,createElement(){return {style:{}};},addEventListener(){}};
  const win={document:doc,innerHeight:800,getComputedStyle:e=>({display:opts.disp,visibility:'visible'}),MutationObserver:function(fn){opts.obs=fn;this.observe=()=>{};},toast(){toasts++;}};
  const api=P.install(win);
  assert.ok(api&&win.__psPopups===api);
  win.toast('x');
  assert.equal(toasts,1,'원래 toast 를 부른다');
  assert.equal(toastEl.style.bottom,(800-585+12)+'px');assert.equal(toastEl.style.props.bottom,'important','도크 모듈의 !important 를 이긴다');
  opts.disp='none';opts.obs();
  assert.equal(toastEl.style.bottom,'84px','띠가 닫히면 처음 값(인라인 84px)으로');
  assert.equal(toastEl.style.props.bottom,'','important 없이');
  assert.equal(P.install(win),null,'두 번 설치하지 않는다');
});

test('배포 묶음 — sw.js CORE · board.html <script> 한 줄 · 크기 예산 · 중요 시험 목록',()=>{
  assert.ok(read('sw.js').includes("'/studio/board-popups.js'"),'sw.js CORE');
  const b=read('studio/board.html');
  assert.ok(b.includes('<script src="board-popups.js"></script>'),'board.html script');
  assert.ok(Buffer.byteLength(b)<=2560000,'board.html budget '+Buffer.byteLength(b));
  assert.ok(read('tests/browser/run-critical.mjs').includes("'board-popups-3141'"),'run-critical');
  assert.ok(fs.existsSync(path.join(__dirname,'browser','board-popups-3141.mjs')));
});

'use strict';
/* 3.138 — 도형 오른쪽 클릭 메뉴 · «맨 뒤» 단추(studio/board-shape-menu.js, 제보 0a1f6e9d 박수빈).
   «선, 사각형, 동그라미 등 도형을 우클릭하면 해당 도형의 굵기, 투명도를 조절» · «'맨 앞' 기능만 있는데 '맨 뒤' 기능도».
   실제 판은 tests/browser/shape-menu-3138.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../studio/board-shape-menu.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('굵기 0.5~3 (0.1 단위) · 투명도 0.2~1 (0.05 단위) — «선 스타일» 팝오버와 같은 범위',()=>{
  assert.equal(M.clampLw(2.5),2.5);assert.equal(M.clampLw(9),3);assert.equal(M.clampLw(0),0.5);assert.equal(M.clampLw('abc'),1);assert.equal(M.clampLw(1.26),1.3);
  assert.equal(M.clampOp(0.5),0.5);assert.equal(M.clampOp(2),1);assert.equal(M.clampOp(0.01),0.2);assert.equal(M.clampOp(undefined),1);assert.equal(M.clampOp(0.52),0.5);
});

test('도형 이름 — 선 · 사각형 · 원 · 글 · 그리드 · 모르는 것은 «도형»',()=>{
  assert.equal(M.name({type:'rect'}),'사각형');assert.equal(M.name({type:'rectdash'}),'사각형');assert.equal(M.name({type:'ellipse'}),'원');
  assert.equal(M.name({type:'pass'}),'패스');assert.equal(M.name({type:'text'}),'글');assert.equal(M.name({type:'rectline',grid:true}),'그리드');
  assert.equal(M.name({type:'zzz'}),'도형');assert.equal(M.name(null),'도형');
});

test('오른쪽 클릭 판정은 토큰 정보 창(2.975)과 같다 — 마우스 오른쪽, 맥은 ⌃+왼쪽, 손가락 · 펜은 아니다',()=>{
  assert.equal(M.isRightClick({pointerType:'mouse',button:2},false),true);
  assert.equal(M.isRightClick({pointerType:'mouse',button:0,ctrlKey:true},true),true);
  assert.equal(M.isRightClick({pointerType:'mouse',button:0,ctrlKey:true},false),false,'윈도우의 ⌃클릭은 보통 클릭');
  assert.equal(M.isRightClick({pointerType:'mouse',button:0,ctrlKey:true,metaKey:true},true),false);
  assert.equal(M.isRightClick({pointerType:'touch',button:2},true),false);
  assert.equal(M.isRightClick({pointerType:'pen',button:2},true),false);
  assert.equal(M.isRightClick(null,true),false);
});

test('눌린 요소에서 그림을 찾는다 — drawingEl 이 붙인 __psD 를 위로 올라가며, 지금 판에 없는 것은 거른다',()=>{
  const d1={type:'rect',pts:[]},d2={type:'line',pts:[]},gone={type:'line',pts:[]};
  const g1={__psD:d1},hit={parentNode:g1},inner={parentNode:hit};
  const g2={__psD:d2},gOld={__psD:gone};
  assert.equal(M.findDrawing(inner,[d1,d2]),d1);
  assert.equal(M.findDrawing(g2,[d1,d2]),d2);
  assert.equal(M.findDrawing({parentNode:gOld},[d1,d2]),null,'지운 그림의 요소(다시 그리기 전)는 안 잡는다');
  assert.equal(M.findDrawing({parentNode:null},[d1]),null);
  assert.equal(M.findDrawing(null,[d1]),null);
  // 표식이 없는 요소(본문이 부팅 중 그린 것)는 drawLayer 바로 아래 g 의 차례로 — 수가 다르면 안 잡는다
  const layer={};const gA={parentNode:layer},gB={parentNode:layer};layer.children=[gA,gB];
  assert.equal(M.findDrawing({parentNode:gB},[d1,d2],layer),d2);
  assert.equal(M.findDrawing({parentNode:gA},[d1,d2],layer),d1);
  assert.equal(M.findDrawing({parentNode:gA},[d1],layer),null,'g 수와 그림 수가 다르면(그리는 중) 차례를 믿지 않는다');
  assert.equal(M.findDrawing({parentNode:{parentNode:null}},[d1,d2],layer),null,'drawLayer 밖');
});

test('다룰 그림 — 둘 이상 골라 둔 묶음 안의 것을 누르면 묶음의 그림 전부(토큰은 뺀다), 아니면 그것 하나',()=>{
  const a={type:'rect'},b={type:'line'},c={type:'ellipse'},tok={id:7,team:'blue'};
  assert.deepEqual(M.targets(a,[a,b,tok],[a,b,c]),[a,b]);
  assert.deepEqual(M.targets(c,[a,b],[a,b,c]),[c],'묶음 밖의 것은 하나만');
  assert.deepEqual(M.targets(a,[a],[a,b,c]),[a],'하나만 골라 둔 것은 묶음이 아니다');
  assert.deepEqual(M.targets(a,[a,tok],[a,b,c]),[a]);
  assert.deepEqual(M.targets(null,[a],[a]),[]);
});

test('창 자리 — 누른 점 오른쪽 아래, 화면을 벗어나면 왼쪽 · 위로',()=>{
  assert.deepEqual(M.place(100,100,236,160,1024,768),{left:106,top:106});
  assert.deepEqual(M.place(900,100,236,160,1024,768),{left:658,top:106},'오른쪽이 모자라면 점 왼쪽');
  assert.deepEqual(M.place(100,700,236,160,1024,768),{left:106,top:600},'아래가 모자라면 화면 안으로');
  assert.deepEqual(M.place(2,2,236,160,200,100).left,8,'왼쪽 끝은 8px');
});

test('«맨 뒤» 단추 규칙은 «맨 앞»(#frontSelBtn)의 도크 · 더보기 규칙과 같은 선택자',()=>{
  const c=M.css(),b=read('studio/board.html');
  for(const sel of ['body:not(.ps-dock) .sel-ctl > #backSelBtn','body.ps-dock .sel-ctl:not(#_):not(#__):not(#___) > #backSelBtn{order:20!important}',':not(.sel-more) > #backSelBtn{display:none!important}','.sel-more > #backSelBtn{flex:1 1 calc(25% - 6px)!important'])
    assert.ok(c.includes(sel),sel);
  assert.ok(/body\.ps-dock \.sel-ctl:not\(#_\):not\(#__\):not\(#___\):not\(\.sel-more\) > :is\([^)]*#frontSelBtn/.test(b),'board.html 의 «맨 앞» 더보기 규칙이 그대로다');
  assert.ok(c.includes('#psShapeMenu{position:fixed'));
});

test('배포 묶음 — sw.js CORE · board.html <script> 한 줄 · 크기 예산 · 중요 시험 목록',()=>{
  assert.ok(read('sw.js').includes("'/studio/board-shape-menu.js'"),'sw.js CORE');
  const b=read('studio/board.html');
  assert.ok(b.includes('<script src="board-shape-menu.js"></script>'),'board.html script');
  assert.ok(b.indexOf('<script src="board-shape-menu.js">')<b.indexOf('let sel=null;'),'본문보다 먼저 읽힌다(updateDelUI · drawingEl 을 DOMContentLoaded 에 감싼다)');
  assert.ok(Buffer.byteLength(b)<=2560000,'board.html budget '+Buffer.byteLength(b));
  assert.ok(read('tests/browser/run-critical.mjs').includes("'shape-menu-3138'"),'run-critical');
  assert.ok(fs.existsSync(path.join(__dirname,'browser','shape-menu-3138.mjs')));
});

test('가짜 창에 설치 — «맨 뒤» 단추가 «맨 앞» 뒤에 붙고 updateDelUI 가 보임을 맞춘다 · 그림 요소에 자료를 잇는다',()=>{
  const nodes=[];let frontDisplay='none';
  const front={id:'frontSelBtn',style:{display:frontDisplay},insertAdjacentElement(where,el){nodes.push([where,el]);}};
  const made=[];
  const doc={readyState:'complete',head:{appendChild(){}},documentElement:{clientWidth:1024,clientHeight:768},body:{appendChild(){}},
    getElementById:id=>id==='frontSelBtn'?front:(id==='backSelBtn'?made.find(e=>e.id==='backSelBtn')||null:null),
    createElement(tag){const e={tag,style:{},dataset:{},listeners:{},addEventListener(t,f){this.listeners[t]=f;},querySelector(){return null;},querySelectorAll(){return [];},remove(){}};made.push(e);return e;},
    addEventListener(){},removeEventListener(){}};
  let delUI=0;const g={};
  const win={document:doc,addEventListener(){},removeEventListener(){},updateDelUI(){delUI++;front.style.display='inline-flex';},drawingEl(d){return g;},_PTR_MAC:false};
  const api=M.install(win);
  assert.ok(api&&win.__psShapeMenu===api);
  const back=made.find(e=>e.id==='backSelBtn');
  assert.ok(back,'#backSelBtn 을 만든다');assert.deepEqual(nodes[0][0],'afterend');assert.equal(nodes[0][1],back);
  assert.equal(back.className,'dup-sel');assert.ok(/맨 뒤/.test(back.innerHTML));
  assert.equal(back.style.display,'none','처음엔 «맨 앞»처럼 숨어 있다');
  win.updateDelUI();
  assert.equal(delUI,1,'원래 updateDelUI 를 부른다');assert.equal(back.style.display,'inline-flex','«맨 앞»이 보이면 «맨 뒤»도');
  const d={type:'rect',pts:[]};assert.equal(win.drawingEl(d),g);assert.equal(g.__psD,d,'drawingEl 이 돌려준 요소에 자료를 단다');
  assert.equal(M.install(win),null,'두 번 설치하지 않는다');
});

'use strict';
/* 3.097 — 펜슬 점의 화면→판 투영(_inkMapper)은 이벤트 하나(그 중간 점 포함)에서만 다시 쓴다.
   예전엔 다음 애니메이션 프레임까지 두었다. 그 사이 타이머 · 관찰자(psSelBarLayout · fix · _animFitPad → applyView)가 판을 다시 놓으면
   다음 이벤트의 점이 옛 판 자리로 바뀌었다 — 느린 WebKit 에서 board-pencil 2) «every point lies on the pencil line» 이 가끔 실패한 까닭. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
function fnAt(src,start){const i=src.indexOf(start);assert.ok(i>=0,start);let j=src.indexOf('{',i),d=0;for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)break;}return src.slice(i,j+1);}

function sandbox(){
  /* 2D 판 — drawLayer 의 화면 행렬은 «판을 다시 놓으면» 바뀐다(shift) */
  const box={shift:0,measured:0};
  const ctm=()=>{box.measured++;const s=box.shift;return {inverse:()=>({s})};};
  const ctx=vm.createContext({
    box,
    document:{body:{classList:{contains:()=>false}}},
    drawLayer:{getScreenCTM:ctm},
    svg:{createSVGPoint:()=>({x:0,y:0,matrixTransform(inv){return {x:this.x,y:this.y-inv.s};}})},
    worldClamp:(x,y)=>({x,y}),
    clientToUnit:()=>{throw Error('fallback not expected');},
    requestAnimationFrame:()=>1,   /* 프레임은 오지 않는다(느린 WebKit) — 투영이 프레임에 기대면 영영 남는다 */
    _inkPenSeen(){},_inkHoverOff(){},beginDraw(u){ctx.began=u;},Date
  });
  vm.runInContext('var _inkMap=null,_inkMapRaf=0,_drawPid=null,_drawPtype="",_inkLastAt=0,_penSeen=true,_inkPred=null;\n'
    +fnAt(board,'function _inkMapper(){')+'\n'+fnAt(board,'function _inkUnitAt(')+'\n'+fnAt(board,'function _inkBegin(')
    +'\nthis.at=_inkUnitAt;this.begin=_inkBegin;',ctx);
  return ctx;
}

test('one event measures once; the next event measures again even with no animation frame in between',async()=>{
  const c=sandbox();
  assert.equal(c.at(100,300).y,300);assert.equal(c.at(110,300).y,300);
  assert.equal(c.box.measured,1,'coalesced points of one event share one measurement');
  c.box.shift=40;   /* 한 이벤트 안에서는 그대로(그 사이에 판이 움직일 수 없다) */
  await Promise.resolve();   /* 다음 이벤트 — 프레임은 아직 */
  assert.equal(c.at(120,300).y,260,'the later event is converted on the board as it is now, not with the old measurement');
  assert.equal(c.box.measured,2);
});

test('a new stroke measures the board afresh (the first pencil touch can change the dock in the same event)',()=>{
  const c=sandbox();
  c.at(100,300);c.box.shift=25;
  c.begin({pointerId:7,pointerType:'pen'},{x:0,y:0});
  assert.equal(c.at(100,300).y,275,'points after pointerdown use a measurement taken after it');
});

test('the projection is no longer kept until the next frame',()=>{
  const src=fnAt(board,'function _inkMapper(){');
  assert.doesNotMatch(src,/requestAnimationFrame/,'no frame-long cache');
  assert.doesNotMatch(board,/_inkMapRaf/);
  assert.match(src,/Promise\.resolve\(\)\.then\(function\(\)\{_inkMap=null;\}\);/,'cleared once the current event is handled');
  assert.match(fnAt(board,'function _inkBegin('),/_inkMap=null;/);
});

/* 3.319 — 작전판 경계: 토큰(선수 · 코치 · 장비 · 공)은 **보이는 판(운동장 + 여백)** 밖으로 나가지 않는다(사용자 11/18 «토큰이 밖으로 벗어나지 않게» → «판 안(여백 포함)»).
   · 판 = board.html 이 viewBox 를 맞출 때 적는 window.__psBoardBox = [x, y, w, h](FILL_X · FILL_Y · FILL_W · FILL_H, 운동장 좌표). 여백 · 아래 대기 줄도 판 안이다.
   · 끌기(applyDragMove) · 묶음 끌기 · 방향키 이동이 이 모듈로 자리를 자른다. 토큰 원(반지름 21 × 배율)이 판 안에 다 보이는 자리까지.
   · 불러오기 · 되살리기 · 장면 보간은 손대지 않는다(저장된 자리는 사람이 옮길 때만 바뀐다). 판이 토큰보다 작으면(폰 가로 등) 가운데로.
   · 이미 판 밖에 있던 묶음(예전 자료)은 더 막지 않는다 — 안쪽으로 끌어올 수 있어야 한다. */
(function(root,factory){
  var api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.PSBoardBounds=api;
})(typeof window==='undefined'?null:window,function(root){
  'use strict';
  function box(w){var b=(w||root)&&(w||root).__psBoardBox;return (b&&b.length===4&&+b[2]>0&&+b[3]>0)?b:null;}
  function span(lo,hi,mid){return hi<lo?[mid,mid]:[lo,hi];}
  /* 한 점을 판 안으로(제자리에서 고친다). r = 토큰 반지름(운동장 단위) */
  function clampTo(pt,r,w){
    var b=box(w);if(!b||!pt)return pt;r=+r>0?+r:0;
    var xs=span(b[0]+r,b[0]+b[2]-r,b[0]+b[2]/2),ys=span(b[1]+r,b[1]+b[3]-r,b[1]+b[3]/2);
    if(pt.x<xs[0])pt.x=xs[0];else if(pt.x>xs[1])pt.x=xs[1];
    if(pt.y<ys[0])pt.y=ys[0];else if(pt.y>ys[1])pt.y=ys[1];
    return pt;
  }
  /* 여럿을 같은 (dx, dy) 로 옮길 때, 하나라도 판을 벗어나지 않는 (dx, dy). items = [{x, y, …}], rOf(item) = 반지름 */
  function clampDelta(items,dx,dy,rOf,w){
    var b=box(w);if(!b)return {x:dx,y:dy};
    var lo=-Infinity,hi=Infinity,lo2=-Infinity,hi2=Infinity,n=0;
    (items||[]).forEach(function(it){
      if(!it||typeof it.x!=='number'||typeof it.y!=='number')return;
      var r=rOf?(+rOf(it)||0):0;n++;
      lo=Math.max(lo,b[0]+r-it.x);hi=Math.min(hi,b[0]+b[2]-r-it.x);
      lo2=Math.max(lo2,b[1]+r-it.y);hi2=Math.min(hi2,b[1]+b[3]-r-it.y);
    });
    if(!n)return {x:dx,y:dy};
    return {x:fit(dx,lo,hi),y:fit(dy,lo2,hi2)};
  }
  function fit(d,lo,hi){if(hi<lo)return d;return d<lo?lo:(d>hi?hi:d);}   /* 묶음이 판보다 넓거나 이미 밖이면 막지 않는다 */
  return {box:box,clampTo:clampTo,clampDelta:clampDelta};
});

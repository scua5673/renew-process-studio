'use strict';
/* 2.924 — 애니메이션 재생(장면 사이 이동) 중에도 공 크기를 지킨다.
   전엔 renderInterp 가 본 공을 {x,y} 로만 다시 만들어, 크기를 키운 공이 움직이는 동안 기본 크기로 돌아갔다가 도착하면 커졌다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
function load(){
  const i=src.indexOf('function renderInterp(a,b,u,curves){');assert.ok(i>0);
  let j=src.indexOf('{',i),depth=0;for(;j<src.length;j++){if(src[j]==='{')depth++;else if(src[j]==='}'&&--depth===0)break;}
  const ctx=vm.createContext({state:{},sel:null,__ballAirS:{},dc:x=>JSON.parse(JSON.stringify(x)),lerp:(a,b,u)=>a+(b-a)*u,
    _curvePt:(x0,y0,x1,y1,c,u)=>({x:x0+(x1-x0)*u,y:y0+(y1-y0)*u}),ballRollTrack(){},normPitchView:v=>v,applyView(){},renderTokens(){},renderDrawings(){},
    _interpDrawings:()=>[],trailTick(){},window:{},Math,Object});
  vm.runInContext(src.slice(i,j+1)+';this.renderInterp=renderInterp;',ctx);
  return ctx;
}
const base={players:[],equipment:[],drawings:[]};
test('크기를 키운 공은 이동하는 동안에도 그 크기',()=>{
  const c=load();
  c.renderInterp({...base,ball:{x:0,y:0,scale:2,trail:2}},{...base,ball:{x:100,y:50,scale:2,trail:2}},0.5);
  assert.equal(c.state.ball.scale,2);assert.equal(c.state.ball.x,50);assert.equal(c.state.ball.y,25);
  assert.equal(c.state.ball.trail,2,'잔상 같은 공 속성도 이동 중에 남는다');
});
test('장면마다 크기가 다르면 선수처럼 이동하며 서서히 바뀐다',()=>{
  const c=load();
  c.renderInterp({...base,ball:{x:0,y:0,scale:2}},{...base,ball:{x:100,y:0,scale:1}},0.5);
  assert.equal(c.state.ball.scale,1.5);
  c.renderInterp({...base,ball:{x:0,y:0}},{...base,ball:{x:100,y:0}},0.5);
  assert.equal(c.state.ball.scale,1,'크기를 안 바꾼 공은 기본 크기');
});
test('도착 순간은 도착 장면의 공 그대로',()=>{
  const c=load();
  c.renderInterp({...base,ball:{x:0,y:0,scale:1}},{...base,ball:{x:100,y:0,scale:1.8}},1);
  assert.equal(c.state.ball.scale,1.8);assert.equal(c.state.ball.x,100);
});

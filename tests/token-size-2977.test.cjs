'use strict';
/* 2.977 — 사용자 «기본 토큰 크기 2단계 작게 · 볼만 선수토큰보다 1단계 크게» → «크기 안 바꾼 보드도» · «장비도 작게».
   기본 = 예전 기본에서 사다리 두 칸 아래(÷1.55). 사다리는 아래로 두 칸 늘었을 뿐이라 «＋» 두 번이면 예전 크기, 그 위는 예전 그대로.
   예전 기본 그대로인 옛 보드는 새 기본으로 읽고, 이 판부터 저장하는 스냅엔 tokV:2 를 붙여 다시 옮기지 않는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,b);return source.slice(i,j);};
const J=x=>JSON.parse(JSON.stringify(x));

function ctx(width,height,store){
  const ls={_m:Object.assign({},store||{}),getItem(k){return k in this._m?this._m[k]:null;},setItem(k,v){this._m[k]=String(v);}};
  const c={Math,JSON,Number,String,Object,Array,isNaN,isFinite,parseFloat,localStorage:ls,window:{innerWidth:width,innerHeight:height,__chip3d:false,__grassM:0,__trainGridM:'def'},
    state:{label:'num',lines:true,gridType:'grid15',tokenScale:0},BALL_SVG_INNER:{'1970':'<g/>'},curBallStyle:'1970',document:{body:{classList:{contains:()=>false}}}};
  vm.createContext(c);
  vm.runInContext('var tokShape="circle";'+slice('function _tokOldDefault(){','function resetTokenSize(){')
    +slice('function tokScaleLevels(){','function scaleAll(f){')
    +slice('function lookKeys(){','window.__lookNow=function(){'),c);
  return c;
}

test('the default is two ladder steps below the old one on every device, and «＋» twice lands on the old size',()=>{
  for(const [w,h,old,now] of [[1280,800,.55,.355],[393,852,.6,.387],[834,1194,.7,.452]]){
    const c=ctx(w,h);
    assert.equal(c.defaultTokenScale(),now,w+'px');
    const L=J(c.tokScaleLevels().map(v=>Math.round(v*100)/100));   /* scaleAll 이 두 자리로 맞춘다 */
    assert.equal(L.length,7);
    assert.equal(L[0],Math.round(now*100)/100,'[0] = new default (still the minimum)');
    assert.equal(L[2],old,'[2] = the old default');
    assert.deepEqual(L.slice(2),[old,old*1.25,old*1.55,old*1.9,old*2.3].map(v=>Math.round(v*100)/100),'the old ladder above, the same maximum');
  }
});

test('an old board left at the old default reads as the new default; a board the coach enlarged keeps its size',()=>{
  const c=ctx(1280,800);
  assert.equal(c.lookOf({tokenScale:.55}).tokenScale,.355,'desktop default → new default');
  assert.equal(c.lookOf({tokenScale:.6}).tokenScale,.387);assert.equal(c.lookOf({tokenScale:.7}).tokenScale,.452,'made on a tablet → that device’s new default');
  for(const v of [.69,.85,1.05,.75,.93,.88,1.27])assert.equal(c.lookOf({tokenScale:v}).tokenScale,v,'enlarged '+v+' stays');
  assert.equal(c.lookOf({}).tokenScale,.355,'no size saved → the default');
  assert.equal(c.lookOf({tokenScale:.55,tokV:2}).tokenScale,.55,'saved from this version («＋» twice) is never moved again');
});

test('every saved look carries tokV:2, so the old-default rule only ever touches boards saved before 2.977',()=>{
  const c=ctx(1280,800);c.state.tokenScale=.55;
  const lk=J(c.lookNow());
  assert.equal(lk.tokV,2);assert.equal(lk.tokenScale,.55);
  assert.equal(c.lookOf(Object.assign({},lk)).tokenScale,.55,'round trip keeps a chosen 0.55');
  assert.match(slice('function captureSnap(){','const BOARD_DEFAULT_KEY='),/var __lk=lookNow\(\);for\(var __k in __lk\)__cs\[__k\]=__lk\[__k\];/,'captureSnap takes every look key, tokV too');
  assert.match(slice('function lookStampScenes(){','window.__lookNow='),/for\(var k in lk\)sn\[k\]=lk\[k\];/,'scene stamping writes tokV with the size');
  assert.match(slice('function boardDefaultSnap(src){','function boardDefaultRead(){'),/tokV:src\.tokV/);
  assert.match(slice('  function blankSnap(){','  function loadIdx(i,keep){'),/tokV:s\.tokV/,'a new page keeps the mark');
});

test('saved «기본 세팅» and the old device value follow the same rule',()=>{
  let c=ctx(1280,800,{cs_board_default_v1:JSON.stringify({snap:{tokenScale:.55}})});
  assert.equal(c.lookDefault('tokenScale'),.355);
  c=ctx(1280,800,{cs_board_default_v1:JSON.stringify({snap:{tokenScale:.55,tokV:2}})});
  assert.equal(c.lookDefault('tokenScale'),.55);
  c=ctx(1280,800,{cs_tokscale_v4:'0.55'});
  assert.equal(c.lookDefault('tokenScale'),.355,'old device size at the old default');
  c=ctx(1280,800,{cs_tokscale_v4:'0.85'});
  assert.equal(c.lookDefault('tokenScale'),.85,'old device size the coach chose');
});

test('playback, onion ghosts and the «22명이 점처럼» floors follow the new size',()=>{
  assert.match(source,/state\.tokenScale=\(\(typeof _tokMig==="function"\)\?_tokMig\(a\.tokenScale,a\):a\.tokenScale\)\|\|1;/,'scenes of an old board do not jump back to the old size while playing');
  assert.match(source,/const sc=\(\(typeof _tokMig==="function"\)\?_tokMig\(snap\.tokenScale,snap\):snap\.tokenScale\)\|\|1;/);
  assert.equal((source.match(/<0\.4\)state\.tokenScale=0\.4/g)||[]).length,0,'no hard 0.4 floor above the new default');
  assert.equal((source.match(/var _tf=Math\.min\(0\.4,defaultTokenScale\(\)\);if\(\(state\.tokenScale\|\|1\)<_tf\)state\.tokenScale=_tf;/g)||[]).length,4);
});

test('phones shrink the ball with the players, so it stays one step bigger there too',()=>{
  assert.match(slice('function phoneTokFactor(p){','\n'),/\(p\.team==="ball"\|\|!equipKey\(p\.team\)\)&&p\.team!=="img"/);
});

test('3.009 the name label can sit above the head — a per-board look setting',()=>{
  const fs=require('fs'),path=require('path');const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
  assert.match(src,/function lookKeys\(\)\{return \[[^\]]*"namePos"[^\]]*\]/,'saved with the board look');
  assert.match(src,/case "namePos":return "below";/,'below stays the default');
  assert.match(src,/case "namePos":return v==="below"\|\|v==="above";/);
  assert.match(src,/id="namePosSeg"[\s\S]{0,300}data-np="below"[^>]*>아래<[\s\S]{0,200}data-np="above"[^>]*>위</,'settings row');
  assert.match(src,/grassTone:src\.grassTone,namePos:src\.namePos[,}]/,'기본 세팅 snapshot carries it');
  assert.match(src,/grassTone:s\.grassTone,namePos:s\.namePos,/,'a new page keeps it');
});
test('3.010 name label size and style — per-board look settings, flat and 3D',()=>{
  const fs=require('fs'),path=require('path');const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
  assert.match(src,/function lookKeys\(\)\{return \[[^\]]*"nameSize","nameStyle"[^\]]*\]/,'saved with the board look');
  assert.match(src,/case "nameSize":return "m"; case "nameStyle":return "auto";/,'defaults: normal size, the old look');
  assert.match(src,/case "nameSize":return v==="s"\|\|v==="m"\|\|v==="l"; case "nameStyle":return v==="auto"\|\|v==="pill"\|\|v==="text";/);
  assert.match(src,/function _nameK\(\)\{ var v=window\.__nameSize; return v==="s"\?0\.8:\(v==="l"\?1\.25:1\); \}/,'0.8 · 1 · 1.25');
  assert.match(src,/id="nameSizeSeg"[\s\S]{0,200}data-ns="s"[^>]*>작게<[\s\S]{0,200}data-ns="m"[^>]*>보통<[\s\S]{0,200}data-ns="l"[^>]*>크게</,'size row');
  assert.match(src,/id="nameStyleSeg"[\s\S]{0,200}data-nt="auto"[^>]*>기본<[\s\S]{0,200}data-nt="pill"[^>]*>알약<[\s\S]{0,200}data-nt="text"[^>]*>글자만</,'style row');
  assert.match(src,/if\(!_nt\)g\.appendChild\(el\("rect"/,'«글자만» draws no pill');
  assert.match(src,/nameK:_nameK\(\),nameStyle:window\.__nameStyle==="pill"\?"pill":"text"/,'3D: «기본» stays an outlined name, «알약» puts it on a pill');
  assert.match(src,/namePos:src\.namePos,nameSize:src\.nameSize,nameStyle:src\.nameStyle\}/,'기본 세팅 snapshot carries them');
  assert.match(src,/namePos:s\.namePos,nameSize:s\.nameSize,nameStyle:s\.nameStyle,/,'a new page keeps them');
});

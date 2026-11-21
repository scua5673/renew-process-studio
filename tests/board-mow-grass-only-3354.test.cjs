// 3.354 — 사용자 11/21 «3d여도 보드설정에서 잔디말고는 잔디결이 표현되지 않게».
// 3D 의 깎은 줄 · 잎결은 보드 설정 › 피치가 «잔디»(real)일 때만. 딥그린 · 네이비 · 화이트 · 훈련 · 직접 색은 한 색.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const Look=require('../studio/board-pitch-look.js'),G=require('../studio/board-stadium-ground.js');
const MD={ga:'#2c6a2a',gb:'#367a33'},css=k=>({'--grass-a':'#20243f','--grass-b':'#15172b','--pitchbg':'#445566'})[k]||'';

test('잔디 피치만 잔디결을 그린다 — 다른 피치는 무늬 none · turf false',()=>{
  const real=Look.pitchLook(MD,'',{key:'real',css,mow:'band',gap:4});
  assert.equal(real.turf,true);assert.equal(real.mow,'band');assert.match(real.sig,/\|band:4$/);
  for(const key of ['calm','navy','white','train','custom']){
    const p=Look.pitchLook(MD,'',{key,css,mow:'band',gap:4});
    assert.equal(p.turf,false,key);assert.equal(p.mow,'none',key);assert.equal(p.gap,'',key);assert.match(p.sig,/\|none$/,key);
    assert.equal(p.sig,Look.pitchLook(MD,'',{key,css,mow:'ring',gap:6}).sig,key+' — 무늬를 바꿔도 다시 그릴 것이 없다');
  }
});

test('mowPlan kind none — 덧칠 없는 빈 무늬 · 두 색 줄 없음(운동장 하나 · 여럿)',()=>{
  const one=G.mowPlan({multi:false,L:30,T:30,m:10,len:105,pw:1050,ph:680,kind:'none'});
  assert.equal(one.two,0);assert.doesNotMatch(one.defs,/fill-opacity/);assert.doesNotMatch(one.grass('#111111','#222222'),/#222222/);
  const many=G.mowPlan({multi:true,cards:[[0,0,300,450],[320,0,150,220]],len:105,L:0,T:0,m:4,kind:'none'});
  assert.equal(many.cards,'');
});

test('작전판 배선 — 3D 바닥은 pk.turf 로 깎은 줄과 잎결을 정한다',()=>{
  const b=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  assert.match(b,/f:f,kind:pk\.turf\?'':'none'\}\),grain=pk\.turf&&!!PSStadiumGround\.grainTile\(\)/);
});

// 3.354 — 사용자 11/21 «3d여도 보드설정에서 잔디말고는 … 잔디같이 표현한거 그냥 평평하게».
// 3D 에서 잔디처럼 그리는 것(잎결 · 닳은 자국)은 보드 설정 › 피치가 «잔디»(real)일 때만. 고른 잔디 무늬(깎은 줄)는 어느 피치에서나 그대로.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const Look=require('../studio/board-pitch-look.js');
const MD={ga:'#2c6a2a',gb:'#367a33'},css=k=>({'--grass-a':'#20243f','--grass-b':'#15172b','--pitchbg':'#445566'})[k]||'';

test('잔디 피치만 잔디처럼 — 다른 피치는 turf · grass 거짓, 무늬는 그대로',()=>{
  const real=Look.pitchLook(MD,'',{key:'real',css,mow:'band',gap:4});
  assert.equal(real.turf,true);assert.equal(real.grass,true);assert.equal(real.mow,'band');
  for(const key of ['calm','navy','white','train','custom']){
    const p=Look.pitchLook(MD,'',{key,css,mow:'band',gap:4});
    assert.equal(p.turf,false,key);assert.equal(p.grass,false,key);assert.equal(p.mow,'band',key+' — 고른 무늬는 그대로');assert.match(p.sig,/\|band:4$/,key);
  }
});

test('작전판 배선 — 3D 바닥의 잎결은 pk.turf · 닳은 자국은 pk.grass',()=>{
  const b=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  assert.match(b,/grain=pk\.turf&&!!PSStadiumGround\.grainTile\(\)/);
  assert.match(b,/ring\(bt,dT,pk\.turf\?'#173a20':pk\.gb\)/,'둘레 띠 — 잔디는 초록, 색 피치는 피치의 어두운 색');assert.match(b,/ring\(0,dT,pk\.turf\?'#0b2410':'#000',\.18\)/);assert.match(b,/if\(!whole&&pk\.grass\)/);
});

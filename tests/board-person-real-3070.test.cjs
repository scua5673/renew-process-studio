'use strict';
/* 3.070 — 사용자 «보드설정에 실제운동장과 토큰 비율을 실제와 똑같은 것도» · «사람모양은 3d 모드로 실제 사람처럼» */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const depth=require('../studio/board-token-depth.js');
const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');

test('real-scale chips are not enlarged, and their names keep the ordinary on-screen size',()=>{
  const real=10/84,normal=.355,base=depth.chipSize({unit:normal,pitch:1050});
  const r=depth.chipSize({unit:real,nameUnit:normal,pitch:1050,real:true});
  assert.equal(r.k,1,'the token is already its real size');
  assert.ok(Math.abs(r.font*real-base.font*base.k*normal)<.05,'name drawn as large as on an ordinary board');
  assert.equal(depth.PERSON_M,84);assert.equal(depth.PERSON_H,151,'1.8 m tall at 84 units per metre');
});
test('«사람» is a board look shape and «실제 비율» a per-board look setting',()=>{
  assert.match(board,/<button data-s="person"[^>]*>사람<\/button>/);
  assert.match(board,/case "tokShape":return v==="shirt"\|\|v==="circle"\|\|v==="shaper"\|\|v==="person";/);
  assert.match(board,/function lookKeys\(\)\{return \[[^\]]*"realScale"\](\.concat\(Object\.keys\(window\.__psLookExt\|\|\{\}\)\))?;\}/);   /* 3.087 — 모듈이 더하는 설정(window.__psLookExt) */
  assert.match(board,/id="realScaleSeg"[\s\S]{0,200}data-rs="0"[^>]*>보기 좋게<[\s\S]{0,300}data-rs="1"[^>]*>실제 비율</);
  /* 1m = mppNow() units: player body 0.5 m wide (r 21 → 84 units/m), ball 22 cm across; equipment keeps its size */
  assert.match(board,/if\(p\.team==="ball"\)return m\*0\.11\/REAL_BALL_R\*k\(1\);\n  if\(p\.team==="img"\|\|equipKey\(p\.team\)\)return 0;\n  return m\/REAL_TOK_M\*k\(0\); \}/);
  assert.match(board,/function tokenTransform\(p\)\{const s=_realTokS\(p\)\|\|_normTokS\(p\);/);
  assert.match(board,/shape:sh\?"shaper":\(\(tokShape==="person"&&!p\.shaper\)\?"person":/,'3D draws the standing player');
});

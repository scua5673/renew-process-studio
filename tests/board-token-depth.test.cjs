const test=require('node:test'),assert=require('node:assert/strict');
const depth=require('../studio/board-token-depth.js');
test('token elevation compensates rotation without modifying document position',()=>{
  for(const angle of [0,45,90,180,270,-30]){
    const d=depth.elevation(angle,13),r=angle*Math.PI/180;
    assert.ok(Math.abs(d.x*Math.cos(r)-d.y*Math.sin(r))<1e-9);
    assert.ok(Math.abs(d.x*Math.sin(r)+d.y*Math.cos(r)+13)<1e-9);
  }
});

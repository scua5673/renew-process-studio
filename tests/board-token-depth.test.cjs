const test=require('node:test'),assert=require('node:assert/strict');
const depth=require('../studio/board-token-depth.js');
test('token elevation compensates rotation without modifying document position',()=>{
  for(const angle of [0,45,90,180,270,-30]){
    const d=depth.elevation(angle,13),r=angle*Math.PI/180;
    assert.ok(Math.abs(d.x*Math.cos(r)-d.y*Math.sin(r))<1e-9);
    assert.ok(Math.abs(d.x*Math.sin(r)+d.y*Math.cos(r)+13)<1e-9);
  }
});
test('3.009 stadium chip keeps a readable size on the 3D view without shrinking large tokens',()=>{
  // Desktop default token (0.355) on an 11-a-side pitch (1050 units): the chip's radius is 1.2% of the pitch length
  // (3.009 first used 1.7% — «the smallest size is too big»), the name stays 1.35%.
  const small=depth.chipSize({unit:.355,pitch:1050});
  assert.ok(Math.abs(21*small.k*.355-1050*.012)<.05);
  assert.ok(Math.abs(small.font*.355*small.k-1050*.0135)<.05,'name is 1.35% of the pitch length');
  // Phone-sized or enlarged tokens are never drawn smaller than their flat token.
  assert.equal(depth.chipSize({unit:1.4,pitch:1050}).k,1);
  assert.equal(depth.chipSize({unit:1.4,pitch:1050}).font,15);
  // Tiny tokens are capped so a chip never grows into a disc.
  assert.equal(depth.chipSize({unit:.05,pitch:1050}).k,3.2);
  // Missing options fall back to the plain chip.
  assert.deepEqual(depth.chipSize(null),{k:1,font:15});
});
test('3.009 board size steps scale the 3D chip from its default size',()=>{
  const ref=.355,base=depth.chipSize({unit:ref,ref,pitch:1050});
  for(const step of [1.25,1.55,2.3]){
    const s=depth.chipSize({unit:ref*step,ref,pitch:1050});
    assert.ok(Math.abs((21*ref*step*s.k)/(21*ref*base.k)-step)<1e-9,'chip radius follows the size step '+step);
    assert.ok(Math.abs((s.font*ref*step*s.k)/(base.font*ref*base.k)-step)<1e-9,'name follows the size step '+step);
  }
});

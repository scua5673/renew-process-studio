const {test}=require('node:test');
const assert=require('node:assert/strict');
const {worldFrame,fit}=require('../studio/board-multipitch.js');
test('rotated viewport maps back to the unchanged world frame',()=>{
  assert.deepEqual(worldFrame([0,0,740,1110],{a:0,b:-1,c:1,d:0,e:0,f:1110}),[0,0,1110,740]);
  assert.deepEqual(worldFrame([0,0,740,1110],{a:0,b:1,c:-1,d:0,e:740,f:0}),[0,0,1110,740]);
  assert.deepEqual(worldFrame([0,0,1110,740],null),[0,0,1110,740]);
});
test('pitch cells contain centered undistorted configured pitches',()=>{
  for(const [len,wid] of [[105,68],[65,48],[40,20]])for(const [w,h] of [[750,688],[340,688],[510,330]]){
    const box={x:20,y:30,w,h},r=fit(box,{len,wid});
    assert.ok(Math.abs(r.w/r.h-wid/len)<1e-12);
    assert.ok(r.x>=box.x&&r.y>=box.y&&r.x+r.w<=box.x+w+1e-9&&r.y+r.h<=box.y+h+1e-9);
    assert.ok(Math.abs((r.x+r.w/2)-(box.x+w/2))<1e-9);
    assert.ok(Math.abs((r.y+r.h/2)-(box.y+h/2))<1e-9);
  }
});

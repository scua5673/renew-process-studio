const test=require('node:test');
const assert=require('node:assert/strict');
const edit=require('../studio/board-training-edit.js');
test('mixed alignment translates every vertex and preserves locked positions',()=>{
  const player={x:10,y:10},cone={x:50,y:30},zone={type:'rect',pts:[{x:60,y:40},{x:80,y:60}],tk:[1,2]},locked={x:1,y:99,locked:true};
  const plan=edit.alignPlan([player,cone,zone,locked],'rowY',false);
  plan.forEach(p=>edit.translate(p.o,p.dx,p.dy));
  assert.equal(player.y,30);assert.equal(cone.y,30);assert.deepEqual(zone.pts,[{x:60,y:20},{x:80,y:40}]);assert.equal(zone.tk,undefined);assert.equal(locked.y,99);
});
test('equal spacing fixes endpoints and redistributes mixed objects',()=>{
  const a={x:0,y:4},b={type:'text',pts:[{x:10,y:9}]},c={x:100,y:3};
  edit.alignPlan([c,b,a],'distX',false).forEach(p=>edit.translate(p.o,p.dx,p.dy));
  assert.deepEqual([a.x,b.pts[0].x,c.x],[0,50,100]);assert.equal(b.pts[0].y,9);
});
test('vertical pitch alignment follows screen axes',()=>{
  const a={x:0,y:2},b={x:40,y:6};edit.alignPlan([a,b],'rowY',true).forEach(p=>edit.translate(p.o,p.dx,p.dy));assert.equal(a.x,20);assert.equal(b.x,20);assert.equal(a.y,2);
});
test('no-op, too small, linked drawings and invalid modes create no edit',()=>{
  assert.deepEqual(edit.alignPlan([{x:1,y:2},{x:3,y:2}],'rowY',false),[]);
  assert.deepEqual(edit.alignPlan([{x:1,y:2},{x:3,y:4}],'distX',false),[]);
  assert.equal(edit.center({type:'link',ids:[1,2],pts:[]}),null);
  assert.deepEqual(edit.alignPlan([{x:1,y:2},{x:3,y:4}],'invalid',false),[]);
});
test('grid phase is exact and a nearby object cannot pull an item off-grid',()=>{
  const g={x0:5,y0:8,sx:20,sy:20},r=edit.snapPoint({x:33,y:43},g,[{x:26,y:47}],{x:30,y:40},7);
  assert.deepEqual(r,{x:25,y:48,gx:25,gy:48});
});
test('object snaps choose nearest target independently on both axes',()=>{
  assert.deepEqual(edit.snapPoint({x:10,y:20},null,[{x:11,y:40},{x:30,y:23}],{x:14,y:25},7),{x:11,y:23,gx:11,gy:23});
  assert.deepEqual(edit.snapPoint({x:100,y:200},null,[],null,7),{x:100,y:200,gx:null,gy:null});
});
test('locked geometry cannot be translated and nonfinite values do not corrupt data',()=>{
  const p={x:12,y:13,locked:true};assert.equal(edit.translate(p,9,9),false);assert.equal(p.x,12);
  assert.equal(edit.translate({x:1,y:2},Infinity,0),false);assert.equal(edit.center({pts:[{x:NaN,y:2}]}),null);
});
test('text defaults preserve legacy appearance; arbitrary weights and invalid angles are normalized',()=>{
  assert.deepEqual(edit.textStyle({}),{textWeight:700,textItalic:false,textAngle:0});
  assert.deepEqual(edit.textStyle({textWeight:999,textItalic:'true',textAngle:500}),{textWeight:700,textItalic:false,textAngle:180});
  assert.equal(edit.textStyle({textAngle:'NaN'}).textAngle,0);
});
test('bib is a separate validated overlay; removing it preserves kit and identity',()=>{
  const p={team:'blue',num:7,color:'#123456',bib:'#FACC15'};assert.equal(edit.bibColor(p),'#facc15');delete p.bib;assert.equal(p.color,'#123456');assert.equal(p.team,'blue');
  assert.equal(edit.bibColor({bib:'url(https://invalid)'}),'');assert.equal(edit.bibColor({coach:true,bib:'#facc15'}),'');
});
test('rotated text hit testing and resize use the displayed horizontal axis',()=>{
  const d={pts:[{x:100,y:200}],textAngle:90};
  const p=edit.textPoint(d,{x:100,y:240},false,false);assert.ok(Math.abs(p.x-40)<1e-8);assert.ok(Math.abs(p.y)<1e-8);
  const v=edit.textPoint({...d,textAngle:0},{x:100,y:160},true,true);assert.ok(Math.abs(v.x-40)<1e-8);assert.ok(Math.abs(v.y)<1e-8);
});

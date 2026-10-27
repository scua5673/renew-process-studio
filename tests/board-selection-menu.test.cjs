const test=require('node:test'),assert=require('node:assert/strict');
const {placement}=require('../studio/board-selection-menu.js');
const edit=require('../studio/board-training-edit.js');
test('context menu flips and clamps above the dock',()=>{
 const area={left:12,right:1268,top:56,bottom:680},size={width:286,height:380};
 assert.deepEqual(placement({left:1100,right:1140,top:620,bottom:660},size,area),{left:802,top:300});
 assert.deepEqual(placement({left:5,right:1000,top:10,bottom:100},size,area),{left:12,top:56});
});
test('six alignment directions follow horizontal and both vertical pitch views',()=>{
 for(const vertical of [false,true])for(const flip of [false,true])for(const mode of ['minX','maxX','minY','maxY']){
  const items=[{x:10,y:20},{x:70,y:80},{x:99,y:99,locked:true}];
  edit.alignPlan(items,mode,vertical,flip).forEach(p=>edit.translate(p.o,p.dx,p.dy));
  const screen=p=>vertical?(flip?{x:-p.y,y:p.x}:{x:p.y,y:-p.x}):p,axis=mode.endsWith('X')?'x':'y';
  const originals=[{x:10,y:20},{x:70,y:80}].map(p=>screen(p)[axis]),target=mode.startsWith('min')?Math.min(...originals):Math.max(...originals);
  assert.equal(screen(items[0])[axis],target);assert.equal(screen(items[1])[axis],target);assert.deepEqual(items[2],{x:99,y:99,locked:true});
 }
});

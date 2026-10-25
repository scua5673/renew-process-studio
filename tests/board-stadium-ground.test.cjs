const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../studio/board-stadium-ground.js');
const stage={getBoundingClientRect:()=>({left:0,top:0,right:820,bottom:1180})};
const extent=(deco='grass',blank=false,unproject=(x,y)=>({x:x*3-680,y:y*2-790}))=>G.bounds(deco,blank,30,1080,40,720,71.4,64.6,40.4,stage,unproject);
test('compact stadiums cover every visible corner, in world coordinates, with an outward buffer',()=>{
  for(const deco of ['simple','grass']){
    const g=extent(deco),b=g.box;
    for(const [x,y] of [[-680,-790],[1780,-790],[1780,1570],[-680,1570]])assert.ok(b[0]<x&&b[2]>x&&b[1]<y&&b[3]>y);
    assert.equal(g.corners.length,4);assert.equal(g.key,b.join(','));
    assert.notEqual(extent(deco,false,(x,y)=>({x:x*4-680,y:y*2-790})).key,g.key,'resize changes the image content key');
  }
});
test('full stadiums and blank training grids retain their existing geometry',()=>{
  assert.equal(extent('full'),null);assert.equal(extent('grass',true),null);
});
test('the floor also covers affine SVG painting when software WebKit flattens perspective',()=>{
  const screenMatrix={inverse:()=>({a:0,b:1,c:-2,d:0,e:1350,f:-350})};
  const g=G.bounds('grass',false,30,1080,40,720,71.4,64.6,40.4,stage,(x,y)=>({x,y}),screenMatrix);
  assert.ok(g.box[0]<1350-2*1180&&g.box[1]<-350&&g.box[2]>1350&&g.box[3]>820-350);
});
test('missing projection anchors leave a finite apron, rather than an unbounded image',()=>{
  for(const unproject of [()=>null,()=>({x:Infinity,y:NaN}),()=>{throw Error('not ready');}]){
    const b=extent('simple',false,unproject).box;
    assert.ok(b.every(Number.isFinite));assert.ok(b[0]<30&&b[2]>1080&&b[1]<40&&b[3]>720);
  }
});
test('outside turf shares the field texture and mow patterns and adds only a light darkening',()=>{
  const xml=G.paint(extent(),true,{tint:['#ff9a3c',.1]});
  assert.ok(xml.includes('url(#psStGrass)')&&xml.includes('url(#psStMow)'));
  assert.ok(xml.includes('#1c7a34')&&xml.includes('fill-opacity=".14"'));
  assert.ok(!xml.includes('rx=')&&!xml.includes('psStCrowd')&&!xml.includes('psStVig'),'rectangular continuous turf, without a stadium rim');
});
test('a portrait export expands live landscape grass in rotated and flipped world coordinates',()=>{
  const visible=[-817,-1361,1867,1018];
  for(const mt of [[1,0,0,1,0,0],[0,-1,1,0,0,1110],[0,1,-1,0,740,0],[-1,0,0,-1,1110,740]]){
    const box=[-100,-100,1200,850],copy=box.slice(),e=G.cover(box,mt,visible),v=e.vb;
    assert.deepEqual(box,copy,'live bounds remain unchanged');
    assert.ok(v[0]<=visible[0]&&v[1]<=visible[1]&&v[0]+v[2]>=visible[2]&&v[1]+v[3]>=visible[3]);
  }
  assert.equal(G.cover([0,0,1,1],[0,0,0,0,0,0],visible),null);
});
test('export without an XML runtime falls back to the existing image without mutating it',()=>{
  const vb=[0,0,100,100],ground={box:[0,0,100,100],mt:[1,0,0,1,0,0]},host={__psVb:vb,__psGround:ground,getAttribute:()=> 'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E'};
  const result=G.exportView(host,[-100,-100,200,200]);
  assert.equal(result.src,host.getAttribute('src'));assert.deepEqual(result.vb,vb);assert.notEqual(result.vb,vb);assert.equal(host.__psGround,ground);
});

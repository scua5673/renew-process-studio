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
/* 3.303 — 기대를 일부러 고침: 바닥만 한 톤 어둡게(.14) 칠하던 것을 걷었다 — 운동장 둘레가 밝은 판으로 떠 보였다(사용자 «잔디만했을 때 3d 화면이 너무 이질감»). */
test('outside turf is the same sheet as the field: shared texture and mow patterns, no flat darkening of its own',()=>{
  const xml=G.paint(extent(),true,{tint:['#ff9a3c',.1]},true);
  assert.ok(xml.includes('url(#psStGrass)')&&xml.includes('url(#psStMow)')&&xml.includes('url(#psStGrain)'));
  assert.ok(xml.includes('#1c7a34'),'the same green wash as the field');
  assert.ok(!xml.includes('#071d0b')&&!xml.includes('fill-opacity=".14"'),'no flat darkening — it drew a bright plate around the pitch');
  assert.ok(!xml.includes('#ff9a3c'),'the mood tint is drawn once, above, across the whole floor');
  assert.ok(!xml.includes('rx=')&&!xml.includes('psStCrowd')&&!xml.includes('psStVig'),'rectangular continuous turf, without a stadium rim');
  assert.equal((xml.match(/<rect /g)||[]).length,4,'every layer is a rect the export can stretch');
});
test('3.303 — far(): an even glow and a seamless, eased falloff away from the pitch, scaled by the mood',()=>{
  const o=md=>({cx:555,cy:370,pw:1050,md:md,x0:-80,x1:1190,y0:-60,y1:800,s:1050});
  const night=G.far(o({vig:.62})),day=G.far(o({vig:.3}));
  for(const id of ['psStGlow','psStFar','psStEdgeX','psStEdgeY'])assert.ok(night.includes('id="'+id+'"'),id);
  assert.ok(!/id="psStGlow"[^>]*>(?:(?!<\/radialGradient>).)*stop-color="#000"/.test(night),'the glow only lightens — no dark corners inside the pitch');
  const stops=(xml,id)=>{const m=new RegExp('id="'+id+'"[^>]*>(.*?)</(?:linear|radial)Gradient>').exec(xml);return [...m[1].matchAll(/offset="([\d.]+)"[^>]*stop-opacity="([\d.]+)"/g)].map(x=>[+x[1],+x[2]]);};
  for(const id of ['psStEdgeX','psStEdgeY']){
    const st=stops(night,id),n=st.length;
    assert.ok(st.every((x,i)=>!i||x[0]>=st[i-1][0]),id+' offsets ascend');
    assert.equal(st[0][0],0);assert.equal(st[n-1][0],1);assert.equal(st[0][1],st[n-1][1],'symmetric');
    const zero=st.filter(x=>x[1]===0);assert.equal(zero.length,2,id+' flat zero across the pitch');
    assert.ok(zero[1][0]-zero[0][0]>.5,'the pitch box itself is untouched');
    const left=st.slice(0,st.indexOf(zero[0])+1).map(x=>x[1]);
    assert.ok(left.every((v,i)=>!i||v<left[i-1]),'monotonic toward the pitch');
    assert.ok(left[left.length-2]<left[0]*.15,'eased onset: the first step away from the pitch is small (no visible rim)');
  }
  const x=stops(night,'psStEdgeX'),zx=x.filter(s=>s[1]===0);
  assert.ok(Math.abs((-395+zx[0][0]*1900)-(-80))<1&&Math.abs((-395+zx[1][0]*1900)-1190)<1,'the falloff begins at the box that was passed, '+JSON.stringify(zx));
  const edge=xml=>stops(xml,'psStEdgeX')[0][1],farMax=xml=>stops(xml,'psStFar').pop()[1];
  assert.ok(edge(day)<edge(night)&&farMax(day)<farMax(night),'day is lighter than night');
  assert.ok(edge(night)<=.25&&farMax(night)<=.4,'never a black floor');
  assert.equal(stops(night,'psStFar')[0][1],0,'the far darkness starts at zero');
  assert.ok(stops(night,'psStFar')[0][0]*1.45>.55,'and outside the pitch (radius > half its length)');
  const zeroMood=G.far(o({}));assert.equal(farMax(zeroMood),0);assert.equal(edge(zeroMood),0);
});
test('3.303 — shade(): three fills of one path (two crossing bands and a round falloff) — no abutting pieces, no seams',()=>{
  const xml=G.shade('M0 0H9V9Z');
  assert.deepEqual([...xml.matchAll(/fill="url\(#(\w+)\)"/g)].map(m=>m[1]),['psStEdgeX','psStEdgeY','psStFar']);
  assert.equal((xml.match(/d="M0 0H9V9Z"/g)||[]).length,3);
});
test('3.303 — 작전판 배선: 바닥에서는 빛 · 색조 · 노을이 판 밖까지, 조명 기둥 없음, 전체 경기장 · 그리드 판은 그대로',()=>{
  const b=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','studio','board.html'),'utf8');
  assert.match(b,/if\(ground\)o\+=PSStadiumGround\.paint\(ground,turf,md,grain\);\n    const gW=ground\?S\*40:0; if\(ground\)o\+=PSStadiumGround\.far\(\{cx:CX,cy:CY,pw:PW,md:md,f:f,x0:L-gx-dT,x1:R\+gx\+dT,y0:T-gy-dT,y1:B\+gy\+dT,s:S\}\);/);
  assert.match(b,/\+'<path d="'\+rr\(gW\)\+'" fill="url\(#'\+\(ground\?'psStGlow':'psStLight'\)\+'\)"\/>';/,'even glow on the floor · the stadium keeps psStLight');
  assert.match(b,/if\(md\.tint\)o\+='<path d="'\+rr\(gW\)\+'" fill="'\+md\.tint\[0\]\+'" fill-opacity="'\+md\.tint\[1\]\+'"\/>';/);
  assert.match(b,/if\(md\.cone>0&&!ground\)\{/);
  assert.match(b,/\(ground\?PSStadiumGround\.shade\(rr\(gW\)\):'<path d="'\+rr\(dE\)\+'" fill="url\(#psStVig\)"\/>'\)/);
  assert.match(b,/\+'<path d="'\+rr\(0\)\+'" fill="url\(#psStGrass\)"\/>'/,'the pitch plate itself is still painted (same pattern, same origin)');
  assert.ok(require('node:fs').readFileSync(require('node:path').join(__dirname,'browser','run-critical.mjs'),'utf8').includes("'board-grass-natural-3303'"));
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

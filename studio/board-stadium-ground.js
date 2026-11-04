/* One cached stadium image for the screen and 3D export. Ground bounds follow
   the visible floor, without changing pitch fitting or player coordinates. */
(function(root,factory){var api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PSStadiumGround=api;})(typeof window!=='undefined'?window:null,function(W){
'use strict';
var _crowdTiles={};
function crowdTile(teamCol){ var key=String(teamCol||"");
  if(_crowdTiles[key]!=null)return _crowdTiles[key];
  try{
    const c=W.document.createElement('canvas');c.width=100;c.height=96;const g=c.getContext('2d');
    let seed=20261013;const rnd=()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
    const shirts=['#1a1c22','#22262e','#2a2d35','#e9eaec','#2b3f6b','#a4262d','#c8ccd2','#3b4a34','#d39a1c','#173a63','#5b2026','#7d8590'];
    if(/^#[0-9a-f]{6}$/i.test(key))for(let i=0;i<6;i++)shirts.push(key);
    const skin=['#e0b48f','#c99872','#8e5f3f','#f1cfb0','#4a3022','#1d1714'];
    g.fillStyle='#141b22';g.fillRect(0,0,100,96);
    for(let r=0;r<6;r++)for(let k=0;k<10;k++){const x=k*10,y=r*16;
      g.fillStyle='#2a3542';g.fillRect(x+1,y+9,8,5);
      if(rnd()<.85){g.fillStyle=shirts[Math.floor(rnd()*shirts.length)];g.beginPath();g.ellipse(x+5+(rnd()-.5)*2,y+9,4.2,4.6,0,0,7);g.fill();
        g.fillStyle=skin[Math.floor(rnd()*skin.length)];g.beginPath();g.arc(x+5+(rnd()-.5)*1.5,y+4.5,2.3,0,7);g.fill();}}
    _crowdTiles[key]=c.toDataURL('image/png');
  }catch(_){_crowdTiles[key]='';}
  return _crowdTiles[key];
}
/* 3.255 — 잔디결(사용자 «잔디 결이 제대로 표현되게», 3D 운동장 5개 화면).
   ① grainTile: 깎는 방향으로 난 짧은 잎결(밝고 어두운 줄기). 큰 얼룩은 넣지 않는다(8m 칸마다 되풀이돼 칸이 보인다). 가장자리를 감아 그려 이음새가 없고 고정 시드라 늘 같다.
      잔디 사진 타일(10m)은 줄 방향으로 이어지지 않아 10m마다 가로 자국이 남아, 세로 판 · 여러 운동장에서 줄과 엇갈린 바둑판이 보였다.
   ② mowPlan: 깎은 줄은 골라인에 나란한 띠. 운동장 하나는 예전 그대로(골라인 L 에서 5m씩, x 방향 — psStMow).
      여러 운동장은 카드마다(골대가 카드 위 · 아래 = y 방향) 제 골라인에서 홀수 개 띠라 가운데 띠가 하프라인에 걸친다.
      예전엔 경기장 전체에 x 방향 한 장이라 카드에선 줄이 터치라인과 나란했고, 크기가 다른 카드끼리 줄이 안 맞았다. 카드 사이 잔디는 줄 없이 결만.
      그때 psStMow 는 빈 무늬(이름을 쓰는 곳 · 시험은 그대로). 카드 띠는 «간단 · 잔디만»의 바닥 묶음([data-ps-ground] — 영상이 사각형을 늘린다) 밖에 그린다. */
var _grain=null,GRAIN_V=1;
function grainTile(){
  if(_grain!=null)return _grain;
  try{
    const N=256,c=W.document.createElement('canvas');c.width=N;c.height=N;const g=c.getContext('2d');
    let seed=20261104;const rnd=()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
    const wrap=(x,y,r,fn)=>{for(const dx of [0,-N,N])for(const dy of [0,-N,N]){if(x+dx+r<0||x+dx-r>N||y+dy+r<0||y+dy-r>N)continue;fn(x+dx,y+dy);}};
    g.lineCap='round';
    for(let i=0;i<2400;i++){const x=rnd()*N,y=rnd()*N,len=5+rnd()*17,lean=(rnd()-.5)*2.4,a=.05+rnd()*.08,light=rnd()<.5,w=rnd()<.75?.9:1.5;
      wrap(x,y,len+2,(px,py)=>{g.strokeStyle=(light?'rgba(232,255,214,':'rgba(6,24,8,')+a+')';g.lineWidth=w;g.beginPath();g.moveTo(px,py);g.lineTo(px+lean,py+len);g.stroke();});}
    _grain=c.toDataURL('image/png');
  }catch(_){_grain='';}
  return _grain;
}
/* o = {multi, cards:[[x,y,w,h]…], len(규격 길이 m), L, T, m(1m), f(반올림)} → {defs(psStMow 포함), cards(카드 띠 rect), rot(잎결 방향 — 깎는 방향)} */
function mowPlan(o){
  const f=o.f||(n=>Math.round(n*10)/10),DK='.07',LT='.06';
  const cards=(o.cards||[]).filter(r=>Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r[2]>0&&r[3]>0);
  if(!o.multi||!cards.length){const m=o.m;
    return {rot:0,cards:'',defs:'<pattern id="psStMow" patternUnits="userSpaceOnUse" x="'+f(o.L)+'" y="'+f(o.T)+'" width="'+f(10*m)+'" height="'+f(10*m)+'"><rect width="'+f(5*m)+'" height="'+f(10*m)+'" fill="#000" fill-opacity="'+DK+'"/><rect x="'+f(5*m)+'" width="'+f(5*m)+'" height="'+f(10*m)+'" fill="#fff" fill-opacity="'+LT+'"/></pattern>'};}
  let n=Math.max(3,Math.round((+o.len||105)/5));if(!(n%2))n++;
  let defs='<pattern id="psStMow" patternUnits="userSpaceOnUse" width="1" height="1"/>',out='';
  cards.forEach((r,i)=>{const band=r[3]/n;let pad=band*.5;
    cards.forEach((q,j)=>{if(j===i)return;const gap=Math.max(q[0]-(r[0]+r[2]),r[0]-(q[0]+q[2]),q[1]-(r[1]+r[3]),r[1]-(q[1]+q[3]));if(gap>=0)pad=Math.min(pad,gap/2);});
    const id='psStMowC'+i;
    defs+='<pattern id="'+id+'" patternUnits="userSpaceOnUse" x="'+f(r[0])+'" y="'+f(r[1])+'" width="'+f(2*band)+'" height="'+f(2*band)+'"><rect width="'+f(2*band)+'" height="'+f(band)+'" fill="#000" fill-opacity="'+DK+'"/><rect y="'+f(band)+'" width="'+f(2*band)+'" height="'+f(band)+'" fill="#fff" fill-opacity="'+LT+'"/></pattern>';
    out+='<rect class="ps-mow-card" x="'+f(r[0]-pad)+'" y="'+f(r[1]-pad)+'" width="'+f(r[2]+2*pad)+'" height="'+f(r[3]+2*pad)+'" fill="url(#'+id+')"/>';
  });
  return {rot:90,cards:out,defs:defs};
}
/* 잎결 무늬 — 8m 칸, 깎는 방향(rot)으로. 그림이 없으면(노드 시험 · 캔버스 실패) 빈 문자열 */
function grainDefs(o){const src=grainTile();if(!src)return '';const f=o.f||(n=>Math.round(n*10)/10),s=f(8*o.m);
  return '<pattern id="psStGrain" patternUnits="userSpaceOnUse" x="'+f(o.L)+'" y="'+f(o.T)+'" width="'+s+'" height="'+s+'"'+(o.rot?' patternTransform="rotate('+o.rot+')"':'')+'><image href="'+src+'" width="'+s+'" height="'+s+'" preserveAspectRatio="none"/></pattern>';}
function viewKey(deco,blank){
  if(deco==='full'||blank||!W)return '';
  return ['--tilt-k','--tilt-ty','--tilt-ax','--tilt-sy'].map(k=>W.document.documentElement.style.getPropertyValue(k)).join(',');
}
function bounds(deco,blank,L,R,T,B,gx,gy,dT,stage,unproject,screenMatrix){
  if(deco==='full'||blank)return null;
  const pad=Math.max(R-L,B-T)*.02;
  let x0=L-gx-dT,x1=R+gx+dT,y0=T-gy-dT,y1=B+gy+dT;
  try{
    const r=stage.getBoundingClientRect(),flat=screenMatrix&&screenMatrix.inverse();
    for(const [x,y] of [[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom]]){
      // SVG software painting can flatten CSS perspective even though DOM
      // measurements retain it. Cover that affine floor as well as the 3D one.
      const points=[unproject(x,y)];
      if(flat)points.push({x:flat.a*x+flat.c*y+flat.e,y:flat.b*x+flat.d*y+flat.f});
      for(const p of points){
        if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
        x0=Math.min(x0,p.x-pad);x1=Math.max(x1,p.x+pad);y0=Math.min(y0,p.y-pad);y1=Math.max(y1,p.y+pad);
      }
    }
  }catch(_){}
  // Outward rounding keeps resize noise out of the image cache and covers edges.
  const box=[Math.floor(x0/10)*10,Math.floor(y0/10)*10,Math.ceil(x1/10)*10,Math.ceil(y1/10)*10];
  return {box:box,key:box.join(','),corners:[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]]};
}
function paint(ground,turf,md,grain){
  const b=ground.box,rect=fill=>'<rect x="'+b[0]+'" y="'+b[1]+'" width="'+(b[2]-b[0])+'" height="'+(b[3]-b[1])+'" '+fill+'/>';
  return '<g data-ps-ground="1">'+rect('fill="url(#psStGrass)"')
    +(turf?rect('fill="#1c7a34" fill-opacity=".24"'):'')+rect('fill="url(#psStMow)"')+(grain?rect('fill="url(#psStGrain)"'):'')
    +(md.tint?rect('fill="'+md.tint[0]+'" fill-opacity="'+md.tint[1]+'"'):'')
    +rect('fill="#071d0b" fill-opacity=".14"')+'</g>';
}
function cover(box,mt,visible){
  const det=mt[0]*mt[3]-mt[1]*mt[2];if(!det)return null;
  const b=box.slice();
  for(const [x,y] of [[visible[0],visible[1]],[visible[2],visible[1]],[visible[2],visible[3]],[visible[0],visible[3]]]){
    const dx=x-mt[4],dy=y-mt[5],u=(mt[3]*dx-mt[2]*dy)/det,v=(-mt[1]*dx+mt[0]*dy)/det;
    if(!Number.isFinite(u)||!Number.isFinite(v))return null;
    b[0]=Math.min(b[0],Math.floor(u/10)*10);b[1]=Math.min(b[1],Math.floor(v/10)*10);
    b[2]=Math.max(b[2],Math.ceil(u/10)*10);b[3]=Math.max(b[3],Math.ceil(v/10)*10);
  }
  const corners=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]].map(([x,y])=>[mt[0]*x+mt[2]*y+mt[4],mt[1]*x+mt[3]*y+mt[5]]);
  const x0=Math.min(...corners.map(p=>p[0])),y0=Math.min(...corners.map(p=>p[1]));
  return {box:b,vb:[x0,y0,Math.max(...corners.map(p=>p[0]))-x0,Math.max(...corners.map(p=>p[1]))-y0]};
}
var exports=new WeakMap();
function exportView(host,visible){
  if(!host)return null;
  const src=host.getAttribute('src'),vb=host.__psVb,g=host.__psGround;
  if(!g)return {src:src,vb:vb.slice()};
  const e=cover(g.box,g.mt,visible);if(!e)return {src:src,vb:vb.slice()};
  const key=e.box.join(','),cached=exports.get(host);
  if(cached&&cached.src===src&&cached.key===key)return cached.value;
  try{
  const doc=new W.DOMParser().parseFromString(decodeURIComponent(src.slice(src.indexOf(',')+1)),'image/svg+xml');
  const root=doc.documentElement,ground=doc.querySelector('[data-ps-ground]'),b=e.box;
  if(!ground)return {src:src,vb:vb.slice()};
  root.setAttribute('viewBox',e.vb.join(' '));
  ground.querySelectorAll('rect').forEach(r=>{r.setAttribute('x',b[0]);r.setAttribute('y',b[1]);r.setAttribute('width',b[2]-b[0]);r.setAttribute('height',b[3]-b[1]);});
  const value={src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new W.XMLSerializer().serializeToString(root)),vb:e.vb};
  exports.set(host,{src:src,key:key,value:value});return value;
  }catch(_){return {src:src,vb:vb.slice()};}
}
return {crowdTile:crowdTile,grainTile:grainTile,grainDefs:grainDefs,mowPlan:mowPlan,GRAIN_V:GRAIN_V,viewKey:viewKey,bounds:bounds,paint:paint,cover:cover,exportView:exportView};
});

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
function paint(ground,turf,md){
  const b=ground.box,rect=fill=>'<rect x="'+b[0]+'" y="'+b[1]+'" width="'+(b[2]-b[0])+'" height="'+(b[3]-b[1])+'" '+fill+'/>';
  return '<g data-ps-ground="1">'+rect('fill="url(#psStGrass)"')
    +(turf?rect('fill="#1c7a34" fill-opacity=".24"'):'')+rect('fill="url(#psStMow)"')
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
return {crowdTile:crowdTile,viewKey:viewKey,bounds:bounds,paint:paint,cover:cover,exportView:exportView};
});

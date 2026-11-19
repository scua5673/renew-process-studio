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
var _grain={},GRAIN_V=1;
/* n = 타일 한 변(px, 기본 256 = 3D). 3.263 평면은 128 — 같은 무늬를 줄여 그린다(평면은 8m 칸이 화면에 80px 안팎이라 256 이 필요 없고, 그림 · 영상 내보내기마다 판 SVG 에 실린다) */
function grainTile(n){
  const N=n>0?Math.round(n):256,k=N/256;
  if(_grain[N]!=null)return _grain[N];
  try{
    const c=W.document.createElement('canvas');c.width=N;c.height=N;const g=c.getContext('2d');
    let seed=20261104;const rnd=()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
    const wrap=(x,y,r,fn)=>{for(const dx of [0,-N,N])for(const dy of [0,-N,N]){if(x+dx+r<0||x+dx-r>N||y+dy+r<0||y+dy-r>N)continue;fn(x+dx,y+dy);}};
    g.lineCap='round';
    for(let i=0;i<2400;i++){const x=rnd()*N,y=rnd()*N,len=(5+rnd()*17)*k,lean=(rnd()-.5)*2.4*k,a=.05+rnd()*.08,light=rnd()<.5,w=(rnd()<.75?.9:1.5)*k;
      wrap(x,y,len+2*k,(px,py)=>{g.strokeStyle=(light?'rgba(232,255,214,':'rgba(6,24,8,')+a+')';g.lineWidth=w;g.beginPath();g.moveTo(px,py);g.lineTo(px+lean,py+len);g.stroke();});}
    _grain[N]=c.toDataURL('image/png');
  }catch(_){_grain[N]='';}
  return _grain[N];
}
/* 3.263 — 깎은 줄은 약 4m(사용자 «4m 간격으로» · «가로일 때 세로일 때 다 신경써서»). 예전엔 5m.
   골라인에서 골라인까지 홀수 개 띠(11인제 27 · 8인제 17 · 풋살 11) — 가운데 띠가 하프라인에 걸치고 두 골라인이 띠 경계(띠는 3.9 · 3.8 · 3.6m).
   평면(board-flat-turf.js)과 3D 가 이 규칙 하나를 쓴다. */
var BAND=4;
function bands(len){let n=Math.max(3,Math.round((+len||105)/BAND));if(!(n%2))n++;return n;}
/* 여러 운동장 카드(골대가 카드 위 · 아래) — 카드마다 띠 폭과 둘레(띠 반 폭, 옆 카드와 안 겹치게) */
function cardBands(cards,len){
  const cs=(cards||[]).filter(r=>Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r[2]>0&&r[3]>0),n=bands(len);
  return cs.map((r,i)=>{const band=r[3]/n;let pad=band*.5;
    cs.forEach((q,j)=>{if(j===i)return;const gap=Math.max(q[0]-(r[0]+r[2]),r[0]-(q[0]+q[2]),q[1]-(r[1]+r[3]),r[1]-(q[1]+q[3]));if(gap>=0)pad=Math.min(pad,gap/2);});
    return {r:r,band:band,pad:pad,box:[r[0]-pad,r[1]-pad,r[2]+2*pad,r[3]+2*pad]};});
}
/* o = {multi, cards:[[x,y,w,h]…], len(규격 길이 m), L, T, m(1m), pw(운동장 길이 — 없으면 105m), ph(폭 — 없으면 68m 비율), f(반올림), kind(무늬 — 없으면 보드 값), gap(띠 결 간격 m — 없으면 보드 값)}
   → {defs(psStMow 포함), cards(카드 띠 rect), rot(잎결 방향 — 깎는 방향), per(잔디 사진 칸 — 밝은 띠 + 어두운 띠 4m 한 쌍), two(두 색 줄의 한 쌍 — 0 이면 한 색), grass(ga,gb)(사진 없는 psStGrass)}
   3.326 — 무늬는 보드 설정 «잔디 무늬»(board-mow.js · 평면과 같은 값). 띠는 두 색 줄 + 옅은 덧칠(3.332 부터 결 간격 · 하프라인 기준), 나머지는 한 색 위에 조금 짙은 덧칠, 없음은 빈 무늬. */
function mowApi(){ return (W&&W.PSBoardMow)||(typeof require==='function'?require('./board-mow.js'):null); }
/* 3.332 — 띠는 보드의 결 간격(o.gap · 없으면 보드 값 · 노드는 4m)으로, 하프라인이 결 경계(board-mow.js paint). 두 색 줄(사진 없는 psStGrass)도
   같은 간격 · 같은 자리(ox). 잔디 사진 칸(per)은 무늬와 따로 예전 크기(약 4m 한 쌍) — 간격을 넓혀도 잎결 크기는 그대로 */
function mowPlan(o){
  const f=o.f||(n=>Math.round(n*10)/10),DK='.07',LT='.06',cs=cardBands(o.cards,o.len),Mw=mowApi();
  const kind=o.kind||(Mw?Mw.kindNow(W):'band'),two=Mw?Mw.two(kind):kind==='band',strong=two?{}:{dk:['#000',.1],lt:['#fff',.08]};
  const gap=o.gap>0?+o.gap:(Mw?Mw.gapNow(W):4),lenM=(Mw&&Mw.lenNow)?Mw.lenNow(W,o.len):o.len;
  const grassOf=(per,tw,multi,ox)=>function(ga,gb){const t=tw&&!multi,s=t?tw:per;
    return '<pattern id="psStGrass" patternUnits="userSpaceOnUse" x="'+f(t&&ox!=null?ox:o.L)+'" y="'+f(o.T)+'" width="'+f(s)+'" height="'+f(s)+'"><rect width="'+f(s)+'" height="'+f(s)+'" fill="'+ga+'"/>'+(t?'<rect width="'+f(s/2)+'" height="'+f(s)+'" fill="'+gb+'"/>':'')+'</pattern>';};
  if(!o.multi||!cs.length){const pw=(o.pw>0?o.pw:105*o.m),band=pw/bands(o.len),per=2*band;
    if(!Mw)return {rot:0,cards:'',per:per,two:per,grass:grassOf(per,per,false),defs:'<pattern id="psStMow" patternUnits="userSpaceOnUse" x="'+f(o.L)+'" y="'+f(o.T)+'" width="'+f(per)+'" height="'+f(per)+'"><rect width="'+f(band)+'" height="'+f(per)+'" fill="#000" fill-opacity="'+DK+'"/><rect x="'+f(band)+'" width="'+f(band)+'" height="'+f(per)+'" fill="#fff" fill-opacity="'+LT+'"/></pattern>'};
    const tw=two?2*gap*pw/lenM:0;
    return {rot:0,cards:'',per:per,two:tw,grass:grassOf(per,tw,false,o.L+pw/2),defs:Mw.paint('psStMow',kind,Object.assign({x:o.L,y:o.T,len:pw,wid:o.ph>0?o.ph:pw*68/105,lenM:lenM,gap:gap,f:f},strong))};}
  let defs='<pattern id="psStMow" patternUnits="userSpaceOnUse" width="1" height="1"/>',out='';
  if(kind!=='none')cs.forEach((c,i)=>{const r=c.r,b=c.box,id='psStMowC'+i;
    if(!Mw){const band=c.band;
      defs+='<pattern id="'+id+'" patternUnits="userSpaceOnUse" x="'+f(r[0])+'" y="'+f(r[1])+'" width="'+f(2*band)+'" height="'+f(2*band)+'"><rect width="'+f(2*band)+'" height="'+f(band)+'" fill="#000" fill-opacity="'+DK+'"/><rect y="'+f(band)+'" width="'+f(2*band)+'" height="'+f(band)+'" fill="#fff" fill-opacity="'+LT+'"/></pattern>';}
    else defs+=Mw.paint(id,kind,Object.assign({x:r[0],y:r[1],len:r[3],wid:r[2],lenM:o.len,rot:90,gap:gap,f:f},strong));
    out+='<rect class="ps-mow-card" x="'+f(b[0])+'" y="'+f(b[1])+'" width="'+f(b[2])+'" height="'+f(b[3])+'" fill="url(#'+id+')"/>';
  });
  const per=2*105*o.m/bands(105);
  return {rot:90,cards:out,defs:defs,per:per,two:0,grass:grassOf(per,0,true)};
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
/* 3.303 — «간단 · 잔디만»의 바닥은 운동장 판과 같은 잔디 한 장(사용자 «잔디만했을 때 3d 화면이 너무 이질감 … 자연스럽게»).
   예전엔 바닥만 한 톤 어둡게(#071d0b .14) 칠하고, 빛(psStLight) · 색조 · 조명 기둥(네 귀 — 판에서 잘림) · 노을은 운동장 둘레 판(rr(0) · rr(dT)) 안에만 그려
   둥근 밝은 판이 잔디 위에 떠 보였다. 이제:
   ① 바닥(paint)은 잔디 · 깎은 줄 · 잎결만 — 판 안과 같은 무늬 · 같은 자리라 이음새가 없다.
   ② 빛은 가운데의 옅은 밝음(psStGlow) 하나 — 조명탑이 없는 꾸밈이라 네 귀의 조명 기둥 · 모서리 어둠(psStLight)은 쓰지 않는다. 색조 · 노을은 작전판이 판 밖(gW)까지 그린다.
   ③ 멀수록 어둡게(shade): 운동장 둘레 상자에서 바깥으로 부드럽게(psStEdgeX · psStEdgeY — 가로 · 세로 띠의 곱이라 이음매 없는 한 면) + 가운데에서 둥글게(psStFar).
      끊기는 테가 없게 번짐의 시작은 느리게(EASE). 세기는 분위기의 vig 에 비례(낮은 옅게 · 야간은 짙게). */
function paint(ground,turf,md,grain){
  const b=ground.box,rect=fill=>'<rect x="'+b[0]+'" y="'+b[1]+'" width="'+(b[2]-b[0])+'" height="'+(b[3]-b[1])+'" '+fill+'/>';
  return '<g data-ps-ground="1">'+rect('fill="url(#psStGrass)"')
    +(turf?rect('fill="#1c7a34" fill-opacity=".24"'):'')+rect('fill="url(#psStMow)"')+(grain?rect('fill="url(#psStGrain)"'):'')+'</g>';
}
/* o = {cx, cy, pw(운동장 길이), md(분위기), f, x0 · x1 · y0 · y1(어둠이 시작하는 상자 — 운동장 둘레 판), s(두께 기준 — 운동장 하나면 길이)}
   → psStGlow · psStFar · psStEdgeX · psStEdgeY 정의. 작전판은 shade(d) 로 바닥 전체(d = 아주 큰 길)에 칠한다. */
var FAR_IN=.6,FAR_OUT=1.45,FAR_K=.6,EDGE_K=.35,EDGE_D=.3,EASE=[[0,0],[.2,.104],[.4,.352],[.6,.648],[.8,.896],[1,1]];
function far(o){
  const f=o.f||(n=>Math.round(n*10)/10),vig=Math.max(0,+(o.md&&o.md.vig)||0),v=Math.min(.6,vig*FAR_K),e=Math.min(.5,vig*EDGE_K),r2=n=>Math.round(n*100)/100,r4=n=>Math.round(n*10000)/10000;
  const stop=(off,op)=>'<stop offset="'+r4(off)+'" stop-color="#000" stop-opacity="'+r4(op)+'"/>';
  const lin=(id,a,b,d,vert)=>{const a0=a-d,b1=b+d,t=d/(b1-a0);let st='';
    EASE.slice().reverse().forEach(p=>{st+=stop((1-p[0])*t,e*p[1]);});EASE.forEach(p=>{st+=stop(1-t+p[0]*t,e*p[1]);});   /* 왼쪽(위) 번짐 · 가운데 0 · 오른쪽(아래) 번짐 */
    return '<linearGradient id="'+id+'" gradientUnits="userSpaceOnUse" '+(vert?'x1="0" y1="'+f(a0)+'" x2="0" y2="'+f(b1)+'"':'x1="'+f(a0)+'" y1="0" x2="'+f(b1)+'" y2="0"')+'>'+st+'</linearGradient>';};
  const d=(+o.s||+o.pw||0)*EDGE_D,in0=FAR_IN/FAR_OUT;
  return '<radialGradient id="psStGlow" gradientUnits="userSpaceOnUse" cx="'+f(o.cx)+'" cy="'+f(o.cy)+'" r="'+f(o.pw*.7)+'"><stop offset="0" stop-color="#fff" stop-opacity=".06"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></radialGradient>'
    +'<radialGradient id="psStFar" gradientUnits="userSpaceOnUse" cx="'+f(o.cx)+'" cy="'+f(o.cy)+'" r="'+f(o.pw*FAR_OUT)+'">'+stop(in0,0)+stop(in0+(1-in0)*.35,v*.2)+stop(1,v)+'</radialGradient>'
    +(d>0?lin('psStEdgeX',o.x0,o.x1,d,false)+lin('psStEdgeY',o.y0,o.y1,d,true):'');
}
function shade(d){return '<path d="'+d+'" fill="url(#psStEdgeX)"/><path d="'+d+'" fill="url(#psStEdgeY)"/><path d="'+d+'" fill="url(#psStFar)"/>';}
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
return {crowdTile:crowdTile,grainTile:grainTile,grainDefs:grainDefs,mowPlan:mowPlan,bands:bands,cardBands:cardBands,BAND:BAND,GRAIN_V:GRAIN_V,viewKey:viewKey,bounds:bounds,paint:paint,far:far,shade:shade,cover:cover,exportView:exportView};
});

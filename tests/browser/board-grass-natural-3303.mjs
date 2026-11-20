import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.303 — 3D «잔디만 · 간단»의 바닥은 잔디 한 장(합성 팀 fixture 에서만).
// 사용자 «잔디만했을 때 3d 화면이 너무 이질감이 있어 자연스럽게»: 운동장 둘레 판(rr(0))만 밝고(빛 · 네 귀 조명 기둥이 판에서 잘림)
// 바닥은 한 톤 어둡게(.14) 칠해져, 둥근 밝은 판이 잔디 위에 떠 보였다.
//  · 실제 경기장 그림(<img> SVG — 잔디 무늬만 한 색으로 바꾼 사본)을 캔버스에 그려 판 테두리 안팎(같은 x — 같은 깎은 줄)의 밝기를 잰다: 차이가 없어야 한다
//  · 구조: 바닥에는 판에서 잘리는 것(clip-path)도 따로 칠한 어둠도 없다 · 빛 · 어둠은 바닥 전체를 덮는 길
//  · 멀수록 어둡다(먼 바닥 < 판 가까이) · 낮은 야간보다 옅다
//  · «전체» 경기장과 그리드 판은 예전 그대로(조명 기둥 · psStLight · psStVig)
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('board-grass-natural-3303 '+s);};
try{
  const {page,logs}=await openApp(fx,size,{browsers,tilt3d:true});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__boardReady&&window.__boardRestoreDone&&window.__setTilt&&window.PSStadiumGround,null,{timeout:30000});
  await page.waitForTimeout(800);
  /* 경기장 그림을 풀고(구조) 캔버스에 그려(밝기) 잰다 */
  const look=(deco,mood,spec)=>f.evaluate(async ([deco,mood,spec])=>{
    const s=captureSnap();s.pitchTheme='grass';s.pitchImg='@real';s.orientation='h';s.spFlip=false;s.players=[];s.equipment=[];s.drawings=[];s.gridType='off';s.pitchView='full';s.pitchSpec=spec;loadSnap(s);
    window.__setPitchN(1);window.__setTilt(true,{quiet:true});window.__setTilt3dOpt('cam','high');window.__setTilt3dOpt('deco',deco);window.__setTilt3dOpt('mood',mood);window.__tiltFit();
    const want='|'+deco+'|';let h=null,prev='';const t0=Date.now();
    while(Date.now()-t0<15000){ await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      h=document.querySelector('#tiltSurface .tilt-stadium');const sig=h&&h.__sig||'';
      if(sig&&(spec!=='fifa'||sig.includes(want))&&sig.includes('|'+mood+'|')&&sig===prev)break;prev=sig;await new Promise(r=>setTimeout(r,150)); }
    await h.decode();
    const src=decodeURIComponent(h.src.slice(h.src.indexOf(',')+1)),doc=new DOMParser().parseFromString(src,'image/svg+xml');
    const p=PR(),ground=h.__psGround,vb=h.__psVb.slice();
    const fills=[...doc.querySelectorAll('path,rect')].map(e=>({tag:e.tagName,fill:e.getAttribute('fill')||'',inGround:!!e.closest('[data-ps-ground]'),d:(e.getAttribute('d')||'').length}));
    const out={deco:window.__tiltDecoNow(),ground:!!ground,clip:doc.querySelectorAll('[clip-path]').length,cone:fills.some(x=>x.fill==='url(#psStCone)')||!!doc.querySelector('g[fill="url(#psStCone)"]'),
      ids:['psStGlow','psStFar','psStEdgeX','psStEdgeY','psStLight','psStVig'].filter(id=>doc.getElementById(id)),
      used:[...new Set(fills.map(x=>x.fill).filter(x=>/^url/.test(x)))].sort(),groundFills:fills.filter(x=>x.inGround).map(x=>x.fill),dark14:/#071d0b/.test(src)};
    if(!ground)return out;
    /* 판 테두리 rr(0) 과 같은 치수(board.html tiltStadium) */
    const S=p.R-p.L,PH=p.B-p.T,gx=S*.068,gy=PH*.095,r0=S*.075,x0=p.L-gx,x1=p.R+gx,y0=p.T-gy,y1=p.B+gy,CX=(p.L+p.R)/2,q=r0*(1-Math.SQRT1_2);
    out.plate=[x0,y0,x1,y1];out.box=ground.box;
    /* 빛 · 어둠 길이 바닥 상자를 다 덮는가 */
    const cover=id=>{const e=[...doc.querySelectorAll('path')].find(e=>e.getAttribute('fill')==='url(#'+id+')');if(!e)return false;
      const n=(e.getAttribute('d').match(/-?\d+(?:\.\d+)?/g)||[]).map(Number),big=Math.max(...n.map(Math.abs));return big>Math.max(...ground.box.map(Math.abs))*4;};
    out.cover={glow:cover('psStGlow'),edgeX:cover('psStEdgeX'),edgeY:cover('psStEdgeY'),far:cover('psStFar')};
    /* 밝기 — 그림을 1 단위 = k px 로 그린다 */
    const mt=ground.mt,k=Math.min(2,2600/vb[2]),W=Math.round(vb[2]*k),H=Math.round(vb[3]*k),cv=document.createElement('canvas');cv.width=W;cv.height=H;
    /* 잔디 사진 · 잎결 · 깎은 줄은 자리마다 밝기가 달라 빛의 차이를 가린다 — 무늬를 한 색으로 바꾼 사본을 그린다(빛 · 색조 · 어둠은 그대로) */
    const flat=doc.getElementById('psStGrass'),grainPat=doc.getElementById('psStGrain');
    if(flat){const w=flat.getAttribute('width'),hh=flat.getAttribute('height');while(flat.firstChild)flat.firstChild.remove();const r=doc.createElementNS('http://www.w3.org/2000/svg','rect');r.setAttribute('width',w);r.setAttribute('height',hh);r.setAttribute('fill','#3a8a45');flat.appendChild(r);}
    for(const pat of [grainPat,doc.getElementById('psStMow')])if(pat)while(pat.firstChild)pat.firstChild.remove();
    const g=cv.getContext('2d',{willReadFrequently:true}),im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(doc.documentElement));await im.decode();g.drawImage(im,0,0,W,H);
    const lum=(x,y)=>{const X=mt[0]*x+mt[2]*y+mt[4],Y=mt[1]*x+mt[3]*y+mt[5],px=Math.round((X-vb[0])*k),py=Math.round((Y-vb[1])*k),r=3;
      const d=g.getImageData(px-r,py-r,2*r+1,2*r+1).data;let s=0;for(let i=0;i<d.length;i+=4)s+=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];return s/(d.length/4);};
    const dd=6,pair=(x,yb,sign)=>({in:lum(x,yb+sign*dd),out:lum(x,yb-sign*dd)});   /* 같은 x(같은 깎은 줄)에서 테두리 안 · 밖 */
    out.edge={top:pair(CX,y0,1),bottom:pair(CX,y1,-1),tl:pair(x0+q,y0+q,1),tr:pair(x1-q,y0+q,1),bl:pair(x0+q,y1-q,-1),br:pair(x1-q,y1-q,-1)};
    /* 멀수록 어둡다 — 판 바로 밖과 바닥 상자의 귀(가장 먼 곳) */
    out.near=lum(CX,y0-dd);out.farAway=lum(ground.box[0]+12,ground.box[1]+12);out.centre=lum(CX,(p.T+p.B)/2-40);
    return out;
  },[deco,mood,spec]);

  step('grass-night');
  const g=await look('grass','night','fifa');
  assert.equal(g.ground,true);assert.equal(g.dark14,false,'바닥만 어둡게 칠한 겹 없음');
  assert.equal(g.clip,0,'판에서 잘리는 것 없음(조명 기둥이 판 테두리에서 잘렸다)');assert.equal(g.cone,false,'조명탑 없는 꾸밈 — 조명 기둥 없음');
  assert.deepEqual(g.groundFills,['url(#psStGrass)','#1c7a34','url(#psStMow)','url(#psStGrain)'],'바닥 = 잔디 · 초록 · 깎은 줄 · 잎결(판 안과 같은 겹)');
  for(const id of ['psStGlow','psStFar','psStEdgeX','psStEdgeY'])assert.ok(g.used.includes('url(#'+id+')'),id+' 를 칠한다');
  assert.ok(!g.used.includes('url(#psStLight)')&&!g.used.includes('url(#psStVig)'),'판 안에만 걸리던 빛 · 경기장 테 어둠은 안 쓴다 '+g.used);
  assert.deepEqual(g.cover,{glow:true,edgeX:true,edgeY:true,far:true},'빛 · 어둠은 바닥 전체');
  for(const [name,e] of Object.entries(g.edge))assert.ok(Math.abs(e.in-e.out)<1.5,'판 테두리 '+name+' 안팎 밝기가 같다 '+JSON.stringify(e));
  assert.ok(Math.abs(g.farAway-g.near)<4,'3.346 — 조명을 걷어 멀리도 같은 밝기 '+JSON.stringify({near:g.near,far:g.farAway}));   /* 기대를 일부러 고침: 예전엔 멀수록 어두웠다 */
  assert.ok(g.centre>40,'운동장은 밝다 '+g.centre);

  step('simple');
  const sm=await look('simple','night','fifa');
  assert.equal(sm.ground,true);assert.equal(sm.clip,0);assert.equal(sm.cone,false);assert.equal(sm.dark14,false);
  assert.deepEqual(sm.cover,{glow:true,edgeX:true,edgeY:true,far:true});

  step('full-unchanged');
  const full=await look('full','night','fifa');
  assert.equal(full.ground,false);assert.equal(full.cone,false,'3.346 — 전체 경기장도 조명 기둥 없음');assert.equal(full.clip,0);
  assert.ok(full.used.includes('url(#psStLight)')&&full.used.includes('url(#psStVig)'),'예전 빛 · 테 어둠 '+full.used);
  assert.ok(!full.ids.includes('psStGlow')&&!full.ids.includes('psStFar'),'바닥용 번짐은 정의하지 않는다 '+full.ids);

  step('grid-unchanged');
  const grid=await look('grass','night','grid30');
  assert.equal(grid.ground,false,'그리드 판은 예전 bleed');assert.ok(grid.used.includes('url(#psStLight)'),'그리드 판의 빛 그대로 '+grid.used);
  assert.ok(!grid.ids.includes('psStGlow'));

  step('errors');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({test:'board-grass-natural-3303',engine,size,passed:true,edge:g.edge,near:g.near,far:g.farAway}));
}catch(e){console.error('board-grass-natural-3303 실패 단계:',cur);console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){} await fx.close();}

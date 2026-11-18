import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.316 — 3D 잔디 색은 평면에서 고른 피치를 따른다(합성 팀 fixture 에서만).
// 사용자 «3d 모드에서 다양한 운동장 색상 평면보드에서 처럼»: 예전엔 분위기의 초록 두 색 · 실사 사진이 늘 깔렸다.
//  · 네이비 · 화이트 · 딥그린 · 직접 색: 경기장 그림(<img> SVG)의 잔디 무늬(psStGrass)가 평면 줄무늬와 같은 두 색 · 사진 없음
//  · 실사 잔디: 사진 타일 · 밝기/연하기를 고르면 톤 필터(psStTone) · 닳은 자국은 잔디(실사 · 딥그린)에만
//  · 피치를 바꾸면 그림이 다시 그려진다(서명) · 3D 영상 판 그림은 화이트 피치의 선을 흰색으로 바꾸지 않는다
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('board-3d-pitch-3316 '+s);};
try{
  const {page,logs}=await openApp(fx,size,{browsers,tilt3d:true});
  await page.waitForTimeout(2000);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__boardReady&&window.__boardRestoreDone&&window.__setTilt&&window.PSStadiumGround&&window.__tiltPitchLook,null,{timeout:30000});
  await page.waitForTimeout(800);
  /* 피치를 고르고 경기장 그림(서명에 pk.sig)이 그 모습으로 안정될 때까지 기다린 뒤 그림을 푼다 */
  const look=(pick)=>f.evaluate(async (pick)=>{
    const s=captureSnap();s.players=[];s.equipment=[];s.drawings=[];s.gridType='off';s.pitchView='full';s.pitchSpec='fifa';s.orientation='h';s.spFlip=false;loadSnap(s);
    window.__setGrassM(5);   /* 3.326 — 3D 도 «잔디 무늬»를 따른다(기본 없음 = 한 색) — 두 색을 보려고 띠 */
    window.__setPitchN(1);window.__setTilt(true,{quiet:true});window.__setTilt3dOpt('cam','high');window.__setTilt3dOpt('deco','full');window.__setTilt3dOpt('mood','night');
    if(pick.custom){ try{window.__clearPitchImg();}catch(_){} const inp=document.getElementById('pitchColPick'); inp.value=pick.custom; inp.dispatchEvent(new Event('input',{bubbles:true})); }
    else { const b=document.querySelector('#pitchSeg button[data-p="'+pick.p+'"]'); window.__psUserClick=1; try{b.click();}finally{window.__psUserClick=0;} }
    if(pick.tone){ window.__setGrassTone(pick.tone); }
    window.__tiltFit(); try{tiltGoalsSync();}catch(_){}
    const want=window.__tiltPitchLook({ga:'#2c6a2a',gb:'#367a33'},pick.p==='real'?'x':'').sig;
    let h=null,prev='';const t0=Date.now();
    while(Date.now()-t0<15000){ await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      h=document.querySelector('#tiltSurface .tilt-stadium');const sig=(h&&h.__sig||'')+'#'+(h&&h.__pk||'');
      if(h&&h.__pk===want&&sig===prev)break;prev=sig;await new Promise(r=>setTimeout(r,150)); }
    const sig=h&&h.__pk||'';
    const src=decodeURIComponent(h.src.slice(h.src.indexOf(',')+1)),doc=new DOMParser().parseFromString(src,'image/svg+xml');
    const pat=doc.getElementById('psStGrass'),rects=pat?[...pat.querySelectorAll('rect')].map(r=>r.getAttribute('fill')):[],img=pat?pat.querySelector('image'):null;
    const tone=doc.getElementById('psStTone');
    const wear=[...doc.querySelectorAll('ellipse')].filter(e=>e.getAttribute('fill')==='url(#psStWear)').length;
    const css={ga:getComputedStyle(document.documentElement).getPropertyValue('--grass-a').trim(),gb:getComputedStyle(document.documentElement).getPropertyValue('--grass-b').trim(),bg:getComputedStyle(document.documentElement).getPropertyValue('--pitchbg').trim()};
    /* 3D 영상의 판 그림 — 화이트 피치에서도 선을 흰색으로 바꾸는 규칙이 없다 */
    window.__animExport3d=1;let xml='';try{xml=boardImageXML().xml;}catch(_){xml='';}window.__animExport3d=0;
    return {sig,want,ok:sig===want,rects,photo:!!img,photoFilter:img?img.getAttribute('filter')||'':'',tone:!!tone,toneValues:tone?tone.querySelector('feColorMatrix').getAttribute('values'):'',wear,css,pitch:document.documentElement.dataset.pitch||'',pitchImg:String(state.pitchImg||''),whiteLines:/stroke:rgba\(255,255,255,\.92\)/.test(xml),key:window.__tiltPitchLook({ga:'',gb:''},'').key};
  },pick);

  step('navy');
  const navy=await look({p:'navy'});
  assert.equal(navy.ok,true,'경기장 그림의 피치 모습(__pk)이 고른 피치다: '+navy.sig);
  assert.deepEqual([navy.key,navy.photo,navy.rects],['navy',false,[navy.css.ga,navy.css.gb]],'네이비 — 평면 줄무늬와 같은 두 색, 사진 없음');
  assert.equal(navy.wear,0,'닳은 자국은 잔디에만');assert.equal(navy.tone,false);
  const sigNavy=navy.sig;

  step('white');
  const white=await look({p:'white'});
  assert.equal(white.ok,true,white.sig);
  assert.deepEqual([white.key,white.photo,white.rects,white.wear],['white',false,['#ffffff','#edf0f5'],0]);
  assert.notEqual(white.sig,sigNavy,'피치를 바꾸면 그림이 다시 그려진다');
  assert.equal(white.whiteLines,false,'3D 영상 판 그림은 화이트 피치의 선을 흰색으로 바꾸지 않는다');

  step('calm');
  const calm=await look({p:'calm'});
  assert.equal(calm.ok,true,calm.sig);
  assert.deepEqual([calm.key,calm.photo,calm.rects],['calm',false,['#1f4d31','#173a23']]);
  assert.ok(calm.wear>0,'딥그린은 잔디 — 닳은 자국');

  step('custom');
  const custom=await look({custom:'#3366cc'});
  assert.equal(custom.ok,true,custom.sig);
  assert.deepEqual([custom.key,custom.pitch,custom.photo,custom.rects,custom.wear],['custom','custom',false,['#3366cc','#2e5cb8'],0],'직접 색 — 그 색과 조금 어두운 색');

  step('real');
  const real=await look({p:'real'});
  assert.equal(real.ok,true,real.sig);
  assert.equal(real.key,'real');assert.equal(real.pitchImg,'@real');
  if(real.photo){ assert.equal(real.photoFilter,'','기본 톤이면 필터 없음');assert.equal(real.tone,false); assert.ok(real.wear>0,'실사는 잔디 — 닳은 자국'); }
  else { assert.deepEqual(real.rects,['#2c6a2a','#367a33'],'사진을 못 그리는 기기는 분위기의 초록 두 색'); }

  step('real-tone');
  const toned=await look({p:'real',tone:'l|p'});
  assert.equal(toned.ok,true,toned.sig);
  if(toned.photo){ assert.equal(toned.photoFilter,'url(#psStTone)','밝게 · 연하게 → 사진 타일에 톤 필터');assert.equal(toned.tone,true);assert.equal(toned.toneValues.split(' ').length,20); assert.notEqual(toned.sig,real.sig,'톤이 바뀌면 다시 그린다'); }
  await f.evaluate(()=>{window.__setGrassTone('0|0');});

  step('restore');
  await f.evaluate(()=>{ const b=document.querySelector('#pitchSeg button[data-p="navy"]'); b.click(); window.__setTilt(false,{quiet:true}); });
  console.log(JSON.stringify({test:'board-3d-pitch-3316',engine,size,passed:true,navy:navy.rects,white:white.rects,custom:custom.rects,realPhoto:real.photo,toneFilter:toned.photoFilter}));
}catch(e){console.error('board-3d-pitch-3316 failed at '+cur);console.error(e);process.exitCode=1;}
finally{try{for(const b of Object.values(browsers))await b.close();}catch(_){}try{await fx.close();}catch(_){}}

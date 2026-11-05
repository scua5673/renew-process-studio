import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.260 — 평면 잔디(합성 팀 fixture 에서만):
//  · 실사 잔디(«잔디» 단추 = @real): 사진 칸 = 깎은 줄 한 쌍(11인제 2×105/27m) · 가로 · 세로 모두 0°(세로 판에서 또 돌리던 것 걷음)
//    · 깎은 줄 rect.ps-flat-mow(id 없음) — 비네트 바로 위 · 구역 · 라인 아래, 골라인 L 에서 · 8인제는 실제 골라인(PR)에서
//  · 운동장 5개: 사진 90° · 깎은 줄은 카드마다 90°(카드 위 골라인에서 27개 띠)
//  · 3D: 깎은 줄 · 잎결은 바탕과 같이 숨는다(visibility) · 그림 내보내기(boardImageXML)에 담긴다
//  · 사진 없는 «잔디»: 잎결(128 타일 · 8m) + 깎은 줄 · «잔디 줄무늬»를 켜면 깎은 줄은 빠지고 잎결은 줄무늬 위
//  · 네이비 · 흰색: 아무것도 없다
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('board-flat-turf-3260 '+s);};
const near=(a,b,msg)=>assert.ok(Math.abs(+a-+b)<.02,msg+' '+a+' vs '+b);
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.PSFlatTurf&&window.__psFlatTurf,null,{timeout:30000});
  await page.waitForTimeout(600);
  const set=(look,n,o,spec)=>f.evaluate(async([look,n,o,spec])=>{const s=captureSnap();Object.assign(s,look);s.orientation=o||'h';s.spFlip=false;s.pitchView='full';s.pitchSpec=spec||'fifa';s.players=[];s.drawings=[];loadSnap(s);window.__setPitchN(n);
    if(n>1){const t0=Date.now();while(Date.now()-t0<8000&&document.querySelectorAll('#ps-multipitch [data-pitch-rect]').length!==n)await new Promise(r=>setTimeout(r,100));}
    await new Promise(r=>setTimeout(r,300));},[look,n,o,spec]);
  const st=()=>f.evaluate(async()=>{
    const w=document.getElementById('world'),kids=[...w.children],ix=e=>kids.indexOf(e);
    const vig=kids.find(c=>c.tagName==='rect'&&/grassVig/.test(c.getAttribute('fill')||'')),grid=w.querySelector(':scope>#gridLayer');
    const mows=[...w.querySelectorAll(':scope>rect.ps-flat-mow')],grain=w.querySelector(':scope>rect.ps-flat-grain'),stripes=w.querySelector(':scope>.grass-stripes');
    const pat=id=>{const p=document.getElementById(id);return p?{x:+p.getAttribute('x'),y:+p.getAttribute('y'),w:+p.getAttribute('width'),t:p.getAttribute('patternTransform')}:null;};
    const tile=document.querySelector('#ps-pitchtile pattern#psRealGrass');
    const cards=[...svg.querySelectorAll('#ps-multipitch [data-pitch-rect]')].map(g=>g.getAttribute('data-pitch-rect').split(',').map(Number));
    let gt=null;const gp=document.getElementById('psFlatGrain');if(gp){const im=new Image();im.src=gp.querySelector('image').getAttribute('href');await im.decode();gt=[im.naturalWidth,im.naturalHeight];}
    const pr=PR();
    return {pr:{L:pr.L,T:pr.T,PW:pr.PW},cards,
      mow:mows.map(r=>({id:r.id,vis:getComputedStyle(r).visibility,fill:r.getAttribute('fill')})),mowAboveVig:mows.length&&vig?mows.every(r=>ix(r)>ix(vig)):null,mowBelowGrid:mows.length&&grid?mows.every(r=>ix(r)<ix(grid)):null,
      single:pat('psFlatMow'),cardPats:cards.map((_,i)=>pat('psFlatMowC'+i)),
      tile:tile?{x:+tile.getAttribute('x'),y:+tile.getAttribute('y'),w:+tile.getAttribute('width'),t:tile.getAttribute('patternTransform'),iw:+tile.querySelector('image').getAttribute('width')}:null,
      grain:grain?{id:grain.id,vis:getComputedStyle(grain).visibility,aboveStripes:stripes?ix(grain)>ix(stripes):null,belowVig:vig?ix(grain)<ix(vig):null,size:+gp.getAttribute('width'),tile:gt}:null};
  });

  for(const o of ['h','v']){
    step('real-'+o);
    await set({pitchTheme:'grass',pitchImg:'@real'},1,o);
    const r=await st(),per=2*r.pr.PW/27;
    assert.ok(r.tile,'실사 잔디 사진');near(r.tile.w,per,'사진 칸 = 깎은 줄 한 쌍');near(r.tile.iw,per,'사진 크기');assert.equal(r.tile.t,null,'가로 · 세로 모두 돌리지 않는다('+o+')');
    near(r.tile.x,r.pr.L,'골라인에서');
    assert.equal(r.mow.length,1,'깎은 줄 한 장');assert.equal(r.mow[0].id,'','id 없음(바탕 숨김 규칙)');assert.equal(r.mow[0].vis,'visible');
    assert.equal(r.mowAboveVig,true,'비네트 위');assert.equal(r.mowBelowGrid,true,'구역 · 라인 아래');
    near(r.single.w,per,'27개 띠');near(r.single.x,r.pr.L,'골라인 L');near(r.single.y,r.pr.T,'T');assert.equal(r.single.t,null);
    assert.equal(r.grain,null,'실사 잔디엔 잎결 없음');
  }
  step('real-u12');
  await set({pitchTheme:'grass',pitchImg:'@real'},1,'v','u12');
  let r=await st();near(r.single.x,r.pr.L,'8인제 실제 골라인');near(r.single.w,2*r.pr.PW/17,'8인제 17개 띠');near(r.tile.w,2*r.pr.PW/17,'사진 칸도');

  for(const o of ['h','v']){
    step('five-'+o);
    await set({pitchTheme:'grass',pitchImg:'@real'},5,o);
    r=await st();
    assert.equal(r.cards.length,5,'카드 다섯');assert.equal(r.mow.length,5,'카드마다 깎은 줄');assert.equal(r.single,null,'운동장 하나 무늬는 없다');
    assert.equal(r.tile.t,'rotate(90 '+r.tile.x+' '+r.tile.y+')','사진은 카드의 골라인과 나란히(90°)');
    r.cards.forEach((c,i)=>{const p=r.cardPats[i];assert.ok(p,'카드 '+i);near(p.x,c[0],'카드 x');near(p.y,c[1],'카드 위 골라인에서');near(p.w,2*c[3]/27,'카드마다 27개 띠');assert.equal(p.t,'rotate(90 '+p.x+' '+p.y+')');});
  }

  step('3d');
  await set({pitchTheme:'grass',pitchImg:'@real'},1,'h');
  await f.evaluate(()=>window.__setTilt(true));await f.waitForFunction(()=>document.body.classList.contains('bc-tilt3d'));
  r=await st();assert.ok(r.mow.every(m=>m.vis==='hidden'),'3D 에선 숨는다');
  await f.evaluate(()=>window.__setTilt(false));await f.waitForFunction(()=>!document.body.classList.contains('bc-tilt3d'));
  r=await st();assert.ok(r.mow.length===1&&r.mow[0].vis==='visible');

  step('export');
  const xml=await f.evaluate(()=>{const o=boardImageXML();return (o&&o.xml)||'';});
  assert.match(xml,/<pattern id="psFlatMow"/,'그림 내보내기에 깎은 줄');assert.match(xml,/class="ps-flat-mow"/);

  step('plain-grass');
  await set({pitchTheme:'grass',pitchImg:''},1,'h');
  r=await st();
  assert.ok(r.grain,'잎결');assert.equal(r.grain.id,'');assert.equal(r.grain.belowVig,true);assert.equal(r.grain.size,80,'8m 칸');assert.deepEqual(r.grain.tile,[128,128],'평면 128 타일');
  assert.equal(r.mow.length,1,'깎은 줄');assert.equal(r.tile,null);
  await f.evaluate(()=>window.__setGrassM(5));
  r=await st();assert.equal(r.mow.length,0,'«잔디 줄무늬»를 켜면 그 줄만');assert.equal(r.grain.aboveStripes,true,'잎결은 줄무늬 위');
  await f.evaluate(()=>window.__setGrassM(0));
  r=await st();assert.equal(r.mow.length,1,'끄면 다시');

  step('others');
  for(const look of [{pitchTheme:'',pitchImg:''},{pitchTheme:'white',pitchImg:''}]){
    await set(look,1,'h');r=await st();assert.equal(r.mow.length,0,JSON.stringify(look));assert.equal(r.grain,null);
    assert.equal(await f.evaluate(()=>!!document.getElementById('psFlatMow')||!!document.getElementById('psFlatGrain')),false,'무늬도 걷는다');}
  await set({pitchTheme:'grass',pitchImg:'@real'},1,'h');r=await st();assert.equal(r.mow.length,1,'잔디로 돌아오면 다시');

  step('errors');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('board-flat-turf-3260 ok',engine,size);
}catch(e){console.error('board-flat-turf-3260 실패 단계:',cur);throw e;}
finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){} await fx.close();}

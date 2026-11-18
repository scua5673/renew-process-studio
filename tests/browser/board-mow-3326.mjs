import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.326 — 잔디 무늬(사용자 11/19 «3d로 했을 때 잔디 줄무늬 다양하게 할수 있게 해주고 없게도» → 목업 A안 · 평면 · 3D 같이). 합성 팀 fixture 에서만.
//  · 보드 설정 › 운동장 › 바탕: «잔디 무늬» 여덟 칸(네 칸 두 줄 · 작은 그림) — 창 밖으로 넘치지 않는다
//  · 칸을 누르면(실제 클릭) 보드 값 grassM 이 무늬 번호 · 평면 .grass-stripes 가 그 무늬
//  · 3D 경기장 그림(<img> SVG)의 psStMow 가 같은 무늬 — «없음»이면 빈 무늬 + 두 색 줄 없음(고치기 전 코드는 늘 4m 띠라 여기서 떨어진다)
//  · 저장 사본 · 평면 그림 내보내기에 무늬
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){cur=s;}console.log('board-mow-3326 '+s);};
try{
  const {page,logs}=await openApp(fx,size,{browsers,tilt3d:false});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.PSBoardMow&&typeof window.__psToggleBoardSettings==='function',null,{timeout:30000});
  await page.waitForTimeout(600);

  step('seg');
  await f.evaluate(()=>{window.__setGrassM(0);window.__psToggleBoardSettings('open');document.getElementById('cmd-board-settings-pop').__psSelectTab('pitch');});
  await page.waitForTimeout(400);
  const seg=await f.evaluate(()=>{const s=document.getElementById('grassSeg'),pop=document.getElementById('cmd-board-settings-pop'),r=s.getBoundingClientRect(),row=s.closest('.menurow');
    s.scrollIntoView({block:'center'});
    const bs=[...s.querySelectorAll('button')].map(b=>{const q=b.getBoundingClientRect();return {g:+b.getAttribute('data-g'),t:b.textContent.trim(),on:b.classList.contains('on'),svg:!!b.querySelector('svg'),l:q.left,r:q.right,top:q.top,h:q.height};});
    return {n:bs.length,bs,label:row&&row.querySelector('.menulbl')&&row.querySelector('.menulbl').textContent.trim(),cols:getComputedStyle(s).gridTemplateColumns.split(' ').length,
      inside:bs.every(b=>b.l>=r.left-.5&&b.r<=r.right+.5),rows:new Set(bs.map(b=>Math.round(b.top))).size,popOver:pop.scrollWidth-pop.clientWidth};});
  assert.equal(seg.n,8,'여덟 칸');assert.equal(seg.label,'잔디 무늬');assert.equal(seg.cols,4,'네 칸씩');assert.equal(seg.rows,2,'두 줄');
  assert.deepEqual(seg.bs.map(b=>b.t),['없음','띠','넓은 띠','바둑판','사선','다이아','원','5레인']);
  assert.ok(seg.bs.every(b=>b.svg),'칸마다 작은 그림');assert.ok(seg.inside,'칸이 줄 밖으로 넘치지 않는다');assert.ok(seg.popOver<=1,'창이 가로로 넘치지 않는다 '+seg.popOver);
  assert.ok(seg.bs.every(b=>b.h>=40),'누르기 넉넉한 높이 '+seg.bs.map(b=>b.h));
  assert.deepEqual(seg.bs.filter(b=>b.on).map(b=>b.t),['없음'],'지금 값');
  await (await f.$('#cmd-board-settings-pop')).screenshot({path:path.join(SHOTS,`board-mow-3326-${engine}-${size}-settings.png`)});

  const pick=async k=>{await f.click(`#grassSeg button[data-mow="${k}"]`);await page.waitForTimeout(250);};
  const flat=()=>f.evaluate(()=>{const g=document.querySelector('#world>.grass-stripes');return {m:window.__grassM,kind:g?g.getAttribute('data-mow'):null,on:[...document.querySelectorAll('#grassSeg button.on')].map(b=>b.getAttribute('data-mow'))};});

  step('flat');
  await pick('diag');let r=await flat();
  assert.deepEqual(r,{m:5.2,kind:'diag',on:['diag']},'사선 '+JSON.stringify(r));
  await pick('lane');r=await flat();assert.equal(r.kind,'lane');assert.equal(r.m,5.5);
  await pick('none');r=await flat();assert.equal(r.kind,null,'없음 — 줄무늬 없음');assert.equal(r.m,0);

  step('3d');
  await f.evaluate(()=>window.__setTilt(true));await f.waitForFunction(()=>document.body.classList.contains('bc-tilt3d'));
  const src=async(test,why)=>{const t0=Date.now();let s='';
    while(Date.now()-t0<15000){s=await f.evaluate(()=>{const h=document.querySelector('#tiltSurface .tilt-stadium');return h?decodeURIComponent(h.getAttribute('src')||''):'';});
      if(s&&test(s))return s;await page.waitForTimeout(200);}
    assert.fail(why+' — '+(/(<pattern id="psStMow"[^>]*>|<radialGradient id="psStMow"[^>]*>)/.exec(s)||['(psStMow 없음)'])[0]);};
  const gb=await f.evaluate(()=>window.__tiltPitchLook({ga:'#000',gb:'#000'},'').gb);
  let s=await src(x=>/<pattern id="psStMow" patternUnits="userSpaceOnUse" width="1" height="1"\/>/.test(x),'없음 — 3D 도 빈 무늬');
  assert.ok(!s.includes('fill="'+gb+'"/></pattern>'),'없음 — 두 색 줄도 없다');
  await page.screenshot({path:path.join(SHOTS,`board-mow-3326-${engine}-${size}-3d-none.png`)});
  for(const [k,re,why] of [['band',/<pattern id="psStMow" patternUnits="userSpaceOnUse" x="[\d.]+" y="[\d.]+" width="[\d.]+"/,'띠'],
                           ['check',/<pattern id="psStMow"[^>]*height="[\d.]+"><rect[^>]*fill-opacity="\.062"/,'바둑판'],
                           ['diag',/<pattern id="psStMow"[^>]*patternTransform="rotate\(45 /,'사선'],
                           ['ring',/<radialGradient id="psStMow"[^>]*spreadMethod="repeat"/,'원']]){
    await pick(k);s=await src(x=>re.test(x),why);
    assert.equal(s.includes('fill="'+gb+'"/></pattern>'),k==='band','두 색 줄은 띠만 — '+k);
    await page.screenshot({path:path.join(SHOTS,`board-mow-3326-${engine}-${size}-3d-${k}.png`)});
  }

  step('save');
  const saved=await f.evaluate(()=>captureSnap().grassM);assert.equal(saved,5.4,'보드 값(원)');
  await f.evaluate(()=>window.__setTilt(false));await f.waitForFunction(()=>!document.body.classList.contains('bc-tilt3d'));
  const xml=await f.evaluate(()=>{const o=boardImageXML();return (o&&o.xml)||'';});
  assert.match(xml,/<radialGradient id="psGrassP"[^>]*spreadMethod="repeat"/,'평면 그림 내보내기에 무늬');
  await pick('none');

  step('errors');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({test:'board-mow-3326',engine,size,passed:true}));
}catch(e){console.error('board-mow-3326 실패 단계:',cur);console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){process.exitCode=process.exitCode||0;} await fx.close();}

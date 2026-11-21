import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.332 — 잔디결 간격(사용자 11/19 «3d 평면모두 잔디결의 간격을 정하고 싶어 유소년 현장은 인조잔디결이 4m야» → 목업 A안 · 하프라인 기준). 합성 팀 fixture 에서만.
//  · 보드 설정 › 운동장 › 바탕 › 잔디 무늬: «띠»를 누르면(실제 클릭) 4m · 아래에 간격 여섯 칸 한 줄 + 한 줄 설명, 다른 무늬면 숨는다
//  · 간격 칸을 누르면 grassM 이 그 m · 평면 줄무늬가 하프라인(PR().CX)에서 정확히 그 간격(고치기 전 코드는 칸이 없어 여기서 떨어진다)
//  · 3D 경기장도 같은 간격 · 같은 자리(mowPlan 을 지켜보고 그림 <img> 에 그 글자가 든다)
//  · 8인제로 바꾸면 설명 줄의 결 수가 바뀌고 간격은 그대로 4m(규격 길이로 나누지 않는다)
//  · 다른 무늬에 갔다 «띠»로 돌아오면 마지막 간격 · 저장 사본에 간격
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){cur=s;}console.log('board-mow-gap-3332 '+s);};
try{
  const {page,logs}=await openApp(fx,size,{browsers,tilt3d:false});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.PSBoardMow&&typeof window.__psToggleBoardSettings==='function',null,{timeout:30000});
  await page.waitForTimeout(600);
  await f.evaluate(()=>{window.__setGrassM(0);window.__psToggleBoardSettings('open');document.getElementById('cmd-board-settings-pop').__psSelectTab('pitch');});
  await page.waitForTimeout(400);
  const ui=()=>f.evaluate(()=>{const s=document.getElementById('grassSeg'),pop=document.getElementById('cmd-board-settings-pop'),gap=s.querySelector('.ps-mow-gap'),r=s.getBoundingClientRect();
    s.scrollIntoView({block:'center'});
    const chips=[...s.querySelectorAll('.ps-mow-gs>button')].map(b=>{const q=b.getBoundingClientRect();return {t:b.textContent.trim(),on:b.classList.contains('on'),l:q.left,r:q.right,top:q.top,h:q.height,w:q.width};});
    return {m:window.__grassM,shown:!!gap&&getComputedStyle(gap).display!=='none',chips,hint:(s.querySelector('.ps-mow-hint')||{}).textContent||'',
      on:[...s.querySelectorAll(':scope>button.on')].map(b=>b.getAttribute('data-mow')),band:s.querySelector(':scope>button[data-mow="band"]').getAttribute('data-g'),
      inside:chips.every(b=>b.l>=r.left-.5&&b.r<=r.right+.5),rows:new Set(chips.map(b=>Math.round(b.top))).size,popOver:pop.scrollWidth-pop.clientWidth};});
  /* 평면 줄무늬의 무늬 정의 · 운동장 자리 */
  const flat=()=>f.evaluate(()=>{const p=document.querySelector('#world>.grass-stripes pattern#psGrassP'),pr=PR();
    return p?{x:+p.getAttribute('x'),w:+p.getAttribute('width'),CX:pr.CX,PW:pr.PW,len:pitchSpec().len}:null;});
  const near=(a,b,why)=>assert.ok(Math.abs(a-b)<=.06,why+' '+a+' ≈ '+b);

  step('band');
  let u=await ui();assert.equal(u.shown,false,'없음 — 간격 칸 숨김');
  await f.click('#grassSeg button[data-mow="band"]');await page.waitForTimeout(250);
  u=await ui();
  assert.equal(u.m,4,'«띠»를 처음 누르면 유소년 인조잔디결 4m');assert.deepEqual(u.on,['band']);assert.equal(u.shown,true,'띠 — 간격 칸');
  assert.deepEqual(u.chips.map(c=>c.t),['3m','4m','5m','6m','8m','10m']);assert.deepEqual(u.chips.filter(c=>c.on).map(c=>c.t),['4m']);
  assert.equal(u.rows,1,'여섯 칸 한 줄');assert.ok(u.inside,'칸이 줄 밖으로 넘치지 않는다');assert.ok(u.popOver<=1,'창이 가로로 넘치지 않는다 '+u.popOver);
  assert.ok(u.chips.every(c=>c.h>=40),'손가락으로 누르기 넉넉한 높이 '+u.chips.map(c=>c.h));
  assert.equal(u.hint,'결 간격 · 하프라인에서 4m씩 · 한쪽 13결 + 골라인 앞 0.5m');
  let p=await flat();near(p.x,p.CX,'하프라인에서');near(p.w,2*4*p.PW/105,'4m 한 쌍');
  await (await f.$('#cmd-board-settings-pop')).screenshot({path:path.join(SHOTS,`board-mow-gap-3332-${engine}-${size}-settings.png`)});

  step('chip');
  await f.click('#grassSeg .ps-mow-gs button[data-gap="6"]');await page.waitForTimeout(250);
  u=await ui();assert.equal(u.m,6);assert.deepEqual(u.on,['band'],'무늬는 띠 그대로');assert.deepEqual(u.chips.filter(c=>c.on).map(c=>c.t),['6m']);assert.equal(u.band,'6','«띠» 칸을 다시 눌러도 6m');
  assert.equal(u.hint,'결 간격 · 하프라인에서 6m씩 · 한쪽 8결 + 골라인 앞 4.5m');
  p=await flat();near(p.x,p.CX,'하프라인에서');near(p.w,2*6*p.PW/105,'6m 한 쌍');
  await f.click('#grassSeg button[data-mow="band"]');await page.waitForTimeout(200);assert.equal((await ui()).m,6,'«띠»를 다시 눌러도 간격 그대로');

  step('3d');
  await f.evaluate(()=>{const G=window.PSStadiumGround,orig=G.mowPlan;window.__mowCalls=[];
    G.mowPlan=function(o){const r=orig.apply(this,arguments);window.__mowCalls.push({o:{L:o.L,pw:o.pw,len:o.len,multi:!!o.multi},defs:r.defs,two:r.two});return r;};});
  await f.evaluate(()=>window.__setTilt(true));await f.waitForFunction(()=>document.body.classList.contains('bc-tilt3d'));
  const drawn=async(gap,why)=>{const t0=Date.now();let last=null;
    while(Date.now()-t0<15000){
      last=await f.evaluate(()=>{const c=window.__mowCalls[window.__mowCalls.length-1],h=document.querySelector('#tiltSurface .tilt-stadium'),s=h?decodeURIComponent(h.getAttribute('src')||''):'';
        if(!c)return null;const m=/<pattern id="psStMow"[^>]*x="([\d.]+)"[^>]*width="([\d.]+)"/.exec(c.defs);
        return {L:c.o.L,pw:c.o.pw,len:c.o.len,x:m&&+m[1],w:m&&+m[2],two:c.two,inImg:!!c.defs&&s.includes(c.defs)};});
      if(last&&last.w&&Math.abs(last.w-2*gap*last.pw/last.len)<.06&&last.inImg)return last;
      await page.waitForTimeout(200);}
    assert.fail(why+' '+JSON.stringify(last));};
  let d=await drawn(6,'3D 6m');near(d.x,d.L+d.pw/2,'3D 하프라인에서');near(d.two,2*6*d.pw/d.len,'두 색 줄도 6m');
  await page.screenshot({path:path.join(SHOTS,`board-mow-gap-3332-${engine}-${size}-3d-6m.png`)});
  await f.evaluate(()=>window.__psToggleBoardSettings('open'));await page.waitForTimeout(200);
  await f.evaluate(()=>document.getElementById('cmd-board-settings-pop').__psSelectTab('pitch'));await page.waitForTimeout(200);
  await f.click('#grassSeg .ps-mow-gs button[data-gap="10"]');
  d=await drawn(10,'3D 10m — 간격만 바꿔도 다시 그린다');near(d.x,d.L+d.pw/2,'3D 하프라인에서');
  await f.click('#grassSeg .ps-mow-gs button[data-gap="4"]');d=await drawn(4,'3D 4m');
  await page.screenshot({path:path.join(SHOTS,`board-mow-gap-3332-${engine}-${size}-3d-4m.png`)});
  await f.evaluate(()=>window.__setTilt(false));await f.waitForFunction(()=>!document.body.classList.contains('bc-tilt3d'));

  step('u12');
  await f.evaluate(()=>{window.__psToggleBoardSettings('open');document.getElementById('cmd-board-settings-pop').__psSelectTab('pitch');});await page.waitForTimeout(250);
  await f.click('#pitchSpecSeg button[data-spec="u12"]');await page.waitForTimeout(400);
  u=await ui();assert.equal(u.m,4,'간격 그대로');assert.equal(u.hint,'결 간격 · 하프라인에서 4m씩 · 한쪽 8결 + 골라인 앞 0.5m','8인제 — 결 수가 바뀐다');
  p=await flat();assert.equal(p.len,65);near(p.x,p.CX,'8인제 하프라인에서');near(p.w,2*4*p.PW/65,'8인제도 정확히 4m(예전 3.82m)');
  await f.click('#pitchSpecSeg button[data-spec="fifa"]');await page.waitForTimeout(300);

  step('other');
  await f.click('#grassSeg button[data-mow="check"]');await page.waitForTimeout(250);
  u=await ui();assert.equal(u.m,5.1);assert.equal(u.shown,false,'바둑판 — 간격 칸 숨김');assert.equal(u.band,'4','마지막 간격');
  await f.click('#grassSeg button[data-mow="band"]');await page.waitForTimeout(250);assert.equal((await ui()).m,4,'돌아오면 마지막 간격');
  await f.click('#grassSeg .ps-mow-gs button[data-gap="5"]');await page.waitForTimeout(250);
  assert.equal(await f.evaluate(()=>captureSnap().grassM),5,'저장 사본에 간격');
  const xml=await f.evaluate(()=>{const o=boardImageXML();return (o&&o.xml)||'';});
  const m=/<pattern id="psGrassP"[^>]*width="([\d.]+)"/.exec(xml);assert.ok(m,'평면 그림 내보내기에 무늬');
  p=await flat();near(+m[1],2*5*p.PW/105,'내보내기도 5m');
  await f.click('#grassSeg button[data-mow="none"]');

  step('errors');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({test:'board-mow-gap-3332',engine,size,passed:true}));
}catch(e){console.error('board-mow-gap-3332 실패 단계:',cur);console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){process.exitCode=process.exitCode||0;} await fx.close();}

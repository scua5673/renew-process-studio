import assert from 'node:assert/strict';
import {startFixture,openApp,WP} from '../fixtures/team-app.mjs';
// 3.077 — 폰 첫 화면(app.html psPhoneStart): 로그인한 팀 공간 → 팀운영 › 오늘, 개인 공간 → 커뮤니티. 데스크톱은 그대로 작전판.
// 폰 크기는 WebKit 엔진(fixture SIZES), Chromium 잡은 데스크톱만 본다(다른 폰 시험과 같은 규칙). 합성 팀 fixture.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const fx=await startFixture(),browsers={};
const state=page=>page.evaluate(()=>({app:document.body.dataset.psApp,team:document.body.classList.contains('ps-team-open'),
  today:!!document.querySelector('#teamBottom [data-tb="today"].on,#teamNav [data-team-key="today"].on'),
  lock:(()=>{const l=document.getElementById('psDataLock');return !!(l&&getComputedStyle(l).display!=='none'&&l.getBoundingClientRect().height>0);})()}));
try{
  const {page,logs}=await openApp(fx,size,{browsers,phoneStart:true});
  await page.waitForTimeout(1200);
  const team=await state(page);
  if(size==='phone'){
    assert.deepEqual({app:team.app,team:team.team,today:team.today},{app:'scout',team:true,today:true},'폰 · 팀 공간 → 팀운영 › 오늘');
    assert.equal(team.lock,false,'자료 잠금 판이 보이지 않는다');
    await page.evaluate(wp=>localStorage.setItem('ps_active_ws',wp),WP);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.body.dataset.psApp==='community',null,{timeout:20000});
  }else{
    assert.equal(team.app,'board','데스크톱은 그대로 작전판');
    assert.equal(team.team,false);
  }
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[],'page errors');   /* WebKit 의 ResizeObserver 경고는 다른 시험과 같이 뺀다 */
  console.log(JSON.stringify({engine,size,passed:true,team}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}

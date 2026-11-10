import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
// 3.273 — 직접 써 보다 찾음(self-use-crawl · 코치 · 폰 390): 일정의 떠 있는 «＋ 오늘에 추가» 단추가 글자 폭에 딱 붙어 있었다(폭 89 · 안쪽 여백 0).
// 3.218 team-mobile.css 의 «일정 안의 모든 단추 min-width:44px»(선택자가 더 세다)가 process.html 의 .schedule-fab{min-width:112px} 를 눌렀다.
// 단추는 112 이상 · 글자 양옆에 여백이 있고 화면 안에 있다. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
SIZES.phone.engine=engine;
const fx=await startFixture(),browsers={};
try{
  for(const width of [360,390,430]){
    SIZES.phone.ctx={...SIZES.phone.ctx,viewport:{width,height:844}};
    const {page,context}=await openApp(fx,'phone',{browsers,phoneStart:true});
    await page.waitForFunction(()=>document.body.classList.contains('ps-team-open'));
    await page.locator('#teamBottom [data-tb="training"]').click();
    const f=await (await page.waitForSelector('#fProcess')).contentFrame();
    await f.waitForFunction(()=>{const b=document.querySelector('.schedule-fab');return b&&b.getClientRects().length&&/오늘에 추가/.test(b.textContent);},null,{timeout:20000});
    const m=await f.evaluate(()=>{
      const b=document.querySelector('.schedule-fab'),r=b.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(b);const t=range.getBoundingClientRect();
      return {w:r.width,left:t.left-r.left,right:r.right-t.right,inView:r.left>=0&&r.right<=innerWidth,vw:innerWidth};});
    assert.ok(m.w>=112,width+'px: 떠 있는 단추 폭 '+JSON.stringify(m));
    assert.ok(m.left>=10&&m.right>=10,width+'px: 글자 양옆 여백 '+JSON.stringify(m));
    assert.ok(m.inView,width+'px: 화면 안 '+JSON.stringify(m));
    await context.close();
  }
  console.log(JSON.stringify({engine,test:'schedule-fab-phone-3273',ok:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}

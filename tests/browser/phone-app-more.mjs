import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.938·2.939 — 폰 하단 메뉴 «더보기»(#psMoreBtn · #appMoreSheet). 바는 다섯 + 더보기, 시트는 폰 바에 없는 보관함 + 앱 설정·오류 제보·사용법.
// 2.939: 운동장·보관함은 iframe 이라 그 화면을 눌러도 셸 document 의 pointerdown 이 안 온다 — 그래도 시트가 닫혀야 한다.
// 데스크톱·아이패드 사이드바에는 더보기가 없다. 합성 팀 fixture.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'phone':'desktop';
const fx=await startFixture(),browsers={};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await wait(1500);
  const bar=()=>page.evaluate(()=>[...document.querySelectorAll('#appSeg button')].filter(b=>{const c=getComputedStyle(b),r=b.getBoundingClientRect();return c.display!=='none'&&r.width>0;}).map(b=>(b.querySelector('span')||b).textContent.trim()));
  if(size==='desktop'){
    assert.deepEqual(await bar(),['보드','보관함','팀 운영','IDP','커뮤니티','학습'],'데스크톱 사이드바는 그대로 — 더보기 없음');
    console.log(JSON.stringify({engine,size,passed:true}));
  }else{
    assert.deepEqual(await bar(),['보드','팀 운영','IDP','커뮤니티','학습','더보기'],'폰 하단 바 = 다섯 + 더보기');
    const more=page.locator('#psMoreBtn'),sheet=page.locator('#appMoreSheet');
    await more.tap();await wait(200);
    assert.equal(await sheet.isVisible(),true,'더보기 → 시트');
    assert.equal(await more.getAttribute('aria-expanded'),'true');
    const items=await page.evaluate(()=>[...document.querySelectorAll('#appMoreSheet .tms-g button')].map(b=>b.textContent.trim()));
    assert.deepEqual(items,['보관함','앱 설정','오류 제보','사용법'],'시트 = 보관함 + 도움 셋');
    const geo=await page.evaluate(()=>{const s=document.getElementById('appMoreSheet').getBoundingClientRect(),b=document.getElementById('appSeg').getBoundingClientRect();return {bottom:s.bottom,barTop:b.top,left:s.left,right:s.right,vw:innerWidth};});
    assert.ok(geo.bottom<=geo.barTop&&geo.left>=0&&geo.right<=geo.vw,'시트는 하단 바 위 · 화면 안 '+JSON.stringify(geo));
    await sheet.locator('.tms-g button',{hasText:'보관함'}).tap();await wait(900);
    assert.equal(await page.evaluate(()=>document.body.getAttribute('data-ps-app')),'design','시트의 보관함 → 보관함 화면');
    assert.equal(await sheet.isVisible(),false,'고르면 닫힌다');
    assert.equal(await more.evaluate(b=>b.classList.contains('on')),true,'바에 없는 화면이면 더보기에 불');
    await more.tap();await wait(200);
    await page.keyboard.press('Escape');await wait(150);
    assert.equal(await sheet.isVisible(),false,'Esc 로 닫힌다');
    await page.locator('#appSeg button[data-app="board"]:not([data-train])').tap();await wait(900);
    assert.equal(await more.evaluate(b=>b.classList.contains('on')),false,'보드로 돌아오면 불이 꺼진다');
    await more.tap();await wait(200);
    assert.equal(await sheet.isVisible(),true);
    const inFrame=await page.evaluate(()=>{const e=document.elementFromPoint(180,320);return e&&e.tagName;});
    assert.equal(inFrame,'IFRAME','(180,320) 은 운동장 iframe 화면');
    await page.mouse.click(180,320);await wait(300);
    assert.equal(await sheet.isVisible(),false,'운동장(iframe 화면)을 눌러도 닫힌다');
    const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
    assert.deepEqual(errs,[],'페이지 오류 없음');
    const ipad=await openApp(fx,'ipad',{browsers});await wait(1200);
    assert.equal(await ipad.page.evaluate(()=>getComputedStyle(document.getElementById('psMoreBtn')).display),'none','아이패드(사이드바)에는 더보기 없음');
    console.log(JSON.stringify({engine,size,passed:true,items}));
  }
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}

import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.937 — 폰 하단 바 «더보기»(사용자 "하단메뉴가 5개만 나오는데 다 볼 수 있게"). 바는 다섯 + 더보기, 시트는 앱 여섯 전부
// (폰 하단 바에서 빠져 있던 보관함 포함). 시트 칸은 원래 버튼을 그대로 누른다. 데스크톱 사이드바에는 더보기가 없다. 합성 팀 fixture.
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
    const widths=await page.evaluate(()=>[...document.querySelectorAll('#appSeg button')].filter(b=>getComputedStyle(b).display!=='none').map(b=>Math.round(b.getBoundingClientRect().width)));
    assert.ok(Math.max(...widths)-Math.min(...widths)<=1,'여섯 칸이 같은 폭 '+widths);
    const more=page.locator('#psAppMore'),sheet=page.locator('#psAppMoreSheet');
    await more.tap();await wait(200);
    assert.equal(await sheet.isVisible(),true,'더보기 → 시트');
    assert.equal(await more.getAttribute('aria-expanded'),'true');
    const items=await page.evaluate(()=>[...document.querySelectorAll('#psAppMoreSheet .ams-grid button')].map(b=>(b.classList.contains('on')?'*':'')+b.textContent.trim()));
    assert.deepEqual(items,['*보드','보관함','팀 운영','IDP','커뮤니티','학습'],'시트에 앱 여섯 · 지금 화면 표시');
    const geo=await page.evaluate(()=>{const s=document.getElementById('psAppMoreSheet').getBoundingClientRect(),b=document.getElementById('appSeg').getBoundingClientRect();return {bottom:s.bottom,barTop:b.top,left:s.left,right:s.right,vw:innerWidth};});
    assert.ok(geo.bottom<=geo.barTop&&geo.left>=0&&geo.right<=geo.vw,'시트는 하단 바 위 · 화면 안 '+JSON.stringify(geo));
    await sheet.locator('.ams-grid button',{hasText:'보관함'}).tap();await wait(900);
    assert.equal(await page.evaluate(()=>document.body.getAttribute('data-ps-app')),'design','시트의 보관함 → 보관함 화면');
    assert.equal(await sheet.isVisible(),false,'고르면 닫힌다');
    assert.equal(await more.evaluate(b=>b.classList.contains('on')),true,'바에 없는 화면이면 더보기에 불');
    await more.tap();await wait(200);
    await page.keyboard.press('Escape');await wait(150);
    assert.equal(await sheet.isVisible(),false,'Esc 로 닫힌다');
    await more.tap();await wait(200);
    await page.mouse.click(180,320);await wait(250);
    assert.equal(await sheet.isVisible(),false,'바깥(iframe 화면)을 눌러도 닫힌다');
    await page.locator('#appSeg button[data-app="board"]:not([data-train])').tap();await wait(700);
    assert.equal(await more.evaluate(b=>b.classList.contains('on')),false,'보드로 돌아오면 불이 꺼진다');
    const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
    assert.deepEqual(errs,[],'페이지 오류 없음');
    const ipad=await openApp(fx,'ipad',{browsers});await wait(1200);
    assert.equal(await ipad.page.evaluate(()=>getComputedStyle(document.getElementById('psAppMore')).display),'none','아이패드(사이드바)에는 더보기 없음');
    console.log(JSON.stringify({engine,size,passed:true,items}));
  }
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}

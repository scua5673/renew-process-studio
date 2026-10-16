import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.055 — 오류 제보 «미팅»: 운동장 편집에서 피치를 바꾸면 지금 슬라이드만 · 안내의 «모든 슬라이드에» → 9장 모두 · «되돌리기»
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof anim==='object'&&document.getElementById('dfNew'));
  await bf.evaluate(()=>document.getElementById('dfNew').click());
  await bf.waitForSelector('.vcc-item');
  await bf.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/미팅 자료/.test(b.textContent)).click());
  await bf.waitForFunction(()=>document.body.classList.contains('meet-mode')&&anim.slides&&anim.slides.length===9,null,{timeout:15000});
  await page.waitForTimeout(400);
  await bf.evaluate(()=>{ if(window.__meetingPageActive)window.__meetingPageEdit(); });
  await bf.waitForFunction(()=>!window.__meetingPageActive);
  const before=await bf.evaluate(()=>anim.slides.map(s=>s.snap.pitchTheme||''));
  assert.ok(before.every(t=>t!=='calm'),JSON.stringify(before));
  const orient=await bf.evaluate(()=>anim.slides.map(s=>s.snap.orientation));

  // 부분 적용: 피치 딥그린 — 지금 슬라이드만
  await bf.evaluate(()=>{window.__psUserClick=1;try{document.querySelector('#pitchSeg button[data-p="calm"]').click();}finally{window.__psUserClick=0;}});
  await bf.waitForFunction(()=>{const b=document.querySelector('#cs-ftoast .ftoast-act');return b&&/모든 슬라이드에/.test(b.textContent);},null,{timeout:5000});
  assert.equal(await bf.evaluate(()=>document.querySelector('#cs-ftoast .ftoast-act').textContent),'모든 슬라이드에 (8장)');
  await bf.evaluate(()=>window.__meetSyncCur&&window.__meetSyncCur());
  const part=await bf.evaluate(()=>anim.slides.map(s=>s.snap.pitchTheme||''));
  assert.equal(part.filter(t=>t==='calm').length,1,'부분 적용 '+JSON.stringify(part));

  // 전체 적용
  await bf.evaluate(()=>document.querySelector('#cs-ftoast .ftoast-act').click());
  const all=await bf.evaluate(()=>anim.slides.map(s=>s.snap.pitchTheme));
  assert.deepEqual(all,Array(9).fill('calm'),JSON.stringify(all));
  assert.deepEqual(await bf.evaluate(()=>anim.slides.map(s=>s.snap.orientation)),orient,'방향은 슬라이드마다 그대로');
  assert.equal(await bf.evaluate(()=>document.querySelector('#cs-ftoast .ftoast-act').textContent),'되돌리기');

  // 되돌리기 — 지금 슬라이드는 바꾼 그대로, 다른 장은 원래대로
  await bf.evaluate(()=>document.querySelector('#cs-ftoast .ftoast-act').click());
  const back=await bf.evaluate(()=>anim.slides.map(s=>s.snap.pitchTheme||''));
  assert.deepEqual(back.filter(t=>t==='calm').length,1,JSON.stringify(back));
  await page.screenshot({path:path.join(SHOTS,'meeting-pitch-all-'+size+'.png')});
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('meeting-pitch-all ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}

import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.102 — 오류 제보 934aaa3e «보드 설정에서 운동장 스타일을 수정하면 모든 페이지가»: 피치를 바꾸면 작전판의 모든 페이지(와 그 장면) ·
// 미팅이면 모든 슬라이드에. 알림의 «이 페이지만»은 다른 페이지를 되돌린다. 운동장 사진(@photo:)을 깐 페이지는 덮지 않는다. 합성 팀 fixture 에서만 돈다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
/* 알림은 6초 뒤 걷힌다 — 느린 WebKit 에서 프레임 사이에 놓치지 않게, 단추가 붙는 그 순간을 적어 둔다(__ftSeen) */
const pick=(f,p)=>f.evaluate(p=>{window.__ftSeen=null;try{window.__ftMo&&window.__ftMo.disconnect();}catch(_){}
  const old=document.querySelector('#cs-ftoast .ftoast-act');   /* 앞 알림의 단추가 아직 떠 있을 수 있다 — 새 단추만 */
  window.__ftMo=new MutationObserver(()=>{const b=document.querySelector('#cs-ftoast .ftoast-act');if(b&&b!==old&&!window.__ftSeen)window.__ftSeen={btn:b,label:b.textContent,text:document.getElementById('cs-ftoast').textContent};});
  window.__ftMo.observe(document.body,{childList:true,subtree:true});
  window.__psUserClick=1;try{document.querySelector('#pitchSeg button[data-p="'+p+'"]').click();}finally{window.__psUserClick=0;}},p);
const toastBtn=async f=>{try{await f.waitForFunction(()=>window.__ftSeen,null,{timeout:15000});return await f.evaluate(()=>window.__ftSeen.label);}
  catch(e){console.error('board-pitch-all-pages diag',JSON.stringify(await f.evaluate(()=>({toast:(document.getElementById('cs-ftoast')||{}).textContent||'',playing:typeof animPlaying!=='undefined'?animPlaying:null,
    cls:document.body.className.slice(0,240),pitch:document.documentElement.dataset.pitch,slides:(anim.slides||[]).map(s=>s&&s.snap&&s.snap.pitchTheme),pages:((window.__psPages&&window.__psPages.pg())||[]).map(p=>p&&p.snap&&p.snap.pitchTheme)})).catch(x=>String(x))));throw e;}};
const toastText=f=>f.evaluate(()=>window.__ftSeen.text);
/* 3.102 — 장면이 움직이는 동안(재생 · 슬라이드 장면 넘김) 바꾼 피치는 미리보기라 퍼뜨리지 않는다(보드 2.525 와 같다). 느린 WebKit 은 그게 끝나기를 기다린다 */
const settle=f=>f.waitForFunction(()=>typeof animPlaying==='undefined'||!animPlaying,null,{timeout:15000});
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__psPages&&typeof window.__psPages.pg==='function'&&typeof window._viewScenesMatch==='function'&&window._viewScenesMatch.__psPitchAll);
  await page.waitForTimeout(800);

  // ① 작전판 세 페이지 — 페이지마다 다른 피치(셋째는 운동장 사진 참조)
  await f.evaluate(()=>{const add=document.querySelector('#boardPageStrip .tb-add,#boardPageStrip .bp-add');add.click();add.click();});
  await f.waitForFunction(()=>(window.__psPages.pg()||[]).length===3);
  const tabs=()=>f.locator('#boardPageStrip .bp-tab');
  await tabs().nth(1).click();await page.waitForTimeout(300);
  assert.equal(await f.evaluate(()=>window.__psPages.book.idx()),1);
  /* 다른 페이지의 저장본을 고친다(페이지를 옮기면 떠나는 페이지는 판에서 다시 담긴다 — 그래서 옮긴 뒤에) */
  await f.evaluate(()=>{const P=window.__psPages.pg();P[0].snap.pitchTheme='white';P[2].snap.pitchTheme='';P[2].snap.pitchImg='@photo:0123456789abcdef-160x90';});

  // ② 둘째 페이지에서 «딥그린» → 첫째 페이지도 딥그린, 사진 페이지는 그대로
  await settle(f);
  await pick(f,'calm');
  assert.equal(await toastBtn(f),'이 페이지만');
  assert.match(await toastText(f),/피치를 모든 페이지에 적용했어요 \(다른 페이지 1개\)/);
  const after=await f.evaluate(()=>window.__psPages.pg().map(p=>[p.snap.pitchTheme,p.snap.pitchImg||null]));
  assert.deepEqual(after[0],['calm',null],'the other page took the pitch');
  assert.deepEqual(after[2],['','@photo:0123456789abcdef-160x90'],'a page with its own photo keeps it');
  const saved=await f.evaluate(()=>window.__psPages.forSave().map(p=>p.snap.pitchTheme));
  assert.deepEqual(saved.slice(0,2),['calm','calm'],'what gets saved has it too');
  await tabs().nth(0).click();await page.waitForTimeout(400);
  assert.equal(await f.evaluate(()=>document.documentElement.dataset.pitch),'calm','opening the other page shows the new pitch');
  await page.screenshot({path:path.join(SHOTS,'board-pitch-all-pages-'+size+'.png')});

  // ③ «이 페이지만» — 바꾼 페이지(지금 첫째)만 남기고 다른 페이지를 되돌린다
  await pick(f,'white');
  assert.equal(await toastBtn(f),'이 페이지만');
  assert.equal(await f.evaluate(()=>window.__psPages.pg()[1].snap.pitchTheme),'white');
  const undone=await f.evaluate(()=>{window.__ftSeen.btn.click();return document.getElementById('cs-ftoast').textContent;});
  assert.equal(await f.evaluate(()=>window.__psPages.pg()[1].snap.pitchTheme),'calm','the other page is back');
  assert.equal(await f.evaluate(()=>document.documentElement.dataset.pitch),'white','this page keeps the new pitch');
  assert.match(undone,/이 페이지만 바꾸고/);

  // ④ 미팅 — 피치를 바꾸면 모든 슬라이드(와 그 장면)에
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>document.getElementById('dfNew'));
  await f.evaluate(()=>document.getElementById('dfNew').click());
  await f.waitForSelector('.vcc-item');
  await f.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/미팅 자료/.test(b.textContent)).click());
  await f.waitForFunction(()=>document.body.classList.contains('meet-mode')&&anim.slides&&anim.slides.length>=2,null,{timeout:15000});
  await page.waitForTimeout(400);
  await f.evaluate(()=>{ if(window.__meetingPageActive)window.__meetingPageEdit(); });
  await f.waitForFunction(()=>!window.__meetingPageActive);
  const n=await f.evaluate(()=>anim.slides.length),orient=await f.evaluate(()=>anim.slides.map(s=>s.snap.orientation));
  const thumbsBefore=await f.evaluate(()=>anim.slides.map(s=>String(s.thumb||'')));
  assert.ok(await f.evaluate(()=>anim.slides.every(s=>s.snap.pitchTheme!=='calm')),'no slide is deep green yet');
  await settle(f);
  await pick(f,'calm');
  assert.equal(await toastBtn(f),'이 슬라이드만');
  assert.deepEqual(await f.evaluate(()=>anim.slides.map(s=>s.snap.pitchTheme)),Array(n).fill('calm'),'every slide');
  assert.deepEqual(await f.evaluate(()=>anim.slides.map(s=>s.snap.orientation)),orient,'orientation stays per slide');
  assert.ok(await f.evaluate(()=>anim.slides.every(s=>!Array.isArray(s.frames)||s.frames.every(x=>!x||!x.snap||x.snap.pitchTheme==='calm'))),'every scene of every slide');
  /* 다른 슬라이드 그림은 하나씩 나눠 그린다(한 번에 그리면 화면이 멈췄다) — 다 그릴 때까지 기다린다 */
  await f.waitForFunction(()=>window.__psPitchThumbsLeft&&window.__psPitchThumbsLeft()===0,null,{timeout:30000});
  const thumbsAfter=await f.evaluate(()=>anim.slides.map(s=>String(s.thumb||'')));
  assert.ok(thumbsAfter.every((t,i)=>t&&t!==thumbsBefore[i]),'every slide picture is redrawn — the open slide too');
  await page.screenshot({path:path.join(SHOTS,'board-pitch-all-slides-'+size+'.png')});

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,test:'board-pitch-all-pages',passed:true,slides:n}));
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}

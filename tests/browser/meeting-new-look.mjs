import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.128 — 사용자 «미팅만들기 들어가면 평면에 15존에 네이비 피치로».
// 3D 로 쓰는 기기에서 보관함 «미팅 만들기» → 평면 · 9장 모두 네이비 · 15존. 기기 설정(3D)은 그대로, 미팅을 나가면 3D 로 돌아온다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.__psMeetLook&&window.__meetSeed&&window.__meetSeed.__psForm,null,{timeout:30000});
  // 작업 보드는 3D · 흰 운동장 · 구역선 없음
  await f.evaluate(()=>{window.__setTilt(true,{quiet:true});window.__applyPitch('white',null);state.gridType='off';buildPitch();renderTokens();});
  assert.equal(await f.evaluate(()=>document.body.classList.contains('bc-tilt3d')&&localStorage.getItem('ps_board_tilt3d')),'1');
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>document.getElementById('dfNew'),null,{timeout:30000});
  await f.evaluate(()=>document.getElementById('dfNew').click());
  await f.waitForSelector('.vcc-item');
  await f.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/미팅 자료/.test(b.textContent)).click());
  await f.waitForFunction(()=>document.body.classList.contains('meet-mode')&&anim.slides&&anim.slides.length===9,null,{timeout:15000});
  // 포메이션 고르기 창은 «기본 그대로»
  await f.waitForFunction(()=>{const o=document.getElementById('psMeetForm');return o&&o.classList.contains('on');},null,{timeout:10000}).then(()=>f.click('#psMeetForm .mf-skip')).catch(()=>{});
  await f.waitForFunction(()=>!document.body.classList.contains('bc-tilt3d'),null,{timeout:5000});
  const st=await f.evaluate(()=>({tilt:document.body.classList.contains('bc-tilt3d'),dev:localStorage.getItem('ps_board_tilt3d'),pitch:document.documentElement.dataset.pitch||'',grid:state.gridType,
    slides:anim.slides.map(s=>(s.snap.pitchTheme||'')+'|'+s.snap.gridType)}));
  assert.equal(st.tilt,false,'새 미팅은 평면');
  assert.equal(st.dev,'1','기기 설정(3D)은 그대로');
  assert.equal(st.pitch,'','지금 판은 네이비');
  assert.equal(st.grid,'grid15','지금 판은 15존');
  assert.deepEqual([...new Set(st.slides)],['|grid15'],'9장 모두 네이비 · 15존 '+JSON.stringify(st.slides));
  await page.screenshot({path:path.join(SHOTS,`meeting-new-look-${engine}-${size}-1.png`)});
  // 미팅을 나가면 3D 로
  await f.evaluate(()=>window.__bmExitMeeting());
  await f.waitForFunction(()=>!document.body.classList.contains('meet-mode')&&document.body.classList.contains('bc-tilt3d'),null,{timeout:5000});
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({ok:true,engine,size,st}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}

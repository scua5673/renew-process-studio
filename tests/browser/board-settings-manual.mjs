import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,ready,SHOTS} from '../fixtures/team-app.mjs';
// 2.993 — 보드 설정은 저절로 열리지 않는다(사용자 «보드 설정은 자동으로 열리지 않게»).
// 예전 판에서 데스크톱에 남은 «열림» 기억(ps_board_settings_pinned_v1='1')이 있어도 ① 부팅 ② 다른 화면에서 돌아올 때 닫혀 있고,
// 사람이 누르면 열리며, 다시 부팅하면 또 닫혀 있다. 합성 팀 fixture 에서만 돈다(실계정·서버 없음).
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  const toBoard=async()=>{
    await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
    const f=await (await page.waitForSelector('#fBoard')).contentFrame();
    await f.waitForFunction(()=>typeof window.__psToggleBoardSettings==='function'&&!!document.getElementById('cmd-board-settings-pop'));
    await page.waitForTimeout(2500);   /* 보드 준비 뒤 정리(250ms)·셸 동기화(350ms·1.5s)가 모두 지난 뒤 */
    return f;
  };
  const isOpen=f=>f.evaluate(()=>{const p=document.getElementById('cmd-board-settings-pop');return !!p&&p.classList.contains('on')&&getComputedStyle(p).display!=='none';});
  const boot=async()=>{await page.evaluate(()=>localStorage.setItem('ps_board_settings_pinned_v1','1'));await page.reload({waitUntil:'domcontentloaded'});await ready(page);};

  await boot();
  let f=await toBoard();
  assert.equal(await isOpen(f),false,'boot with an old «pinned» memory');

  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await page.waitForTimeout(800);
  f=await toBoard();
  assert.equal(await isOpen(f),false,'coming back to the board');

  const dockBtn=f.locator('[aria-controls="cmd-board-settings-pop"]').first(),shellBtn=await page.$('#psBoardMoreBtn');
  if(await dockBtn.isVisible())await dockBtn.click();
  else if(shellBtn&&await shellBtn.isVisible())await shellBtn.click();
  else await f.evaluate(()=>window.__psToggleBoardSettings('toggle'));
  await f.waitForFunction(()=>document.getElementById('cmd-board-settings-pop').classList.contains('on'));
  assert.equal(await isOpen(f),true,'a click opens it');

  await boot();
  f=await toBoard();
  assert.equal(await isOpen(f),false,'opened by hand last time — the next boot still starts closed');
  await page.screenshot({path:path.join(SHOTS,'board-settings-manual-'+size+'.png')});

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log('board-settings-manual ok',engine,size);
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}

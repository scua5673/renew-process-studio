import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.016 — 사용자 «보드 설정이 잘 안 보인다» → 1안: 위 띠의 «보드 저장» 옆에 «보드 설정»(톱니 + 글자).
// 같은 창을 여닫고, 열려 있는 동안 눌린 모양이며, 아래 도구줄 아이콘으로 열어도 띠 단추가 따라간다. 띠 단추는 «바깥» 누르기가 아니다.
// 합성 팀 fixture 에서만 돈다. WebKit 은 아이패드 폭(셸 1100), Chromium 은 데스크톱 폭.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof window.__psToggleBoardSettings==='function'&&!!document.getElementById('cmd-board-settings-pop')&&!!document.getElementById('bpBoardSettings'),null,{timeout:30000});
  await page.waitForTimeout(2500);   /* 보드 준비 뒤 정리·셸 동기화가 모두 지난 뒤 */
  const st=()=>f.evaluate(()=>{const b=document.getElementById('bpBoardSettings'),p=document.getElementById('cmd-board-settings-pop'),r=b&&b.getBoundingClientRect();
    return {open:!!p&&p.getAttribute('aria-hidden')==='false'&&p.classList.contains('on'),exp:b&&b.getAttribute('aria-expanded'),text:b&&b.textContent.trim(),
      prev:b&&b.previousElementSibling&&b.previousElementSibling.id,next:b&&b.nextElementSibling&&b.nextElementSibling.id,box:r&&[r.left,r.top,r.right,r.bottom].map(Math.round),vw:innerWidth,
      bg:b&&getComputedStyle(b).backgroundColor};});
  let s=await st();
  assert.equal(s.text,'보드 설정','visible label '+JSON.stringify(s));
  assert.equal(s.prev,'boardManualSave','right after «보드 저장» '+JSON.stringify(s));assert.equal(s.next,'vaultSave');
  assert.ok(s.box[0]>=0&&s.box[2]<=s.vw&&s.box[3]-s.box[1]>=28,'on screen and tappable '+JSON.stringify(s));
  assert.equal(s.open,false,'closed at start');assert.equal(s.exp,'false');
  const closedBg=s.bg;
  // 1) 띠 단추로 열고 닫는다
  await f.click('#bpBoardSettings');await f.waitForFunction(()=>document.getElementById('cmd-board-settings-pop').getAttribute('aria-hidden')==='false');
  await page.waitForTimeout(400);s=await st();
  assert.equal(s.open,true,'opens '+JSON.stringify(s));assert.equal(s.exp,'true','pressed look while open');assert.notEqual(s.bg,closedBg,'colour changes while open');
  await page.screenshot({path:path.join(SHOTS,'board-settings-strip-'+size+'.png')});
  await f.click('#bpBoardSettings');await f.waitForFunction(()=>document.getElementById('cmd-board-settings-pop').getAttribute('aria-hidden')!=='false');
  s=await st();assert.equal(s.open,false,'a second press closes');assert.equal(s.exp,'false');
  // 2) 바깥(운동장)을 누르면 닫힌다 — 띠 단추 자신은 바깥이 아니다(열자마자 닫히지 않았다: 위 1)
  await f.click('#bpBoardSettings');await f.waitForFunction(()=>document.getElementById('cmd-board-settings-pop').getAttribute('aria-hidden')==='false');
  await f.evaluate(()=>document.getElementById('boardStage').click());
  await f.waitForFunction(()=>document.getElementById('cmd-board-settings-pop').getAttribute('aria-hidden')!=='false');
  s=await st();assert.equal(s.exp,'false','outside click closes and the strip button follows');
  // 3) 아래 도구줄 아이콘·× 로 여닫아도 띠 단추가 따라간다
  await f.evaluate(()=>document.getElementById('viewBtn').click());
  await f.waitForFunction(()=>document.getElementById('bpBoardSettings').getAttribute('aria-expanded')==='true');
  await f.click('#cmd-board-settings-close');
  await f.waitForFunction(()=>document.getElementById('bpBoardSettings').getAttribute('aria-expanded')==='false');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,size,passed:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}

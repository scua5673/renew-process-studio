import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
// 3.033 — 아이패드 사파리 «'…/studio/app.html'에서 문제가 반복적으로 발생했습니다»(운영자 아이패드, 3.031: 새로고침이 몇 번 되다 멈춤).
// 3.027 이 3D 를 켠 적 없는 아이패드까지 작전판을 3D 경기장으로 열었다.
// ① 처음 들어온 아이패드는 평면 ② 3.027~3.032 가 저절로 넣은 «1» 은 한 번 «0» ③ 3D 로 열다 죽은 표시(ps_tilt3d_boot)가 남아 있으면 이번엔 평면 + 안내
// WebKit(CI)은 진짜 아이패드 크기 그대로, Chromium(로컬)은 같은 아이패드 UA 로 돌린다.
const engine=process.env.PS_BROWSER_ENGINE==='webkit'?'webkit':'chromium';
SIZES.ipadSafe={engine,ctx:{...SIZES.ipad.ctx,...(engine==='chromium'?{}:{})}};
const fx=await startFixture(),browsers={};
const openBoard=async page=>{
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&typeof window.__setTilt==='function'&&window.__boardReady!==false,null,{timeout:30000});
  await page.waitForTimeout(800);return f;};
try{
  // ① 처음 들어온 아이패드(3D 설정 없음)
  {const {page}=await openApp(fx,'ipadSafe',{browsers,tilt3d:null});
   assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('data-ps-device')),'ipad');
   assert.equal(await page.evaluate(()=>localStorage.getItem('ps_board_tilt3d')),null,'iPad: nothing chosen → nothing written');
   const f=await openBoard(page);
   assert.equal(await f.evaluate(()=>document.body.classList.contains('bc-tilt3d')),false,'처음 아이패드는 평면');
   assert.equal(await f.evaluate(()=>localStorage.getItem('ps_tilt3d_boot')),null,'flat boot leaves no mark');
   await page.context().close();}
  // ② 3.027~3.032 가 저절로 켠 3D(«1», 되돌림 표시 없음) → 한 번 끈다. 다시 켜면 그대로
  {const {page}=await openApp(fx,'ipadSafe',{browsers,tilt3d:true});
   assert.equal(await page.evaluate(()=>localStorage.getItem('ps_board_tilt3d')),'0','auto «1» turned off once');
   assert.equal(await page.evaluate(()=>localStorage.getItem('ps_tilt3d_touch_reset_v1')),'1');
   let f=await openBoard(page);
   assert.equal(await f.evaluate(()=>document.body.classList.contains('bc-tilt3d')),false);
   // ③ 사용자가 다시 켰고, 그 3D 부팅이 끝나지 못한 채 페이지가 죽었다(표시가 5초 전) → 다음 부팅은 평면 + 안내
   await page.evaluate(()=>{localStorage.setItem('ps_board_tilt3d','1');const tab=sessionStorage.getItem('ps_tilt3d_tab');if(!tab)throw new Error('board did not keep a tab id');
     localStorage.setItem('ps_tilt3d_boot',JSON.stringify({[tab]:Date.now()-5000}));});   /* 이 탭의 3D 부팅이 5초 전에 시작해 끝나지 못했다 */
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(2500);
   /* 작전판 iframe 은 앱과 함께 미리 부팅되기도 한다 — 그 부팅이 이미 평면으로 열었을 수 있어 셸의 값 대신 작전판을 본다 */
   assert.equal(await page.evaluate(()=>localStorage.getItem('ps_tilt3d_touch_reset_v1')),'1','the reset stays done (a later «1» is the user\'s)');
   f=await openBoard(page);
   const safe=await f.evaluate(async()=>{await new Promise(r=>setTimeout(r,1900));const t=document.getElementById('cs-ftoast');
     return {tilt:document.body.classList.contains('bc-tilt3d'),safe:window.__tiltBootSafe,shown:!!window.__tiltBootSafeShown,stored:localStorage.getItem('ps_board_tilt3d'),mark:localStorage.getItem('ps_tilt3d_boot'),toast:(t&&t.textContent)||'',hint:(document.getElementById('hint')||{}).textContent||''};});
   assert.equal(safe.tilt,false,'opened flat '+JSON.stringify(safe));assert.equal(safe.safe,true);assert.equal(safe.stored,'0');assert.equal(safe.mark,null);
   assert.equal(safe.shown,true,'and says so once the board is on screen '+JSON.stringify(safe));
   // 다시 켜면 3D 로 열리고 표시가 생긴다(20초 버티면 지워진다 — 단위 시험) · 정상 새로고침은 표시를 지워 다음 부팅도 3D
   await f.evaluate(()=>window.__setTilt(true));
   assert.ok(await f.evaluate(()=>JSON.parse(localStorage.getItem('ps_tilt3d_boot')||'{}')[sessionStorage.getItem('ps_tilt3d_tab')]>0),'turning 3D on arms this tab\'s mark');
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(2500);
   f=await openBoard(page);
   const again=await f.evaluate(()=>({tilt:document.body.classList.contains('bc-tilt3d'),safe:window.__tiltBootSafe}));
   assert.deepEqual(again,{tilt:true,safe:false},'a normal reload is not a crash: 3D again '+JSON.stringify(again));
   await page.context().close();}
  // ④ 데스크톱은 건드리지 않는다 — 창 두 개가 서로의 3D 부팅을 «멈춤»으로 읽던 것(3.033 검토에서 재현)
  {const {page,context}=await openApp(fx,'desktop',{browsers,tilt3d:true});
   const a=await openBoard(page);
   const page2=await context.newPage();await page2.goto(fx.base+'/studio/app.html',{waitUntil:'domcontentloaded'});await page2.waitForTimeout(3000);
   const b=await openBoard(page2);
   const two={a:await a.evaluate(()=>({tilt:document.body.classList.contains('bc-tilt3d'),safe:window.__tiltBootSafe})),b:await b.evaluate(()=>({tilt:document.body.classList.contains('bc-tilt3d'),safe:window.__tiltBootSafe,mark:localStorage.getItem('ps_tilt3d_boot'),stored:localStorage.getItem('ps_board_tilt3d')}))};
   assert.deepEqual(two,{a:{tilt:true,safe:false},b:{tilt:true,safe:false,mark:null,stored:'1'}},'desktop: two windows both 3D, no mark '+JSON.stringify(two));
   await context.close();}
}finally{for(const b of Object.values(browsers))await b.close();await fx.close?.();}
console.log(JSON.stringify({test:'board-3d-ipad-safe',engine,passed:true}));
process.exit(0);

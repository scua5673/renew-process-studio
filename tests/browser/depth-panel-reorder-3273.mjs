/* 3.273 — «선택한 포지션» 목록에서도 끌어 순서를 바꾼다 · 이름을 누르면 프로필이 바로 · 스카우팅 카드에도 후보 전원(선수단과 같은 레이아웃).
   합성 팀만 쓴다. 끌기는 진짜 마우스 입력. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',browsers={};
const fx=await startFixture();
try{
  const {page,logs}=await openApp(fx,'desktop',{browsers});
  await page.locator('#appSeg [data-team-hub]').click();
  await page.locator('#teamNav [data-team-key="players"]').click();
  const f=await (await page.waitForSelector('#fScout')).contentFrame();
  await f.locator('#pwTeam .pw-depth-pitch').waitFor();
  await f.waitForFunction(()=>{try{return !scoutBootPending&&scoutDataLoaded;}catch(_){return false;}});
  await page.waitForTimeout(900);   // scout.html 의 400ms 지연 renderTeam 이 지난 뒤
  await f.locator('#pwTeam [data-pw-position="pos_CM"]').first().click();
  const cands=()=>f.locator('#pwTeam .pw-depth-candidate');
  const names=()=>f.evaluate(()=>[...document.querySelectorAll('#pwTeam .pw-depth-candidate strong')].map(e=>e.textContent));
  const before=await names();assert.equal(before.length,3,'CM 세 명');
  const drag=async(from,to,above)=>{const a=await from.boundingBox(),b=await to.boundingBox();
    await page.mouse.move(a.x+40,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+48,a.y+a.height/2+4,{steps:3});
    await page.mouse.move(b.x+40,above?b.y+4:b.y+b.height-4,{steps:8});await page.mouse.up();};
  await drag(cands().nth(2),cands().nth(0),true);
  await f.waitForFunction(first=>{const e=document.querySelector('#pwTeam .pw-depth-candidate strong');return e&&e.textContent===first;},before[2]);
  assert.deepEqual(await names(),[before[2],before[0],before[1]],'목록에서 끌어 맨 위로');
  assert.deepEqual(await f.evaluate(()=>[...document.querySelectorAll('#pwTeam [data-pw-slot="pos_CM"] .pw-depth-name strong')].map(e=>e.textContent)),[before[2],before[0],before[1]],'작전판 카드도 같은 순서');
  assert.equal(await f.locator('#plEditModal').isVisible(),false,'끌기는 프로필을 열지 않는다');
  assert.equal(await f.locator('.pw-undo').count(),1,'되돌리기 알림');
  await page.screenshot({path:path.join(SHOTS,'depth-panel-reorder-'+engine+'.png')});
  // 저장된 순서: 명단에서 CM 선수의 차례
  await f.evaluate(async()=>{if(window.psFlushPending)await psFlushPending();});
  assert.deepEqual(await f.evaluate(()=>data.players.filter(p=>p.type!=='target'&&p.posId==='pos_CM').map(p=>p.name)),[before[2],before[0],before[1]]);
  // 이름을 누르면 프로필이 바로
  await page.waitForTimeout(600);   // 끌기 직후 0.4초는 클릭을 무시한다(잘못 눌림 방지)
  await cands().nth(0).locator('.pw-depth-candidate-name').click();
  await f.locator('#plEditModal').waitFor({state:'visible'});assert.equal(await f.locator('#pwDrawer[open]').count(),0);
  assert.equal(await f.locator('#plName').inputValue(),before[2]);
  await f.locator('#plClose').click();await f.locator('#plEditModal').waitFor({state:'hidden'});
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errs,[],'no page errors');
  console.log(JSON.stringify({passed:true,engine}));
}catch(e){console.error(e);process.exitCode=1;}finally{process.exit(process.exitCode||0);}

import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.019 — 사용자 «프로세스 스튜디오 처음 들어왔을 때 기본이 3D» · «훈련 만들기에서 그리드 누르면 옆에 전광판 관중석 다 사라지게».
// ① 처음 들어온 기기(3D 설정 없음)는 작전판이 3D 로 열린다 ② 보드 설정에서 평면으로 끄면 다시 열어도 평면
// ③ 그리드 판(라인 없는 빈 판)은 3D 에서 경기장 없이 잔디만 — 관중석 · 광고판 · 전광판 · 조명이 없다. 운동장으로 돌아오면 고른 꾸밈 그대로.
const fx=await startFixture(),browsers={};
try{
  const {page}=await openApp(fx,'desktop',{browsers,tilt3d:null});
  await page.waitForTimeout(2500);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ps_board_tilt3d')),'1','처음 들어온 기기는 3D');
  const openBoard=async()=>{
    await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
    const f=await (await page.waitForSelector('#fBoard')).contentFrame();
    await f.waitForFunction(()=>typeof renderTokens==='function'&&typeof window.__setTilt==='function'&&window.__boardReady!==false,null,{timeout:30000});
    await page.waitForTimeout(800);return f;};
  let f=await openBoard();
  assert.equal(await f.evaluate(()=>document.body.classList.contains('bc-tilt3d')),true,'작전판이 3D 로 열린다');
  assert.equal(await f.evaluate(()=>document.querySelectorAll('[id^="bcM"]').length),4,'3D 끌기 기준점');

  // ③ 그리드 판은 잔디만 — 운동장으로 돌아오면 원래 꾸밈
  const deco=await f.evaluate(async()=>{
    const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const look=()=>{const img=document.querySelector('#tiltSurface .tilt-stadium');let svg='';try{svg=decodeURIComponent((img&&img.getAttribute('src')||'').split(',')[1]||'');}catch(_){}
      return {deco:window.__tiltDecoNow(),sig:(img||{}).__sig||'',ads:(svg.match(/PROCESS STUDIO/g)||[]).length};};
    const pitch=look();
    window.__setPitchSpec('grid30');await frame();await new Promise(r=>setTimeout(r,300));const grid=look();
    window.__setPitchSpec('fifa');await frame();await new Promise(r=>setTimeout(r,300));const back=look();
    return {pitch,grid,back};
  });
  assert.equal(deco.pitch.deco,'full');assert.ok(deco.pitch.ads>0,'운동장: 광고판 '+deco.pitch.ads);
  assert.equal(deco.grid.deco,'grass');assert.equal(deco.grid.ads,0,'그리드 판: 광고판 없음 '+JSON.stringify({ads:deco.grid.ads}));
  assert.match(deco.grid.sig,/\|grass\|/,'경기장 그림도 잔디만으로 다시 그렸다');
  assert.equal(deco.back.deco,'full','운동장으로 돌아오면 고른 꾸밈');assert.ok(deco.back.ads>0);
  assert.match(deco.back.sig,/\|full\|/);
  assert.equal(await f.evaluate(()=>JSON.parse(localStorage.getItem('ps_tilt3d_opts_v1')||'{}').deco||'full'),'full','설정 값은 바꾸지 않는다');

  // ② 평면으로 끄면 다시 들어와도 평면
  await f.evaluate(()=>window.__setTilt(false));
  assert.equal(await page.evaluate(()=>localStorage.getItem('ps_board_tilt3d')),'0');
  await page.reload();await page.waitForTimeout(2500);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ps_board_tilt3d')),'0','끈 기기는 다시 켜지 않는다');
  f=await openBoard();
  assert.equal(await f.evaluate(()=>document.body.classList.contains('bc-tilt3d')),false,'평면 그대로');
  await page.context().close();
}finally{for(const b of Object.values(browsers))await b.close();}
console.log(JSON.stringify({test:'board-3d-default',passed:true}));
process.exit(0);

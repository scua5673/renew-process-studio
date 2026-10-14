import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.020 — 사용자 «프로세스 스튜디오 처음 들어왔을 때 기본이 3D» · «훈련 만들기에서 그리드 누르면 옆에 전광판 관중석 다 사라지게».
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

  // ④ 3.021 — 운동장 5개(사용자 «운동장 5개 했을 때도 잘 구현되게»): 경기장은 카드 배치 전체를 둘러싼다
  const five=await f.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    window.__setPitchN(5);window.__applyPitchN&&window.__applyPitchN(5);await wait(600);
    try{applyView();}catch(_){} window.__applyPitchN&&window.__applyPitchN(5);await wait(600);   /* 5개로 저장된 보드를 다시 연 것과 같이 — 배치가 가로로 넓다 */
    const rs=[...document.querySelectorAll('#ps-multipitch [data-pitch-rect]')].map(g=>g.getAttribute('data-pitch-rect').split(',').map(Number));
    const sig=((document.querySelector('#tiltSurface .tilt-stadium')||{}).__sig||'').split('|');
    const u={L:Math.min(...rs.map(r=>r[0])),R:Math.max(...rs.map(r=>r[0]+r[2])),T:Math.min(...rs.map(r=>r[1])),B:Math.max(...rs.map(r=>r[1]+r[3]))};
    const out={cards:rs.length,u,L:+sig[1],R:+sig[2],T:+sig[3],B:+sig[4],W};
    window.__setPitchN(1);window.__applyPitchN&&window.__applyPitchN(1);await wait(400);
    return out;
  });
  assert.equal(five.cards,5);
  assert.ok(five.u.L<0||five.u.R>five.W,'the wide five-pitch layout reaches past one pitch '+JSON.stringify(five));
  assert.ok(five.L<=five.u.L&&five.R>=five.u.R&&five.T<=five.u.T&&five.B>=five.u.B,'the stadium encloses every card '+JSON.stringify(five));
  assert.ok(five.L>five.u.L-40&&five.R<five.u.R+40,'and hugs the layout (no one-pitch box) '+JSON.stringify(five));

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

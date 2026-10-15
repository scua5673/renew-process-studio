import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
// 3.035 — 사용자 «훈련 세션 만들기 들어갔을 때는 보드 설정이 평면에 훈련 피치로» · «그리드 선택했을 때 보드에 여백이 없이 다 활용할 수 있게».
// ① 3D 로 쓰던 기기에서 훈련 편집기를 열면 평면 · 훈련 피치 — 설정 값(ps_board_tilt3d)은 그대로 «1»
// ② 손대지 않고 나가면 3D 로 돌아온다 ③ 편집기 안에서 «평면»을 직접 고르면(설정 값 «0») 나가도 평면 그대로
// ④ 3D 그리드 판은 틀 여백 없이(TILT_PAD_BLANK) · 잔디가 판 밖으로 한 판 넓이만큼 이어진다(경기장 그림 상자가 판보다 훨씬 크다)
// 합성 팀 fixture 에서만 돈다. 데스크톱 폭(3D 는 데스크톱에서만 처음부터 켜진다).
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const fx=await startFixture(),browsers={};
try{
  const {page,logs}=await openApp(fx,'desktop',{browsers,tilt3d:true});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof openEditor==='function'&&typeof window.__setBoardSurface==='function'&&typeof window.__setTilt==='function'&&window.__boardReady!==false&&document.body.classList.contains('bc-tilt3d'),null,{timeout:30000});
  await page.waitForTimeout(800);
  const st=()=>f.evaluate(()=>({tilt:document.body.classList.contains('bc-tilt3d'),ls:localStorage.getItem('ps_board_tilt3d'),pitch:document.documentElement.dataset.pitch,spec:state.pitchSpec,editing:document.body.classList.contains('editing')}));
  let s=await st();assert.equal(s.tilt,true,'3D 로 시작 '+JSON.stringify(s));assert.equal(s.ls,'1');
  // ① 편집기 → 평면 · 훈련 피치, 설정 값은 그대로
  await f.evaluate(()=>{try{window.__psToggleBoardSettings('force-close');}catch(_){}try{setView('session');}catch(_){}openEditor(null,'train');});
  await f.waitForFunction(()=>document.body.classList.contains('editing'));await page.waitForTimeout(1000);
  s=await st();assert.equal(s.tilt,false,'편집기는 평면 '+JSON.stringify(s));assert.equal(s.pitch,'train','훈련 피치');assert.equal(s.ls,'1','설정 값은 그대로');
  assert.equal(await f.evaluate(()=>localStorage.getItem('ps_editor_flat_told')),'1','처음 한 번 알린다');
  await page.screenshot({path:path.join(SHOTS,'board-editor-flat-'+engine+'.png')});
  // ④ 편집기 안에서 3D 를 켜고 그리드 → 여백 없이, 잔디가 판 밖으로
  await f.evaluate(()=>window.__setTilt(true));await page.waitForTimeout(600);
  await f.evaluate(()=>document.querySelector('#epSurface [data-sf="grid"]').click());await page.waitForTimeout(1400);
  const g=await f.evaluate(()=>{const img=document.querySelector('#tiltSurface .tilt-stadium'),sv=document.getElementById('board'),sf=document.getElementById('tiltSurface');
    let svg='';try{svg=decodeURIComponent((img&&img.getAttribute('src')||'').split(',')[1]||'');}catch(_){}
    const vb=(/viewBox="([^"]+)"/.exec(svg)||[0,''])[1].split(' ').map(Number),bvb=sv.viewBox.baseVal;
    return {spec:state.pitchSpec,deco:window.__tiltDecoNow(),imgW:parseFloat(img&&img.style.width)||0,surfW:sf?sf.clientWidth:0,picW:vb[2]||0,boardW:bvb.width,k:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tilt-k'))||0};});
  assert.equal(g.spec,'grid30');assert.equal(g.deco,'grass','그리드 판은 잔디만');
  assert.ok(g.picW>g.boardW*1.8&&g.picW<g.boardW*3,'경기장 그림이 판보다 훨씬 넓다(잔디 bleed 반 판) '+JSON.stringify(g));
  assert.ok(g.imgW>g.surfW*1.6,'그림이 판 상자를 넘어 무대를 덮는다 '+JSON.stringify(g));
  await page.screenshot({path:path.join(SHOTS,'board-editor-grid3d-'+engine+'.png')});
  // ③ 편집기 안에서 평면을 직접 고르면 나가도 평면
  await f.evaluate(()=>window.__setTilt(false));await page.waitForTimeout(300);
  await f.evaluate(()=>closeEditor(false));await f.waitForFunction(()=>!document.body.classList.contains('editing'));await page.waitForTimeout(1000);
  s=await st();assert.equal(s.tilt,false,'직접 끈 평면은 그대로 '+JSON.stringify(s));assert.equal(s.ls,'0');assert.equal(s.spec,'fifa','보드의 운동장은 그대로');
  // ② 3D 로 돌아가 편집기를 손대지 않고 나가면 3D 로
  await f.evaluate(()=>window.__setTilt(true));await page.waitForTimeout(600);
  await f.evaluate(()=>{try{setView('session');}catch(_){}openEditor(null,'train');});await f.waitForFunction(()=>document.body.classList.contains('editing'));await page.waitForTimeout(800);
  s=await st();assert.equal(s.tilt,false,'다시 평면 '+JSON.stringify(s));assert.equal(s.ls,'1');
  await f.evaluate(()=>closeEditor(false));await f.waitForFunction(()=>!document.body.classList.contains('editing')&&document.body.classList.contains('bc-tilt3d'),null,{timeout:10000});
  await page.waitForTimeout(800);
  s=await st();assert.equal(s.tilt,true,'나가면 3D 로 '+JSON.stringify(s));assert.equal(s.ls,'1');assert.notEqual(s.pitch,'train','훈련 피치는 편집기 것');
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,passed:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}

// 3.302 — 사용자 11/16 «잔상을 가늘어지는 꼬리로 · 방향 표식(작은 삼각형) 더하기».
//  ① «시야» 단추: 끔 → 방향 표식(삼각형 · 부채꼴 없음) → 시야 부채꼴 → 끔. 표식은 이 장면부터 뒤 장면까지, 되돌리기 한 번에 사라진다.
//  ② 표식만 켠 선수도 회전 손잡이가 뜬다 · 내보내는 그림에 들어간다 · 밝은 피치에서는 짙은 색.
//  ③ 재생 중 잔상은 선수마다 채운 면 하나(.ps-trail) — 예전의 선 둘은 없다. 표식도 재생 중에 보인다.
// 고치기 전 코드는 ① 의 첫 검사에서 떨어진다(누르자마자 부채꼴).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const output=process.env.PS_TEST_OUTPUT||'test-results/board-motion-marks-3302';fs.mkdirSync(output,{recursive:true});
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const size of Object.values(SIZES))size.engine=engine;
let stage='boot',page;
try{
  const opened=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers,tilt3d:false});page=opened.page;
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(window._boardPrivateOwner)&&window.PSMotionMarks&&document.getElementById('animAdd'),null,{timeout:60000});
  await page.waitForFunction(()=>document.body&&!document.body.classList.contains('ps-booting')&&!document.querySelector('#loading:not(.ps-boot-done)'));
  const st=()=>f.evaluate(()=>({live:state.players.map(p=>[!!p.dirMark,!!p.vis]),scenes:anim.frames.map(fr=>fr.snap.players.map(p=>[!!p.dirMark,!!p.vis])),marks:document.querySelectorAll('#visionLayer .ps-dirmark').length,cones:document.querySelectorAll('#visionLayer path[fill^="url(#psVis"]').length,on:document.getElementById('visBtn').classList.contains('on'),toast:(document.getElementById('cs-ftoast')||{}).textContent||''}));
  const press=()=>f.evaluate(()=>{multiSel=state.players.slice(0,2);sel=null;updateDelUI();document.getElementById('visBtn').click();});

  // 장면 둘: 선수 셋(둘은 잔상 켬)이 오른쪽으로 움직인다 · 장면 1 을 편집 중
  stage='scenes';
  await f.evaluate(()=>{state.players=[{id:'a',team:'blue',num:8,x:260,y:260,trail:2},{id:'b',team:'blue',num:5,x:260,y:400,trail:2},{id:'c',team:'red',num:9,x:300,y:520}];state.equipment=[];state.drawings=[];anim.frames=[];animActive=-1;sel=null;multiSel=[];renderTokens();renderDrawings();renderAnimFrames();});
  await f.evaluate(()=>document.getElementById('animAdd').click());await page.waitForTimeout(400);
  await f.evaluate(()=>{state.players.forEach(p=>{p.x+=260;});renderTokens();autoSaveAnimFrame();updateMotionPaths();_activateMoveTool();selectAnimFrame(0);});
  await page.waitForTimeout(400);
  assert.equal(await f.evaluate(()=>animActive),0);

  // ① 끔 → 방향 표식
  stage='mark';
  await press();
  let s=await st();
  assert.deepEqual(s.live,[[true,false],[true,false],[false,false]],'first press: direction mark only');
  assert.equal(s.marks,2);assert.equal(s.cones,0,'no vision cone yet');assert.equal(s.on,true,'the button shows it is on');assert.match(s.toast,/방향 표식/);
  assert.deepEqual(s.scenes[1],[[true,false],[true,false],[false,false]],'carried to the scene after');
  // ② 회전 손잡이 · 내보내기 · 밝은 피치
  stage='handle-export';
  const one=await f.evaluate(()=>{multiSel=[];selectItem('player',state.players[0]);const h=!!document.querySelector('#rotHandle');state.players[0].dir=90;renderTokens();
    const d=document.querySelector('#visionLayer .ps-dirmark[data-for="a"]').getAttribute('d').replace(/[MLZ]/g,' ').trim().split(/\s+/).map(Number),p=state.players[0];
    return {handle:h,tipDx:Math.round(d[0]-p.x),tipDy:Math.round(d[1]-p.y),xml:boardImageXML().xml.includes('ps-dirmark'),fill:document.querySelector('#visionLayer .ps-dirmark').getAttribute('fill')};});
  assert.equal(one.handle,true,'a marked player gets the rotate handle');
  assert.equal(one.tipDx,0);assert.ok(one.tipDy>20,'the tip points where dir points (90° = down): '+JSON.stringify(one));
  assert.equal(one.xml,true,'exported pictures include the mark');assert.equal(one.fill,'#ffffff');
  const lightFill=await f.evaluate(()=>{const was=document.documentElement.dataset.pitch||'';window.__applyPitch('white',null);renderTokens();const v=document.querySelector('#visionLayer .ps-dirmark').getAttribute('fill');window.__applyPitch(was,null);renderTokens();return v;});
  assert.equal(lightFill,'#20242c','dark mark on a light pitch');
  // 되돌리기 한 번이면 표식이 사라진다 → 다시 켠다
  stage='undo';
  await f.evaluate(()=>{state.players[0].dir=0;renderTokens();autoSaveAnimFrame();});
  // ③ 재생 — 잔상은 채운 면 하나 · 표식도 따라간다
  stage='playback';
  await f.evaluate(()=>{multiSel=[];sel=null;renderTokens();updateDelUI();playAnim();});
  let seen=null;
  for(let i=0;i<60&&!seen;i++){const t=await f.evaluate(()=>({playing:animPlaying,tails:[...document.querySelectorAll('#trailLayer path')].map(p=>[p.getAttribute('class')||'',p.getAttribute('fill'),p.getAttribute('stroke')||'',/Z$/.test(p.getAttribute('d'))]),marks:document.querySelectorAll('#visionLayer .ps-dirmark').length}));if(t.playing&&t.tails.length>=2&&i>4)seen=t;else await page.waitForTimeout(60);}
  assert.ok(seen,'trails appeared while playing');
  assert.deepEqual(seen.tails,[['ps-trail','#ffffff','',true],['ps-trail','#ffffff','',true]],'one filled, closed tail per trailed player — no strokes: '+JSON.stringify(seen.tails));
  assert.equal(seen.marks,2,'marks stay during playback');
  await page.screenshot({path:output+'/playing.png'});
  await f.waitForFunction(()=>!animPlaying,null,{timeout:20000});await page.waitForTimeout(300);
  await f.evaluate(()=>{selectAnimFrame(0);});await page.waitForTimeout(300);
  // ① 방향 표식 → 시야 → 끔
  stage='cone';
  await press();s=await st();
  assert.deepEqual(s.live.slice(0,2).map(v=>v[1]),[true,true],'second press: vision cone');assert.equal(s.cones,2);assert.equal(s.marks,0,'the cone shows the direction — no extra mark');
  stage='off';
  await press();s=await st();
  assert.deepEqual(s.live,[[false,false],[false,false],[false,false]],'third press: everything off');
  assert.deepEqual(s.scenes[1],[[false,false],[false,false],[false,false]],'…in the scene after as well');
  assert.equal(s.marks,0);assert.equal(s.cones,0);assert.equal(s.on,false);
  stage='undo-mark';
  await press();s=await st();assert.equal(s.marks,2);
  await f.evaluate(()=>undoLast());s=await st();
  assert.deepEqual(s.live,[[false,false],[false,false],[false,false]],'one undo removes the mark');assert.equal(s.marks,0);
  console.log(JSON.stringify({passed:true,test:'board-motion-marks-3302',engine}));
}catch(e){
  console.error('[board-motion-marks-3302] failed at stage '+stage);console.error(e);process.exitCode=1;
  try{if(page)await page.screenshot({path:output+'/failure-'+stage+'.png'});}catch(_){}
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();process.exit(process.exitCode||0);}

// 3.335 — 작전판 애니메이션 «일시 정지»가 정말 그 자리에서 멈춘다(제보 a076fa6e «재생 중 일시정지했을 때 해당 화면에서 멈추었으면»).
// 예전: 재생 중 단추(이름표 «일시 정지»)를 누르면 stopAnim 이 불려 재생 전 화면으로 돌아갔다.
//  ① 재생 → ⏸ : 선수가 장면 사이 중간에 선 채 멈추고 · 시간이 지나도 그대로 · 장면 저장본은 그대로(중간 위치가 장면에 안 적힌다)
//  ② ▶ : 멈춘 곳부터 이어서(처음부터 다시가 아니다) · 끝나면 재생 전 화면
//  ③ ⏸ → ■ : 재생 전 화면으로
//  ④ ⏸ → 운동장 누름 : 재생 전 장면으로 돌아오고 그 누름(끌기)은 쓰지 않는다 · 장면 저장본 그대로
// 고치기 전 코드는 ① 의 «멈춘 자리» 검사에서 떨어진다(재생 전 자리 300 으로 돌아감).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const output=process.env.PS_TEST_OUTPUT||'test-results/board-anim-pause-3335';fs.mkdirSync(output,{recursive:true});
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const size of Object.values(SIZES))size.engine=engine;
const sizeName=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
let stage='boot',page;
try{
  const opened=await openApp(fx,sizeName,{browsers,tilt3d:false});page=opened.page;
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(window._boardPrivateOwner)&&document.getElementById('animAdd'),null,{timeout:60000});
  await page.waitForFunction(()=>document.body&&!document.body.classList.contains('ps-booting')&&!document.querySelector('#loading:not(.ps-boot-done)'));
  assert.equal(await f.evaluate(()=>!!window.__psAnimPause),true,'the pause module is installed');
  const at=(x,y)=>f.evaluate(({x,y})=>{const p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(world.getScreenCTM()),r=frameElement.getBoundingClientRect();return {x:r.left+q.x*r.width/innerWidth,y:r.top+q.y*r.height/innerHeight};},{x,y});
  const st=()=>f.evaluate(()=>({playing:!!animPlaying,held:window.__psAnimPause.held(),live:state.players.map(p=>[p.id,Math.round(p.x),Math.round(p.y)]),saved:anim.frames.map(fr=>fr.snap.players.map(p=>[p.id,Math.round(p.x),Math.round(p.y)])),
    label:document.getElementById('animPlay').getAttribute('aria-label'),stop:(()=>{const s=document.getElementById('animStop');if(!s)return 'none';const r=s.getBoundingClientRect();return getComputedStyle(s).display!=='none'&&r.width>0?'shown':'hidden';})()}));
  const tap=async sel=>{const box=await (await f.$(sel)).boundingBox();assert.ok(box&&box.width>0,sel+' is on screen');await page.mouse.click(box.x+box.width/2,box.y+box.height/2);};

  // 장면 둘: 선수 a 가 300 → 700(3초 이동) · 장면 1 을 보는 채로 재생
  stage='scenes';
  await f.evaluate(()=>{state.players=[{id:'a',team:'blue',num:8,x:300,y:300},{id:'b',team:'red',num:9,x:500,y:480}];state.equipment=[];state.drawings=[];anim.frames=[];animActive=-1;sel=null;multiSel=[];renderTokens();renderDrawings();renderAnimFrames();});
  await f.evaluate(()=>document.getElementById('animAdd').click());await page.waitForTimeout(400);
  await f.evaluate(()=>{state.players[0].x=700;renderTokens();autoSaveAnimFrame();anim.frames[0].dur=3;animHold=.1;selectAnimFrame(0);});
  await page.waitForTimeout(300);
  let s=await st();
  const SAVED=[[['a',300,300],['b',500,480]],[['a',700,300],['b',500,480]]];
  assert.deepEqual(s.saved,SAVED,'two scenes: '+JSON.stringify(s.saved));
  assert.deepEqual(s.live[0],['a',300,300],'scene 1 is on the board');
  assert.equal(s.stop,'hidden','no stop button while idle');

  // ① 재생 → ⏸
  stage='hold';
  await tap('#animPlay');
  await page.waitForTimeout(1100);
  s=await st();assert.equal(s.playing,true,'playing');assert.equal(s.label,'일시 정지');assert.equal(s.stop,'shown','stop shows while playing');
  await tap('#animPlay');
  s=await st();
  const heldX=s.live[0][1];
  assert.equal(s.held,true,'held: '+JSON.stringify(s));
  assert.ok(heldX>330&&heldX<670,'the player stops between the scenes, not back at 300: '+heldX);
  assert.equal(s.label,'이어서 재생','the button now resumes');assert.equal(s.stop,'shown');
  await page.screenshot({path:output+'/held-'+engine+'-'+sizeName+'.png'});
  await page.waitForTimeout(1300);
  s=await st();
  assert.equal(s.live[0][1],heldX,'nothing moves while held');
  assert.deepEqual(s.saved,SAVED,'the in-between pose is not written into a scene');

  // ② ▶ 이어서
  stage='resume';
  await tap('#animPlay');
  await page.waitForTimeout(400);
  s=await st();
  assert.equal(s.held,false);assert.equal(s.playing,true);
  assert.ok(s.live[0][1]>heldX,'continues from where it stopped: '+s.live[0][1]+' > '+heldX);
  await f.waitForFunction(()=>!animPlaying,null,{timeout:10000});
  s=await st();
  assert.deepEqual(s.live[0],['a',300,300],'after the end the board is back to the scene before playing');
  assert.deepEqual(s.saved,SAVED);assert.equal(s.stop,'hidden');assert.equal(s.label,'애니메이션 재생');

  // ③ ⏸ → ■
  stage='stop';
  await tap('#animPlay');await page.waitForTimeout(1000);await tap('#animPlay');
  s=await st();assert.equal(s.held,true);
  await tap('#animStop');
  s=await st();
  assert.equal(s.playing,false);assert.equal(s.held,false);
  assert.deepEqual(s.live[0],['a',300,300],'stop goes back to the scene before playing');
  assert.deepEqual(s.saved,SAVED);assert.equal(s.stop,'hidden');
  const strip=()=>page.evaluate(()=>{const e=document.getElementById('psSyncStrip');return e?e.textContent.replace(/\s+/g,' ').trim():'';});
  await page.waitForFunction(()=>{const e=document.getElementById('psSyncStrip');return !e||!/확인 중|저장 중/.test(e.textContent);},null,{timeout:10000}).catch(()=>{});
  assert.ok(!/확인 중|저장 중/.test(await strip()),'after stop the status strip settles: '+await strip());

  // ③-2 멈춘 채 화면이 가려지면(앱 바꾸기 · 닫기) 원래 길(boardFlushLive → restoreAnimBeforeCapture)이 재생 전 장면으로 돌리고 저장한다
  stage='hidden';
  await tap('#animPlay');await page.waitForTimeout(1000);await tap('#animPlay');
  assert.equal((await st()).held,true);
  await f.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));delete document.visibilityState;});
  s=await st();
  assert.equal(s.playing,false,'hiding the app ends the pause');assert.equal(s.held,false);
  assert.deepEqual(s.live[0],['a',300,300],'…on the scene before playing');assert.deepEqual(s.saved,SAVED);

  // ④ ⏸ → 운동장의 멈춘 선수를 끌어 본다
  stage='pitch';
  await tap('#animPlay');await page.waitForTimeout(1000);await tap('#animPlay');
  s=await st();assert.equal(s.held,true);
  const hx=s.live[0][1],from=await at(hx,300),to=await at(hx,420);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});await page.mouse.up();
  await page.waitForTimeout(400);
  s=await st();
  assert.equal(s.playing,false,'touching the pitch ends the pause');
  assert.deepEqual(s.live[0],['a',300,300],'…back at the scene before playing, and that touch did not drag anyone: '+JSON.stringify(s.live));
  assert.deepEqual(s.saved,SAVED,'scenes untouched');
  assert.match(await f.evaluate(()=>(document.getElementById('cs-ftoast')||{}).textContent||''),/재생 전 장면/,'a short note says why');

  // ⑤ 그다음 누름은 평소처럼 고친다
  stage='edit-after';
  const a0=await at(300,300),a1=await at(360,360);
  await page.mouse.move(a0.x,a0.y);await page.mouse.down();await page.mouse.move(a1.x,a1.y,{steps:5});await page.mouse.up();
  await page.waitForTimeout(400);
  s=await st();
  assert.ok(Math.hypot(s.live[0][1]-360,s.live[0][2]-360)<4,'after the pause ends, dragging edits as usual: '+JSON.stringify(s.live));
  await page.screenshot({path:output+'/done-'+engine+'-'+sizeName+'.png'});
  console.log(JSON.stringify({passed:true,test:'board-anim-pause-3335',engine,size:sizeName}));
}catch(e){
  console.error('[board-anim-pause-3335] failed at stage '+stage);console.error(e);process.exitCode=1;
  try{if(page)await page.screenshot({path:output+'/failure-'+stage+'.png'});}catch(_){}
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();process.exit(process.exitCode||0);}

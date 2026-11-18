// 3.302 — 사용자 11/16 «보관함에 만든거 작전판 수정을 했는데 적용이 안되는거 같아».
// 장면이 있는 판은 선수마다 «앞 장면 → 이 장면» 동선 한가운데에 곡선 손잡이(잡는 원 반지름 16)가 선다. 예전엔 그 층(#pathLayer)이 토큰 위라
// 장면 사이에 조금(1.4~3.2m)만 움직인 선수는 손잡이가 선수를 덮어, 끌면 선수 대신 곡선이 휘었다(선수 자리는 그대로).
//  ① 조금 움직인 선수: 가운데를 잡으면 토큰이 잡히고 끌면 그 장면의 자리가 바뀐다 · 곡선은 생기지 않는다
//  ② 많이 움직인 선수: 동선 가운데의 손잡이는 예전처럼 잡히고 끌면 곡선이 된다(선수 자리는 그대로)
// 고치기 전 코드는 ① 의 첫 검사에서 떨어진다(.mp-handle 이 잡힌다).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const output=process.env.PS_TEST_OUTPUT||'test-results/anim-token-over-handle-3302';fs.mkdirSync(output,{recursive:true});
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const size of Object.values(SIZES))size.engine=engine;
let stage='boot',page;
try{
  const opened=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers,tilt3d:false});page=opened.page;
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(window._boardPrivateOwner)&&document.getElementById('animAdd'),null,{timeout:60000});
  await page.waitForFunction(()=>document.body&&!document.body.classList.contains('ps-booting')&&!document.querySelector('#loading:not(.ps-boot-done)'));
  const at=(x,y)=>f.evaluate(({x,y})=>{const p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(world.getScreenCTM()),r=frameElement.getBoundingClientRect();return {x:r.left+q.x*r.width/innerWidth,y:r.top+q.y*r.height/innerHeight,fx:q.x,fy:q.y};},{x,y});
  const hit=async(x,y)=>{const p=await at(x,y);return f.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&e.closest?(e.closest('.mp-handle')?'handle':e.closest('.token')?'token:'+e.closest('.token').getAttribute('data-id'):e.tagName):'none';},[p.fx,p.fy]);};
  const drag=async(from,to)=>{const a=await at(...from),b=await at(...to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move((a.x+b.x)/2,(a.y+b.y)/2,{steps:4});await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up();await page.waitForTimeout(350);};
  const st=()=>f.evaluate(()=>({active:animActive,frames:anim.frames.length,live:state.players.map(p=>[p.id,Math.round(p.x),Math.round(p.y)]),saved:anim.frames.map(fr=>fr.snap.players.map(p=>[p.id,Math.round(p.x),Math.round(p.y)])),curves:anim.frames.map(fr=>Object.keys(fr.curves||{}).filter(k=>fr.curves[k]&&(Math.abs(fr.curves[k].mx)+Math.abs(fr.curves[k].my))>.5))}));

  // 장면 둘: 글자 id 선수 둘 — «near» 는 20 단위(2m), «far» 는 240 단위 움직인다(팩으로 만든 자료와 같은 모양)
  stage='scenes';
  await f.evaluate(()=>{state.players=[{id:'near',team:'blue',num:8,x:300,y:300},{id:'far',team:'red',num:9,x:300,y:480}];state.equipment=[];state.drawings=[];anim.frames=[];animActive=-1;sel=null;multiSel=[];renderTokens();renderDrawings();renderAnimFrames();});
  await f.evaluate(()=>document.getElementById('animAdd').click());await page.waitForTimeout(400);   // 첫 «장면 추가»는 장면 1 · 2 를 만든다(지금 판 = 장면 2)
  await f.evaluate(()=>{state.players[0].x=316;state.players[0].y=312;state.players[1].x=540;renderTokens();autoSaveAnimFrame();updateMotionPaths();_activateMoveTool();});
  await page.waitForTimeout(300);
  let s=await st();assert.equal(s.frames,2);assert.equal(s.active,1,'editing the last scene: '+JSON.stringify(s));
  assert.equal(await f.evaluate(()=>document.querySelectorAll('#pathLayer .mp-handle').length),2,'both paths have a curve handle');
  assert.equal(await f.evaluate(()=>{const p=document.getElementById('pathLayer'),t=document.getElementById('tokenLayer');return !!(p.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_FOLLOWING);}),true,'the path layer sits under the tokens');

  // ① 조금 움직인 선수 — 토큰이 잡힌다
  stage='near-token';
  assert.equal(await hit(316,312),'token:near','the token wins over the curve handle that covers it');
  await drag([316,312],[420,250]);
  s=await st();
  assert.ok(Math.hypot(s.live[0][1]-420,s.live[0][2]-250)<3,'the player follows the drag: '+JSON.stringify(s.live));
  assert.ok(Math.hypot(s.saved[1][0][1]-420,s.saved[1][0][2]-250)<3,'…and this scene keeps it: '+JSON.stringify(s.saved));
  assert.deepEqual(s.saved[0][0],['near',300,300],'the scene before is untouched');
  assert.deepEqual(s.curves,[[],[]],'no curve was bent by accident');

  // ② 많이 움직인 선수 — 동선 가운데의 손잡이는 그대로
  stage='far-handle';
  assert.equal(await hit(420,480),'handle','a long path still offers its handle');
  await drag([420,480],[420,420]);
  s=await st();
  assert.deepEqual(s.curves,[['far'],[]],'dragging the handle bends that path: '+JSON.stringify(s.curves));
  assert.deepEqual(s.live[1],['far',540,480],'…and leaves the player where he was');
  await page.screenshot({path:output+'/done.png'});
  console.log(JSON.stringify({passed:true,test:'anim-token-over-handle-3302',engine}));
}catch(e){
  console.error('[anim-token-over-handle-3302] failed at stage '+stage);console.error(e);process.exitCode=1;
  try{if(page)await page.screenshot({path:output+'/failure-'+stage+'.png'});}catch(_){}
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();process.exit(process.exitCode||0);}

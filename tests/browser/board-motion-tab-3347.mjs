// 3.347 — 사용자 11/21 «잔상 · 시선을 보드 설정에서 쉽게»(FmStadio 1.8 영상 → 목업 B안).
//  ① 보드 설정에 «움직임» 탭 — 공 · 판 위의 팀마다 잔상(끔 · 1~5) 줄, 팀마다 시선(끔 · 공 보기) 줄.
//  ② 잔상 칸을 누르면 그 묶음의 토큰 전부에(모든 장면까지) · 되돌리기 한 번 · 다른 팀은 그대로.
//  ③ «공 보기»는 방향 표식(삼각형)만 — 부채꼴 없음 · 공이 움직이면 따라 본다.
//  ④ 재생하면 묶음의 꼬리가 그려진다 · 다른 탭으로 가면 줄이 숨는다 · 창 폭 안에 든다.
// 고치기 전 코드는 ① 에서 떨어진다(탭이 없다).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const output=process.env.PS_TEST_OUTPUT||'test-results/board-motion-tab-3347';fs.mkdirSync(output,{recursive:true});
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const size of Object.values(SIZES))size.engine=engine;
let stage='boot',page;
try{
  const opened=await openApp(fx,process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop'),{browsers,tilt3d:false});page=opened.page;
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(window._boardPrivateOwner)&&window.PSMotionMarks&&document.getElementById('animAdd'),null,{timeout:60000});
  await page.waitForFunction(()=>document.body&&!document.body.classList.contains('ps-booting')&&!document.querySelector('#loading:not(.ps-boot-done)'));

  // 장면 둘: 팀 1 둘 · 팀 2 하나 · 공 — 모두 오른쪽으로 움직인다
  stage='scenes';
  await f.evaluate(()=>{state.players=[{id:'a',team:'blue',num:8,x:260,y:260},{id:'b',team:'blue',num:5,x:260,y:400},{id:'c',team:'red',num:9,x:300,y:520}];state.ball={id:'ball',team:'ball',x:300,y:330};state.equipment=[];state.drawings=[];anim.frames=[];animActive=-1;sel=null;multiSel=[];renderTokens();renderDrawings();renderAnimFrames();});
  await f.evaluate(()=>document.getElementById('animAdd').click());await page.waitForTimeout(400);
  await f.evaluate(()=>{state.players.forEach(p=>{p.x+=260;});state.ball.x+=300;state.ball.y+=120;renderTokens();autoSaveAnimFrame();updateMotionPaths();_activateMoveTool();selectAnimFrame(0);});
  await page.waitForTimeout(400);

  // ① 탭
  stage='tab';
  await f.waitForSelector('#cmd-board-settings-motion-tab',{state:'attached',timeout:30000});
  const openTab=async()=>{await f.evaluate(()=>{const t=document.getElementById('cmd-board-settings-motion-tab');if(!t.getClientRects().length)document.getElementById('bpBoardSettings').click();});
    await page.waitForTimeout(300);await f.click('#cmd-board-settings-motion-tab');await page.waitForTimeout(200);};
  await openTab();
  const ui=()=>f.evaluate(()=>{const p=document.getElementById('cmd-board-settings-pop'),vis=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
    const rows=[...p.querySelectorAll('#viewMenu > .menurow[data-bs-tab="motion"]')].filter(vis).map(r=>{const s=r.querySelector('.seg'),on=s.querySelector('button.on');return [s.getAttribute('data-mt'),s.getAttribute('data-mt-key'),r.querySelector('.menulbl').textContent,on?on.getAttribute('data-v'):null,s.children.length];});
    const pr=p.getBoundingClientRect(),over=[...p.querySelectorAll('#viewMenu > [data-bs-tab="motion"] button')].filter(vis).filter(b=>{const r=b.getBoundingClientRect();return r.right>pr.right+0.5||r.left<pr.left-0.5||r.height<32||b.scrollWidth>b.clientWidth+1;}).length;
    const lines=new Set([...p.querySelectorAll('#viewMenu .seg.ps-mt-six')].filter(vis).flatMap(s=>[...new Set([...s.children].map(b=>Math.round(b.getBoundingClientRect().top)))].length));
    return {tab:p.getAttribute('data-bs-tab'),on:[...p.querySelectorAll('.cmd-board-settings-tabs > button.on')].map(b=>b.textContent),scope:p.querySelector('.cmd-board-settings-scope').textContent,rows,over,lines:[...lines],
      tabWrap:[...p.querySelectorAll('.cmd-board-settings-tabs > button')].filter(b=>b.getBoundingClientRect().height>40||b.scrollWidth>b.clientWidth+1).map(b=>b.textContent),others:[...p.querySelectorAll('#viewMenu > .menurow:not([data-bs-tab="motion"])')].filter(vis).length,tabs:[...p.querySelectorAll('.cmd-board-settings-tabs > button')].map(b=>b.textContent)};});
  let u=await ui();
  assert.deepEqual(u.tabs,['운동장','선수 표시','배치','움직임','내 화면'],'the tab sits before «내 화면»');
  assert.deepEqual(u.tabWrap,[],'five tab names stay on one line');
  assert.equal(u.tab,'motion');assert.deepEqual(u.on,['움직임']);assert.equal(u.scope,'바로 적용');
  assert.deepEqual(u.rows,[['trail','ball','공','0',6],['trail','blue','팀 1','0',6],['trail','red','팀 2','0',6],['look','blue','팀 1','off',2],['look','red','팀 2','off',2]],JSON.stringify(u.rows));
  assert.equal(u.others,0,'rows of other tabs are hidden');assert.equal(u.over,0,'every button sits inside the panel, at least 32px tall, label unclipped');
  assert.deepEqual(u.lines,[1],'six cells stay on one line');
  await page.screenshot({path:output+'/tab.png'});

  // ② 잔상
  stage='trail';
  const tok=()=>f.evaluate(()=>({live:state.players.map(p=>[p.trail||0,p.lookAt||'',!!p.dirMark,!!p.vis]),ball:state.ball.trail||0,scene1:anim.frames[1].snap.players.map(p=>[p.trail||0,p.lookAt||'',!!p.dirMark]),ball1:anim.frames[1].snap.ball.trail||0,toast:(document.getElementById('cs-ftoast')||{}).textContent||''}));
  const cell=(kind,key,v)=>f.click(`#viewMenu .seg[data-mt="${kind}"][data-mt-key="${key}"] > button[data-v="${v}"]`);
  await cell('trail','blue','2');await cell('trail','ball','5');await page.waitForTimeout(200);
  let t=await tok();
  assert.deepEqual(t.live.map(v=>v[0]),[2,2,0],'both players of team 1, not team 2');assert.equal(t.ball,5);
  assert.deepEqual(t.scene1.map(v=>v[0]),[2,2,0],'…in the next scene too');assert.equal(t.ball1,5);
  assert.match(t.toast,/잔상 5단계 · 공/);
  u=await ui();assert.deepEqual(u.rows.slice(0,3).map(r=>r[3]),['5','2','0']);
  await f.evaluate(()=>undoLast());await page.waitForTimeout(200);
  t=await tok();assert.equal(t.ball,0,'one undo takes back one press');assert.deepEqual(t.live.map(v=>v[0]),[2,2,0]);
  u=await ui();assert.equal(u.rows[0][3],'0','the panel follows the undo');
  await cell('trail','ball','5');
  // 한 토큰만 다르게 해 두면 그 줄은 고른 칸 없이
  await f.evaluate(()=>{state.players[0].trail=4;updateDelUI();});
  u=await ui();assert.equal(u.rows[1][3],null,'mixed values show no selected cell');
  await cell('trail','blue','2');t=await tok();assert.deepEqual(t.live.map(v=>v[0]),[2,2,0]);

  // ③ 공 보기
  stage='look';
  await cell('look','blue','ball');await page.waitForTimeout(200);
  t=await tok();
  assert.deepEqual(t.live.map(v=>v.slice(1)),[['ball',true,false],['ball',true,false],['',false,false]],'look at the ball with a direction mark — no cone');
  assert.deepEqual(t.scene1.map(v=>v.slice(1)),[['ball',true],['ball',true],['',false]]);
  const aim=()=>f.evaluate(()=>{const p=state.players[0],b=state.ball,d=document.querySelector('#visionLayer .ps-dirmark[data-for="a"]').getAttribute('d').replace(/[MLZ]/g,' ').trim().split(/\s+/).map(Number);
    const want=Math.atan2(b.y-p.y,b.x-p.x),got=Math.atan2(d[1]-p.y,d[0]-p.x);let diff=Math.abs(want-got);if(diff>Math.PI)diff=2*Math.PI-diff;
    return {marks:document.querySelectorAll('#visionLayer .ps-dirmark').length,cones:document.querySelectorAll('#visionLayer path[fill^="url(#psVis"]').length,diff};});
  let a=await aim();assert.equal(a.marks,2);assert.equal(a.cones,0);assert.ok(a.diff<0.05,'the tip points at the ball: '+JSON.stringify(a));
  await f.evaluate(()=>{state.ball.y+=260;renderTokens();});
  a=await aim();assert.ok(a.diff<0.05,'…and follows it when the ball moves: '+JSON.stringify(a));
  await f.evaluate(()=>{state.ball.y-=260;renderTokens();});
  u=await ui();assert.deepEqual(u.rows.slice(3).map(r=>r[3]),['ball','off']);
  await page.screenshot({path:output+'/on.png'});

  // ④ 재생 — 묶음의 꼬리 · 표식
  stage='playback';
  await f.evaluate(()=>{window.__tails=0;const L=window.__trailLayer;window.__trailObs=new MutationObserver(()=>{window.__tails=Math.max(window.__tails,L.querySelectorAll('path.ps-trail').length);});window.__trailObs.observe(L,{childList:true});document.getElementById('animPlay').click();});
  await f.waitForFunction(()=>animPlaying&&window.__tails>=3,null,{timeout:20000});
  await page.screenshot({path:output+'/playing.png'});
  await f.waitForFunction(()=>!animPlaying,null,{timeout:20000});await page.waitForTimeout(300);
  assert.equal(await f.evaluate(()=>{window.__trailObs.disconnect();return window.__tails;}),3,'two players of team 1 and the ball leave tails — team 2 does not');
  await f.evaluate(()=>selectAnimFrame(0));await page.waitForTimeout(300);

  // 끄기 · 다른 탭
  stage='off';
  await openTab();   // 재생하면 창이 닫힌다
  await cell('look','blue','off');await cell('trail','blue','0');await cell('trail','ball','0');await page.waitForTimeout(200);
  t=await tok();
  assert.deepEqual(t.live,[[0,'',false,false],[0,'',false,false],[0,'',false,false]]);assert.equal(t.ball,0);
  assert.deepEqual(t.scene1,[[0,'',false],[0,'',false],[0,'',false]]);
  assert.equal(await f.evaluate(()=>document.querySelectorAll('#visionLayer .ps-dirmark').length),0);
  await f.click('#cmd-board-settings-look-tab');await page.waitForTimeout(200);
  const away=await f.evaluate(()=>{const p=document.getElementById('cmd-board-settings-pop'),vis=e=>e.getClientRects().length>0;return {tab:p.getAttribute('data-bs-tab'),mine:[...p.querySelectorAll('#viewMenu > [data-bs-tab="motion"]')].filter(vis).length,on:[...p.querySelectorAll('.cmd-board-settings-tabs > button.on')].map(b=>b.textContent)};});
  assert.deepEqual(away,{tab:'look',mine:0,on:['선수 표시']});
  // 팀이 늘면 줄도 는다
  stage='teams';
  await f.evaluate(()=>{state.players.push({id:'d',team:'yellow',num:3,x:400,y:200});renderTokens();updateDelUI();});
  await openTab();
  u=await ui();assert.deepEqual(u.rows.map(r=>r[2]),['공','팀 1','팀 2','팀 3','팀 1','팀 2','팀 3']);assert.equal(u.over,0);
  console.log(JSON.stringify({passed:true,test:'board-motion-tab-3347',engine,size:process.env.PS_SIZE||''}));
}catch(e){
  console.error('[board-motion-tab-3347] failed at stage '+stage);console.error(e);process.exitCode=1;
  try{if(page)await page.screenshot({path:output+'/failure-'+stage+'.png'});}catch(_){}
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();process.exit(process.exitCode||0);}

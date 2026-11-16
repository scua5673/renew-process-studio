// 3.302 — 사용자 11/16 «훈련만들기로 들어가면 자동으로 훈련격자로 해서 정렬 잘 할 수 있게끔».
// 훈련 편집기는 훈련 피치(모눈)로 열리지만 «끌기 자석»이 기본 꺼짐이라 놓고 끌어도 줄이 안 맞았다.
// 이제 편집기에 격자가 있으면 선수 · 장비를 놓거나 끌 때 교차점에 붙는 것이 기본이다(기기 키 ps_edit_snap_v1 — 작전판의 cs_drag_snap_v1 과 따로).
//  ① 열자마자 켜짐(보드 설정 줄 · 안내) ② 놓기 · 끌기가 교차점 ③ ⌘/Ctrl 은 이번만 자유 ④ 선 끝은 예전처럼 선수에 묶인다(격자에 안 붙음)
//  ⑤ 편집기에서 끄면 자유(작전판 키는 그대로) · ⌘/Ctrl 은 다시 «붙기» ⑥ 나가면 작전판은 훈련 피치여도 예전 그대로.
// 고치기 전 코드는 ① 에서 떨어진다(_dragSnapOn 거짓).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
const output=process.env.PS_TEST_OUTPUT||'test-results/training-grid-snap-3302';fs.mkdirSync(output,{recursive:true});
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const size of Object.values(SIZES))size.engine=engine;
let stage='boot',page;
try{
  const opened=await openApp(fx,'desktop',{browsers,tilt3d:false});page=opened.page;
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(window._boardPrivateOwner)&&window.PSBoardEdit,null,{timeout:60000});
  await page.waitForFunction(()=>document.body&&!document.body.classList.contains('ps-booting')&&!document.querySelector('#loading:not(.ps-boot-done)'));
  const at=(x,y)=>f.evaluate(({x,y})=>{const p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(world.getScreenCTM()),r=frameElement.getBoundingClientRect();return {x:r.left+q.x*r.width/innerWidth,y:r.top+q.y*r.height/innerHeight};},{x,y});
  const drag=async(from,to,mod)=>{const a=await at(...from),b=await at(...to);if(mod)await page.keyboard.down(mod);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move((a.x+b.x)/2,(a.y+b.y)/2,{steps:4});await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up();if(mod)await page.keyboard.up(mod);await page.waitForTimeout(120);};
  const keys=()=>f.evaluate(()=>({edit:localStorage.getItem('ps_edit_snap_v1'),board:localStorage.getItem('cs_drag_snap_v1')}));
  const ui=()=>f.evaluate(()=>({on:_dragSnapOn(),seg:[...document.querySelectorAll('#dragSnapSeg button')].filter(b=>b.classList.contains('on')).map(b=>b.dataset.ds),hint:(document.getElementById('bsSnapHint')||{}).textContent||''}));
  const onGrid=p=>f.evaluate(p=>{const g=window.__trainGridSpec,kx=(p.x-g.x0)/g.sx,ky=(p.y-g.y0)/g.sy;return Math.abs(kx-Math.round(kx))<1e-6&&Math.abs(ky-Math.round(ky))<1e-6;},p);
  const cone=()=>f.evaluate(()=>{const c=state.equipment[state.equipment.length-1];return c?{id:c.id,x:c.x,y:c.y}:null;});
  // 맥 계열(_PTR_MAC — 웹킷 CI 의 아이패드 UA 도)에서 Ctrl+누름은 오른쪽 클릭(토큰 정보 창, board.html 2.975)이라 끌기가 시작되지 않는다 — 그 기기의 «이번만» 키는 ⌘
  const MOD=process.env.PS_TEST_MOD||(await f.evaluate(()=>typeof _PTR_MAC!=='undefined'&&!!_PTR_MAC)?'Meta':'Control');

  // ── 0. 작전판(편집기 밖): 자석은 기본 꺼짐 그대로 ──
  stage='board-default';
  assert.deepEqual(await keys(),{edit:null,board:null});
  let u=await ui();assert.equal(u.on,false);assert.deepEqual(u.seg,['0']);
  const baseHint=u.hint;

  // ── 1. 훈련 만들기: 훈련 피치 + 붙기가 기본 ──
  stage='open-default';
  await f.evaluate(()=>{window.__psNoDraft=true;openEditor(null);});
  await f.waitForFunction(()=>document.body.classList.contains('editing')&&document.documentElement.dataset.pitch==='train'&&!!window.__trainGridSpec&&document.querySelectorAll('#trainGrid line').length>10);
  await page.waitForTimeout(900);
  u=await ui();assert.equal(u.on,true,'the editor grid snaps by default');assert.deepEqual(u.seg,['1'],'board settings row shows the editor value');
  assert.match(u.hint,/훈련 편집기는 격자 칸에 붙는 것이 기본/);
  assert.deepEqual(await keys(),{edit:null,board:null},'opening writes nothing');
  await f.evaluate(()=>{state.players=[];state.equipment=[];state.drawings=[];sel=null;multiSel=[];renderTokens();renderDrawings();updateDelUI();});

  // ── 2. 놓기 · 끌기 → 교차점 ──
  stage='drop';
  await f.evaluate(()=>dropToken('equip','cone',{x:333,y:287}));
  let c=await cone();assert.deepEqual({x:c.x,y:c.y},{x:324,y:290},'a dropped cone lands on the nearest intersection');
  stage='drag';
  await drag([324,290],[463,342]);
  c=await cone();assert.equal(await onGrid(c),true,'a dragged cone stays on the grid: '+JSON.stringify(c));
  assert.ok(Math.abs(c.x-463)<=11&&Math.abs(c.y-342)<=10.5,'…at the intersection nearest the pointer: '+JSON.stringify(c));
  await f.waitForFunction(()=>/훈련 격자 칸에 맞춰 놓여요/.test((document.getElementById('cs-ftoast')||{}).textContent||''),null,{timeout:5000});
  assert.deepEqual(await keys(),{edit:'1',board:null},'told once — remembered on this device');
  fs.mkdirSync(output,{recursive:true});await page.screenshot({path:output+'/snapped.png'});

  // ── 3. ⌘/Ctrl 은 이번만 자유롭게 ──
  stage='mod-free';
  await drag([c.x,c.y],[502,379],MOD);
  let free=await cone();assert.ok(Math.hypot(free.x-502,free.y-379)<2.5,'a modifier drag ('+MOD+') follows the pointer: '+JSON.stringify(free));assert.equal(await onGrid(free),false);
  await drag([free.x,free.y],[610,415]);
  c=await cone();assert.equal(await onGrid(c),true,'the next plain drag snaps again');

  // ── 4. 선 끝은 예전처럼: 격자에 안 붙고 선수 · 장비에 묶인다 ──
  stage='line-free';
  assert.deepEqual(await f.evaluate(()=>[PSBoardEdit.pointGridActive({}),PSBoardEdit.pointGridActive({ctrlKey:true})]),[false,true]);
  await f.evaluate(()=>{sel=null;multiSel=[];state.tool='line';document.body.dataset.tool='line';document.body.classList.add('drawmode');renderTokens();renderDrawings();updateDelUI();});
  await drag([220,437],[c.x-6,c.y+5]);
  const line=await f.evaluate(()=>{const d=state.drawings[state.drawings.length-1];return d?{pts:d.pts.map(p=>({x:p.x,y:p.y})),tk:d.tk||null}:null;});
  assert.ok(line,'a line was drawn');assert.ok(Math.hypot(line.pts[0].x-220,line.pts[0].y-437)<2.5,'the free end stays where it was drawn: '+JSON.stringify(line));
  assert.equal(line.tk&&line.tk[1],c.id,'the end on the cone is tied to it: '+JSON.stringify(line));
  await f.evaluate(()=>{_activateMoveTool();state.drawings=[];sel=null;multiSel=[];renderTokens();renderDrawings();updateDelUI();});

  // ── 5. 편집기에서 끄기: 자유 · 작전판 키는 그대로 · ⌘/Ctrl 은 다시 «붙기» ──
  stage='turn-off';
  // 알림은 누른 그 자리에서 읽는다(뒤늦게 뜨는 다른 알림이 덮기 전에)
  const press=ds=>f.evaluate(ds=>{document.querySelector('#dragSnapSeg [data-ds="'+ds+'"]').click();return (document.getElementById('cs-ftoast')||{}).textContent||'';},ds);
  assert.match(await press('0'),/훈련 편집기 자석 끔/);
  assert.deepEqual(await keys(),{edit:'0',board:null},'only the editor value changes');
  u=await ui();assert.equal(u.on,false);assert.deepEqual(u.seg,['0']);
  await drag([c.x,c.y],[502,379]);
  free=await cone();assert.ok(Math.hypot(free.x-502,free.y-379)<2.5,'off: plain drag is free: '+JSON.stringify(free));
  await f.evaluate(()=>dropToken('equip','cone',{x:333,y:287}));
  let raw=await cone();assert.deepEqual({x:raw.x,y:raw.y},{x:333,y:287},'off: dropped where it was dropped');
  await drag([333,287],[463,342],MOD);
  raw=await cone();assert.equal(await onGrid(raw),true,'off: the modifier ('+MOD+') still snaps: '+JSON.stringify(raw));
  // 작전판 자석까지 켠 기기는 선 끝도 예전처럼 격자에(편집기에서 켠 때만)
  assert.deepEqual(await f.evaluate(()=>{localStorage.setItem('cs_drag_snap_v1','1');const off=PSBoardEdit.pointGridActive({});localStorage.setItem('ps_edit_snap_v1','1');const on=PSBoardEdit.pointGridActive({});localStorage.removeItem('cs_drag_snap_v1');localStorage.setItem('ps_edit_snap_v1','0');return [off,on];}),[false,true]);
  stage='turn-on';
  assert.match(await press('1'),/훈련 편집기 자석 켬/);
  assert.deepEqual(await keys(),{edit:'1',board:null});u=await ui();assert.equal(u.on,true);assert.deepEqual(u.seg,['1']);

  // ── 6. 나가면 작전판은 예전 그대로(훈련 피치여도 자유) ──
  stage='board-unchanged';
  await f.evaluate(()=>closeEditor(false));
  await f.waitForFunction(()=>!document.body.classList.contains('editing'));
  // 새 훈련을 닫으면 보관함으로 간다 — 작전판으로 돌아와 잰다
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  await f.waitForFunction(()=>window.__csView==='board'&&(()=>{const r=document.getElementById('boardStage').getBoundingClientRect();return r.width>200&&r.height>200;})());await page.waitForTimeout(600);
  u=await ui();assert.equal(u.on,false);assert.deepEqual(u.seg,['0']);assert.equal(u.hint,baseHint,'the hint is the board one again');
  await f.evaluate(()=>{window.__applyPitch('train',null);state.players=[];state.equipment=[];state.drawings=[];sel=null;multiSel=[];renderTokens();renderDrawings();updateDelUI();});
  await f.waitForFunction(()=>document.documentElement.dataset.pitch==='train'&&!!window.__trainGridSpec);
  await f.evaluate(()=>dropToken('equip','cone',{x:333,y:287}));
  raw=await cone();assert.deepEqual({x:raw.x,y:raw.y},{x:333,y:287},'board: dropped where it was dropped');
  await drag([333,287],[502,379]);
  raw=await cone();assert.ok(Math.hypot(raw.x-502,raw.y-379)<2.5,'board: plain drag is free even on the training pitch: '+JSON.stringify(raw));
  assert.deepEqual(await keys(),{edit:'1',board:null});
  console.log(JSON.stringify({passed:true,test:'training-grid-snap-3302',engine}));
}catch(e){
  console.error('[training-grid-snap-3302] failed at stage '+stage);console.error(e);process.exitCode=1;
  try{if(page)await page.screenshot({path:output+'/failure-'+stage+'.png'});}catch(_){}
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();process.exit(process.exitCode||0);}

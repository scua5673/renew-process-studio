import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 2.982 — 운동장 방향(가로·세로·90° 회전)은 애니메이션의 모든 장면에 함께 걸린다.
// 장면을 전부 고른 채 보드 설정에서 «세로»를 눌러도 고른 표시가 남고, 모든 장면이 세로가 된다.
// 합성 팀 fixture 에서만 돈다(실계정·서버 없음).
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.waitForTimeout(2500);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&typeof anim==='object'&&typeof window.__setBoardOrient==='function'&&document.getElementById('animAdd'));
  await page.waitForTimeout(1500);

  // 가로 판에 장면 셋 — 선수 둘·콘·공·패스 선, 장면마다 오른쪽으로 옮긴다. 첫 장면에 곡선 동선 하나.
  step('scenes');
  await f.evaluate(()=>{ try{ if(window.__animReset)window.__animReset(); }catch(_){}
    window.__tl=[];const t0=window.toast;window.toast=function(m){window.__tl.push(String(m));return t0.apply(this,arguments);};
    autoOrient=false;state.orientation='h';state.spFlip=false;state.halfSide='L';sel=null;multiSel=[];
    state.drawings=[{type:'pass',color:'#fff',pts:[{x:300,y:300},{x:420,y:360}]}];state.equipment=[{id:9101,team:'cone',x:520,y:380}];
    state.players=[{id:9001,team:'blue',num:7,x:300,y:300,dir:0},{id:9002,team:'red',num:4,x:400,y:500}];state.ball={x:330,y:320};
    applyView();renderTokens();renderDrawings();document.getElementById('animAdd').click(); });
  await page.waitForTimeout(300);
  await f.evaluate(()=>{ state.players[0].x+=150;state.players[1].x+=150;state.ball.x+=180;renderTokens();autoSaveAnimFrame();document.getElementById('animAdd').click(); });
  await page.waitForTimeout(300);
  await f.evaluate(()=>{ state.players[0].x+=100;state.ball.y+=150;renderTokens();autoSaveAnimFrame();anim.frames[0].curves={9001:{mx:20,my:-30}}; });
  await page.waitForTimeout(200);
  const snapOf=()=>f.evaluate(()=>({n:anim.frames.length,active:animActive,board:state.orientation+(state.spFlip?'F':'')+(state.halfSide||'L'),
    dirs:anim.frames.map(x=>(x.snap.orientation||'h')+(x.snap.spFlip?'F':'')+(x.snap.halfSide||'L')),
    xs:anim.frames.map(x=>Math.round(x.snap.players[0].x)),ys:anim.frames.map(x=>Math.round(x.snap.players[0].y)),
    ball:anim.frames.map(x=>Math.round(x.snap.ball.x)),line:anim.frames.map(x=>Math.round(x.snap.drawings[0].pts[0].x)),
    curve:anim.frames[0].curves&&anim.frames[0].curves[9001]?[anim.frames[0].curves[9001].mx,anim.frames[0].curves[9001].my]:null,
    sel:_afSel.size,selMarks:document.querySelectorAll('#animFrames .anim-frame.sel').length,playing:animPlaying,W:W,H:H,toasts:window.__tl.slice()}));
  const base=await snapOf();
  assert.equal(base.n,3);assert.deepEqual(base.dirs,['hL','hL','hL']);assert.deepEqual(base.xs,[300,450,550]);

  // 장면을 전부 고른다(장면 줄을 누르고 Ctrl/⌘+A) → 셸의 «보드 설정» → 운동장 탭 → «세로»
  step('select-all + settings');
  await f.locator('#animFrames .anim-frame').first().click();
  await page.keyboard.press('Control+a');
  assert.equal((await snapOf()).sel,3,'all three scenes are selected');
  const shellBtn=await page.$('#psBoardMoreBtn');
  if(shellBtn&&await shellBtn.isVisible())await shellBtn.click(); else await f.evaluate(()=>window.__psToggleBoardSettings('toggle'));
  await f.waitForSelector('#cmd-board-settings-pop',{state:'visible'});
  await f.locator('#cmd-board-settings-pitch-tab').click();
  await f.waitForSelector('#cmdOrientSeg',{state:'visible'});
  const row=await f.evaluate(()=>{const r=document.querySelector('#cmd-board-settings-rot'),pop=document.getElementById('cmd-board-settings-pop'),pr=pop.getBoundingClientRect();
    const bs=[...r.querySelectorAll('button')].map(b=>{const q=b.getBoundingClientRect();return {t:b.textContent.trim(),on:b.classList.contains('on'),w:Math.round(q.width),h:Math.round(q.height),inside:q.left>=pr.left-1&&q.right<=pr.right+1&&q.width>0,clip:b.scrollWidth>b.clientWidth+1};});
    return {label:r.querySelector('.menulbl').textContent.trim(),tab:r.getAttribute('data-bs-tab'),bs,overflow:pop.scrollWidth>pop.clientWidth+1,h:Math.round(r.getBoundingClientRect().height)};});
  assert.equal(row.label,'운동장 방향');assert.equal(row.tab,'pitch');
  assert.deepEqual(row.bs.map(b=>b.t),['가로','세로','90° 회전 ↻']);assert.deepEqual(row.bs.map(b=>b.on),[true,false,false],'the open board is horizontal');
  assert.ok(row.bs.every(b=>b.inside&&!b.clip),'the three buttons fit in the panel: '+JSON.stringify(row));assert.equal(row.overflow,false);
  if(process.env.PS_TEST_OUTPUT)await page.screenshot({path:path.join(process.env.PS_TEST_OUTPUT,'orient-row.png')});
  assert.equal((await snapOf()).sel,3,'switching tabs inside the settings panel keeps the scene selection');

  step('vertical');
  await f.locator('#cmdOrientSeg button[data-o="v"]').click();
  await page.waitForTimeout(250);
  const v=await snapOf();
  assert.equal(v.board,'vL');assert.deepEqual(v.dirs,['vL','vL','vL'],'every scene is vertical');
  assert.deepEqual(v.xs,base.xs,'vertical is a view: positions stay');assert.deepEqual(v.curve,[20,-30]);
  assert.equal(v.sel,3,'the selection is still there');assert.equal(v.selMarks,3);
  assert.deepEqual(v.toasts.slice(-1),['장면 3개를 모두 세로로 맞췄어요']);
  assert.deepEqual(await f.evaluate(()=>[...document.querySelectorAll('#cmdOrientSeg button')].map(b=>b.classList.contains('on'))),[false,true]);
  // 다른 장면을 눌러도 세로 그대로
  const walk=await f.evaluate(()=>{const o=[];for(let i=0;i<anim.frames.length;i++){selectAnimFrame(i,false);o.push(state.orientation);}selectAnimFrame(1,false);return o;});
  assert.deepEqual(walk,['v','v','v'],'switching scenes no longer falls back to horizontal');

  // 90° 회전: 270°(세로) → 0° → 90° → 180°. 180° 는 좌표를 뒤집는다 — 모든 장면이 함께 뒤집혀야 재생이 이어진다
  step('rotate');
  const rot=f.locator('#cmd-board-settings-rot .seg >> nth=1 >> button');
  await rot.click();await page.waitForTimeout(150);
  assert.deepEqual((await snapOf()).dirs,['hL','hL','hL']);
  await rot.click();await page.waitForTimeout(150);
  const r90=await snapOf();assert.deepEqual(r90.dirs,['vFL','vFL','vFL']);assert.deepEqual(r90.xs,base.xs);
  await rot.click();await page.waitForTimeout(250);
  const r180=await snapOf();
  assert.equal(r180.board,'hR');assert.deepEqual(r180.dirs,['hR','hR','hR']);
  assert.deepEqual(r180.xs,base.xs.map(x=>r180.W-x),'players are turned in every scene');
  assert.deepEqual(r180.ball,base.ball.map(x=>r180.W-x));assert.deepEqual(r180.line,base.line.map(x=>r180.W-x));
  assert.deepEqual(r180.curve,[-20,30],'the curved path turns with it');
  assert.deepEqual(r180.toasts.slice(-1),['장면 3개를 모두 함께 돌렸어요']);
  assert.match(await rot.textContent(),/180°/);

  // ⌘Z 한 번 = 모든 장면이 한 걸음 되돌아간다
  step('undo');
  await f.evaluate(()=>undoLast());await page.waitForTimeout(200);
  const un=await snapOf();
  assert.deepEqual(un.dirs,['vFL','vFL','vFL']);assert.deepEqual(un.xs,base.xs);assert.deepEqual(un.curve,[20,-30]);assert.equal(un.board,'vFL');

  // 예전 판이 남긴 어긋난 애니메이션: 한 장면만 가로 → 지금 방향 버튼을 누르면 따라온다
  step('heal');
  await f.evaluate(()=>{anim.frames[2].snap=Object.assign({},anim.frames[2].snap,{orientation:'h',spFlip:false,halfSide:'L'});});
  await f.evaluate(()=>window.__psToggleBoardSettings&&document.getElementById('cmd-board-settings-pop')&&getComputedStyle(document.getElementById('cmd-board-settings-pop')).display==='none'&&window.__psToggleBoardSettings('toggle'));
  await f.locator('#cmd-board-settings-pitch-tab').click();
  await f.locator('#cmdOrientSeg button[data-o="v"]').click();await page.waitForTimeout(200);
  const heal=await snapOf();
  assert.deepEqual(heal.dirs,['vFL','vFL','vFL'],'the scene that was left behind follows the board');

  // 재생 중에 돌리면 멈추고 돌린다
  step('playing');
  await f.evaluate(()=>{selectAnimFrame(0,false);playAnim();});await page.waitForTimeout(300);
  assert.equal((await snapOf()).playing,true);
  await f.evaluate(()=>{window.__setBoardOrient('h');});await page.waitForTimeout(200);
  const pl=await snapOf();
  assert.equal(pl.playing,false);assert.deepEqual(pl.dirs,['hL','hL','hL']);assert.equal(pl.board,'hL');assert.deepEqual(pl.xs,base.xs);
  // 저장본(라이브 직렬화)에도 같은 방향으로 실린다
  const saved=await f.evaluate(()=>(window.__animFrames()||[]).map(x=>x.snap.orientation));
  assert.deepEqual(saved,['h','h','h']);

  // 훈련 편집기 안의 애니메이션도 같은 규칙 · 편집기를 닫으면 작업 보드의 장면은 그대로 돌아온다
  step('editor');
  await f.evaluate(()=>{try{window.__psToggleBoardSettings('force-close');}catch(_){}try{setView('session');}catch(_){}openEditor(null,'train');});
  await f.waitForFunction(()=>document.body.classList.contains('editing'));await page.waitForTimeout(500);
  await f.evaluate(()=>{anim.frames=[];animActive=-1;renderAnimFrames();autoOrient=false;state.orientation='h';state.spFlip=false;state.halfSide='L';
    state.players=[{id:9201,team:'blue',num:5,x:300,y:300}];applyView();renderTokens();document.getElementById('animAdd').click();});
  await page.waitForTimeout(250);
  await f.evaluate(()=>{state.players[0].x+=200;renderTokens();autoSaveAnimFrame();});
  const ed=await f.evaluate(()=>{const r={n:anim.frames.length,bound:_rotBound()};const out=window.__setBoardOrient('v');
    r.out=out&&{n:out.n,total:out.total};r.dirs=anim.frames.map(x=>x.snap.orientation);r.board=state.orientation;return r;});
  assert.equal(ed.bound,true,'the editor board is tied to its scene strip');assert.equal(ed.board,'v');
  assert.deepEqual(ed.dirs,Array(ed.n).fill('v'),'every scene of the training turns');assert.deepEqual(ed.out,{n:ed.n-1,total:ed.n});
  await f.evaluate(()=>{try{closeEditor(false);}catch(_){}});await page.waitForTimeout(500);
  await page.evaluate(()=>{const b=document.querySelector('#appSeg [data-app="board"]:not([data-train])');if(b)b.click();});await page.waitForTimeout(800);
  const wb=await f.evaluate(()=>({dirs:anim.frames.map(x=>x.snap.orientation),xs:anim.frames.map(x=>Math.round(x.snap.players[0].x)),board:state.orientation}));
  assert.deepEqual(wb.dirs,['h','h','h'],'the work board’s scenes are untouched by what happened in the editor');assert.deepEqual(wb.xs,base.xs);assert.equal(wb.board,'h');

  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log(JSON.stringify({engine,size,passed:true,row:row.bs.map(b=>b.t+' '+b.w+'×'+b.h),rowH:row.h,v:v.dirs,r180:r180.xs}));
}catch(e){console.error('step:',cur);throw e;}
finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
